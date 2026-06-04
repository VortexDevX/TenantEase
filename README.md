# TenantEase

TenantEase is a PG, hostel, and rental property management monorepo. It uses a Fastify API, a Next.js web app, Prisma with PostgreSQL, and a shared TypeScript contract package.

Older planning docs may mention a Next API monolith. Current code is not that architecture: API and web are separate workspace apps.

## Workspace

```text
.
├─ apps/
│  ├─ api/                 Fastify API, Prisma schema, migrations, API tests
│  └─ web/                 Next.js app directory frontend
├─ packages/
│  └─ types/               Shared DTOs and API contract types
├─ docs/                   Product and implementation planning notes
├─ storage/                Local runtime files, such as generated receipts
├─ docker-compose.yml      Local PostgreSQL and Redis services
├─ package.json            Root pnpm scripts
├─ pnpm-workspace.yaml     Workspace package list
└─ tsconfig.base.json      Shared TypeScript config
```

## Main Features

- Owner onboarding, login, and profile completion.
- Property, room, bed, and occupancy management.
- Tenant lifecycle workflows: create, transfer, notice, vacate, and settlement.
- Rent ledger, payment recording, voiding, and receipt generation.
- Property settings for rent due day, late fee rule, owner PAN, and owner contact.
- Reminder configuration, reminder send logs, and in-app notifications.
- Tenant portal home/profile, receipts, announcements, maintenance, and agreements.
- Plan and billing foundation: free-plan property limit, subscription overview, plan options, and invoice records.
- Utilities, agreements, announcements, reports, and maintenance modules.
- Shared DTOs in `packages/types` used by both API and web.

## Tech Stack

- Runtime: Node.js with pnpm through Corepack.
- Web: Next.js, React, Tailwind CSS.
- API: Fastify, Zod, Prisma Client, Prisma PostgreSQL adapter.
- Database: PostgreSQL 16 through Docker Compose.
- Cache/service placeholder: Redis through Docker Compose.
- Tests: Vitest for API integration/unit coverage.

## Required Tools

- Node.js compatible with current dependencies. The tested local runtime is Node `v24.13.0`.
- Corepack with pnpm `10.8.0`.
- Docker Desktop or another Docker engine for PostgreSQL and Redis.

Check local versions:

```powershell
node --version
corepack pnpm --version
docker --version
```

## Environment

Create a root `.env` file. Use `.env.example` as the starting point:

```powershell
Copy-Item .env.example .env
```

Generate secrets:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Important variables:

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/tenantease?schema=public
JWT_ACCESS_SECRET=replace-with-32-char-secret
JWT_REFRESH_SECRET=replace-with-32-char-secret
OTP_PEPPER=replace-with-32-char-secret
ADMIN_PHONES=
API_PORT=4000
API_HOST=0.0.0.0
WEB_URL=http://localhost:3000
STORAGE_DIR=../../storage
NEXT_PUBLIC_API_URL=http://localhost:4000
SMS_PROVIDER=mock
SMS_API_KEY=
SMS_SENDER_NAME=TenantEase
SMS_HTTP_URL=
SMS_HTTP_AUTH_HEADER=
SMS_HTTP_AUTH_VALUE=
```

Do not commit real `.env` values.

## Quick Start

```powershell
corepack enable
corepack pnpm install
docker compose up -d postgres redis
corepack pnpm prisma:generate
corepack pnpm prisma:migrate
corepack pnpm prisma:seed
corepack pnpm dev
```

Open:

- Web: `http://localhost:3000`
- API health: `http://localhost:4000/health`

## Common Scripts

```powershell
corepack pnpm dev               # API and web together
corepack pnpm dev:api           # Fastify only
corepack pnpm dev:web           # Next only
corepack pnpm prisma:generate   # Generate Prisma client
corepack pnpm prisma:migrate    # Apply local Prisma migrations
corepack pnpm prisma:seed       # Seed local data
corepack pnpm db:studio         # Open Prisma Studio DB editor
corepack pnpm test:api          # API test suite
corepack pnpm typecheck         # TypeScript checks
corepack pnpm build             # Production build for packages/apps
corepack pnpm audit --prod      # Production dependency audit
```

