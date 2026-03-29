# DOCUMENT 16: LOCAL DEVELOPMENT & ENVIRONMENT SETUP

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 29 March 2026 |

---

## Table of Contents

1. [Purpose](#1-purpose)
2. [Prerequisites](#2-prerequisites)
3. [Repository Bootstrap](#3-repository-bootstrap)
4. [Environment Variables](#4-environment-variables)
5. [Run Commands](#5-run-commands)
6. [Database Setup](#6-database-setup)
7. [Seed Data](#7-seed-data)
8. [Testing Commands](#8-testing-commands)
9. [Troubleshooting](#9-troubleshooting)
10. [Developer Workflow](#10-developer-workflow)

---

## 1. Purpose

This document gives humans and AI agents a single setup reference for local development and validation.

---

## 2. Prerequisites

- Node.js LTS (recommended 20+)
- Package manager: npm or pnpm
- PostgreSQL (local or container)
- Redis (local or container)
- Git

Optional:
- Docker + Docker Compose for one-command local stack

---

## 3. Repository Bootstrap

```bash
# clone and enter repo
git clone <repo-url>
cd PG_Management

# install dependencies
npm install
```

---

## 4. Environment Variables

Create `.env` with placeholders:

```env
NODE_ENV=development
PORT=4000
APP_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tenantease
REDIS_URL=redis://localhost:6379

JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me

SMS_PROVIDER=msg91
SMS_PROVIDER_API_KEY=replace_me
EMAIL_PROVIDER_API_KEY=replace_me

RAZORPAY_KEY_ID=replace_me
RAZORPAY_KEY_SECRET=replace_me
RAZORPAY_WEBHOOK_SECRET=replace_me

STORAGE_BUCKET=tenantease-dev
STORAGE_ACCESS_KEY=replace_me
STORAGE_SECRET_KEY=replace_me
STORAGE_REGION=auto
STORAGE_ENDPOINT=replace_me
```

Rules:
- Never commit `.env` files.
- Keep `.env.example` updated whenever new vars are introduced.

---

## 5. Run Commands

Suggested scripts (adapt when repository scripts are finalized):

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
```

---

## 6. Database Setup

```bash
# run migrations
npm run db:migrate

# optional reset in local only
npm run db:reset
```

Migration policy:
- Migrations are mandatory for schema changes.
- Test migration on local/staging before PR merge.

---

## 7. Seed Data

```bash
npm run db:seed
```

Seed dataset should include:
- 1 owner account
- 1 staff account
- 5+ tenants across 2 properties
- rent entries across multiple months
- sample maintenance requests

---

## 8. Testing Commands

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

Before merging:
- lint, typecheck, unit, integration are required.
- e2e required for critical flow changes.

---

## 9. Troubleshooting

### Issue: DB connection error
- Verify Postgres service is running.
- Check `DATABASE_URL` credentials and DB name.

### Issue: OTP not sending
- Confirm SMS API key and provider configuration.
- Use mock provider in local development if needed.

### Issue: Redis errors
- Start Redis locally or disable queue workers for pure API dev mode.

### Issue: Migration mismatch
- Re-run migration from clean local DB.
- Validate migration order and naming.

---

## 10. Developer Workflow

1. Pull latest `main`.
2. Create feature branch.
3. Implement small vertical slice.
4. Run required checks locally.
5. Open PR with evidence and notes.
6. Merge only after CI and review pass.

---

**Documentation Suite Milestone:** Core + Execution docs complete through DOC16.

## End of Document 16

