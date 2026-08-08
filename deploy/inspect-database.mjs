#!/usr/bin/env node
// ============================================================================
// CourtAccess — production database inspection. READ ONLY, and enforced.
//
// Every statement runs inside BEGIN TRANSACTION READ ONLY, so PostgreSQL
// itself rejects any write. This is not a promise that the script behaves;
// it is the server refusing to let it misbehave. The transaction is rolled
// back at the end, never committed.
//
//   cd <release directory>        # needs ./node_modules and a .env
//   node deploy/inspect-database.mjs
//
// Prints a report to stdout. Sends nothing anywhere. Writes no files.
// ============================================================================

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// `pg` ships in the release's node_modules, but Node resolves imports relative
// to this file rather than the working directory, and this file may be run from
// anywhere. Search the obvious roots instead of insisting on a layout.
const CANDIDATE_ROOTS = [
  process.cwd(),
  path.join(process.cwd(), 'backend'),
  '/var/www/courtaccess',
  '/var/www/courtaccess/backend',
];

let pg = null;
const tried = [];
for (const root of CANDIDATE_ROOTS) {
  const probe = path.join(root, 'node_modules', 'pg', 'package.json');
  tried.push(root);
  try {
    pg = (await import(createRequire(probe).resolve('pg'))).default;
    break;
  } catch { /* try the next root */ }
}
if (!pg) {
  console.error("Could not load the 'pg' client. Looked under:");
  tried.forEach((t) => console.error(`  ${t}/node_modules`));
  console.error('\nRun this from a directory that has node_modules — the release');
  console.error('directory, or /var/www/courtaccess.');
  process.exit(2);
}

// The Release Candidate's schema: 115 tables and the column count of each,
// captured from a database built by `prisma migrate deploy` off this branch.
const EXPECTED = {
  "Charge": 8,
  "agencies": 19,
  "agency_policy_matrix": 12,
  "agency_policy_status": 17,
  "ai_credit_balances": 9,
  "ai_credit_usage": 7,
  "approval_requests": 13,
  "attorney_notes": 11,
  "camera_sync_results": 9,
  "case_hearings": 10,
  "case_messages": 8,
  "case_stage_events": 9,
  "case_statute_snapshots": 6,
  "case_witnesses": 15,
  "certification_cases": 19,
  "certification_files": 20,
  "certification_runs": 10,
  "certification_upload_sessions": 20,
  "charge_audit_events": 13,
  "charge_defendants": 6,
  "charging_documents": 22,
  "claim_validations": 12,
  "client_team_assignments": 11,
  "clients": 24,
  "compliance_audit_trail": 10,
  "compliance_findings": 18,
  "compliance_review_queue": 11,
  "conflict_records": 11,
  "corpus_ingestion_lock": 6,
  "corpus_ingestion_log": 8,
  "corpus_ingestion_state": 10,
  "corpus_registry": 13,
  "cpra_agency_requests": 14,
  "cpra_annual_updates": 13,
  "cpra_email_attachments": 13,
  "cpra_email_log": 13,
  "cpra_notifications": 9,
  "cpra_request_campaigns": 4,
  "cpra_request_log": 13,
  "cpra_requests_v2": 9,
  "cpra_timeline_events": 7,
  "criminal_cases": 19,
  "cross_agency_comparisons": 11,
  "demo_requests": 11,
  "disclosure_packages": 12,
  "discount_codes": 11,
  "discount_usages": 4,
  "document_copies": 12,
  "document_redaction_versions": 13,
  "email_verification_tokens": 6,
  "enterprise_licenses": 13,
  "evidence": 24,
  "evidence_chunks": 10,
  "evidence_events": 12,
  "evidence_graphs": 9,
  "evidence_links": 8,
  "evidence_request_responses": 7,
  "evidence_requests": 12,
  "expert_witness_packages": 14,
  "field_notes": 13,
  "filed_charges": 30,
  "government_leads": 12,
  "impeachment_candidates": 13,
  "investigation_assignments": 8,
  "investigation_leads": 13,
  "investigation_tasks": 14,
  "jury_visualizations": 11,
  "knowledge_assets": 11,
  "legal_documents": 23,
  "legislative_extraction_audit": 15,
  "legislative_sync_events": 8,
  "line_of_sight_analyses": 12,
  "marketing_events": 6,
  "narrative_claims": 15,
  "normalized_claim_events": 14,
  "official_statutes": 18,
  "org_internal_messages": 9,
  "org_tasks": 14,
  "organization_departments": 7,
  "organization_invitations": 12,
  "organization_members": 12,
  "organization_offices": 13,
  "organizations": 16,
  "password_reset_tokens": 6,
  "permission_grants": 10,
  "personnel_profiles": 15,
  "policy_action_mappings": 7,
  "policy_coverage": 9,
  "policy_documents": 20,
  "policy_evolution": 10,
  "policy_inventory": 14,
  "policy_rules": 14,
  "policy_topic_coverage": 6,
  "policy_topics": 9,
  "practice_groups": 8,
  "processing_jobs": 14,
  "publication_audit_logs": 9,
  "publication_set_items": 5,
  "publication_sets": 9,
  "refresh_tokens": 12,
  "scene_geometries": 14,
  "schema_versions": 8,
  "security_logs": 6,
  "stripe_webhook_events": 4,
  "subscriptions": 14,
  "timeline_events": 19,
  "trajectory_analyses": 10,
  "trial_exhibit_scenes": 17,
  "usage_tracking": 9,
  "user_account_settings": 12,
  "users": 17,
  "verified_facts": 13,
  "visibility_simulations": 11,
  "vision_events": 13,
  "workbench_pins": 9,
};

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const f of ['.env', '/var/www/courtaccess/.env']) {
    try {
      const m = readFileSync(f, 'utf8').match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?/m);
      if (m) return m[1].trim();
    } catch { /* try the next one */ }
  }
  return null;
}

