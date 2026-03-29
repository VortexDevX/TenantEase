# 📄 DOCUMENT 9: DEPLOYMENT & DEVOPS DOCUMENT

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 29 March 2026 |

---

## Table of Contents

1. [DevOps Goals](#1-devops-goals)
2. [Environment Strategy](#2-environment-strategy)
3. [Infrastructure Topology](#3-infrastructure-topology)
4. [CI/CD Pipeline](#4-cicd-pipeline)
5. [Branching & Release Model](#5-branching--release-model)
6. [Configuration & Secret Management](#6-configuration--secret-management)
7. [Database Migration Strategy](#7-database-migration-strategy)
8. [Job/Queue Deployment Strategy](#8-jobqueue-deployment-strategy)
9. [Observability & Alerting](#9-observability--alerting)
10. [Backup & Disaster Recovery](#10-backup--disaster-recovery)
11. [Scaling Policy](#11-scaling-policy)
12. [Rollback Runbook](#12-rollback-runbook)
13. [Release Checklist](#13-release-checklist)
14. [SLOs & Operational Targets](#14-slos--operational-targets)
15. [Deployment Acceptance Criteria](#15-deployment-acceptance-criteria)

---

## 1. DevOps Goals

- Ship safely and frequently (minimum weekly release cycle after MVP).
- Ensure reproducible deployments across environments.
- Keep outages short with clear rollback paths.
- Instrument the system for fast detection and diagnosis.
- Protect data durability and recovery timelines.

---

## 2. Environment Strategy

### 2.1 Environments

| Environment | Purpose | Data | Access |
| :--- | :--- | :--- | :--- |
| Local | Developer iteration | Seed/synthetic | Dev only |
| Dev | Shared integration | Synthetic + masked | Engineering |
| Staging | Pre-prod validation | Production-like masked | Engineering + QA |
| Production | Live users | Real | Restricted |

### 2.2 Promotion Path
- `local -> dev -> staging -> production`
- No direct production deployment from local machine.
- Production deploy requires green CI + manual approval gate.

---

## 3. Infrastructure Topology

### 3.1 Core Components
- Frontend: Next.js app (edge CDN + SSR).
- Backend API: Node.js service (containerized).
- Database: PostgreSQL (managed).
- Cache/Queue: Redis.
- Storage: Cloudflare R2 or S3 (private buckets).
- Workers: Background jobs for reminders, receipts, reports.

### 3.2 Network and Security
- Public ingress only through WAF/reverse proxy.
- API and worker services on private network where possible.
- DB and Redis inaccessible from public internet.
- Least-privilege IAM roles per service.

---

## 4. CI/CD Pipeline

### 4.1 Pipeline Stages
1. `Install`: deterministic dependencies (`npm ci`).
2. `Static Checks`: lint + typecheck.
3. `Unit Tests`: fast suite.
4. `Integration Tests`: DB + API test run.
5. `Security Checks`: dependency scan + secret scan.
6. `Build`: frontend/backend images and artifacts.
7. `Deploy to Staging`: auto on main branch merge.
8. `Staging Smoke`: health + critical user flows.
9. `Production Approval`: manual gate.
10. `Deploy to Production`: rolling/canary.
11. `Post-Deploy Verification`: smoke + key metrics.

### 4.2 Build Artifacts
- Immutable Docker images tagged with commit SHA.
- Signed artifacts preferred for traceability.

---

## 5. Branching & Release Model

### 5.1 Branching
- `main`: production-ready branch.
- `feature/*`: isolated development.
- `hotfix/*`: emergency fixes from production incidents.

### 5.2 Release Cadence
- Regular releases: weekly.
- Hotfix releases: on-demand with shortened approval path.

### 5.3 Versioning
- Semantic versioning (`MAJOR.MINOR.PATCH`).
- Backend and frontend version recorded in release notes.

---

## 6. Configuration & Secret Management

### 6.1 Config Principles
- All environment-specific values from env vars.
- No hardcoded keys, URLs, or credentials in source.
- Separate `.env` templates for local onboarding only.

### 6.2 Secrets
- Stored in managed secret vault (not in repo).
- Rotated periodically and immediately after incidents.
- Access controlled by service identity and environment.

### 6.3 Required Secrets (Examples)
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `SMS_PROVIDER_API_KEY`, `EMAIL_PROVIDER_API_KEY`
- `DATABASE_URL`, `REDIS_URL`, `STORAGE_ACCESS_KEY`

---

## 7. Database Migration Strategy

### 7.1 Rules
- Migrations are versioned and committed to repository.
- Migration must be backward compatible for rolling deploy.
- No destructive schema change without phased rollout.

### 7.2 Safe Change Pattern
1. Add new column/table.
2. Backfill via controlled script/job.
3. Deploy code reading both old/new shape.
4. Switch writes to new field.
5. Remove old field in later release.

### 7.3 Production Controls
- Migration dry-run on staging snapshot first.
- Execute within maintenance window for heavy operations.
- Backup checkpoint before major migration.

---

## 8. Job/Queue Deployment Strategy

### 8.1 Worker Separation
- API pods and worker pods deploy independently.
- Queue consumers support graceful shutdown to avoid job loss.

### 8.2 Idempotency
- Scheduled jobs (rent generation/reminders) must be idempotent.
- Payment and receipt jobs keyed by unique business identifiers.

### 8.3 Retry Policy
- Exponential backoff.
- Dead-letter queue for repeated failures.
- Alert on queue lag threshold breach.

---

## 9. Observability & Alerting

### 9.1 Metrics
- API p95 latency, error rate, request throughput.
- DB CPU, connection utilization, slow query count.
- Queue depth, retry rate, DLQ count.
- Payment webhook success/failure rate.
- Reminder dispatch success by channel (SMS/email/WhatsApp).

### 9.2 Logs
- Structured JSON logs with request and trace IDs.
- Centralized log retention and query dashboards.
- Sensitive fields redacted (phone, KYC identifiers, secrets).

### 9.3 Tracing
- Distributed tracing across API -> DB/Redis -> worker -> provider calls.

### 9.4 Alerts
- Pager alerts for SEV-1/SEV-2 thresholds.
- Slack/email alerts for non-critical anomalies.

---

## 10. Backup & Disaster Recovery

### 10.1 Backups
- PostgreSQL: daily full + periodic incremental.
- Object storage: versioning enabled.
- Config snapshots for critical infrastructure.

### 10.2 Recovery Targets
- `RPO`: <= 15 minutes (target for production DB).
- `RTO`: <= 2 hours for major outage.

### 10.3 DR Drills
- Quarterly restore drills in staging.
- Validate data consistency after restore.

---

## 11. Scaling Policy

### 11.1 Horizontal Scaling Triggers
- API p95 > 500ms sustained for 10 min.
- CPU > 70% or memory > 75% sustained.
- Queue lag > 5 minutes for critical jobs.

### 11.2 Database Scaling
- Read replicas for heavy analytics/reporting.
- Query optimization and index review before vertical scaling.

### 11.3 Cost Control
- Track cost by component (compute, DB, storage, SMS, email).
- Monthly optimization review tied to usage growth.

---

## 12. Rollback Runbook

### 12.1 Application Rollback
1. Identify failing release SHA.
2. Repoint service to last known good image.
3. Verify health and critical API smoke.
4. Pause background jobs if data corruption risk exists.

### 12.2 Migration Rollback
- Prefer forward-fix over destructive rollback.
- If rollback required, execute pre-tested rollback script.
- Restore from backup if schema/data corruption occurs.

### 12.3 Communication
- Post incident channel updates every 15 minutes until stable.
- Publish customer-facing status note for major outages.

---

## 13. Release Checklist

- [ ] PR reviewed and approved.
- [ ] CI pipeline green (lint, typecheck, tests, security checks).
- [ ] Migration reviewed and staged.
- [ ] Feature flags configured.
- [ ] Staging smoke tests pass.
- [ ] Rollback path documented.
- [ ] On-call owner assigned for deployment window.
- [ ] Post-deploy monitoring active for 60 minutes.

---

## 14. SLOs & Operational Targets

| Category | Target |
| :--- | :--- |
| API Availability | 99.9% monthly |
| Auth Success Rate | >= 99.5% OTP success (provider-dependent) |
| Payment Webhook Processing | >= 99.9% within 2 minutes |
| Reminder Delivery Pipeline | >= 98% successful dispatch attempts |
| Mean Time to Detect (MTTD) | < 10 minutes for SEV-1 |
| Mean Time to Recover (MTTR) | < 60 minutes for SEV-1 |

---

## 15. Deployment Acceptance Criteria

DevOps setup is release-ready only if:

- CI/CD pipeline includes automated quality and security gates.
- Immutable artifacts and traceable release metadata are used.
- Staging is production-like and smoke suite is reliable.
- Backup and restoration have been validated in drill.
- Rollback runbook tested at least once.
- Alerting and on-call routing are active.

---

**Next Document:** DOC 10 — Testing & QA Strategy Document

## End of Document 9

