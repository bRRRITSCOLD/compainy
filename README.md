# ai

Personal AI dev-team plugin for Claude Code. Ten specialist agents — UX designer, frontend engineer, backend engineer, devops engineer, systems architect, data architect, security architect, lead engineer, staff engineer, and project manager — plus a shared library of engineering-principle skills they all operate by.

## What it is

A Claude Code plugin that gives you a complete feature-delivery team:

- **ux-designer** — authors design systems and UX work directly in Figma using the official Figma MCP write tools; extracts tokens for code consumers; hands the frontend a component inventory (names + node IDs). Code Connect mapping is React code — that's the frontend-engineer's job.
- **frontend-engineer** — takes Figma designs all the way to production-ready React + TanStack Start code; builds typed, accessible component libraries from `tokens.json`; wires Figma Code Connect (`*.figma.tsx` + publish) for its built components; composes pages and templates.
- **backend-engineer** — designs and implements high-performance services in Go, Node/TypeScript, and Rust; applies hexagonal/ports-and-adapters architecture; authors the infra coupled to its own service.
- **devops-engineer** — owns the platform and developer experience: IaC provisioning (AWS, Cloudflare, Hetzner), CI/CD pipelines and release automation, the local dev loop (docker-compose, task runner, seeds), containers, and observability.
- **systems-architect** — designs system topology, defines service and bounded-context boundaries, authors ADRs, evaluates non-functional requirements, and selects technology with explicit tradeoffs.
- **data-architect** — chooses stores per workload with explicit tradeoffs, designs schemas and indexes, models data for vector/semantic search and RAG pipelines, and aligns persistence schemas with DDD aggregate boundaries.
- **security-architect** — owns the security posture: threat models (STRIDE, trust boundaries), authentication/authorization design, secrets and key management, data protection, and supply-chain controls; runs the deep adversarial security audit on sensitive changes.
- **lead-engineer** — the tech lead: turns the decided architecture into one coherent, sequenced, PR-sized implementation plan (build order, integration seams, test hooks), and makes cross-cutting technical decisions during the build. Bridges architecture and execution; the technical authority implementers escalate to.
- **staff-engineer** — reviews work from the eight build agents (`lead-engineer`, `ux-designer`, `frontend-engineer`, `backend-engineer`, `devops-engineer`, `systems-architect`, `data-architect`, `security-architect`) against the team's principle skills plus correctness, security, and performance; does not write code.
- **project-manager** — transcribes the lead-engineer's implementation plan into tracked GitHub issues and epics (task → issue, section → epic, mirroring the plan's dependencies and owners), then owns the live delivery state: status, critical path, blockers, and the durable ledger. It does not re-decide the task granularity (that's the lead-engineer's) or dispatch agents (the main session does that).

Shared principle skills — TDD, DDD, pragmatic SOLID, DRY/KISS — are the single source of truth for how every agent reasons and works.

## Requirements

**The `superpowers` and `figma` companion plugins are required.** They are installed alongside `ai` from the same marketplace entry; see Install below.

- **superpowers** — core skills library (`brainstorming`, `writing-plans`, TDD, code-review) that the ai agents build on.
- **figma** — official Figma MCP remote server. Provides write-to-canvas tools (`use_figma`, `create_new_file`, `generate_figma_design`, `upload_assets`) for the ux-designer and read tools (`get_design_context`, `get_variable_defs`, `get_code_connect_map`) for the frontend-engineer.

## Install

```
/plugin marketplace add bRRRITSCOLD/ai
```

This opens the marketplace entry. Install all three plugins from the same menu:

1. **ai** — the dev-team agents and principle skills.
2. **superpowers** — required companion (from `obra/superpowers`).
3. **figma** — required companion (official Figma MCP remote server).

## Figma setup

The `figma` companion installs the official Figma MCP **remote** server. Authentication is via OAuth — you will be prompted to authorize on first use.

**Write-to-canvas requires a Figma Full seat on a paid plan.** A Dev seat cannot write to the canvas outside of drafts, so the ux-designer's authoring tools — creating frames, components, and variables — will not work without a Full seat.

Install Figma's `figma-use` skill so the agent drives the write tools reliably — follow Figma's MCP setup docs (https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server).

Read tools used by the frontend-engineer work at any seat level.

## The agents

