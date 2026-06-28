# Getting started

How to drive a project end-to-end with the `ai` plugin — from an empty repo to a shipped, reviewed build — while keeping each session's context clean and the autonomous loop's cost bounded.

The one idea to hold onto: **plan the whole goal once, then deliver one epic per session.** A long autonomous run on a whole product bloats context, burns tokens, and accumulates stale reasoning. A goal broken into epics, with one epic driven to done per fresh session, stays sharp and cheap — and the GitHub issues + progress ledger carry state across the session boundaries.

## The flow at a glance

```
                          once, at the start
  /init-stack ──▶ /deliver "<goal>" ──▶ frame ▸ plan(EPICS+issues) ▸ architecture ▸ first slice
  (only if the                                              │
   stack differs)                                           ▼
                                            then, ONE EPIC PER FRESH SESSION
                                  ┌─────────────────────────────────────────────┐
                                  │  fresh session                              │
                                  │   read handoff/ledger                        │
                                  │   /orchestrate "#<epic issues> --rounds N"   │
                                  │     dispatch ▸ staff review gate ▸ merge     │
                                  │   handoff  ─────────────────────────────────┼─▶ next epic
                                  └─────────────────────────────────────────────┘
```

`/deliver` is the **whole pipeline incl. planning** — run it once to frame the goal, decide the architecture, have the lead-engineer plan the build, track it as epics + issues, and build the first vertical slice. `/orchestrate` is **just the build loop** on already-tracked issues — run it once per epic thereafter.

## Prerequisites

1. Install the plugin and its companions (the `ai` marketplace lists them): the `ai` plugin, `superpowers`, and the `figma` companion.
2. If the project has UI, **authenticate the Figma MCP** in the session before the design phase (needs a Figma Full seat to write). Without it, `ux-designer` falls back to handing a build spec up to the main session.
3. Be in a git repo with a GitHub remote and `gh` authenticated (the loop creates issues/PRs and merges).
4. **One orchestration per repo at a time.** Never run two `/deliver` or `/orchestrate` sessions against the same repo — they double-dispatch and collide.

## Step 1 — Stack profile (only if you diverge from the defaults)

The plugin is opinionated by default: TanStack Start + shadcn/ui on Base UI, Go/Node/Rust, AWS/Cloudflare/Hetzner. If your project uses a different stack, run:

```
/ai:init-stack
```

It interviews you and writes `.ai/stack-profile.md`; the implementation skills read it and adapt (researching the chosen tech first). If you're on the defaults, skip this — the defaults Just Work. Engineering discipline (TDD/DDD/SOLID/DRY, ports-and-adapters, test tiers, naming) is the same either way.

## Step 2 — Kick off the goal with `/deliver`

Run `/ai:deliver "<goal>"` once. It sequences the team across the upfront phases:

