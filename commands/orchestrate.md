---
description: Drive a goal or set of issues to done with the autonomous-delivery loop (dispatch → review gate → merge) until reached or a guard trips.
argument-hint: <goal or #issues> [--rounds N] [--empty-rounds N] [--budget N]
---

Invoke the `autonomous-delivery` skill for: $ARGUMENTS

First, strip any of these optional guard-override flags out of the arguments — the remainder is the goal/issue set:

- `--rounds N` — hard max loop rounds (CAP). Default 20.
- `--empty-rounds N` — stop after N consecutive rounds with no merged PRs. Default 3.
- `--budget N` — stop when remaining tokens fall below N (0 disables the check). Default 5000.

Apply the parsed values as the loop guards. When running the reference Workflow script, pass them through as the Workflow `args` object, e.g. `args: { maxRounds: N, maxEmptyRounds: N, budgetThreshold: N }` — the script reads these and falls back to its defaults for any omitted key. In `/loop`/ScheduleWakeup mode, enforce the same CAP and empty-round count directly. Any flag the user omits keeps its default.

Run the loop until 0 open issues + CI green, or until a guard trips. Report final status: issues closed, PRs merged, any blockers or open items remaining.

**MODEL — cost control (do not skip).** Tiering is automatic ONLY when you run the reference Workflow script (mode A) — its `MODEL` map puts implementers on Sonnet and only the review gate on the top tier. If you run the loop **inline in the main session** (mode B), you MUST set the Agent tool's `model` on every dispatch — an unset `model` inherits the session's most expensive model (Opus) and silently runs the whole loop at top-tier cost. Implementer + fix → `model: 'sonnet'`; scout/merge/validate → `model: 'haiku'`; staff-engineer review gate → omit `model` (inherits top, by design). When in doubt, **prefer mode A (the Workflow script)** so tiering is deterministic rather than dependent on remembering it per call.

The `autonomous-delivery` skill holds the full loop definition, all guards, and execution-mode options (Workflow tool vs. main-session dispatch) — see its "Model & effort tiering" section.
