// REFERENCE TEMPLATE — run via the Workflow tool (requires opt-in).
// Review before first real use; it creates PRs and merges only after
// the staff-review gate passes, per git-workflow.
//
// Workflow tool primitives used:
//   agent(prompt, { schema, label, phase, model, effort, isolation })  — dispatch a subagent,
//        return structured output. `model`/`effort` tier the dispatch; `isolation: 'worktree'`
//        runs the agent in its own git worktree (required for parallel mutating agents).
//   parallel(thunks)                          — run an array of () => Promise concurrently (barrier)
//   log(message)                              — emit a progress line to the workflow log
//   phase(name)                               — advance the named phase in the progress UI
//   budget.total                              — total token budget (null/0 = unlimited)
//   budget.remaining()                        — tokens remaining

export const meta = {
  name: 'deliver',
  description: 'Drive GitHub issues to done: dispatch → staff-review gate → merge, with termination and runaway guards.',
  phases: [
    { title: 'Scout' },
    { title: 'Build' },
    { title: 'Verify' },
  ],
};

// --- Tunables ---
// Overridable per run via the Workflow tool's `args` global, e.g.
//   Workflow({ name: 'deliver', args: { maxRounds: 30, budgetThreshold: 0 } })
// Each falls back to its default when the arg is absent or non-numeric.
// An explicit 0 is finite, so it is preserved — e.g. budgetThreshold: 0 disables the budget check.
//
// NOTE: `args` can arrive as a JSON STRING rather than an object (depending on how
// the Workflow tool is invoked). Normalize it ONCE here — otherwise `args?.maxRounds`
// et al. are `undefined` on a string and EVERY override silently falls back to its
// default. Read all overrides from `A`, never `args` directly.
const A = (() => {
  try { return typeof args === 'string' ? JSON.parse(args) : (args ?? {}); }
  catch { return {}; }
})();
const toNum = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const MAX_ITERATIONS   = toNum(A.maxRounds, 20);       // hard cap on loop rounds
const MAX_EMPTY_ROUNDS = toNum(A.maxEmptyRounds, 3);   // stop after this many rounds with no merged PRs
const BUDGET_THRESHOLD = toNum(A.budgetThreshold, 5000); // stop if remaining tokens fall below this (0 = skip check)
// Concurrency is OFF by default — a round runs serially. Set args.parallel:true
// to fan out a round concurrently; safe only because the mutating implement/fix
// agents run with isolation:'worktree'. Never enable parallel without isolation.
const PARALLEL = A.parallel === true;

// --- Model & effort tiering (per dispatched stage) ---
// Tier by cognitive load, not by agent identity. Mechanical steps run cheap;
// the staff-engineer review GATE is never downgraded — it omits `model` so it
// inherits the session's top model (Opus when the user runs Opus) at high effort.
// Override any tier via args.models, e.g. args: { models: { implement: { model: 'opus' } } }.
const MODEL = {
  scout:     { model: 'haiku',  effort: 'low',    ...(A.models?.scout) },
  implement: { model: 'sonnet', effort: 'medium', ...(A.models?.implement) },
  fix:       { model: 'sonnet', effort: 'medium', ...(A.models?.fix) },
  review:    { effort: 'high',                     ...(A.models?.review) },   // model omitted => inherit (top model); the gate stays sharp
  security:  { effort: 'high',                     ...(A.models?.security) },  // deep audit — top model (inherit), like the review gate
  merge:     { model: 'haiku',  effort: 'low',    ...(A.models?.merge) },
  verify:    { model: 'sonnet', effort: 'low',    ...(A.models?.verify) },
};

// --- Security gate ---
// staff-engineer reviews every PR (general gate). security-architect runs a DEEP
// audit as a SECOND gate, but only when it's worth the cost:
//   'sensitive' (default) — only when the staff reviewer flags the diff as touching
//                           auth, crypto, secrets, untrusted input, tenancy, or supply-chain.
//   'always'              — audit every PR (high assurance, higher cost).
//   'off'                 — staff gate only (no security audit).
// Override per run: args: { securityReview: 'always' }.
const SECURITY_REVIEW = ['always', 'off', 'sensitive'].includes(A.securityReview)
  ? A.securityReview
  : 'sensitive';
