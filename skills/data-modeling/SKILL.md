---
name: data-modeling
description: Applies data modeling and database design discipline. Invoked when an engineer or architect is choosing a data store, designing schemas, normalizing or denormalizing for a read/write workload, mapping DDD aggregates to persistence boundaries, planning migrations, modeling embeddings for semantic search, or evaluating polyglot persistence. Also triggered by "what database should we use", "schema design", "data model", "indexing strategy", "vector store", "embeddings schema", "pgvector", "aggregate boundary", "migration plan", or "polyglot persistence".
---

# Data Modeling Skill

Senior-level data and database design practice: choose the right store for the workload with explicit tradeoffs, model schemas access-pattern-first, enforce consistency at aggregate boundaries, and keep polyglot persistence honest against KISS/YAGNI. Pragmatic over maximalist — the simplest store that satisfies real constraints wins.

## Process

### 1. Choose the store per workload

Match the store to the access pattern and consistency requirement. For every significant store choice, state the tradeoffs explicitly before deciding:

| Store type | Strengths | Weaknesses | When to prefer |
|---|---|---|---|
| **Relational (Postgres)** | ACID transactions, joins, strong schema, rich query | Vertical scale ceiling, schema migrations need care | Transactional workloads with referential integrity and complex queries |
| **Document (MongoDB, Firestore)** | Flexible schema, hierarchical aggregates, horizontal scale | Weak joins, eventual consistency by default, denorm required | Flexible or evolving aggregate shapes; reads dominate; bounded contexts with clear aggregate roots |
| **Key-value (Redis, DynamoDB)** | Sub-millisecond latency, horizontal scale, simple ops | No query flexibility, no joins, weak consistency guarantees | Cache, session, leaderboard, rate-limit counters; single-key access pattern only |
| **Wide-column (Cassandra, ScyllaDB)** | Extreme write throughput, linear horizontal scale | Query-by-partition-key only, eventual consistency, tuning required | High-write append workloads (IoT, event logging) where read patterns are known and narrow |
| **Vector (pgvector, Pinecone, Weaviate)** | Approximate nearest-neighbour over embeddings, semantic similarity | Not a general-purpose store; recall/precision tradeoffs; index tuning required | Semantic search, RAG retrieval, recommendation; use pgvector inside Postgres when scale allows to avoid a second store |
| **Time-series (TimescaleDB, InfluxDB)** | Efficient time-range queries and downsampling, automatic retention | Schema is time-partitioned; poor fit for non-time workloads | Metrics, monitoring, IoT sensor streams, financial tick data |
| **Graph (Neo4j, Amazon Neptune)** | Efficient multi-hop relationship traversal | Niche operational model; weak transactional guarantees in some engines | Relationship-heavy domains (social graphs, knowledge graphs, fraud rings) where join depth > 3 is common |

Apply `principles-dry-kiss` YAGNI: do not introduce a specialized store until the workload has demonstrated the need. Postgres with the right indexes and pgvector handles more than most teams expect.

### 2. Logical data modeling

**Relational (OLTP):** Normalize to third normal form as the starting point. Every table has a clear primary key; foreign keys enforce referential integrity at the database level. Denormalize deliberately and document the reason — usually for a specific high-frequency read path where a join is measured to be too slow.

**Document stores:** Model the document around the read. Embed child entities inside the parent document when they are always read together and never updated in isolation. Reference by ID only when the child is queried independently or shared across parents. Avoid deep nesting beyond two levels — it makes updates awkward and signals a schema design problem.

**NoSQL / wide-column / key-value:** Access-pattern-first. Define every query the system will issue before designing the schema; the schema derives from the queries, not the reverse. Over-partition and you get hot spots; under-partition and you lose the scale benefit.

### 3. Map DDD aggregates to schemas and consistency boundaries

One aggregate = one transactional boundary. An aggregate root and all the entities it governs must be writable within a single transaction. This maps cleanly to:

