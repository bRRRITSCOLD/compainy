---
name: feature-delivery
description: End-to-end feature delivery orchestration for the main Claude session. Invoked when the goal is to build something completely — from idea to shipped. Triggers include "build X end to end", "deliver a feature", "deliver an app", "deliver a platform", "take this from idea to shipped", "run the whole team on this", "full delivery", "ship this", or "/deliver".
---

# Feature Delivery Skill

Full-stack delivery playbook for the main Claude Code session. Sequences the specialist agents — brainstorm → plan → architecture → data → build → finish — scaling the process to the real size of the goal. Small goals skip phases; large goals run them all.

Apply `principles-dry-kiss`: phases are tools, not ceremony. Do only the phases that the goal actually needs.

## Dispatch constraint (read this first)

**Only the main Claude Code session can dispatch specialist agents.** Subagents cannot spawn other subagents — the harness blocks agent nesting. When running inside a subagent this skill produces a plan only; the main session executes the dispatch loop.

## Phase order

### Phase 0 — Frame

Invoke `superpowers:brainstorming` to turn the raw goal into a concrete spec. Output a spec document at `docs/superpowers/specs/<feature-name>.md` covering: problem statement, user/system outcomes, scope boundaries (in/out), and open questions.

Skip if the goal is already fully specified with acceptance criteria.

### Phase 1 — Plan & track

Invoke the `project-manager` agent (via the `project-management` skill) to:
- Clarify done criteria
- Decompose the spec into independently shippable tasks
- Create a GitHub issue per task with agent assignments, acceptance criteria, and `blockedBy` links
- Produce a sequenced delivery roadmap (wave 0, wave 1, …)

Output: a GitHub issue list + local tracking doc. This becomes the execution contract for Phase 4.

### Phase 2 — Architecture

Invoke the `systems-architect` agent (via the `architecture` skill) to:
- Define service and bounded-context boundaries
- Produce a C4 container diagram
- Enumerate NFRs (scalability, availability, latency, cost, security)
- Select technology with explicit tradeoff tables
- Write ADRs for every significant decision at `docs/adr/NNNN-title.md`

Skip for self-contained utilities where one process/service is the obvious answer. Do not produce ADRs for decisions that are not load-bearing.

### Phase 3 — Data

Invoke the `data-architect` agent (via the `data-modeling` skill) to:
- Choose stores per workload (relational, columnar, document, key-value, vector, time-series)
- Design schemas, indexes, and constraints aligned to DDD aggregate boundaries
- Plan retention tiers (hot/warm/cold) when data volume or cost warrants it
- Model vector embeddings and retrieval pipeline if semantic search is needed
- Write a migration plan

Skip for features with no persistence layer, or where the existing schema is unchanged.

### Phase 4 — Build loop

Execute the `project-management` dispatch loop — follow the `git-workflow` skill for PR sizing (small cohesive PRs, default per-issue, group trivial siblings, split big ones; squash-merge off main):

For each ready issue (wave order, blockers closed):

1. **Implement** — dispatch the assigned specialist via `superpowers:subagent-driven-development`:
   - `backend-engineer` — services, APIs, infra (`backend-service-patterns`, `cloud-infra`)
   - `ux-designer` — design system, tokens, Figma authoring (`figma-design-system`, `figma-code-connect`, `design-theming`)
   - `frontend-engineer` — React + TanStack Start components, pages (`react-component-library`, `code-connect-impl`, `pages-templates`)
2. **Review** — invoke `staff-engineer` on the diff.
3. **Merge** — squash-merge the PR; close the issue.
4. **Update tracking** — mark closed; check what the next wave unlocks.
5. **Repeat** — pick the next ready task.

Not every build needs all three specialists. A backend-only feature skips `ux-designer` and `frontend-engineer`. A UI-only feature with no new APIs skips `backend-engineer`. Scale to what the issue actually requires.

### Phase 5 — Finish

Invoke `superpowers:finishing-a-development-branch` to:
- Ensure all issues are closed and PRs merged
- Clean up branches and tracking docs
- Write a final handoff or close-out note

CI auto-versions on merge to main — do not manually bump `plugin.json`.

## Cross-cutting rules

- **Principle skills auto-apply throughout**: `principles-tdd`, `principles-ddd`, `principles-pragmatic-solid`, `principles-dry-kiss` are active in every specialist agent session without explicit invocation.
- **Run `handoff` between work chunks** — before ending any session with open issues, capture state so the next session can resume instantly.
- **Prefer a fresh session per phase** — long sessions accumulate stale context. Clean phase boundaries map cleanly to session boundaries.
- **Phases are skippable** — a one-file utility skips Phases 2 and 3. A proof-of-concept skips Phase 4's UX lane entirely. Scale the process to the goal.

