---
name: architecture
description: Applies software and systems architecture discipline. Invoked when an engineer or architect is designing a new system, defining service or bounded-context boundaries, choosing a technology stack, producing a C4 diagram, writing an Architecture Decision Record (ADR), evaluating non-functional requirements (scalability, availability, latency, cost, security), or reviewing an architecture before implementation begins. Also triggered by "system design", "architecture review", "ADR", "C4 model", "service boundaries", "tech selection", "non-functional requirements", or "evolutionary architecture".
---

# Architecture Skill

Staff/principal-level architecture practice: define clear boundaries, communicate with C4, capture decisions as ADRs, let non-functional requirements drive design, select technology with explicit tradeoffs, and keep the architecture evolutionary. Pragmatic over ivory-tower — complexity must be earned.

## Process

### 1. Define service and bounded-context boundaries

Identify the bounded contexts before drawing any deployment boundary. A bounded context is a seam where a domain model has consistent meaning; a service boundary should follow that seam, not cut across it. Apply `principles-ddd` strategic patterns: ubiquitous language per context, explicit translation at the boundary, no shared models across contexts.

Ask before splitting: does this boundary reflect a genuine difference in rate of change, team ownership, scalability need, or domain model? If not, a single service or module is simpler. Monolith-first is a valid starting point; extract services when there is measured pressure to do so.

### 2. Communicate architecture with C4

Use the four C4 levels, descending to the detail required for the audience:

- **Context** — the system and the external actors/systems it interacts with. One diagram; start here for every new design.
- **Container** — the deployable units (services, databases, queues, frontends) and the protocols between them. Primary design artifact for service topology decisions.
- **Component** — the major logical components inside one container and their relationships. Use when a container is non-trivial or when a team member needs to navigate the internals.
- **Code** — class/module diagrams. Rarely needed; let the code speak for itself at this level.

Produce diagrams in Mermaid or as structured text when tooling is unavailable. Always label protocols, data formats, and ownership on container diagrams.

### 3. Write Architecture Decision Records (ADRs)

Capture every significant architectural decision as an ADR stored at `docs/adr/NNNN-title.md` (zero-padded four-digit sequence). The format:

```markdown
# NNNN — Title

**Status:** Proposed | Accepted | Superseded by [NNNN]

## Context

What situation prompted this decision? What forces are in tension? What constraints apply?

## Decision

What was decided? State it as a clear, active sentence.

## Consequences

What becomes easier? What becomes harder? What new obligations or risks does this introduce?
```

An ADR is not a design doc — keep it concise. Record what was decided and why, not a full exploration of every option. Mark superseded ADRs; never delete them.

Trigger an ADR for: technology selection, service boundary changes, cross-cutting data or auth patterns, departures from existing conventions, and any decision the team will ask "why did we do it this way?" six months from now.

### 4. Let non-functional requirements drive design

Before committing to a topology, enumerate the NFRs that constrain it:

- **Scalability** — expected load, growth rate, horizontal vs. vertical scaling needs; where state lives and how it shards.
- **Availability** — target uptime (99.9 % vs. 99.99 %), tolerable failure modes, failover strategy, RPO/RTO.
- **Latency** — p50/p95/p99 targets per operation; synchronous vs. asynchronous where latency matters.
- **Cost** — compute, storage, and egress budget; idle vs. peak cost profile.
- **Security** — trust boundaries, data classification, encryption at rest and in transit, authentication/authorization model, blast radius of a compromise.

NFRs are constraints, not goals to maximize. Choose the simplest design that satisfies the real constraint. When an NFR is unknown, state the assumption in an ADR and design for the lower bound until measurement reveals otherwise.

### 5. Select technology with explicit tradeoffs

For every significant technology choice, record at least three options with explicit tradeoffs before deciding:

| Option | Strengths | Weaknesses | When to prefer |
|--------|-----------|------------|----------------|
| ...    | ...       | ...        | ...            |

Evaluation criteria: team familiarity, operational maturity, vendor lock-in exposure, cost, fit to NFRs, ecosystem health. Capture the choice and the reasoning in an ADR.

Prefer boring technology for infrastructure — proven tools with known failure modes over novel tools with unknown ones. Reserve novel choices for the domain layers where differentiation matters and the team can absorb the learning curve.

### 6. Evolutionary architecture: avoid big-design-up-front

Design for the decisions you must make now; defer what can safely be deferred. Apply `principles-dry-kiss` KISS and YAGNI: the simplest architecture that satisfies today's real constraints is the right one. An abstraction or service split that anticipates a future that does not arrive is waste.

Build in fitness functions — lightweight automated checks that verify architectural properties over time (dependency-direction tests, contract tests at service seams, latency smoke tests). They make the architecture evolvable without a big rewrite.

Prefer reversible decisions over irreversible ones. When two options are otherwise equivalent, pick the one that is cheaper to undo.

## Cross-references

- `principles-ddd` — bounded-context strategy, ubiquitous language, domain/infra separation; the architectural seams follow DDD context maps.
- `principles-pragmatic-solid` — Dependency Inversion at architectural boundaries mirrors the port/adapter discipline at the code level.
- `principles-dry-kiss` — YAGNI governs when to split, abstract, or add a layer; KISS breaks ties when two designs satisfy the same NFRs.
- `principles-tdd` — architecture should be verifiable; fitness functions and contract tests are the architectural analogue of unit tests.
