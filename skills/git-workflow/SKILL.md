---
name: git-workflow
description: Team git conventions and PR process. Invoked when Claude needs to apply branching, commit, or PR rules. Triggers include "git workflow", "branch strategy", "how do we do PRs", "commit conventions", "open a PR", "merge strategy", "worktree", "conventional commits", "should this be one PR or many", "squash merge", "branch naming", "what type of commit", "release workflow".
---

# Git Workflow

Practical playbook for branching, committing, and merging on this team. Covers the decisions you hit every day — not a git tutorial.

## Branching

One branch per unit of work, cut from `main`. Always start from a fresh `main`:

```bash
git checkout main && git pull
```

**Naming**: `issue-<n>-<slug>` (preferred when an issue exists) or `<type>/<slug>`.

**Isolation**: use a git worktree so the main checkout stays clean. Defer to `superpowers:using-git-worktrees` for mechanics — do not restate them here.

### Concurrency safety (non-negotiable when more than one agent is active)

Parallel agents that share one working tree race and clobber each other, and a careless worktree teardown can wipe a sibling's uncommitted work. These rules prevent that:

- **One agent per branch/worktree per issue — ever.** Never let two agents work the same issue or the same branch concurrently. Claim the issue (e.g. read labels, then `gh issue edit <n> --add-label in-progress` if not already claimed) before starting; another agent that sees the claim stops. The label is a **best-effort advisory claim**, not an atomic lock — the real cross-run guard is "one orchestration per repo" below.
- **Each parallel agent gets its OWN worktree.** If work can't be isolated per agent, run it **serially** instead. (In the Workflow tool, dispatch mutating agents with `isolation: 'worktree'`.)
- **Commit as soon as you have a working scaffold.** Never hold a large uncommitted tree across long operations — a reset or a sibling's teardown can destroy uncommitted work permanently. Commit early, commit often; the branch is your safety net.
- **Never `--force`-remove or reset a worktree that has uncommitted or unpushed work.** Before removing a worktree, verify it's safe:
  ```bash
  git -C <worktree> status --porcelain      # must be empty (nothing uncommitted)
  git -C <worktree> log --oneline @{u}..    # must be empty (nothing unpushed)
  ```
  Only then `git worktree remove <path>`. Never `--force` past a dirty/ahead worktree to "clean up".
- **Only the creator removes its worktree**, and only after its PR is merged or its branch is pushed. The dispatcher (main session) owns worktree lifecycle; specialist agents never remove a worktree they didn't create.
- **Run one orchestration at a time.** Do not launch two `/orchestrate` (or `/deliver`) sessions against the same repo — in-memory dedup is per-run; concurrent runs double-dispatch and collide.

## PR sizing — the key rule

**One PR = one cohesive, small, revertible change.**

Default to one PR per issue. Two exceptions:

- **Group** only tightly-related trivial issues into a single PR. The PR body must reference all of them: `Closes #a`, `Closes #b`. Grouping is appropriate when issues are so small that separate PRs add more overhead than value.
- **Split** a large issue into multiple PRs when it is too big to review in one sitting. A good split point is any seam where one PR can stand alone and be reverted independently.

**Never let a branch run away.** If the diff spans unrelated concerns, or you cannot hold the whole change in your head, stop and split. Prefer small, concise chunks — this is `principles-dry-kiss` applied to version control.

## Conventional Commits

Every commit subject follows:

```
type(scope): summary
```

**Types**: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `ci`, `build`, `perf`.

These are not cosmetic. The `release.yml` CI workflow parses the squash-merge subject to pick the semver bump:

| Subject form | Bump |
|---|---|
| `feat:` or `feat(…):` | minor |
| `fix:`, `chore:`, `refactor:`, etc. | patch |
| `type!:` subject (e.g. `feat!:`), or `BREAKING` in the subject | major |

Rules:
- Imperative mood: "add X", not "adds X" or "added X".
- Subject ≤ ~72 characters.
- The release workflow parses only the **squash-merge subject line** (the PR title). To signal a major bump, put `!` after the type in the PR title (`feat!: …`) or the word `BREAKING` in the title — a `BREAKING CHANGE:` footer in the body is **not** read by the current `release.yml`.
- Every commit ends with the footer:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

## PR flow

```bash
# create
gh pr create --title "type(scope): summary" --body "$(cat <<'EOF'
## Summary
- …

Closes #<n>
EOF
)"

# review + merge (squash)
gh pr merge <branch> --squash --delete-branch

# add --admin for solo auto-merge without required checks
```

After merging: remove the worktree and pull `main` before starting the next unit of work.

## Before pushing

Run the local CI gate:

```bash
node scripts/ci/validate.mjs
```

This is the same check `validate.yml` runs on every PR. Fix failures before pushing.

## Releases are automatic

Do **not** hand-edit `plugin.json` version. On merge to `main`, `release.yml`:

1. Parses the squash-merge subject for bump type.
2. Bumps `plugin.json` via `scripts/ci/bump-version.mjs`.
3. Commits as `chore(release): vX.Y.Z [skip ci]`, tags `vX.Y.Z`, cuts a GitHub Release.

Consumers update via `/plugin marketplace update compainy` → `/plugin update compainy@compainy` → `/reload-plugins`.

## Cross-references

- `superpowers:using-git-worktrees` — worktree creation and teardown mechanics
- `handoff` — persist state between work chunks before switching branches
- `principles-dry-kiss` — small cohesive changes = KISS applied to version control