## Worked example — logging platform

Goal: Build an observability logging platform — ingest → queue → process → store → query → UI → alerting.

### Phase 0 output (spec)

`docs/superpowers/specs/logging-platform.md`:
- **Problem**: engineers need full-text log search, live tail, and threshold-based alerts without paying Datadog prices.
- **Outcomes**: ingest ≥ 500 k events/s; p95 query < 2 s over 30-day window; alert latency < 30 s.
- **In scope**: HTTP ingest, structured log storage, log explorer UI, alert rules.
- **Out of scope**: distributed tracing, metrics, synthetic monitoring.

### Phase 1 output (issues)

Wave 0 (parallelizable):
- `#1 systems-architect: C4 diagram + ADRs for ingest/queue/store tech selection`
- `#2 data-architect: columnar store schema + hot/warm/cold retention plan`

Wave 1 (after #1, #2):
- `#3 backend-engineer: Go+Gin ingestion service (HTTP → queue)`
- `#4 backend-engineer: log processor (queue → columnar store)`

Wave 2 (after #3, #4):
- `#5 backend-engineer: query API (full-text + time-range + label filters)`
- `#6 ux-designer: log explorer design system + tokens in Figma`

Wave 3 (after #5, #6):
- `#7 frontend-engineer: TanStack Start log explorer — live tail + nuqs URL state + tanstack-form alert rules`
- `#8 backend-engineer: alert rules engine + notification dispatch`

### Phase 2 output (architecture)

C4 container diagram: browser → TanStack Start frontend → query API → columnar store; HTTP ingestor → Kafka/NATS queue → processor → columnar store.

ADRs:
- `docs/adr/0001-columnar-store-clickhouse.md` — ClickHouse over Parquet+S3: better query latency at 30-day window, operational maturity, SQL surface.
- `docs/adr/0002-nats-jetstream-queue.md` — NATS JetStream over Kafka: lower ops overhead for target ingest rate; swap path documented if load exceeds 1 M/s.
- `docs/adr/0003-go-gin-ingestion.md` — Go+Gin for ingest: throughput requirement (500 k/s), team familiarity.

### Phase 3 output (data)

- **Hot tier**: ClickHouse on SSD, 7-day retention, all columns indexed.
- **Warm tier**: ClickHouse + S3-backed cold storage, 30-day window, compressed.
- **Cold tier**: Parquet on S3 Glacier, indefinite, query via Athena.
- Schema: `logs(ts DateTime64, service String, level Enum, message String, labels Map(String,String))` — partitioned by day, ordered by `(service, ts)`.
- Vector embeddings table for semantic search: `log_embeddings(log_id UUID, embedding Array(Float32))` — `pgvector` sidecar if semantic search is enabled.

### Phase 4 output (PRs)

- PR #3: Go+Gin ingestor — `/ingest` endpoint, NATS JetStream publish, Zod-validated payload schema, unit + integration tests.
- PR #4: Log processor — NATS consumer → ClickHouse batch insert, retry/backoff, health metrics.
- PR #5: Query API — full-text search, time-range, label filters, cursor pagination.
- PR #6: Figma design system — log explorer tokens, `LogRow`, `LiveTail`, `AlertRuleForm` components, Code Connect wired.
- PR #7: TanStack Start log explorer — live tail via SSE, nuqs for URL-driven filter state, tanstack-form for alert rule authoring.
- PR #8: Alert rules engine — rule evaluation loop, Slack/PagerDuty notification dispatch.

### Phase 5 output

All issues closed. Branches deleted. `docs/superpowers/specs/logging-platform.md` annotated with final ADR links and deferred items (distributed tracing — YAGNI for now).

## Cross-references

- `superpowers:brainstorming` — Phase 0 spec
- `project-management` — Phase 1 decomposition, issue tracking, dispatch loop
- `architecture` — Phase 2 topology, ADRs, NFRs, tech selection
- `data-modeling` — Phase 3 store selection, schema, retention tiers
- `superpowers:subagent-driven-development` — per-task implement → review cycle in Phase 4
- `superpowers:finishing-a-development-branch` — Phase 5 cleanup
- `git-workflow` — branching, commit conventions, PR sizing, release automation
- `handoff` — cross-phase session continuity
- `principles-dry-kiss` — KISS/YAGNI governs which phases to skip and how much process to apply
