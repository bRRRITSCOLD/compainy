# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is a **Claude Code plugin** — the `ai` plugin from the `bRRRITSCOLD/ai` marketplace entry. It provides ten specialist agents and a shared library of engineering-principle skills for a full-stack feature-delivery team.

### Layout

```
.claude-plugin/
  plugin.json          # plugin manifest (name, version, description)
  marketplace.json     # marketplace entry listing ai + superpowers + figma companions

agents/
  ux-designer.md       # authors design systems in Figma; extracts tokens
  frontend-engineer.md # Figma → React + TanStack Start component libraries + pages
  backend-engineer.md  # Go/Node/Rust service & domain code, APIs, service-coupled infra
  devops-engineer.md   # platform & DevEx: IaC, CI/CD, local dev loop, containers, observability
  systems-architect.md # system topology, service boundaries, ADRs, NFRs, tech selection
  data-architect.md    # store selection, schema design, vector/RAG data modeling, aggregate-to-schema mapping
  security-architect.md # threat modeling, auth/secrets/data-protection design, supply-chain, deep security review
  lead-engineer.md     # tech lead — owns the implementation plan (architecture → sequenced PR-sized build plan); cross-cutting technical decisions
  staff-engineer.md    # read-only reviewer against all four principle skills
  project-manager.md   # transcribes the lead-engineer's plan into tracked issues/epics + owns live state (status, critical path, blockers, ledger); does not re-decide units, author the plan, or dispatch

skills/
  principles-tdd/          # TDD discipline — single source of truth
  principles-ddd/          # DDD discipline — single source of truth
  principles-pragmatic-solid/  # pragmatic SOLID — single source of truth
  principles-dry-kiss/     # DRY/KISS — single source of truth
  figma-design-system/     # build/extract design systems in Figma
  design-theming/          # per-brand token overrides
  react-component-library/ # typed, accessible React components from tokens
  code-connect-impl/       # *.figma.tsx mapping files; npx figma connect publish (owned by frontend-engineer)
  pages-templates/         # TanStack Start layout templates and page routes
  backend-service-patterns/ # hexagonal arch, per-language patterns
  cloud-infra/             # AWS/Cloudflare/Hetzner IaC and observability (backend + devops)
  devex/                   # local dev loop: docker-compose deps, task runner, seeds, pre-commit
  ci-cd/                   # CI/CD pipelines, build/test gates, release automation
  architecture/            # C4 diagrams, ADRs, NFRs, tech selection, evolutionary arch
  data-modeling/           # store selection, schema design, indexing, migrations, vector/RAG data design
  threat-modeling/         # STRIDE, trust boundaries, abuse cases, ranked security requirements
  security-review/         # deep OWASP-aligned security audit checklist (owned by security-architect)
  test-design/             # acceptance criteria + adversarial case enumeration + coverage-gap audit
  code-review/             # structured review checklist used by staff-engineer
  handoff/                 # session handoff — write before ending a work chunk
  project-management/      # orchestration playbook for the main session: transcribe the plan to issues, track, dispatch
  feature-delivery/        # end-to-end delivery phases: frame → plan → architecture → data → build → finish
  git-workflow/            # branching, Conventional Commits, PR sizing, squash-merge, release automation
  autonomous-delivery/     # self-sustaining dispatch-review-merge loop with termination + runaway guards
  stack-profile/           # optional per-project stack override (.ai/stack-profile.md) for the impl skills

commands/
  deliver.md               # /deliver <goal> — front door for feature-delivery skill
  orchestrate.md           # /orchestrate <goal or #issues> — drive issues to done via autonomous-delivery loop
  init-stack.md            # /init-stack — interview + write .ai/stack-profile.md

scripts/
  workflows/
    deliver.workflow.mjs   # Workflow-tool reference template: Scout → Build → Verify with budget guard

hooks/
  hooks.json           # SessionStart hook → session-start.sh (surfaces handoff)
  scripts/
    session-start.sh   # nudges a fresh session if a pending handoff file exists
```

## How to add an agent

Create `agents/<name>.md` with YAML frontmatter followed by a Markdown body:

```markdown
---
name: <name>           # must match the filename (without .md)
description: <when to invoke this agent — precise trigger phrases>
model: inherit
color: <blue|cyan|green|magenta|red|yellow|white>
tools: ["Read", "Write", "Edit", "Bash", "Grep", "Glob", "WebFetch"]
---

# <Title>

One-paragraph description of the agent's role and expertise.

## When to invoke

Concrete scenarios with bold trigger phrases.

## Operates by

Bullet list of skills the agent uses, one per line:
- **`<skill-name>`** — what this skill provides and when it activates.
```

The `## Operates by` section links the agent to its skills. Reference principle skills here; do not restate their rules.

Keep `model: inherit` on agents — model is chosen **per dispatch** (required, by task cognitive load), not pinned per agent. An omitted model silently inherits the session's most expensive one, so dispatches must specify it. Keep the review gate at least as strong as the implementer. The rubric lives in `project-management` → "Model selection (required at dispatch)"; `autonomous-delivery` → "Model & effort tiering" applies it to the Workflow stages.

## How to add a skill

Create `skills/<name>/SKILL.md`. The directory name and the `name:` frontmatter field must match exactly:

