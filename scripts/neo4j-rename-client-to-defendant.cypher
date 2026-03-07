// ============================================
// Court Access — Neo4j Graph Migration
// Rename :Client node label to :Defendant
//
// This migration:
//   1. Adds :Defendant label to all :Client nodes
//   2. Removes :Client label
//   3. Preserves all properties and edges
//
// Run via neo4j-shell or cypher-shell:
//   cypher-shell -f scripts/neo4j-rename-client-to-defendant.cypher
//
// Safe to run multiple times (idempotent).
// ============================================

// Step 1: Add :Defendant label to all existing :Client nodes
MATCH (c:Client)
SET c:Defendant
REMOVE c:Client
RETURN count(c) AS migratedNodes;

// Step 2: Verify no :Client nodes remain
MATCH (c:Client)
RETURN count(c) AS remainingClientNodes;
// Expected: 0
