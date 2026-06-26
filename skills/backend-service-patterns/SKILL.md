---
name: backend-service-patterns
description: Applies hexagonal/ports-and-adapters architecture for backend services. Invoked when building a backend service, designing a Go/Node/Rust API, implementing a high-performance service, structuring a domain with ports and adapters, wiring dependency injection in a service, designing transport or persistence adapters, or applying DDD in a backend context. Ties to principles-tdd, principles-ddd, principles-pragmatic-solid, and principles-dry-kiss.
---

# Backend Service Patterns

Hexagonal architecture (ports and adapters): domain core behind interfaces, adapters for transport and persistence. Inject dependencies at the boundary. Measure before optimizing.

## Process

**Domain core behind interfaces (ports).**
Define the domain as pure business logic with no I/O. Express every external dependency — database, HTTP client, queue, clock — as a narrow interface (port). The domain never imports transport or infrastructure packages. This enforces the boundary that `principles-ddd` requires and makes every port trivially mockable per `principles-pragmatic-solid`.

**Adapters implement ports.**
Write one adapter per external system: HTTP handler, database repository, message-queue publisher, etc. Adapters translate between the domain's types and the external system's wire format. Swapping an adapter (e.g., Postgres → SQLite in tests) costs a single constructor argument. Never let adapter concerns bleed into the domain.

**Inject at the boundary.**
Wire dependencies in `main` (or equivalent entry point), not inside domain logic. Pass interfaces, not concretions. A service constructor that accepts an interface for its repository and its event publisher can be tested without any I/O. See `principles-pragmatic-solid` — inject behind interfaces, no interface-per-class without a second implementation.

**TDD throughout.**
Every domain behavior starts with a failing test. Use test doubles (stubs/fakes) for all ports so tests run in milliseconds with no external services. Commit at green; refactor under green. See `principles-tdd`.

---

### Go

**Interfaces + table-driven tests.**
Define small, behavior-focused interfaces (`Repository`, `Publisher`, `Cache`). Implement with concrete structs. Write table-driven tests for all domain logic — a `[]struct{ name, input, want }` slice makes coverage cheap and exhaustive.

**Goroutine and context discipline.**
Pass `context.Context` as the first argument to every function that does I/O. Propagate cancellation — never launch goroutines that outlive the request without a clear ownership mechanism (done channel, `errgroup`, or `sync.WaitGroup`). Goroutine leaks are subtle performance bugs; context propagation prevents them.

**Error handling.**
Wrap errors with `fmt.Errorf("...: %w", err)` at every layer boundary so callers can `errors.Is`/`errors.As` without losing stack context. Domain errors should be typed values, not strings — callers pattern-match on error type, not message content.

---

### Node / TypeScript

**DI containers or manual injection.**
Prefer explicit constructor injection (manual DI) for services with few dependencies — it is transparent and easy to test. Use a DI container (e.g., `tsyringe`, `inversify`) only when the dependency graph is large enough that manual wiring becomes the bottleneck.

**Strict types throughout.**
Enable `strict: true` in `tsconfig.json`. Model domain types as branded primitives or discriminated unions so invalid states are unrepresentable at compile time. Avoid `any`; use `unknown` and narrow. Keep adapter types (DB row shapes, HTTP request bodies) separate from domain types — map at the adapter boundary.

**Async discipline.**
All I/O is `async/await`. Never mix raw Promises and async/await in the same call chain. Use `AbortSignal` / request-scoped cancellation for long-running operations. Handle errors at a single boundary (global middleware or a top-level `try/catch`) rather than swallowing them inside adapters.

---

### Rust

**Traits as interfaces.**
Define a trait per port (`Repository`, `EventBus`, `Clock`). Implement for concrete types (`PgRepository`, `KafkaEventBus`). For tests, implement the trait on a simple in-memory struct. Use `async_trait` (or manual `Pin<Box<dyn Future>>`) for async methods on `dyn`-dispatched traits, since `async fn` in traits is not yet object-safe for dynamic dispatch.

**Ownership-aware design.**
Prefer `Arc<dyn Trait>` for shared service handles injected across async tasks. Avoid `Rc` in multi-threaded code. Use `tokio::sync::Mutex` sparingly — structure data access to minimize lock scope. Design the domain so owned types flow naturally; reach for shared references only at the boundary.

**Error handling.**
Define a domain `Error` enum (or use `thiserror`) and `Result<T, Error>` at every domain function. Adapters convert external errors (`sqlx::Error`, `reqwest::Error`) into domain error variants at the adapter boundary — domain code never leaks infrastructure error types.

---

### Performance practices

**Measure first.**
Profile before optimizing. Guessing at bottlenecks wastes time and produces unmaintainable code. Add structured metrics/tracing (Prometheus, OTEL) from day one so you know where time is spent. See `principles-dry-kiss` — the simplest correct implementation wins until measurements say otherwise.

**Optimize at the boundary, not the core.**
Connection pooling, batching, caching, and serialization choices belong in adapters. Domain logic stays simple. A cache adapter wrapping a repository is a clean swap; cache logic scattered through domain functions is a maintenance hazard.

**Avoid speculative performance work.**
N+1 queries, missing indexes, and blocking I/O on a hot path are worth fixing immediately when measured. Micro-optimizations to hot loops, SIMD, or memory layout are worth investigating only after profiling shows them to be the bottleneck. See `principles-pragmatic-solid` — no premature abstraction; the same discipline applies to performance.

## Cross-references

- `principles-tdd` — TDD rhythm, test doubles for ports, commit-at-green discipline.
- `principles-ddd` — domain core isolation, bounded contexts, ubiquitous language.
- `principles-pragmatic-solid` — interface/DI discipline, interface segregation at ports, no interface-per-class without substitution need.
- `principles-dry-kiss` — measure before optimizing; no speculative abstractions; simplest correct implementation wins.