```markdown
---
name: <name>           # must match the directory name
description: <when Claude should invoke this skill — trigger phrases>
---

# <Skill Title>

Skill body — instructions, checklists, decision trees, examples.
```

Skills may have a `scripts/` subdirectory for shell helpers the skill invokes via `Bash`.

## How to add a command

Create `commands/<name>.md` with YAML frontmatter:

```markdown
---
description: <one-line description shown in the /help list>
argument-hint: <argument placeholder, e.g. <goal>>
---

Command body — invoke the relevant skill or agent, passing `$ARGUMENTS`.
```

The command name is the filename without `.md` (e.g. `commands/deliver.md` → `/deliver`). Keep the body short; let the skill hold the detail.

## Principle skills are the single source of truth

The four principle skills (`principles-tdd`, `principles-ddd`, `principles-pragmatic-solid`, `principles-dry-kiss`) define all engineering rules for this team. When adding agents or skills:

- **Reference** principle skills by name in `## Operates by` sections.
- **Do not restate** their rules in agent or skill bodies — they own the canonical text.
- **Do not create** a second TDD, DDD, SOLID, or DRY/KISS document anywhere in the repo.

## Stack: opinionated default, overridable

The plugin is opinionated by default — the **implementation skills** (`react-component-library`, `backend-service-patterns`, `pages-templates`, `cloud-infra`, `data-modeling`) ship concrete code for a specific stack (TanStack Start, Go/Node/Rust, AWS/CF/Hetzner, shadcn/Base UI). That concreteness is the value. A project on a different stack declares `.ai/stack-profile.md` (write it with `/init-stack`); the impl skills read it and adapt, researching the chosen tech first. The `stack-profile` skill is the single source of truth for the mechanism — reference it, don't restate it. **Discipline skills** (the four principle skills + architecture, plus the test tiers and naming conventions) are stack-invariant and never read the profile. (`data-modeling` is an implementation skill — it reads the profile for the project's declared stores — but its *modeling discipline* stays invariant.)

## Pragmatic stance

KISS and YAGNI break ties when principles seem to conflict. The goal is the simplest correct implementation that satisfies the real requirement, not the most architecturally complete one. Complexity must be earned by real invariants or real substitution needs — not anticipated.

## Session hygiene

This repo's `SessionStart` hook surfaces pending handoff files at the start of each session. To use it correctly:

- Run the `handoff` skill before finishing any significant work chunk.
- Prefer starting a fresh Claude Code session between distinct work chunks rather than continuing indefinitely in one long session. Fresh sessions have clean context; long sessions accumulate stale reasoning.
- The handoff file lives in `.superpowers/handoff/` by default; the session-start hook reads it and prompts resumption.

## Validation commands

Check that plugin manifests are valid JSON:

```bash
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/plugin.json','utf8'))" && echo ok
node -e "JSON.parse(require('fs').readFileSync('.claude-plugin/marketplace.json','utf8'))" && echo ok
```

Check that all agent files declare a `name:` in their frontmatter:

```bash
for f in agents/*.md; do grep -q '^name:' "$f" && echo "ok $f" || echo "MISSING name: $f"; done
```

Check that all skill SKILL.md files declare a `name:` in their frontmatter:

```bash
for f in skills/*/SKILL.md; do grep -q '^name:' "$f" && echo "ok $f" || echo "MISSING name: $f"; done
```

Check that all command files declare a `description:` in their frontmatter:

```bash
for f in commands/*.md; do grep -q '^description:' "$f" && echo "ok $f" || echo "MISSING description: $f"; done
```

The CI gate (`node scripts/ci/validate.mjs`) runs all of these — manifests parse, agent/skill `name:` matches path, and every command has a `description:`.

Verify agent `name:` matches filename:

```bash
for f in agents/*.md; do
  declared=$(grep '^name:' "$f" | head -1 | sed 's/name: //');
  base=$(basename "$f" .md);
  [ "$declared" = "$base" ] && echo "ok $f" || echo "MISMATCH $f: declared=$declared base=$base";
done
```

Verify skill `name:` matches directory:

```bash
for f in skills/*/SKILL.md; do
  declared=$(grep '^name:' "$f" | head -1 | sed 's/name: //');
  dir=$(basename "$(dirname "$f")");
  [ "$declared" = "$dir" ] && echo "ok $f" || echo "MISMATCH $f: declared=$declared dir=$dir";
done
```

## CI / releases

`validate.yml` runs `scripts/ci/validate.mjs` on every PR and push to `main` (skipped when the commit message contains `[skip ci]`).

Merging to `main` triggers `release.yml`, which:
- Reads the head commit subject to determine bump type: `BREAKING` or `type!:` → major; `feat` prefix → minor; everything else → patch.
- Bumps `plugin.json` version via `scripts/ci/bump-version.mjs`, validates the plugin, commits as `chore(release): vX.Y.Z [skip ci]`, pushes to main.
- Tags `vX.Y.Z` and cuts a GitHub Release with auto-generated notes.

The bot commit carries `[skip ci]` to avoid a release loop. Do **not** manually edit the version in a PR — the release workflow owns it.

For full branching, commit, and PR conventions see the `git-workflow` skill.