const needSecurity = (sensitive) =>
  SECURITY_REVIEW === 'always' || (SECURITY_REVIEW !== 'off' && sensitive);

// Specialist agents by label (matches GitHub issue assignment conventions)
const SPECIALIST_MAP = {
  'lead-engineer':      'lead-engineer',
  'backend-engineer':   'backend-engineer',
  'frontend-engineer':  'frontend-engineer',
  'devops-engineer':    'devops-engineer',
  'ux-designer':        'ux-designer',
  'systems-architect':  'systems-architect',
  'data-architect':     'data-architect',
  'security-architect': 'security-architect',
};

// --- Phase 1: Scout — discover open issues and their dependencies ---
phase('Scout');

const scoutResult = await agent(
  `Run the following shell command and return the structured result:
  gh issue list --state open --json number,title,body,labels,assignees

  EXCLUDE any issue already labeled "in-progress" — it is claimed by another
  agent or a concurrent run, and must not be dispatched again (this prevents two
  agents working the same issue).

  Parse each remaining issue's body for lines matching "Depends on: #N" or "blockedBy: #N".
  Return a JSON object with:
  - openIssues: array of { number, title, agent (from labels or assignees), blockedBy: number[] }
  - totalOpen: number

  If gh is not available or returns an error, return { openIssues: [], totalOpen: 0, error: string }.`,
  {
    label: 'scout-issues',
    phase: 'Scout',
    ...MODEL.scout,
    schema: {
      type: 'object',
      properties: {
        openIssues: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              number:    { type: 'number' },
              title:     { type: 'string' },
              agent:     { type: 'string' },
              blockedBy: { type: 'array', items: { type: 'number' } },
            },
            required: ['number', 'title', 'agent', 'blockedBy'],
          },
        },
        totalOpen: { type: 'number' },
        error:     { type: 'string' },
      },
      required: ['openIssues', 'totalOpen'],
    },
  },
);