const mask = (u) => u.replace(/(\/\/[^:]+):[^@]*@/, '$1:***@');
const h = (s) => console.log(`\n${'='.repeat(70)}\n${s}\n${'='.repeat(70)}`);
const kv = (k, v) => console.log(`  ${String(k).padEnd(30)} ${v}`);

const url = loadDatabaseUrl();
if (!url) {
  console.error('DATABASE_URL not found in the environment, ./.env, or /var/www/courtaccess/.env');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 15000 });
const q = async (sql, args = []) => (await client.query(sql, args)).rows;

try {
  await client.connect();
} catch (e) {
  console.error(`CONNECTION FAILED: ${e.message}`);
  console.error(`  url: ${mask(url)}`);
  process.exit(2);
}

// Everything below happens inside a read-only transaction. Any write — by this
// script or by anything it calls — fails with error 25006.
await client.query('BEGIN TRANSACTION READ ONLY');

let exitCode = 0;

try {
  h('PHASE 1 — DATABASE DISCOVERY');
  kv('connection url', mask(url));
  const [s] = await q(`
    select version() as version,
           current_database() as db, current_user as cur_user, session_user as sess_user,
           current_schema() as schema, current_setting('search_path') as search_path,
           inet_server_addr()::text as server_addr, inet_server_port() as server_port,
           pg_is_in_recovery() as is_replica`);
  kv('server version', s.version.split(',')[0]);
  kv('database name', s.db);
  kv('current user', s.cur_user);
  kv('session user', s.sess_user);
  kv('current schema', s.schema);
  kv('search path', s.search_path);
  kv('server address', s.server_addr ?? 'local socket (same host)');
  kv('server port', s.server_port ?? 'n/a');
  kv('read replica', s.is_replica ? 'YES — this is a standby' : 'no');

  const [d] = await q(`
    select pg_size_pretty(pg_database_size(current_database())) as size,
           pg_get_userbyid(datdba) as owner,
           pg_encoding_to_char(encoding) as encoding,
           datcollate, datctype
    from pg_database where datname = current_database()`);
  kv('database size', d.size);
  kv('database owner', d.owner);
  kv('encoding', d.encoding);
  kv('collation', `${d.datcollate} / ${d.datctype}`);

  h('PHASE 1 — OBJECT COUNTS');
  const [o] = await q(`
    select (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tables,
           (select count(*) from pg_indexes where schemaname='public') as indexes,
           (select count(*) from information_schema.views where table_schema='public') as views,
           (select count(*) from pg_matviews where schemaname='public') as matviews,
           (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') as functions,
           (select count(*) from pg_trigger where not tgisinternal) as triggers,
           (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='public' and c.contype='f') as fkeys,
           (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype='e') as enums`);
  for (const [k, v] of Object.entries(o)) kv(k, v);
  kv('expected by the RC', 'tables 115 (+_prisma_migrations), indexes 484, fkeys 53, views/matviews/functions/triggers/enums 0');

  const ext = await q(`select extname, extversion from pg_extension order by extname`);
  kv('extensions', ext.map((e) => `${e.extname} ${e.extversion}`).join(', ') || 'none');

  const conns = await q(`
    select coalesce(state,'(none)') as state, count(*)::int as n
    from pg_stat_activity where datname = current_database() group by 1 order by 2 desc`);
  kv('connections', conns.map((c) => `${c.state}=${c.n}`).join(', '));

  h('PHASE 2 — PRISMA STATE');
  const [{ present }] = await q(`select to_regclass('public._prisma_migrations') is not null as present`);
  kv('_prisma_migrations exists', present ? 'YES' : 'NO');

  if (present) {
    const [m] = await q(`
      select count(*)::int as total,
             count(*) filter (where finished_at is not null)::int as applied,
             count(*) filter (where finished_at is null and rolled_back_at is null)::int as unfinished,
             count(*) filter (where rolled_back_at is not null)::int as rolled_back
      from _prisma_migrations`);
    kv('total recorded', m.total);
    kv('applied', `${m.applied} of 30 expected`);
    kv('unfinished', m.unfinished + (m.unfinished ? '  <-- BLOCKS DEPLOYMENT' : ''));
    kv('rolled back', m.rolled_back + (m.rolled_back ? '  <-- BLOCKS DEPLOYMENT' : ''));

    const rows = await q(`
      select migration_name, finished_at, rolled_back_at
      from _prisma_migrations order by started_at`);
    console.log('\n  migrations, oldest first:');
    for (const r of rows) {
      const state = r.rolled_back_at ? 'ROLLED BACK' : r.finished_at ? 'applied' : 'UNFINISHED';
      console.log(`    ${state.padEnd(12)} ${r.migration_name}`);
    }
    if (rows.length) kv('\n  latest', rows[rows.length - 1].migration_name);
  }

  h('PHASE 3 — SCHEMA COMPARISON AGAINST THE RELEASE CANDIDATE');
  const live = await q(`
    select t.table_name as name, count(c.column_name)::int as cols
    from information_schema.tables t
    join information_schema.columns c
      on c.table_schema = t.table_schema and c.table_name = t.table_name
    where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
    group by 1`);
  const liveMap = new Map(live.map((r) => [r.name, r.cols]));

  const missing = Object.keys(EXPECTED).filter((t) => !liveMap.has(t)).sort();
  const extra = [...liveMap.keys()].filter((t) => t !== '_prisma_migrations' && !(t in EXPECTED)).sort();
  const shortCols = Object.entries(EXPECTED)
    .filter(([t, n]) => liveMap.has(t) && liveMap.get(t) < n)
    .map(([t, n]) => `${t} (has ${liveMap.get(t)}, RC needs ${n})`)
    .sort();

  kv('tables the RC needs', Object.keys(EXPECTED).length);
  kv('present', Object.keys(EXPECTED).length - missing.length);
  kv('MISSING', missing.length);
  kv('tables not in the RC schema', extra.length);
  kv('tables with too few columns', shortCols.length);

  const show = (label, arr, limit = 25) => {
    if (!arr.length) return;
    console.log(`\n  ${label} (${arr.length}):`);
    arr.slice(0, limit).forEach((x) => console.log(`    - ${x}`));
    if (arr.length > limit) console.log(`    … and ${arr.length - limit} more`);
  };
  show('MISSING tables', missing);
  show('tables present that the RC does not define', extra);
  show('tables missing columns', shortCols);

  h('SUMMARY');
  const empty = liveMap.size === 0;
  if (empty) {
    kv('state', 'EMPTY DATABASE');
  } else if (present && missing.length === 0 && shortCols.length === 0) {
    kv('state', 'PRISMA-MANAGED, SCHEMA COMPLETE');
  } else if (present) {
    kv('state', 'PRISMA-MANAGED, SCHEMA INCOMPLETE');
  } else {
    kv('state', 'POPULATED BUT NOT PRISMA-MANAGED');
    exitCode = 1;
  }
  kv('tables missing', missing.length);
  kv('unfinished migrations', present ? (await q(`select count(*) filter (where finished_at is null and rolled_back_at is null)::int as n from _prisma_migrations`))[0].n : 'n/a');
  console.log('\n  Send this entire output back. Do not act on it yet.');
} catch (e) {
  console.error(`\nQUERY FAILED: ${e.message}`);
  if (e.code === '25006') console.error('  (read-only transaction refused a write — that is the guard working)');
  exitCode = 2;
} finally {
  // Never commit. There is nothing to commit, and rollback proves it.
  await client.query('ROLLBACK');
  await client.end();
}

process.exit(exitCode);
