# 📄 DOCUMENT 11: OPERATIONS & SUPPORT RUNBOOK

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 29 March 2026 |

---

## Table of Contents

1. [Ops Objectives](#1-ops-objectives)
2. [Support Operating Model](#2-support-operating-model)
3. [Incident Severity & SLA Matrix](#3-incident-severity--sla-matrix)
4. [On-Call and Escalation Policy](#4-on-call-and-escalation-policy)
5. [Monitoring and Alert Runbook](#5-monitoring-and-alert-runbook)
6. [Common Incident Playbooks](#6-common-incident-playbooks)
7. [Customer Communication Templates](#7-customer-communication-templates)
8. [Daily/Weekly/Monthly Ops Checklists](#8-dailyweeklymonthly-ops-checklists)
9. [Subscription & Billing Operations](#9-subscription--billing-operations)
10. [Data Operations & Compliance Requests](#10-data-operations--compliance-requests)
11. [Postmortem Standard](#11-postmortem-standard)
12. [Business Continuity](#12-business-continuity)
13. [Ownership and Handover](#13-ownership-and-handover)
14. [Operational Acceptance Criteria](#14-operational-acceptance-criteria)

---

## 1. Ops Objectives

- Keep TenantEase reliable during daily rent and reminder cycles.
- Resolve incidents quickly with clear accountability.
- Maintain transparent communication with owners and tenants.
- Provide repeatable runbooks to reduce dependency on individuals.

---

## 2. Support Operating Model

### 2.1 Support Channels
- In-app support ticket.
- Support email.
- Priority chat/phone for higher-tier plans.

### 2.2 Ticket Categories
- Authentication/Login
- Rent/Payment
- Receipt/Tax documents
- Maintenance workflows
- Subscription/Billing
- Feature request and training

### 2.3 Business Hours
- Standard support: 9 AM-7 PM IST, Monday-Saturday.
- Incident support: 24x7 for `SEV-1` and `SEV-2`.

---

## 3. Incident Severity & SLA Matrix

| Severity | Example | First Response | Update Frequency | Target Resolution |
| :--- | :--- | :--- | :--- | :--- |
| `SEV-1` | Platform down, payment corruption, cross-tenant data exposure | 15 min | 15 min | 4 hours |
| `SEV-2` | Major feature unavailable (auth, reminders, receipts) | 30 min | 30 min | 8 hours |
| `SEV-3` | Partial degradation with workaround | 4 hours | Daily | 3 business days |
| `SEV-4` | Minor bug/cosmetic | 1 business day | Weekly | Planned backlog |

---

## 4. On-Call and Escalation Policy

### 4.1 Roles
- Incident Commander (IC): coordination and decisions.
- Technical Lead: diagnosis and fix.
- Communications Lead: internal/external updates.
- Support Lead: ticket triage and customer handling.

### 4.2 Escalation Flow
1. Alert triggered and acknowledged.
2. IC assigned and incident channel opened.
3. Severity declared and mitigation started.
4. Escalate to founders/leadership for `SEV-1`.
5. Customer status updates begin.

---

## 5. Monitoring and Alert Runbook

### 5.1 Must-Monitor Signals
- API availability and p95 latency.
- OTP send/verify success rate.
- Payment webhook failures.
- Queue lag and dead-letter volume.
- PDF generation failure rate.
- DB resource utilization and slow query spikes.

### 5.2 Alert Triage Sequence
1. Validate whether alert is real (not noisy false positive).
2. Determine blast radius (single property vs platform-wide).
3. Apply temporary mitigation if possible.
4. Assign fix owner and ETA.
5. Track until full recovery + 30-minute stability window.

---

## 6. Common Incident Playbooks

### 6.1 OTP Delivery Failure Spike
- Check SMS provider status dashboard.
- Switch to fallback provider if threshold breached.
- Enable temporary email OTP fallback.
- Notify users in-app about delays.

### 6.2 Payment Webhook Backlog
- Verify gateway webhook health and signature failures.
- Pause non-critical workers, prioritize payment queue.
- Reprocess failed events from idempotent retry queue.
- Reconcile payment and rent-entry state before closure.

### 6.3 Reminder Job Delay
- Check queue lag and worker pod health.
- Scale worker replicas.
- Re-run delayed reminder batch with duplicate suppression.

### 6.4 Receipt Generation Errors
- Check PDF service dependency and storage write permissions.
- Retry failed jobs with exponential backoff.
- Provide manual receipt regeneration for affected records.

### 6.5 Database Saturation
- Activate read-only protection on non-critical dashboards if needed.
- Kill runaway queries and apply immediate query limits.
- Scale DB/read replicas and evaluate index hotfix.

---

## 7. Customer Communication Templates

### 7.1 Incident Started
`We are currently investigating an issue affecting <feature>. Our team is actively working on a fix. Next update in <time>.`

### 7.2 Incident Mitigated
`The issue affecting <feature> has been mitigated. Services are stabilizing. We are monitoring closely and will share a final update shortly.`

### 7.3 Incident Resolved
`The issue affecting <feature> has been resolved as of <time IST>. If you still face problems, contact support with your property name and phone number.`

### 7.4 Billing Dispute Acknowledgement
`We have received your billing concern and opened case <ticket-id>. We will share a resolution update by <date/time>.`

---

## 8. Daily/Weekly/Monthly Ops Checklists

### 8.1 Daily
- [ ] Verify health dashboard and overnight alert summary.
- [ ] Review failed jobs and retry outcomes.
- [ ] Check payment webhook reconciliation status.
- [ ] Confirm backup jobs completed.

### 8.2 Weekly
- [ ] Review incident trends and top recurring causes.
- [ ] Validate alert tuning (reduce noise).
- [ ] Audit pending high-priority support tickets.
- [ ] Review provider reliability (SMS/email/payment).

### 8.3 Monthly
- [ ] Capacity planning review.
- [ ] SLA and support KPI report.
- [ ] Disaster recovery spot check.
- [ ] Access review for production systems.

---

## 9. Subscription & Billing Operations

### 9.1 Billing Reconciliation
- Compare subscription events with internal ledger daily.
- Flag mismatched payment states for manual review.

### 9.2 Refund Workflow
1. Verify eligibility by policy and payment status.
2. Approve via authorized ops role.
3. Trigger refund through gateway.
4. Record refund reason and audit entry.

### 9.3 Plan Change Operations
- Validate plan limits before downgrade.
- Send proactive warnings for usage-limit conflicts.

---

## 10. Data Operations & Compliance Requests

### 10.1 Data Access Request
- Verify requester identity.
- Export tenant/owner data bundle securely.
- Complete within internal SLA (target: 7 business days).

### 10.2 Data Correction Request
- Validate correction evidence.
- Apply change with audit log and actor identity.

### 10.3 Data Deletion Request
- Verify legal retention constraints.
- Soft-delete first, hard-delete after retention window.
- Provide completion confirmation.

---

## 11. Postmortem Standard

Every `SEV-1` and `SEV-2` requires a postmortem within 48 hours:

- Timeline with exact timestamps.
- Impact assessment (users/properties/transactions affected).
- Root cause (technical + process).
- What worked/failed in response.
- Corrective actions with owners and due dates.
- Regression tests/alerts added.

---

## 12. Business Continuity

### 12.1 Critical Dependencies
- Payment gateway
- SMS/email providers
- Cloud hosting/network
- Database and object storage

### 12.2 Continuity Controls
- Fallback providers for OTP/notifications.
- Graceful degradation modes (manual payment recording if gateway down).
- Recovery playbooks for region/service outage.

---

## 13. Ownership and Handover

### 13.1 Runbook Ownership
- Engineering Lead: technical runbooks.
- Support Lead: customer workflows and templates.
- Product Ops: SLA/KPI tracking and process updates.

### 13.2 Update Cadence
- Review monthly or after any major incident.
- Update version/date whenever a section changes.

---

## 14. Operational Acceptance Criteria

Operations readiness is achieved only when:

- On-call roster and escalation contacts are active.
- Alerting thresholds tested and actionable.
- Core incident playbooks validated in drills.
- Customer communication templates approved and accessible.
- SLA reporting and support dashboards are live.
- Postmortem process used consistently for critical incidents.

---

**Documentation Suite Milestone:** DOC 1 to DOC 11 complete.

## End of Document 11