| Agent | Role | Key skills |
|---|---|---|
| `ux-designer` | Authors design systems, components, frames, and variables directly in Figma; extracts `tokens.json`; hands off a component inventory (Code Connect mapping belongs to frontend) | `figma-design-system`, `design-theming` |
| `frontend-engineer` | Reads Figma outputs and implements React + TanStack Start component libraries, pages, and templates; wires + publishes Figma Code Connect for its built components | `react-component-library`, `code-connect-impl`, `pages-templates` |
| `backend-engineer` | Builds Go / Node / Rust service & domain code, APIs, service-coupled infra; hexagonal architecture | `backend-service-patterns`, `cloud-infra` |
| `devops-engineer` | Owns platform & DevEx: IaC provisioning, CI/CD & release automation, local dev loop, containers, observability | `cloud-infra` (shared), `devex`, `ci-cd` |
| `systems-architect` | Designs system topology, defines service/bounded-context boundaries, writes ADRs, evaluates NFRs, selects technology with tradeoffs | `architecture` |
| `data-architect` | Chooses stores per workload, models schemas, designs for vector/semantic search and RAG, aligns persistence with DDD aggregate boundaries | `data-modeling` |
| `security-architect` | Threat models, designs auth/secrets/data-protection + supply-chain controls, runs the deep security audit on sensitive changes | `threat-modeling`, `security-review` |
| `lead-engineer` | Tech lead — turns the architecture into a sequenced, PR-sized implementation plan; makes cross-cutting technical decisions during the build | `superpowers:writing-plans`, `test-design`, `git-workflow` |
| `staff-engineer` | Reviews all build output (incl. the implementation plan) for principle compliance, correctness, security, and performance | `code-review` (read-only toolset) |
| `project-manager` | Transcribes the lead-engineer's plan into tracked issues/epics; owns live status, critical path, blockers, and the ledger; does not re-decide task units or dispatch agents | `project-management` |

The six engineering and architecture agents — `lead-engineer`, `frontend-engineer`, `backend-engineer`, `staff-engineer`, `systems-architect`, and `data-architect` — carry all four shared principle skills: `principles-tdd`, `principles-ddd`, `principles-pragmatic-solid`, `principles-dry-kiss`. The `devops-engineer` carries three of the four — `principles-tdd`, `principles-pragmatic-solid`, `principles-dry-kiss` — but not `principles-ddd` (it does no domain modeling). The `ux-designer`, `project-manager`, and `security-architect` carry only `principles-dry-kiss`: `ux-designer` for design-token discipline, `project-manager` to keep the delivery process lean, and `security-architect` to keep controls proportionate to the ranked threat (KISS/YAGNI) — it also draws on `test-design` for abuse-case tests.

## Principles

The four principle skills define a pragmatic engineering stance shared across every agent:

- **TDD** — every behavior starts with a failing test; red/green/refactor; tests assert behavior, not implementation.
- **DDD** — strategic bounded contexts always; tactical patterns (aggregates, value objects, repositories) only when the complexity justifies them; ubiquitous language throughout.
- **Pragmatic SOLID** — inject behind interfaces and keep Liskov substitution; cut ceremony (no interface-per-class without a real substitution need, no passthrough layers).
- **DRY/KISS** — single source of truth for domain rules; rule of three before abstracting; KISS and YAGNI break ties when principles conflict.

## Tech stack — opinionated, overridable

The implementation skills default to a specific stack (TanStack Start, Go/Node/Rust, AWS/Cloudflare/Hetzner, shadcn/ui on Base UI) — the concrete examples are what make the output deep. For a project on a different stack, run `/init-stack` to interview and write `.ai/stack-profile.md`; the implementation skills read it and adapt, researching the chosen technology's idioms before building. The engineering discipline (TDD, DDD, pragmatic SOLID, DRY/KISS, ports-and-adapters, test tiers, naming) stays the same regardless of stack.

## End-to-end workflow

Frame → Architecture → Data → Plan the build → Track & coordinate → Build loop → Finish. Run `/deliver <goal>` to start — it invokes the `feature-delivery` skill, which sequences the specialist agents across all phases and scales the process to the size of the goal. Note the order: the design is decided first, the `lead-engineer` turns it into the implementation plan, and the `project-manager` transcribes that plan into tracked issues — tracking follows the technical plan, never precedes it.

**New here? Read [docs/getting-started.md](docs/getting-started.md)** — the full `/init-stack → /deliver → /orchestrate` flow, the one-epic-per-session rhythm that keeps context clean and cost bounded, the autonomous-loop guards, and paste-ready kickoff + per-epic prompts.

## Autonomous orchestration

Once a goal is decomposed into GitHub issues, run `/orchestrate <goal or #issues>` to drive them to done automatically. The `autonomous-delivery` skill runs a dispatch → staff-review gate → squash-merge loop until all open issues are closed and CI is green, or until a guard trips (max iterations, K consecutive empty rounds, or token budget exhausted). A Workflow-tool reference script lives at `scripts/workflows/deliver.workflow.mjs` for deterministic fan-out with a built-in budget guard; review it before first use.

## Session hygiene

Long sessions accumulate stale context. Use the `handoff` skill before ending a work chunk to write a structured summary the next session can resume from instantly. The `SessionStart` hook surfaces any pending handoff at the start of each new session.

Prefer fresh sessions between distinct work chunks rather than extending a single session indefinitely.

## License

MIT