- **Frame** (brainstorming) — pin the real requirement and done-criteria.
- **Architecture** (`systems-architect`) — topology, ADRs, NFRs; it **delegates the security posture to `security-architect`** (threat model — STRIDE, trust boundaries — for anything with auth, money, PII, or multi-tenant data) and **store choice to `data-architect`**.
- **Data** (`data-architect`) — schemas, indexing, migrations.
- **Plan the build** (`lead-engineer`) — turn the decided design into one coherent, sequenced, PR-sized **implementation plan** (build order, integration seams, test hooks). The technical plan comes from the tech lead, not the PM.
- **Track & coordinate** (`project-manager`) — transcribe that implementation plan into **epics → tracked GitHub issues** (task → issue, section → epic, mirroring the plan's dependencies and owners), then own the live state: status, critical path, blockers, ledger. The PM represents and tracks the plan; it does not re-decide the task units or author the sequencing.
- **Platform/DevEx** (`devops-engineer`) — stand up the local dev loop (`docker-compose`, task runner, seeds) and CI/CD **early**, so everyone builds against working infra.
- **Build** — the first vertical slice, through the dispatch → review → merge loop.

The order matters: **design → implementation plan → issue tracking**. The PM never creates issues before the technical plan exists — it transcribes the lead-engineer's tasks into the tracker, it doesn't invent them.

End the kickoff session with the `handoff` skill so the next session resumes instantly.

> Scope discipline: let `/deliver` produce the **epic breakdown and architecture for the whole goal**, but don't let it try to autonomously build the entire product in one session. Build the first slice, then stop and hand off. The rest is one-epic-per-cycle.

## Step 3 — One epic per dev cycle

For each remaining epic, start a **fresh session** (small context = sharp Claude) and:

1. Read the handoff + `.superpowers/delivery-progress.md` ledger + `gh issue list` — trust those over memory.
2. Drive just that epic's issues to done with the autonomous loop, **with guards**:
   ```
   /ai:orchestrate "<epic name or #issue numbers> --rounds 12 --budget 400000"
   ```
   The loop runs dispatch → `staff-engineer` review gate → squash-merge until the epic's issues are closed or a guard trips. It's **serial by default** (safe); only add `args.parallel: true` via the Workflow tool once the epic's issues are genuinely file-disjoint.
3. When the epic is done (or a guard trips), run `handoff` and start a new session for the next epic.

Why one epic per cycle: bounded context (cheaper, sharper), bounded blast radius (a bad run damages one epic, not the product), bounded cost (the `--rounds`/`--budget` caps apply per cycle), and durable resumption (issues + ledger survive the session boundary so any fresh session can pick up).

## Cost & safety guards (how runaway is prevented)

| Guard | What it does | How to set |
|---|---|---|
| **Serial by default** | one issue at a time; no shared-worktree races | default; opt into concurrency only with isolation (`args.parallel`) |
| **Round cap** | hard stop after N loop rounds | `--rounds N` (default 20) |
| **Empty-round cap** | stop after N rounds with no merge | `--empty-rounds N` (default 3) |
| **Budget** | stop when remaining tokens < N | `--budget N` (default 5000; `0` disables) |
| **One orchestration/repo** | no concurrent runs double-dispatching | operational rule |
| **Review gate** | every PR through `staff-engineer` before merge; one fix pass then flag-open | always on |
| **Model tiering** | cheap models for mechanical steps, top model for the review gate | per-dispatch (Workflow path) |
| **Commit-early + claim** | implementers commit scaffolds immediately; issues are claimed so two agents never collide | always on |

Per-epic, set `--rounds`/`--budget` to the epic's size. Small epic → `--rounds 8`; large → `--rounds 15`. Keep epics small enough that one cycle finishes one epic.

## The team (10 agents)

| Agent | Role |
|---|---|
| `ux-designer` | Authors the design system **in Figma**; extracts tokens; hands off component inventory (Code Connect → frontend) |
| `frontend-engineer` | React + TanStack Start from tokens (shadcn/ui on Base UI); pages; wires + publishes Code Connect |
| `backend-engineer` | Go/Node/Rust service & domain code, APIs, service-coupled infra |
| `devops-engineer` | Platform & DevEx: IaC, CI/CD, local dev loop, containers, observability |
| `systems-architect` | Topology, service boundaries, ADRs, NFRs, tech selection |
| `data-architect` | Store selection, schema design, vector/RAG modeling |
| `security-architect` | Threat model, auth/secrets/data-protection design, deep security audit |
| `lead-engineer` | Tech lead — owns the implementation plan (design → sequenced PR-sized build plan); cross-cutting technical calls |
| `staff-engineer` | Read-only reviewer — the gate after every implementation |
| `project-manager` | Work breakdown — turns the lead-engineer's plan into epics/issues; tracks (does **not** author the plan or dispatch) |

Subagents can't spawn subagents — all dispatch happens at the main session, never from inside an agent.

## What else to call

- **`handoff`** — run before ending any session with open work, and whenever context gets large. It's what makes one-epic-per-cycle resumable.
- **`/security-review`** — on epics that touch auth, crypto, untrusted input, secrets, or multi-tenant data, on top of the `security-architect` audit.
- **`/code-review`** — for a focused review of the current diff.

## Example — kickoff prompt

Paste this in the **kickoff session** (adapt the goal/stack/links). It frames + plans + architects the whole goal, then builds only the first slice.

```
Build <PRODUCT> in THIS repo. You have the `ai` plugin (10 agents: ux-designer,
frontend-engineer, backend-engineer, devops-engineer, systems-architect,
data-architect, security-architect, lead-engineer, staff-engineer, project-manager) + superpowers
+ the figma companion. Full permission to auto-approve tools, gh, branches, PRs,
squash-merges. One orchestration in this repo only.

0. STACK: if the stack differs from the plugin defaults, run /ai:init-stack first
   and write .ai/stack-profile.md. [e.g. "uses floci for AWS-local, NOT localstack;
   docker-compose for mongodb/postgres/redis/rabbitmq"]

1. KICKOFF: run /ai:deliver to frame the goal and decide the architecture first —
   pull in security-architect to threat-model (multi-tenant isolation / auth / PII)
   and data-architect for the data model. THEN have lead-engineer turn that design
   into the implementation plan, and only then project-manager transcribe the plan
   into EPICS + tracked GitHub issues (design → plan → issues, in that order). Have
   devops-engineer stand up the local dev loop + CI/CD early.

GOAL: <bullets — capabilities, constraints, retention, multi-tenancy, etc.>

DESIGN (Figma must be authed with write access):
  - Design system source: <figma url> → ux-designer builds it IN Figma + tokens + component inventory
  - App screens: <figma url> → frontend-engineer builds FROM the design system (responsive) + wires Code Connect for the built components

DISCIPLINE: principle skills (TDD, DDD strategic-always, pragmatic SOLID, DRY/KISS/YAGNI);
  test-design seeds adversarial cases; git-workflow (small cohesive revertible PRs,
  Conventional Commits, squash-merge off main).

GUARDS: every PR through the staff-engineer review gate; serial dispatch; write a
  durable ledger (.superpowers/delivery-progress.md) + GitHub issues as you go;
  commit scaffolds immediately.

TONIGHT'S TARGET (don't fake "done"): epic breakdown + issues, architecture + ADRs +
  threat model, data model + multi-tenant boundaries, docker dev loop + CI scaffolded,
  design system + tokens in Figma, and the FIRST vertical slice built/reviewed/merged.
  Then run the handoff skill and STOP — the rest is one epic per fresh session.
```

## Example — per-epic prompt (each subsequent session)

```
Resume <PRODUCT> in THIS repo. Fresh session. Full permission as before; one
orchestration in this repo only.

1. Rebuild state from durable sources, not memory: read the handoff file,
   .superpowers/delivery-progress.md, `gh issue list`, and `git log`. Report status.

2. Drive EPIC "<epic name>" (issues #<list>) to done:
   /ai:orchestrate "#<list> --rounds 12 --budget 400000"
   Serial dispatch. Every PR through the staff-engineer review gate; if a sensitive
   issue touches auth/secrets/tenancy, run the security-review audit too.

3. When the epic is done or a guard trips: run the handoff skill, leave a clear
   status (merged / open / blocked), and STOP. Next epic is a new session.
```
