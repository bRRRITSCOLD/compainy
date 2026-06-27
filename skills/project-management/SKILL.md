---
name: project-management
description: Orchestrates delivery of a goal or epic into tracked, agent-assigned GitHub issues. Invoked when the main session needs to plan, decompose, coordinate, or status-check a multi-task effort. Triggers include "plan this epic", "break this into issues", "coordinate this feature", "what is the status", "create a roadmap", "manage the work", "decompose this", "assign agents to tasks", "track dependencies", or "what is the critical path".
---

# Project Management Skill

Lightweight orchestration playbook for the main Claude Code session. Turns a vague goal into a sequenced set of GitHub issues with specialist-agent assignments, dependency tracking, and a clean dispatch loop — nothing more than that.

Apply `principles-dry-kiss`: do not over-process. No Gantt charts, no ceremony, no work that doesn't directly advance the goal.

## Dispatch constraint (read this first)

**Only the main Claude Code session can dispatch specialist agents.** Subagents cannot spawn other subagents — the harness blocks agent nesting. If this skill runs inside a subagent, it produces the plan only; the main session executes the dispatch loop.

## Specialist agents

The team of specialist agents this skill coordinates:

| Agent | Owns |
|---|---|
| `ux-designer` | Design systems, Figma authoring, token extraction |
| `frontend-engineer` | React + TanStack Start components, pages, Code Connect |
| `backend-engineer` | Go / Node / Rust service & domain code, APIs, service-coupled infra |
| `devops-engineer` | Platform & DevEx — IaC provisioning, CI/CD, local dev loop, containers, observability |
| `systems-architect` | System topology, ADRs, NFRs, tech selection |
| `data-architect` | Store selection, schema design, vector/RAG data modeling |
| `security-architect` | Threat modeling, auth/secrets/data-protection design, supply-chain, deep security review |
| `staff-engineer` | Read-only reviewer — runs after every implementation task |

## Process

### 1. Clarify goal + done criteria

Before decomposing, state in one or two sentences:
- What is being built or changed?
- What does "done" look like? (acceptance criteria, user-visible outcome, metrics)

If the goal is ambiguous, ask one focused clarifying question. Do not decompose an unclear goal.

### 2. Decompose into tasks

Break the goal into tasks where each task is:
- **Independently shippable** — produces a reviewable artifact (code, ADR, design file, schema)
- **Owned by one specialist agent** — assign the best-fit agent from the table above
- **Small enough to fit in a single agent session** — if it feels large, split it

Record a `blocks`/`blockedBy` dependency for every task that cannot start until another finishes. Tasks with no `blockedBy` are parallelizable.

### 3. Track as GitHub issues

For each task, create a GitHub issue:

```bash
gh issue create \
  --title "<Agent>: <task description>" \
  --body "**Agent:** <agent-name>\n**Depends on:** #N (or none)\n**Done when:** <acceptance criteria>"
```

Keep a local tracking list (markdown task list or simple table) that mirrors the issues with their numbers, assigned agent, status (todo / in-progress / done / blocked), and dependency links. Update it as issues close.

### 4. Sequence: parallel vs. serial

Group tasks into waves:
- **Wave 0** — no dependencies; start immediately (can run in parallel)
- **Wave N** — tasks whose `blockedBy` issues are all closed

Do not start a blocked task early. Do not serialize tasks that are actually independent.

### 5. Dispatch loop (main session only)

For each ready task (status = todo, all blockers closed):

0. **Claim it** — before dispatching, mark the issue owned (`gh issue edit <n> --add-label in-progress`) and confirm it isn't already claimed/in-flight. **Never dispatch two agents on the same issue, or on file-overlapping issues, without per-agent worktree isolation** — sharing a working tree loses work (see `git-workflow` → "Concurrency safety"). If you can't isolate, run those tasks serially.
1. **Implement** — invoke the assigned specialist agent via `superpowers:subagent-driven-development`. Brief the agent with: issue number, goal, done criteria, relevant file paths, and any constraints from prior tasks. Tell it to **commit as soon as a scaffold works** — don't hold a large uncommitted tree.
2. **Review** — invoke `staff-engineer` on the resulting diff.
3. **Merge** — follow the `git-workflow` skill: small cohesive PRs, default per-issue, group trivial siblings, split big ones. Squash-merge off main.
4. **Update tracking** — mark the issue closed; update the local task list; check whether closing this issue unblocks the next wave.
5. **Repeat** — pick the next ready task.

Do not start step 2 until step 1 is complete. Do not start step 5 until the issue is merged and tracking is updated.

### Model selection (required at dispatch)

**Always specify the model explicitly when dispatching a subagent.** An omitted model silently inherits the session's model — usually the most capable and expensive — so a loop that "doesn't pick" quietly runs every implementer and reviewer at the top tier. Choose by the task's cognitive load, not the agent's identity (agents stay `model: inherit`; the *choice* is made per dispatch, via the Agent tool's `model` param or the Workflow `agent({model})` opt).

Rubric:

| Task shape | Model |
|---|---|
| Mechanical — 1-2 files, complete spec, transcription + tests; or status scans / merges / validation runs | **cheap** (e.g. haiku) |
| Standard — multiple files, integration concerns, pattern-matching, debugging | **standard** (e.g. sonnet) |
| Architecture / data modeling / design judgment / broad codebase understanding | **most capable** (e.g. opus) |
| Review — scaled to risk: a trivial change → cheap; a subtle concurrency/security/correctness change → most capable | **≥ the implementer's tier, never below it** |

- **Mid-tier is the default starting point**, not the floor: the cheapest models routinely take 2-3× the turns on multi-step work, costing more overall. Reach for cheap only when the task is genuinely mechanical.
- The **review gate** is the one deliberate exception to "always specify": dispatching it without a `model` so it inherits the session's top model is intentional (keeps the gate sharp) — that is a chosen omission, not a forgotten one. Never let the reviewer run weaker than the author.
- `autonomous-delivery` → "Model & effort tiering" applies this rubric to the concrete Scout → Build → Verify stages.

### 6. Status, blockers, and risks

After each merge — or on request — post a brief status update:

```
Done:    #N, #M
In progress: #P (blocked on #Q)
Next: #R, #S (wave 2, parallelizable)
Risks: <anything that could slip the goal>
```

Surface blockers immediately. Do not silently carry a blocked task.

### 7. Handoff between work chunks

Before ending any session that has open issues, run the `handoff` skill. Record: issues closed this session, issues in flight, next wave, and any decisions made. The `SessionStart` hook surfaces the handoff in the next session.

## Cross-references

- `superpowers:subagent-driven-development` — per-task implement → review cycle used in the dispatch loop
- `git-workflow` — branching, commit conventions, PR sizing, and merge rules
- `handoff` — session continuity between work chunks
- `principles-dry-kiss` — KISS/YAGNI keeps the process lean; do not add coordination overhead that the task doesn't need
