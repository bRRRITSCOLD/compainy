---
name: principles-tdd
description: Applies test-driven development discipline. Invoked when an engineer is writing tests, practicing TDD, working test-first, or implementing any behavior before or alongside writing tests. Governs red/green/refactor rhythm, test scope, and when to commit. Cross-references superpowers test-driven-development for deeper guidance.
---

# TDD Principle

Write tests first. Every behavior change starts with a failing test.

## Process

**Red — write a failing test.**
Name the behavior you intend to add. Run the test suite and confirm it fails for the right reason (missing behavior, not a compile error or wrong assertion).

**Green — implement the minimum to pass.**
Write only enough production code to make the test pass. Resist the urge to generalize.

**Refactor — clean under green.**
Improve structure and remove duplication while the suite stays green. No new behavior during refactor.

**Behavior, not implementation.**
Tests assert observable outputs and side-effects, not internal wiring. Coupling tests to implementation details makes refactors painful and destroys the feedback loop.

**Fast and deterministic.**
Tests must pass or fail in milliseconds and return the same result on every run. Flaky or slow tests erode trust and get skipped.

**Isolate external dependencies via interfaces.**
Use ports/adapters (interfaces + test doubles) to keep tests free of I/O, clocks, randomness, and third-party services. See `principles-pragmatic-solid` for the interface discipline that makes this cheap.

**Commit at green.**
Each green bar is a known-good checkpoint. Commit before refactoring so you can roll back cheaply if the refactor breaks things.

## Cross-references

- `superpowers:test-driven-development` — deep-dive skill for complex TDD scenarios, cycle examples, and anti-patterns.
- `principles-pragmatic-solid` — interface/dependency-inversion rules that keep test doubles effortless.
- `principles-dry-kiss` — refactor phase guidance (don't over-abstract the resulting code).
