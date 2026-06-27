// REFERENCE TEMPLATE — run via the Workflow tool (requires opt-in).
// Review before first real use; it creates PRs and merges only after
// the staff-review gate passes, per git-workflow.
//
// Workflow tool primitives used:
//   agent(prompt, { schema, label, phase })  — dispatch a subagent, return structured output
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
const toNum = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const MAX_ITERATIONS   = toNum(args?.maxRounds, 20);       // hard cap on loop rounds
const MAX_EMPTY_ROUNDS = toNum(args?.maxEmptyRounds, 3);   // stop after this many rounds with no merged PRs
const BUDGET_THRESHOLD = toNum(args?.budgetThreshold, 5000); // stop if remaining tokens fall below this (0 = skip check)

// --- Model & effort tiering (per dispatched stage) ---
// Tier by cognitive load, not by agent identity. Mechanical steps run cheap;
// the staff-engineer review GATE is never downgraded — it omits `model` so it
// inherits the session's top model (Opus when the user runs Opus) at high effort.
// Override any tier via args.models, e.g. args: { models: { implement: { model: 'opus' } } }.
const MODEL = {
  scout:     { model: 'haiku',  effort: 'low',    ...(args?.models?.scout) },
  implement: { model: 'sonnet', effort: 'medium', ...(args?.models?.implement) },
  fix:       { model: 'sonnet', effort: 'medium', ...(args?.models?.fix) },
  review:    { effort: 'high',                     ...(args?.models?.review) },   // model omitted => inherit (top model); the gate stays sharp
  merge:     { model: 'haiku',  effort: 'low',    ...(args?.models?.merge) },
  verify:    { model: 'sonnet', effort: 'low',    ...(args?.models?.verify) },
};

// Specialist agents by label (matches GitHub issue assignment conventions)
const SPECIALIST_MAP = {
  'backend-engineer':   'backend-engineer',
  'frontend-engineer':  'frontend-engineer',
  'ux-designer':        'ux-designer',
  'systems-architect':  'systems-architect',
  'data-architect':     'data-architect',
};

// --- Phase 1: Scout — discover open issues and their dependencies ---
phase('Scout');

const scoutResult = await agent(
  `Run the following shell command and return the structured result:
  gh issue list --state open --json number,title,body,labels,assignees

  Parse each issue's body for lines matching "Depends on: #N" or "blockedBy: #N".
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

  while (
    openIssues.length > 0 &&
    iterations < MAX_ITERATIONS &&
    emptyRounds < MAX_EMPTY_ROUNDS &&
    (BUDGET_THRESHOLD === 0 || !budget.total || budget.remaining() > BUDGET_THRESHOLD)
  ) {
    iterations++;
    log(`--- Round ${iterations} / ${MAX_ITERATIONS} (${openIssues.length} open) ---`);

    // Find issues whose blockers are all closed (closed by us or already closed before the run)
    const ready = openIssues.filter(
      (issue) =>
        !seen.has(issue.number) &&
        issue.blockedBy.every((dep) => closedThisRun.has(dep)),
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

      // implementStage: dispatch the assigned specialist agent
      const implementStage = async (iss) => {
        log(`[#${iss.number}] Dispatching ${specialist}: ${iss.title}`);
        return agent(
          `You are the ${specialist} agent.

          Implement GitHub issue #${iss.number}: "${iss.title}"

          Follow the git-workflow skill:
          1. Cut a branch named issue-${iss.number}-<slug> from main.
          2. Implement the change. Apply the relevant principle skills.
          3. Open a PR with title matching Conventional Commits format.
             PR body must include: Closes #${iss.number}
          4. Return the PR number and branch name.

          Apply principles-tdd, principles-ddd, principles-pragmatic-solid, principles-dry-kiss.`,
          {
            label: `implement-${iss.number}-round${iterations}-idx${idx}`,
            phase: 'Build',
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
        log(`[#${issue.number}] Staff-engineer reviewing PR #${implResult.prNumber}`);
        const review = await agent(
          `You are the staff-engineer agent (read-only reviewer). Do NOT merge or
          edit anything — return findings only.

          Review PR #${implResult.prNumber} (branch: ${implResult.branch}) for issue #${issue.number}.
          Apply: code-review skill, principles-tdd, principles-ddd, principles-pragmatic-solid, principles-dry-kiss.
          Check: correctness, security, performance, principle compliance.

          If it meets the bar: return approved=true.
          If changes are needed: return approved=false with specific, actionable findings.`,
          {
            label: `review-${issue.number}-round${iterations}-idx${idx}`,
            phase: 'Build',
            ...MODEL.review,
            schema: {
              type: 'object',
              properties: {
                approved:  { type: 'boolean' },
                findings:  { type: 'string' },
              },
              required: ['approved'],
            },
          },
        );

        if (review.approved) {
          await mergePr(implResult.prNumber);
          log(`[#${issue.number}] PR #${implResult.prNumber} merged.`);
          closedThisRun.add(issue.number);
          // Remove from openIssues now that it's merged
          openIssues = openIssues.filter((i) => i.number !== issue.number);
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

            Apply the fixes and push to the same branch. Do not open a new PR.
            Return the same prNumber and branch.`,
            {
              label: `fix-${issue.number}-round${iterations}-idx${idx}`,
              phase: 'Build',
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

            If it now meets the bar: return approved=true.
            If still failing: return approved=false with specific findings (this is the last pass — the issue will be flagged open).`,
            {
              label: `rereview-${issue.number}-round${iterations}-idx${idx}`,
              phase: 'Build',
              ...MODEL.review,
              schema: {
                type: 'object',
                properties: {
                  approved: { type: 'boolean' },
                  findings: { type: 'string' },
                },
                required: ['approved'],
              },
            },
          );

          if (reReview.approved) {
            await mergePr(fixResult.prNumber);
            log(`[#${issue.number}] PR #${fixResult.prNumber} merged after fix pass.`);
            closedThisRun.add(issue.number);
            openIssues = openIssues.filter((i) => i.number !== issue.number);
          } else {
            log(`[#${issue.number}] Still failing after fix pass — flagged open. Findings: ${reReview.findings}`);
          }
        }

        return review;
      };

      // Thunk: implement then review/merge for this one issue.
      return async () => {
        const implResult = await implementStage(issue);
        return reviewStage(implResult);
      };
    });

    // Fan out ready issues; parallel() takes an array of thunks and is a
    // barrier — it awaits every issue's implement→review chain this round.
    const roundResults = await parallel(roundTasks);

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