## Login Behavior

Local OTP is mocked by default. The login UI receives and displays the debug OTP from `/auth/send-otp` when not in production.

- Phone in `ADMIN_PHONES`: logs in as `ADMIN`.
- Phone attached to an active tenant: logs in as `TENANT`.
- New phone with no existing owner/admin record: logs in as `TENANT` with no active booking.
- To make an owner, promote the user from the admin console or seed/create an owner account.

## SMS Providers

SMS defaults to `SMS_PROVIDER=mock`, which logs OTP and reminder messages locally.

Available modes:

- `mock`: local development, no external SMS.
- `textbelt`: free developer testing through Textbelt. Use `SMS_API_KEY=textbelt` for the public free key or your own paid key.
- `http`: generic JSON webhook for any gateway. Configure `SMS_HTTP_URL`, plus optional auth header/value.

There is no truly free and reliable production SMS provider. For India production OTP/reminders, use a paid DLT-compliant provider such as MSG91, or a global provider such as Twilio Verify. Keep mock/Textbelt for development only.

## Database Notes

Local PostgreSQL runs on host port `55432`. Redis runs on host port `56379`.

For a NoSQL-style browser editor over the relational DB, use Prisma Studio:

```powershell
corepack pnpm db:studio
```

It opens a local web UI where you can view and edit tables. Treat edits like direct DB writes: they bypass app validation, so prefer the app UI for normal work.

## Plan Limits

Every owner has a subscription row. Existing owners are backfilled to `FREE`.

- `FREE`: 1 property, no staff accounts, in-app/email-capable reminders.
- `STARTER`: 1 property, 1 staff account, SMS enabled.
- `PRO`: 3 properties, 3 staff accounts, SMS and online payment flags enabled.
- `BUSINESS`: high property cap, 10 staff accounts, SMS/WhatsApp/online payment flags enabled.

The API currently enforces the property cap and staff-account cap, and exposes `/subscription`, `/subscription/plans`, and `/subscription/invoices`. Staff invite/revoke is available from owner UI. Razorpay upgrade/cancel/webhook flows are still pending.

For a fresh database:

```powershell
docker compose down -v
docker compose up -d postgres redis
corepack pnpm prisma:migrate
corepack pnpm prisma:seed
```

If Prisma reports migration drift in disposable local dev data, reset intentionally:

```powershell
corepack pnpm --filter @tenantease/api exec dotenv -e ../../.env -- prisma migrate reset
```

This drops local data. Do not run reset against data you need.

## Verification

Recommended checks before handing off work:

```powershell
corepack pnpm -r typecheck
corepack pnpm --filter @tenantease/api test
corepack pnpm -r build
corepack pnpm audit --prod
corepack pnpm outdated --recursive
```

API tests require PostgreSQL to be reachable at `127.0.0.1:55432` and migrated to the current Prisma schema.

## Version Compatibility Notes

- TypeScript `baseUrl` was removed from shared config to avoid future TypeScript 7 deprecation problems.
- Current dependency baseline has been verified on Prisma 7.8, TypeScript 6, Vite 8, Vitest 4.1.8, Zod 4, and Fastify CORS 11.
- Prisma datasource URL and seed command live in `apps/api/prisma.config.ts`; Prisma Client uses `@prisma/adapter-pg`.
- Current Prisma migrations include the MVP gap closure, subscription foundation, and staff assignments. Run `corepack pnpm prisma:migrate` after pulling these changes.
- `pnpm audit --prod` and `pnpm outdated --recursive` should be clean; pnpm may still print a Node `url.parse()` deprecation warning from its own tooling.

## More Detail

Use [RUN_PROJECT.md](RUN_PROJECT.md) for a step-by-step local runbook, troubleshooting, and verification flow.
