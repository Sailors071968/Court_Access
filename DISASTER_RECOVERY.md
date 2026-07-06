# CourtAccess Disaster Recovery Plan

## Phase 189 — Backup & Recovery Procedures

Generated: 2026-03-10

---

## 1. Overview

This document defines backup procedures, recovery strategies, and business continuity plans for the CourtAccess platform. All evidence data, policy documents, and compliance findings are legally sensitive and must be preserved with chain-of-custody integrity.

**Recovery Time Objective (RTO)**: 4 hours
**Recovery Point Objective (RPO)**: 1 hour (maximum data loss window)

---

## 2. Database Backup

### 2.1 Automated Daily Backups

#### AWS RDS (Recommended)
```bash
# RDS automated backups — configure in AWS Console
# Retention: 35 days
# Backup window: 03:00-04:00 UTC daily
# Multi-AZ: Enabled for production

# Manual snapshot before major deployments
aws rds create-db-snapshot \
  --db-instance-identifier courtaccess-prod \
  --db-snapshot-identifier courtaccess-pre-deploy-$(date +%Y%m%d)
```

#### Self-Hosted PostgreSQL
```bash
#!/bin/bash
# /opt/courtaccess/scripts/backup-database.sh
# Run via cron: 0 3 * * * /opt/courtaccess/scripts/backup-database.sh

BACKUP_DIR="/opt/courtaccess/backups/database"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/courtaccess_$TIMESTAMP.sql.gz"

mkdir -p $BACKUP_DIR

# Create compressed backup
pg_dump -h localhost -U courtaccess_user -d courtaccess | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://courtaccess-backups/database/$TIMESTAMP.sql.gz

# Retain local backups for 7 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "$(date): Database backup completed: $BACKUP_FILE" >> /var/log/courtaccess-backup.log
```

### 2.2 Point-in-Time Recovery (PITR)

#### AWS RDS
- Enable continuous backup with PITR
- Restore to any point within the retention window (up to 35 days)
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier courtaccess-prod \
  --target-db-instance-identifier courtaccess-recovery \
  --restore-time 2026-03-10T12:00:00Z
```

#### Self-Hosted PostgreSQL
```bash
# Enable WAL archiving in postgresql.conf
# archive_mode = on
# archive_command = 'cp %p /opt/courtaccess/backups/wal/%f'
# wal_level = replica

# Restore from base backup + WAL replay
pg_basebackup -h localhost -U courtaccess_user -D /opt/courtaccess/recovery/data
```

### 2.3 Critical Tables

Priority tables for recovery (in order):
1. **ComplianceFinding** — Legal findings with evidence links
2. **EvidenceEvent** — Timestamped evidence records
3. **EvidenceLink** — Finding-to-evidence associations
4. **ComplianceAuditTrail** — Audit history (legally required)
5. **ComplianceReviewQueue** — Review status tracking
6. **PolicyRule** — Agency policy rules
7. **PolicyDocument** — Ingested policy documents
8. **Agency** — Agency registry
9. **ExpertWitnessPackage** — Generated expert reports
10. **JuryVisualization** — Generated jury presentations

---

## 3. Policy Document Backup

### 3.1 S3 Storage Backup

```bash
#!/bin/bash
# /opt/courtaccess/scripts/backup-policy-documents.sh
# Run via cron: 0 4 * * * /opt/courtaccess/scripts/backup-policy-documents.sh

# Sync policy documents to backup bucket
aws s3 sync \
  s3://courtaccess-policy-documents/ \
  s3://courtaccess-backups/policy-documents/ \
  --storage-class STANDARD_IA

# Enable versioning on primary bucket
aws s3api put-bucket-versioning \
  --bucket courtaccess-policy-documents \
  --versioning-configuration Status=Enabled

echo "$(date): Policy document backup completed" >> /var/log/courtaccess-backup.log
```

### 3.2 Cross-Region Replication
```bash
# Enable cross-region replication for policy documents
# Primary: us-west-2
# Replica: us-east-1
aws s3api put-bucket-replication \
  --bucket courtaccess-policy-documents \
  --replication-configuration file://replication-config.json
