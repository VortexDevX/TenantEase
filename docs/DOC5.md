# 📄 DOCUMENT 5: SYSTEM ARCHITECTURE

| Field | Value |
|---|---|
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Author** | [Your Name] |
| **Last Updated** | [Date] |
| **Status** | Draft |
| **Parent Docs** | DOC 1 — Vision, DOC 2 — PRD, DOC 3 — Flows, DOC 4 — Tech Stack |

---

## 📑 Table of Contents

1. [Architecture Philosophy](#1-architecture-philosophy)
2. [High-Level System Architecture](#2-high-level-system-architecture)
3. [Application Architecture (Monolith)](#3-application-architecture-monolith)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Architecture](#5-backend-architecture)
6. [Database Architecture](#6-database-architecture)
7. [Authentication Architecture](#7-authentication-architecture)
8. [Multi-Tenancy Architecture](#8-multi-tenancy-architecture)
9. [File Storage Architecture](#9-file-storage-architecture)
10. [Notification Architecture](#10-notification-architecture)
11. [Background Job Architecture](#11-background-job-architecture)
12. [Caching Architecture](#12-caching-architecture)
13. [Payment Architecture](#13-payment-architecture)
14. [PDF Generation Architecture](#14-pdf-generation-architecture)
15. [API Architecture](#15-api-architecture)
16. [Security Architecture](#16-security-architecture)
17. [Data Flow Diagrams](#17-data-flow-diagrams)
18. [Deployment Architecture](#18-deployment-architecture)
19. [Error Handling Architecture](#19-error-handling-architecture)
20. [Logging Architecture](#20-logging-architecture)
21. [Rate Limiting Architecture](#21-rate-limiting-architecture)
22. [Feature Flag Architecture](#22-feature-flag-architecture)
23. [Scaling Architecture (Future)](#23-scaling-architecture-future)
24. [Disaster Recovery & Backup](#24-disaster-recovery--backup)
25. [Architecture Decision Records (ADRs)](#25-architecture-decision-records-adrs)

---

## 1. Architecture Philosophy

### Core Principles

**Principle 1: Monolith First**

Start with a single deployable unit. One repo. One deployment. One mental model. Split into services only when a specific, measurable bottleneck demands it. For a solo developer building an MVP, a monolith is not a compromise — it is the correct architecture.

**Principle 2: Boring Technology**

Every technology in this stack has been battle-tested by thousands of companies. No experimental databases. No bleeding-edge frameworks. No "cool" tools that have 500 GitHub stars. Boring technology lets you focus on the product, not the infrastructure.

**Principle 3: Separation of Concerns Within the Monolith**

Monolith does not mean spaghetti. The codebase is organized into clear layers and modules. Each module has defined boundaries. This makes future extraction into microservices trivial if ever needed.

**Principle 4: Design for 10,000 Users, Deploy for 100**

Database schema supports multi-property from day one. API design supports pagination from day one. Auth supports multiple roles from day one. But the deployment is a single server, single database, zero redundancy — because that is all we need right now.

**Principle 5: Fail Gracefully**

If SMS provider is down, fall back to email. If Redis is down, skip cache and hit database. If payment gateway is down, let owners record payments manually. No single external service failure should make the product unusable.

---

## 2. High-Level System Architecture

### System Overview Diagram

```
                         ┌─────────────────┐
                         │   CLOUDFLARE     │
                         │   DNS + CDN      │
                         │   DDoS Protection│
                         └────────┬────────┘
                                  │
                                  │ HTTPS
                                  ▼
                    ┌──────────────────────────┐
                    │                          │
                    │      VERCEL EDGE         │
                    │      (Global CDN)        │
                    │                          │
                    │  ┌────────────────────┐  │
                    │  │   NEXT.JS APP      │  │
                    │  │                    │  │
                    │  │  ┌──────────────┐  │  │
                    │  │  │  FRONTEND    │  │  │
                    │  │  │  (React SSR  │  │  │
                    │  │  │   + Client)  │  │  │
                    │  │  └──────────────┘  │  │
                    │  │                    │  │
                    │  │  ┌──────────────┐  │  │
                    │  │  │  BACKEND     │  │  │
                    │  │  │  (API Routes │  │  │
                    │  │  │   + Server   │  │  │
                    │  │  │   Actions)   │  │  │
                    │  │  └──────────────┘  │  │
                    │  │                    │  │
                    │  │  ┌──────────────┐  │  │
                    │  │  │  MIDDLEWARE  │  │  │
                    │  │  │  (Auth,      │  │  │
                    │  │  │   Rate Limit)│  │  │
                    │  │  └──────────────┘  │  │
                    │  │                    │  │
                    │  └────────────────────┘  │
                    │                          │
                    └──────────┬───────────────┘
                               │
              ┌────────────────┼─────────────────┐
              │                │                 │
              ▼                ▼                 ▼
   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
   │ POSTGRESQL   │  │    REDIS     │  │ CLOUDFLARE   │
   │ (Supabase)   │  │  (Upstash)   │  │     R2       │
   │              │  │              │  │              │
   │ • Users      │  │ • OTP Store  │  │ • KYC Docs   │
   │ • Properties │  │ • Sessions   │  │ • Photos     │
   │ • Rooms      │  │ • Cache      │  │ • Receipts   │
   │ • Tenants    │  │ • Rate Limits│  │ • Agreements │
   │ • Payments   │  │ • Job Queues │  │ • Imports    │
   │ • Receipts   │  │              │  │              │
   │ • Requests   │  │              │  │              │
   └──────────────┘  └──────────────┘  └──────────────┘
              │
              │ Webhooks / API Calls
              │
   ┌──────────┴──────────────────────────────────┐
   │           EXTERNAL SERVICES                  │
   │                                              │
   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
   │  │ RAZORPAY │  │  MSG91   │  │  RESEND  │  │
   │  │ Payments │  │   SMS    │  │  Email   │  │
   │  └──────────┘  └──────────┘  └──────────┘  │
   │                                              │
   │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
   │  │  SENTRY  │  │  AXIOM   │  │ POSTHOG  │  │
   │  │  Errors  │  │  Logs    │  │ Analytics│  │
   │  └──────────┘  └──────────┘  └──────────┘  │
   │                                              │
   └──────────────────────────────────────────────┘
```

### Request Flow

```
USER (Phone Browser)
  │
  │ 1. HTTPS Request
  ▼
CLOUDFLARE (DNS + CDN + DDoS Protection)
  │
  │ 2. Routes to origin (Vercel)
  │    Static assets served from CDN cache
  ▼
VERCEL EDGE NETWORK
  │
  │ 3. Next.js Middleware runs
  │    → Auth check (JWT verification)
  │    → Rate limiting check (Redis)
  │    → Redirect logic
  ▼
NEXT.JS APPLICATION
  │
  ├── SERVER COMPONENT (page render)
  │   │
  │   │ 4. Server-side data fetching
  │   │    → Prisma query to PostgreSQL
  │   │    → Check Redis cache first
  │   │
  │   │ 5. Render HTML with data
  │   │    → Send to client (streamed)
  │   │
  │   └── CLIENT receives rendered HTML + minimal JS
  │
  └── API ROUTE (data mutation)
      │
      │ 6. Validate input (Zod)
      │ 7. Check authorization (RBAC)
      │ 8. Execute business logic (Service layer)
      │ 9. Database operation (Prisma → PostgreSQL)
      │ 10. Invalidate cache (Redis)
      │ 11. Queue side effects (notifications, PDFs)
      │ 12. Return JSON response
      │
      └── CLIENT receives JSON → updates UI
```

---

## 3. Application Architecture (Monolith)

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                    │
│                                                         │
│  Next.js Pages & Components (React)                     │
│  ├── Owner Dashboard Pages                              │
│  ├── Tenant Portal Pages                                │
│  ├── Auth Pages                                         │
│  ├── Public Pages (Landing, Listings)                   │
│  └── Admin Pages                                        │
│                                                         │
│  Responsibilities:                                      │
│  → Render UI                                            │
│  → Handle user interactions                             │
│  → Form validation (client-side)                        │
│  → State management (Zustand, TanStack Query)           │
│  → Call API endpoints                                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                      API LAYER                          │
│                                                         │
│  Next.js Route Handlers (app/api/*)                     │
│  ├── Auth routes (/api/v1/auth/*)                       │
│  ├── Property routes (/api/v1/properties/*)             │
│  ├── Room routes (/api/v1/rooms/*)                      │
│  ├── Tenant routes (/api/v1/tenants/*)                  │
│  ├── Payment routes (/api/v1/payments/*)                │
│  ├── Maintenance routes (/api/v1/maintenance/*)         │
│  ├── Receipt routes (/api/v1/receipts/*)                │
│  ├── Webhook routes (/api/webhooks/*)                   │
│  └── Admin routes (/api/admin/*)                        │
│                                                         │
│  Responsibilities:                                      │
│  → Parse and validate request (Zod)                     │
│  → Authenticate request (JWT middleware)                │
│  → Authorize request (RBAC check)                       │
│  → Call service layer                                   │
│  → Format and return response                           │
│  → Handle HTTP-level errors                             │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                    SERVICE LAYER                        │
│                                                         │
│  Business Logic Services (src/services/*)               │
│  ├── PropertyService                                    │
│  ├── RoomService                                        │
│  ├── TenantService                                      │
│  ├── PaymentService                                     │
│  ├── RentService                                        │
│  ├── ReceiptService                                     │
│  ├── MaintenanceService                                 │
│  ├── ReminderService                                    │
│  ├── NotificationService                                │
│  ├── SubscriptionService                                │
│  ├── AnalyticsService                                   │
│  └── AgreementService                                   │
│                                                         │
│  Responsibilities:                                      │
│  → Business rules and validation                        │
│  → Orchestrate database operations                      │
│  → Orchestrate external service calls                   │
│  → Transaction management                               │
│  → Audit logging                                        │
│  → Cache management (read/invalidate)                   │
│  → Queue background jobs                                │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                 DATA ACCESS LAYER                       │
│                                                         │
│  Prisma ORM (src/lib/db.ts)                             │
│  ├── Prisma Client (singleton)                          │
│  ├── Prisma Schema (prisma/schema.prisma)               │
│  ├── Migrations (prisma/migrations/*)                   │
│  └── Seed Scripts (prisma/seed.ts)                      │
│                                                         │
│  Responsibilities:                                      │
│  → Database queries (CRUD)                              │
│  → Transaction handling                                 │
│  → Relation loading                                     │
│  → Query optimization                                   │
│  → Schema migrations                                    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│                INFRASTRUCTURE LAYER                     │
│                                                         │
│  External Service Clients (src/lib/*)                   │
│  ├── Redis client (cache, OTP, rate limit)              │
│  ├── S3/R2 client (file upload/download)                │
│  ├── Razorpay client (payments)                         │
│  ├── MSG91 client (SMS)                                 │
│  ├── Resend client (email)                              │
│  ├── Sentry client (error tracking)                     │
│  └── PDF generator (receipt/agreement generation)       │
│                                                         │
│  Responsibilities:                                      │
│  → Wrap external API calls                              │
│  → Handle retries and timeouts                          │
│  → Abstract provider-specific details                   │
│  → Provide clean interfaces for service layer           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Module Dependency Rules

```
ALLOWED DEPENDENCIES (top can call down, not up):

  Presentation Layer
       │
       ▼ (calls)
  API Layer
       │
       ▼ (calls)
  Service Layer
       │
       ▼ (calls)
  Data Access Layer + Infrastructure Layer

FORBIDDEN:
  ✗ Service Layer cannot import React components
  ✗ API Layer cannot directly call Prisma (must go through Service)
  ✗ Presentation Layer cannot directly call Prisma
  ✗ Data Access Layer cannot call external services
  ✗ Infrastructure Layer cannot contain business logic
  ✗ Circular dependencies between services
    (use event-based communication or shared utility instead)

WHY THESE RULES MATTER:
  → Service layer can be tested without HTTP or UI
  → Infrastructure providers can be swapped 
    (Resend → SendGrid) without touching business logic
  → Database can be changed (Prisma → Drizzle) 
    without touching services
  → Frontend framework can be changed (Next → Remix)
    without touching backend logic
```

---

## 4. Frontend Architecture

### 4.1 Page Structure

```
app/
│
├── (marketing)/                    ← Public marketing pages
│   ├── page.tsx                    ← Landing page (/)
│   ├── pricing/page.tsx            ← Pricing page
│   ├── features/page.tsx           ← Features page
│   ├── about/page.tsx              ← About page
│   └── layout.tsx                  ← Marketing layout (header, footer)
│
├── (auth)/                         ← Authentication pages
│   ├── login/page.tsx              ← Owner login
│   ├── register/page.tsx           ← Owner registration
│   ├── portal-login/page.tsx       ← Tenant portal login
│   └── layout.tsx                  ← Minimal auth layout
│
├── (dashboard)/                    ← Owner dashboard (protected)
│   ├── layout.tsx                  ← Dashboard layout (sidebar, topbar)
│   ├── page.tsx                    ← Main dashboard (/)
│   ├── properties/
│   │   ├── page.tsx                ← Property list
│   │   ├── new/page.tsx            ← Add property
│   │   └── [propertyId]/
│   │       ├── page.tsx            ← Property detail/dashboard
│   │       ├── rooms/
│   │       │   ├── page.tsx        ← Room list/grid
│   │       │   ├── new/page.tsx    ← Add room
│   │       │   └── [roomId]/page.tsx ← Room detail
│   │       ├── tenants/
│   │       │   ├── page.tsx        ← Tenant list
│   │       │   ├── new/page.tsx    ← Add tenant
│   │       │   ├── import/page.tsx ← Bulk import
│   │       │   └── [tenantId]/
│   │       │       ├── page.tsx    ← Tenant profile
│   │       │       └── vacate/page.tsx ← Vacate form
│   │       ├── rent/
│   │       │   ├── page.tsx        ← Rent status overview
│   │       │   └── record/page.tsx ← Record payment
│   │       ├── maintenance/
│   │       │   ├── page.tsx        ← All requests
│   │       │   └── [requestId]/page.tsx ← Request detail
│   │       ├── receipts/
│   │       │   └── page.tsx        ← Receipt management
│   │       ├── utilities/
│   │       │   └── page.tsx        ← Utility billing
│   │       ├── announcements/
│   │       │   └── page.tsx        ← Announcements
│   │       ├── reports/
│   │       │   └── page.tsx        ← Reports & analytics
│   │       └── settings/
│   │           └── page.tsx        ← Property settings
│   ├── settings/
│   │   ├── page.tsx                ← Account settings
│   │   ├── subscription/page.tsx   ← Plan management
│   │   └── staff/page.tsx          ← Staff management
│   └── onboarding/
│       └── page.tsx                ← Onboarding wizard
│
├── (portal)/                       ← Tenant portal (protected)
│   ├── layout.tsx                  ← Portal layout (simpler than dashboard)
│   ├── page.tsx                    ← Portal home
│   ├── payments/page.tsx           ← Payment history
│   ├── receipts/page.tsx           ← Download receipts
│   ├── maintenance/
│   │   ├── page.tsx                ← My requests
│   │   └── new/page.tsx            ← Raise request
│   ├── announcements/page.tsx      ← View announcements
│   └── profile/page.tsx            ← My profile
│
├── (admin)/                        ← Internal admin (protected)
│   ├── layout.tsx
│   ├── page.tsx                    ← Admin dashboard
│   ├── users/page.tsx              ← User management
│   └── metrics/page.tsx            ← Platform metrics
│
├── pg/                             ← Public vacancy listings
│   └── [slug]/page.tsx             ← Individual listing page (SEO)
│
└── api/                            ← API routes (backend)
    └── v1/
        └── ...
```

### 4.2 Component Architecture

```
src/
├── components/
│   │
│   ├── ui/                         ← shadcn/ui base components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── table.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── sheet.tsx
│   │   ├── skeleton.tsx
│   │   ├── avatar.tsx
│   │   ├── calendar.tsx
│   │   └── ...
│   │
│   ├── layout/                     ← Layout components
│   │   ├── dashboard-layout.tsx    ← Owner dashboard shell
│   │   ├── portal-layout.tsx       ← Tenant portal shell
│   │   ├── sidebar.tsx             ← Dashboard sidebar navigation
│   │   ├── topbar.tsx              ← Top navigation bar
│   │   ├── property-switcher.tsx   ← Property dropdown in topbar
│   │   ├── notification-bell.tsx   ← Notification icon + dropdown
│   │   ├── mobile-nav.tsx          ← Mobile bottom navigation
│   │   └── page-header.tsx         ← Consistent page headers
│   │
│   ├── forms/                      ← Form components
│   │   ├── property-form.tsx       ← Add/edit property form
│   │   ├── room-form.tsx           ← Add/edit room form
│   │   ├── tenant-form.tsx         ← Add/edit tenant form
│   │   ├── payment-form.tsx        ← Record payment form
│   │   ├── maintenance-form.tsx    ← Raise maintenance request
│   │   ├── reminder-config-form.tsx← Reminder settings
│   │   ├── announcement-form.tsx   ← Post announcement
│   │   ├── vacate-form.tsx         ← Vacate tenant form
│   │   ├── utility-billing-form.tsx← Enter meter readings
│   │   └── settings-form.tsx       ← Account/property settings
│   │
│   ├── dashboard/                  ← Dashboard-specific components
│   │   ├── financial-summary.tsx   ← Revenue card (collected/pending)
│   │   ├── occupancy-overview.tsx  ← Occupancy stats + visual
│   │   ├── action-items.tsx        ← Things needing attention
│   │   ├── recent-activity.tsx     ← Activity timeline
│   │   ├── quick-actions.tsx       ← Action buttons
│   │   └── onboarding-checklist.tsx← Setup progress checklist
│   │
│   ├── tenants/                    ← Tenant-related components
│   │   ├── tenant-list.tsx         ← Filterable tenant table
│   │   ├── tenant-card.tsx         ← Tenant card (for mobile list)
│   │   ├── tenant-profile-header.tsx
│   │   ├── payment-history.tsx     ← Tenant's payment timeline
│   │   ├── document-viewer.tsx     ← KYC document display
│   │   └── tenant-status-badge.tsx ← Active/Notice/Vacated badge
│   │
│   ├── rooms/                      ← Room-related components
│   │   ├── room-grid.tsx           ← Visual room map (color-coded)
│   │   ├── room-list.tsx           ← Table view of rooms
│   │   ├── room-card.tsx           ← Individual room card
│   │   └── occupancy-indicator.tsx ← Visual occupancy bar
│   │
│   ├── rent/                       ← Rent-related components
│   │   ├── rent-status-table.tsx   ← Monthly rent overview table
│   │   ├── rent-status-card.tsx    ← Individual tenant rent card
│   │   ├── collection-progress.tsx ← Progress bar (collected/total)
│   │   └── rent-breakdown.tsx      ← Itemized rent display
│   │
│   ├── maintenance/                ← Maintenance components
│   │   ├── request-list.tsx        ← Filterable request table
│   │   ├── request-card.tsx        ← Individual request card
│   │   ├── request-timeline.tsx    ← Status change timeline
│   │   └── urgency-badge.tsx       ← Low/Medium/High/Emergency badge
│   │
│   ├── receipts/                   ← Receipt components
│   │   ├── receipt-preview.tsx     ← In-browser receipt preview
│   │   ├── receipt-list.tsx        ← List of generated receipts
│   │   └── receipt-template.tsx    ← React-PDF receipt template
│   │
│   ├── charts/                     ← Analytics chart components
│   │   ├── income-chart.tsx        ← Monthly income bar chart
│   │   ├── occupancy-chart.tsx     ← Occupancy trend line chart
│   │   ├── collection-chart.tsx    ← Collection rate trend
│   │   ├── payment-mode-chart.tsx  ← Payment mode pie chart
│   │   └── expense-chart.tsx       ← Expense breakdown pie chart
│   │
│   ├── portal/                     ← Tenant portal components
│   │   ├── portal-home.tsx         ← Portal landing screen
│   │   ├── portal-rent-status.tsx  ← Current rent card
│   │   ├── portal-payment-history.tsx
│   │   ├── portal-receipts.tsx
│   │   └── portal-maintenance.tsx
│   │
│   └── shared/                     ← Shared/generic components
│       ├── data-table.tsx          ← Generic sortable/filterable table
│       ├── empty-state.tsx         ← "No data" placeholder
│       ├── loading-state.tsx       ← Loading skeleton wrapper
│       ├── error-state.tsx         ← Error display with retry
│       ├── confirm-dialog.tsx      ← Reusable confirmation modal
│       ├── file-upload.tsx         ← File/image upload component
│       ├── image-gallery.tsx       ← Photo gallery with lightbox
│       ├── currency-display.tsx    ← ₹ formatted amount display
│       ├── date-display.tsx        ← DD/MM/YYYY formatted date
│       ├── phone-display.tsx       ← Clickable phone number
│       ├── stat-card.tsx           ← Metric display card
│       ├── search-input.tsx        ← Search with debounce
│       ├── pagination.tsx          ← Page navigation
│       └── export-button.tsx       ← Export to Excel/CSV/PDF
```

### 4.3 State Management Architecture

```
STATE CATEGORIES AND WHERE THEY LIVE:

┌──────────────────────────────────────────────────────────┐
│                                                          │
│  SERVER STATE (data from API)     → TanStack Query       │
│  ──────────────────────────────                          │
│  Tenants list                                            │
│  Rooms list                                              │
│  Rent status                                             │
│  Maintenance requests                                    │
│  Payment history                                         │
│  Property details                                        │
│  Dashboard metrics                                       │
│  Receipts                                                │
│  Announcements                                           │
│  Subscription info                                       │
│                                                          │
│  WHY: TanStack Query handles caching, refetching,        │
│  loading states, error states, background updates,       │
│  optimistic updates. No manual state management needed.  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  CLIENT STATE (UI state)          → Zustand              │
│  ──────────────────────────────                          │
│  Currently selected property ID                          │
│  Sidebar open/closed                                     │
│  Theme preference (light/dark)                           │
│  Onboarding wizard current step                          │
│  Table view preferences (list vs grid)                   │
│  Last visited page per property                          │
│                                                          │
│  WHY: Zustand is tiny (2KB), no boilerplate,             │
│  persists to localStorage. Perfect for small UI state.   │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  FORM STATE (form inputs)         → React Hook Form      │
│  ──────────────────────────────                          │
│  Add tenant form values                                  │
│  Record payment form values                              │
│  Settings form values                                    │
│  Any form input state                                    │
│                                                          │
│  WHY: Uncontrolled components = no re-renders per        │
│  keystroke = fast forms on budget phones.                │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  URL STATE (filters, pagination)  → URL Search Params    │
│  ──────────────────────────────                          │
│  Current page number                                     │
│  Filter values (status=unpaid)                           │
│  Sort column and direction                               │
│  Search query                                            │
│  Selected month (rent status)                            │
│                                                          │
│  WHY: URL is shareable, bookmarkable, browser back       │
│  button works. User can share "unpaid tenants" view      │
│  as a link. nuqs or useSearchParams for type safety.     │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 4.4 Data Fetching Pattern

```
PATTERN: Server Components + TanStack Query

PAGE LOAD (initial):
  → Server Component fetches data on the server
  → HTML rendered with data (fast first paint)
  → Data passed to client as initial data for TanStack Query
  → No loading spinner on first load

SUBSEQUENT INTERACTIONS:
  → TanStack Query refetches on focus, interval, or mutation
  → Client-side fetching with loading/error states
  → Optimistic updates for mutations (instant UI feedback)

EXAMPLE:

  // app/(dashboard)/properties/[id]/tenants/page.tsx
  // SERVER COMPONENT — runs on server
  
  export default async function TenantsPage({ params }) {
    // Fetch on server — no loading state, no spinner
    const tenants = await tenantService.getByProperty(params.id);
    
    return (
      <TenantListClient 
        initialData={tenants}
        propertyId={params.id} 
      />
    );
  }

  // components/tenants/tenant-list-client.tsx
  // CLIENT COMPONENT — hydrates on client
  
  "use client";
  
  export function TenantListClient({ initialData, propertyId }) {
    const { data: tenants } = useQuery({
      queryKey: ['tenants', propertyId],
      queryFn: () => fetchTenants(propertyId),
      initialData: initialData,  // No loading on first render
      staleTime: 5 * 60 * 1000,  // Refetch after 5 min
    });
    
    // Render tenant list with tenants data
  }
```

---

## 5. Backend Architecture

### 5.1 Service Layer Design

```
EACH SERVICE FOLLOWS THIS PATTERN:

┌─────────────────────────────────────────┐
│           TenantService                 │
├─────────────────────────────────────────┤
│                                         │
│  METHODS:                               │
│  ├── create(data, ownerId)              │
│  ├── update(id, data, ownerId)          │
│  ├── getById(id, ownerId)               │
│  ├── getByProperty(propertyId, filters) │
│  ├── vacate(id, settlementData)         │
│  ├── transferRoom(id, newRoomId)        │
│  ├── bulkImport(csvData, propertyId)    │
│  └── delete(id, ownerId)               │
│                                         │
│  DEPENDENCIES (injected):              │
│  ├── db (Prisma client)                │
│  ├── cache (Redis client)              │
│  ├── notifications (NotificationSvc)   │
│  ├── storage (S3/R2 client)            │
│  └── queue (BullMQ queue)              │
│                                         │
│  RESPONSIBILITIES:                      │
│  ├── Validate business rules            │
│  ├── Execute database transactions      │
│  ├── Invalidate relevant caches         │
│  ├── Queue notifications                │
│  ├── Create audit log entries           │
│  └── Return clean data objects          │
│                                         │
│  DOES NOT:                              │
│  ├── Parse HTTP requests                │
│  ├── Format HTTP responses              │
│  ├── Handle authentication              │
│  └── Render UI                          │
│                                         │
└─────────────────────────────────────────┘
```

### 5.2 Service Interaction Map

```
Which service calls which:

PropertyService
  └── uses: cache

RoomService
  └── uses: cache

TenantService
  ├── uses: RoomService (update occupancy)
  ├── uses: RentService (generate first rent entry)
  ├── uses: NotificationService (send invite SMS)
  ├── uses: StorageService (KYC document upload)
  └── uses: cache

PaymentService
  ├── uses: RentService (update rent status)
  ├── uses: NotificationService (payment confirmation)
  ├── uses: ReceiptService (auto-generate receipt prompt)
  ├── uses: ReminderService (cancel pending reminders)
  └── uses: cache

RentService
  ├── uses: TenantService (get active tenants)
  └── uses: cache

ReceiptService
  ├── uses: PDFService (generate PDF)
  ├── uses: StorageService (store PDF)
  ├── uses: NotificationService (send receipt)
  └── uses: cache

ReminderService
  ├── uses: RentService (get unpaid entries)
  ├── uses: NotificationService (send reminder)
  └── uses: cache (reminder logs)

NotificationService
  ├── uses: EmailService (Resend)
  ├── uses: SMSService (MSG91)
  ├── uses: WhatsAppService (Interakt — Phase 2)
  └── uses: InAppNotificationService (database)

MaintenanceService
  ├── uses: NotificationService
  └── uses: cache

SubscriptionService
  ├── uses: RazorpayService
  └── uses: NotificationService
```

### 5.3 Transaction Boundaries

```
CRITICAL TRANSACTIONS (must be atomic):

1. RECORD PAYMENT
   BEGIN TRANSACTION
     → Create payment record
     → Update rent entry status (unpaid → paid/partial)
     → Update rent entry amount_paid
     → Create audit log entry
   COMMIT
   
   AFTER COMMIT (non-transactional, can fail independently):
     → Invalidate cache
     → Queue notification
     → Queue receipt generation prompt

2. ADD TENANT
   BEGIN TRANSACTION
     → Create tenant record
     → Update room occupancy count
     → Update room status (vacant → occupied/partial)
     → Create first month rent entry
     → Create deposit record
     → Create audit log entry
   COMMIT
   
   AFTER COMMIT:
     → Invalidate cache (rooms, tenants, dashboard)
     → Queue invitation SMS/email

3. VACATE TENANT
   BEGIN TRANSACTION
     → Update tenant status → vacated
     → Update room occupancy count (decrement)
     → Update room status if now vacant
     → Create settlement record
     → Cancel future rent entries
     → Create audit log entry
   COMMIT
   
   AFTER COMMIT:
     → Invalidate cache
     → Queue settlement notification
     → Generate settlement PDF

4. ROOM TRANSFER
   BEGIN TRANSACTION
     → Update old room: decrement occupancy, update status
     → Update new room: increment occupancy, update status
     → Update tenant record: new room_id
     → Update rent amount if changed
     → Create audit log entry
   COMMIT
   
   AFTER COMMIT:
     → Invalidate cache (both rooms)
     → Queue notification to tenant

5. ONLINE PAYMENT (Razorpay webhook)
   BEGIN TRANSACTION
     → Verify Razorpay signature
     → Create payment record
     → Update rent entry status
     → Create audit log entry
   COMMIT
   
   AFTER COMMIT:
     → Generate receipt
     → Send confirmation to tenant
     → Notify owner
     → Invalidate cache

WHY THIS MATTERS:
  → If "create payment" succeeds but "update rent status" fails,
    the database is in an inconsistent state.
  → Transactions ensure either ALL changes apply or NONE do.
  → Side effects (notifications, cache) happen AFTER commit
    because they don't need to be transactional and shouldn't
    block the main operation.
```

---

## 6. Database Architecture

### 6.1 Entity Relationship Overview

```
┌──────────┐     ┌──────────────┐     ┌──────────┐
│  OWNER   │────<│   PROPERTY   │────<│   ROOM   │
│  (User)  │ 1:N │              │ 1:N │          │
└──────────┘     └──────────────┘     └─────┬────┘
     │                  │                    │
     │                  │                 1:N│
     │                  │                    │
     │           ┌──────┴──────┐      ┌─────┴────┐
     │           │ ANNOUNCEMENT│      │  TENANT  │
     │           └─────────────┘      └────┬─────┘
     │                                     │
     │                               ┌─────┼──────────┐
     │                               │     │          │
     │                          1:N  │  1:N│     1:N  │
     │                               │     │          │
     │                        ┌──────┴──┐ ┌┴────────┐ ┌┴───────────┐
     │                        │  RENT   │ │ PAYMENT │ │MAINTENANCE │
     │                        │  ENTRY  │ │         │ │  REQUEST   │
     │                        └────┬────┘ └─────────┘ └────────────┘
     │                             │
     │                          1:N│
     │                             │
     │                        ┌────┴────┐
     │                        │ RECEIPT │
     │                        └─────────┘
     │
     │           ┌──────────────────┐
     └──────────<│   SUBSCRIPTION   │
           1:1   └──────────────────┘


FULL ENTITY LIST:

  CORE ENTITIES:
  ├── User (owners, tenants, staff — polymorphic)
  ├── Property
  ├── Room
  ├── Tenant (extends User for tenant-specific data)
  ├── RentEntry (monthly rent record)
  ├── Payment
  └── Receipt

  SUPPORTING ENTITIES:
  ├── MaintenanceRequest
  ├── MaintenanceComment
  ├── Announcement
  ├── AnnouncementRead
  ├── Notification (in-app)
  ├── ReminderLog
  ├── AuditLog
  ├── SecurityDeposit
  ├── AdditionalCharge
  ├── UtilityReading
  ├── Agreement
  ├── Staff (role assignment)
  ├── Subscription
  ├── Invoice (platform billing)
  └── Enquiry (vacancy listing)
```

### 6.2 Key Schema Decisions

```
DECISION 1: UUID PRIMARY KEYS (not auto-increment integers)

  WHY:
  → Can't guess IDs (security: /api/tenants/1, /api/tenants/2)
  → Safe for distributed systems (no collision risk)
  → Can generate on client before sending to server
  → Standard for modern SaaS applications

  TRADEOFF:
  → Slightly larger storage (16 bytes vs 4 bytes)
  → Slightly slower indexing than integers
  → Worth it for security and flexibility


DECISION 2: SOFT DELETE (not hard delete)

  WHY:
  → Vacated tenants' data preserved for records
  → Accidentally deleted property can be recovered
  → Audit trail maintained
  → Legal compliance (rental records should be retained)

  IMPLEMENTATION:
  → Every major entity has: deleted_at TIMESTAMP NULL
  → Default query filter: WHERE deleted_at IS NULL
  → Prisma middleware auto-applies soft delete filter
  → Hard delete after 90 days via cleanup job


DECISION 3: MONEY STORED IN PAISA (integer, not float)

  WHY:
  → Floating point math is broken: 0.1 + 0.2 ≠ 0.3
  → ₹8,000.50 stored as 800050 (integer)
  → All calculations in paisa, convert to rupees for display
  → No rounding errors in financial calculations
  
  IMPLEMENTATION:
  → Database column: INTEGER (not DECIMAL or FLOAT)
  → Application: divide by 100 for display
  → API: accepts and returns paisa
  → Frontend: formatCurrency(800050) → "₹8,000.50"


DECISION 4: TIMESTAMPS IN UTC, DISPLAY IN IST

  WHY:
  → Database stores UTC (universal, unambiguous)
  → Application converts to IST for display
  → If we ever expand beyond India, timezone handling is correct
  → Daylight saving edge cases eliminated (India doesn't observe DST)
  
  IMPLEMENTATION:
  → PostgreSQL: TIMESTAMP WITH TIME ZONE
  → Prisma: DateTime (maps to timestamptz)
  → Frontend: dayjs or date-fns with IST timezone conversion


DECISION 5: ENUM TYPES FOR STATUS FIELDS

  WHY:
  → Database-level validation (can't insert invalid status)
  → TypeScript type safety (Prisma generates enum types)
  → Self-documenting schema

  IMPLEMENTATION:
  → PostgreSQL: CREATE TYPE tenant_status AS ENUM (...)
  → Prisma: enum TenantStatus { ACTIVE NOTICE VACATED }
  → Used for: tenant_status, rent_status, request_status,
    deposit_status, room_status, payment_mode, etc.


DECISION 6: JSONB FOR FLEXIBLE DATA

  WHERE USED:
  → additional_charges on RentEntry (array of {label, amount})
  → amenities on Room (array of strings)
  → notification_preferences on User (key-value config)
  → reminder_config on Property (complex config object)
  → onboarding_state on User (wizard progress)
  → settlement_details on VacateRecord (flexible deductions)

  WHY NOT SEPARATE TABLES:
  → These are small, frequently read with the parent
  → No need to query/filter by individual items
  → Adding a new charge type doesn't need schema migration
  → JSONB is indexed and queryable in PostgreSQL if needed


DECISION 7: ROW-LEVEL SECURITY CONCEPT IN APPLICATION

  → Every query includes owner_id / property_id filter
  → Service layer ALWAYS checks: does this owner own this property?
  → API middleware attaches authenticated user's ID
  → Service layer uses it to scope ALL queries
  → A bug in one endpoint cannot expose another owner's data
  → Implemented at Prisma query level, not PostgreSQL RLS
    (simpler for application-managed multi-tenancy)
```

### 6.3 Indexing Strategy

```
PRIMARY INDEXES (auto-created):
  → id (UUID primary key) on every table

UNIQUE INDEXES:
  → users.phone (unique — login identifier)
  → tenants.phone + tenants.property_id (unique per property)
  → rooms.room_number + rooms.property_id (unique per property)
  → receipts.receipt_number (globally unique)

FOREIGN KEY INDEXES:
  → properties.owner_id
  → rooms.property_id
  → tenants.room_id
  → tenants.property_id
  → rent_entries.tenant_id
  → rent_entries.property_id
  → payments.rent_entry_id
  → payments.tenant_id
  → receipts.payment_id
  → maintenance_requests.tenant_id
  → maintenance_requests.property_id

QUERY-SPECIFIC INDEXES:
  → rent_entries(property_id, month, year) 
    — monthly rent status page
  → rent_entries(tenant_id, status) 
    — find unpaid entries for a tenant
  → rent_entries(property_id, status, due_date)
    — reminder job: find overdue entries
  → tenants(property_id, status)
    — tenant list filtered by active/vacated
  → maintenance_requests(property_id, status)
    — maintenance dashboard filtered by status
  → audit_logs(entity_type, entity_id, created_at)
    — activity log for any entity
  → notifications(user_id, is_read, created_at)
    — unread notifications for a user

PARTIAL INDEXES:
  → tenants(property_id) WHERE status = 'ACTIVE'
    — most queries only care about active tenants
  → rent_entries(property_id, due_date) WHERE status IN ('UNPAID', 'PARTIAL')
    — reminder job only cares about unpaid entries
  → rooms(property_id) WHERE deleted_at IS NULL
    — soft delete filter

FULL-TEXT SEARCH INDEX:
  → tenants: GIN index on to_tsvector(name || ' ' || phone)
    — tenant search by name or phone
```

---

## 7. Authentication Architecture

### 7.1 Auth Flow Architecture

```
┌──────────┐     ┌──────────────┐     ┌──────────┐     ┌──────────┐
│  CLIENT  │────>│  NEXT.JS     │────>│  REDIS   │     │   SMS    │
│ (Browser)│<────│  MIDDLEWARE  │<────│  (OTP)   │     │  (MSG91) │
└──────────┘     └──────┬───────┘     └──────────┘     └──────────┘
                        │                                    ▲
                        │                                    │
                        ▼                                    │
                 ┌──────────────┐                            │
                 │  AUTH API    │────────────────────────────┘
                 │  ROUTES      │
                 │              │     ┌──────────┐
                 │ /send-otp    │────>│ POSTGRES │
                 │ /verify-otp  │<────│ (Users)  │
                 │ /refresh     │     └──────────┘
                 │ /logout      │
                 │ /me          │
                 └──────────────┘


AUTHENTICATION STATE MACHINE:

  ┌──────────────┐
  │ UNAUTHENTICATED│
  └──────┬───────┘
         │ enters phone number
         ▼
  ┌──────────────┐
  │  OTP_SENT    │
  └──────┬───────┘
         │ enters correct OTP
         ├─────────────────────────────────┐
         ▼                                 ▼
  ┌──────────────┐                 ┌──────────────┐
  │  NEW_USER    │                 │ AUTHENTICATED │
  │ (needs setup)│                 │ (returning)    │
  └──────┬───────┘                 └──────┬───────┘
         │ completes profile               │
         ▼                                 │
  ┌──────────────┐                         │
  │ AUTHENTICATED │<───────────────────────┘
  └──────┬───────┘
         │ token expires (15 min)
         ▼
  ┌──────────────┐
  │ TOKEN_EXPIRED │
  └──────┬───────┘
         │ refresh token valid
         ├──────> AUTHENTICATED (new access token)
         │ refresh token expired (30 days)
         └──────> UNAUTHENTICATED (must re-login)
```

### 7.2 Token Architecture

```
TWO-TOKEN SYSTEM:

┌────────────────────────────────────────────────────┐
│ ACCESS TOKEN                                       │
│                                                    │
│ Type:     JWT (JSON Web Token)                     │
│ Lifetime: 15 minutes                               │
│ Storage:  In-memory (JavaScript variable)           │
│           NOT in localStorage (XSS vulnerable)     │
│           NOT in cookie (not needed for access)    │
│ Sent via: Authorization: Bearer <token> header     │
│                                                    │
│ Contains:                                          │
│ {                                                  │
│   sub: "user-uuid",                                │
│   role: "owner",                                   │
│   plan: "pro",                                     │
│   iat: 1717578000,                                 │
│   exp: 1717578900                                  │
│ }                                                  │
│                                                    │
│ WHY short-lived:                                   │
│ → If stolen, attacker has only 15 minutes          │
│ → No need to maintain a token blacklist            │
│ → Stateless verification (just check signature)    │
│                                                    │
├────────────────────────────────────────────────────┤
│ REFRESH TOKEN                                      │
│                                                    │
│ Type:     Opaque string (random UUID)              │
│           OR JWT with minimal claims               │
│ Lifetime: 30 days                                  │
│ Storage:  httpOnly, secure, sameSite=strict cookie  │
│           Cannot be accessed by JavaScript (XSS safe)│
│ Sent via: Automatically with every request (cookie) │
│                                                    │
│ On use:                                            │
│ → Verify refresh token is valid                    │
│ → Issue new access token                           │
│ → Optionally rotate refresh token                  │
│                                                    │
│ On logout:                                         │
│ → Delete cookie                                    │
│ → Add to Redis blacklist (TTL = remaining lifetime)│
│                                                    │
└────────────────────────────────────────────────────┘


CLIENT-SIDE TOKEN MANAGEMENT:

  1. On login success:
     → Store access token in memory (React state/context)
     → Refresh token automatically stored as httpOnly cookie
  
  2. On API call:
     → Attach access token to Authorization header
     → If 401 response (expired):
       → Call /api/auth/refresh
       → Get new access token
       → Retry original request
       → If refresh also fails → redirect to login
  
  3. On page reload:
     → Access token lost (was in memory)
     → Call /api/auth/refresh (cookie sent automatically)
     → Get new access token
     → Continue as authenticated
  
  4. On logout:
     → Clear access token from memory
     → Call /api/auth/logout (clears cookie server-side)
     → Redirect to login page
```

---

## 8. Multi-Tenancy Architecture

### 8.1 Data Isolation Strategy

```
MULTI-TENANCY MODEL: Shared Database, Shared Schema

  All owners share the same database and tables.
  Data isolation is enforced at the APPLICATION level,
  not the database level.

  ┌─────────────────────────────────────────────┐
  │              SINGLE DATABASE                 │
  │                                             │
  │  ┌──────────────────────────────────────┐   │
  │  │         properties TABLE              │   │
  │  │                                      │   │
  │  │  id=1  owner_id=A  name="Sharma PG"  │   │
  │  │  id=2  owner_id=A  name="Sharma PG2" │   │
  │  │  id=3  owner_id=B  name="Kumar PG"   │   │
  │  │  id=4  owner_id=C  name="Singh PG"   │   │
  │  │                                      │   │
  │  └──────────────────────────────────────┘   │
  │                                             │
  │  Owner A can ONLY see properties 1, 2       │
  │  Owner B can ONLY see property 3            │
  │  Owner C can ONLY see property 4            │
  │                                             │
  └─────────────────────────────────────────────┘

WHY SHARED DB + SHARED SCHEMA:
  → Simplest to build and maintain
  → Cheapest (one database instance)
  → Easy to query across all tenants (admin analytics)
  → Sufficient for millions of records
  → Standard approach for B2B SaaS at our scale

ISOLATION ENFORCEMENT:

  LAYER 1: API Middleware
  → Extract authenticated user's ID from JWT
  → Attach to request context
  → Every downstream query MUST use this ID

  LAYER 2: Service Layer
  → Every service method receives ownerId parameter
  → Every database query includes WHERE owner_id = :ownerId
  → Cross-owner queries are impossible through normal code paths

  LAYER 3: Prisma Query Extension (defense in depth)
  → Prisma middleware or extension that auto-injects
    owner_id filter on every query
  → Even if a developer forgets to filter in service code,
    the middleware catches it
```

### 8.2 Data Ownership Chain

```
OWNERSHIP HIERARCHY:

  User (Owner)
    └── owns → Property
         └── contains → Room
              └── houses → Tenant
                   ├── has → RentEntry
                   │         └── has → Payment
                   │                   └── has → Receipt
                   ├── raises → MaintenanceRequest
                   │            └── has → MaintenanceComment
                   └── has → SecurityDeposit

  RULE: To access any entity, you must verify the full chain:
  
  To access a Payment:
    → Payment belongs to RentEntry
    → RentEntry belongs to Tenant
    → Tenant belongs to Property
    → Property belongs to Owner
    → Owner must match authenticated user

  IN PRACTICE (optimized):
    → Most entities have a direct property_id column
    → Query: WHERE property_id = :propertyId 
             AND property.owner_id = :ownerId
    → Single JOIN verification, not chain traversal


TENANT PORTAL ISOLATION:

  When a Tenant logs in:
    → They can ONLY see:
      • Their own rent entries
      • Their own payments
      • Their own receipts
      • Their own maintenance requests
      • Property-wide announcements
    → They CANNOT see:
      • Other tenants' data
      • Financial summaries
      • Owner's settings
      • Room management
    → Query filter: WHERE tenant_id = :authenticatedTenantId
```

---

## 9. File Storage Architecture

### 9.1 Upload Architecture

```
PRESIGNED URL FLOW (recommended):

  ┌──────────┐     ┌──────────────┐     ┌──────────────┐
  │  CLIENT  │     │   BACKEND    │     │  CLOUDFLARE  │
  │ (Browser)│     │  (Next.js)   │     │     R2       │
  └────┬─────┘     └──────┬───────┘     └──────┬───────┘
       │                  │                     │
       │ 1. Request       │                     │
       │    upload URL    │                     │
       │ ────────────────>│                     │
       │                  │                     │
       │                  │ 2. Generate         │
       │                  │    presigned URL     │
       │                  │ ──────────────────> │
       │                  │                     │
       │                  │ 3. Return           │
       │                  │    presigned URL     │
       │                  │ <────────────────── │
       │                  │                     │
       │ 4. Return URL    │                     │
       │ <────────────────│                     │
       │                  │                     │
       │ 5. Upload file   │                     │
       │    DIRECTLY to   │                     │
       │    R2 (no backend│                     │
       │    bandwidth)    │                     │
       │ ──────────────────────────────────────>│
       │                  │                     │
       │ 6. Upload        │                     │
       │    complete      │                     │
       │ <──────────────────────────────────────│
       │                  │                     │
       │ 7. Confirm       │                     │
       │    upload +      │                     │
       │    metadata      │                     │
       │ ────────────────>│                     │
       │                  │                     │
       │                  │ 8. Save file        │
       │                  │    metadata to DB   │
       │                  │                     │
       │ 9. Success       │                     │
       │ <────────────────│                     │
       │                  │                     │

WHY PRESIGNED URLs:
  → Backend never handles file bytes
  → No bandwidth cost on backend server
  → Faster uploads (direct to storage)
  → Works with Vercel serverless (no large payload)
  → Backend only validates permissions and generates URL
```

### 9.2 File Security

```
ACCESS CONTROL:

  PUBLIC FILES (anyone can access):
  → Property photos (for listing pages)
  → Room photos (for listing pages)
  → Served via public R2 bucket or CDN URL

  PRIVATE FILES (owner + specific tenant only):
  → KYC documents (Aadhaar, PAN images)
  → Generated receipts (PDFs)
  → Rental agreements
  → Maintenance request photos
  → Settlement documents

  HOW PRIVATE ACCESS WORKS:
  → Files stored with random UUID filenames (not guessable)
  → No public URL — accessed via API endpoint
  → API endpoint verifies:
    • User is authenticated
    • User owns this file (owner) OR is the tenant whose file it is
  → On verification: generate short-lived presigned URL (15 min)
  → Client uses presigned URL to download/display
  → URL expires after 15 minutes — cannot be shared

  KYC DOCUMENT EXTRA SECURITY:
  → Aadhaar images: watermarked with "FOR TENANTEASE USE ONLY"
  → Displayed masked in UI: XXXX XXXX 4567
  → Download restricted to owner role only
  → Audit log entry on every view/download
```

---

## 10. Notification Architecture

### 10.1 Notification System Design

```
                    ┌──────────────────┐
                    │  TRIGGER EVENT   │
                    │                  │
                    │ • Payment made   │
                    │ • Reminder due   │
                    │ • Request raised │
                    │ • Status change  │
                    └────────┬─────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │  NOTIFICATION    │
                    │  SERVICE         │
                    │                  │
                    │  Determines:     │
                    │  • Who to notify │
                    │  • What channels │
                    │  • What template │
                    │  • What data     │
                    └────────┬─────────┘
                             │
                             │ Queues notifications
                             ▼
                    ┌──────────────────┐
                    │  NOTIFICATION    │
                    │  QUEUE (BullMQ)  │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌────────────┐ ┌────────────┐ ┌────────────┐
       │  IN-APP    │ │   EMAIL    │ │    SMS     │
       │            │ │  (Resend)  │ │  (MSG91)   │
       │ Save to DB │ │            │ │            │
       │ for portal │ │ Render     │ │ Template   │
       │ display    │ │ React      │ │ replace    │
       │            │ │ Email      │ │ variables  │
       │            │ │ template   │ │            │
       └────────────┘ └────────────┘ └────────────┘
                                          │
                                     (Phase 2)
                                          │
                                          ▼
                                   ┌────────────┐
                                   │  WHATSAPP  │
                                   │ (Interakt) │
                                   └────────────┘


NOTIFICATION ROUTING LOGIC:

  function routeNotification(event, recipient, property) {
    
    channels = []
    
    // In-app: always
    channels.push('IN_APP')
    
    // Email: always if recipient has email
    if (recipient.email) {
      channels.push('EMAIL')
    }
    
    // SMS: only for paid plans + specific events
    if (property.plan !== 'FREE' && event.smsEnabled) {
      channels.push('SMS')
    }
    
    // WhatsApp: only for paid plans + Phase 2+
    if (property.plan !== 'FREE' && whatsappEnabled && event.whatsappEnabled) {
      channels.push('WHATSAPP')
    }
    
    return channels
  }
```

### 10.2 Notification Priority and Throttling

```
PRIORITY LEVELS:

  CRITICAL (send immediately, all channels):
  → Payment received (confirmation)
  → Emergency maintenance request
  → Account security events
  → Subscription payment failed

  HIGH (send within 1 minute):
  → Rent reminders (automated)
  → Maintenance request status change
  → New maintenance request (to owner)

  NORMAL (send within 5 minutes, batch if possible):
  → Receipt generated
  → Announcement posted
  → Welcome email

  LOW (can be batched into daily digest):
  → Weekly summary
  → Feature announcements
  → Tips and suggestions

THROTTLING RULES:
  → Max 1 automated reminder per tenant per day
  → Max 5 manual reminders per tenant per day
  → Max 3 OTP requests per phone per hour
  → No notifications between 9 PM and 8 AM IST
  → Batch low-priority notifications into digest
  → If SMS fails, don't retry more than 3 times
  → If email fails, retry with exponential backoff (3 attempts)
```

---

## 11. Background Job Architecture

### 11.1 Job Queue Design

```
┌──────────────────────────────────────────────────────┐
│                JOB PROCESSING SYSTEM                  │
│                                                      │
│  ┌────────────────┐    ┌────────────────────────┐    │
│  │ CRON SCHEDULER │    │ APPLICATION TRIGGERS    │    │
│  │                │    │                        │    │
│  │ • Daily 10 AM  │    │ • Payment recorded     │    │
│  │ • Monthly 1st  │    │ • Tenant added         │    │
│  │ • Weekly Mon   │    │ • Bulk import started  │    │
│  │ • Yearly Apr 1 │    │ • Bulk receipt request │    │
│  └───────┬────────┘    └──────────┬─────────────┘    │
│          │                        │                  │
│          └────────────┬───────────┘                  │
│                       ▼                              │
│          ┌────────────────────┐                      │
│          │   REDIS QUEUES     │                      │
│          │   (BullMQ)         │                      │
│          │                    │                      │
│          │ ┌──────────────┐   │                      │
│          │ │ reminder-q   │   │ Priority: HIGH       │
│          │ └──────────────┘   │                      │
│          │ ┌──────────────┐   │                      │
│          │ │ notification │   │ Priority: NORMAL     │
│          │ └──────────────┘   │                      │
│          │ ┌──────────────┐   │                      │
│          │ │ receipt-q    │   │ Priority: NORMAL     │
│          │ └──────────────┘   │                      │
│          │ ┌──────────────┐   │                      │
│          │ │ import-q     │   │ Priority: LOW        │
│          │ └──────────────┘   │                      │
│          │ ┌──────────────┐   │                      │
│          │ │ report-q     │   │ Priority: LOW        │
│          │ └──────────────┘   │                      │
│          │ ┌──────────────┐   │                      │
│          │ │ cleanup-q    │   │ Priority: LOW        │
│          │ └──────────────┘   │                      │
│          └─────────┬──────────┘                      │
│                    │                                 │
│                    ▼                                 │
│          ┌────────────────────┐                      │
│          │   WORKER PROCESS   │                      │
│          │                    │                      │
│          │ Picks jobs from    │                      │
│          │ queues by priority │                      │
│          │ Processes one at   │                      │
│          │ a time (or N       │                      │
│          │ concurrent)        │                      │
│          │                    │                      │
│          │ On failure:        │                      │
│          │ → Retry 3 times    │                      │
│          │ → Exponential back │                      │
│          │ → Dead letter queue│                      │
│          │ → Alert on Sentry  │                      │
│          └────────────────────┘                      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 11.2 Scheduled Jobs Detail

```
┌──────────────────────────────────────────────────────────┐
│ JOB: DAILY RENT REMINDER                                 │
│ Schedule: Every day at 10:00 AM IST                      │
│ Duration: ~1-10 minutes (depending on tenant count)      │
│                                                          │
│ Process:                                                 │
│ 1. Fetch all properties with reminders enabled           │
│ 2. For each property:                                    │
│    a. Fetch reminder configuration                       │
│    b. Fetch active tenants with unpaid/partial rent       │
│    c. For each tenant:                                   │
│       - Calculate days until/after due date              │
│       - Determine if reminder should be sent today       │
│       - If yes: queue notification job                   │
│ 3. Log summary: X reminders queued across Y properties   │
│                                                          │
│ Idempotency:                                             │
│ → Check reminder_log: if reminder already sent today     │
│   for this tenant → skip                                 │
│ → Safe to run multiple times (cron restart, etc.)        │
│                                                          │
│ Failure handling:                                        │
│ → If job crashes mid-way, next run picks up remaining    │
│ → Individual notification failures don't stop the job    │
│ → Failed notifications logged and retried independently  │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ JOB: MONTHLY RENT GENERATION                            │
│ Schedule: 1st of every month at 12:01 AM IST             │
│ Duration: ~1-5 minutes                                   │
│                                                          │
│ Process:                                                 │
│ 1. Fetch all active tenants across all properties        │
│ 2. For each tenant:                                      │
│    a. Check if rent entry for this month already exists   │
│    b. If not: create rent entry                          │
│       - Base rent from tenant config                     │
│       - Additional charges from tenant config            │
│       - Status: UNPAID                                   │
│       - Due date from tenant config                      │
│ 3. Log summary: X rent entries created                   │
│                                                          │
│ Special handling:                                        │
│ → Per-tenant due dates: if tenant due date is 5th,       │
│   entry is created on 1st but due_date is set to 5th    │
│ → Pro-rated first month: if move_in_date is mid-month,  │
│   calculate proportional rent                            │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ JOB: OVERDUE STATUS UPDATE                               │
│ Schedule: Every day at 12:01 AM IST                      │
│ Duration: ~30 seconds                                    │
│                                                          │
│ Process:                                                 │
│ 1. Find all rent entries where:                          │
│    status = UNPAID AND due_date < today                  │
│ 2. Update status to OVERDUE                              │
│ 3. Calculate and apply late fees (if configured)         │
│ 4. Log count of newly overdue entries                    │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ JOB: ANNUAL RECEIPT SUMMARY                              │
│ Schedule: April 1st at 9:00 AM IST                       │
│ Duration: ~10-30 minutes                                 │
│                                                          │
│ Process:                                                 │
│ 1. Fetch all tenants who had payments in previous FY     │
│ 2. For each tenant:                                      │
│    a. Generate annual summary PDF                        │
│    b. Store PDF in R2                                    │
│    c. Queue notification to tenant                       │
│ 3. Log summary                                          │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ JOB: DATA CLEANUP                                        │
│ Schedule: Every Sunday at 3:00 AM IST                    │
│ Duration: ~1-5 minutes                                   │
│                                                          │
│ Process:                                                 │
│ 1. Hard delete soft-deleted records older than 90 days   │
│ 2. Delete expired OTPs from Redis (auto via TTL)         │
│ 3. Delete orphaned files in R2 (files not referenced)    │
│ 4. Clean up expired sessions                             │
│ 5. Delete old import CSV files (> 7 days)                │
│ 6. Archive old audit logs (> 1 year → cold storage)      │
│                                                          │
├──────────────────────────────────────────────────────────┤
│ JOB: SUBSCRIPTION CHECK                                  │
│ Schedule: Every day at 8:00 AM IST                       │
│ Duration: ~30 seconds                                    │
│                                                          │
│ Process:                                                 │
│ 1. Find subscriptions expiring in 7 days → send reminder │
│ 2. Find subscriptions expiring in 1 day → send urgent    │
│ 3. Find expired subscriptions → downgrade to free plan   │
│ 4. Log summary                                          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 11.3 MVP Alternative (No BullMQ)

```
FOR MVP (if deploying on Vercel serverless):

  BullMQ requires a persistent worker process.
  Vercel serverless functions are stateless.
  
  ALTERNATIVE APPROACH:

  1. VERCEL CRON JOBS (vercel.json):
     → Schedule API endpoint calls at specific times
     → /api/cron/send-reminders (daily at 10 AM)
     → /api/cron/generate-rent (monthly on 1st)
     → /api/cron/check-overdue (daily at midnight)
     → Free on Vercel hobby plan (limited to 1/day)
     → Vercel Pro: unlimited cron jobs

  2. INLINE PROCESSING (for small tasks):
     → Receipt generation: generate inline during API call
     → Single notification: send inline (not queued)
     → Works fine for < 100 tenants
     → Gets slow at scale → migrate to BullMQ

  3. EXTERNAL CRON (free fallback):
     → cron-job.org (free) hits your API endpoint on schedule
     → Same effect as Vercel Cron
     → No vendor lock-in

  WHEN TO UPGRADE TO BULLMQ:
     → When reminder job takes > 30 seconds (Vercel timeout)
     → When you have > 500 properties
     → When you need reliable retry and dead letter queues
     → When you split backend to Railway/Render (persistent)
```

---

## 12. Caching Architecture

### 12.1 Cache Strategy

```
CACHE-ASIDE PATTERN (Lazy Loading):

  READ:
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  CLIENT  │────>│  BACKEND │────>│  REDIS   │
  │          │     │          │     │  CACHE   │
  │          │     │          │     │          │
  │          │     │  Check   │     │ HIT? ──> │──> Return cached
  │          │     │  cache   │     │          │
  │          │     │  first   │     │ MISS?    │
  │          │     │          │     │          │
  │          │     │          │     └──────────┘
  │          │     │          │          │
  │          │     │          │     Query database
  │          │     │          │          │
  │          │     │          │          ▼
  │          │     │          │     ┌──────────┐
  │          │     │          │     │ POSTGRES │
  │          │     │          │<────│          │
  │          │     │          │     └──────────┘
  │          │     │          │
  │          │     │ Store in │
  │          │     │ cache    │────> Redis SET with TTL
  │          │     │          │
  │          │<────│ Return   │
  │          │     │ data     │
  └──────────┘     └──────────┘

  WRITE (Invalidation):
  ┌──────────┐     ┌──────────┐
  │  CLIENT  │────>│  BACKEND │
  │          │     │          │
  │ Record   │     │ 1. Write to PostgreSQL
  │ payment  │     │ 2. DELETE from Redis:
  │          │     │    - dashboard:{propertyId}
  │          │     │    - rent_status:{propId}:{month}
  │          │     │    - tenants:{propertyId}
  │          │     │ 3. Return success
  │          │<────│
  └──────────┘     └──────────┘
  
  Next read will miss cache → fetch from DB → repopulate cache.


CACHE KEY NAMING CONVENTION:

  Pattern: {entity}:{scope_id}:{optional_params}
  
  Examples:
  dashboard:prop_abc123             → Property dashboard data
  rooms:prop_abc123                 → Rooms list for property
  tenants:prop_abc123:page:1        → Tenants page 1
  rent_status:prop_abc123:2025:06   → June 2025 rent status
  plan:user_xyz789                  → User's subscription plan
  maintenance:prop_abc123:open      → Open maintenance requests
  stats:prop_abc123                 → Property statistics


CACHE TTL (Time-To-Live) VALUES:

  ┌─────────────────────────┬───────────┬───────────────────┐
  │ Cache Key               │ TTL       │ Invalidated By    │
  ├─────────────────────────┼───────────┼───────────────────┤
  │ dashboard:*             │ 5 min     │ Any write to prop │
  │ rooms:*                 │ 10 min    │ Room/tenant change│
  │ tenants:*               │ 5 min     │ Tenant change     │
  │ rent_status:*           │ 5 min     │ Payment recorded  │
  │ plan:*                  │ 1 hour    │ Subscription change│
  │ maintenance:*           │ 5 min     │ Request change    │
  │ stats:*                 │ 15 min    │ Any write         │
  │ otp:*                   │ 5 min     │ Auto-expire (TTL) │
  │ rate_limit:*            │ Varies    │ Auto-expire (TTL) │
  │ session:*               │ 30 days   │ Logout            │
  └─────────────────────────┴───────────┴───────────────────┘
```

---

## 13. Payment Architecture

### 13.1 Payment Flow Architecture

```
TWO PAYMENT FLOWS:

═══════════════════════════════════════════
FLOW A: MANUAL PAYMENT RECORDING (MVP)
═══════════════════════════════════════════

  Tenant pays owner directly (cash, UPI, bank transfer).
  Owner manually records the payment in TenantEase.

  ┌──────────┐  Cash/UPI  ┌──────────┐
  │  TENANT  │───────────>│  OWNER   │
  └──────────┘  (outside  └────┬─────┘
                 platform)     │
                               │ Records in TenantEase
                               ▼
                        ┌──────────────┐
                        │  TENANTEASE  │
                        │  DATABASE    │
                        │              │
                        │ CREATE:      │
                        │ - Payment    │
                        │ - Update rent│
                        │ - Audit log  │
                        └──────────────┘

  This is the MVP flow. Simple. No payment gateway needed.

═══════════════════════════════════════════
FLOW B: ONLINE PAYMENT (Phase 2)
═══════════════════════════════════════════

  Tenant pays through TenantEase portal.
  Payment processed by Razorpay.
  Auto-recorded in TenantEase.

  ┌──────────┐     ┌──────────────┐     ┌──────────┐
  │  TENANT  │────>│  TENANTEASE  │────>│ RAZORPAY │
  │ (Portal) │     │  (Backend)   │     │          │
  │          │     │              │     │          │
  │ Click    │     │ Create       │     │          │
  │ "Pay Now"│     │ Razorpay     │     │          │
  │          │     │ Order        │────>│ Order    │
  │          │     │              │<────│ Created  │
  │          │     │              │     │          │
  │          │<────│ Return       │     │          │
  │          │     │ order_id     │     │          │
  │          │     │              │     │          │
  │ Razorpay │     │              │     │          │
  │ Checkout │─────────────────────────>│ Process  │
  │ Modal    │     │              │     │ Payment  │
  │          │<─────────────────────────│ Result   │
  │          │     │              │     │          │
  │ Success  │     │              │     │          │
  │          │────>│ Verify       │     │          │
  │          │     │ Payment      │     │          │
  │          │     │ Signature    │     │          │
  │          │     │              │     │          │
  │          │     │ ┌──────────┐ │     │          │
  │          │     │ │ Webhook  │<│─────│ Webhook  │
  │          │     │ │ Handler  │ │     │ POST     │
  │          │     │ └──────────┘ │     │          │
  │          │     │              │     │          │
  │          │     │ Record       │     │          │
  │          │     │ payment      │     │          │
  │          │     │ Auto         │     │          │
  │          │     │              │     │          │
  │          │<────│ Confirmation │     │          │
  └──────────┘     └──────────────┘     └──────────┘

  IMPORTANT: Always verify payment via WEBHOOK, not client callback.
  Client callback can be faked. Webhook comes directly from Razorpay.


RAZORPAY ROUTE (Split Payment):

  When tenant pays ₹10,000:
  
  ┌─────────────────────────────────────────┐
  │ Total payment:          ₹10,000         │
  │                                         │
  │ → Owner receives:      ₹9,800  (98%)   │
  │   (Razorpay Route → owner's bank)       │
  │                                         │
  │ → TenantEase receives: ₹200   (2%)     │
  │   (Platform commission)                 │
  │                                         │
  │ → Razorpay fee:        ~₹200  (2%)     │
  │   (Deducted from owner's share          │
  │    OR added as convenience fee)         │
  │                                         │
  │ Settlement: T+2 business days           │
  └─────────────────────────────────────────┘
```

---

## 14. PDF Generation Architecture

### 14.1 PDF Generation Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   TRIGGER    │────>│  PDF SERVICE │────>│  STORAGE     │
│              │     │              │     │  (R2/S3)     │
│ • API call   │     │ 1. Fetch     │     │              │
│ • Bulk job   │     │    data from │     │ Store PDF    │
│ • Cron job   │     │    database  │     │              │
│              │     │              │     │ Return URL   │
│              │     │ 2. Render    │     │              │
│              │     │    React-PDF │     └──────────────┘
│              │     │    component │
│              │     │              │
│              │     │ 3. Generate  │
│              │     │    PDF bytes │
│              │     │              │
│              │     │ 4. Upload to │
│              │     │    storage   │
│              │     │              │
│              │     │ 5. Save      │
│              │     │    metadata  │
│              │     │    to DB     │
│              │     │              │
│              │     │ 6. Return    │
│              │     │    PDF URL   │
└──────────────┘     └──────────────┘


PDF TEMPLATES (React-PDF Components):

  src/lib/pdf/
  ├── templates/
  │   ├── rent-receipt.tsx          → Monthly rent receipt
  │   ├── annual-summary.tsx       → Annual receipt summary
  │   ├── rental-agreement.tsx     → Rental agreement
  │   ├── settlement-receipt.tsx   → Final settlement document
  │   ├── financial-report.tsx     → Monthly/annual financial report
  │   └── tenant-list-export.tsx   → Tenant data export
  ├── components/
  │   ├── pdf-header.tsx           → Reusable PDF header
  │   ├── pdf-footer.tsx           → Footer with branding
  │   ├── pdf-table.tsx            → Table component for PDFs
  │   ├── pdf-amount.tsx           → Currency formatter for PDFs
  │   └── pdf-signature.tsx        → Signature line component
  ├── fonts/
  │   ├── Inter-Regular.ttf        → Body font
  │   └── Inter-Bold.ttf           → Header font
  └── generate.ts                  → PDF generation utility function


GENERATION STRATEGIES:

  SINGLE RECEIPT (inline):
  → Generate during API call
  → Return PDF bytes directly
  → Or upload to R2 and return URL
  → Latency: 1-3 seconds
  → Acceptable for single receipt

  BULK RECEIPTS (queued):
  → Queue job in receipt-queue
  → Worker generates PDFs one by one
  → Progress tracked: "15 of 47 complete"
  → On completion:
    → Individual PDFs stored in R2
    → Combined PDF created (all receipts in one file)
    → ZIP file created (individual PDFs)
    → Notify owner: "Receipts ready for download"
  → Latency: 30 seconds to 5 minutes
```

---

## 15. API Architecture

### 15.1 API Request Lifecycle

```
INCOMING REQUEST
       │
       ▼
┌──────────────┐
│ 1. CLOUDFLARE│ DDoS protection, WAF rules
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 2. NEXT.JS   │ Auth check, rate limit, redirect
│   MIDDLEWARE  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 3. ROUTE     │ Match URL to handler
│   HANDLER    │ app/api/v1/tenants/route.ts
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 4. REQUEST   │ Zod schema validation
│   VALIDATION │ Return 400 if invalid
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 5. AUTH      │ Verify JWT token
│   CHECK      │ Extract user context
│              │ Return 401 if not authenticated
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 6. AUTHZ     │ Check role permissions (RBAC)
│   CHECK      │ Check resource ownership
│              │ Return 403 if not authorized
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 7. PLAN      │ Check subscription limits
│   CHECK      │ Return 403 with upgrade prompt
│   (if needed)│ if limit exceeded
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 8. SERVICE   │ Execute business logic
│   LAYER      │ Database operations
│              │ External service calls
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 9. RESPONSE  │ Format response
│   FORMAT     │ Set status code
│              │ Add headers
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 10. LOGGING  │ Log request metadata
│    & METRICS │ (path, status, duration, user)
└──────┬───────┘
       │
       ▼
   RESPONSE SENT
```

### 15.2 API Response Format

```
ALL SUCCESSFUL RESPONSES:

  {
    "success": true,
    "data": { ... },              // The actual response payload
    "message": "Tenant created",  // Human-readable (optional)
    "meta": {                     // Metadata (optional, for lists)
      "page": 1,
      "limit": 25,
      "total": 48,
      "totalPages": 2,
      "hasNext": true,
      "hasPrev": false
    }
  }

ALL ERROR RESPONSES:

  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",     // Machine-readable error code
      "message": "Invalid input data", // Human-readable message
      "details": [                     // Field-level errors (optional)
        {
          "field": "phone",
          "message": "Phone number already exists in this property"
        },
        {
          "field": "rentAmount",
          "message": "Rent amount must be greater than 0"
        }
      ]
    }
  }

ERROR CODES:

  AUTH_REQUIRED          → 401 — Not authenticated
  AUTH_INVALID_OTP       → 401 — Wrong OTP
  AUTH_OTP_EXPIRED       → 401 — OTP expired
  AUTH_FORBIDDEN         → 403 — No permission
  PLAN_LIMIT_REACHED     → 403 — Subscription limit
  VALIDATION_ERROR       → 400 — Invalid input
  NOT_FOUND              → 404 — Resource not found
  CONFLICT               → 409 — Duplicate entry
  BUSINESS_RULE_VIOLATED → 422 — Business logic error
  RATE_LIMITED           → 429 — Too many requests
  INTERNAL_ERROR         → 500 — Server error
  SERVICE_UNAVAILABLE    → 503 — External service down
```

---

## 16. Security Architecture

### 16.1 Security Layers

```
DEFENSE IN DEPTH — MULTIPLE LAYERS:

┌─────────────────────────────────────────────────────┐
│ LAYER 1: NETWORK (Cloudflare)                       │
│ → DDoS protection                                   │
│ → WAF (Web Application Firewall) rules              │
│ → Bot detection                                     │
│ → Rate limiting at edge                             │
│ → SSL/TLS termination                               │
│ → IP-based blocking (if needed)                     │
├─────────────────────────────────────────────────────┤
│ LAYER 2: TRANSPORT (HTTPS)                          │
│ → TLS 1.3 (all traffic encrypted)                   │
│ → HSTS headers (force HTTPS)                        │
│ → Certificate auto-renewal (Vercel/Cloudflare)      │
├─────────────────────────────────────────────────────┤
│ LAYER 3: APPLICATION (Next.js Middleware)            │
│ → Rate limiting (Redis-based per user/IP)            │
│ → CORS (restrict origins)                           │
│ → Security headers (CSP, X-Frame-Options, etc.)     │
│ → Request size limiting                              │
├─────────────────────────────────────────────────────┤
│ LAYER 4: AUTHENTICATION                             │
│ → Phone OTP verification (something you have)       │
│ → JWT with short expiry (15 min)                    │
│ → Refresh tokens in httpOnly cookies                │
│ → Session management                                │
│ → OTP rate limiting (3 per hour per phone)          │
├─────────────────────────────────────────────────────┤
│ LAYER 5: AUTHORIZATION                              │
│ → RBAC (Role-Based Access Control)                   │
│ → Resource ownership verification                   │
│ → Subscription plan limit enforcement               │
│ → Enforced at API level (not just UI)               │
├─────────────────────────────────────────────────────┤
│ LAYER 6: INPUT VALIDATION                           │
│ → Zod schema validation (every endpoint)            │
│ → SQL injection prevention (Prisma ORM)             │
│ → XSS prevention (React auto-escaping + CSP)        │
│ → File type/size validation (uploads)               │
│ → Phone/Aadhaar/PAN format validation               │
├─────────────────────────────────────────────────────┤
│ LAYER 7: DATA PROTECTION                            │
│ → Aadhaar/PAN encrypted at rest (AES-256)           │
│ → KYC documents access-controlled                   │
│ → Aadhaar masked in UI (XXXX XXXX 4567)            │
│ → Signed URLs for file access (time-limited)        │
│ → Database backups encrypted                        │
├─────────────────────────────────────────────────────┤
│ LAYER 8: AUDIT & MONITORING                         │
│ → All mutations logged (audit trail)                │
│ → Admin impersonation logged                        │
│ → Suspicious activity alerts (Sentry)               │
│ → Dependency vulnerability scanning (Snyk/npm audit)│
│ → Regular security reviews                          │
└─────────────────────────────────────────────────────┘
```

### 16.2 Security Headers

```
NEXT.JS SECURITY HEADERS (next.config.js):

  X-DNS-Prefetch-Control: on
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: origin-when-cross-origin
  X-XSS-Protection: 1; mode=block
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy:
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval' 
      https://checkout.razorpay.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.r2.cloudflarestorage.com;
    connect-src 'self' https://api.razorpay.com 
      https://*.supabase.co https://*.upstash.io;
    frame-src https://api.razorpay.com;
    font-src 'self';
```

---

## 17. Data Flow Diagrams

### 17.1 Rent Collection Data Flow

```
MONTHLY RENT LIFECYCLE:

  DAY 1 OF MONTH
       │
       ▼
  ┌──────────────┐
  │ CRON JOB     │ Generate rent entries
  │ rent-gen     │ for all active tenants
  └──────┬───────┘
         │ Creates RentEntry (status: UNPAID)
         ▼
  ┌──────────────┐
  │  RENT ENTRY  │ base_rent + additional_charges
  │  (UNPAID)    │ due_date = tenant's configured date
  └──────┬───────┘
         │
         │ 3 days before due_date
         ▼
  ┌──────────────┐
  │ CRON JOB     │ Check if unpaid → send reminder
  │ reminder     │
  └──────┬───────┘
         │ SMS/Email: "Rent due in 3 days"
         ▼
  ┌──────────────┐
  │  DUE DATE    │ Another reminder if still unpaid
  └──────┬───────┘
         │
         ├──── TENANT PAYS ────┐
         │     (online or      │
         │      offline)       ▼
         │              ┌──────────────┐
         │              │ PAYMENT      │
         │              │ RECORDED     │
         │              │              │
         │              │ Manual: owner│
         │              │ records      │
         │              │              │
         │              │ Online:      │
         │              │ auto-recorded│
         │              │ via webhook  │
         │              └──────┬───────┘
         │                     │
         │                     ▼
         │              ┌──────────────┐
         │              │ RENT STATUS  │
         │              │ → PAID       │
         │              │              │
         │              │ → Cancel     │
         │              │   reminders  │
         │              │ → Generate   │
         │              │   receipt    │
         │              │ → Notify     │
         │              │   owner     │
         │              └──────────────┘
         │
         ├──── TENANT DOESN'T PAY ────┐
         │                             │
         │     after grace period      ▼
         │                      ┌──────────────┐
         │                      │ RENT STATUS  │
         │                      │ → OVERDUE    │
         │                      │              │
         │                      │ → Late fee   │
         │                      │   applied    │
         │                      │ → Overdue    │
         │                      │   reminders  │
         │                      │   every 3 day│
         │                      └──────────────┘
         │
         └──── NEXT MONTH → cycle repeats
```

### 17.2 Tenant Lifecycle Data Flow

```
  ┌──────────────┐
  │ OWNER ADDS   │
  │ TENANT       │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────┐
  │ TENANT       │────>│ ROOM         │
  │ CREATED      │     │ OCCUPANCY    │
  │ status:ACTIVE│     │ UPDATED      │
  └──────┬───────┘     └──────────────┘
         │
         │ Invite SMS sent
         ▼
  ┌──────────────┐
  │ TENANT       │
  │ ACTIVE       │
  │              │
  │ • Pays rent  │◄──── monthly cycle
  │ • Gets       │
  │   receipts   │
  │ • Raises     │
  │   requests   │
  │ • Views      │
  │   portal     │
  └──────┬───────┘
         │
         │ Owner decides to vacate
         │ OR tenant gives notice
         ▼
  ┌──────────────┐
  │ TENANT       │ (optional intermediate state)
  │ ON NOTICE    │
  │              │
  │ • Notice     │
  │   period     │
  │   countdown  │
  └──────┬───────┘
         │
         │ Vacating date reached
         ▼
  ┌──────────────┐     ┌──────────────┐
  │ VACATE       │────>│ SETTLEMENT   │
  │ PROCESS      │     │ CALCULATED   │
  │              │     │              │
  │ • Pending    │     │ • Pending    │
  │   dues calc  │     │   rent       │
  │ • Deposit    │     │ • Deductions │
  │   settlement │     │ • Net refund │
  │ • Room freed │     │ • PDF gen    │
  └──────┬───────┘     └──────────────┘
         │
         ▼
  ┌──────────────┐     ┌──────────────┐
  │ TENANT       │     │ ROOM         │
  │ VACATED      │     │ VACANCY      │
  │              │     │ RESTORED     │
  │ • Portal     │     │              │
  │   read-only  │     │ • Available  │
  │ • History    │     │   for new    │
  │   preserved  │     │   tenant     │
  └──────────────┘     └──────────────┘
```

---

## 18. Deployment Architecture

### 18.1 Deployment Pipeline

```
DEVELOPMENT → STAGING → PRODUCTION

┌──────────────────────────────────────────────────────┐
│ DEVELOPMENT                                          │
│                                                      │
│ Developer machine                                    │
│ ├── next dev (hot reload)                            │
│ ├── Local or cloud PostgreSQL (dev database)         │
│ ├── Cloud Redis (Upstash dev instance)               │
│ ├── .env.local (dev secrets)                         │
│ └── Feature branch: feature/add-tenant               │
│                                                      │
│ On git push:                                         │
│ → GitHub Actions: lint + type check + test            │
│ → Vercel: auto-creates preview deployment            │
│   URL: feature-add-tenant.tenantease.vercel.app      │
│                                                      │
├──────────────────────────────────────────────────────┤
│ STAGING (Preview)                                    │
│                                                      │
│ Pull Request to main branch                          │
│ ├── Vercel preview deployment (auto)                 │
│ ├── Staging database (separate from production)      │
│ ├── Staging Redis instance                           │
│ ├── .env.preview (staging secrets)                   │
│ └── Manual testing + review                          │
│                                                      │
│ On PR merge to main:                                 │
│ → Production deployment triggered                    │
│                                                      │
├──────────────────────────────────────────────────────┤
│ PRODUCTION                                           │
│                                                      │
│ main branch                                          │
│ ├── Vercel production deployment (auto on merge)     │
│ ├── Production database (Supabase)                   │
│ ├── Production Redis (Upstash)                       │
│ ├── Production R2 bucket                             │
│ ├── .env.production (production secrets — in Vercel) │
│ └── Custom domain: tenantease.com                    │
│                                                      │
│ Post-deploy:                                         │
│ → Run database migrations (prisma migrate deploy)    │
│ → Sentry release created                             │
│ → Smoke tests run                                    │
│ → Monitoring active                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 18.2 Environment Configuration

```
ENVIRONMENT VARIABLES (by environment):

┌─────────────────────────┬─────────────┬─────────────┬──────────────┐
│ Variable                │ Development │ Staging     │ Production   │
├─────────────────────────┼─────────────┼─────────────┼──────────────┤
│ NODE_ENV                │ development │ preview     │ production   │
│ DATABASE_URL            │ dev DB URL  │ staging DB  │ prod DB      │
│ REDIS_URL               │ dev Redis   │ staging     │ prod Redis   │
│ JWT_SECRET              │ dev-secret  │ stg-secret  │ prod-secret  │
│ JWT_REFRESH_SECRET      │ dev-secret  │ stg-secret  │ prod-secret  │
│ R2_ACCESS_KEY           │ dev key     │ staging     │ prod key     │
│ R2_SECRET_KEY           │ dev key     │ staging     │ prod key     │
│ R2_BUCKET_NAME          │ te-dev      │ te-staging  │ te-prod      │
│ RAZORPAY_KEY_ID         │ test key    │ test key    │ live key     │
│ RAZORPAY_KEY_SECRET     │ test secret │ test secret │ live secret  │
│ MSG91_AUTH_KEY           │ test key    │ test key    │ live key     │
│ RESEND_API_KEY          │ test key    │ test key    │ live key     │
│ SENTRY_DSN              │ (none)      │ staging DSN │ prod DSN     │
│ NEXT_PUBLIC_APP_URL     │ localhost   │ staging URL │ tenantease.com│
│ ENCRYPTION_KEY          │ dev key     │ stg key     │ prod key     │
│ ADMIN_PHONE_NUMBERS     │ your phone  │ team phones │ team phones  │
└─────────────────────────┴─────────────┴─────────────┴──────────────┘

SECRETS MANAGEMENT:
  → Development: .env.local (gitignored)
  → Staging: Vercel environment variables (preview)
  → Production: Vercel environment variables (production)
  → NEVER commit secrets to git
  → Rotate secrets every 90 days
  → Use separate API keys for each environment
```

---

## 19. Error Handling Architecture

### 19.1 Error Handling Strategy

```
ERROR CLASSIFICATION:

┌──────────────────────────────────────────────────────┐
│ EXPECTED ERRORS (handled gracefully)                  │
│                                                      │
│ → Validation errors (bad input)                      │
│ → Not found (resource doesn't exist)                 │
│ → Unauthorized (not logged in)                       │
│ → Forbidden (no permission)                          │
│ → Conflict (duplicate entry)                         │
│ → Business rule violation (room is full)             │
│ → Plan limit exceeded                                │
│                                                      │
│ Response: Specific error code + message              │
│ Log level: WARN                                      │
│ Sentry: NO (too noisy)                               │
├──────────────────────────────────────────────────────┤
│ UNEXPECTED ERRORS (bugs, crashes)                    │
│                                                      │
│ → Database connection failure                        │
│ → Unhandled exceptions                               │
│ → Null pointer / undefined access                    │
│ → External service timeout                           │
│ → Out of memory                                      │
│                                                      │
│ Response: Generic "Something went wrong"             │
│ Log level: ERROR                                     │
│ Sentry: YES (with full context)                      │
├──────────────────────────────────────────────────────┤
│ EXTERNAL SERVICE ERRORS (degraded experience)        │
│                                                      │
│ → SMS provider down → fall back to email             │
│ → Payment gateway down → show "pay later" message    │
│ → Redis down → skip cache, query DB directly         │
│ → File storage down → show placeholder image         │
│ → Email provider down → queue for retry              │
│                                                      │
│ Response: Partial success with warning                │
│ Log level: WARN                                      │
│ Sentry: YES (to track outages)                       │
└──────────────────────────────────────────────────────┘


CUSTOM ERROR CLASSES:

  AppError (base class)
  ├── ValidationError (400)
  ├── AuthenticationError (401)
  ├── AuthorizationError (403)
  ├── NotFoundError (404)
  ├── ConflictError (409)
  ├── BusinessRuleError (422)
  ├── RateLimitError (429)
  └── ExternalServiceError (503)

  Each error has:
  → HTTP status code
  → Machine-readable error code
  → Human-readable message
  → Optional field-level details
  → Stack trace (logged, not sent to client)


GLOBAL ERROR HANDLER:

  Every API route wrapped in try/catch.
  Catches all unhandled errors.
  Formats consistent error response.
  Logs to Axiom.
  Reports to Sentry (if unexpected).
  Never exposes stack traces to client.
  Never exposes internal details to client.
```

---

## 20. Logging Architecture

### 20.1 Structured Logging

```
LOG FORMAT (JSON):

  {
    "timestamp": "2025-06-05T10:30:00.000Z",
    "level": "info",
    "service": "tenantease",
    "environment": "production",
    "requestId": "req_abc123",
    "userId": "user_xyz789",
    "propertyId": "prop_def456",
    "method": "POST",
    "path": "/api/v1/payments",
    "statusCode": 201,
    "duration": 245,
    "message": "Payment recorded successfully",
    "meta": {
      "tenantId": "tenant_123",
      "amount": 1150000,
      "paymentMode": "UPI"
    }
  }


LOG LEVELS:

  ERROR   → Application errors, crashes, data integrity issues
  WARN    → Expected errors (validation, auth), degraded service
  INFO    → Important business events (payment, tenant add, vacate)
  DEBUG   → Detailed execution info (SQL queries, cache hits)

  Production: INFO and above
  Development: DEBUG and above


WHAT TO LOG:

  ALWAYS LOG:
  → Every API request (method, path, status, duration, userId)
  → Payment operations (amount, mode, tenant, result)
  → Authentication events (login, logout, OTP sent)
  → Tenant lifecycle events (add, vacate, transfer)
  → Subscription changes (upgrade, downgrade, cancel)
  → Errors with full context
  → Background job execution (start, complete, fail)

  NEVER LOG:
  → OTP values
  → JWT tokens
  → Aadhaar numbers (full)
  → PAN numbers (full)
  → File contents
  → Request bodies with sensitive data
  → Database credentials
  → API keys
```

---

## 21. Rate Limiting Architecture

### 21.1 Rate Limiting Strategy

```
IMPLEMENTATION: Redis-based sliding window

RATE LIMITS BY ENDPOINT:

┌────────────────────────┬────────────────┬──────────────────┐
│ Endpoint               │ Limit          │ Window           │
├────────────────────────┼────────────────┼──────────────────┤
│ POST /auth/send-otp    │ 3 requests     │ per hour per IP  │
│ POST /auth/verify-otp  │ 5 attempts     │ per OTP session  │
│ POST /auth/*           │ 10 requests    │ per minute per IP│
│ GET  /api/* (auth'd)   │ 100 requests   │ per minute/user  │
│ POST /api/* (auth'd)   │ 30 requests    │ per minute/user  │
│ POST /api/reminders/*  │ 50 requests    │ per hour/user    │
│ POST /api/upload       │ 20 requests    │ per hour/user    │
│ GET  /pg/* (public)    │ 60 requests    │ per minute per IP│
│ POST /api/webhooks/*   │ 100 requests   │ per minute per IP│
└────────────────────────┴────────────────┴──────────────────┘

RESPONSE WHEN RATE LIMITED:

  HTTP 429 Too Many Requests
  Headers:
    Retry-After: 45 (seconds until limit resets)
    X-RateLimit-Limit: 100
    X-RateLimit-Remaining: 0
    X-RateLimit-Reset: 1717578900 (Unix timestamp)
  
  Body:
  {
    "success": false,
    "error": {
      "code": "RATE_LIMITED",
      "message": "Too many requests. Please try again in 45 seconds."
    }
  }


REDIS IMPLEMENTATION:

  Key: rate_limit:{scope}:{identifier}:{window}
  
  Examples:
  rate_limit:otp:9876543210:hourly
  rate_limit:api:user_xyz789:minutely
  rate_limit:public:192.168.1.1:minutely

  Algorithm: Sliding window counter
  → INCR key
  → EXPIRE key {window_seconds}
  → If count > limit → reject with 429
```

---

## 22. Feature Flag Architecture

### 22.1 Feature Flag Strategy

```
TOOL: PostHog Feature Flags (free tier)
OR: Simple database/config-based flags for MVP

PURPOSE:
  → Ship features behind flags
  → Enable for beta testers first
  → A/B test different experiences
  → Kill switch for broken features
  → Gradual rollout (10% → 50% → 100%)


FLAGS WE'LL USE:

┌──────────────────────────┬──────────┬───────────────────┐
│ Flag Name                │ Default  │ Purpose           │
├──────────────────────────┼──────────┼───────────────────┤
│ online_payments          │ false    │ Razorpay checkout  │
│ whatsapp_reminders       │ false    │ WhatsApp API       │
│ utility_billing          │ false    │ Electricity/water  │
│ agreement_generation     │ false    │ Rental agreements  │
│ vacancy_listings         │ false    │ Public listing page│
│ staff_management         │ false    │ Staff roles        │
│ bulk_operations          │ false    │ CSV import, bulk   │
│ analytics_dashboard      │ false    │ Charts & reports   │
│ annual_summary           │ false    │ Tax receipt summary│
│ maintenance_v2           │ false    │ Enhanced maint.    │
│ new_onboarding           │ false    │ Redesigned wizard  │
│ dark_mode                │ false    │ Dark theme         │
└──────────────────────────┴──────────┴───────────────────┘


MVP IMPLEMENTATION (simple, no PostHog needed):

  // src/lib/features.ts
  
  const FEATURES = {
    online_payments: false,
    whatsapp_reminders: false,
    utility_billing: false,
    // ... etc
  };
  
  // Override per environment
  if (process.env.NODE_ENV === 'development') {
    FEATURES.online_payments = true;  // enable in dev
  }
  
  // Override per user (from database)
  async function isFeatureEnabled(flag, userId) {
    // Check if user is in beta testers list
    const betaTester = await db.betaTester.findUnique({ 
      where: { userId, feature: flag } 
    });
    return betaTester !== null || FEATURES[flag];
  }
  
  // Usage in API route
  if (!await isFeatureEnabled('online_payments', userId)) {
    throw new BusinessRuleError('Feature not available yet');
  }
  
  // Usage in frontend
  {isFeatureEnabled('online_payments') && (
    <PayNowButton />
  )}
```

---

## 23. Scaling Architecture (Future)

### 23.1 Scaling Stages

```
STAGE 1: SINGLE SERVER (Current — MVP)
──────────────────────────────────────

  ┌──────────────┐
  │   VERCEL     │
  │  (Next.js)   │
  │  Frontend +  │
  │  Backend     │
  └──────┬───────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
  ┌────┐  ┌─────┐
  │ DB │  │Redis│
  └────┘  └─────┘
  
  Handles: 0-500 properties, 0-5,000 tenants
  Cost: $0-50/month


STAGE 2: OPTIMIZED MONOLITH (Growth)
──────────────────────────────────────

  ┌──────────────┐
  │   VERCEL     │
  │  (Next.js)   │────── Cloudflare CDN
  │  Frontend +  │       (static assets)
  │  Backend     │
  └──────┬───────┘
         │
    ┌────┼────┐
    │    │    │
    ▼    ▼    ▼
  ┌────┐┌───┐┌────┐
  │ DB ││Red││ R2 │
  │Pro ││is ││    │
  └────┘└───┘└────┘
  
  + Database connection pooling
  + Redis caching on hot paths
  + CDN for all static assets and images
  + Database indexes optimized
  + Background workers for heavy jobs
  
  Handles: 500-2,000 properties
  Cost: $50-200/month


STAGE 3: SPLIT SERVICES (Scale)
──────────────────────────────────────

  ┌──────────────┐     ┌──────────────┐
  │   VERCEL     │     │   RAILWAY    │
  │  (Frontend)  │     │  (Backend    │
  │              │────>│   Workers)   │
  │  SSR +       │     │              │
  │  Static      │     │  API +       │
  └──────────────┘     │  Background  │
                       │  Jobs        │
                       └──────┬───────┘
                              │
                   ┌──────────┼──────────┐
                   │          │          │
                   ▼          ▼          ▼
                ┌────┐    ┌─────┐    ┌────┐
                │ DB │    │Redis│    │ R2 │
                │RDS │    │Elas.│    │    │
                │+rep│    │cache│    │    │
                └────┘    └─────┘    └────┘
  
  + Separate API server (persistent, not serverless)
  + Database read replicas
  + Dedicated Redis cluster
  + Horizontal scaling of API servers
  + Worker processes on separate machines
  
  Handles: 2,000-10,000 properties
  Cost: $200-1,000/month


STAGE 4: FULL SCALE (if you're very successful)
──────────────────────────────────────

  Load Balancer
       │
  ┌────┼────┐
  │    │    │
  ▼    ▼    ▼
  API  API  API    (horizontal scaling)
  └────┬────┘
       │
  ┌────┼────────┐
  │    │        │
  ▼    ▼        ▼
  DB   DB       DB (primary + read replicas)
  (P)  (R)      (R)
  
  + Kubernetes or ECS for container orchestration
  + Auto-scaling based on traffic
  + Multi-region deployment (Mumbai + Hyderabad)
  + Dedicated notification microservice
  + Dedicated PDF generation microservice
  + Event-driven architecture (Kafka/RabbitMQ)
  + Elasticsearch for advanced search
  
  Handles: 10,000+ properties
  Cost: $1,000-5,000/month
  
  You need a team at this point. Hire a DevOps engineer.
```

---

## 24. Disaster Recovery & Backup

### 24.1 Backup Strategy

```
DATABASE BACKUPS:

  AUTOMATED (Supabase/Provider-managed):
  → Daily full backups (retained 30 days)
  → Point-in-time recovery (PITR) up to 7 days
  → Backups stored in separate region

  MANUAL (additional safety):
  → Weekly pg_dump to separate cloud storage
  → Monthly backup verification (restore to test environment)
  → Pre-migration backup (before any schema change)

FILE STORAGE (R2):
  → R2 has built-in redundancy (replicated across data centers)
  → No additional backup needed for MVP
  → At scale: cross-region replication

REDIS:
  → Redis data is ephemeral (cache, OTP, rate limits)
  → No backup needed — data can be regenerated
  → If Redis goes down: app works (cache miss → DB query)


DISASTER SCENARIOS AND RESPONSES:

┌────────────────────────┬──────────────────────────────────┐
│ Scenario               │ Response                         │
├────────────────────────┼──────────────────────────────────┤
│ Database goes down     │ → Supabase auto-recovery         │
│                        │ → If extended: restore from      │
│                        │   latest backup                  │
│                        │ → Max data loss: few minutes     │
│                        │   (PITR)                         │
│                        │                                  │
│ Vercel goes down       │ → Wait for Vercel recovery       │
│                        │   (99.99% SLA)                   │
│                        │ → If extended: deploy to Railway │
│                        │   from same repo                 │
│                        │                                  │
│ Redis goes down        │ → App continues (no cache)       │
│                        │ → OTP temporarily unavailable    │
│                        │   → fall back to email OTP       │
│                        │ → Upstash auto-recovery          │
│                        │                                  │
│ R2 goes down           │ → Images/PDFs temporarily        │
│                        │   unavailable                    │
│                        │ → App core functions still work  │
│                        │ → Cloudflare auto-recovery       │
│                        │                                  │
│ SMS provider down      │ → Fall back to email             │
│                        │ → Log for manual follow-up       │
│                        │ → Switch to backup provider      │
│                        │                                  │
│ Payment gateway down   │ → Disable online payments        │
│                        │ → Show "pay offline" message     │
│                        │ → Owner records manually         │
│                        │                                  │
│ Accidental data delete │ → Soft delete → recoverable      │
│                        │ → DB restore from backup         │
│                        │ → Audit logs show who/when       │
│                        │                                  │
│ Security breach        │ → Revoke all sessions (Redis)    │
│                        │ → Force re-authentication        │
│                        │ → Rotate all API keys            │
│                        │ → Notify affected users          │
│                        │ → Engage incident response       │
└────────────────────────┴──────────────────────────────────┘
```

---

## 25. Architecture Decision Records (ADRs)

### ADR-001: Monolith over Microservices

```
CONTEXT:
  Building a SaaS product as a solo developer.
  Need to ship MVP in 2-3 months.

DECISION:
  Start with a modular monolith (single Next.js application).

CONSEQUENCES:
  ✅ Faster development (one codebase, one deployment)
  ✅ Simpler debugging (one process, one log stream)
  ✅ Lower infrastructure cost (one server)
  ✅ Shared types between frontend and backend
  ⚠️ Must maintain clean module boundaries to avoid spaghetti
  ⚠️ Single point of failure (mitigated by Vercel's HA)
  ⚠️ Scaling limited to vertical initially

STATUS: Accepted
```

### ADR-002: PostgreSQL over MongoDB

```
CONTEXT:
  Data model is highly relational (owner → property → room → tenant).
  Financial data requires ACID transactions.

DECISION:
  Use PostgreSQL as primary database.

CONSEQUENCES:
  ✅ Strong consistency for financial data
  ✅ Relations expressed naturally (JOIN queries)
  ✅ JSONB for semi-structured data when needed
  ✅ Mature, well-supported, widely hosted
  ⚠️ Schema migrations needed for changes
  ⚠️ Requires more upfront schema design

STATUS: Accepted
```

### ADR-003: Phone OTP over Password Authentication

```
CONTEXT:
  Target users (PG owners) are not tech-savvy.
  Password management is a barrier to adoption.
  Phone number is universal in India.

DECISION:
  Phone OTP as the sole authentication method. No passwords.

CONSEQUENCES:
  ✅ Zero friction for target audience
  ✅ No password reset flow needed
  ✅ No password breach risk
  ✅ Phone OTP is 2FA by default
  ⚠️ Dependent on SMS provider reliability
  ⚠️ SMS costs money (₹0.20/OTP)
  ⚠️ No login without phone access

STATUS: Accepted
```

### ADR-004: Next.js API Routes over Separate Backend

```
CONTEXT:
  Solo developer building full-stack.
  Need shared TypeScript types between frontend and backend.
  Want minimal deployment complexity.

DECISION:
  Use Next.js Route Handlers as the backend API.
  No separate Express/Fastify server.

CONSEQUENCES:
  ✅ Single deployment, single codebase
  ✅ Shared types, schemas, and utilities
  ✅ Vercel deployment handles scaling
  ✅ No CORS configuration needed
  ⚠️ Serverless limitations (cold starts, 10s timeout on hobby)
  ⚠️ Background jobs need external solution
  ⚠️ Must split if backend needs grow significantly

STATUS: Accepted, with plan to split at 2,000+ properties
```

### ADR-005: Cloudflare R2 over AWS S3

```
CONTEXT:
  Need file storage for KYC docs, photos, PDFs.
  Users will frequently download receipts and view photos.
  Cost needs to be minimal for MVP.

DECISION:
  Use Cloudflare R2 (S3-compatible) for file storage.

CONSEQUENCES:
  ✅ Zero egress fees (significant savings on downloads)
  ✅ S3-compatible API (easy migration if needed)
  ✅ Generous free tier (10GB)
  ✅ Cloudflare CDN integration
  ⚠️ Newer service than S3 (less ecosystem)
  ⚠️ Fewer regions than AWS

STATUS: Accepted
```

### ADR-006: Money in Paisa (Integer) over Decimal

```
CONTEXT:
  Financial calculations must be precise.
  Floating point arithmetic has known precision issues.

DECISION:
  Store all monetary values as integers in paisa (1/100 of a rupee).
  ₹8,000.50 stored as 800050.

CONSEQUENCES:
  ✅ No floating point precision errors
  ✅ Integer arithmetic is exact
  ✅ Consistent across database, backend, and frontend
  ⚠️ Must convert for display (divide by 100)
  ⚠️ Must convert user input (multiply by 100)
  ⚠️ All developers must follow this convention

STATUS: Accepted
```

### ADR-007: Manual Payment Recording for MVP

```
CONTEXT:
  Integrating Razorpay Route (split payments) adds complexity.
  Requires owner KYC on Razorpay (onboarding friction).
  Most PG owners currently collect rent offline (cash/UPI).

DECISION:
  MVP supports only manual payment recording.
  Owner records payments after receiving them outside the platform.
  Online payment (Razorpay) deferred to Phase 2.

CONSEQUENCES:
  ✅ Faster MVP development (no payment gateway integration)
  ✅ Lower onboarding friction (no KYC required)
  ✅ Works for existing payment workflows
  ⚠️ No auto-reconciliation in MVP
  ⚠️ Owner must manually record every payment
  ⚠️ Delayed transaction fee revenue

STATUS: Accepted for MVP, revisit in Phase 2
```

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              TENANTEASE ARCHITECTURE                    │
│              ────────────────────                       │
│                                                         │
│  TYPE:        Modular Monolith                          │
│  FRAMEWORK:   Next.js 14 (App Router)                   │
│  LANGUAGE:    TypeScript (end to end)                    │
│  DATABASE:    PostgreSQL (relational, ACID)              │
│  CACHE:       Redis (cache-aside pattern)               │
│  STORAGE:     Cloudflare R2 (S3-compatible)             │
│  AUTH:        Custom Phone OTP + JWT                    │
│  API STYLE:   REST (JSON, versioned)                    │
│  DEPLOYMENT:  Vercel (serverless + edge)                │
│  MULTI-TENANCY: Shared DB, app-level isolation          │
│  BACKGROUND:  Vercel Cron (MVP) → BullMQ (scale)       │
│  ERROR TRACKING: Sentry                                 │
│  LOGGING:     Axiom (structured JSON)                   │
│                                                         │
│  LAYERS:                                                │
│  ├── Presentation (React + Next.js pages)               │
│  ├── API (Route Handlers + Middleware)                   │
│  ├── Service (Business Logic)                           │
│  ├── Data Access (Prisma ORM)                           │
│  └── Infrastructure (External service clients)          │
│                                                         │
│  DESIGNED FOR:                                          │
│  ├── Solo developer velocity                            │
│  ├── Mobile-first Indian market                         │
│  ├── Financial data integrity                           │
│  ├── Graceful degradation                               │
│  └── Future scalability without rewrite                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## End of Document 5

**Next Document:** DOC 6 — Database Schema Design