# 📄 DOCUMENT 10: TESTING & QA STRATEGY DOCUMENT

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 29 March 2026 |

---

## Table of Contents

1. [QA Objectives](#1-qa-objectives)
2. [Testing Scope](#2-testing-scope)
3. [Test Pyramid & Coverage Targets](#3-test-pyramid--coverage-targets)
4. [Unit Testing Strategy](#4-unit-testing-strategy)
5. [Integration Testing Strategy](#5-integration-testing-strategy)
6. [API Contract & Regression Testing](#6-api-contract--regression-testing)
7. [E2E Testing Strategy](#7-e2e-testing-strategy)
8. [Security, Performance, and Reliability Testing](#8-security-performance-and-reliability-testing)
9. [Test Data Management](#9-test-data-management)
10. [CI Quality Gates](#10-ci-quality-gates)
11. [Manual QA & UAT Plan](#11-manual-qa--uat-plan)
12. [Defect Lifecycle & Severity Matrix](#12-defect-lifecycle--severity-matrix)
13. [Release Exit Criteria](#13-release-exit-criteria)
14. [QA Ownership Model](#14-qa-ownership-model)
15. [Templates (Checklist)](#15-templates-checklist)

---

## 1. QA Objectives

- Prevent regressions in rent tracking, payments, receipts, and tenant isolation.
- Detect defects as early as possible in CI.
- Protect critical business workflows with automated coverage.
- Provide consistent release confidence through measurable quality gates.

---

## 2. Testing Scope

### 2.1 In Scope
- Owner workflows: property setup, tenant onboarding, rent lifecycle, reminders.
- Tenant workflows: portal login, payment history, maintenance requests, receipts.
- Billing workflows: manual/online payments, receipt generation, subscription flows.
- Security controls: auth, RBAC, rate limits, webhook verification.

### 2.2 Out of Scope (for MVP)
- Native mobile app-specific test suites (web/PWA only).
- Multi-region disaster simulation beyond staging-level drills.

---

## 3. Test Pyramid & Coverage Targets

### 3.1 Distribution Targets
- Unit tests: ~70%
- Integration tests: ~20%
- E2E tests: ~10%

### 3.2 Coverage Goals
- Global line coverage: >= 80%
- Critical modules (auth, billing, receipts, tenancy isolation): >= 90%

---

## 4. Unit Testing Strategy

### 4.1 Focus Areas
- Domain calculators (rent due, late fees, deposit settlement).
- Validators (phone, dates, money, enums).
- Permission checks and role guards.
- Utility functions (date/month billing cycles, idempotency keys).

### 4.2 Rules
- Pure logic first, no network calls in unit tests.
- Deterministic inputs and fixed clocks for date-sensitive logic.
- Edge cases mandatory for financial calculations.

---

## 5. Integration Testing Strategy

### 5.1 What to Validate
- API + DB interactions per module.
- Transaction boundaries and rollback behavior.
- Queue producer/consumer integration for reminders/receipts.
- File upload metadata and signed URL lifecycle.

### 5.2 Environment
- Ephemeral database for CI runs.
- Seeded fixtures for realistic owner/property/tenant scenarios.
- External providers mocked/stubbed except webhook signature verification tests.

---

## 6. API Contract & Regression Testing

### 6.1 Contract Rules
- All endpoints in DOC7 covered by request/response schema tests.
- Backward compatibility checks for `/api/v1` (no breaking fields in patch/minor).

### 6.2 Golden Scenarios
- `POST /auth/send-otp` and verification edge cases.
- `POST /payments` -> `POST /receipts` flow.
- `POST /webhooks/razorpay` idempotency and replay handling.
- Tenant can only access own `/portal/*` data.

### 6.3 Error Contract Validation
- Validate standard error envelope format.
- Validate mapped error codes for common failure cases.

---

## 7. E2E Testing Strategy

### 7.1 Critical E2E Journeys
1. Owner onboarding -> property -> room -> tenant -> payment -> receipt.
2. Tenant login -> view dues -> make payment (mock gateway) -> receipt visible.
3. Tenant raises maintenance -> owner updates status -> tenant notified.
4. Owner sends reminders -> delivery logs updated.
5. Staff access restrictions validated against permission set.

### 7.2 Browser Matrix
- Chrome latest (primary).
- Mobile viewport simulation (Android class widths).
- Optional: Firefox for smoke coverage.

---

## 8. Security, Performance, and Reliability Testing

### 8.1 Security Tests
- Authorization bypass attempts for cross-tenant resource IDs.
- OTP brute-force and resend abuse thresholds.
- Injection tests for input fields (SQLi/XSS payload smoke).
- Webhook signature tampering checks.

### 8.2 Performance Tests
- Baseline API load profile:
  - 200 concurrent users
  - p95 API latency target: < 500ms for common endpoints
- Peak billing-day simulation for payment and reminders.

### 8.3 Reliability Tests
- Queue retry and dead-letter behavior.
- Provider failure simulation (SMS/payment outage fallback behavior).

---

## 9. Test Data Management

### 9.1 Principles
- Never use production PII in test environments.
- Use synthetic/masked data only.
- Keep reusable fixtures versioned with schema.

### 9.2 Data Sets
- Small fixtures for fast unit/integration.
- Medium fixtures for realistic API testing.
- Large dataset snapshots for performance tests.

---

## 10. CI Quality Gates

Build fails if any of the below fails:

- Lint or typecheck failure.
- Unit/integration/E2E critical suite failure.
- Coverage below threshold.
- High/Critical vulnerability unresolved.
- Contract test failures on versioned APIs.

---

## 11. Manual QA & UAT Plan

### 11.1 Manual QA Focus
- UX clarity on mobile for non-technical owners.
- PDF receipt correctness and formatting.
- Localization-readiness and date/currency formatting checks.

### 11.2 UAT Cohort
- 5-10 beta PG owners across different property sizes.
- 20-30 tenants for portal and notification feedback.

### 11.3 UAT Sign-Off Inputs
- Defect list by severity.
- Workflow usability score.
- “Would continue using this weekly?” feedback.

---

## 12. Defect Lifecycle & Severity Matrix

### 12.1 Status Flow
`Open -> Triaged -> In Progress -> In Review -> Ready for QA -> Closed`

### 12.2 Severity Definitions

| Severity | Definition | Target Fix |
| :--- | :--- | :--- |
| `S1` | Data loss, payment corruption, auth bypass | Immediate/hotfix |
| `S2` | Major workflow blocked, no workaround | < 24 hours |
| `S3` | Partial degradation, workaround exists | Next sprint |
| `S4` | Cosmetic/minor issue | Backlog |

---

## 13. Release Exit Criteria

Release can go live only when:

- No open `S1`/`S2` defects.
- Critical E2E journeys are green.
- Coverage thresholds met.
- Security checks pass with no unresolved high/critical issues.
- Staging sign-off from engineering + QA owner.

---

## 14. QA Ownership Model

- Engineers own unit + integration tests for their modules.
- QA owner governs E2E suite, exploratory testing, and release certification.
- Product owner signs UAT acceptance for major milestones.
- Security owner signs off on high-risk auth/payment changes.

---

## 15. Templates (Checklist)

### 15.1 PR QA Checklist
- [ ] Test cases added/updated.
- [ ] Edge cases covered.
- [ ] No snapshot-only assertion for business-critical logic.
- [ ] Migration impact tested (if applicable).
- [ ] Observability impact considered (logs/metrics).

### 15.2 Pre-Release QA Checklist
- [ ] Regression suite complete.
- [ ] Critical flows manually sanity-checked.
- [ ] Monitoring dashboards reviewed.
- [ ] Release notes include known issues + mitigations.

---

**Next Document:** DOC 11 — Operations & Support Runbook

## End of Document 10

