---
name: code-review
description: Performs a structured, principle-grounded code review. Invoked when an engineer says "review this code", "code review", "review the diff", "staff review", "is this up to standard", "review the frontend/backend/UX work", or "check this against our principles". Produces severity-ranked findings (Critical / Important / Minor) mapped to location → problem → fix. Prefers the superpowers `requesting-code-review` flow when available.
---

# Code Review Skill

Systematic review of code produced by `frontend-engineer`, `backend-engineer`, or `ux-designer` agents. Evaluates work against the team's four engineering principle skills plus correctness, security, performance, and API clarity. Produces structured, actionable findings — not a general critique.

## When to use `superpowers:requesting-code-review`

If the `superpowers:requesting-code-review` skill is available in the current session, **invoke it first**. That skill drives the review conversation — it collects context, frames the diff, and channels feedback in a structured way. Use the checklist below as the evaluation lens within that flow.

When `superpowers:requesting-code-review` is not available, execute the checklist directly and emit findings as described.

## Checklist

Work through each dimension in order. Note every finding; rank severity at the end.

### 1. TDD coverage (`principles-tdd`) + test-design gap audit (`test-design`)

- Run the `test-design` **coverage-gap audit**: does every acceptance criterion map to a test? Is each adversarial lens (boundary / negative / error / concurrency) represented or justifiably skipped? Are error paths and negative space (the must-not-happens) asserted, not just the happy path? Do cases sit at the right tier (logic not tested *only* through e2e)? Flag happy-path-only changes.
- Does every behavior change start from a test? Look for test files alongside production changes; flag cases where production code is added with no corresponding test.
- Are tests asserting observable behavior, not internal wiring? Flag tests that reach into private state or assert implementation details (method call counts, internal variable values).
- Are external dependencies isolated via interfaces + test doubles? Flag direct calls to I/O, databases, clocks, or third-party services inside test scope.
- Are tests deterministic and fast? Flag any test that sleeps, hits the network, or has non-deterministic output.
- Is the red/green/refactor rhythm visible in the diff? If refactoring changes appear without a preceding green bar (no test change), flag as a process concern.

### 2. DDD discipline (`principles-ddd`)

- Is strategic DDD applied? Verify that bounded-context seams are respected: domain models are not shared across contexts without explicit translation.
- Is ubiquitous language used? Type names, function names, and module names should match the domain vocabulary. Flag `manager`, `handler`, `util`, or generic names where a domain concept belongs.
- Is the domain core free of infrastructure imports? Flag any domain type or function that imports I/O, frameworks, ORMs, or HTTP clients directly.
- Are tactical patterns justified? Flag Aggregates, Value Objects, or Domain Events introduced without a documented invariant or consistency need — label these as ceremony.
- Single entities doing CRUD? Flag Aggregate wrapping where a plain entity + repository suffices.

### 3. Pragmatic SOLID (`principles-pragmatic-solid`)

- Are dependencies injected behind interfaces? Flag concrete dependencies wired inside constructors or modules rather than injected at the boundary.
- Are interfaces narrow and caller-focused? Flag fat interfaces that force callers to depend on methods they do not use.
- Are there interfaces with exactly one implementation and no test double? Flag as dead weight unless a test double is planned.
- Are abstractions premature? Flag base classes, strategy patterns, or generic helpers that have one concrete user and no second implementation in scope.
- Are there passthrough layers? Flag repository → service → facade chains where intermediate layers add no logic.

### 4. DRY / KISS / YAGNI (`principles-dry-kiss`)

- Is there meaningful duplication? Flag the same rule, formula, or business fact appearing in more than two places without a shared source of truth.
- Is there incidental duplication being over-abstracted? Two code paths that look similar but represent independent concepts should stay separate; flag premature extraction.
- Was the rule of three respected? Flag abstractions extracted from fewer than three real use-cases.
- Is the implementation the simplest thing that works? Flag clever solutions where a direct approach exists.
- Is there speculative code? Flag config flags used by one path, generic helpers used once, or features not yet needed.

### 5. Correctness

- Are all edge cases handled? Flag missing null/undefined guards, empty-collection handling, and off-by-one errors.
- Are error paths tested and documented? Flag unhandled rejections, swallowed exceptions, or silent failures.
- Is concurrency handled correctly? Flag shared mutable state without synchronization, race conditions in async flows, and missing cancellation propagation.
- Are type contracts honored? Flag implicit `any`, unsafe casts, or type assertions without guards.

### 6. Security

> This is the **general** security pass. For changes touching auth, cryptography, untrusted-input parsing, data exposure, infra permissions, or new dependencies, defer the deep adversarial audit to the `security-review` skill (owned by `security-architect`) rather than going shallow here.

- Is user input validated and sanitized before use? Flag direct interpolation of external data into queries, commands, or templates (SQL injection, XSS, command injection).
- Are secrets and credentials managed correctly? Flag hardcoded tokens, keys, or passwords; flag secrets logged or returned in responses.
- Are authentication and authorization checks present at every entry point? Flag endpoints or functions that assume authorization has already been handled upstream.
- Is sensitive data scoped correctly? Flag PII or credentials that leak into logs, error messages, or client responses.

### 7. Performance

- Are there N+1 query or fetch patterns? Flag loops that issue one query per iteration where a batch or join would serve.
- Is caching used where appropriate — and not where inappropriate? Flag expensive recomputation on every call; also flag stale cache reads on write-critical paths.
- Are large payloads streamed or paginated? Flag endpoints that load unbounded result sets into memory.
- Are expensive operations measured before being optimized? Flag speculative optimizations without profiling evidence.

### 8. API clarity

- Is the public API minimal? Flag methods, exports, or endpoints that expose implementation details or are not yet needed by callers.
- Are parameter lists readable? Flag functions with more than three positional parameters where an options object or named parameters would clarify intent.
- Are error responses structured and consistent? Flag ad-hoc error shapes that differ from the rest of the API surface.
- Is the API documented where non-obvious? Flag public functions or endpoints lacking concise docstrings or OpenAPI/type annotations when the signature alone is ambiguous.

## Findings format

Emit findings grouped by severity. Within each group, order by file path then line number.

```
## Critical

[file path, line range] — [problem statement] — [concrete fix]

## Important

[file path, line range] — [problem statement] — [concrete fix]

## Minor

[file path, line range] — [problem statement] — [concrete fix]
```

**Critical** — correctness bugs, security vulnerabilities, or violations that would cause production failures or data loss. Block merge.

**Important** — principle violations that will cause maintenance pain, missing test coverage for key behaviors, or performance issues under realistic load. Should fix before merge.

**Minor** — style, YAGNI, naming, or documentation gaps that do not block correctness but degrade clarity over time. Fix in a follow-up or during the same PR if trivial.

If a dimension has no findings, omit it from the output — do not emit "No issues found" placeholders.
