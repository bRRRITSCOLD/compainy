---
name: threat-modeling
description: Produces a threat model for a system or feature and turns it into ranked, testable security requirements. Invoked when the user says "threat model this", "STRIDE", "trust boundaries", "attack surface", "abuse cases", "what could go wrong securely", "security requirements", "data-flow diagram for security", or before building anything handling auth, money, PII, multi-tenant data, or untrusted input. Owns the design-time security analysis; security-review owns the audit of built code.
---

# Threat Modeling Skill

Find what an attacker would do *before* building, rank it, and turn it into security requirements the team implements and tests. A threat model is design-time security analysis — proportionate to risk, not a compliance checkbox. The output is concrete: ranked threats → security requirements → tests. Controls are earned by ranked risk (`principles-dry-kiss` / `YAGNI`); the threat model is what separates a needed control from ceremony.

## Process

### 1. Frame the system

- **Define the scope** — the feature/system, its assets (what an attacker wants: credentials, money, PII, tenant data, availability), and the security objectives (confidentiality, integrity, availability) that matter for those assets.
- **Draw the data flow** — external entities, processes, data stores, and the data moving between them. Reference the `architecture` C4/topology rather than redrawing it; annotate it for security.
- **Mark trust boundaries** — every point where data crosses a privilege or trust level (internet→edge, service→service, app→DB, tenant→tenant, user→admin). Threats concentrate at boundaries; untrusted input crossing one is where most risk lives.

### 2. Enumerate threats with STRIDE

For each element and each trust-boundary crossing, walk STRIDE — each maps to a security property it violates:

| STRIDE category | Violates | Ask |
|---|---|---|
| **Spoofing** | Authentication | Can an attacker pretend to be another user/service/tenant? |
| **Tampering** | Integrity | Can data be modified in transit or at rest without detection? |
| **Repudiation** | Non-repudiation | Can an actor deny an action with no audit trail? |
| **Information disclosure** | Confidentiality | Can data leak — in responses, errors, logs, side channels? |
| **Denial of service** | Availability | Can an attacker exhaust resources or wedge the system? |
| **Elevation of privilege** | Authorization | Can a user act beyond their role / cross a tenant boundary? |

Write each threat as an **abuse case**: actor + capability + asset + impact (e.g. "a tenant-A user with a valid token reads tenant-B logs via an unscoped query"). Concrete beats categorical.

### 3. Rank by risk

Score each threat **likelihood × impact** (a simple High/Med/Low on each is enough — don't build a CVSS spreadsheet unless the domain demands it). Rank them. This ordering is the whole point: it tells the team which controls are required now, which are accepted, and which are deferred. Record explicitly accepted risks — an accepted risk is a decision, not an oversight.

### 4. Choose proportionate controls

For each ranked threat, pick a control that mitigates it — and stop there. Common mappings:

- **Spoofing** → strong authn (OAuth/OIDC, MFA where warranted), service identity, signed tokens with short lifetimes + rotation.
- **Tampering** → TLS in transit, integrity checks/signing, input validation at the boundary, least-privilege writes.
- **Repudiation** → tamper-evident audit logging of security-relevant actions.
- **Information disclosure** → encryption at rest, field-level controls for PII, scrubbed errors/logs (never log secrets/tokens/PII), least-privilege reads.
- **DoS** → rate limiting, quotas, timeouts, backpressure, resource caps.
- **Elevation of privilege** → authorization checks at every boundary, deny-by-default, tenant-scoping on every query, least-privilege roles.

Do not add a control with no ranked threat behind it. Proportionality is the discipline.

### 5. Emit requirements, ADRs, and tests

- **Security requirements** — each ranked threat with a required control becomes a testable requirement handed to the implementers (`backend-engineer`/`frontend-engineer`/`devops-engineer`).
- **Security ADR** — record the significant decisions (auth model, secrets strategy, accepted risks) as an Architecture Decision Record (`architecture`).
- **Abuse-case tests** — each high/medium threat becomes a test seeded into the TDD cycle via `test-design` (authz-bypass, injection, tampering, tenant-crossing). A control with no test is an assumption.

### 6. Keep it live

A threat model is not a one-time document. Revisit when a new trust boundary appears, a new data class is handled, a new dependency or integration is added, or the auth model changes. The `security-review` skill audits built code against this model; gaps feed back here.

## Boundaries

- **`architecture`** owns C4/topology and ADR mechanics — reference it; this skill annotates the architecture for security and contributes security ADRs.
- **`security-review`** audits *built code* against this model; this skill is the *design-time* analysis that precedes it.
- **`test-design`** turns threats into tests; **`principles-dry-kiss`** keeps controls proportionate to ranked risk.
