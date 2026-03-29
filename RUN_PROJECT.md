# Run TenantEase Locally

## 1. Install dependencies

```powershell
corepack pnpm install
```

## 2. Create `.env`

Use the root `.env` file with values like:

```env
DATABASE_URL=postgresql://postgres@127.0.0.1:55432/tenantease?schema=public
JWT_ACCESS_SECRET=your-random-secret
JWT_REFRESH_SECRET=your-random-secret
OTP_PEPPER=your-random-secret
API_PORT=4000
API_HOST=0.0.0.0
WEB_URL=http://localhost:3000
STORAGE_DIR=../../storage
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Generate the 3 secrets with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Start Docker services

```powershell
docker compose up -d postgres redis
```

## 4. Run Prisma

```powershell
corepack pnpm --filter @tenantease/api prisma:generate
corepack pnpm --filter @tenantease/api prisma:migrate
corepack pnpm --filter @tenantease/api prisma:seed
```

## 5. Start the backend

```powershell
corepack pnpm dev:api
```

Backend URL:

```text
http://localhost:4000
```

Health check:

```powershell
Invoke-WebRequest http://localhost:4000/health
```

## 6. Start the web shell

Open a second terminal:

```powershell
corepack pnpm dev:web
```

Web URL:

```text
http://localhost:3000
```

## 7. Run everything in one command

If you want both API and web together:

```powershell
corepack pnpm dev
```

## 8. Run tests

```powershell
corepack pnpm --filter @tenantease/api test
corepack pnpm -r typecheck
corepack pnpm -r build
```

## 9. Stop Docker services

```powershell
docker compose down
```

If you want to wipe local DB data too:

```powershell
docker compose down -v
```

## 10. Typical first-time flow

```powershell
corepack pnpm install
docker compose up -d postgres redis
corepack pnpm --filter @tenantease/api prisma:generate
corepack pnpm --filter @tenantease/api prisma:migrate
corepack pnpm --filter @tenantease/api prisma:seed
corepack pnpm dev
```

