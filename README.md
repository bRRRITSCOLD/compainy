# ai

Personal AI dev-team plugin for Claude Code. Four specialist agents — UX designer, frontend engineer, backend engineer, and staff engineer — plus a shared library of engineering-principle skills they all operate by.

## What it is

A Claude Code plugin that gives you a complete feature-delivery team:

- **ux-designer** — authors design systems and UX work directly in Figma using the official Figma MCP write tools; extracts tokens for code consumers; wires Code Connect so Dev Mode shows real component examples.
- **frontend-engineer** — takes Figma designs all the way to production-ready React/Next.js code; builds typed, accessible component libraries from `tokens.json`; composes pages and templates.
- **backend-engineer** — designs and implements high-performance services in Go, Node/TypeScript, and Rust; deploys on AWS, Cloudflare, and Hetzner; applies hexagonal/ports-and-adapters architecture throughout.
- **staff-engineer** — reviews code from all three engineer agents against the team's principle skills plus correctness, security, and performance; does not write code.

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

Install the `figma-use` skill to unlock write workflows for the ux-designer:

```
/skill install figma-use
```

Read tools used by the frontend-engineer work at any seat level.

## The agents

| Agent | Role | Key skills |
|---|---|---|
| `ux-designer` | Authors design systems, components, frames, and variables directly in Figma; extracts `tokens.json`; wires Code Connect | `figma-design-system`, `figma-code-connect`, `design-theming` |
| `frontend-engineer` | Reads Figma outputs and implements React/Next.js component libraries, pages, and templates | `react-component-library`, `code-connect-impl`, `pages-templates` |
| `backend-engineer` | Builds Go / Node / Rust services deployed on AWS, Cloudflare, or Hetzner; hexagonal architecture, IaC-first | `backend-service-patterns`, `cloud-infra` |
| `staff-engineer` | Reviews all engineer output for principle compliance, correctness, security, and performance | `code-review` (read-only toolset) |

All four agents also carry the shared principle skills: `principles-tdd`, `principles-ddd`, `principles-pragmatic-solid`, `principles-dry-kiss`.

## Principles

The four principle skills define a pragmatic engineering stance shared across every agent:

- **TDD** — every behavior starts with a failing test; red/green/refactor; tests assert behavior, not implementation.
- **DDD** — strategic bounded contexts always; tactical patterns (aggregates, value objects, repositories) only when the complexity justifies them; ubiquitous language throughout.
- **Pragmatic SOLID** — inject behind interfaces and keep Liskov substitution; cut ceremony (no interface-per-class without a real substitution need, no passthrough layers).
- **DRY/KISS** — single source of truth for domain rules; rule of three before abstracting; KISS and YAGNI break ties when principles conflict.

## Session hygiene

Long sessions accumulate stale context. Use the `handoff` skill before ending a work chunk to write a structured summary the next session can resume from instantly. The `SessionStart` hook surfaces any pending handoff at the start of each new session.

Prefer fresh sessions between distinct work chunks rather than extending a single session indefinitely.

## License

MIT
