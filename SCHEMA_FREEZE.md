# Schema Freeze Policy — Court Access Platform

**Effective:** Post-stabilization-v1 tag  
**Status:** ACTIVE  
**Scope:** All database schemas (Prisma/PostgreSQL, Neo4j graph labels/properties)

---

## Policy

After the Phase 120-150 expansion, the database schema is **temporarily frozen**.

No schema changes are permitted unless they meet one of the following criteria:

### Allowed Changes
1. **Bug fixes** — Schema changes required to fix data corruption or runtime errors
2. **Stability fixes** — Changes needed to prevent crashes, data loss, or integrity violations
3. **Data integrity** — Changes required to enforce referential integrity or fix constraint violations

### Prohibited Changes
- New tables or models for feature development
- New columns for feature flags or UI state
- Index changes for performance optimization (unless preventing outages)
- Renaming columns or tables (unless fixing a verified bug)
- Adding new Neo4j node labels or relationship types for features

### Approval Process
1. Author documents the schema change and justification
2. Change must reference a specific bug report or stability incident
3. Migration must be reversible (include both up and down migrations)
4. Review by system architect required before merge

### Duration
This freeze remains in effect until the Platform Stabilization Wave is complete and all of the following are verified:
- [ ] Worker queue safeguards are operational
- [ ] Graph integrity validator passes nightly with zero issues
- [ ] System health endpoint reports all components healthy
- [ ] Deterministic replay test passes consistently
- [ ] No critical alerts from queue monitoring for 7 consecutive days

### Enforcement
- PR reviews must check for schema changes
- Any Prisma migration files in a PR require explicit freeze-exception approval
- Neo4j Cypher scripts that CREATE or ALTER labels/properties require review

---

*This policy was established as part of Wave 0 Stabilization to prevent migration chaos after rapid feature expansion.*