```

### 3.3 Document Integrity Verification
```bash
#!/bin/bash
# Verify document integrity using stored hashes
# PolicyDocument.documentHash contains SHA-256 hash of each document

# Query database for document hashes
psql -h $DB_HOST -U courtaccess_user -d courtaccess \
  -c "SELECT \"documentId\", \"documentHash\", \"sourceUrl\" FROM policy_documents" \
  -t -A > /tmp/document_hashes.csv

# Verify each document in S3 matches its stored hash
while IFS='|' read -r id hash url; do
  s3_hash=$(aws s3api head-object \
    --bucket courtaccess-policy-documents \
    --key "documents/$id" \
    --query 'Metadata.sha256' --output text 2>/dev/null)
  if [ "$hash" != "$s3_hash" ]; then
    echo "INTEGRITY MISMATCH: Document $id — expected $hash, got $s3_hash"
  fi
done < /tmp/document_hashes.csv
```

---

## 4. Evidence Storage Backup

### 4.1 Evidence File Backup
```bash
#!/bin/bash
# /opt/courtaccess/scripts/backup-evidence.sh
# Run via cron: 0 5 * * * /opt/courtaccess/scripts/backup-evidence.sh

# Sync evidence files to backup bucket with encryption
aws s3 sync \
  s3://courtaccess-evidence/ \
  s3://courtaccess-backups/evidence/ \
  --sse aws:kms \
  --sse-kms-key-id alias/courtaccess-evidence-key \
  --storage-class GLACIER_IR

echo "$(date): Evidence backup completed" >> /var/log/courtaccess-backup.log
```

### 4.2 Evidence Encryption
- All evidence files encrypted at rest using AWS KMS
- Encryption key rotation: Every 365 days (automatic)
- Access logging enabled via AWS CloudTrail

### 4.3 Chain-of-Custody Preservation
- Evidence backup includes metadata (upload time, uploader, hash)
- Backup process logs are immutable (append-only)
- Cross-reference with ComplianceAuditTrail records

---

## 5. Application State Backup

### 5.1 Configuration Backup
```bash
#!/bin/bash
# Backup application configuration (excluding secrets)
BACKUP_DIR="/opt/courtaccess/backups/config"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup non-secret config files
tar -czf $BACKUP_DIR/config_$TIMESTAMP.tar.gz \
  /opt/courtaccess/ecosystem.config.js \
  /etc/nginx/sites-available/courtaccess \
  /opt/courtaccess/backend/prisma/schema.prisma

aws s3 cp $BACKUP_DIR/config_$TIMESTAMP.tar.gz \
  s3://courtaccess-backups/config/$TIMESTAMP.tar.gz
```

### 5.2 Prisma Schema Backup
- Schema file is version-controlled in Git
- Migration history preserved in `backend/prisma/migrations/`
- Always run `prisma migrate deploy` (never `prisma db push`) in production

---

## 6. Recovery Procedures

### 6.1 Full System Recovery

**Estimated Time: 2-4 hours**

```bash
# Step 1: Provision new server (if needed)
# Use infrastructure-as-code or manual setup per DEPLOYMENT_RUNBOOK.md

# Step 2: Restore database
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier courtaccess-prod \
  --target-db-instance-identifier courtaccess-recovery \
  --restore-time <TARGET_TIMESTAMP>

# Step 3: Deploy application
cd /opt/courtaccess
git checkout <LAST_KNOWN_GOOD_COMMIT>
cd backend && npm install && npx prisma generate && npx tsc
cd .. && npm install && npm run build

# Step 4: Update DATABASE_URL to point to recovery instance
# Edit backend/.env

# Step 5: Start services
pm2 start ecosystem.config.js --env production

# Step 6: Verify
curl https://api.your-domain.com/api/health
```

### 6.2 Database-Only Recovery

**Estimated Time: 30-60 minutes**

```bash
# For RDS: Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier courtaccess-recovery \
  --db-snapshot-identifier <SNAPSHOT_ID>

