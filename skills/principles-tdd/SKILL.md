---
name: principles-tdd
description: Applies test-driven development discipline and defines the unit/integration/e2e test tier conventions. Invoked when an engineer is writing tests, practicing TDD, working test-first, implementing any behavior before or alongside writing tests, choosing between unit vs integration vs e2e tests, writing integration tests with Docker or LocalStack, setting up Playwright e2e tests, or naming test files. Governs red/green/refactor rhythm, test scope, test tiers, and when to commit. Cross-references superpowers test-driven-development for deeper guidance.
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

## Test tiers

**File naming is the tier contract.** Every test file lives next to the code it covers and its suffix signals scope and cost.

| Tier | TypeScript | Go | Scope |
|---|---|---|---|
| unit | `*.unit.test.ts` / `*.unit.test.tsx` | `*_unit_test.go` | Single unit; no I/O; runs in milliseconds. |
| integration | `*.integration.test.ts` / `*.integration.test.tsx` | `*_integration_test.go` | Multiple pieces together with real adapters or controlled substitutes. |
| e2e | `*.e2e.test.ts` / `*.e2e.test.tsx` | `*_e2e_test.go` | Full app or SDK exercised through its public surface. |

**Go**: `go test` only discovers files ending in `_test.go`; the tier name is an infix (`*_unit_test.go`), not a separate extension like `.test.go`.
**Playwright**: TypeScript-only. The Go e2e tier covers HTTP-SDK/API tests, not UI automation.

**unit** — isolated. No database, no network, no filesystem. External dependencies are test doubles injected via interfaces (see `principles-pragmatic-solid`). The full unit suite runs in seconds.

**integration** — real adapters, controlled infrastructure. Wire multiple pieces together:
- Databases: spin up a real instance with Docker (e.g., `testcontainers`); seed data before each test.
- AWS services: LocalStack.
- Third-party HTTP APIs without Docker: HTTP interceptors (`nock` / `msw` in Node; `httpmock` in Go).
- Server-side (Node): use `supertest` to call your server over HTTP; seed local DBs/services; tear down after.

**e2e** — full app or SDK exercised end-to-end:
- HTTP SDK tests call the real API within its own codebase — no mocks.
- UI: **Playwright** against `localhost` (TypeScript-only). Start the dev/test server before the suite; shut it down after. Go e2e tests cover HTTP-SDK/API tests, not UI automation.

**Setup/teardown at every level.**
Every test file — regardless of tier — must include `beforeAll` / `beforeEach` / `afterEach` / `afterAll` blocks, even if empty. Establish the scaffold upfront so setup and teardown are never retrofitted later:

```ts
// TypeScript (Jest / Vitest)
beforeAll(async () => { /* start server, seed db, launch browser */ });
beforeEach(async () => { /* reset state */ });
afterEach(async () => { /* assert no leaked state */ });
afterAll(async () => { /* stop server, close browser, drop test db */ });
```

```go
// Go
func TestMain(m *testing.M) {
    // beforeAll: start shared resources (DB, server, etc.)
    code := m.Run()
    // afterAll: stop shared resources
    os.Exit(code)
}

// setup resets per-test state (beforeEach equivalent) and registers cleanup
// (afterEach equivalent) via t.Cleanup so it runs automatically after each test.
func setup(t *testing.T) {
    t.Helper()
    // beforeEach: reset state, seed fixtures, etc.
    t.Cleanup(func() {
        // afterEach: assert no leaked state, undo per-test changes
    })
}

// Call setup(t) at the top of every test function:
// func TestFoo(t *testing.T) {
//     setup(t)
//     ...
// }
```

## Cross-references

- `superpowers:test-driven-development` — deep-dive skill for complex TDD scenarios, cycle examples, and anti-patterns.
- `principles-pragmatic-solid` — interface/dependency-inversion rules that keep test doubles effortless.
- `principles-dry-kiss` — refactor phase guidance (don't over-abstract the resulting code).