- **Relational:** one aggregate root table + child tables in the same database; load/save via a repository that issues a single transaction.
- **Document:** one document per aggregate root; embed children; never span an aggregate across two documents in a single write.
- **Event store:** one stream per aggregate instance; the stream IS the transactional boundary.

Pairs with `principles-ddd`: if two entity clusters must be updated atomically, they belong to the same aggregate and the same store. If they can be eventually consistent, they belong to separate aggregates and may span separate stores — with explicit compensation or domain events for cross-boundary consistency.

Do not let service-to-service convenience drive aggregate boundaries. A shared database table accessed by multiple services is a hidden coupling; it will resist independent deployment and schema evolution.

### 4. Indexing, migrations, and data integrity

**Indexing:** Index selectively. Every index speeds reads and slows writes; do not add speculative indexes. Add indexes when: (a) a query plan shows a full table/collection scan on a hot path, or (b) a foreign key or uniqueness constraint requires it. Use composite indexes for multi-column filters; put the highest-cardinality column first unless the query pattern favors another order. For Postgres, prefer partial indexes when only a subset of rows is queried.

**Migrations:** Write migrations as code (Flyway, golang-migrate, Alembic) and version-control them. Migrations run forward only in production; rollback is a new forward migration. For large tables: add columns as nullable, backfill in batches offline, then tighten the constraint — never block a large table with a single `ALTER TABLE`. Test migrations against a production-sized snapshot before shipping.

**Data integrity:** Enforce invariants at the lowest level where enforcement is cheap. Non-null constraints, foreign keys, check constraints, and unique indexes belong in the schema — not only in application code. Application-level validation is defense-in-depth, not the primary guard.

### 5. Polyglot persistence only when justified (KISS/YAGNI)

Multi-store architectures multiply operational burden: separate connection pools, monitoring, backup strategies, migration tooling, and on-call surface area. Introduce a second store only when:

- The primary store demonstrably cannot satisfy the workload (measured, not guessed), **and**
- The cost and complexity of operating two stores is less than the cost of engineering around the limitation.

Justify every additional store in writing (an ADR is appropriate). Pairs with `principles-dry-kiss` YAGNI and `architecture` ADR practice.

### 6. Embeddings and RAG data design for vector stores

When designing for semantic search or retrieval-augmented generation:

**Chunking strategy:** Chunk source documents at semantically coherent boundaries (paragraph, section, sentence window) rather than fixed token counts. Store chunk metadata (source doc ID, position, timestamp) alongside the vector so retrieval can reconstruct provenance.

**Embedding model and dimensionality:** Choose the embedding model before finalizing the index; the model's output dimension determines the index structure. Do not mix embeddings from different models in the same index — similarity scores become incomparable.

**Index choice (pgvector):** Use `ivfflat` for datasets < ~1 M rows and where approximate recall is acceptable; use `hnsw` for lower query latency at the cost of higher build time and memory. Set `lists` (ivfflat) or `m`/`ef_construction` (hnsw) based on dataset size, not defaults.

**Hybrid search:** Combine vector similarity with keyword or filter predicates (`WHERE category = $1 AND embedding <=> $2 < threshold`) to improve precision. Pure ANN retrieval alone frequently returns off-topic results when the query is narrow.

**Freshness and reindexing:** Embeddings go stale when the source content changes or the embedding model is upgraded. Design the pipeline to re-embed incrementally (by content hash or updated_at) and to swap indexes atomically — build the new index in a shadow column, then rename.

## Cross-references

- `principles-ddd` — aggregate roots define transactional boundaries; one aggregate per transaction maps directly to schema design.
- `principles-dry-kiss` — YAGNI governs when to introduce a second store; KISS breaks ties between schema designs of equal correctness.
- `principles-pragmatic-solid` — repositories behind interfaces hide the store choice from domain logic; swap stores without touching business rules.
- `principles-tdd` — test persistence adapters with integration tests against a real store (or testcontainers); do not mock the database for schema-level correctness tests.
- `architecture` — a store choice that crosses service boundaries warrants an ADR; polyglot decisions always do.
