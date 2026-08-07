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
├─ docker-compose.yml      Local PostgreSQL service
├─ package.json            Root pnpm scripts
├─ pnpm-workspace.yaml     Workspace package list
└─ tsconfig.base.json      Shared TypeScript config
```

## Main Features

- Owner onboarding, login, and profile completion.
- Property, room, bed, and occupancy management.
- Tenant lifecycle workflows: create, transfer, notice, vacate, and settlement.
- Rent ledger, payment recording, voiding, and receipt generation.
- Cron rent generation, configured reminders, reminder logs, and overdue status automation.
- Property settings for rent due day, late fee rule, owner PAN, and owner contact.
- Reminder delivery through in-app, SMS, email, and WhatsApp provider interfaces.
- Final settlement PDF generation and receipt PDF download/send flows.
- Tenant portal home/profile, receipts, announcements, maintenance, and agreements.
- Plan and billing foundation: free-plan property limit, subscription overview, plan options, and invoice records.
- Utilities, agreements, announcements, reports, annual summary export, and maintenance modules.
- Public PG listing pages with enquiry capture and owner-side enquiry management.
- Shared DTOs in `packages/types` used by both API and web.

## Current Progress

- Core flows are integrated and hardened, but production readiness depends on passing CI, real-provider staging, backup/restore setup, and broader browser tests.
- [Audit.md](Audit.md) is the source of truth for verified findings and remediation status.

Recent MVP gap closures include direct owner OTP signup, onboarding property settings for rent due day/contact phone, staff permission hardening across operational modules, tenant agreement access, Razorpay rent/subscription webhooks with replay protection, CORS/rate-limit hardening, room create/edit/delete reliability, richer tenant records, utility/late-fee charge idempotency, cron-safe rent generation, configured reminders, settlement PDFs, public listings/enquiries, Playwright smoke tests, fallow dead-code cleanup, and the first UI/UX overhaul pass for dashboard/reporting surfaces.

Current known gaps before release polish:

- Continue UI/UX review across the remaining owner operational pages: properties, rooms, tenants, payments, utilities, agreements, listings, and settings.
- Keep splitting any large page components/routes still flagged by fallow health after each UI pass.
- Keep SMS/email/WhatsApp in mock mode for MVP dev/staging; configure real providers only before production launch.
- Stage Razorpay dashboard webhooks/plans before real-money production testing.
- Expand Playwright from smoke coverage into deeper owner, tenant, payment, and public listing journeys.

## Tech Stack

- Runtime: Node.js with pnpm through Corepack.
- Web: Next.js, React, Tailwind CSS.
- API: Fastify, Zod, Prisma Client, Prisma PostgreSQL adapter.
- Database: PostgreSQL 16 through Docker Compose.
- Tests: Vitest for API integration/unit coverage, Playwright for web smoke coverage.

## Money Convention

- API DTOs and database values store money as integer paisa.
- Web forms always accept rupees from users, then convert with `apps/web/lib/money.ts` before submitting.
- CSV tenant import also accepts rupees, including paise decimals such as `8000.50`, and converts to integer paisa on import.
- Display paths use `formatPaisa` or `MoneyValue`, so a stored value of `3000` renders as `₹30`.

## Required Tools

- Node.js compatible with current dependencies. The tested local runtime is Node `v24.13.0`.
- Corepack with pnpm `10.8.0`.
- Docker Desktop or another Docker engine for PostgreSQL.

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
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:55432/tenantease?schema=public
DATABASE_URL_TEST=postgresql://postgres:postgres@127.0.0.1:55432/tenantease_test?schema=public
JWT_ACCESS_SECRET=replace-with-32-char-secret
JWT_REFRESH_SECRET=replace-with-32-char-secret
OTP_PEPPER=replace-with-32-char-secret
CRON_SECRET=replace-with-32-char-secret
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
EMAIL_PROVIDER=mock
EMAIL_HTTP_URL=
EMAIL_HTTP_AUTH_HEADER=
EMAIL_HTTP_AUTH_VALUE=
WHATSAPP_PROVIDER=mock
WHATSAPP_HTTP_URL=
WHATSAPP_HTTP_AUTH_HEADER=
WHATSAPP_HTTP_AUTH_VALUE=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
RAZORPAY_PLAN_STARTER_ID=
RAZORPAY_PLAN_PRO_ID=
RAZORPAY_PLAN_BUSINESS_ID=
```

Do not commit real `.env` values.

## Quick Start

```powershell
corepack enable
corepack pnpm install
docker compose up -d postgres
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
corepack pnpm audit:prod        # Production dependency audit
```

## Login Behavior

Local OTP is mocked by default. The login UI receives and displays the debug OTP from `/auth/send-otp` when not in production.

