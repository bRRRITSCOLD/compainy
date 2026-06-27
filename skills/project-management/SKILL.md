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
| `backend-engineer` | Go / Node / Rust services, infra, APIs |
| `systems-architect` | System topology, ADRs, NFRs, tech selection |
| `data-architect` | Store selection, schema design, vector/RAG data modeling |
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

1. **Implement** — invoke the assigned specialist agent via `superpowers:subagent-driven-development`. Brief the agent with: issue number, goal, done criteria, relevant file paths, and any constraints from prior tasks.
2. **Review** — invoke `staff-engineer` on the resulting diff.
3. **Merge** — follow the `git-workflow` skill: small cohesive PRs, default per-issue, group trivial siblings, split big ones. Squash-merge off main.
4. **Update tracking** — mark the issue closed; update the local task list; check whether closing this issue unblocks the next wave.
5. **Repeat** — pick the next ready task.

Do not start step 2 until step 1 is complete. Do not start step 5 until the issue is merged and tracking is updated.

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
