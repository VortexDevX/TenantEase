# DOCUMENT 13: CODING STANDARDS & CONVENTIONS

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 29 March 2026 |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [General Engineering Rules](#2-general-engineering-rules)
3. [Project Structure Conventions](#3-project-structure-conventions)
4. [TypeScript and API Conventions](#4-typescript-and-api-conventions)
5. [Database and Migration Conventions](#5-database-and-migration-conventions)
6. [Error Handling Standard](#6-error-handling-standard)
7. [Logging and Observability Standard](#7-logging-and-observability-standard)
8. [Security Coding Rules](#8-security-coding-rules)
9. [Testing Conventions](#9-testing-conventions)
10. [Git and PR Conventions](#10-git-and-pr-conventions)

---

## 1. Purpose

This document standardizes code quality and consistency across human and AI contributors.

---

## 2. General Engineering Rules

- Prefer readability over cleverness.
- Keep functions small and single-purpose.
- Avoid duplicate logic; extract reusable modules.
- Do not mix unrelated refactors in feature PRs.
- Never commit secrets, tokens, or credentials.

---

## 3. Project Structure Conventions

Recommended structure:

```text
src/
  modules/
    auth/
    properties/
    tenants/
    rent/
    payments/
    receipts/
    maintenance/
  shared/
    errors/
    middleware/
    validators/
    utils/
  infra/
    db/
    queue/
    providers/
tests/
  unit/
  integration/
  e2e/
```

Rules:
- One module = one business domain.
- Shared code must be domain-agnostic.
- Keep controllers thin; move business logic to services.

---

## 4. TypeScript and API Conventions

- Use strict TypeScript mode.
- Avoid `any`; use explicit types and DTO schemas.
- Validate all external input at boundary.
- API naming:
  - Endpoints: plural nouns (`/properties`, `/tenants`)
  - JSON fields: `camelCase`
- Money values stored/transferred in smallest currency unit (paisa, integer).

---

## 5. Database and Migration Conventions

- Every schema change requires migration file.
- Migration filename format:
  - `YYYYMMDDHHMM_<short_description>`
- Avoid destructive changes in same release as behavior change.
- Index all foreign keys and frequent filter/sort columns.
- Soft-delete where auditability matters.

---

## 6. Error Handling Standard

- Use standardized error envelope from DOC7.
- Map domain errors to explicit error codes.
- Never return raw stack traces in API responses.
- Log internal errors with correlation ID.

Example structure:

```json
{
  "success": false,
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "Tenant does not exist",
    "details": null
  }
}
```

---

## 7. Logging and Observability Standard

- Use structured JSON logs.
- Required fields:
  - `timestamp`, `level`, `service`, `message`, `requestId`, `userId`, `resourceId`
- Redact sensitive fields:
  - phone, email, Aadhaar, PAN, tokens, payment secrets.
- Emit business metrics for:
  - rent generation, payment success/failure, receipt generation, reminder delivery.

---

## 8. Security Coding Rules

- Enforce RBAC and ownership checks on all protected resources.
- Verify webhook signatures before processing payload.
- Never trust client-side payment status.
- Use parameterized queries/ORM only.
- Validate MIME/type and size for uploads.

---

## 9. Testing Conventions

- Unit tests for domain logic and validators.
- Integration tests for API + DB interactions.
- E2E tests for critical journeys:
  - owner onboarding
  - rent + payment + receipt flow
  - tenant portal core actions
- Name tests clearly with behavior format:
  - `should_<expected_behavior>_when_<condition>`

---

## 10. Git and PR Conventions

- Branch naming:
  - `feature/<module>-<short-name>`
  - `fix/<module>-<short-name>`
- Commit messages:
  - `feat(module): ...`
  - `fix(module): ...`
  - `refactor(module): ...`
- PR must include:
  - scope summary
  - linked task IDs
  - test evidence
  - migration notes (if any)
  - rollback considerations (if risky)

---

**Next Document:** DOC 14 - UI/UX Design System

## End of Document 13