# For self-hosted: Restore from backup
gunzip < /opt/courtaccess/backups/database/courtaccess_YYYYMMDD.sql.gz | \
  psql -h localhost -U courtaccess_user -d courtaccess

# Verify data integrity
psql -h $DB_HOST -U courtaccess_user -d courtaccess \
  -c "SELECT COUNT(*) FROM compliance_findings;"
psql -h $DB_HOST -U courtaccess_user -d courtaccess \
  -c "SELECT COUNT(*) FROM evidence_events;"
```

### 6.3 Evidence File Recovery

**Estimated Time: 1-2 hours (depending on volume)**

```bash
# Restore from S3 backup
aws s3 sync \
  s3://courtaccess-backups/evidence/ \
  s3://courtaccess-evidence/ \
  --sse aws:kms \
  --sse-kms-key-id alias/courtaccess-evidence-key

# Verify file integrity against database hashes
# Run integrity verification script (Section 3.3)
```

### 6.4 Partial Data Recovery

For recovering specific cases or findings:

```sql
-- Restore specific case data from backup database
-- Connect to backup database
\c courtaccess_backup

-- Export case data
COPY (SELECT * FROM compliance_findings WHERE "caseId" = '<CASE_ID>') 
  TO '/tmp/case_findings.csv' WITH CSV HEADER;

COPY (SELECT * FROM evidence_events WHERE "caseId" = '<CASE_ID>') 
  TO '/tmp/case_events.csv' WITH CSV HEADER;

-- Import into production
\c courtaccess
COPY compliance_findings FROM '/tmp/case_findings.csv' WITH CSV HEADER;
COPY evidence_events FROM '/tmp/case_events.csv' WITH CSV HEADER;
```

---

## 7. Disaster Scenarios

### 7.1 Database Corruption
1. Stop application: `pm2 stop all`
2. Restore from most recent backup/snapshot
3. Verify data integrity
4. Restart application: `pm2 start all`
5. Review audit trail for data loss window

### 7.2 Server Failure
1. Provision replacement server
2. Follow full system recovery procedure (Section 6.1)
3. Update DNS to point to new server
4. Verify all services operational

### 7.3 Data Center Outage
1. Activate cross-region S3 replica
2. Launch RDS read replica in secondary region
3. Promote read replica to primary
4. Deploy application in secondary region
5. Update DNS failover

### 7.4 Security Breach
1. Immediately isolate affected systems
2. Rotate all credentials (database, API keys, JWT secrets)
3. Review audit trail for unauthorized access
4. Restore from pre-breach backup if data was modified
5. Notify affected parties per legal requirements
6. Document incident and remediation

### 7.5 Accidental Data Deletion
1. Identify affected data scope
2. Restore from point-in-time backup
3. Use partial recovery procedure (Section 6.4)
4. Verify chain-of-custody integrity

---

## 8. Backup Schedule Summary

| Backup Type | Frequency | Retention | Storage |
|---|---|---|---|
| Database (full) | Daily 3 AM UTC | 35 days | S3 Standard-IA |
| Database (WAL/PITR) | Continuous | 7 days | RDS automated |
| Policy documents | Daily 4 AM UTC | Indefinite | S3 Standard-IA |
| Evidence files | Daily 5 AM UTC | Indefinite | S3 Glacier IR |
| Application config | Weekly | 90 days | S3 Standard |
| Prisma schema | Git (every commit) | Indefinite | GitHub |

---

## 9. Testing Schedule

| Test | Frequency | Responsible |
|---|---|---|
| Backup verification | Weekly | DevOps |
| Database restore drill | Monthly | DevOps + DBA |
| Full system recovery drill | Quarterly | DevOps + Engineering |
| Security incident response drill | Semi-annually | Security + Engineering |

---

## 10. Contact & Escalation

| Role | Responsibility |
|---|---|
| DevOps Engineer | First responder for infrastructure issues |
| Database Administrator | Database recovery and integrity |
| Security Lead | Security breach response |
| Engineering Lead | Application recovery and deployment |
| Legal Counsel | Data breach notification requirements |
