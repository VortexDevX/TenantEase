# Run TenantEase Locally

This runbook starts TenantEase from a clean checkout on Windows PowerShell. Commands also work in other shells with minor syntax changes.

## 0. What Will Run

- PostgreSQL: Docker service on `127.0.0.1:55432`
- Redis: Docker service on `127.0.0.1:56379`
- API: Fastify on `http://localhost:4000`
- Web: Next.js on `http://localhost:3000`
- Runtime files: `storage/`

## 1. Check Prerequisites

```powershell
node --version
corepack pnpm --version
docker --version
docker compose version
```

Known working local versions during verification:

```text
Node.js v24.13.0
pnpm 10.8.0
Next.js 16.2.x
TypeScript 6.0.x
Prisma 7.8.x
Vite 8.0.x
Vitest 4.1.x
Zod 4.4.x
```

Enable Corepack if pnpm is not available:

```powershell
corepack enable
```

## 2. Install Dependencies

```powershell
corepack pnpm install
```

If install fails after dependency range changes, sync from the lockfile or refresh the lockfile intentionally:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm install --no-frozen-lockfile
```

Use `--no-frozen-lockfile` only when you intend to update `pnpm-lock.yaml`.

## 3. Create `.env`

Copy the example:

```powershell
Copy-Item .env.example .env
```

Use these local defaults:

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/tenantease?schema=public
JWT_ACCESS_SECRET=replace-with-32-char-secret
JWT_REFRESH_SECRET=replace-with-32-char-secret
OTP_PEPPER=replace-with-32-char-secret
ADMIN_PHONES=9999999999
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

Generate each secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Keep `.env` local. Do not commit real secrets.

## 4. Start Docker Services

```powershell
docker compose up -d postgres redis
```

Check service status:

```powershell
docker compose ps
```

Expected ports:

```text
postgres -> 127.0.0.1:55432
redis    -> 127.0.0.1:56379
```

If Docker Desktop is not running, start it first. If port `55432` is already used, change `docker-compose.yml` and `DATABASE_URL` together.

## 5. Prepare Database

Generate Prisma Client:

```powershell
corepack pnpm prisma:generate
```

Apply migrations:

```powershell
corepack pnpm prisma:migrate
```

Seed local data:

```powershell
corepack pnpm prisma:seed
```

Open browser DB editor:

```powershell
corepack pnpm db:studio
```

Prisma Studio feels like a NoSQL admin panel: browse tables, edit rows, and inspect relations. It writes straight to PostgreSQL, so use it carefully and avoid production data unless you have a backup.

If migrations report drift and this is disposable local data, reset:

```powershell
corepack pnpm --filter @tenantease/api exec dotenv -e ../../.env -- prisma migrate reset
```

Reset drops local database data. Back up anything useful first.

If you only need to sync a disposable local schema without creating a migration:

```powershell
corepack pnpm --filter @tenantease/api exec dotenv -e ../../.env -- prisma db push
```

Use migrations for committed schema changes.

## 6. Start Development Servers

Run both apps in one terminal:

```powershell
corepack pnpm dev
```

Or run them separately.

Terminal 1:

```powershell
corepack pnpm dev:api
```

Terminal 2:

```powershell
corepack pnpm dev:web
```

Open:

```text
http://localhost:3000
```

Health check:

```powershell
Invoke-WebRequest http://localhost:4000/health
```

Expected API response is a healthy status payload.

## 7. Login And Roles

Local OTP is mocked. The login screen shows the OTP returned by `/auth/send-otp`.

- `ADMIN`: use a phone listed in `ADMIN_PHONES`.
- `OWNER`: use an existing owner phone or promote a user from the admin console.
- `STAFF`: invite a phone from owner Staff Management, then login with that phone OTP.
- `TENANT`: use a phone that belongs to an active tenant.
- Fresh unknown phone: creates a `TENANT` account with no active booking.

Typical owner flow:

1. Login with owner phone.
2. Complete profile.
3. Open Plan & Billing and confirm the account is on `FREE`.
4. Create first property.
5. Add rooms.
6. Add tenants.
7. Generate rent entries or record payments.
8. Confirm receipts and tenant portal data.

Free plan guard:

- `FREE` allows 1 property.
- `FREE` allows 0 staff accounts.
- `STARTER` allows 1 staff account; higher plans allow more.
- A second property returns `PLAN_LIMIT_PROPERTIES`.
- Staff invite beyond plan returns `PLAN_LIMIT_STAFF`.
- Upgrade/cancel flows are UI-disabled until Razorpay subscription work is added.

## 8. SMS And OTP Providers

Default local mode:

```env
SMS_PROVIDER=mock
```

Mock mode prints OTP/SMS events in the API terminal and keeps local login fast.

Free developer SMS test:

```env
SMS_PROVIDER=textbelt
SMS_API_KEY=textbelt
```

Textbelt public key is for tiny dev testing only. It is not production-reliable and not suitable for real OTP scale.

Generic SMS gateway mode:

```env
SMS_PROVIDER=http
SMS_HTTP_URL=https://your-gateway.example/send
SMS_HTTP_AUTH_HEADER=Authorization
SMS_HTTP_AUTH_VALUE=Bearer replace_me
```

The API sends JSON with `phone`, `message`, `sender`, and `metadata`.

Production India note: real OTP/reminder SMS needs paid, DLT-compliant sending. MSG91 is the docs-preferred India path; Twilio Verify is a global paid fallback.

## 9. Production-Style Build

```powershell
corepack pnpm -r typecheck
corepack pnpm -r build
```

The API build emits from repo root because it imports workspace source types. Start script points at:

```text
apps/api/dist/apps/api/src/server.js
```

Run built apps:

```powershell
corepack pnpm --filter @tenantease/api start
corepack pnpm --filter @tenantease/web start
```

Build first before `start`.

## 10. Tests

API tests:

```powershell
corepack pnpm --filter @tenantease/api test
```

All workspace tests:

```powershell
corepack pnpm -r test
```

Current web package has a placeholder test script, so real automated coverage is API-heavy.

API tests need:

- Docker PostgreSQL running.
- `.env` pointing to `127.0.0.1:55432`.
- Prisma schema applied to local DB.
- Prisma Client generated after schema changes.

## 11. Version And Security Checks

Type/build compatibility:

```powershell
corepack pnpm -r typecheck
corepack pnpm -r build
```

Installed package view:

```powershell
corepack pnpm list -r --depth 0
```

Outdated dependency report:

```powershell
corepack pnpm outdated --recursive
```

Production security audit:

```powershell
corepack pnpm audit --prod
```

Notes:

- `pnpm outdated` exits non-zero when updates exist. That is not a build failure by itself.
- Prisma 7 reads `apps/api/prisma.config.ts` for schema, datasource URL, migrations, and seed command.
- Prisma Client uses `@prisma/adapter-pg`; run `corepack pnpm prisma:generate` after dependency installs or Prisma schema changes.
- Some pnpm commands may print Node `url.parse()` deprecation warnings from tooling. Track but do not confuse with app compile failures.

## 12. Stop Or Reset Local Services

Stop containers:

```powershell
docker compose down
```

Stop and delete local DB/Redis volumes:

```powershell
docker compose down -v
```

After deleting volumes:

```powershell
docker compose up -d postgres redis
corepack pnpm prisma:migrate
corepack pnpm prisma:seed
```

## 13. Troubleshooting

Database connection error:

```text
Can't reach database server at `127.0.0.1:55432`
```

Fix:

```powershell
docker compose up -d postgres redis
docker compose ps
```

Missing table error:

```text
The table `public.PropertySettings` does not exist in the current database.
```

Fix:

```powershell
corepack pnpm prisma:migrate
```

Plan limit error:

```text
PLAN_LIMIT_PROPERTIES
```

Fix:

```text
Use one property on FREE, or change the owner's subscription row in Prisma Studio during local testing.
```

Production upgrade flow is pending Razorpay subscription integration.

If migration drift blocks local dev and data can be dropped:

```powershell
corepack pnpm --filter @tenantease/api exec dotenv -e ../../.env -- prisma migrate reset
```

Prisma Client type errors:

```text
Module '"@prisma/client"' has no exported member 'PrismaClient'
```

Fix:

```powershell
corepack pnpm prisma:generate
```

Windows Prisma generate file-lock warning:

```text
EPERM: operation not permitted, rename ... query_engine-windows.dll.node
```

Fix:

1. Stop running API/tests.
2. Close processes holding Prisma Client.
3. Run:

```powershell
corepack pnpm prisma:generate
```

## 14. First-Time Command Block

```powershell
corepack enable
corepack pnpm install
Copy-Item .env.example .env
docker compose up -d postgres redis
corepack pnpm prisma:generate
corepack pnpm prisma:migrate
corepack pnpm prisma:seed
corepack pnpm dev
```

Then open `http://localhost:3000`.