- Phone in `ADMIN_PHONES`: logs in as `ADMIN`.
- Phone attached to an active tenant: logs in as `TENANT`.
- New owner: select `Owner` on the login screen, verify OTP, then complete onboarding.
- Tenant/staff: select `Tenant / Staff` and use the phone already added by an owner.
- Admin: use a phone listed in `ADMIN_PHONES`.

## SMS Providers

SMS defaults to `SMS_PROVIDER=mock`, which logs OTP and reminder messages locally.

Available modes:

- `mock`: local development, no external SMS.
- `textbelt`: free developer testing through Textbelt. Use `SMS_API_KEY=textbelt` for the public free key or your own paid key.
- `http`: generic JSON webhook for any gateway. Configure `SMS_HTTP_URL`, plus optional auth header/value.

There is no truly free and reliable production SMS provider. For India production OTP/reminders, use a paid DLT-compliant provider such as MSG91, or a global provider such as Twilio Verify. Keep mock/Textbelt for development only.

## Email And WhatsApp Providers

Reminder and receipt sending uses one notification provider interface for SMS, email, WhatsApp, and in-app messages. MVP dev/staging can keep all external channels on mock providers.

- `EMAIL_PROVIDER=mock`: logs email send attempts locally.
- `EMAIL_PROVIDER=http`: POSTs JSON to `EMAIL_HTTP_URL` with optional auth header/value.
- `WHATSAPP_PROVIDER=mock`: logs WhatsApp send attempts locally.
- `WHATSAPP_PROVIDER=http`: POSTs JSON to `WHATSAPP_HTTP_URL` with optional auth header/value.

Production reminder startup validates enabled channels. If email or WhatsApp reminders are enabled without working HTTP config, the API fails the send path with a config error instead of silently pretending to send. For now, keep `EMAIL_PROVIDER=mock` and `WHATSAPP_PROVIDER=mock`.

## Online Payments

Tenant rent payment orders use Razorpay Orders. Subscription checkout uses Razorpay Subscriptions. Leave `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` empty for local mock creation; set them for Razorpay test/live mode.

Configure Razorpay payment webhooks to call `/webhooks/razorpay/payments` and set `RAZORPAY_WEBHOOK_SECRET`. The API verifies `X-Razorpay-Signature`, records captured payments as `ONLINE`, recalculates rent, generates receipts, and stores `x-razorpay-event-id` in the webhook event ledger for replay protection.

Configure subscription webhooks to call `/webhooks/razorpay/subscriptions`. For real subscription checkout, create Razorpay plans first and set `RAZORPAY_PLAN_STARTER_ID`, `RAZORPAY_PLAN_PRO_ID`, and `RAZORPAY_PLAN_BUSINESS_ID`. Duplicate webhook event IDs are ignored after the first verified delivery.

## Public Listings

Owners can manage listing metadata from the property screen. Public listings are available at:

```text
http://localhost:3000/pg/<slug>
```

Public enquiries are rate-limited per phone/property/day and appear in the owner property enquiry panel. Owners can mark enquiries as new, contacted, or closed.

## Database Notes

Local PostgreSQL runs on host port `55432` and is bound to loopback only.

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

The API currently enforces the property cap and staff-account cap, and exposes `/subscription`, `/subscription/plans`, and `/subscription/invoices`. Staff invite/revoke is available from owner UI. Razorpay tenant rent order, rent payment webhook capture, subscription checkout, and subscription cancel flows are available.

For a fresh database:

```powershell
docker compose down -v
docker compose up -d postgres
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
corepack pnpm --filter @tenantease/web test:e2e
corepack pnpm -r build
corepack pnpm audit:prod
cmd /c "npx -y fallow@latest dead-code --format json --quiet --explain --unused-exports --unused-files --unused-deps --unlisted-deps --circular-deps --summary 2>NUL || exit /b 0"
corepack pnpm outdated --recursive
```

API tests use `DATABASE_URL_TEST` (or derive a database name ending in `_test`) and refuse a database name without `test`. Create and migrate that isolated database before running them.

## Version Compatibility Notes

- TypeScript `baseUrl` was removed from shared config to avoid future TypeScript 7 deprecation problems.
- Current dependency baseline has been verified on Prisma 7.8, TypeScript 6, Vite 8, Vitest 4.1.8, Zod 4, and Fastify CORS 11.
- Prisma datasource URL and seed command live in `apps/api/prisma.config.ts`; Prisma Client uses `@prisma/adapter-pg`.
- Current Prisma migrations include the MVP gap closure, subscription foundation, and staff assignments. Run `corepack pnpm prisma:migrate` after pulling these changes.
- CI enforces typecheck, API tests, production build, production audit, migrations, and Playwright smoke tests.
- Fallow health cleanup is in progress through the UI/UX overhaul. Dashboard, reports, profile, utilities, and tenant portal surfaces have been split into smaller typed view components.

## More Detail

Use [RUN_PROJECT.md](RUN_PROJECT.md) for a step-by-step local runbook, troubleshooting, and verification flow.
