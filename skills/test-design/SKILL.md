---
name: test-design
description: Designs WHAT to test before and during TDD — derives acceptance criteria, enumerates test cases adversarially, and audits coverage gaps. Invoked when the user says "acceptance criteria", "test cases", "test plan", "what should we test", "edge cases", "test design", "coverage gaps", "what are we missing in tests", "negative tests", "boundary tests", or when seeding the failing tests for a TDD cycle. Complements principles-tdd (which owns the red/green rhythm, test tiers, and naming) — this owns case design and the gap audit.
---

# Test Design Skill

`principles-tdd` owns *how* to test — the red/green/refactor rhythm, the unit/integration/e2e tiers, build tags, and `Subject_Scenario_Expectation` naming. This skill owns *what* to test: turning a requirement into **acceptance criteria**, enumerating **test cases** that an implementer's happy-path instinct would miss, and **auditing** a finished change for coverage gaps. It feeds TDD (these cases become the failing tests written first); it does not replace it.

Defaulting to "the cases the author already had in mind" is the failure this skill prevents — the author tests what they built to work. Design the breaking cases deliberately.

## 1. Derive acceptance criteria

Before any test, state what "done and correct" means in observable terms. Pull from the issue's done-criteria (`project-management`), the brainstorming output, and the domain's ubiquitous language (`principles-ddd`).

- Each criterion is **testable and observable** — a behavior with an input and an expected, checkable outcome. "Handles errors gracefully" is not a criterion; "on a duplicate email, returns 409 and creates no user" is.
- Prefer **Given / When / Then**: given a context, when an action, then an observable result.
- Cover the **negative space**: what must *not* happen (no partial write, no leaked field, no double-charge).
- Acceptance criteria are the contract; every one must map to at least one test.

## 2. Enumerate cases adversarially

For each criterion and unit of behavior, walk **every lens** below — each is a distinct way software breaks. The lenses force breadth the author won't reach alone:

| Lens | Ask |
|---|---|
| **Happy path** | Does the intended case work, with realistic data? |
| **Boundary** | Off-by-one, empty, single, max, min, zero, just-over/under limits, empty collection, full page. |
| **Negative / invalid** | Malformed, missing, wrong-type, out-of-range input — rejected cleanly with the right error? |
| **Error / failure modes** | Dependency down, timeout, partial failure, retry, rollback — does state stay consistent? |
| **Concurrency / ordering** | Two callers at once, out-of-order events, idempotency of retries, race on shared state. |
| **State / lifecycle** | Uninitialized, already-exists, deleted, re-entrant, transitions that should be forbidden. |
| **Authz / security** | Wrong tenant/user, missing permission, injection at the trust boundary, leaked data in errors. |
| **Numeric / temporal** | Negative, overflow, rounding, timezone, DST, clock skew, expiry edges. |

Not every lens applies to every unit — but *consider* each and record why one is skipped (so "not applicable" is a decision, not an oversight). For data-heavy logic, reach for property-based / table-driven cases over enumerating examples by hand.

## 3. Map each case to a tier

Assign every case to the **lowest tier that gives real confidence** (tiers defined by `principles-tdd` — do not redefine them here):

- Pure logic, one unit, no I/O → **unit**.
- Crosses a real boundary (DB, queue, HTTP, filesystem) → **integration** (Docker-backed per `devex`/`principles-tdd`).
- A user-visible journey across the whole system → **e2e** (Playwright for UI).

Pushing logic-level cases up to e2e is the common anti-pattern — slow, flaky, and it tests the wrong layer. Test the rule where the rule lives.

## 4. Feed TDD

The designed cases are the **failing tests the implementer writes first**. Per `principles-tdd`: red (write the case, watch it fail) → green (minimum code) → refactor. Name each with `Subject_Scenario_Expectation` and a one-line intent. The implementer may discover more cases while implementing — add them; the designed set is the floor, not the ceiling.

## 5. Coverage-gap audit (done-review lens)

When a change claims "done", audit for what's missing — `staff-engineer` runs this during review; an implementer runs it on themselves before requesting review. Findings are concrete: *this criterion has no test*, *this error path is untested*, *this lens was never applied*.

Gap-audit checklist:

- [ ] Every acceptance criterion maps to at least one test.
- [ ] Each applicable lens from step 2 is represented (or its skip is justified).
- [ ] Every error/failure path has a test, not just the happy path.
- [ ] Cases sit at the right tier — logic isn't tested *only* through e2e.
- [ ] Negative space is asserted (the must-not-happens), not just positive outcomes.
- [ ] Tests assert **behavior and observable outcomes**, not implementation details (so they survive refactoring).
- [ ] No skipped/`t.Skipf`/`.skip` tests without a documented reason (integration/e2e fail loud per `principles-tdd`).
- [ ] Coverage of new branches is real, not gamed — a line executed is not a behavior asserted.

A change is not done because tests are green; it is done when the green tests cover the designed cases and the gap audit is clean.

## Boundaries

- **`principles-tdd`** owns the rhythm, tiers, build tags, and naming — reference it; this skill never restates them.
- **`project-management`** sets the issue's done criteria; this skill turns them into testable acceptance criteria and cases.
- **`staff-engineer`** + **`code-review`** apply the step-5 gap audit at review time.
