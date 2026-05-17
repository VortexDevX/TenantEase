<div align="center">

# TenantEase

### PG and rental property management SaaS for owners, tenants, and admins

<p>
  <img src="https://img.shields.io/badge/Next.js-111827?style=for-the-badge" alt="Next.js" />
  <img src="https://img.shields.io/badge/Fastify-111827?style=for-the-badge" alt="Fastify" />
  <img src="https://img.shields.io/badge/Prisma-111827?style=for-the-badge" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-111827?style=for-the-badge" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/pnpm-111827?style=for-the-badge" alt="pnpm" />
  <img src="https://img.shields.io/badge/Monorepo-111827?style=for-the-badge" alt="Monorepo" />
</p>
<p>
  <a href="https://github.com/VortexDevX/TenantEase"><img src="https://img.shields.io/badge/GitHub%20Repo-111827?style=for-the-badge" alt="GitHub Repo" /></a>
</p>

</div>

---

## Overview

TenantEase is a documentation-first SaaS monorepo for property, tenant, rent, receipt, maintenance, onboarding, and admin workflows. It is still actively in progress, so the README is clear about status without forcing production polish.

<table>
<tr>
<td width="25%"><strong>Status</strong></td>
<td>In-progress SaaS architecture</td>
</tr>
<tr>
<td><strong>Stack</strong></td>
<td>pnpm workspace, Next.js web app, Fastify API, Prisma, PostgreSQL, shared TypeScript packages</td>
</tr>
<tr>
<td><strong>Built for</strong></td>
<td>PG owners, small landlords, tenants, and internal admins</td>
</tr>
</table>

## Highlights

- Monorepo structure with web, API, and shared types
- Owner, tenant, and admin-oriented product planning
- Prisma schema and migrations kept to formatting-only boundaries
- Fastify/Next structure retained
- Existing in-progress work left intact

## Feature Map

<table>
<tr>
<td width="50%" valign="top">

### Owner Portal

Properties, rooms, tenants, rent, receipts, maintenance, and owner workflows.

</td>
<td width="50%" valign="top">

### Tenant Portal

Tenant-facing views for receipts, payments, documents, and updates.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### API

Fastify service with Prisma-backed domain modules.

</td>
<td width="50%" valign="top">

### Planning Docs

Detailed docs and product notes for staged SaaS implementation.

</td>
</tr>
</table>

## Quick Start

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

## Project Structure

- apps/web/ - Next.js frontend
- apps/api/ - Fastify API and Prisma project
- packages/types/ - shared TypeScript contracts
- docs/ - planning and product documentation

## Notes

- This project is in progress by design.
- Prisma schema and monorepo structure were not changed.
- Do not run migrations unless explicitly needed for local development.

---

<div align="center">

<strong>Clean docs. Clear setup. No fake screenshots.</strong>

</div>
