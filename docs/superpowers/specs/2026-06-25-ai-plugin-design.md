# Design Spec — `ai` plugin (centralized AI dev team)

**Date:** 2026-06-25
**Owner:** bRRRITSCOLD (Blaine Richardson)
**Repo:** github.com/bRRRITSCOLD/ai (public)
**Status:** Approved design — ready for implementation plan

## 1. Purpose

A personal, centralized Claude Code **plugin** that ships a coordinated dev team —
UX designer, frontend engineer, backend engineer, staff engineer — plus the shared
engineering skills they operate by. Installable via `/plugin`. Distributed through the
repo's own marketplace, which also exposes `superpowers@claude-plugins-official` as a
required companion.

Success = `claude plugin marketplace add bRRRITSCOLD/ai` then installing `ai` gives a
working agent team and skill library, with `superpowers` offered alongside.

## 2. Constraints & decisions (locked)

- **Contents:** skills + slash-invocable agents + subagents + hooks/settings (full set).
- **Dependency on superpowers:** Claude Code plugin format has **no native `dependencies`
  field**. Handle via (a) repo `marketplace.json` listing both `ai` and `superpowers`
  (git source), and (b) README requirement note. No `/setup` shell-install command
  (brittle).
- **Figma access:** official **Figma Dev Mode MCP** (local, `http://127.0.0.1:3845`).
  Read + Code Connect oriented; native authoring of full design systems *inside* Figma
  is out of scope for the official MCP. Agents extract/codify, not auto-draw.
- **Build depth:** full set authored in v1 (all 4 agents + all skills + wiring).
  Implementation parallelized via `subagent-driven-development`.
- **Visibility:** public GitHub repo.
- **Tooling:** `gh` creates the repo (authed as bRRRITSCOLD, ssh), git links + pushes.

## 3. Architecture

Single plugin at repo root. The root `.claude-plugin/plugin.json` is the manifest;
`.claude-plugin/marketplace.json` aggregates `ai` (`source: "./"`) + `superpowers`
(git source). Agents declare which skills they operate by; skills are reusable and
referenced by name across agents (DRY). Figma MCP is declared in the plugin manifest.
Session hooks inject working-hygiene guidance and surface handoff files.

## 4. Repo layout

```
ai/
├── .claude-plugin/
│   ├── plugin.json          # manifest + mcpServers (Figma Dev Mode)
│   └── marketplace.json     # lists ai (./) + superpowers (git)
├── agents/
│   ├── ux-designer.md
│   ├── frontend-engineer.md
│   ├── backend-engineer.md
│   └── staff-engineer.md
├── skills/
│   ├── principles-tdd/SKILL.md
│   ├── principles-ddd/SKILL.md
│   ├── principles-pragmatic-solid/SKILL.md
│   ├── principles-dry-kiss/SKILL.md
│   ├── figma-design-system/SKILL.md
│   ├── figma-code-connect/SKILL.md
│   ├── design-theming/SKILL.md
│   ├── react-component-library/SKILL.md
│   ├── code-connect-impl/SKILL.md
│   ├── pages-templates/SKILL.md
│   ├── backend-service-patterns/SKILL.md
│   ├── cloud-infra/SKILL.md
│   ├── code-review/SKILL.md
│   └── handoff/SKILL.md
├── hooks/
│   ├── hooks.json           # SessionStart
│   └── scripts/session-start.sh
├── CLAUDE.md
├── README.md
└── LICENSE
```

## 5. Agents

Each agent `.md`: frontmatter (`name`, `description`, `tools`, optional `model`), body
covering role, when to invoke, the skills it operates by, and a hard instruction to
follow the referenced principle skills.

- **ux-designer** — Figma MCP (read selections / variables / code) + skills
  `figma-design-system`, `figma-code-connect`, `design-theming`, `principles-dry-kiss`.
  Scope is honest about the official Dev Mode MCP boundary: **read + Code Connect**.
  Output = design-system-as-code (tokens, specs) + Code Connect mappings + theming/branding
  variants, not auto-drawn Figma frames.
