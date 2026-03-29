# 📄 DOCUMENT 4: TECH STACK & JUSTIFICATION

| Field            | Value                                           |
| ---------------- | ----------------------------------------------- |
| **Product Name** | TenantEase                                      |
| **Version**      | 1.0                                             |
| **Author**       | Vaibhav Patel                                   |
| **Last Updated** | [Date]                                          |
| **Status**       | Draft                                           |
| **Parent Docs**  | DOC 1 — Vision, DOC 2 — PRD, DOC 3 — User Flows |

---

## 📑 Table of Contents

1. [Stack Selection Philosophy](#1-stack-selection-philosophy)
2. [Complete Tech Stack Overview](#2-complete-tech-stack-overview)
3. [Frontend — Detailed Breakdown](#3-frontend--detailed-breakdown)
4. [Backend — Detailed Breakdown](#4-backend--detailed-breakdown)
5. [Database — Detailed Breakdown](#5-database--detailed-breakdown)
6. [Authentication — Detailed Breakdown](#6-authentication--detailed-breakdown)
7. [File Storage — Detailed Breakdown](#7-file-storage--detailed-breakdown)
8. [Payment Integration — Detailed Breakdown](#8-payment-integration--detailed-breakdown)
9. [Notifications — Detailed Breakdown](#9-notifications--detailed-breakdown)
10. [PDF Generation — Detailed Breakdown](#10-pdf-generation--detailed-breakdown)
11. [Background Jobs & Queues](#11-background-jobs--queues)
12. [Caching](#12-caching)
13. [Search](#13-search)
14. [Hosting & Deployment](#14-hosting--deployment)
15. [CI/CD Pipeline](#15-cicd-pipeline)
16. [Monitoring & Observability](#16-monitoring--observability)
17. [Analytics & Tracking](#17-analytics--tracking)
18. [Email Infrastructure](#18-email-infrastructure)
19. [Security Tools](#19-security-tools)
20. [Development Tools](#20-development-tools)
21. [Third-Party Services Summary](#21-third-party-services-summary)
22. [Cost Estimation](#22-cost-estimation)
23. [Stack Alternatives Considered](#23-stack-alternatives-considered)
24. [Scaling Strategy](#24-scaling-strategy)
25. [Technical Debt Prevention](#25-technical-debt-prevention)

---

## 1. Stack Selection Philosophy

### Guiding Principles

Every technology choice in this stack was made based on these priorities, **in order**:

```
1. SPEED OF DEVELOPMENT
   → You're a solo developer. Ship fast or die.
   → Choose tools that let YOU move fastest.
   → No "cool" tech that has a learning curve.

2. SIMPLICITY
   → Less moving parts = less things to break.
   → Fewer services = easier to debug at 2 AM.
   → If you can avoid adding a service, don't add it.

3. COST EFFICIENCY
   → Start at $0-50/month. Not $500/month.
   → Use free tiers aggressively.
   → Pay only when revenue justifies it.

4. SCALABILITY (future-proof, not premature)
   → Design for 10,000 users but deploy for 100.
   → Don't over-engineer. But don't paint yourself into a corner.
   → Choose tech that CAN scale, even if you don't need it now.

5. ECOSYSTEM & COMMUNITY
   → Popular tools = more Stack Overflow answers.
   → More npm packages, more tutorials, more help.
   → Avoid niche tools with 200 GitHub stars.

6. INDIA-SPECIFIC CONSIDERATIONS
   → Payment gateways that work in India (Razorpay, not Stripe).
   → SMS providers with DLT compliance (MSG91).
   → Low-bandwidth optimization (many users on 4G).
   → Mobile-first (90% of users on phones).
```

### The "Solo Developer" Rule

```
Ask yourself before adding ANY technology:

  "Can I debug this at 3 AM when it breaks
   and I have no team to help?"

If the answer is no → pick something simpler.
```

---

## 2. Complete Tech Stack Overview

### The Full Picture

| Category          | Technology                                                                                                                                       |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**      | Next.js 16+ (App Router), React 18+, TypeScript, Tailwind CSS, shadcn/ui, React Hook Form + Zod, TanStack Query, Zustand, Recharts, Lucide React |
| **Backend**       | Next.js API Routes / Route Handlers, TypeScript, Prisma ORM, Zod                                                                                 |
| **Database**      | PostgreSQL (Primary), Redis (Cache/Queue/Rate Limit)                                                                                             |
| **Auth**          | Custom Phone OTP + JWT (Access/Refresh Tokens)                                                                                                   |
| **Storage**       | Cloudflare R2 (S3-compatible)                                                                                                                    |
| **Payments**      | Razorpay (India), Razorpay Subscriptions                                                                                                         |
| **Notifications** | Email: Resend, SMS: MSG91 (DLT Compliant), WhatsApp: Interakt/Wati (Phase 2)                                                                     |
| **PDF**           | @react-pdf/renderer                                                                                                                              |
| **Job Queue**     | BullMQ (Redis-based), node-cron                                                                                                                  |
| **Hosting**       | Vercel (Frontend/API), Supabase/Neon (DB), Upstash (Redis)                                                                                       |
| **Monitoring**    | Sentry (Error), Better Stack/Axiom (Logging), UptimeRobot                                                                                        |
| **Analytics**     | PostHog (Product), Plausible (Web)                                                                                                               |

---

## 3. Frontend — Detailed Breakdown

### 3.1 Next.js 14+ (App Router)

**What:** Full-stack React framework by Vercel.

**Why Next.js over plain React (CRA/Vite)?**

| Feature            | Plain React                       | Next.js                               |
| ------------------ | --------------------------------- | ------------------------------------- |
| SEO                | ❌ Client-rendered, poor SEO      | ✅ SSR/SSG, great SEO                 |
| Performance        | ❌ Large JS bundle sent to client | ✅ Server components, smaller bundles |
| Routing            | Need React Router (manual setup)  | ✅ File-based routing (built-in)      |
| API Backend        | Need separate Express server      | ✅ API routes built-in                |
| Image optimization | Manual                            | ✅ Built-in `next/image`              |
| Deployment         | Manual setup                      | ✅ One-click Vercel deploy            |
| Code splitting     | Manual                            | ✅ Automatic                          |

**Why this matters for TenantEase:**

```
→ VACANCY LISTING PAGES need SEO (Google indexing)
  Next.js SSR/SSG makes these pages crawlable and fast.
  "PG near VIT Pune" → your listing page ranks on Google.

→ MOBILE PERFORMANCE matters (users on 4G phones)
  Server components reduce JS sent to client.
  Pages load faster on slow connections.

→ API ROUTES eliminate need for separate backend server
  One codebase, one deployment, one hosting bill.
  You can always split later if needed.

→ YOU PROBABLY ALREADY KNOW REACT
  Next.js is just React with superpowers.
  Minimal learning curve.
```

**Specific Next.js features we'll use:**

```
→ App Router (not Pages Router — App Router is the future)
→ Server Components (default — reduced client JS)
→ Client Components ("use client" — for interactive UI)
→ Route Handlers (app/api/* — backend API endpoints)
→ Server Actions (form submissions without API boilerplate)
→ Middleware (auth checks, redirects, rate limiting)
→ Dynamic routes (app/property/[id]/page.tsx)
→ Parallel routes (dashboard layout with multiple sections)
→ Loading/Error UI (loading.tsx, error.tsx — built-in)
→ Metadata API (SEO meta tags per page)
→ next/image (optimized images for property/room photos)
→ next/font (optimized font loading)
```

**Version:** 14.x or latest stable (use App Router, not Pages Router)

---

### 3.2 TypeScript

**What:** Typed JavaScript.

**Why TypeScript everywhere (frontend + backend)?**

```
→ CATCH BUGS BEFORE THEY REACH USERS
  "Cannot read property 'name' of undefined" → eliminated.
  TypeScript catches this at compile time.

→ SHARED TYPES BETWEEN FRONTEND AND BACKEND
  Define a Tenant type once → use it in API response,
  form validation, UI components, and database queries.
  One source of truth.

→ AUTOCOMPLETE AND INTELLISENSE
  VS Code knows every field on every object.
  Faster development, fewer trips to documentation.

→ SELF-DOCUMENTING CODE
  Types ARE documentation. New contributors (or future you)
  can read the types and understand the data model.

→ REFACTORING SAFETY
  Rename a field → TypeScript tells you every file that breaks.
  Without types, you'd find this bug in production.

→ YOU'RE BUILDING A FINANCIAL APP
  Rent amounts, deposits, calculations — type safety
  prevents costly numeric errors.
```

**Example — Shared Types:**

```typescript
// types/tenant.ts — used by frontend AND backend

interface Tenant {
  id: string;
  name: string;
  phone: string;
  email?: string; // optional
  roomId: string;
  rentAmount: number; // in paisa (avoid float issues)
  depositAmount: number;
  depositStatus: "paid" | "partial" | "pending";
  moveInDate: Date;
  status: "active" | "notice" | "vacated";
  createdAt: Date;
  updatedAt: Date;
}

// This type is used in:
// → API response (backend sends this)
// → Form validation (frontend validates against this)
// → UI components (frontend renders this)
// → Database schema (Prisma model mirrors this)
```

---

### 3.3 Tailwind CSS

**What:** Utility-first CSS framework.

**Why Tailwind over CSS-in-JS, Bootstrap, or plain CSS?**

```
→ SPEED OF DEVELOPMENT
  No switching between CSS and JS files.
  Style directly in your JSX/TSX.
  "I want a blue button with padding" →
  className="bg-blue-600 px-4 py-2 rounded text-white"
  Done. No writing CSS file. No thinking of class names.

→ CONSISTENT DESIGN SYSTEM
  Built-in spacing scale (4, 8, 12, 16, 20, 24...)
  Built-in color palette (blue-50 through blue-950)
  Built-in responsive breakpoints (sm, md, lg, xl)
  Your UI looks consistent without a design system document.

→ TINY PRODUCTION BUNDLE
  Tailwind purges unused CSS. Final CSS is typically 10-30KB.
  Bootstrap ships 150KB+ even if you use 10% of it.

→ RESPONSIVE DESIGN IS TRIVIAL
  "Stack on mobile, side-by-side on desktop":
  className="flex flex-col md:flex-row"
  Done. Two classes.

→ DARK MODE (if needed later)
  className="bg-white dark:bg-gray-900"
  Built-in. Toggle-ready.

→ PAIRS PERFECTLY WITH shadcn/ui
  shadcn/ui is built on Tailwind.
  Best component library in the React ecosystem right now.
```

**Tailwind Configuration for TenantEase:**

```javascript
// tailwind.config.ts
{
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: {
          50: '#f0f9ff',   // lightest
          500: '#3b82f6',  // main brand blue
          600: '#2563eb',  // hover
          700: '#1d4ed8',  // active
          900: '#1e3a5f',  // darkest
        },
        // Status colors (rent status, occupancy)
        success: '#22c55e',  // paid, occupied
        warning: '#f59e0b',  // partial, notice period
        danger: '#ef4444',   // overdue, vacant
        info: '#3b82f6',     // informational
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
}
```

---

### 3.4 shadcn/ui

**What:** A collection of re-usable, accessible, customizable React components built on Radix UI + Tailwind.

**Why shadcn/ui over Material UI, Ant Design, Chakra UI?**

```
→ NOT A DEPENDENCY — IT'S COPY-PASTED CODE
  You own the component code. It's in YOUR project.
  No version conflicts. No breaking updates.
  Full control to customize anything.

→ BUILT ON RADIX UI (accessibility king)
  Keyboard navigation, screen reader support,
  focus management — all handled correctly.
  You don't need to think about a11y edge cases.

→ STYLED WITH TAILWIND (consistent with your stack)
  No separate styling system. Everything is Tailwind.
  Customize any component by editing Tailwind classes.

→ BEAUTIFUL DEFAULTS
  Looks professional out of the box.
  Your PG owner doesn't care about design systems —
  they care that it looks clean and modern.

→ EXACTLY THE COMPONENTS YOU NEED:
  Button, Input, Select, Dialog, Toast, Table,
  Card, Badge, Tabs, Calendar, DatePicker,
  DropdownMenu, Sheet (mobile drawer), Form...
  Everything TenantEase needs.
```

**Components we'll use heavily:**

```
→ <Button>         — Actions everywhere
→ <Input>          — Form fields
→ <Select>         — Dropdowns (room type, city, etc.)
→ <Dialog>         — Confirmation modals
→ <Sheet>          — Mobile sidebar navigation
→ <Table>          — Tenant list, rent status, reports
→ <Card>           — Room cards, dashboard sections
→ <Badge>          — Status badges (Paid, Unpaid, Overdue)
→ <Tabs>           — Tenant profile tabs
→ <Toast>          — Success/error notifications
→ <Calendar>       — Date picking for due dates, move-in
→ <Form>           — Integrated with React Hook Form
→ <Popover>        — Quick info panels
→ <Command>        — Search (tenant search, property switcher)
→ <Skeleton>       — Loading states
→ <Alert>          — Warnings, info messages
→ <Progress>       — Collection progress bar on dashboard
→ <Avatar>         — Tenant photos
→ <Separator>      — Visual dividers
```

---

### 3.5 React Hook Form + Zod

**What:** Form management library + schema validation library.

**Why React Hook Form?**

```
→ TENANTEASE IS 70% FORMS
  Add property form. Add room form. Add tenant form.
  Record payment form. Maintenance request form.
  Settings forms. Agreement forms.

  Forms are the CORE of this product.
  You need the best form library.

→ PERFORMANCE
  React Hook Form uses uncontrolled components.
  Doesn't re-render the entire form on every keystroke.
  Important when you have 20+ fields on a form
  running on a budget Android phone.

→ MINIMAL BOILERPLATE
  Register a field, set validation, get values. Done.
  Way less code than Formik.
```

**Why Zod?**

```
→ TYPE-SAFE VALIDATION
  Define schema once → use for:
  1. Frontend form validation
  2. Backend API input validation
  3. TypeScript type inference

→ SHARED BETWEEN FRONTEND AND BACKEND
  Same validation runs on client (instant feedback)
  AND server (security, can't be bypassed).

→ WORKS PERFECTLY WITH REACT HOOK FORM
  @hookform/resolvers/zod → plug and play.
```

**Example:**

```typescript
// schemas/tenant.ts — shared between frontend & backend

import { z } from "zod";

export const addTenantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter valid 10-digit Indian mobile number"),
  email: z.string().email("Enter valid email").optional().or(z.literal("")),
  roomId: z.string().uuid("Select a room"),
  rentAmount: z
    .number()
    .min(0, "Rent can't be negative")
    .max(1000000, "Check the amount"),
  moveInDate: z.date(),
  depositAmount: z.number().min(0),
  depositStatus: z.enum(["paid", "partial", "pending"]),
  gender: z.enum(["male", "female", "other"]),
  aadhaarNumber: z
    .string()
    .regex(/^\d{12}$/, "Aadhaar must be 12 digits")
    .optional()
    .or(z.literal("")),
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN format")
    .optional()
    .or(z.literal("")),
});

// Auto-infer TypeScript type from Zod schema
export type AddTenantInput = z.infer<typeof addTenantSchema>;

// Used in:
// → Frontend: React Hook Form resolver
// → Backend: API route input validation
// → Both use the SAME schema. Single source of truth.
```

---

### 3.6 TanStack Query (React Query)

**What:** Server state management — data fetching, caching, synchronization.

**Why TanStack Query?**

```
→ DATA FETCHING DONE RIGHT
  Handles: loading states, error states, refetching,
  caching, background updates, pagination,
  optimistic updates — all out of the box.

→ AUTOMATIC CACHING & BACKGROUND REFETCH
  Tenant list fetched once → cached.
  Navigate away and back → instant (from cache).
  Meanwhile, background refetch ensures fresh data.
  Result: fast UI even on slow connections.

→ MUTATIONS WITH OPTIMISTIC UPDATES
  "Record payment" → UI updates instantly →
  API call happens in background →
  If it fails, UI rolls back.
  Result: snappy, responsive feel.

→ NO GLOBAL STATE MANAGEMENT FOR SERVER DATA
  You DON'T need Redux for API data.
  TanStack Query handles all server state.
  Zustand handles only UI state (sidebar open,
  selected property, etc.)
```

**Example:**

```typescript
// Fetch tenants for current property
const {
  data: tenants,
  isLoading,
  error,
} = useQuery({
  queryKey: ["tenants", propertyId],
  queryFn: () => api.getTenants(propertyId),
  staleTime: 5 * 60 * 1000, // 5 minutes cache
});

// Record payment mutation with optimistic update
const recordPayment = useMutation({
  mutationFn: (data) => api.recordPayment(data),
  onSuccess: () => {
    // Invalidate and refetch rent status
    queryClient.invalidateQueries(["rentStatus", propertyId]);
    toast.success("Payment recorded!");
  },
});
```

---

### 3.7 Zustand

**What:** Tiny state management library (2KB).

**Why Zustand over Redux, Context API, Jotai, Recoil?**

```
→ MINIMAL BOILERPLATE
  Redux: actions, reducers, slices, middleware, selectors...
  Zustand: one file, one function. Done.

→ YOU BARELY NEED CLIENT STATE
  Most state in TenantEase is SERVER state (handled by TanStack Query).
  Client state is minimal:
    • Currently selected property
    • Sidebar open/closed
    • Theme preference
    • Modal open/closed states
    • Onboarding wizard step
  That's it. Zustand handles this in ~50 lines of code.

→ NO PROVIDER WRAPPING
  Unlike Context API, no <Provider> nesting.
  Just import and use. Anywhere.
```

**Example:**

```typescript
// store/app.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppStore {
  selectedPropertyId: string | null;
  sidebarOpen: boolean;
  setSelectedProperty: (id: string) => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      selectedPropertyId: null,
      sidebarOpen: false,
      setSelectedProperty: (id) => set({ selectedPropertyId: id }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    { name: "tenantease-app-store" }, // persists to localStorage
  ),
);
```

---

### 3.8 Recharts

**What:** React charting library built on D3.

**Why Recharts?**

```
→ REACT-NATIVE INTEGRATION
  Components, not imperative D3 code.
  <BarChart>, <LineChart>, <PieChart> — just JSX.

→ RESPONSIVE
  Charts resize with container. Mobile-friendly.

→ LIGHTWEIGHT ENOUGH
  ~40KB gzipped. Acceptable for the analytics page.
  Only loaded on the analytics page (code-split).

→ WHAT WE'LL CHART:
  • Monthly income bar chart (dashboard analytics)
  • Occupancy rate line chart (trend over 12 months)
  • Collection rate line chart
  • Payment mode pie chart (Cash vs UPI vs Online)
  • Expense breakdown pie chart
  • Revenue by room type pie chart
```

**Alternative considered:** Chart.js (react-chartjs-2) — also good, slightly smaller, but Recharts has better React integration and declarative API.

---

## 4. Backend — Detailed Breakdown

### 4.1 Architecture Decision: Monolith (Next.js API Routes)

**Decision:** Start with Next.js API routes (Route Handlers) as the backend. NOT a separate Express server.

**Why monolith over microservices / separate backend?**

```
SOLO DEVELOPER RULE:
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   Monolith → Modular Monolith → Microservices           │
│   ^^^^^^^^                                              │
│   YOU ARE HERE                                           │
│                                                         │
│   Do NOT start with microservices.                       │
│   Do NOT start with a separate backend.                  │
│   You'll waste time on:                                  │
│   → CORS configuration                                  │
│   → Separate deployments                                │
│   → API versioning                                       │
│   → Network latency between services                    │
│   → Two repos, two CI/CD pipelines                      │
│   → JWT sharing between services                        │
│                                                         │
│   Instead: ONE Next.js app. Frontend + Backend.          │
│   Split later IF and WHEN you need to (at 10,000+ users)│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Backend structure within Next.js:**

```
app/
├── api/
│   ├── auth/
│   │   ├── send-otp/route.ts       → POST: send OTP
│   │   ├── verify-otp/route.ts     → POST: verify OTP
│   │   ├── logout/route.ts         → POST: logout
│   │   └── me/route.ts             → GET: current user
│   │
│   ├── properties/
│   │   ├── route.ts                → GET: list, POST: create
│   │   └── [id]/
│   │       ├── route.ts            → GET, PUT, DELETE
│   │       ├── rooms/route.ts      → GET, POST
│   │       ├── tenants/route.ts    → GET, POST
│   │       └── rent-status/route.ts → GET
│   │
│   ├── rooms/
│   │   └── [id]/route.ts           → GET, PUT, DELETE
│   │
│   ├── tenants/
│   │   ├── route.ts                → POST (add)
│   │   ├── import/route.ts         → POST (bulk CSV)
│   │   └── [id]/
│   │       ├── route.ts            → GET, PUT
│   │       ├── vacate/route.ts     → POST
│   │       ├── transfer/route.ts   → POST
│   │       ├── payments/route.ts   → GET, POST
│   │       └── receipts/route.ts   → GET, POST
│   │
│   ├── payments/
│   │   └── [id]/route.ts           → PUT, DELETE
│   │
│   ├── maintenance/
│   │   ├── route.ts                → GET, POST
│   │   └── [id]/route.ts           → GET, PUT
│   │
│   ├── receipts/
│   │   ├── [id]/download/route.ts  → GET (PDF download)
│   │   └── bulk/route.ts           → POST (bulk generate)
│   │
│   ├── reminders/
│   │   ├── send/route.ts           → POST (manual send)
│   │   └── config/route.ts         → GET, PUT
│   │
│   ├── announcements/
│   │   ├── route.ts                → GET, POST
│   │   └── [id]/route.ts           → PUT, DELETE
│   │
│   ├── reports/
│   │   ├── monthly/route.ts        → GET
│   │   ├── annual/route.ts         → GET
│   │   └── export/route.ts         → GET (Excel/CSV)
│   │
│   ├── subscription/
│   │   ├── route.ts                → GET current plan
│   │   ├── upgrade/route.ts        → POST
│   │   └── webhook/route.ts        → POST (Razorpay webhook)
│   │
│   ├── webhooks/
│   │   └── razorpay/route.ts       → POST (payment webhooks)
│   │
│   ├── upload/
│   │   └── route.ts                → POST (file upload to S3/R2)
│   │
│   └── admin/                       → Internal admin endpoints
│       ├── stats/route.ts
│       └── users/route.ts
│
├── (dashboard)/                     → Owner dashboard pages
├── (portal)/                        → Tenant portal pages
├── (auth)/                          → Login/register pages
├── (public)/                        → Public pages (listings, landing)
└── (admin)/                         → Internal admin pages
```

### 4.2 Backend Code Organization

**Even within the monolith, keep code organized:**

```
src/
├── lib/
│   ├── db.ts                → Prisma client instance
│   ├── auth.ts              → Auth utilities (verify token, get user)
│   ├── redis.ts             → Redis client instance
│   ├── s3.ts                → S3/R2 upload utilities
│   ├── razorpay.ts          → Razorpay client instance
│   ├── email.ts             → Email sending utilities
│   ├── sms.ts               → SMS sending utilities
│   ├── pdf.ts               → PDF generation utilities
│   └── utils.ts             → General utilities
│
├── services/
│   ├── property.service.ts  → Property business logic
│   ├── room.service.ts      → Room business logic
│   ├── tenant.service.ts    → Tenant CRUD + business rules
│   ├── payment.service.ts   → Payment recording + calculations
│   ├── receipt.service.ts   → Receipt generation logic
│   ├── reminder.service.ts  → Reminder scheduling + sending
│   ├── maintenance.service.ts → Maintenance request logic
│   ├── billing.service.ts   → Rent generation, utility billing
│   ├── subscription.service.ts → Plan management
│   └── analytics.service.ts → Reports and metrics
│
├── schemas/
│   ├── property.schema.ts   → Zod schemas for property
│   ├── room.schema.ts
│   ├── tenant.schema.ts
│   ├── payment.schema.ts
│   └── ...
│
├── types/
│   ├── index.ts             → Shared TypeScript types/interfaces
│   ├── api.ts               → API request/response types
│   └── enums.ts             → Enums (room types, status, etc.)
│
├── middleware/
│   ├── auth.ts              → Auth middleware
│   ├── rateLimit.ts         → Rate limiting
│   └── validation.ts        → Request validation
│
├── jobs/
│   ├── rentGeneration.ts    → Monthly rent entry generation
│   ├── reminderSender.ts    → Daily reminder job
│   ├── receiptCleanup.ts    → Old receipt cleanup
│   └── index.ts             → Job scheduler setup
│
└── constants/
    ├── plans.ts             → Plan definitions and limits
    ├── templates.ts         → Notification templates
    └── config.ts            → App configuration
```

---

### 4.3 API Design Principles

```
→ RESTful endpoints (not GraphQL — overkill for this)
→ Consistent response format:
  {
    success: true,
    data: { ... },
    message: "Tenant created successfully"
  }
  OR
  {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Phone number already exists",
      details: [{ field: "phone", message: "..." }]
    }
  }

→ HTTP status codes used correctly:
  200 → Success (GET, PUT)
  201 → Created (POST that creates)
  204 → No Content (DELETE)
  400 → Bad Request (validation error)
  401 → Unauthorized (not logged in)
  403 → Forbidden (logged in but no permission)
  404 → Not Found
  409 → Conflict (duplicate phone number, etc.)
  422 → Unprocessable Entity (business rule violation)
  429 → Too Many Requests (rate limited)
  500 → Internal Server Error

→ Pagination for lists:
  GET /api/properties/123/tenants?page=1&limit=25&status=active
  Response: {
    data: [...],
    pagination: {
      page: 1,
      limit: 25,
      total: 48,
      totalPages: 2,
      hasNext: true,
      hasPrev: false
    }
  }

→ Filtering and sorting:
  GET /api/properties/123/tenants?status=active&sort=name&order=asc

→ Every mutation endpoint validates input with Zod
→ Every endpoint checks authentication
→ Every endpoint checks authorization (RBAC)
→ Every write endpoint creates audit log entry
```

---

## 5. Database — Detailed Breakdown

### 5.1 PostgreSQL

**What:** Open-source relational database. The industry standard.

**Why PostgreSQL over MySQL, MongoDB, Supabase (as DB)?**

```
→ RELATIONAL DATA = RELATIONAL DATABASE
  TenantEase data is HIGHLY relational:
  Owner → has → Properties → have → Rooms → have → Tenants
  Tenants → have → Payments → have → Receipts
  Properties → have → Announcements
  Tenants → raise → Maintenance Requests

  This is textbook relational data. PostgreSQL is the
  best relational database. Period.

→ ACID COMPLIANCE
  Financial data (rent, deposits, payments) MUST be consistent.
  "Record payment + update rent status + generate receipt"
  should either ALL succeed or ALL fail.
  PostgreSQL transactions guarantee this.

→ JSON SUPPORT (WHEN NEEDED)
  Some fields benefit from JSON storage:
  → Additional charges (flexible structure)
  → Notification preferences
  → Onboarding wizard state
  PostgreSQL's JSONB type handles this beautifully.

→ FULL-TEXT SEARCH
  Search tenants by name, search across rooms —
  PostgreSQL's built-in FTS is good enough for our scale.
  No need for Elasticsearch.

→ MATURE, BATTLE-TESTED, MASSIVE COMMUNITY
  25+ years of development. Used by Instagram, Reddit, Spotify.
  Every possible question has been answered on Stack Overflow.
```

**PostgreSQL-specific features we'll use:**

```
→ JSONB columns (flexible data like additional charges)
→ UUID primary keys (better for distributed systems, no guessing)
→ Enums (room_type, rent_status, tenant_status — type-safe at DB level)
→ Indexes (phone number, property_id, status — query performance)
→ Partial indexes (WHERE status = 'active' — only index active tenants)
→ Triggers (auto-update timestamps, audit logging)
→ Row-Level Security (tenant isolation — each owner sees only their data)
→ Full-text search (tenant name search across properties)
→ Date/time functions (rent due date calculations, overdue checks)
→ Array types (amenities list)
→ CHECK constraints (rent_amount >= 0, phone length = 10)
```

**Hosting options (in order of recommendation):**

```
1. Supabase (free tier: 500MB, 2 projects)
   → Managed PostgreSQL + built-in auth + realtime + storage
   → Free tier is generous for MVP
   → Easy migration to paid when ready ($25/mo)
   → Bonus: Supabase dashboard for DB management

2. Neon (free tier: 512MB, branching)
   → Serverless PostgreSQL (scales to zero)
   → Great developer experience
   → Free tier sufficient for MVP

3. Railway (free trial, then $5/mo)
   → Simple, developer-friendly
   → PostgreSQL with one click
   → Good for small-medium scale

4. AWS RDS ($15-30/mo for smallest instance)
   → Enterprise-grade reliability
   → Use when you have paying customers and revenue
   → Overkill for MVP
```

**Recommendation:** Start with **Supabase** (free tier) or **Neon** (free tier). Migrate to dedicated PostgreSQL when you outgrow free tiers.

---

### 5.2 Prisma ORM

**What:** Type-safe database toolkit for TypeScript.

**Why Prisma over raw SQL, Drizzle, TypeORM, Knex?**

```
→ TYPE SAFETY WITH TYPESCRIPT
  Prisma generates TypeScript types from your schema.
  prisma.tenant.findMany() → returns Tenant[] type.
  No manual type definitions. No type mismatches.
  If you add a column, TypeScript errors everywhere it's used.

→ AUTO-GENERATED MIGRATIONS
  Change your schema → run `prisma migrate dev` →
  SQL migration auto-generated and applied.
  No writing ALTER TABLE statements manually.

→ INCREDIBLE DX (Developer Experience)
  Auto-complete for every query.
  Relation loading with .include().
  Filtering, pagination, ordering — all type-safe.

→ WORKS PERFECTLY WITH NEXT.JS
  Same TypeScript runtime. Same types.
  Used by most Next.js projects.

→ DATABASE SEEDING
  Write seed scripts to populate test data.
  `prisma db seed` → your dev database has sample data.

→ PRISMA STUDIO
  Visual database browser.
  `npx prisma studio` → opens in browser.
  See your data, edit records, explore relations.
  Great for development and debugging.
```

**Why not Drizzle?**

```
Drizzle is excellent and gaining popularity.
It's more lightweight and SQL-like than Prisma.
Valid alternative. You could use it instead.

But Prisma has:
→ Larger community (more answers when you're stuck)
→ Better documentation
→ Prisma Studio (visual DB browser)
→ More mature migration system
→ You're more likely to find Prisma tutorials for Next.js

Choose Prisma for safety. Choose Drizzle if you prefer
SQL-like syntax and want smaller bundle size.
Both are excellent choices.
```

---

### 5.3 Redis

**What:** In-memory data store. Used for caching, sessions, rate limiting, and job queues.

**Why Redis?**

```
→ OTP STORAGE
  Store OTP with 5-minute TTL (time-to-live).
  Redis auto-deletes expired OTPs. No cleanup needed.
  SET otp:9876543210 "123456" EX 300

→ SESSION STORAGE
  User sessions stored in Redis (fast read).
  Session expiry handled by Redis TTL.
  Alternative: JWT with refresh tokens (no Redis needed for sessions).

→ RATE LIMITING
  "Max 3 OTP requests per hour per phone number"
  Redis INCR + EXPIRE makes this trivial.
  "Max 100 API requests per minute per user"
  Implemented with Redis sliding window.

→ CACHING
  Dashboard data: calculate once, cache for 5 minutes.
  Property stats: cache until data changes (invalidate on write).
  Saves database queries on every page load.

→ JOB QUEUES (BullMQ)
  Background jobs run on Redis-based queues.
  Reminder sending, receipt generation, CSV import processing.
  BullMQ uses Redis as its backbone.

→ REAL-TIME FEATURES (future)
  If we ever add real-time notifications or live dashboard
  updates, Redis Pub/Sub can power this.
```

**Hosting:**

```
1. Upstash (RECOMMENDED for MVP)
   → Serverless Redis — pay per request
   → Free tier: 10,000 commands/day
   → Perfect for MVP scale
   → Works great with Vercel (both serverless)
   → Global edge locations

2. Railway Redis ($5/mo)
   → Simple, always-on Redis instance
   → Good for background jobs (BullMQ needs persistent connection)

3. AWS ElastiCache ($15+/mo)
   → Overkill for MVP. Use when scaling.
```

**Recommendation:** **Upstash** for caching/OTP/rate limiting. If using BullMQ for jobs, need a persistent Redis (Railway or Upstash with persistent connection).

---

## 6. Authentication — Detailed Breakdown

### 6.1 Auth Strategy: Phone OTP (Custom Implementation)

**Decision:** Build custom phone OTP authentication. Not NextAuth/Auth.js.

**Why custom over NextAuth?**

```
→ NEXTAUTH IS DESIGNED FOR OAuth/Social LOGIN
  Google, GitHub, Facebook login → NextAuth is perfect.
  Phone OTP → NextAuth CAN do it with custom provider,
  but it's fighting the library's design.

→ OUR AUTH IS SIMPLE
  1. User enters phone number
  2. We send OTP via SMS
  3. User enters OTP
  4. We verify → create/return JWT

  That's it. No OAuth flows. No social providers.
  No password hashing. No email verification.
  Building this custom takes 2-3 hours.

→ FULL CONTROL
  Custom logic for:
  → Rate limiting OTP requests
  → OTP expiry
  → Device fingerprinting (future)
  → Role-based access (owner/tenant/staff)
  → Multi-tenancy (which property, which role)

  With NextAuth, you're working around the library for all of this.
```

**Auth Flow (Technical):**

```
REGISTRATION / LOGIN:

1. Client → POST /api/auth/send-otp
   Body: { phone: "9876543210" }

   Server:
   → Rate limit check (Redis: max 3 per hour per phone)
   → Generate 6-digit OTP
   → Store in Redis: SET otp:9876543210 "123456" EX 300
   → Send via SMS (MSG91)
   → Response: { success: true, message: "OTP sent" }

2. Client → POST /api/auth/verify-otp
   Body: { phone: "9876543210", otp: "123456" }

   Server:
   → Fetch from Redis: GET otp:9876543210
   → Compare with submitted OTP
   → If match:
     → Delete OTP from Redis
     → Find or create user in PostgreSQL
     → Generate JWT tokens:
       - Access token (short-lived: 15 minutes)
       - Refresh token (long-lived: 30 days)
     → Set refresh token in httpOnly cookie
     → Response: {
         success: true,
         accessToken: "eyJ...",
         user: { id, name, role, ... }
       }
   → If no match:
     → Increment attempt counter in Redis
     → Response: { success: false, error: "Invalid OTP" }

3. Authenticated requests:
   → Client sends: Authorization: Bearer <accessToken>
   → Server middleware:
     → Verify JWT signature
     → Check expiry
     → Extract user ID and role
     → Attach to request context
     → If expired → client uses refresh token to get new access token

4. Token refresh:
   → Client → POST /api/auth/refresh
   → Server reads refresh token from httpOnly cookie
   → Verifies refresh token
   → Issues new access token
   → Response: { accessToken: "eyJ..." }

5. Logout:
   → Client → POST /api/auth/logout
   → Server:
     → Clear refresh token cookie
     → Blacklist refresh token in Redis (prevent reuse)
     → Response: { success: true }
```

**JWT Token Structure:**

```typescript
// Access Token Payload
{
  sub: "user-uuid-here",           // user ID
  role: "owner",                   // owner | tenant | staff
  propertyIds: ["prop-1", "prop-2"], // accessible properties
  staffRole: null,                 // manager | accountant | warden (for staff)
  plan: "pro",                     // free | starter | pro | business
  iat: 1717578000,                // issued at
  exp: 1717578900                 // expires (15 min)
}

// Refresh Token Payload
{
  sub: "user-uuid-here",
  type: "refresh",
  iat: 1717578000,
  exp: 1720170000                 // expires (30 days)
}
```

---

## 7. File Storage — Detailed Breakdown

### 7.1 Cloudflare R2 (Recommended) or AWS S3

**What we store:**

```
→ Tenant KYC documents (Aadhaar card images, PAN card)
→ Tenant photos (profile pictures)
→ Property photos (exterior, rooms)
→ Room photos
→ Maintenance request photos (issue photos, resolution photos)
→ Generated PDFs (rent receipts, agreements, settlement docs)
→ CSV uploads (bulk tenant import)
```

**Why Cloudflare R2 over AWS S3?**

```
→ S3-COMPATIBLE API
  Exact same API as S3. Same SDKs work.
  If you know S3, you know R2.
  Can switch between them with just config change.

→ NO EGRESS FEES
  S3 charges $0.09/GB for data transfer OUT.
  R2 charges $0 for egress.
  When tenants download receipts, property photos are loaded,
  images are served → egress adds up fast on S3.
  R2 saves real money at scale.

→ FREE TIER
  10GB storage free
  10 million reads/month free
  1 million writes/month free
  More than enough for MVP and early growth.

→ PAIRED WITH CLOUDFLARE CDN
  Files served from edge locations closest to user.
  Faster image loading for property photos.
```

**File Organization:**

```
tenantease-files/
├── properties/
│   └── {property_id}/
│       ├── photos/
│       │   ├── photo-1.webp
│       │   └── photo-2.webp
│       └── rooms/
│           └── {room_id}/
│               └── photos/
│                   └── photo-1.webp
├── tenants/
│   └── {tenant_id}/
│       ├── profile/
│       │   └── avatar.webp
│       └── documents/
│           ├── aadhaar-front.webp
│           ├── aadhaar-back.webp
│           └── pan.webp
├── maintenance/
│   └── {request_id}/
│       ├── issue-photo-1.webp
│       └── resolution-photo-1.webp
├── receipts/
│   └── {year}/
│       └── {month}/
│           └── {receipt_id}.pdf
├── agreements/
│   └── {tenant_id}/
│       └── agreement-{date}.pdf
└── imports/
    └── {upload_id}/
        └── tenants.csv
```

**Upload Implementation:**

```
→ PRESIGNED URLs (recommended):
  1. Client requests upload URL from backend
  2. Backend generates presigned URL (valid 15 min)
  3. Client uploads directly to R2/S3 (no backend bandwidth used)
  4. Client sends file metadata to backend for database record

  Benefit: Backend never handles file bytes.
  Scales better. Faster uploads.

→ Image processing:
  → Accept: JPEG, PNG, WebP
  → Max size: 5MB per image
  → Auto-resize on upload (max 1920px wide)
  → Convert to WebP (smaller file size, faster loading)
  → Generate thumbnail (200x200) for list views
  → Use sharp (npm) for server-side processing
  OR
  → Cloudflare Image Transformations (if using R2)
```

---

## 8. Payment Integration — Detailed Breakdown

### 8.1 Razorpay

**What:** India's leading payment gateway.

**Why Razorpay over Stripe, PayU, Cashfree?**

```
→ BEST UPI INTEGRATION
  UPI is how India pays. Razorpay handles it natively.
  QR code, UPI ID, intent-based — all supported.

→ MOST POPULAR IN INDIA
  Used by Zomato, Swiggy, Cred, and millions of businesses.
  Users recognize and trust the Razorpay checkout.

→ RAZORPAY ROUTE (for marketplace model)
  Split payments: rent goes to owner's account,
  platform fee goes to your account.
  Automatic. No manual settlement.

→ RAZORPAY SUBSCRIPTIONS
  For TenantEase's own subscription billing.
  Owner subscribes to Starter/Pro/Business plan →
  Razorpay handles recurring charges automatically.

→ EXCELLENT DEVELOPER EXPERIENCE
  Great docs. Great SDK. Good support.
  razorpay npm package is well-maintained.

→ DASHBOARD & REPORTING
  Razorpay dashboard shows all transactions.
  Useful for reconciliation and dispute management.
```

**Two separate Razorpay use cases:**

```
USE CASE 1: PLATFORM SUBSCRIPTIONS
(Owner pays TenantEase for Starter/Pro/Business plan)

  → Razorpay Subscriptions API
  → Owner subscribes → recurring monthly/annual charge
  → Razorpay handles retry on failure
  → Webhook notification on payment/failure
  → Money goes to TenantEase's Razorpay account

USE CASE 2: TENANT RENT PAYMENTS
(Tenant pays rent to Owner through TenantEase)

  → Razorpay Payment Links OR Checkout
  → Razorpay Route (split payment):
    • 98% to Owner's bank account (connected via Route)
    • 2% to TenantEase (platform fee)
  → Requires: Owner KYC on Razorpay (PAN, bank account)
  → Webhook on payment success → auto-record in TenantEase
  → Settlement to owner: T+2 days

  ALTERNATIVE (simpler for MVP):
  → Don't process payments through platform initially
  → Just send payment reminders with owner's UPI ID
  → Owner records payment manually after receiving UPI/cash
  → Add Razorpay integration in Phase 2
  → This removes Razorpay Route complexity from MVP
```

**Recommendation:** For MVP, DON'T integrate Razorpay for tenant payments. Just do manual payment recording. Add Razorpay in Phase 2 after validating the product.

---

## 9. Notifications — Detailed Breakdown

### 9.1 Email — Resend (Recommended)

**Why Resend over SendGrid, AWS SES, Mailgun?**

```
→ DEVELOPER-FIRST
  Beautiful API. Great DX. Modern.
  Feels like it was built for developers, not marketers.

→ REACT EMAIL INTEGRATION
  Build email templates in React + Tailwind.
  Same component model as your frontend.
  No learning a separate template language.

→ FREE TIER
  100 emails/day free (3,000/month)
  Sufficient for MVP (receipts, reminders, confirmations)

→ SIMPLE PRICING
  $20/mo for 50,000 emails when you scale.

→ GREAT DELIVERABILITY
  Emails actually reach inbox, not spam.
```

**Emails we'll send:**

```
TRANSACTIONAL:
→ OTP for login/registration
→ Welcome email (after registration)
→ Payment confirmation
→ Rent receipt (with PDF attachment)
→ Maintenance request status update
→ Annual receipt summary notification
→ Subscription invoice
→ Subscription renewal reminder

REMINDER:
→ Pre-due rent reminder
→ On-due rent reminder
→ Overdue rent reminder

SYSTEM:
→ Account-related (phone number change, subscription change)
→ New feature announcements
→ Weekly summary (optional — for owners)
```

---

### 9.2 SMS — MSG91

**Why MSG91 over Twilio, Kaleyra, Textlocal?**

```
→ INDIA-FOCUSED
  Built for Indian market. Understands DLT compliance.
  DLT (Distributed Ledger Technology) registration is MANDATORY
  for sending SMS in India. MSG91 handles this well.

→ AFFORDABLE
  ₹0.15-0.25 per SMS (depending on volume)
  Twilio charges ₹0.50+ per SMS to India. 2x-3x more expensive.

→ OTP WIDGET
  Pre-built OTP verification flow.
  Auto-read OTP on Android (reduces friction).
  Rate limiting built-in.

→ GOOD API & DOCUMENTATION
  RESTful API. Node.js SDK available.
  Reliable delivery in India.

→ DLT REGISTRATION SUPPORT
  MSG91 helps with DLT template registration.
  Required by TRAI for sending promotional/transactional SMS.
```

**DLT Compliance (Important for India):**

```
WHAT IS DLT?
→ TRAI (Telecom Regulatory Authority of India) mandates that
  every SMS sent to Indian numbers must be:
  1. From a registered sender ID (e.g., "TNTEAS")
  2. Using a pre-registered template
  3. Categorized: Transactional / Promotional / Service

WHAT YOU NEED TO DO:
  1. Register as a business on a DLT platform
     (Jio, Airtel, Vodafone — any one)
  2. Register your sender ID: "TNTEAS" or "TNEASE"
  3. Register each SMS template:
     Template: "Dear {#var#}, your rent of Rs.{#var#} for
     {#var#} is due on {#var#}. Please pay to avoid late fees.
     — {#var#}"
  4. Get template approved (takes 1-3 days)
  5. Use registered template ID when sending via MSG91

  MSG91 provides tools to manage DLT registration.
  Budget 1-2 weeks for DLT setup before SMS features go live.
```

---

### 9.3 WhatsApp — Interakt/Wati (Phase 2)

```
→ NOT IN MVP
→ WhatsApp Business API requires:
  1. Facebook Business Manager account
  2. WhatsApp Business API approval
  3. Phone number dedicated for WhatsApp Business
  4. Pre-approved message templates
  5. Per-message cost (~₹0.50-1.00 per message)

→ PROVIDERS:
  Interakt → affordable, India-focused, good for small biz
  Wati → popular, good API
  AiSensy → affordable, growing

→ WHY WHATSAPP MATTERS (for Phase 2+):
  • India has 500M+ WhatsApp users
  • PG owners and tenants both live on WhatsApp
  • WhatsApp rent reminders will have 95%+ open rate
    (vs 20% email, 70% SMS)
  • "Pay Now" button in WhatsApp → tenant taps →
    opens payment page → pays → auto-recorded
  • This will be the KILLER feature for paid plans

→ COST MANAGEMENT:
  • Only send WhatsApp for paid plan users
  • Limit to rent reminders and payment confirmations
  • ~₹1 per message × 100 tenants × 3 messages/month
    = ₹300/month per property → covered by ₹299+ subscription
```

---

## 10. PDF Generation — Detailed Breakdown

### 10.1 @react-pdf/renderer (Recommended)

**What:** Build PDFs using React components.

**Why @react-pdf/renderer over Puppeteer, jsPDF, pdfkit?**

```
→ REACT COMPONENTS = PDF PAGES
  You already think in React. Build PDFs the same way.
  <Document>, <Page>, <View>, <Text>, <Image> — familiar.

→ SERVER-SIDE RENDERING
  Generates PDF on the server (API route).
  No headless browser needed (unlike Puppeteer).
  Faster. Less memory. Cheaper hosting.

→ PIXEL-PERFECT CONTROL
  Full control over layout, fonts, colors, spacing.
  Rent receipts need to look professional — this delivers.

→ NO BROWSER DEPENDENCY
  Puppeteer needs headless Chrome installed.
  That's 200MB+ just for PDF generation.
  @react-pdf/renderer is a pure Node.js library. ~5MB.

→ WORKS IN SERVERLESS
  Can run in Vercel serverless functions.
  Puppeteer CANNOT (too large for serverless).
  This is critical if hosting on Vercel.
```

**What we'll generate as PDFs:**

```
→ Individual rent receipts
→ Bulk receipts (multi-page PDF)
→ Annual receipt summary
→ Rental agreements (multi-page)
→ Final settlement document
→ Financial reports (monthly, annual)
→ Tenant list export
→ Maintenance summary report
```

**Example rent receipt component:**

```typescript
// Very simplified example to show the approach

import { Document, Page, View, Text } from '@react-pdf/renderer';

const RentReceipt = ({ receipt }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.title}>RENT RECEIPT</Text>
        <Text>Receipt No: {receipt.number}</Text>
        <Text>Date: {receipt.date}</Text>
      </View>
      <View style={styles.body}>
        <Text>Received from: {receipt.tenantName}</Text>
        <Text>Amount: ₹{receipt.amount}</Text>
        <Text>For month: {receipt.month}</Text>
        <Text>Payment mode: {receipt.paymentMode}</Text>
      </View>
      <View style={styles.footer}>
        <Text>Landlord: {receipt.ownerName}</Text>
        <Text>PAN: {receipt.ownerPan}</Text>
      </View>
    </Page>
  </Document>
);
```

**Fallback:** If @react-pdf/renderer doesn't meet complex layout needs, use **Puppeteer** as a fallback but deploy PDF generation as a separate microservice (not in Vercel serverless).

---

## 11. Background Jobs & Queues

### 11.1 BullMQ + Redis

**What:** Redis-based queue for background job processing.

**Why we need background jobs:**

```
JOBS THAT CAN'T RUN IN API REQUEST CYCLE:

→ DAILY RENT REMINDER JOB
  Run at 10:00 AM IST daily.
  For each property → for each tenant → check if reminder needed.
  Could process 10,000+ tenants. Can't block an API request.

→ MONTHLY RENT GENERATION
  Run on 1st of every month (or per-tenant due date).
  Create rent entries for all active tenants.

→ BULK RECEIPT GENERATION
  Generate 100 PDFs → takes minutes, not milliseconds.
  Must run in background with progress tracking.

→ BULK TENANT IMPORT
  Parse CSV → validate 200 rows → create records.
  Takes time. Can't block the upload API response.

→ SEND NOTIFICATIONS
  Email/SMS sending should be queued, not inline.
  If MSG91 is slow, it shouldn't slow down your API.

→ REPORT GENERATION
  Complex queries for monthly/annual reports.
  Run async, notify when ready.

→ FILE PROCESSING
  Image resizing, thumbnail generation.
  PDF compilation for bulk operations.
```

**BullMQ Setup:**

```typescript
// Queue definitions

QUEUES:
├── reminder-queue      → handles all reminder sending
├── notification-queue  → handles email, SMS, WhatsApp sending
├── receipt-queue       → handles PDF receipt generation
├── import-queue        → handles CSV tenant import processing
├── report-queue        → handles report generation
└── cleanup-queue       → handles data cleanup, temp file deletion

SCHEDULED JOBS (using BullMQ repeatable jobs OR node-cron):
├── daily-reminder-job     → runs at 10:00 AM IST daily
├── rent-generation-job    → runs at 12:01 AM on 1st of each month
├── overdue-check-job      → runs at midnight daily
├── annual-summary-job     → runs on April 1st each year
└── subscription-check-job → runs daily (check expiring subs)
```

**Alternative for MVP (simpler):**

```
IF you deploy on Vercel (serverless):
  → BullMQ doesn't work well with serverless (needs persistent worker)
  → ALTERNATIVE: Vercel Cron Jobs + Inngest / Trigger.dev
  → OR: Simple cron endpoint hit by external cron service
    (cron-job.org — free)

  For MVP:
  → Use Vercel Cron for scheduled jobs (reminder, rent generation)
  → Process small background tasks inline (receipt generation)
  → Queue heavy tasks only when scale demands it

  This is FINE for the first 500 properties.
  Add BullMQ when you need real queue processing.
```

---

## 12. Caching

### 12.1 Caching Strategy

```
WHAT TO CACHE (Redis):

  → Dashboard data (per property):
    Key: dashboard:{property_id}
    TTL: 5 minutes
    Invalidate on: payment recorded, tenant added/removed,
                   room status change

  → Property list (per owner):
    Key: properties:{owner_id}
    TTL: 10 minutes
    Invalidate on: property added/edited/deleted

  → Room list with occupancy (per property):
    Key: rooms:{property_id}
    TTL: 5 minutes
    Invalidate on: tenant added/removed/transferred

  → Tenant list (per property):
    Key: tenants:{property_id}:page:{n}
    TTL: 5 minutes
    Invalidate on: tenant added/edited/removed

  → Rent status for month (per property):
    Key: rent_status:{property_id}:{year}:{month}
    TTL: 5 minutes
    Invalidate on: payment recorded

  → Subscription plan details (per owner):
    Key: plan:{owner_id}
    TTL: 1 hour
    Invalidate on: plan change

WHAT NOT TO CACHE:
  → Individual tenant profiles (low hit rate, changes often)
  → Payment recording (must always write to DB)
  → Auth endpoints (security-sensitive)
  → File uploads
  → Any write operation

CACHE INVALIDATION STRATEGY:
  → Use cache-aside pattern:
    1. Check cache → if found, return cached data
    2. If not found → query DB → store in cache → return
  → On ANY write operation that affects cached data:
    → Delete the relevant cache key(s)
    → Next read will repopulate from DB
  → NEVER update cache inline (too error-prone)
  → When in doubt, invalidate (stale data is worse than a cache miss)
```

---

## 13. Search

### 13.1 PostgreSQL Full-Text Search (MVP)

```
FOR MVP — PostgreSQL built-in search is sufficient.

  → Search tenants by name or phone
  → Search rooms by number
  → Search maintenance requests by description

  Implementation:
  → Add GIN index on searchable columns
  → Use PostgreSQL to_tsvector / to_tsquery
  → OR simply use ILIKE for small datasets:
    WHERE name ILIKE '%rahul%' OR phone ILIKE '%9876%'

  This works perfectly for up to 10,000+ tenants.
  No need for Elasticsearch, Algolia, or Meilisearch.

  IF in the future search needs become complex
  (vacancy listing search with location, price range,
  amenities filtering):
  → Consider Meilisearch (open-source, lightweight, fast)
  → OR Algolia (hosted, excellent but paid)
  → But NOT for MVP. Not for Phase 2. Maybe Phase 3.
```

---

## 14. Hosting & Deployment

### 14.1 Recommended Setup (Cost-Optimized)

```
┌──────────────────────────────────────────────────────────┐
│ TIER 1: FREE / MVP ($0-10/month)                         │
│                                                          │
│ Frontend + API:  Vercel (free tier — hobby)               │
│ Database:        Supabase free tier (PostgreSQL)          │
│ Redis:           Upstash free tier                        │
│ File Storage:    Cloudflare R2 free tier                  │
│ Email:           Resend free tier (100/day)               │
│ SMS:             MSG91 (pay-per-use, ~₹0.20/SMS)         │
│ Monitoring:      Sentry free tier                        │
│ Domain:          ~₹800/year (.com or .in)                │
│ SSL:             Free (Vercel auto-provision)             │
│                                                          │
│ TOTAL: ~₹200-500/month (only SMS costs)                  │
│ Supports: 0-100 properties, 0-500 tenants                │
├──────────────────────────────────────────────────────────┤
│ TIER 2: GROWTH ($30-80/month)                            │
│                                                          │
│ Frontend + API:  Vercel Pro ($20/month)                   │
│ Database:        Supabase Pro ($25/month)                 │
│                  OR Neon paid ($19/month)                 │
│ Redis:           Upstash Pro ($10/month)                  │
│ File Storage:    Cloudflare R2 (still mostly free)        │
│ Email:           Resend ($20/month for 50K emails)        │
│ SMS:             MSG91 (~₹2,000-5,000/month)             │
│ Monitoring:      Sentry free + Better Stack ($0-25/mo)   │
│                                                          │
│ TOTAL: ₹5,000-8,000/month (~$60-100)                     │
│ Supports: 100-1,000 properties, 500-5,000 tenants        │
├──────────────────────────────────────────────────────────┤
│ TIER 3: SCALE ($200-500/month)                           │
│                                                          │
│ Frontend:        Vercel Pro/Enterprise                    │
│ Backend:         Railway or AWS (separate if needed)      │
│ Database:        AWS RDS or Supabase Team                 │
│ Redis:           AWS ElastiCache or Upstash Enterprise    │
│ File Storage:    Cloudflare R2 or AWS S3                  │
│ Email:           AWS SES ($0.10/1000 emails)              │
│ SMS:             MSG91 enterprise pricing                 │
│ WhatsApp:        Interakt/Wati                           │
│ CDN:             Cloudflare                              │
│ Monitoring:      Full observability stack                │
│                                                          │
│ TOTAL: ₹15,000-40,000/month (~$200-500)                  │
│ Supports: 1,000-10,000 properties, 5,000-50,000 tenants  │
└──────────────────────────────────────────────────────────┘
```

### 14.2 Domain & DNS

```
DOMAIN OPTIONS:
  → tenantease.com (check availability)
  → tenantease.in
  → trytenantease.com
  → gettenantease.com
  → usetenantease.com

DNS: Cloudflare (free)
  → DNS management
  → DDoS protection
  → Edge caching
  → SSL

SUBDOMAINS:
  → tenantease.com           → Landing page / marketing
  → app.tenantease.com       → Owner dashboard
  → portal.tenantease.com    → Tenant portal
  → api.tenantease.com       → API (if separate backend)
  → admin.tenantease.com     → Internal admin panel
  → status.tenantease.com    → Status page

  OR (simpler — single domain):
  → tenantease.com           → Landing page
  → tenantease.com/dashboard → Owner dashboard
  → tenantease.com/portal    → Tenant portal
  → tenantease.com/api/*     → API routes
  → tenantease.com/admin     → Admin panel

  RECOMMENDED: Single domain (simpler SSL, simpler deployment)
```

---

## 15. CI/CD Pipeline

### 15.1 GitHub Actions + Vercel

```yaml
# Simplified CI/CD pipeline

WORKFLOW: On every push to main branch

STEP 1: LINT & TYPE CHECK
  → Run ESLint (catch code quality issues)
  → Run TypeScript compiler (catch type errors)
  → If either fails → block deployment

STEP 2: RUN TESTS
  → Run unit tests (Vitest)
  → Run integration tests (API route tests)
  → If any test fails → block deployment

STEP 3: BUILD
  → Run `next build`
  → Ensure build succeeds
  → Check bundle size (alert if > threshold)

STEP 4: DEPLOY
  → Vercel auto-deploys from GitHub
  → Preview deployment for PR branches
  → Production deployment for main branch
  → Run database migrations (prisma migrate deploy)

STEP 5: POST-DEPLOY
  → Run smoke tests against deployed URL
  → Notify on Slack/Discord (success/failure)
  → Sentry release tracking (link errors to deployments)
```

```
BRANCH STRATEGY:
  main          → production (auto-deploy)
  develop       → staging (preview deploys)
  feature/*     → feature branches (preview deploys)

  Flow: feature/add-tenant → PR to develop → test →
        PR to main → production deploy

  FOR SOLO DEV (simpler):
  main          → production
  feature/*     → PR to main → deploy

  Don't over-engineer branching. You're one person.
```

---

## 16. Monitoring & Observability

### 16.1 Error Tracking — Sentry

```
→ Sentry captures every error in production
→ Stack traces with source maps (TypeScript → original code)
→ User context: which owner/tenant encountered the error
→ Breadcrumbs: what happened before the error
→ Performance monitoring: slow API routes, slow page loads
→ Release tracking: which deployment introduced the bug

FREE TIER:
  → 5,000 errors/month
  → 10,000 performance transactions/month
  → Sufficient for early stage

CRITICAL ALERTS:
  → Payment processing errors → immediate alert
  → Auth errors (high rate) → immediate alert
  → Database connection errors → immediate alert
  → SMS sending failures → daily summary
```

### 16.2 Uptime Monitoring — UptimeRobot

```
→ Monitor key endpoints every 5 minutes:
  • https://tenantease.com (landing page)
  • https://tenantease.com/api/health (API health check)
  • https://tenantease.com/portal (tenant portal)

→ Alert via email + SMS when down
→ Public status page (optional)
→ Free tier: 50 monitors, 5-min interval
```

### 16.3 Logging — Better Stack / Axiom

```
→ Structured JSON logging for all API requests:
  {
    timestamp: "2025-06-05T10:30:00Z",
    level: "info",
    method: "POST",
    path: "/api/payments",
    userId: "user-123",
    propertyId: "prop-456",
    duration: 245,
    status: 201,
    message: "Payment recorded"
  }

→ Error logs with full context
→ Search & filter logs by user, property, endpoint
→ Retention: 30 days (free tier)
→ Dashboards for: error rate, response times, top endpoints

FREE TIERS:
  Better Stack (Logtail): 1GB/month
  Axiom: 500GB/month (very generous)

  RECOMMENDED: Axiom (generous free tier)
```

---

## 17. Analytics & Tracking

### 17.1 Product Analytics — PostHog

```
→ Track user behavior:
  • Which features are used most
  • Where users drop off in onboarding
  • Funnel: sign up → add property → add tenant → record payment
  • Feature adoption: % of owners using receipts, reminders, etc.
  • Session recordings: watch how users navigate (find UX issues)

→ Track business metrics:
  • Daily/weekly/monthly active owners
  • Activation rate (% who add first tenant within 7 days)
  • Retention cohorts
  • Feature flag management (A/B testing)

→ PRIVACY:
  • Self-hostable (if needed for compliance)
  • Can disable session recording for sensitive pages
  • Don't track on payment pages

FREE TIER:
  → 1 million events/month
  → Session recordings: 5,000/month
  → More than enough for early stage

ALTERNATIVE: Plausible (simpler, privacy-focused, but less features)
```

### 17.2 Web Analytics — Plausible / Vercel Analytics

```
→ For marketing pages (landing page, listing pages):
  • Page views, unique visitors
  • Referral sources (where traffic comes from)
  • Country/city of visitors
  • Device breakdown (mobile vs desktop)
  • Top pages (which listings get most traffic)

→ Plausible: privacy-friendly, lightweight (~1KB script)
  Free tier: 10K pageviews/month

→ Vercel Analytics: built-in, zero-config if on Vercel
  Free with Vercel hobby plan
```

---

## 18. Email Infrastructure

### 18.1 Resend + React Email

```
SETUP:
  → Resend account (API key)
  → Custom domain: mail.tenantease.com
  → DNS records: SPF, DKIM, DMARC (for deliverability)
  → React Email for templates (same JSX you know)

EMAIL TEMPLATES (built with React Email):

  → OTP Email
  → Welcome Email
  → Rent Reminder Email
  → Payment Confirmation Email
  → Receipt Email (with PDF attachment)
  → Maintenance Status Update Email
  → Announcement Notification Email
  → Subscription Invoice Email
  → Annual Summary Notification Email
  → Password Change / Phone Change Email

DELIVERABILITY CHECKLIST:
  ☐ SPF record configured
  ☐ DKIM record configured
  ☐ DMARC record configured
  ☐ Custom "from" address: noreply@tenantease.com
  ☐ Reply-to: support@tenantease.com
  ☐ Unsubscribe link in every email (CAN-SPAM compliance)
  ☐ Test with mail-tester.com (score 9+/10)
  ☐ Don't use URL shorteners in emails (spam trigger)
  ☐ Include physical address in footer (legal requirement)
```

---

## 19. Security Tools

### 19.1 Security Checklist & Tools

```
IMPLEMENTED VIA CODE:
  ✅ Helmet.js (security headers) → or Next.js security headers config
  ✅ CORS configuration (restrict to your domains)
  ✅ Rate limiting (Redis-based)
  ✅ Input validation (Zod — every endpoint)
  ✅ SQL injection prevention (Prisma ORM — parameterized queries)
  ✅ XSS prevention (React auto-escapes, CSP headers)
  ✅ CSRF protection (SameSite cookies, CSRF tokens for forms)
  ✅ File upload validation (type whitelist, size limit, malware check)
  ✅ Sensitive data encryption at rest (Aadhaar, PAN — encrypt in DB)
  ✅ Password-less auth (OTP — no passwords to breach)
  ✅ JWT with short expiry + refresh tokens

EXTERNAL TOOLS:
  → Cloudflare (DDoS protection, WAF — free tier)
  → Snyk or npm audit (dependency vulnerability scanning)
  → GitHub Dependabot (auto PR for vulnerable dependencies)

ENCRYPTION:
  → In transit: TLS 1.3 (automatic with Vercel/Cloudflare)
  → At rest (database):
    • Aadhaar numbers: AES-256 encrypted before storing
    • PAN numbers: AES-256 encrypted
    • KYC document URLs: not directly guessable (signed URLs)
    • Regular data (names, amounts): not encrypted (performance)
  → Encryption key: stored in environment variable, NOT in code

COMPLIANCE:
  → DPDPA 2023 (Digital Personal Data Protection Act — India):
    • Consent before collecting personal data
    • Purpose limitation (collect only what's needed)
    • Right to access (tenant can see their data)
    • Right to deletion (tenant can request deletion)
    • Data localization (store Indian data in India —
      use Mumbai/India regions for hosting)
  → IT Act 2000:
    • Reasonable security practices
    • Data breach notification
```

---

## 20. Development Tools

### 20.1 Local Development Setup

```
EDITOR:
  → VS Code with extensions:
    • ESLint
    • Prettier
    • Tailwind CSS IntelliSense
    • Prisma
    • TypeScript Importer
    • GitLens
    • Error Lens
    • Thunder Client (API testing) or use Postman

PACKAGE MANAGER:
  → pnpm (recommended — faster, disk efficient)
  → OR npm (if you prefer simplicity)
  → NOT yarn (pnpm is better in every way now)

LOCAL DEVELOPMENT:
  → next dev (frontend + API — hot reload)
  → Docker Compose for local PostgreSQL + Redis
    OR
  → Use cloud free tiers directly (Supabase + Upstash)
    with .env.local pointing to dev instances

CODE QUALITY:
  → ESLint (linting — catch code issues)
  → Prettier (formatting — consistent code style)
  → Husky (pre-commit hooks — run lint before commit)
  → lint-staged (only lint changed files — faster)
  → TypeScript strict mode (catch more bugs)

TESTING:
  → Vitest (unit tests — fast, Vite-native)
  → Testing Library (component tests)
  → Playwright (E2E tests — Phase 2, not MVP)
  → Prisma: use test database for integration tests

API TESTING:
  → Thunder Client (VS Code extension)
  → OR Postman
  → OR Bruno (open-source, git-friendly)
  → API collection shared in repo for team use

DATABASE MANAGEMENT:
  → Prisma Studio (visual DB browser — built into Prisma)
  → pgAdmin or DBeaver (for complex queries)
  → Prisma Migrate (schema migrations)
```

---

## 21. Third-Party Services Summary

```
┌─────────────────────┬──────────────────────┬───────────────┬─────────────┐
│ SERVICE             │ PROVIDER             │ FREE TIER     │ PAID STARTS │
├─────────────────────┼──────────────────────┼───────────────┼─────────────┤
│ Hosting (Frontend)  │ Vercel               │ ✅ Hobby plan  │ $20/mo      │
│ Database            │ Supabase / Neon      │ ✅ 500MB       │ $25/mo      │
│ Redis               │ Upstash              │ ✅ 10K cmd/day │ $10/mo      │
│ File Storage        │ Cloudflare R2        │ ✅ 10GB        │ $0.015/GB   │
│ Email               │ Resend               │ ✅ 100/day     │ $20/mo      │
│ SMS (India)         │ MSG91                │ ❌ Pay per use │ ~₹0.20/SMS  │
│ Payment Gateway     │ Razorpay             │ ❌ 2% per txn  │ 2% per txn  │
│ WhatsApp API        │ Interakt/Wati        │ ❌ Pay per msg │ ₹0.50-1/msg │
│ Error Tracking      │ Sentry               │ ✅ 5K errors   │ $26/mo      │
│ Logging             │ Axiom                │ ✅ 500GB/mo    │ $25/mo      │
│ Analytics           │ PostHog              │ ✅ 1M events   │ $0+         │
│ Web Analytics       │ Plausible/Vercel     │ ✅ 10K views   │ $9/mo       │
│ Uptime Monitoring   │ UptimeRobot          │ ✅ 50 monitors │ $7/mo       │
│ DNS + CDN + DDoS    │ Cloudflare           │ ✅ Full        │ $20/mo      │
│ CI/CD               │ GitHub Actions       │ ✅ 2000 min/mo │ $4/mo       │
│ Domain              │ Cloudflare/Namecheap │ ❌ ~₹800/year  │ ~₹800/year  │
└─────────────────────┴──────────────────────┴───────────────┴─────────────┘

MVP MONTHLY COST: ₹500-1,500 (mostly SMS costs)
GROWTH MONTHLY COST: ₹5,000-10,000
SCALE MONTHLY COST: ₹15,000-40,000
```

---

## 22. Cost Estimation

### 22.1 Monthly Cost Breakdown by Stage

```
═══════════════════════════════════════════════
STAGE 1: MVP & BETA (Month 1-3)
Properties: 0-30 | Tenants: 0-200
Revenue: ₹0 (free plan only)
═══════════════════════════════════════════════

  Vercel (hobby):                    ₹0
  Supabase (free):                   ₹0
  Upstash (free):                    ₹0
  Cloudflare R2 (free):              ₹0
  Resend (free — 100 emails/day):    ₹0
  Sentry (free):                     ₹0
  Axiom (free):                      ₹0
  PostHog (free):                    ₹0
  Domain (tenantease.com):           ₹70/month (~₹800/year)
  SMS (MSG91):
    OTP: ~50 logins/day × ₹0.20     ₹300/month
    Reminders: ~200 tenants ×
    3 msgs/month × ₹0.20            ₹120/month
  ─────────────────────────────────
  TOTAL:                             ~₹500/month

═══════════════════════════════════════════════
STAGE 2: EARLY GROWTH (Month 4-6)
Properties: 30-200 | Tenants: 200-2,000
Revenue: ₹10,000-50,000/month (first paying customers)
═══════════════════════════════════════════════

  Vercel (Pro — need more bandwidth):    ₹1,600/month
  Supabase (Pro — need more storage):    ₹2,000/month
  Upstash (Pro):                         ₹800/month
  Cloudflare R2:                         ₹0 (still in free tier)
  Resend (paid — 50K emails):            ₹1,600/month
  SMS (MSG91):
    OTP + Reminders: ~5,000 msgs/month   ₹1,000/month
  Sentry (free still):                   ₹0
  Axiom (free still):                    ₹0
  Domain:                                ₹70/month
  ─────────────────────────────────
  TOTAL:                                 ~₹7,000/month

  REVENUE - COSTS = ₹3,000-43,000/month profit 💰

═══════════════════════════════════════════════
STAGE 3: GROWTH (Month 7-12)
Properties: 200-1,000 | Tenants: 2,000-10,000
Revenue: ₹50,000-3,00,000/month
═══════════════════════════════════════════════

  Infrastructure:                        ₹15,000-25,000/month
  SMS + WhatsApp:                        ₹5,000-15,000/month
  Total:                                 ₹20,000-40,000/month

  REVENUE - COSTS = solid profit margin 💰💰
```

---

## 23. Stack Alternatives Considered

### 23.1 Alternatives and Why They Were Rejected

```
┌──────────────────┬──────────────────────┬─────────────────────────┐
│ CATEGORY         │ CONSIDERED           │ WHY REJECTED            │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ Frontend         │ Angular              │ Steeper learning curve, │
│ Framework        │                      │ more boilerplate,       │
│                  │                      │ smaller ecosystem for   │
│                  │                      │ indie SaaS              │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Vue / Nuxt           │ Great framework but     │
│                  │                      │ React ecosystem is      │
│                  │                      │ larger. More component  │
│                  │                      │ libraries, more hires.  │
│                  │                      │ Use if you know Vue     │
│                  │                      │ better than React.      │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ SvelteKit            │ Amazing DX but smaller  │
│                  │                      │ ecosystem. Fewer ready- │
│                  │                      │ made components. Harder │
│                  │                      │ to find help.           │
│                  │                      │                         │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ Backend          │ Django (Python)      │ Great framework but     │
│                  │                      │ different language from  │
│                  │                      │ frontend. Two runtimes. │
│                  │                      │ TypeScript everywhere   │
│                  │                      │ is simpler for solo dev.│
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Go / Gin             │ Excellent performance   │
│                  │                      │ but separate backend.   │
│                  │                      │ No shared types with    │
│                  │                      │ React. Slower dev speed │
│                  │                      │ for CRUD-heavy apps.    │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Spring Boot (Java)   │ Enterprise overkill.    │
│                  │                      │ Slow dev speed for solo │
│                  │                      │ developer. Too verbose. │
│                  │                      │                         │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ Database         │ MongoDB              │ Not ideal for relational│
│                  │                      │ data. Rent, payments,   │
│                  │                      │ tenants — all relational│
│                  │                      │ No transactions (by     │
│                  │                      │ default). No JOINs.     │
│                  │                      │ "Use Mongo for          │
│                  │                      │ everything" is bad      │
│                  │                      │ advice for this product.│
│                  ├──────────────────────┼─────────────────────────┤
│                  │ MySQL                │ Fine choice. PostgreSQL │
│                  │                      │ is simply better in     │
│                  │                      │ every way: JSONB, array │
│                  │                      │ types, FTS, better      │
│                  │                      │ extensions.             │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ PlanetScale (MySQL)  │ Great serverless MySQL  │
│                  │                      │ but removed free tier.  │
│                  │                      │ Prisma works with it    │
│                  │                      │ but PostgreSQL is better│
│                  │                      │ suited for this data.   │
│                  │                      │                         │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ ORM              │ Drizzle              │ Valid alternative.      │
│                  │                      │ More SQL-like. Lighter. │
│                  │                      │ But Prisma has better   │
│                  │                      │ docs, larger community, │
│                  │                      │ and Prisma Studio.      │
│                  │                      │ USE DRIZZLE IF:         │
│                  │                      │ you want more control   │
│                  │                      │ over SQL queries.       │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ TypeORM              │ Buggy. Inconsistent.    │
│                  │                      │ Poor TypeScript support │
│                  │                      │ despite the name.       │
│                  │                      │ Not recommended.        │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Raw SQL (pg driver)  │ Maximum control but     │
│                  │                      │ no type safety, no      │
│                  │                      │ migrations, error-prone.│
│                  │                      │ Only if you're a SQL    │
│                  │                      │ expert and hate ORMs.   │
│                  │                      │                         │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ UI Library       │ Material UI (MUI)    │ Heavy. Complex theming. │
│                  │                      │ "Everything looks like  │
│                  │                      │ Google." Hard to        │
│                  │                      │ customize deeply.       │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Ant Design           │ Enterprise feel. Very   │
│                  │                      │ opinionated. Large      │
│                  │                      │ bundle size. Chinese    │
│                  │                      │ documentation first.    │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Chakra UI            │ Good but adds runtime   │
│                  │                      │ CSS-in-JS. Heavier than │
│                  │                      │ Tailwind. shadcn/ui is  │
│                  │                      │ the spiritual successor.│
│                  │                      │                         │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ Auth             │ NextAuth / Auth.js   │ Great for social login. │
│                  │                      │ Overkill for phone OTP. │
│                  │                      │ Fighting the library's  │
│                  │                      │ design for our use case.│
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Clerk                │ Excellent auth service. │
│                  │                      │ But $25/mo + per-MAU    │
│                  │                      │ pricing. Expensive at   │
│                  │                      │ scale. Less control.    │
│                  │                      │ Good alternative if you │
│                  │                      │ want to skip building   │
│                  │                      │ auth entirely.          │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Supabase Auth        │ Good if using Supabase  │
│                  │                      │ for DB. Has phone OTP.  │
│                  │                      │ VIABLE ALTERNATIVE.     │
│                  │                      │ Consider this if you    │
│                  │                      │ want to avoid custom    │
│                  │                      │ auth entirely.          │
│                  │                      │                         │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ Hosting          │ AWS (full)           │ Complex. Expensive for  │
│                  │                      │ solo dev. EC2, RDS,     │
│                  │                      │ S3, IAM — too many      │
│                  │                      │ moving parts.           │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Railway              │ VIABLE ALTERNATIVE.     │
│                  │                      │ Simple. Good DX.        │
│                  │                      │ Use if you want         │
│                  │                      │ everything in one place │
│                  │                      │ (app + DB + Redis).     │
│                  │                      │ $5/mo starting.         │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Render               │ VIABLE ALTERNATIVE.     │
│                  │                      │ Similar to Railway.     │
│                  │                      │ Free tier available.    │
│                  │                      │ Slightly slower deploys.│
│                  ├──────────────────────┼─────────────────────────┤
│                  │ DigitalOcean         │ Good for VPS approach.  │
│                  │                      │ More ops work than      │
│                  │                      │ Vercel/Railway.         │
│                  │                      │ Use if you want full    │
│                  │                      │ server control.         │
│                  │                      │                         │
├──────────────────┼──────────────────────┼─────────────────────────┤
│                  │                      │                         │
│ Payment          │ Stripe               │ Best globally but       │
│                  │                      │ limited UPI support.    │
│                  │                      │ Higher fees in India.   │
│                  │                      │ Razorpay is better for  │
│                  │                      │ India-first product.    │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ Cashfree             │ VIABLE ALTERNATIVE.     │
│                  │                      │ Good Indian payment     │
│                  │                      │ gateway. Lower fees     │
│                  │                      │ than Razorpay sometimes.│
│                  │                      │ Less popular → less     │
│                  │                      │ user trust.             │
│                  ├──────────────────────┼─────────────────────────┤
│                  │ PayU                 │ Older. Less developer-  │
│                  │                      │ friendly. Razorpay has  │
│                  │                      │ better DX.             │
│                  │                      │                         │
└──────────────────┴──────────────────────┴─────────────────────────┘
```

---

## 24. Scaling Strategy

### 24.1 Roadmap to 10k+ Properties

| Scale                         | Strategy                 | Architecture Focus                                             |
| :---------------------------- | :----------------------- | :------------------------------------------------------------- |
| **0 - 100 Properties**        | Free Tier Monolith       | Vercel Serverless, Supabase Free, Upstash Free. Focus on PMF.  |
| **100 - 500 Properties**      | Early Growth             | Paid DB tier, Redis Caching, BullMQ for Cron/Reminders.        |
| **500 - 2,000 Properties**    | Performance Optimization | Connection pooling (PgBouncer), Read Replicas, Cloudflare CDN. |
| **2,000 - 10,000 Properties** | Enterprise Scale         | RDS Managed DB, Dedicated workers, Microservices for PDF/SMS.  |
| **10,000+ Properties**        | Exit/Enterprise          | Hire SRE/DevOps team. Actual bottleneck-driven scaling.        |

---

## 25. Technical Debt Prevention

### 25.1 Rules to Follow From Day 1

```
1. TYPESCRIPT STRICT MODE — ALWAYS
   tsconfig.json: "strict": true
   No `any` types. Ever. Except in emergencies
   (and add a // TODO: fix type comment).

2. LINT + FORMAT ON EVERY COMMIT
   Husky + lint-staged = automatic.
   No discussion about code style. Prettier decides.

3. SCHEMA FIRST
   Define Prisma schema before writing code.
   Define Zod schemas before building forms.
   Schema IS the documentation.

4. API VERSIONING FROM DAY 1
   /api/v1/tenants (not /api/tenants)
   When you need breaking changes → /api/v2/tenants
   Old clients keep working.

5. ENVIRONMENT VARIABLES FOR EVERYTHING
   Database URL, API keys, feature flags — all in .env
   No hardcoded secrets. No hardcoded URLs.
   Use @t3-oss/env-nextjs for type-safe env validation.

6. ERROR HANDLING PATTERN
   Every service function: try/catch.
   Custom error classes (NotFoundError, ValidationError,
   UnauthorizedError).
   Global error handler in API middleware.
   Consistent error response format.

7. LOGGING EVERY IMPORTANT ACTION
   Payment recorded → log
   Tenant added → log
   Error occurred → log with context
   Don't log sensitive data (Aadhaar, PAN, OTP)

8. DATABASE MIGRATIONS, NEVER MANUAL CHANGES
   All DB changes through Prisma Migrate.
   Never ALTER TABLE directly in production.
   Migration history is your database changelog.

9. FEATURE FLAGS FOR BIG CHANGES
   Building online payments? Ship behind a flag.
   Enable for 5 beta users first. Then 50. Then everyone.
   Catch bugs before they affect all users.
   Use PostHog feature flags (free tier includes this).

10. WEEKLY DEPENDENCY UPDATES
    `pnpm outdated` → see what's outdated
    `pnpm update` → update non-breaking
    Review Dependabot PRs for security patches.
    Don't let dependencies rot for 6 months.
```

---

## 25. Technical Summary Card

| Component    | Standard                 |
| :----------- | :----------------------- |
| **Language** | TypeScript (Full-stack)  |
| **Frontend** | Next.js 14 (App Router)  |
| **Styling**  | Tailwind CSS + shadcn/ui |
| **ORM**      | Prisma                   |
| **Database** | PostgreSQL               |
| **Cache**    | Redis                    |
| **Auth**     | Custom Phone OTP         |
| **Hosting**  | Vercel                   |

---

**End of Technical Specifications (DOC4.MD)**

---

## End of Document 4

**Next Document:** DOC 5 — System Architecture Document