if (scoutResult.error) {
  log(`Scout error: ${scoutResult.error}. Stopping.`);
} else {
  log(`Scout complete: ${scoutResult.totalOpen} open issues found.`);

  // --- Phase 2: Build — dispatch → review → merge loop ---
  phase('Build');

  const closedThisRun = new Set();  // issue numbers merged this run
  const seen = new Set();           // issues attempted this run (dedup across rounds)
  let iterations = 0;
  let emptyRounds = 0;
  let openIssues = scoutResult.openIssues;

  // Merge happens at the workflow (main-session) level — never inside the
  // read-only staff-engineer review agent. This is a separate, write-capable
  // worker dispatched only after the review gate has approved.
  const mergePr = (prNumber) =>
    agent(
      `Run this shell command and report the result:
      gh pr merge ${prNumber} --squash --delete-branch

      Return { merged: boolean, output: string }.`,
      {
        label: `merge-pr-${prNumber}`,
        phase: 'Build',
        ...MODEL.merge,
        schema: {
          type: 'object',
          properties: {
            merged: { type: 'boolean' },
            output: { type: 'string' },
          },
          required: ['merged'],
        },
      },
    );

  // Release the in-progress claim so a flagged-open issue can be retried later
  // (otherwise scout would skip it forever as "claimed").
  const unclaim = (issueNumber) =>
    agent(
      `Run this shell command and report the result:
      gh issue edit ${issueNumber} --remove-label in-progress

      Return { unclaimed: boolean }.`,
      { label: `unclaim-${issueNumber}`, phase: 'Build', ...MODEL.merge,
        schema: { type: 'object', properties: { unclaimed: { type: 'boolean' } }, required: [] } },
    );

  // security-architect DEEP audit of a PR (the second gate). Read-only; returns a verdict.
  const securityAudit = (prNumber, branch, issueNumber, pass) =>
    agent(
      `You are the security-architect agent. Run the deep adversarial security audit
      (security-review skill) on PR #${prNumber} (branch: ${branch}) for issue #${issueNumber}${pass ? ' after a security fix pass' : ''}.
      This is read-only — do NOT merge or edit; return findings only.

      Audit against the security-review checklist: authn/sessions, authz/tenancy (IDOR,
      tenant-scoping, CSRF), injection + mass-assignment, crypto/secrets, data exposure,
      availability + security logging, supply-chain/config. Apply the project's threat
      model if one exists; otherwise the checklist is the floor.

      Approve ONLY if there are no Critical or High findings.
      Return approved=true if it clears that bar, else approved=false with specific,
      severity-ranked findings (location -> vulnerability -> exploit -> fix).`,
      { label: `security-${issueNumber}${pass ? '-refix' : ''}`, phase: 'Build', ...MODEL.security,
        schema: { type: 'object', properties: { approved: { type: 'boolean' }, findings: { type: 'string' } }, required: ['approved'] } },
    );

  // The merge path with the optional security gate. Returns true if merged.
  // staff has already approved the PR; if the diff is security-sensitive (or the
  // run forces 'always'), security-architect must ALSO approve. One security fix
  // pass on non-approval, then flag open — mirrors the staff fix-pass discipline.
  const securityGateThenMerge = async (specialist, prNumber, branch, issueNumber, sensitive) => {
    if (!needSecurity(sensitive)) {
      await mergePr(prNumber);
      await unclaim(issueNumber);
      log(`[#${issueNumber}] PR #${prNumber} merged (staff approved; no security gate).`);
      return true;
    }
    log(`[#${issueNumber}] Security-sensitive — security-architect auditing PR #${prNumber}.`);
    const sec = await securityAudit(prNumber, branch, issueNumber, false);
    if (sec.approved) {
      await mergePr(prNumber);
      await unclaim(issueNumber);
      log(`[#${issueNumber}] PR #${prNumber} merged (staff + security approved).`);
      return true;
    }
    log(`[#${issueNumber}] Security audit found issues. One security fix pass.`);
    const fix = await agent(
      `You are the ${specialist} agent.

      PR #${prNumber} (branch: ${branch}) for issue #${issueNumber} failed the security-architect audit.

      Security findings to remediate:
      ${sec.findings}

      Check out branch ${branch} in your own worktree, apply the security fixes, COMMIT,
      and push to the same branch. Do not open a new PR. Return the same prNumber and branch.`,
      { label: `securityfix-${issueNumber}`, phase: 'Build', isolation: 'worktree', ...MODEL.fix,
        schema: { type: 'object', properties: { prNumber: { type: 'number' }, branch: { type: 'string' } }, required: ['prNumber', 'branch'] } },
    );
    const sec2 = await securityAudit(fix.prNumber, fix.branch, issueNumber, true);
    if (sec2.approved) {
      await mergePr(fix.prNumber);
      await unclaim(issueNumber);
      log(`[#${issueNumber}] PR #${fix.prNumber} merged after security fix pass.`);
      return true;
    }
    await unclaim(issueNumber);
    log(`[#${issueNumber}] Security audit still failing after fix — flagged open (claim released). Findings: ${sec2.findings}`);
    return false;
  };

  while (
    openIssues.length > 0 &&
    iterations < MAX_ITERATIONS &&
    emptyRounds < MAX_EMPTY_ROUNDS &&
    (BUDGET_THRESHOLD === 0 || !budget.total || budget.remaining() > BUDGET_THRESHOLD)
  ) {
    iterations++;
    log(`--- Round ${iterations} / ${MAX_ITERATIONS} (${openIssues.length} open) ---`);

    // Find issues whose blockers are all closed: closed by us this run, OR not in
    // the current open set. Scout returns only OPEN issues, so a blockedBy dep that
    // is absent from openIssues is already closed (e.g. in a PRIOR session) — that
    // second clause is what un-strands "blockedBy a prior-closed issue". Without it,
    // `closedThisRun` only knows this-run closures, so such an issue is never ready
    // and the loop falsely reports "blocker detected, none ready" and stops.
    // (Reproduced + fix verified in a sandbox run: #4 blockedBy a pre-closed issue
    // stalled before this change, builds and merges after it.)
    const openNumbers = new Set(openIssues.map((i) => i.number));
    const ready = openIssues.filter(
      (issue) =>
        !seen.has(issue.number) &&
        issue.blockedBy.every((dep) => closedThisRun.has(dep) || !openNumbers.has(dep)),
    );

    if (ready.length === 0) {
      if (openIssues.length > 0) {
        log(`Blocker detected: ${openIssues.length} open issues but none are ready. Stopping.`);
        log(`Open: ${openIssues.map((i) => `#${i.number}`).join(', ')}`);
      }
      break;
    }

    // Mark all ready issues as seen to avoid re-dispatching on the next round
    for (const issue of ready) {
      seen.add(issue.number);
    }

    // Build stage: implement + review + merge for each ready issue.
    // Each ready issue becomes one thunk; parallel() runs the independent
    // issues concurrently. Within a thunk, implement → review runs serially.
    const roundTasks = ready.map((issue, idx) => {
      const specialist = SPECIALIST_MAP[issue.agent] ?? issue.agent ?? 'backend-engineer';

      // implementStage: dispatch the assigned specialist agent.
      // isolation:'worktree' gives each parallel implementer its OWN git
      // worktree — without this, concurrent implementers mutate one shared
      // working tree and race/clobber each other (and a sibling's --force
      // worktree removal can wipe uncommitted work). Isolation is mandatory
      // whenever implement stages run in parallel.
      const implementStage = async (iss) => {
        log(`[#${iss.number}] Dispatching ${specialist}: ${iss.title}`);
        return agent(
          `You are the ${specialist} agent.

          Implement GitHub issue #${iss.number}: "${iss.title}"

          0. CLAIM the issue — check BEFORE you set (read-then-add), so you can
             detect a prior claim. This is a best-effort advisory claim, not a
             hard lock; the real cross-run guard is "one orchestration per repo".
             labels=$(gh issue view ${iss.number} --json labels -q '.labels[].name')
             echo "$labels" | grep -qx in-progress && { echo "already claimed"; STOP — return prNumber 0; }
             gh label create in-progress 2>/dev/null || true
             gh issue edit ${iss.number} --add-label in-progress
          Follow the git-workflow skill:
          1. Cut a branch named issue-${iss.number}-<slug> from main.
          2. Implement the change. COMMIT as soon as you have a working scaffold —
             never hold a large uncommitted tree (it can be lost to a reset).
             Apply the relevant principle skills.
          3. Open a PR with title matching Conventional Commits format.
             PR body must include: Closes #${iss.number}
          4. Return the PR number and branch name.

          Apply principles-tdd, principles-ddd, principles-pragmatic-solid, principles-dry-kiss.`,
          {
            label: `implement-${iss.number}-round${iterations}-idx${idx}`,
            phase: 'Build',
            isolation: 'worktree',
            ...MODEL.implement,
            schema: {
              type: 'object',
              properties: {
                prNumber: { type: 'number' },
                branch:   { type: 'string' },
                summary:  { type: 'string' },
              },
              required: ['prNumber', 'branch'],
            },
          },
        );
      };

      // reviewStage: staff-engineer reviews and optionally merges
      const reviewStage = async (implResult) => {
        // prNumber 0 ⇒ the implementer found the issue already claimed and stopped.
        // Skip review/merge; another agent owns it.
        if (!implResult || !implResult.prNumber) {
          log(`[#${issue.number}] Skipped — already claimed by another agent (no PR opened).`);
          return { approved: false, skipped: true };
        }
        log(`[#${issue.number}] Staff-engineer reviewing PR #${implResult.prNumber}`);
        const review = await agent(
          `You are the staff-engineer agent (read-only reviewer). Do NOT merge or
          edit anything — return findings only.

          Review PR #${implResult.prNumber} (branch: ${implResult.branch}) for issue #${issue.number}.
          Apply: code-review skill, principles-tdd, principles-ddd, principles-pragmatic-solid, principles-dry-kiss.
          Check: correctness, security, performance, principle compliance.

          Also set securitySensitive=true if the diff touches authentication,
          authorization/tenancy, cryptography/secrets, untrusted input, data exposure,
          or dependencies/supply-chain — so a deeper security-architect audit runs
          before merge. (This is the general pass; depth is the security gate's job.)

          If it meets the bar: return approved=true.
          If changes are needed: return approved=false with specific, actionable findings.`,
          {
            label: `review-${issue.number}-round${iterations}-idx${idx}`,
            phase: 'Build',
            ...MODEL.review,
            schema: {
              type: 'object',
              properties: {
                approved:          { type: 'boolean' },
                findings:          { type: 'string' },
                securitySensitive: { type: 'boolean' },
              },
              required: ['approved'],
            },
          },
        );

        if (review.approved) {
          // staff approved -> run the optional security gate, then merge (the gate
          // handles merge + unclaim, or flags open on a failed security audit).
          const merged = await securityGateThenMerge(
            specialist, implResult.prNumber, implResult.branch, issue.number,
            review.securitySensitive === true,
          );
          if (merged) {
            closedThisRun.add(issue.number);
            openIssues = openIssues.filter((i) => i.number !== issue.number);
          }
        } else {
          // VERIFICATION guard: any non-approval gets exactly one fix pass,
          // then one re-review, before the issue is flagged open.
          log(`[#${issue.number}] Review requested changes. Running one fix pass.`);
          // One fix pass: re-dispatch specialist with review findings, then re-review
          const fixResult = await agent(
            `You are the ${specialist} agent.

            PR #${implResult.prNumber} (branch: ${implResult.branch}) for issue #${issue.number} needs changes.

            Findings from staff-engineer review:
            ${review.findings}

            Check out branch ${implResult.branch} in your own worktree, apply the
            fixes, COMMIT, and push to the same branch. Do not open a new PR.
            Return the same prNumber and branch.`,
            {
              label: `fix-${issue.number}-round${iterations}-idx${idx}`,
              phase: 'Build',
              isolation: 'worktree',
              ...MODEL.fix,
              schema: {
                type: 'object',
                properties: {
                  prNumber: { type: 'number' },
                  branch:   { type: 'string' },
                },
                required: ['prNumber', 'branch'],
              },
            },
          );

          const reReview = await agent(
            `You are the staff-engineer agent (read-only reviewer). Do NOT merge or
            edit anything — return findings only.

            Re-review PR #${fixResult.prNumber} (branch: ${fixResult.branch}) for issue #${issue.number} after a fix pass.
            Apply the same code-review skill and principle skills as before.
            Set securitySensitive=true if the diff touches auth, authz/tenancy, crypto/secrets,
            untrusted input, data exposure, or dependencies/supply-chain.

            If it now meets the bar: return approved=true.
            If still failing: return approved=false with specific findings (this is the last pass — the issue will be flagged open).`,
            {
              label: `rereview-${issue.number}-round${iterations}-idx${idx}`,
              phase: 'Build',
              ...MODEL.review,
              schema: {
                type: 'object',
                properties: {
                  approved:          { type: 'boolean' },
                  findings:          { type: 'string' },
                  securitySensitive: { type: 'boolean' },
                },
                required: ['approved'],
              },
            },
          );

          if (reReview.approved) {
            // staff re-approved -> security gate, then merge (gate handles merge/unclaim/flag-open)
            const merged = await securityGateThenMerge(
              specialist, fixResult.prNumber, fixResult.branch, issue.number,
              (reReview.securitySensitive ?? review.securitySensitive) === true,
            );
            if (merged) {
              log(`[#${issue.number}] PR #${fixResult.prNumber} merged after fix pass.`);
              closedThisRun.add(issue.number);
              openIssues = openIssues.filter((i) => i.number !== issue.number);
            }
          } else {
            await unclaim(issue.number);
            log(`[#${issue.number}] Still failing after fix pass — flagged open (claim released for retry). Findings: ${reReview.findings}`);
          }
        }

        return review;
      };

      // Thunk: implement then review/merge for this one issue.
      // If the implementer throws AFTER claiming the issue, release the claim so
      // the issue isn't stranded as permanently "in-progress" (and excluded by
      // scout) on the next run.
      return async () => {
        let implResult;
        try {
          implResult = await implementStage(issue);
        } catch (err) {
          await unclaim(issue.number);
          log(`[#${issue.number}] Implementer errored — claim released. ${err?.message ?? err}`);
          throw err;
        }
        return reviewStage(implResult);
      };
    });

    // SAFETY DEFAULT: run the round SERIALLY (one issue at a time). Parallelism
    // without per-agent isolation loses work (shared working tree races; a
    // worktree teardown wipes a sibling's uncommitted changes). Opt into
    // concurrency only with isolation: `args: { parallel: true }` — the
    // implement/fix agents already carry `isolation: 'worktree'`.
    let roundResults;
    if (PARALLEL) {
      // Each thunk's mutating agents run in their own worktree (isolation set above).
      roundResults = await parallel(roundTasks);
    } else {
      roundResults = [];
      for (const task of roundTasks) {
        // eslint-disable-next-line no-await-in-loop
        roundResults.push(await task().catch(() => null));
      }
    }

    const mergedThisRound = roundResults.filter(
      (_, i) => closedThisRun.has(ready[i].number),
    ).length;

    if (mergedThisRound === 0) {
      emptyRounds++;
      log(`No PRs merged this round (empty round ${emptyRounds} / ${MAX_EMPTY_ROUNDS}).`);
    } else {
      emptyRounds = 0;
      log(`Round ${iterations} complete: ${mergedThisRound} PR(s) merged.`);
    }
  }

  // Log termination reason
  if (openIssues.length === 0) {
    log('All issues closed. Proceeding to Verify.');
  } else if (iterations >= MAX_ITERATIONS) {
    log(`CAP reached (${MAX_ITERATIONS} iterations). ${openIssues.length} issue(s) still open.`);
  } else if (emptyRounds >= MAX_EMPTY_ROUNDS) {
    log(`Loop-until-dry: ${MAX_EMPTY_ROUNDS} consecutive empty rounds. Stopping.`);
  } else {
    log('Budget threshold reached. Stopping early.');
  }

  // --- Phase 3: Verify — confirm CI is green ---
  phase('Verify');

  const verify = await agent(
    `Run the local CI validation gate and report results:
    node scripts/ci/validate.mjs

    Also run any test suites present (e.g. \`npm test\`, \`go test ./...\`, \`cargo test\`).

    Return a summary of: passed (true/false), CI output snippet, test output snippet.
    If validation fails, list which checks failed and what to fix.`,
    {
      label: 'verify-ci',
      phase: 'Verify',
      ...MODEL.verify,
      schema: {
        type: 'object',
        properties: {
          passed:       { type: 'boolean' },
          ciOutput:     { type: 'string' },
          testOutput:   { type: 'string' },
          failedChecks: { type: 'array', items: { type: 'string' } },
        },
        required: ['passed'],
      },
    },
  );

  // TERMINATION guard: a red Verify is a non-success outcome, not swallowed.
  const remaining = openIssues.length;
  if (verify?.passed && remaining === 0) {
    log('DONE: 0 open issues and Verify is green.');
  } else {
    const reasons = [];
    if (remaining > 0) reasons.push(`${remaining} issue(s) still open`);
    if (!verify?.passed) {
      reasons.push(`Verify failed${verify?.failedChecks?.length ? `: ${verify.failedChecks.join(', ')}` : ''}`);
    }
    log(`NOT DONE — ${reasons.join('; ')}. Operator action required.`);
  }
}
