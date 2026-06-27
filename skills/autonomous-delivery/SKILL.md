---
name: autonomous-delivery
description: Drives a pre-decomposed set of GitHub issues to done with minimal human input. Invoked by the main session when someone says "autonomous loop", "run until done", "don't stop until the goal", "self-sustaining loop", "orchestrate the whole build", "drive these issues to done", "agentic loop", or "/orchestrate". Assumes the goal has already been broken into tracked GitHub issues (via feature-delivery or project-management); this skill owns the dispatch-review-merge loop and all termination guards.
---

# Autonomous Delivery Skill

Runs the main Claude Code session in a self-sustaining loop: dispatch specialist → staff-engineer review gate → squash-merge, repeating until all open issues are closed or a guard trips. Requires a goal already decomposed into GitHub issues with agent assignments and dependency links.

Apply `principles-dry-kiss`: do not add phases or coordination overhead the task does not need. This skill is about execution, not planning.

## When to use

Use this skill when:
- A goal has already been decomposed into tracked GitHub issues (via `feature-delivery` / `project-management`).
- The main session should drive those issues to done without stopping for human input at each issue.
- The goal is bounded enough that a max-iteration CAP and token budget can guard against runaway execution.

Do not use this skill for untracked or undecomposed goals — run `feature-delivery` first.

## The loop

```
until (open issues == 0) or (iterations >= CAP) or (budget exhausted):
  ready = issues whose dependencies are all closed
  if ready empty and open > 0:
    report blocker; stop
  for issue in ready (respecting parallel-safe vs serial):
    dispatch assigned specialist agent  -> branch + implement + PR (git-workflow)
    dispatch staff-engineer review      -> GATE
    if approved:
      squash-merge per git-workflow
    else:
      ONE fix pass -> re-review
      if still failing: flag + leave open
  iterations++

done when: 0 open issues AND CI/validate green AND tests pass
```

Parallel-safe issues (no shared file overlap, independent scope) may be dispatched concurrently. Serial issues (dependency edges, shared files) must run sequentially.

The reference script can only see **declared `blockedBy` edges** — it cannot infer shared-file overlap from issue metadata. So any two issues that touch the same files MUST carry a `blockedBy` edge between them; the absence of an edge is the operator's assertion that the issues are parallel-safe. Encode file contention as a dependency when decomposing (in `feature-delivery` / `project-management`).

## Guards

| Guard | Rule |
|---|---|
| **TERMINATION** | The dispatch loop drains ready issues until open issues = 0 (or a RUNAWAY/budget guard trips). It then runs a **Verify** step — `node scripts/ci/validate.mjs` plus the project's test suites. A red Verify is reported as a non-success outcome (flag + stop), never silently swallowed. The goal counts as *reached* only when open issues = 0 AND validate is green AND tests pass. |
| **VERIFICATION** | Every PR passes through the staff-engineer review gate before merge. The reviewer is read-only and returns findings only — the **merge runs at the main-session/workflow level**, only after the gate approves. Never merge unreviewed. On non-approval: exactly one fix pass, then one re-review; if it still fails, flag the issue open and continue to the next. |
| **RUNAWAY** | Hard max-iteration CAP (default **20** rounds). Also stop when `budget.remaining() < THRESHOLD` (default **5000**) if running via the Workflow tool. (A consecutive-empty-rounds counter — default **3** — exists as a backstop, but because each issue is attempted at most once per run, the loop normally terminates first by exhausting *ready* issues — the CAP and budget are the load-bearing guards.) All three are **user-overridable** — see "Tuning the guards" below. |
| **DURABLE STATE** | GitHub issues + a progress ledger file (`.superpowers/delivery-progress.md`) are the resume map. They survive crash and context compaction. On resume, trust closed issues and `git log` over in-memory state — never reconstruct history from memory. |
| **CONTEXT-ROT** | Run the `handoff` skill before ending any session with open issues. Prefer a fresh Claude Code session between phases or large work chunks — long sessions accumulate stale reasoning. |

### Tuning the guards

All three RUNAWAY knobs are parameterizable per run; omit any to keep its default:

| Guard | Default | `/orchestrate` flag | Workflow `args` key |
|---|---|---|---|
| Max loop rounds (CAP) | 20 | `--rounds N` | `maxRounds` |
| Consecutive empty rounds | 3 | `--empty-rounds N` | `maxEmptyRounds` |
| Budget threshold (tokens) | 5000 | `--budget N` | `budgetThreshold` |

- Via command: `/orchestrate <goal> --rounds 30 --budget 0` (`--budget 0` disables the budget check).
- Via the Workflow tool directly: `args: { maxRounds: 30, maxEmptyRounds: 5, budgetThreshold: 0 }`. The reference script reads these from the `args` global and falls back to each default for any omitted key.

## Two execution modes

### (A) Workflow tool — preferred for a bounded goal

Run the reference script via the Workflow tool:

```
${CLAUDE_PLUGIN_ROOT}/scripts/workflows/deliver.workflow.mjs
```

This gives deterministic fan-out with a built-in budget guard and explicit Scout → Build → Verify phases. The Workflow tool requires explicit opt-in by the user. Review the script before first real use — it creates PRs and merges only after the staff-engineer review gate passes.

### (B) `/loop` or ScheduleWakeup — for long unattended or polling runs

Use Claude Code's built-in `/loop` command or `ScheduleWakeup` (host features, not skills in this plugin) to re-check ready issues on each tick (or self-paced). Good for overnight runs or when the goal spans many sessions. Pair with the DURABLE STATE guard — write the progress ledger each tick so any session can resume.

## Honesty constraint

The loop and all dispatch run **only at the main Claude Code session level**. Subagents cannot spawn other subagents — the harness blocks agent nesting. Specialist agents produce PRs; the loop in the main session merges them per `git-workflow`. Unattended running requires pre-authorized permissions (tool allowlists and `gh` CLI auth).

## Cross-references

- `feature-delivery` — front door for full delivery including planning; run this before autonomous-delivery if the goal is not yet decomposed
- `project-management` — issue decomposition, dependency tracking, dispatch loop
- `git-workflow` — branching, commit conventions, PR sizing, squash-merge
- `staff-engineer` (agent) — review gate; invoked after every implementation PR
- `handoff` — write before ending any session with open issues
- `principles-dry-kiss` — KISS/YAGNI: only run the phases and guards the goal actually needs