- **frontend-engineer** — `react-component-library`, `code-connect-impl`, `pages-templates`
  + all 4 principle skills. Consumes UX tokens → reusable React/Next.js component library,
  wires Figma Code Connect, builds pages/templates.
- **backend-engineer** — `backend-service-patterns` (Go/Node/Rust, ports-&-adapters aligned
  with DDD + DI), `cloud-infra` (AWS/Cloudflare/Hetzner tradeoffs + IaC) + all 4 principles.
- **staff-engineer** — `code-review` + all 4 principles. Reviews the three engineers' diffs
  against the principles plus correctness/security/perf. May lean on superpowers
  `requesting-code-review`.

## 6. Shared principle skills

Standalone, referenced by all engineer agents (UX pulls the `dry-kiss` subset). DRY:
edit once, every agent inherits.

- **principles-tdd** — red/green/refactor, test-first, test behavior not implementation,
  fast deterministic tests, test doubles via interfaces.
- **principles-ddd** — pragmatic. *Strategic DDD always:* ubiquitous language, bounded
  contexts as module boundaries, pure domain separated from infra (pairs with DI).
  *Tactical patterns are tools, used only when complexity earns them:* Value Objects when
  an invariant/validation/equality matters (`Money`, `Email`) — not wrap-every-primitive;
  Aggregates/roots/transactional boundaries only in genuine multi-entity consistency
  domains (CRUD → entity + repo); domain events only to decouple reactions. Guardrail:
  *"Strategic DDD always. Tactical patterns earn their place — reach for them when
  invariants/consistency/complexity demand, never as ritual. KISS/YAGNI break ties."*
- **principles-pragmatic-solid** — keep DI + interface-segregation + Liskov-substitution
  (mock/swap). Guardrails: no interface-per-class, no premature abstraction, S/O only when
  churn justifies it, KISS/YAGNI break ties.
- **principles-dry-kiss** — single source of truth, rule-of-three before abstracting, YAGNI,
  simplest thing that works.

## 7. Handoff + session hygiene

- **handoff skill** — writes `${TMPDIR:-/tmp}/claude-handoffs/<cwd-slug>/<ISO>.md` capturing:
  goal, what's done, in-progress, next steps, key files, decisions made, open questions.
  Prints the path and suggests starting a fresh session.
- **hooks/scripts/session-start.sh** (SessionStart hook) — injects the nudge:
  "between work chunks → run /handoff and start a fresh session; small context = sharp
  Claude 💚", and scans the handoff dir for a recent file matching the current cwd slug,
  surfacing "found handoff from <time> — read it?".

## 8. Dependency / distribution

- `marketplace.json`:
  `plugins: [ { name: "ai", source: "./" }, { name: "superpowers", source: { source: "git", url: "https://github.com/obra/superpowers" } } ]`
  (exact source schema confirmed against installed marketplace examples during impl).
- README: states superpowers is required; documents install flow.
- Agents may invoke superpowers skills (brainstorming, TDD, requesting-code-review) — a
  documented soft dependency.

## 9. gh / git

`gh repo create bRRRITSCOLD/ai --public` → `git init` → ssh remote → initial commit → push.

## 10. Testing (lightweight)

- All JSON manifests parse.
- Every `SKILL.md` and agent `.md` has valid frontmatter (name + description present).
- `claude plugin validate` if available.
- Temp-dir `marketplace add` smoke test resolves both plugins.

## 11. Out of scope (YAGNI)

- Auto-drawing/writing design systems inside Figma (official MCP can't).
- `/setup` auto-installer for superpowers.
- Non-DI parts of SOLID applied dogmatically; tactical-DDD-by-default.
- Per-agent duplicated principle text (shared skills instead).
```
