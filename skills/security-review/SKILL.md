---
name: security-review
description: Performs a deep, adversarial security audit of a change or system — beyond the general code review. Invoked when the user says "security review", "security audit", "review for vulnerabilities", "is this secure", "check for OWASP issues", "pentest this code", "review the auth", or when a diff touches authentication, authorization, cryptography, secrets, untrusted-input parsing, data exposure, infrastructure permissions, or new dependencies. Complements the built-in /security-review command and the team code-review skill; owned by the security-architect.
---

# Security Review Skill

A deep, attacker-minded audit of built code and configuration — the security depth that the general `code-review` (which keeps security as one general dimension) does not reach. Where `code-review` asks "is this clean and correct?", this asks "what would a motivated attacker do with this?" Audit against the `threat-modeling` output when one exists; otherwise the checklist below is the floor. Findings are severity-ranked (Critical / Important / Minor) with location → vulnerability → exploit → fix.

> This is the team's checklist, owned by `security-architect`. It **complements** the built-in `/security-review` command (use both — the command for a broad automated pass, this for threat-model-aware depth) and the team `code-review` skill (which keeps security as one general dimension and defers depth here).

## When to run

Always for diffs touching: authentication, authorization/tenant-scoping, cryptography, secrets/keys, parsing of untrusted input, data exposure (responses/logs/errors), infrastructure permissions, or new third-party dependencies. Otherwise, on request or before shipping anything internet-facing.

## Checklist

### 1. Authentication & sessions
- Credentials never logged, stored plaintext, or returned. Passwords hashed with a strong adaptive function (argon2/bcrypt/scrypt), not a fast hash.
- Tokens: short-lived, signed/verified correctly (algorithm pinned — no `alg:none`/confusion), rotated, revocable. Session fixation and replay considered.
- MFA where the threat model warrants; secure password-reset and account-recovery flows (no user enumeration).

### 2. Authorization & tenancy
- **Authorization checked at every boundary**, server-side, deny-by-default. No reliance on client-side checks or UI hiding.
- **Every data access is tenant/owner-scoped** — the multi-tenant invariant. Hunt for unscoped queries, IDOR (object references an attacker can change), and missing ownership checks.
- Privilege escalation paths: can a normal user reach admin actions, or tenant A reach tenant B?
- **CSRF**: state-changing requests under cookie auth are protected (anti-CSRF token or `SameSite` cookies); a custom header alone is not relied on for cross-origin protection.

### 3. Input handling & injection
- Untrusted input validated/normalized at the boundary (`backend-service-patterns`): schema-validated, typed, bounded.
- Parameterized queries (no string-built SQL); no command/template/LDAP injection; output encoded for its sink (XSS). SSRF: outbound requests to user-supplied URLs restricted. Unsafe deserialization avoided.
- **Mass assignment / over-posting**: inbound payloads bind only allowed fields — an attacker can't set `role`, `tenantId`, `isAdmin`, or other privileged fields by adding them to the request.

### 4. Cryptography & secrets
- TLS for data in transit; encryption at rest for sensitive data. No home-rolled crypto; vetted libraries, sound modes (authenticated encryption), no static IV/nonce reuse.
- Secrets come from a secret store (not source, not images, not logs); keys have a rotation story. Nothing sensitive in errors, logs, or analytics.

### 5. Data exposure
- Responses return only the fields the caller may see (no over-fetching of internal/PII fields). Errors are scrubbed (no stack traces, queries, or secrets to clients). Logs exclude PII/tokens.
- PII handling matches the data-protection design (retention, minimization).

### 6. Availability & abuse
- Rate limiting / quotas on expensive or auth endpoints; timeouts and resource caps; no unbounded work from a single request. Pagination bounded.
- **Security logging & monitoring**: security-relevant actions (authn failures, authz denials, privilege changes) are logged tamper-evidently and alertable — the audit trail the threat model's Repudiation controls assumed actually exists in the built code (no secrets/PII in those logs).

### 7. Supply chain & config
- New dependencies: necessary, reputable, pinned; no known-vulnerable versions; lockfile committed. Minimize transitive surface.
- CI/CD: least-privilege tokens, no secret leakage in logs, pinned actions (`ci-cd`/`devops-engineer`). Security headers (CSP, HSTS, etc.) and secure cookie flags where applicable.

### 8. Against the threat model
- Every High/Medium threat from `threat-modeling` has a control **and a test**. Flag any modeled threat whose control is missing, weakened, or untested. Flag new trust boundaries introduced by the change that the model didn't cover.

## Output

Severity-ranked findings: **location → vulnerability → realistic exploit → concrete fix.** Distinguish *exploitable now* (Critical) from *defense-in-depth* (Minor). An attacker-plausible exploit narrative beats a generic "this is insecure" — it's what makes a finding actionable and prioritizable.

## Boundaries

- **`code-review`** owns general correctness/principle review and keeps security as one general dimension, deferring depth here.
- **`threat-modeling`** is the design-time analysis this audit checks built code against.
- **`principles-dry-kiss`** — judge controls as proportionate to ranked risk; flag both *missing* controls and *gold-plated* ones with no threat behind them.
