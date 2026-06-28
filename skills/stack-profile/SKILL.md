---
name: stack-profile
description: Defines the optional per-project technology stack profile that overrides the implementation skills' built-in default stack. Invoked when the user says "set the stack", "init stack", "what stack", "use a different stack", "stack profile", "configure the project stack", "we use Python/Django/Vue/etc", or runs "/init-stack" — and read by the implementation skills (react-component-library, backend-service-patterns, pages-templates, cloud-infra, data-modeling) before they build, so a project on a non-default stack adapts instead of forcing the defaults.
---

# Stack Profile Skill

This plugin is **opinionated by default**: its implementation skills ship concrete, battle-tested code for a specific stack. That concreteness is the value — it's what makes the agents produce deep output fast, not generic scaffolding.

But the stack is a **default, not a cage**. A project can declare its own stack in a profile file; the implementation skills read it and adapt. Two layers, treated differently:

- **Discipline is invariant.** TDD (red/green/refactor, the unit/integration/e2e tiers, `Subject_Scenario_Expectation` naming), DDD (strategic boundaries, aggregates when earned), pragmatic SOLID (DI + interfaces, no ceremony), DRY/KISS/YAGNI, ports-and-adapters, architecture/ADR rigor — these do **not** change with the stack. The discipline skills never read the profile.
- **Stack is a parameter.** Languages, frameworks, component library, data stores, infra target, test runner — these are what the profile sets, and what the implementation skills swap.

## Where the profile lives

`.ai/stack-profile.md` at the project root. When present, it **overrides** the built-in default stack named in any implementation skill. When absent, the defaults apply unchanged — zero friction on a default-stack project.

## How implementation skills use it

Before building, an implementation skill (or the engineer agent running it) must:

1. **Read `.ai/stack-profile.md`** if it exists.
2. If it **matches** the skill's built-in default (or is absent) → use the skill's concrete examples directly.
3. If it **diverges** (names a framework/language/store the skill doesn't default to) → treat the skill's code examples as *patterns to translate*, not literal output. **Research the chosen technology's current idioms** (official docs via WebFetch, existing project code via Grep/Glob) **before writing**, then build to the same discipline. Never paste a default-stack example into a project that declared a different stack.
4. Apply the discipline regardless — the profile changes *what* you build with, never *how rigorously*.

## Built-in defaults (and what stays invariant)

So divergence is detectable, these are the skills' defaults. Rows marked **invariant** are discipline, not stack — the profile does not override them:

| Dimension | Default | Owning skill |
|---|---|---|
| Frontend framework | TanStack Start + TanStack Router | `pages-templates` |
| Component primitives | shadcn/ui pattern on Base UI (`@base-ui-components/react`) | `react-component-library` |
| Styling | Tailwind + `cva` + `cn()` | `react-component-library` |
| Forms / validation | TanStack Form + zod@^4 | `pages-templates` |
| URL/query state | nuqs | `pages-templates` |
| Backend language(s) | Go / Node / Rust | `backend-service-patterns` |
| HTTP framework | Gin (Go) / Fastify (Node) / Axum (Rust) | `backend-service-patterns` |
| Backend validation | go-playground/validator / zod / validator crate | `backend-service-patterns` |
| Service architecture | ports-and-adapters (**invariant — not overridable**) | `backend-service-patterns` |
| Data stores | chosen per workload (already profile-driven) | `data-modeling` |
| Infra target | AWS / Cloudflare / Hetzner | `cloud-infra` |
| IaC | IaC-first, provider-appropriate | `cloud-infra` |
| Test tiers | unit / integration / e2e (**invariant**); runner per language | `principles-tdd` |

## Profile format

`/init-stack` writes this; edit it by hand anytime. Keep only the lines that differ from the defaults — anything omitted, left blank, or still at its placeholder is treated as the default. Architecture (ports-and-adapters) and the test tiers are **not** fields here: they are invariant, so they appear only as reminders, never as editable values.

```markdown
# Project Stack Profile
<!-- Read by the `compainy` plugin implementation skills; overrides their defaults.
     Discipline (TDD/DDD/pragmatic-SOLID/DRY-KISS, ports-and-adapters,
     test tiers, Subject_Scenario_Expectation naming) is invariant. -->

## Languages
- e.g. TypeScript, Go

## Frontend
- Framework:           # e.g. TanStack Start | Next.js | Remix | SvelteKit | none
- Component primitives:# e.g. Base UI | Radix | Ark | native | <none>
- Styling:             # e.g. Tailwind+cva | CSS Modules | vanilla-extract
- Forms / validation:  # e.g. TanStack Form + zod | react-hook-form + zod
- URL / query state:   # e.g. nuqs | search params | none

## Backend
- Language(s):         # e.g. Go | Node | Rust | Python
- HTTP framework:      # e.g. Gin | Fastify | Axum | FastAPI | Django
- Validation:          # e.g. go-playground/validator | zod | pydantic
# Architecture is invariant: ports-and-adapters / DI (not a stack parameter)

## Data
- Primary store(s):    # e.g. Postgres, MongoDB
- Cache:               # e.g. Redis | none
- Search / vector:     # e.g. pgvector | OpenSearch | none

## Infra
- Target:              # e.g. AWS | Cloudflare | Hetzner | self-host | local-only
- IaC:                 # e.g. Terraform | Pulumi | SST | none
- Local infra:         # e.g. docker-compose (mongodb, postgres, redis, rabbitmq)

## Testing
- Runner(s):           # e.g. vitest (TS), go test (Go)
- E2E:                 # e.g. Playwright | none
# Test tiers are invariant: unit / integration / e2e (not a stack parameter)

## Notes / constraints
- # anything an agent must know: monorepo layout, banned deps, version pins, etc.
```

## Seeding the profile

- **`/init-stack`** runs an interview and writes `.ai/stack-profile.md`.
- In `feature-delivery`, the main session should seed or confirm the profile **before the build phase** so every dispatched specialist reads the same stack. A profile that matches the defaults is fine to leave implicit; write one only when the project diverges or when you want it explicit for other contributors.
