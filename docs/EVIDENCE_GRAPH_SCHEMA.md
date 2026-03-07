# Evidence Graph Canonical Schema

> **Authoritative reference for the Court Access Neo4j evidence graph.**
> This document defines all node types, relationship types, integrity constraints,
> indexing strategy, and the fact provenance model.
>
> **Status:** Architecture Lock -- no structural changes without explicit approval.
> **Version:** 1.1.0
> **Authored:** Phase -- Evidence Graph Schema Definition

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Tenant Isolation](#2-tenant-isolation)
3. [Node Types](#3-node-types)
4. [Relationship Types](#4-relationship-types)
5. [Fact Provenance Model](#5-fact-provenance-model)
6. [Graph Integrity Constraints](#6-graph-integrity-constraints)
7. [Indexing Strategy](#7-indexing-strategy)
8. [Example Cypher Queries](#8-example-cypher-queries)
9. [Deterministic Constraints](#9-deterministic-constraints)

---

## 1. Design Principles

| Principle | Rule |
|---|---|
| **Deterministic** | Every node and relationship is reproducible from source data. No randomness. |
| **Immutable facts** | Once a `Fact` node is registered, it is never updated or deleted. Append-only. |
| **Dual-hashed** | All content-addressed nodes carry both SHA-256 and SHA3-256 hashes. |
| **Tenant-isolated** | Every node carries a `tenant_id` property. Cross-tenant traversal is forbidden. |
| **No probability** | No confidence scores, no ranking, no anomaly detection on graph nodes. |
| **Binary verification** | Integrity checks produce PASS or FAIL. No partial pass. |
| **ASCII-deterministic ordering** | All sorted fields use ASCII byte-order comparison. No locale-dependent sorting. |

---

## 2. Tenant Isolation

Every node in the graph MUST include a `tenant_id` property. All Cypher queries MUST
include a `WHERE n.tenant_id = $tenantId` filter. Cross-tenant joins are architecturally
forbidden.

```cypher
// REQUIRED pattern for ALL queries
MATCH (n:Evidence {tenant_id: $tenantId})
// ...
```

**Enforcement:** Neo4j property existence constraints on `tenant_id` for every node label.

---

## 3. Node Types

### 3.0 Case

The root node for every evidence graph. All evidence, documents, entities,
events, and timeline entries are anchored to a Case. This guarantees
deterministic graph boundaries, efficient case-level queries, and strict
tenant isolation.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `case_id` | String (UUID) | Yes | Yes | Unique case identifier |
| `tenant_id` | String (UUID) | Yes | Yes | Tenant scope identifier |
| `defendant_id` | String (UUID) | Yes | Yes | Associated defendant identifier |
| `case_number` | String | Yes | No | Human-readable case number (e.g. `2024-CR-00142`) |
| `jurisdiction` | String | Yes | No | Jurisdiction (`federal`, `state`, `county`, `municipal`) |
| `status` | String | Yes | No | Case status (`active`, `closed`, `pending`, `archived`) |
| `created_at` | String | Yes | Yes | ISO 8601 timestamp of case creation |
| `updated_at` | String | Yes | No | ISO 8601 timestamp of last metadata update |

> **Root anchor contract:** Every evidence graph MUST be rooted at exactly one
> `Case` node. Orphan subgraphs (evidence, documents, facts, etc. not reachable
> from a Case) are integrity violations.

### 3.1 Evidence

The root container for a piece of evidence (a file, recording, or external source).

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `evidence_id` | String | Yes | Yes | SHA-256 content-addressed ID (64 hex chars) |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `case_id` | String | Yes | Yes | Associated case identifier |
| `name` | String | Yes | No | Human-readable evidence name |
| `type` | String | Yes | No | Evidence type (`document`, `audio`, `video`, `image`, `external`) |
| `source_uri` | String | No | Yes | Original source location (storage path or URL) |
| `file_size_bytes` | Integer | No | Yes | File size at ingestion time |
| `mime_type` | String | No | Yes | MIME type at ingestion time |
| `ingested_at` | String | Yes | Yes | ISO 8601 timestamp of ingestion |
| `sha256` | String | Yes | Yes | SHA-256 hash of raw content |
| `sha3_256` | String | Yes | Yes | SHA3-256 hash of raw content |

### 3.2 Document

A legal document with text content extracted from evidence.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `document_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `case_id` | String | Yes | Yes | Associated case identifier |
| `name` | String | Yes | No | Document title |
| `document_type` | String | Yes | No | Classification (`defense_motion`, `charging_document`, `transcript`, `prosecution_motion`, `court_order`, `defense_filing`, `other`) |
| `filed_date` | String | No | No | Date filed (ISO 8601) |
| `page_count` | Integer | Yes | Yes | Number of pages at ingestion |
| `extraction_status` | String | Yes | No | Text extraction status (`pending`, `processing`, `complete`, `failed`) |
| `sha256` | String | Yes | Yes | SHA-256 of extracted text content |
| `sha3_256` | String | Yes | Yes | SHA3-256 of extracted text content |

### 3.3 Fact

An atomic, provenance-tracked assertion extracted from a document. Immutable once registered.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `fact_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `case_id` | String | Yes | Yes | Associated case identifier |
| `source_document` | String | Yes | Yes | `document_id` of the source document |
| `source_page` | Integer | Yes | Yes | Page number where fact was extracted |
| `source_line` | Integer | No | Yes | Line number within the page (if available) |
| `content` | String | Yes | Yes | The factual assertion text |
| `extraction_method` | String | Yes | Yes | How the fact was extracted (`manual`, `ai_extraction`, `ocr`, `transcript_parse`) |
| `extracted_at` | String | Yes | Yes | ISO 8601 timestamp of extraction |
| `sha256` | String | Yes | Yes | SHA-256 of canonical fact JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical fact JSON |

> **Immutability contract:** Once a Fact node is created, NO property may be updated or
> deleted. If a fact is superseded, create a new Fact and link via `[:SUPERSEDES]`.

### 3.4 Entity

A named entity extracted from documents (person, organization, location, or object).

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `entity_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `entity_type` | String | Yes | Yes | Classification (`person`, `organization`, `location`, `object`) |
| `canonical_name` | String | Yes | No | Normalized canonical name (uppercase, punctuation stripped) |
| `display_name` | String | Yes | No | Human-readable display name |
| `first_seen` | String | Yes | No | ISO 8601 -- earliest document reference |
| `last_seen` | String | Yes | No | ISO 8601 -- latest document reference |
| `sha256` | String | Yes | Yes | SHA-256 of canonical entity JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical entity JSON |

### 3.5 Event

A discrete occurrence with a timestamp, extracted from facts or documents.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `event_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `case_id` | String | Yes | Yes | Associated case identifier |
| `event_type` | String | Yes | Yes | Classification (`hearing`, `arrest`, `filing`, `incident`, `ruling`, `testimony`) |
| `description` | String | Yes | Yes | Event description |
| `occurred_at` | String | Yes | Yes | ISO 8601 timestamp of occurrence |
| `sha256` | String | Yes | Yes | SHA-256 of canonical event JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical event JSON |

### 3.6 Location

A physical or jurisdictional location referenced in the case.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `location_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `canonical_name` | String | Yes | No | Normalized location name |
| `location_type` | String | Yes | Yes | Classification (`court`, `address`, `jurisdiction`, `facility`) |
| `address` | String | No | No | Street address (if known) |
| `city` | String | No | No | City |
| `state` | String | No | No | State/province |
| `sha256` | String | Yes | Yes | SHA-256 of canonical location JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical location JSON |

### 3.7 Person

A specific individual involved in the case. Extends Entity with legal-domain fields.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `person_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `canonical_name` | String | Yes | No | Normalized name (uppercase, punctuation stripped) |
| `display_name` | String | Yes | No | Human-readable name |
| `role` | String | Yes | No | Case role (`defendant`, `witness`, `officer`, `attorney`, `judge`, `expert`, `victim`, `other`) |
| `badge_id` | String | No | No | Officer badge number (if applicable) |
| `department` | String | No | No | Associated department or organization |
| `first_seen` | String | Yes | No | ISO 8601 -- earliest document reference |
| `last_seen` | String | Yes | No | ISO 8601 -- latest document reference |
| `sha256` | String | Yes | Yes | SHA-256 of canonical person JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical person JSON |

### 3.8 Organization

An institution, agency, or corporate body referenced in the case.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `organization_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `canonical_name` | String | Yes | No | Normalized organization name |
| `display_name` | String | Yes | No | Human-readable name |
| `org_type` | String | Yes | Yes | Classification (`law_enforcement`, `court`, `prosecution`, `defense`, `government`, `private`, `other`) |
| `sha256` | String | Yes | Yes | SHA-256 of canonical organization JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical organization JSON |

### 3.9 Statement

A verbatim or paraphrased statement attributed to a person, extracted from documents.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `statement_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `case_id` | String | Yes | Yes | Associated case identifier |
| `speaker_person_id` | String | Yes | Yes | `person_id` of the speaker |
| `content` | String | Yes | Yes | Statement text |
| `context` | String | No | Yes | Surrounding context (e.g. "during cross-examination") |
| `source_document` | String | Yes | Yes | `document_id` of the source |
| `source_page` | Integer | Yes | Yes | Page number |
| `source_line` | Integer | No | Yes | Line number (if available) |
| `statement_type` | String | Yes | Yes | Classification (`testimony`, `deposition`, `interview`, `written`, `other`) |
| `recorded_at` | String | No | Yes | ISO 8601 timestamp of when statement was made |
| `sha256` | String | Yes | Yes | SHA-256 of canonical statement JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical statement JSON |

### 3.10 TimelineEvent

A positioned entry on the case timeline, linking events to their evidence chain.

| Property | Type | Required | Immutable | Description |
|---|---|---|---|---|
| `timeline_event_id` | String | Yes | Yes | SHA-256 content-addressed ID |
| `tenant_id` | String | Yes | Yes | Tenant scope identifier |
| `case_id` | String | Yes | Yes | Associated case identifier |
| `title` | String | Yes | No | Short event title |
| `description` | String | Yes | No | Detailed description |
| `occurred_at` | String | Yes | Yes | ISO 8601 timestamp |
| `category` | String | Yes | Yes | Category (`procedural`, `evidentiary`, `constitutional`, `sentencing`) |
| `source_fact_ids` | String[] | Yes | Yes | Array of `fact_id` values supporting this timeline entry |
| `sha256` | String | Yes | Yes | SHA-256 of canonical timeline event JSON |
| `sha3_256` | String | Yes | Yes | SHA3-256 of canonical timeline event JSON |

---

## 4. Relationship Types

All relationships are directed. Relationship properties are optional unless noted.

### 4.1 Case to Evidence

```
(Case)-[:HAS_EVIDENCE]->(Evidence)
```

A case owns one or more evidence artifacts. This is the primary Case→Evidence
ownership edge.

### 4.2 Case to Document

```
(Case)-[:HAS_DOCUMENT]->(Document)
```

A case owns one or more legal documents. This is the primary Case→Document
ownership edge validated by the nightly integrity checker (`graphIntegrityCheck.ts`).

### 4.3 Case to Entity

```
(Case)-[:HAS_ENTITY]->(Entity)
```

A case references one or more named entities.

### 4.4 Case to Event

```
(Case)-[:HAS_EVENT]->(Event)
```

A case contains one or more discrete events.

### 4.5 Case to Timeline

```
(Case)-[:HAS_TIMELINE]->(TimelineEvent)
```

A case has one or more positioned timeline entries.

### 4.6 Evidence Containment

```
(Evidence)-[:CONTAINS]->(Fact)
```

An evidence artifact contains one or more extracted facts.

| Property | Type | Required | Description |
|---|---|---|---|
| `extracted_at` | String | Yes | ISO 8601 timestamp of extraction |

### 4.7 Fact to Case

```
(Fact)-[:BELONGS_TO_CASE]->(Case)
```

Every fact is anchored to its owning case. This enables direct case-level
fact queries without intermediate traversal:

```cypher
MATCH (c:Case {case_id: $caseId})<-[:BELONGS_TO_CASE]-(f:Fact)
RETURN f
```

### 4.8 Fact to Entity

```
(Fact)-[:MENTIONS]->(Entity)
```

A fact mentions a named entity.

| Property | Type | Required | Description |
|---|---|---|---|
| `mention_type` | String | No | How the entity is mentioned (`direct`, `indirect`, `inferred`) |

### 4.9 Fact to Person

```
(Fact)-[:INVOLVES]->(Person)
```

A fact directly involves a specific person.

| Property | Type | Required | Description |
|---|---|---|---|
| `role_in_fact` | String | No | Person's role in this specific fact (`actor`, `subject`, `witness`, `mentioned`) |

### 4.10 Entity Participation

```
(Entity)-[:PARTICIPATES_IN]->(Event)
```

An entity participated in an event.

| Property | Type | Required | Description |
|---|---|---|---|
| `participation_role` | String | No | Role in the event |

### 4.11 Person Participation

```
(Person)-[:PARTICIPATED_IN]->(Event)
```

A person participated in an event (more specific than Entity).

| Property | Type | Required | Description |
|---|---|---|---|
| `role` | String | No | Person's role in the event |

### 4.12 Event Location

```
(Event)-[:OCCURRED_AT]->(Location)
```

An event occurred at a specific location.

### 4.13 Fact Support

```
(Fact)-[:SUPPORTS]->(Fact)
```

One fact provides evidentiary support for another fact.

| Property | Type | Required | Description |
|---|---|---|---|
| `support_type` | String | No | Type of support (`corroborates`, `establishes_element`, `provides_context`) |

### 4.14 Fact Contradiction

```
(Fact)-[:CONTRADICTS]->(Fact)
```

One fact contradicts another fact.

| Property | Type | Required | Description |
|---|---|---|---|
| `contradiction_type` | String | No | Type of contradiction (`direct`, `temporal`, `logical`) |

### 4.15 Fact Extraction

```
(Fact)-[:EXTRACTED_FROM]->(Document)
```

A fact was extracted from a specific document. This is the canonical
Fact→Document provenance edge validated by the nightly integrity checker
(`graphIntegrityCheck.ts`).

| Property | Type | Required | Description |
|---|---|---|---|
| `extraction_method` | String | Yes | Method used (`manual`, `ai_extraction`, `ocr`, `transcript_parse`) |
| `page` | Integer | Yes | Source page number |
| `line` | Integer | No | Source line number |

### 4.16 Fact Supersession

```
(Fact)-[:SUPERSEDES]->(Fact)
```

A newer fact supersedes an older one (since facts are immutable, corrections create
new facts linked via this relationship).

| Property | Type | Required | Description |
|---|---|---|---|
| `reason` | String | Yes | Why the original was superseded |

### 4.17 Statement Attribution

```
(Statement)-[:ATTRIBUTED_TO]->(Person)
```

A statement is attributed to a person.

### 4.18 Statement Source

```
(Statement)-[:SOURCED_FROM]->(Document)
```

A statement was extracted from a document.

| Property | Type | Required | Description |
|---|---|---|---|
| `page` | Integer | Yes | Source page number |
| `line` | Integer | No | Source line number |

### 4.19 Person Affiliation

```
(Person)-[:AFFILIATED_WITH]->(Organization)
```

A person is affiliated with an organization (e.g., officer belongs to a department).

| Property | Type | Required | Description |
|---|---|---|---|
| `affiliation_type` | String | No | Type (`employed_by`, `represents`, `member_of`) |

### 4.20 Timeline Evidence Chain

```
(TimelineEvent)-[:EVIDENCED_BY]->(Fact)
```

A timeline event is evidenced by one or more facts.

### 4.21 Timeline Sequence

```
(TimelineEvent)-[:PRECEDES]->(TimelineEvent)
```

Establishes temporal ordering between timeline events.

### Relationship Summary

| Relationship | Source | Target | Semantics |
|---|---|---|---|
| `HAS_EVIDENCE` | Case | Evidence | Case owns evidence artifact |
| `HAS_DOCUMENT` | Case | Document | Case owns document |
| `HAS_ENTITY` | Case | Entity | Case references entity |
| `HAS_EVENT` | Case | Event | Case contains event |
| `HAS_TIMELINE` | Case | TimelineEvent | Case has timeline entry |
| `CONTAINS` | Evidence | Fact | Evidence contains extracted fact |
| `BELONGS_TO_CASE` | Fact | Case | Fact anchored to case |
| `MENTIONS` | Fact | Entity | Fact mentions entity |
| `INVOLVES` | Fact | Person | Fact involves person |
| `PARTICIPATES_IN` | Entity | Event | Entity participated in event |
| `PARTICIPATED_IN` | Person | Event | Person participated in event |
| `OCCURRED_AT` | Event | Location | Event occurred at location |
| `SUPPORTS` | Fact | Fact | Fact supports another fact |
| `CONTRADICTS` | Fact | Fact | Fact contradicts another fact |
| `EXTRACTED_FROM` | Fact | Document | Fact extracted from document |
| `SUPERSEDES` | Fact | Fact | Newer fact replaces older fact |
| `ATTRIBUTED_TO` | Statement | Person | Statement attributed to person |
| `SOURCED_FROM` | Statement | Document | Statement extracted from document |
| `AFFILIATED_WITH` | Person | Organization | Person affiliated with organization |
| `EVIDENCED_BY` | TimelineEvent | Fact | Timeline event evidenced by fact |
| `PRECEDES` | TimelineEvent | TimelineEvent | Temporal ordering |

---

## 5. Fact Provenance Model

Every `Fact` node carries full provenance metadata. This is the chain of custody
for extracted assertions.

### 5.1 Required Provenance Fields

| Field | Description |
|---|---|
| `fact_id` | SHA-256 content-addressed identifier (deterministic from content + source) |
| `source_document` | `document_id` of the document the fact was extracted from |
| `source_page` | Page number within the source document |
| `source_line` | Line number within the page (when available) |
| `content` | The factual assertion text (verbatim or normalized) |
| `extraction_method` | How the fact was extracted: `manual`, `ai_extraction`, `ocr`, `transcript_parse` |
| `extracted_at` | ISO 8601 timestamp of when extraction occurred |

### 5.2 Provenance Hash Derivation

The `fact_id` is derived from a canonical JSON representation:

```json
{
  "tenant_id": "<tenant_id>",
  "case_id": "<case_id>",
  "source_document": "<document_id>",
  "source_page": <page_number>,
  "source_line": <line_number_or_null>,
  "content": "<fact_content>",
  "extraction_method": "<method>"
}
```

**Canonical JSON rules:**
- Keys sorted in the order shown above (fixed, not alphabetical)
- No whitespace between keys/values
- Null values rendered as `null` (not omitted)
- String values use double quotes with no escaping beyond JSON spec
- `fact_id = SHA-256(canonical_json)`

### 5.3 Immutability Contract

```
Facts are APPEND-ONLY.
  - No UPDATE on any Fact property.
  - No DELETE of any Fact node.
  - No DETACH DELETE of any Fact node.
  - Corrections create a NEW Fact linked via [:SUPERSEDES].
  - The original Fact remains in the graph permanently.
```

### 5.4 Provenance Chain

The full provenance chain for any fact is:

```
Fact --[:EXTRACTED_FROM]--> Document <--[:HAS_DOCUMENT]-- Case
Fact --[:BELONGS_TO_CASE]--> Case
```

This allows any fact to be traced back to its source document and owning case,
including the specific page and line where it was found. The direct
`BELONGS_TO_CASE` edge enables efficient case-level fact queries without
intermediate traversal.

---

## 6. Graph Integrity Constraints

### 6.1 Uniqueness Constraints

```cypher
-- Every case_id is globally unique
CREATE CONSTRAINT unique_case_id IF NOT EXISTS
FOR (c:Case) REQUIRE c.case_id IS UNIQUE;

-- Every fact_id is globally unique
CREATE CONSTRAINT unique_fact_id IF NOT EXISTS
FOR (f:Fact) REQUIRE f.fact_id IS UNIQUE;

-- Every evidence_id is globally unique
CREATE CONSTRAINT unique_evidence_id IF NOT EXISTS
FOR (e:Evidence) REQUIRE e.evidence_id IS UNIQUE;

-- Every document_id is globally unique
CREATE CONSTRAINT unique_document_id IF NOT EXISTS
FOR (d:Document) REQUIRE d.document_id IS UNIQUE;

-- Every entity_id is globally unique
CREATE CONSTRAINT unique_entity_id IF NOT EXISTS
FOR (e:Entity) REQUIRE e.entity_id IS UNIQUE;

-- Every event_id is globally unique
CREATE CONSTRAINT unique_event_id IF NOT EXISTS
FOR (e:Event) REQUIRE e.event_id IS UNIQUE;

-- Every location_id is globally unique
CREATE CONSTRAINT unique_location_id IF NOT EXISTS
FOR (l:Location) REQUIRE l.location_id IS UNIQUE;

-- Every person_id is globally unique
CREATE CONSTRAINT unique_person_id IF NOT EXISTS
FOR (p:Person) REQUIRE p.person_id IS UNIQUE;

-- Every organization_id is globally unique
CREATE CONSTRAINT unique_organization_id IF NOT EXISTS
FOR (o:Organization) REQUIRE o.organization_id IS UNIQUE;

-- Every statement_id is globally unique
CREATE CONSTRAINT unique_statement_id IF NOT EXISTS
FOR (s:Statement) REQUIRE s.statement_id IS UNIQUE;

-- Every timeline_event_id is globally unique
CREATE CONSTRAINT unique_timeline_event_id IF NOT EXISTS
FOR (t:TimelineEvent) REQUIRE t.timeline_event_id IS UNIQUE;
```

### 6.2 Property Existence Constraints

```cypher
-- tenant_id is REQUIRED on every node type
CREATE CONSTRAINT case_tenant_id IF NOT EXISTS
FOR (c:Case) REQUIRE c.tenant_id IS NOT NULL;

CREATE CONSTRAINT fact_tenant_id IF NOT EXISTS
FOR (f:Fact) REQUIRE f.tenant_id IS NOT NULL;

CREATE CONSTRAINT evidence_tenant_id IF NOT EXISTS
FOR (e:Evidence) REQUIRE e.tenant_id IS NOT NULL;

CREATE CONSTRAINT document_tenant_id IF NOT EXISTS
FOR (d:Document) REQUIRE d.tenant_id IS NOT NULL;

CREATE CONSTRAINT entity_tenant_id IF NOT EXISTS
FOR (e:Entity) REQUIRE e.tenant_id IS NOT NULL;

CREATE CONSTRAINT event_tenant_id IF NOT EXISTS
FOR (e:Event) REQUIRE e.tenant_id IS NOT NULL;

CREATE CONSTRAINT location_tenant_id IF NOT EXISTS
FOR (l:Location) REQUIRE l.tenant_id IS NOT NULL;

CREATE CONSTRAINT person_tenant_id IF NOT EXISTS
FOR (p:Person) REQUIRE p.tenant_id IS NOT NULL;

CREATE CONSTRAINT organization_tenant_id IF NOT EXISTS
FOR (o:Organization) REQUIRE o.tenant_id IS NOT NULL;

CREATE CONSTRAINT statement_tenant_id IF NOT EXISTS
FOR (s:Statement) REQUIRE s.tenant_id IS NOT NULL;

CREATE CONSTRAINT timeline_event_tenant_id IF NOT EXISTS
FOR (t:TimelineEvent) REQUIRE t.tenant_id IS NOT NULL;
```

### 6.3 Hash Integrity Constraints

```cypher
-- Dual-hash fields are REQUIRED on all content-addressed nodes
CREATE CONSTRAINT fact_sha256 IF NOT EXISTS
FOR (f:Fact) REQUIRE f.sha256 IS NOT NULL;

CREATE CONSTRAINT fact_sha3_256 IF NOT EXISTS
FOR (f:Fact) REQUIRE f.sha3_256 IS NOT NULL;

CREATE CONSTRAINT evidence_sha256 IF NOT EXISTS
FOR (e:Evidence) REQUIRE e.sha256 IS NOT NULL;

CREATE CONSTRAINT evidence_sha3_256 IF NOT EXISTS
FOR (e:Evidence) REQUIRE e.sha3_256 IS NOT NULL;

CREATE CONSTRAINT document_sha256 IF NOT EXISTS
FOR (d:Document) REQUIRE d.sha256 IS NOT NULL;

CREATE CONSTRAINT document_sha3_256 IF NOT EXISTS
FOR (d:Document) REQUIRE d.sha3_256 IS NOT NULL;
```

---

## 7. Indexing Strategy

### 7.1 Primary Lookup Indexes

```cypher
-- Fast lookup by primary ID for each node type
CREATE INDEX idx_case_id IF NOT EXISTS FOR (c:Case) ON (c.case_id);
CREATE INDEX idx_fact_id IF NOT EXISTS FOR (f:Fact) ON (f.fact_id);
CREATE INDEX idx_evidence_id IF NOT EXISTS FOR (e:Evidence) ON (e.evidence_id);
CREATE INDEX idx_document_id IF NOT EXISTS FOR (d:Document) ON (d.document_id);
CREATE INDEX idx_entity_id IF NOT EXISTS FOR (e:Entity) ON (e.entity_id);
CREATE INDEX idx_event_id IF NOT EXISTS FOR (e:Event) ON (e.event_id);
CREATE INDEX idx_location_id IF NOT EXISTS FOR (l:Location) ON (l.location_id);
CREATE INDEX idx_person_id IF NOT EXISTS FOR (p:Person) ON (p.person_id);
CREATE INDEX idx_organization_id IF NOT EXISTS FOR (o:Organization) ON (o.organization_id);
CREATE INDEX idx_statement_id IF NOT EXISTS FOR (s:Statement) ON (s.statement_id);
CREATE INDEX idx_timeline_event_id IF NOT EXISTS FOR (t:TimelineEvent) ON (t.timeline_event_id);
```

### 7.2 Tenant-Scoped Indexes

```cypher
-- Composite indexes for tenant-scoped queries (most common access pattern)
CREATE INDEX idx_case_tenant IF NOT EXISTS FOR (c:Case) ON (c.tenant_id);
CREATE INDEX idx_fact_tenant_case IF NOT EXISTS FOR (f:Fact) ON (f.tenant_id, f.case_id);
CREATE INDEX idx_evidence_tenant_case IF NOT EXISTS FOR (e:Evidence) ON (e.tenant_id, e.case_id);
CREATE INDEX idx_document_tenant_case IF NOT EXISTS FOR (d:Document) ON (d.tenant_id, d.case_id);
CREATE INDEX idx_event_tenant_case IF NOT EXISTS FOR (e:Event) ON (e.tenant_id, e.case_id);
CREATE INDEX idx_statement_tenant_case IF NOT EXISTS FOR (s:Statement) ON (s.tenant_id, s.case_id);
CREATE INDEX idx_timeline_tenant_case IF NOT EXISTS FOR (t:TimelineEvent) ON (t.tenant_id, t.case_id);
```

### 7.3 Entity Resolution Indexes

```cypher
-- Name-based lookups for entity resolution
CREATE INDEX idx_person_canonical_name IF NOT EXISTS FOR (p:Person) ON (p.tenant_id, p.canonical_name);
CREATE INDEX idx_entity_canonical_name IF NOT EXISTS FOR (e:Entity) ON (e.tenant_id, e.canonical_name);
CREATE INDEX idx_organization_canonical_name IF NOT EXISTS FOR (o:Organization) ON (o.tenant_id, o.canonical_name);
CREATE INDEX idx_location_canonical_name IF NOT EXISTS FOR (l:Location) ON (l.tenant_id, l.canonical_name);
```

### 7.4 Temporal Indexes

```cypher
-- Temporal queries for timeline construction
CREATE INDEX idx_event_occurred_at IF NOT EXISTS FOR (e:Event) ON (e.tenant_id, e.occurred_at);
CREATE INDEX idx_timeline_occurred_at IF NOT EXISTS FOR (t:TimelineEvent) ON (t.tenant_id, t.occurred_at);
CREATE INDEX idx_fact_extracted_at IF NOT EXISTS FOR (f:Fact) ON (f.tenant_id, f.extracted_at);
```

### 7.5 Hash Verification Indexes

```cypher
-- Hash-based lookups for integrity verification
CREATE INDEX idx_fact_sha256 IF NOT EXISTS FOR (f:Fact) ON (f.sha256);
CREATE INDEX idx_evidence_sha256 IF NOT EXISTS FOR (e:Evidence) ON (e.sha256);
CREATE INDEX idx_document_sha256 IF NOT EXISTS FOR (d:Document) ON (d.sha256);
```

---

## 8. Example Cypher Queries

### 8.1 Get All Evidence for a Case

```cypher
MATCH (c:Case {case_id: $caseId, tenant_id: $tenantId})-[:HAS_EVIDENCE]->(e:Evidence)
RETURN e.evidence_id, e.name, e.type, e.ingested_at
ORDER BY e.ingested_at ASC
```

### 8.2 Get All Facts for a Case (via BELONGS_TO_CASE)

```cypher
MATCH (c:Case {case_id: $caseId, tenant_id: $tenantId})<-[:BELONGS_TO_CASE]-(f:Fact)
RETURN f.fact_id, f.content, f.source_document, f.source_page, f.extraction_method
ORDER BY f.extracted_at ASC
```

### 8.3 Full Provenance Chain for a Fact

```cypher
MATCH (f:Fact {fact_id: $factId, tenant_id: $tenantId})
OPTIONAL MATCH (f)-[r:EXTRACTED_FROM]->(d:Document)
OPTIONAL MATCH (c:Case)-[:HAS_DOCUMENT]->(d)
RETURN f.fact_id, f.content, f.source_page, f.source_line,
       d.document_id, d.name, d.document_type,
       c.case_id, c.case_number, c.jurisdiction,
       r.extraction_method
```

### 8.4 Find Contradicting Facts

```cypher
MATCH (f1:Fact {tenant_id: $tenantId, case_id: $caseId})
      -[c:CONTRADICTS]->
      (f2:Fact {tenant_id: $tenantId})
RETURN f1.fact_id, f1.content,
       f2.fact_id, f2.content,
       c.contradiction_type
ORDER BY f1.extracted_at ASC
```

### 8.5 Build Case Timeline (via Case root)

```cypher
MATCH (c:Case {case_id: $caseId, tenant_id: $tenantId})-[:HAS_TIMELINE]->(te:TimelineEvent)
OPTIONAL MATCH (te)-[:EVIDENCED_BY]->(f:Fact)
RETURN te.timeline_event_id, te.title, te.description,
       te.occurred_at, te.category,
       collect(f.fact_id) AS supporting_facts
ORDER BY te.occurred_at ASC
```

### 8.6 Entity Involvement Graph

```cypher
MATCH (p:Person {tenant_id: $tenantId, person_id: $personId})
OPTIONAL MATCH (f:Fact)-[:INVOLVES]->(p)
OPTIONAL MATCH (p)-[:PARTICIPATED_IN]->(ev:Event)
OPTIONAL MATCH (s:Statement)-[:ATTRIBUTED_TO]->(p)
RETURN p.display_name, p.role,
       collect(DISTINCT f.fact_id) AS involved_facts,
       collect(DISTINCT ev.event_id) AS participated_events,
       collect(DISTINCT s.statement_id) AS attributed_statements
```

### 8.7 Cross-Document Fact Support Network

```cypher
MATCH (f1:Fact {tenant_id: $tenantId, case_id: $caseId})
      -[s:SUPPORTS]->
      (f2:Fact {tenant_id: $tenantId})
WHERE f1.source_document <> f2.source_document
RETURN f1.fact_id, f1.source_document,
       f2.fact_id, f2.source_document,
       s.support_type
```

### 8.8 Verify Fact Hash Integrity

```cypher
MATCH (f:Fact {tenant_id: $tenantId, case_id: $caseId})
WHERE f.sha256 IS NULL OR f.sha3_256 IS NULL
RETURN f.fact_id, f.sha256, f.sha3_256
```

### 8.9 Officer Cross-Case Document References

```cypher
MATCH (p:Person {tenant_id: $tenantId, role: 'officer'})
OPTIONAL MATCH (f:Fact)-[:INVOLVES]->(p)
OPTIONAL MATCH (f)-[:EXTRACTED_FROM]->(d:Document)
WITH p, collect(DISTINCT d.document_id) AS docs, collect(DISTINCT f.case_id) AS cases
RETURN p.display_name, p.badge_id,
       size(docs) AS document_count,
       size(cases) AS case_count
ORDER BY document_count DESC
```

---

## 9. Deterministic Constraints

The following guarantees protect Phase 1 Deterministic Processing and
Phase 3 Multi-Tenant Isolation.

| Constraint | Rule |
|---|---|
| **All node IDs are deterministic** | Every `*_id` is derived from SHA-256 of canonical content JSON (except `case_id` which is a UUID assigned at creation). Given identical input, the same ID is produced. |
| **All relationships are deterministic** | Relationship creation is idempotent. Re-processing the same source data produces the same graph topology. No random or timestamp-seeded edges. |
| **All queries are tenant-scoped** | Every query MUST filter by `tenant_id`. Cross-tenant traversal is architecturally forbidden. The database enforces `tenant_id IS NOT NULL` on every node label. |
| **No probability, no scoring** | Graph nodes carry no confidence scores, no ranking weights, no anomaly scores. All integrity checks are binary PASS/FAIL. |
| **Append-only facts** | Facts are never mutated or deleted. Corrections create new Facts linked via `[:SUPERSEDES]`. |
| **Case-rooted containment** | Every evidence subgraph is reachable from exactly one `Case` node. Orphan subgraphs are integrity violations detected by the nightly checker. |

---

## Appendix: Node Label Summary

| Label | Primary Key | Tenant-Isolated | Dual-Hashed | Immutable |
|---|---|---|---|---|
| `Case` | `case_id` | Yes | No | Partial |
| `Evidence` | `evidence_id` | Yes | Yes | Yes (content) |
| `Document` | `document_id` | Yes | Yes | Partial |
| `Fact` | `fact_id` | Yes | Yes | Yes (full) |
| `Entity` | `entity_id` | Yes | Yes | Partial |
| `Event` | `event_id` | Yes | Yes | Yes (full) |
| `Location` | `location_id` | Yes | Yes | Partial |
| `Person` | `person_id` | Yes | Yes | Partial |
| `Organization` | `organization_id` | Yes | Yes | Partial |
| `Statement` | `statement_id` | Yes | Yes | Yes (full) |
| `TimelineEvent` | `timeline_event_id` | Yes | Yes | Partial |

**Immutability key:**
- **Yes (full):** No property may be updated after creation.
- **Yes (content):** Content-hash fields and source fields are immutable; metadata fields (name, status) may be updated.
- **Partial:** ID, tenant_id, and hash fields are immutable; display/metadata fields may be updated.
