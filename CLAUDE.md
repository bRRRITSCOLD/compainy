# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is a **Claude Code plugin** — the `ai` plugin from the `bRRRITSCOLD/ai` marketplace entry. It provides four specialist agents and a shared library of engineering-principle skills for a full-stack feature-delivery team.

### Layout

```
.claude-plugin/
  plugin.json          # plugin manifest (name, version, description)
  marketplace.json     # marketplace entry listing ai + superpowers + figma companions

agents/
  ux-designer.md       # authors design systems in Figma; extracts tokens
  frontend-engineer.md # Figma → React/Next.js component libraries + pages
  backend-engineer.md  # Go/Node/Rust services on AWS/Cloudflare/Hetzner
  staff-engineer.md    # read-only reviewer against all four principle skills

skills/
  principles-tdd/          # TDD discipline — single source of truth
  principles-ddd/          # DDD discipline — single source of truth
  principles-pragmatic-solid/  # pragmatic SOLID — single source of truth
  principles-dry-kiss/     # DRY/KISS — single source of truth
  figma-design-system/     # build/extract design systems in Figma
  figma-code-connect/      # author and publish Code Connect mappings
  design-theming/          # per-brand token overrides
  react-component-library/ # typed, accessible React components from tokens
  code-connect-impl/       # *.figma.tsx mapping files; npx figma connect publish
  pages-templates/         # Next.js layout templates and page routes
  backend-service-patterns/ # hexagonal arch, per-language patterns
  cloud-infra/             # AWS/Cloudflare/Hetzner IaC and observability
  code-review/             # structured review checklist used by staff-engineer
  handoff/                 # session handoff — write before ending a work chunk

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

## Principle skills are the single source of truth

The four principle skills (`principles-tdd`, `principles-ddd`, `principles-pragmatic-solid`, `principles-dry-kiss`) define all engineering rules for this team. When adding agents or skills:

- **Reference** principle skills by name in `## Operates by` sections.
- **Do not restate** their rules in agent or skill bodies — they own the canonical text.
- **Do not create** a second TDD, DDD, SOLID, or DRY/KISS document anywhere in the repo.

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
