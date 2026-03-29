# 📄 DOCUMENT 6: DATABASE SCHEMA DESIGN

| Field | Value |
|---|---|
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Author** | [Your Name] |
| **Last Updated** | [Date] |
| **Status** | Draft |
| **Parent Docs** | DOC 1 — Vision, DOC 2 — PRD, DOC 3 — Flows, DOC 4 — Tech Stack, DOC 5 — Architecture |

---

## 📑 Table of Contents

1. [Schema Design Philosophy](#1-schema-design-philosophy)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Enum Definitions](#3-enum-definitions)
4. [Complete Prisma Schema](#4-complete-prisma-schema)
5. [Table-by-Table Documentation](#5-table-by-table-documentation)
6. [Relationships Explained](#6-relationships-explained)
7. [Indexing Strategy](#7-indexing-strategy)
8. [Data Integrity Rules](#8-data-integrity-rules)
9. [Soft Delete Implementation](#9-soft-delete-implementation)
10. [Audit Logging Design](#10-audit-logging-design)
11. [Money Handling](#11-money-handling)
12. [JSONB Column Schemas](#12-jsonb-column-schemas)
13. [Seed Data](#13-seed-data)
14. [Migration Strategy](#14-migration-strategy)
15. [Query Patterns](#15-query-patterns)
16. [Performance Considerations](#16-performance-considerations)
17. [Data Retention Policy](#17-data-retention-policy)
18. [Schema Evolution Plan](#18-schema-evolution-plan)

---

## 1. Schema Design Philosophy

### Guiding Rules

**Rule 1: Schema mirrors business domain exactly.**

Every table maps to a real-world concept the PG owner understands. Property, Room, Tenant, Rent, Payment, Receipt. No abstract "Resource" or "Entity" tables. If a PG owner can't point to it in their notebook, it doesn't get its own table.

**Rule 2: Money is always an integer in paisa.**

₹8,000.50 is stored as `800050`. Every column that holds money is an `Int`, never a `Float` or `Decimal`. All math happens in paisa. Conversion to rupees happens only at the display layer.

**Rule 3: Every row knows who it belongs to.**

Every major table has a `propertyId` or a path back to one. Every query in the application is scoped by property, and every property is scoped by owner. Data isolation is enforced by schema design, not just application logic.

**Rule 4: Soft delete everything important.**

Tenants vacate. Properties close. But financial records must persist. Every table with business-critical data has a `deletedAt` column. Hard deletes happen only via cleanup jobs after 90 days.

**Rule 5: Timestamps are always UTC.**

`createdAt` and `updatedAt` on every table. Stored in UTC. Converted to IST only in the frontend.

**Rule 6: UUIDs for all primary keys.**

No auto-increment integers. UUIDs are not guessable (security), globally unique (distributed-safe), and can be generated client-side before sending to server.

**Rule 7: Design for Phase 3 from Day 1.**

Multi-property support, staff roles, utility billing — the schema supports all of these even if the MVP doesn't use them. Adding Phase 2 features should never require restructuring existing tables.

---

## 2. Entity Relationship Diagram

### Full ER Diagram (Text)

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ┌──────────┐                                                        │
│  │   USER   │                                                        │
│  │          │──┐                                                     │
│  │ id       │  │                                                     │
│  │ phone    │  │ 1:N                                                 │
│  │ name     │  │                                                     │
│  │ role     │  │     ┌──────────────┐                                │
│  └──────────┘  ├────>│  PROPERTY    │                                │
│                │     │              │──┐                              │
│                │     │ id           │  │ 1:N                         │
│                │     │ ownerId (FK) │  │     ┌──────────┐            │
│                │     │ name         │  ├────>│   ROOM   │            │
│                │     │ type         │  │     │          │──┐         │
│                │     │ address      │  │     │ id       │  │ 1:N     │
│                │     └──────────────┘  │     │ propId   │  │         │
│                │           │           │     │ number   │  │         │
│                │           │ 1:N       │     │ type     │  │         │
│                │           │           │     │ rent     │  │         │
│                │           ▼           │     └──────────┘  │         │
│                │     ┌──────────────┐  │                   │         │
│                │     │ ANNOUNCEMENT │  │                   │         │
│                │     └──────────────┘  │                   │         │
│                │                       │                   │         │
│                │ 1:N                   │                   ▼         │
│                │     ┌──────────────┐  │           ┌──────────┐      │
│                ├────>│    STAFF     │  │           │  TENANT  │      │
│                │     │  ASSIGNMENT  │  │           │          │──┐   │
│                │     └──────────────┘  │           │ id       │  │   │
│                │                       │           │ userId   │  │   │
│                │ 1:1                   │           │ roomId   │  │   │
│                │     ┌──────────────┐  │           │ propId   │  │   │
│                └────>│ SUBSCRIPTION │  │           │ rent     │  │   │
│                      └──────────────┘  │           │ status   │  │   │
│                                        │           └──────────┘  │   │
│                                        │                │        │   │
│                                        │         ┌──────┼────┐   │   │
│                                        │         │      │    │   │   │
│                                        │      1:N│   1:N│ 1:N│   │   │
│                                        │         │      │    │   │   │
│                                        │         ▼      ▼    ▼   │   │
│                                        │ ┌─────────┐┌────┐┌────┐│   │
│                                        │ │  RENT   ││MAINT││DEP ││   │
│                                        │ │  ENTRY  ││REQ  ││OSIT││   │
│                                        │ └────┬────┘└────┘└────┘│   │
│                                        │      │                  │   │
│                                        │   1:N│                  │   │
│                                        │      │                  │   │
│                                        │      ▼                  │   │
│                                        │ ┌─────────┐            │   │
│                                        │ │ PAYMENT │            │   │
│                                        │ └────┬────┘            │   │
│                                        │      │                  │   │
│                                        │   1:1│                  │   │
│                                        │      ▼                  │   │
│                                        │ ┌─────────┐            │   │
│                                        │ │ RECEIPT │            │   │
│                                        │ └─────────┘            │   │
│                                        │                         │   │
│                                        │         ┌───────────┐   │   │
│                                        │         │AUDIT LOG  │   │   │
│                                        │         └───────────┘   │   │
│                                        │         ┌───────────┐   │   │
│                                        │         │NOTIFICATION│  │   │
│                                        │         └───────────┘   │   │
│                                        │                         │   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. Enum Definitions

### All Enums Used in Schema

```prisma
// ─────────────────────────────────────────────
// USER & AUTH ENUMS
// ─────────────────────────────────────────────

enum UserRole {
  OWNER           // Property owner — primary paying user
  TENANT          // Person renting — secondary free user
  STAFF           // Staff member — limited access
  ADMIN           // Internal TenantEase admin
}

// ─────────────────────────────────────────────
// PROPERTY ENUMS
// ─────────────────────────────────────────────

enum PropertyType {
  PG              // Paying Guest accommodation
  HOSTEL          // Student or working professional hostel
  APARTMENT       // Apartment / flat rental
  INDEPENDENT_HOUSE // Independent house rental
  CO_LIVING       // Co-living space
  OTHER
}

enum GenderPolicy {
  BOYS_ONLY
  GIRLS_ONLY
  CO_ED
  FAMILY
  ANY
}

// ─────────────────────────────────────────────
// ROOM ENUMS
// ─────────────────────────────────────────────

enum RoomType {
  SINGLE          // 1 person
  DOUBLE          // 2 persons sharing
  TRIPLE          // 3 persons sharing
  QUAD            // 4 persons sharing
  DORMITORY       // 5+ persons
}

enum RoomStatus {
  VACANT          // All beds empty
  PARTIALLY_OCCUPIED  // Some beds filled
  FULLY_OCCUPIED  // All beds filled
  UNDER_MAINTENANCE   // Temporarily unavailable
}

// ─────────────────────────────────────────────
// TENANT ENUMS
// ─────────────────────────────────────────────

enum TenantStatus {
  ACTIVE          // Currently living
  ON_NOTICE       // Given notice, will vacate soon
  VACATED         // Has left the property
  UPCOMING        // Move-in date is in the future
}

enum Gender {
  MALE
  FEMALE
  OTHER
}

enum Occupation {
  STUDENT
  WORKING_PROFESSIONAL
  BUSINESS
  OTHER
}

enum DepositStatus {
  PAID
  PARTIALLY_PAID
  PENDING
  REFUNDED
  PARTIALLY_REFUNDED
  FORFEITED
}

// ─────────────────────────────────────────────
// RENT & PAYMENT ENUMS
// ─────────────────────────────────────────────

enum RentStatus {
  UNPAID          // No payment received
  PARTIALLY_PAID  // Some amount received
  PAID            // Full amount received
  OVERDUE         // Past due date, unpaid
  WAIVED          // Owner waived this month's rent
}

enum PaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  CHEQUE
  ONLINE          // Through TenantEase platform (Razorpay)
  OTHER
}

enum ChargeType {
  RECURRING       // Added every month automatically
  ONE_TIME        // Added to specific month only
}

// ─────────────────────────────────────────────
// MAINTENANCE ENUMS
// ─────────────────────────────────────────────

enum MaintenanceCategory {
  PLUMBING
  ELECTRICAL
  FURNITURE
  INTERNET_WIFI
  CLEANING
  PEST_CONTROL
  AC_COOLER
  WATER_SUPPLY
  OTHER
}

enum MaintenanceUrgency {
  LOW             // Can wait a few days
  MEDIUM          // Should be fixed soon
  HIGH            // Urgent — affecting daily life
  EMERGENCY       // Safety issue — immediate attention
}

enum MaintenanceStatus {
  NEW             // Just raised
  ACKNOWLEDGED    // Owner has seen it
  IN_PROGRESS     // Work started
  RESOLVED        // Work completed
  CLOSED          // Confirmed resolved or auto-closed
  REJECTED        // Not a valid request
}

// ─────────────────────────────────────────────
// NOTIFICATION ENUMS
// ─────────────────────────────────────────────

enum NotificationType {
  RENT_REMINDER
  PAYMENT_RECEIVED
  RECEIPT_GENERATED
  MAINTENANCE_UPDATE
  ANNOUNCEMENT
  SYSTEM
  SUBSCRIPTION
}

enum NotificationChannel {
  IN_APP
  EMAIL
  SMS
  WHATSAPP
}

// ─────────────────────────────────────────────
// SUBSCRIPTION ENUMS
// ─────────────────────────────────────────────

enum PlanType {
  FREE
  STARTER
  PRO
  BUSINESS
}

enum BillingCycle {
  MONTHLY
  ANNUAL
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE       // Payment failed, in grace period
  CANCELLED      // User cancelled, active until end of period
  EXPIRED        // Period ended, no renewal
}

// ─────────────────────────────────────────────
// UTILITY BILLING ENUMS
// ─────────────────────────────────────────────

enum UtilityType {
  ELECTRICITY
  WATER
  GAS
  GENERATOR
  OTHER
}

enum BillingModel {
  INDIVIDUAL_METER    // Each room has own meter
  SHARED_EQUAL        // Total split equally among tenants
  SHARED_WEIGHTED     // Total split by room type weight
  FLAT_RATE           // Fixed amount per tenant
}

// ─────────────────────────────────────────────
// ANNOUNCEMENT ENUMS
// ─────────────────────────────────────────────

enum AnnouncementCategory {
  GENERAL
  MAINTENANCE
  RULES
  EVENT
  EMERGENCY
}

// ─────────────────────────────────────────────
// STAFF ENUMS
// ─────────────────────────────────────────────

enum StaffRole {
  MANAGER         // Operational access, no finances
  ACCOUNTANT      // Financial access, no operations
  WARDEN          // Basic view, maintenance only
}

enum StaffInviteStatus {
  PENDING         // Invitation sent, not accepted
  ACCEPTED        // Staff has registered
  REVOKED         // Owner revoked before acceptance
}

// ─────────────────────────────────────────────
// AUDIT LOG ENUMS
// ─────────────────────────────────────────────

enum AuditAction {
  CREATE
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  PAYMENT_RECORDED
  PAYMENT_EDITED
  PAYMENT_DELETED
  TENANT_VACATED
  TENANT_TRANSFERRED
  RECEIPT_GENERATED
  REMINDER_SENT
  SUBSCRIPTION_CHANGED
  STAFF_INVITED
  STAFF_REMOVED
  SETTINGS_CHANGED
}
```

---

## 4. Complete Prisma Schema

```prisma
// ═══════════════════════════════════════════════════════
// prisma/schema.prisma
// TenantEase — Complete Database Schema
// ═══════════════════════════════════════════════════════

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}


// ─────────────────────────────────────────────
// 1. USER TABLE
// ─────────────────────────────────────────────
// Central user table for all user types:
// owners, tenants, staff, admins.
// Role determines what they can do.

model User {
  id                    String      @id @default(uuid()) @db.Uuid
  phone                 String      @unique @db.VarChar(15)
  name                  String      @db.VarChar(100)
  email                 String?     @db.VarChar(255)
  avatarUrl             String?     @db.VarChar(500)
  role                  UserRole    @default(OWNER)
  isActive              Boolean     @default(true)
  lastLoginAt           DateTime?
  onboardingCompleted   Boolean     @default(false)
  onboardingState       Json?       // wizard progress
  notificationPrefs     Json?       // channel preferences
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  deletedAt             DateTime?

  // Relations
  ownedProperties       Property[]  @relation("PropertyOwner")
  tenantProfiles        Tenant[]    @relation("TenantUser")
  staffAssignments      StaffAssignment[] @relation("StaffUser")
  subscription          Subscription? @relation("UserSubscription")
  notifications         Notification[] @relation("UserNotifications")
  auditLogs             AuditLog[]  @relation("AuditUser")
  sentReminders         ReminderLog[] @relation("ReminderSender")

  @@index([phone])
  @@index([email])
  @@index([role])
  @@map("users")
}


// ─────────────────────────────────────────────
// 2. PROPERTY TABLE
// ─────────────────────────────────────────────
// A single PG, hostel, flat, or building
// managed by an owner.

model Property {
  id                    String        @id @default(uuid()) @db.Uuid
  ownerId               String        @db.Uuid
  name                  String        @db.VarChar(200)
  type                  PropertyType  @default(PG)
  addressLine1          String        @db.VarChar(300)
  addressLine2          String?       @db.VarChar(300)
  city                  String        @db.VarChar(100)
  state                 String        @db.VarChar(100)
  pinCode               String        @db.VarChar(6)
  genderPolicy          GenderPolicy  @default(ANY)
  totalFloors           Int?          @default(1)
  amenities             String[]      @default([])    // PostgreSQL array
  photos                String[]      @default([])    // URLs
  ownerPan              String?       @db.VarChar(10) // encrypted
  ownerUpiId            String?       @db.VarChar(100)
  ownerBankDetails      Json?         // { bankName, accountNo, ifsc }

  // Rent Configuration
  defaultRentDueDay     Int           @default(1)     // 1-28
  gracePeriodDays       Int           @default(5)
  lateFeeType           String?       @db.VarChar(20) // "flat" | "per_day" | "percentage"
  lateFeeAmount         Int?          @default(0)     // in paisa

  // Reminder Configuration
  reminderConfig        Json?         // full reminder settings object

  // Utility Billing Configuration
  electricityModel      BillingModel? @default(FLAT_RATE)
  electricityRate       Int?          @default(800)   // paisa per unit
  waterModel            BillingModel? @default(FLAT_RATE)
  waterRate             Int?          @default(0)

  isActive              Boolean       @default(true)
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
  deletedAt             DateTime?

  // Relations
  owner                 User          @relation("PropertyOwner", fields: [ownerId], references: [id])
  rooms                 Room[]
  tenants               Tenant[]
  rentEntries           RentEntry[]
  maintenanceRequests   MaintenanceRequest[]
  announcements         Announcement[]
  staffAssignments      StaffAssignment[]
  utilityReadings       UtilityReading[]
  enquiries             Enquiry[]
  auditLogs             AuditLog[]    @relation("AuditProperty")

  @@index([ownerId])
  @@index([city])
  @@index([type])
  @@index([ownerId, deletedAt])
  @@map("properties")
}


// ─────────────────────────────────────────────
// 3. ROOM TABLE
// ─────────────────────────────────────────────
// A room within a property.
// Contains one or more beds.

model Room {
  id                    String      @id @default(uuid()) @db.Uuid
  propertyId            String      @db.Uuid
  roomNumber            String      @db.VarChar(20)   // "101", "A-3", etc.
  floor                 String?     @db.VarChar(20)   // "Ground", "1st", "2nd"
  type                  RoomType    @default(SINGLE)
  maxOccupancy          Int         @default(1)
  currentOccupancy      Int         @default(0)
  status                RoomStatus  @default(VACANT)
  rentPerBed            Int                           // paisa
  depositAmount         Int         @default(0)       // paisa
  amenities             String[]    @default([])
  photos                String[]    @default([])
  notes                 String?     @db.Text
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  deletedAt             DateTime?

  // Relations
  property              Property    @relation(fields: [propertyId], references: [id])
  tenants               Tenant[]
  utilityReadings       UtilityReading[]

  @@unique([propertyId, roomNumber])
  @@index([propertyId])
  @@index([propertyId, status])
  @@index([propertyId, deletedAt])
  @@map("rooms")
}


// ─────────────────────────────────────────────
// 4. TENANT TABLE
// ─────────────────────────────────────────────
// A person renting a room/bed.
// Links a User (if they have portal access)
// to a specific room in a specific property.

model Tenant {
  id                    String        @id @default(uuid()) @db.Uuid
  userId                String?       @db.Uuid         // linked user account (nullable until tenant registers)
  propertyId            String        @db.Uuid
  roomId                String        @db.Uuid

  // Personal Info
  name                  String        @db.VarChar(100)
  phone                 String        @db.VarChar(15)
  email                 String?       @db.VarChar(255)
  gender                Gender        @default(MALE)
  dateOfBirth           DateTime?     @db.Date
  avatarUrl             String?       @db.VarChar(500)
  occupation            Occupation?
  organization          String?       @db.VarChar(200) // college or company name
  permanentAddress      String?       @db.Text

  // Emergency Contact
  emergencyContactName  String?       @db.VarChar(100)
  emergencyContactPhone String?       @db.VarChar(15)
  emergencyContactRelation String?    @db.VarChar(50)

  // KYC Documents
  aadhaarNumber         String?       @db.VarChar(500) // encrypted (AES-256)
  aadhaarFrontUrl       String?       @db.VarChar(500) // file URL
  aadhaarBackUrl        String?       @db.VarChar(500)
  panNumber             String?       @db.VarChar(500) // encrypted
  otherIdUrl            String?       @db.VarChar(500)

  // Tenancy Details
  moveInDate            DateTime      @db.Date
  expectedDuration      String?       @db.VarChar(50)  // "6 months", "1 year", "indefinite"
  rentAmount            Int                             // paisa — may differ from room base rent
  rentDueDay            Int           @default(1)       // 1-28
  status                TenantStatus  @default(ACTIVE)
  vacatedDate           DateTime?     @db.Date
  vacateReason          String?       @db.VarChar(200)

  // Additional recurring charges stored as JSONB
  additionalCharges     Json?         // [{ label, amount, type }]

  // Internal
  notes                 String?       @db.Text          // owner-only notes
  portalInviteSent      Boolean       @default(false)
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt
  deletedAt             DateTime?

  // Relations
  user                  User?         @relation("TenantUser", fields: [userId], references: [id])
  property              Property      @relation(fields: [propertyId], references: [id])
  room                  Room          @relation(fields: [roomId], references: [id])
  rentEntries           RentEntry[]
  payments              Payment[]
  receipts              Receipt[]
  maintenanceRequests   MaintenanceRequest[]
  securityDeposit       SecurityDeposit?
  vacateRecord          VacateRecord?
  roomTransfers         RoomTransfer[]

  @@unique([propertyId, phone])
  @@index([propertyId])
  @@index([propertyId, status])
  @@index([roomId])
  @@index([userId])
  @@index([phone])
  @@index([propertyId, deletedAt])
  @@map("tenants")
}


// ─────────────────────────────────────────────
// 5. SECURITY DEPOSIT TABLE
// ─────────────────────────────────────────────
// Tracks deposit paid by tenant.
// Separate table because deposit has its own
// lifecycle (paid → held → refunded/forfeited).

model SecurityDeposit {
  id                    String        @id @default(uuid()) @db.Uuid
  tenantId              String        @unique @db.Uuid
  amount                Int                             // paisa
  amountPaid            Int           @default(0)       // paisa — could be partial
  status                DepositStatus @default(PENDING)
  paymentMode           PaymentMode?
  paymentDate           DateTime?     @db.Date
  transactionRef        String?       @db.VarChar(100)
  refundAmount          Int?          @default(0)       // paisa — net refund
  refundDate            DateTime?     @db.Date
  refundMode            PaymentMode?
  deductions            Json?         // [{ label, amount, note }]
  notes                 String?       @db.Text
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  // Relations
  tenant                Tenant        @relation(fields: [tenantId], references: [id])

  @@map("security_deposits")
}


// ─────────────────────────────────────────────
// 6. RENT ENTRY TABLE
// ─────────────────────────────────────────────
// One row per tenant per month.
// Represents "Tenant X owes ₹Y for Month Z."
// Auto-generated monthly by cron job.

model RentEntry {
  id                    String      @id @default(uuid()) @db.Uuid
  tenantId              String      @db.Uuid
  propertyId            String      @db.Uuid

  // Billing period
  month                 Int                           // 1-12
  year                  Int                           // 2025
  billingPeriodStart    DateTime    @db.Date          // e.g., 2025-06-01
  billingPeriodEnd      DateTime    @db.Date          // e.g., 2025-06-30

  // Amounts (all in paisa)
  baseRent              Int                           // base room rent
  additionalCharges     Json?                         // [{ label, amount }]
  utilityCharges        Json?                         // [{ type, amount, details }]
  lateFee               Int         @default(0)
  discount              Int         @default(0)
  totalAmount           Int                           // sum of all charges
  amountPaid            Int         @default(0)       // total received so far
  balanceDue            Int                           // totalAmount - amountPaid

  // Status & Dates
  status                RentStatus  @default(UNPAID)
  dueDate               DateTime    @db.Date
  paidDate              DateTime?   @db.Date          // date when fully paid
  isProRated            Boolean     @default(false)   // first/last month partial

  notes                 String?     @db.Text
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  tenant                Tenant      @relation(fields: [tenantId], references: [id])
  property              Property    @relation(fields: [propertyId], references: [id])
  payments              Payment[]

  @@unique([tenantId, month, year])
  @@index([propertyId, month, year])
  @@index([propertyId, status])
  @@index([tenantId, status])
  @@index([propertyId, dueDate, status])
  @@index([status, dueDate])
  @@map("rent_entries")
}


// ─────────────────────────────────────────────
// 7. PAYMENT TABLE
// ─────────────────────────────────────────────
// A single payment made by a tenant.
// Linked to a rent entry.
// A rent entry can have multiple payments
// (partial payments).

model Payment {
  id                    String      @id @default(uuid()) @db.Uuid
  rentEntryId           String      @db.Uuid
  tenantId              String      @db.Uuid

  amount                Int                           // paisa
  paymentMode           PaymentMode
  paymentDate           DateTime    @db.Date
  transactionRef        String?     @db.VarChar(100)  // UPI ref, cheque no
  notes                 String?     @db.Text

  // Online payment specific
  razorpayPaymentId     String?     @db.VarChar(100)
  razorpayOrderId       String?     @db.VarChar(100)
  razorpaySignature     String?     @db.VarChar(500)
  isOnlinePayment       Boolean     @default(false)

  // Metadata
  recordedBy            String?     @db.Uuid          // userId of person who recorded
  isVoided              Boolean     @default(false)    // voided if receipt was regenerated
  voidReason            String?     @db.VarChar(200)
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  rentEntry             RentEntry   @relation(fields: [rentEntryId], references: [id])
  tenant                Tenant      @relation(fields: [tenantId], references: [id])
  receipt               Receipt?

  @@index([rentEntryId])
  @@index([tenantId])
  @@index([paymentDate])
  @@index([tenantId, paymentDate])
  @@map("payments")
}


// ─────────────────────────────────────────────
// 8. RECEIPT TABLE
// ─────────────────────────────────────────────
// Generated after a payment is recorded.
// One receipt per payment.
// Contains the PDF URL and metadata.

model Receipt {
  id                    String      @id @default(uuid()) @db.Uuid
  paymentId             String      @unique @db.Uuid
  tenantId              String      @db.Uuid

  receiptNumber         String      @unique @db.VarChar(30)  // TE-2025-06-00142
  pdfUrl                String?     @db.VarChar(500)         // R2 URL
  pdfGeneratedAt        DateTime?

  // Snapshot of data at time of generation
  // (so receipt is accurate even if data changes later)
  receiptData           Json                                  // full receipt content

  // Metadata
  sentToTenant          Boolean     @default(false)
  sentVia               NotificationChannel[]  @default([])
  sentAt                DateTime?
  isVoided              Boolean     @default(false)
  voidedAt              DateTime?
  voidReason            String?     @db.VarChar(200)
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  payment               Payment     @relation(fields: [paymentId], references: [id])
  tenant                Tenant      @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([receiptNumber])
  @@index([tenantId, createdAt])
  @@map("receipts")
}


// ─────────────────────────────────────────────
// 9. MAINTENANCE REQUEST TABLE
// ─────────────────────────────────────────────
// Raised by tenant, managed by owner.

model MaintenanceRequest {
  id                    String              @id @default(uuid()) @db.Uuid
  tenantId              String              @db.Uuid
  propertyId            String              @db.Uuid

  requestNumber         String              @unique @db.VarChar(20) // MR-00042
  category              MaintenanceCategory
  description           String              @db.Text
  photos                String[]            @default([])
  urgency               MaintenanceUrgency  @default(MEDIUM)
  preferredTime         String?             @db.VarChar(20) // "morning", "afternoon", "evening", "anytime"

  status                MaintenanceStatus   @default(NEW)
  assignedWorkerName    String?             @db.VarChar(100)
  assignedWorkerPhone   String?             @db.VarChar(15)
  resolvedAt            DateTime?
  closedAt              DateTime?
  resolutionNotes       String?             @db.Text
  resolutionPhotos      String[]            @default([])
  rejectionReason       String?             @db.Text

  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  // Relations
  tenant                Tenant              @relation(fields: [tenantId], references: [id])
  property              Property            @relation(fields: [propertyId], references: [id])
  comments              MaintenanceComment[]
  statusHistory         MaintenanceStatusChange[]

  @@index([propertyId])
  @@index([propertyId, status])
  @@index([tenantId])
  @@index([status])
  @@index([requestNumber])
  @@map("maintenance_requests")
}


// ─────────────────────────────────────────────
// 10. MAINTENANCE COMMENT TABLE
// ─────────────────────────────────────────────
// Comments/replies on a maintenance request.
// Can be from owner, tenant, or staff.

model MaintenanceComment {
  id                    String      @id @default(uuid()) @db.Uuid
  requestId             String      @db.Uuid
  authorId              String      @db.Uuid          // userId
  authorRole            UserRole                      // who posted (OWNER/TENANT/STAFF)

  content               String      @db.Text
  isInternal            Boolean     @default(false)   // owner-only note (not visible to tenant)
  attachments           String[]    @default([])
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  request               MaintenanceRequest @relation(fields: [requestId], references: [id])

  @@index([requestId])
  @@index([requestId, createdAt])
  @@map("maintenance_comments")
}


// ─────────────────────────────────────────────
// 11. MAINTENANCE STATUS CHANGE TABLE
// ─────────────────────────────────────────────
// Tracks status transitions for timeline view.

model MaintenanceStatusChange {
  id                    String              @id @default(uuid()) @db.Uuid
  requestId             String              @db.Uuid
  fromStatus            MaintenanceStatus?
  toStatus              MaintenanceStatus
  changedBy             String              @db.Uuid   // userId
  note                  String?             @db.Text
  createdAt             DateTime            @default(now())

  // Relations
  request               MaintenanceRequest  @relation(fields: [requestId], references: [id])

  @@index([requestId])
  @@index([requestId, createdAt])
  @@map("maintenance_status_changes")
}


// ─────────────────────────────────────────────
// 12. ANNOUNCEMENT TABLE
// ─────────────────────────────────────────────
// Notices posted by owner for tenants.

model Announcement {
  id                    String                @id @default(uuid()) @db.Uuid
  propertyId            String                @db.Uuid
  authorId              String                @db.Uuid   // owner or staff userId

  title                 String                @db.VarChar(200)
  body                  String                @db.Text
  category              AnnouncementCategory  @default(GENERAL)
  targetType            String                @default("all") @db.VarChar(20) // "all", "floor", "rooms"
  targetValue           String[]              @default([])  // floor numbers or room IDs
  attachments           String[]              @default([])
  isPinned              Boolean               @default(false)
  notifyTenants         Boolean               @default(true)
  isActive              Boolean               @default(true)
  createdAt             DateTime              @default(now())
  updatedAt             DateTime              @updatedAt
  deletedAt             DateTime?

  // Relations
  property              Property              @relation(fields: [propertyId], references: [id])
  reads                 AnnouncementRead[]

  @@index([propertyId])
  @@index([propertyId, isActive, isPinned])
  @@index([propertyId, createdAt])
  @@map("announcements")
}


// ─────────────────────────────────────────────
// 13. ANNOUNCEMENT READ TABLE
// ─────────────────────────────────────────────
// Tracks which tenants have read which announcements.

model AnnouncementRead {
  id                    String      @id @default(uuid()) @db.Uuid
  announcementId        String      @db.Uuid
  tenantId              String      @db.Uuid
  readAt                DateTime    @default(now())

  // Relations
  announcement          Announcement @relation(fields: [announcementId], references: [id])

  @@unique([announcementId, tenantId])
  @@index([announcementId])
  @@index([tenantId])
  @@map("announcement_reads")
}


// ─────────────────────────────────────────────
// 14. NOTIFICATION TABLE
// ─────────────────────────────────────────────
// In-app notifications for users.

model Notification {
  id                    String            @id @default(uuid()) @db.Uuid
  userId                String            @db.Uuid
  type                  NotificationType
  title                 String            @db.VarChar(200)
  body                  String            @db.Text
  data                  Json?                               // { tenantId, paymentId, etc. }
  actionUrl             String?           @db.VarChar(500)  // deep link
  isRead                Boolean           @default(false)
  readAt                DateTime?
  createdAt             DateTime          @default(now())

  // Relations
  user                  User              @relation("UserNotifications", fields: [userId], references: [id])

  @@index([userId, isRead])
  @@index([userId, createdAt])
  @@index([userId, isRead, createdAt])
  @@map("notifications")
}


// ─────────────────────────────────────────────
// 15. REMINDER LOG TABLE
// ─────────────────────────────────────────────
// Tracks every reminder sent to prevent
// duplicates and enable delivery tracking.

model ReminderLog {
  id                    String              @id @default(uuid()) @db.Uuid
  tenantId              String              @db.Uuid
  rentEntryId           String?             @db.Uuid
  sentBy                String?             @db.Uuid   // null = system, userId = manual
  reminderType          String              @db.VarChar(20) // "pre_due", "on_due", "overdue", "manual"
  channel               NotificationChannel
  messageTemplate       String?             @db.VarChar(50)
  messageContent        String?             @db.Text    // actual message sent
  deliveryStatus        String              @default("sent") @db.VarChar(20) // "sent", "delivered", "failed"
  failureReason         String?             @db.Text
  externalMessageId     String?             @db.VarChar(200) // MSG91 message ID, etc.
  sentAt                DateTime            @default(now())

  // Relations
  sender                User?               @relation("ReminderSender", fields: [sentBy], references: [id])

  @@index([tenantId, sentAt])
  @@index([tenantId, reminderType, sentAt])
  @@index([rentEntryId])
  @@map("reminder_logs")
}


// ─────────────────────────────────────────────
// 16. UTILITY READING TABLE
// ─────────────────────────────────────────────
// Meter readings for electricity/water billing.

model UtilityReading {
  id                    String        @id @default(uuid()) @db.Uuid
  propertyId            String        @db.Uuid
  roomId                String?       @db.Uuid  // null for shared meter readings
  utilityType           UtilityType
  month                 Int                     // 1-12
  year                  Int                     // 2025
  previousReading       Int?                    // meter value
  currentReading        Int?                    // meter value
  unitsConsumed         Int?                    // calculated
  ratePerUnit           Int?                    // paisa
  totalCharge           Int                     // paisa — final charge
  billingModel          BillingModel
  notes                 String?       @db.Text
  createdAt             DateTime      @default(now())
  updatedAt             DateTime      @updatedAt

  // Relations
  property              Property      @relation(fields: [propertyId], references: [id])
  room                  Room?         @relation(fields: [roomId], references: [id])

  @@unique([propertyId, roomId, utilityType, month, year])
  @@index([propertyId, month, year])
  @@map("utility_readings")
}


// ─────────────────────────────────────────────
// 17. ROOM TRANSFER TABLE
// ─────────────────────────────────────────────
// Records when a tenant moves from one room
// to another within the same property.

model RoomTransfer {
  id                    String      @id @default(uuid()) @db.Uuid
  tenantId              String      @db.Uuid
  fromRoomId            String      @db.Uuid
  toRoomId              String      @db.Uuid
  transferDate          DateTime    @db.Date
  previousRent          Int                         // paisa
  newRent               Int                         // paisa
  reason                String?     @db.Text
  performedBy           String      @db.Uuid        // userId of owner/staff
  createdAt             DateTime    @default(now())

  // Relations
  tenant                Tenant      @relation(fields: [tenantId], references: [id])

  @@index([tenantId])
  @@index([tenantId, transferDate])
  @@map("room_transfers")
}


// ─────────────────────────────────────────────
// 18. VACATE RECORD TABLE
// ─────────────────────────────────────────────
// Stores settlement details when a tenant vacates.
// One record per vacated tenant.

model VacateRecord {
  id                    String      @id @default(uuid()) @db.Uuid
  tenantId              String      @unique @db.Uuid
  vacateDate            DateTime    @db.Date
  reason                String?     @db.VarChar(200)

  // Settlement details (all in paisa)
  pendingRent           Int         @default(0)
  pendingUtilities      Int         @default(0)
  pendingLateFees       Int         @default(0)
  totalPendingDues      Int         @default(0)

  depositHeld           Int         @default(0)
  deductions            Json?       // [{ label, amount, note }]
  totalDeductions       Int         @default(0)
  netRefundable         Int         @default(0)

  refundStatus          String      @default("pending") @db.VarChar(20) // "refunded", "pending", "no_refund"
  refundDate            DateTime?   @db.Date

  settlementPdfUrl      String?     @db.VarChar(500)
  notes                 String?     @db.Text
  performedBy           String      @db.Uuid          // userId
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  tenant                Tenant      @relation(fields: [tenantId], references: [id])

  @@map("vacate_records")
}


// ─────────────────────────────────────────────
// 19. AGREEMENT TABLE
// ─────────────────────────────────────────────
// Generated rental agreements.

model Agreement {
  id                    String      @id @default(uuid()) @db.Uuid
  tenantId              String      @db.Uuid
  propertyId            String      @db.Uuid

  templateType          String      @db.VarChar(50)   // "standard", "pg", "state_specific"
  state                 String?     @db.VarChar(50)   // "maharashtra", "karnataka"
  startDate             DateTime    @db.Date
  endDate               DateTime?   @db.Date
  duration              String?     @db.VarChar(50)   // "12 months"

  agreementData         Json                          // full agreement content snapshot
  customClauses         String[]    @default([])
  pdfUrl                String?     @db.VarChar(500)

  // E-sign (Phase 3)
  ownerSigned           Boolean     @default(false)
  tenantSigned          Boolean     @default(false)
  ownerSignedAt         DateTime?
  tenantSignedAt        DateTime?
  eSignProvider         String?     @db.VarChar(50)   // "digio", "leegality"
  eSignDocId            String?     @db.VarChar(200)

  status                String      @default("draft") @db.VarChar(20) // "draft", "sent", "signed", "expired"
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  @@index([tenantId])
  @@index([propertyId])
  @@map("agreements")
}


// ─────────────────────────────────────────────
// 20. STAFF ASSIGNMENT TABLE
// ─────────────────────────────────────────────
// Links staff users to properties with roles.

model StaffAssignment {
  id                    String          @id @default(uuid()) @db.Uuid
  userId                String          @db.Uuid
  propertyId            String          @db.Uuid
  invitedByUserId       String          @db.Uuid    // owner who invited

  role                  StaffRole
  inviteStatus          StaffInviteStatus @default(PENDING)
  invitePhone           String          @db.VarChar(15)
  inviteEmail           String?         @db.VarChar(255)
  invitedAt             DateTime        @default(now())
  acceptedAt            DateTime?
  isActive              Boolean         @default(true)
  deactivatedAt         DateTime?
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt

  // Relations
  user                  User            @relation("StaffUser", fields: [userId], references: [id])
  property              Property        @relation(fields: [propertyId], references: [id])

  @@unique([userId, propertyId])
  @@index([propertyId])
  @@index([userId])
  @@index([invitePhone])
  @@map("staff_assignments")
}


// ─────────────────────────────────────────────
// 21. SUBSCRIPTION TABLE
// ─────────────────────────────────────────────
// Owner's TenantEase subscription plan.

model Subscription {
  id                    String              @id @default(uuid()) @db.Uuid
  userId                String              @unique @db.Uuid

  plan                  PlanType            @default(FREE)
  billingCycle          BillingCycle?        // null for FREE
  status                SubscriptionStatus  @default(ACTIVE)

  // Dates
  startDate             DateTime?           @db.Date
  currentPeriodStart    DateTime?           @db.Date
  currentPeriodEnd      DateTime?           @db.Date
  cancelledAt           DateTime?
  cancelEffectiveDate   DateTime?           @db.Date

  // Razorpay Subscription
  razorpaySubscriptionId String?            @db.VarChar(100)
  razorpayCustomerId    String?             @db.VarChar(100)

  // Plan Limits (denormalized for quick access)
  maxProperties         Int                 @default(1)
  maxTenantsPerProperty Int                 @default(5)
  maxStaffAccounts      Int                 @default(0)
  smsEnabled            Boolean             @default(false)
  whatsappEnabled       Boolean             @default(false)
  onlinePaymentsEnabled Boolean             @default(false)
  reportsEnabled        Boolean             @default(false)
  removeBranding        Boolean             @default(false)

  createdAt             DateTime            @default(now())
  updatedAt             DateTime            @updatedAt

  // Relations
  user                  User                @relation("UserSubscription", fields: [userId], references: [id])
  invoices              Invoice[]

  @@map("subscriptions")
}


// ─────────────────────────────────────────────
// 22. INVOICE TABLE
// ─────────────────────────────────────────────
// Platform billing invoices (TenantEase charges to owner).

model Invoice {
  id                    String      @id @default(uuid()) @db.Uuid
  subscriptionId        String      @db.Uuid
  invoiceNumber         String      @unique @db.VarChar(30) // INV-2025-06-001
  amount                Int                                  // paisa
  tax                   Int         @default(0)              // GST amount in paisa
  totalAmount           Int                                  // amount + tax
  currency              String      @default("INR") @db.VarChar(3)

  billingPeriodStart    DateTime    @db.Date
  billingPeriodEnd      DateTime    @db.Date
  status                String      @default("paid") @db.VarChar(20) // "paid", "pending", "failed"
  paidAt                DateTime?
  pdfUrl                String?     @db.VarChar(500)

  razorpayPaymentId     String?     @db.VarChar(100)
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  subscription          Subscription @relation(fields: [subscriptionId], references: [id])

  @@index([subscriptionId])
  @@map("invoices")
}


// ─────────────────────────────────────────────
// 23. ENQUIRY TABLE
// ─────────────────────────────────────────────
// Leads from vacancy listing pages.

model Enquiry {
  id                    String      @id @default(uuid()) @db.Uuid
  propertyId            String      @db.Uuid
  roomId                String?     @db.Uuid

  visitorName           String      @db.VarChar(100)
  visitorPhone          String      @db.VarChar(15)
  visitorEmail          String?     @db.VarChar(255)
  preferredMoveIn       DateTime?   @db.Date
  message               String?     @db.Text

  status                String      @default("new") @db.VarChar(20) // "new", "contacted", "converted", "rejected"
  ownerNotes            String?     @db.Text
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt

  // Relations
  property              Property    @relation(fields: [propertyId], references: [id])

  @@index([propertyId])
  @@index([propertyId, status])
  @@map("enquiries")
}


// ─────────────────────────────────────────────
// 24. AUDIT LOG TABLE
// ─────────────────────────────────────────────
// Immutable log of all important actions.
// NEVER deleted. Append-only.

model AuditLog {
  id                    String      @id @default(uuid()) @db.Uuid
  userId                String?     @db.Uuid           // who performed the action
  propertyId            String?     @db.Uuid           // which property context
  action                AuditAction
  entityType            String      @db.VarChar(50)    // "tenant", "payment", "room", etc.
  entityId              String?     @db.Uuid           // ID of the affected entity
  description           String      @db.Text           // human-readable description
  previousData          Json?                          // snapshot before change
  newData               Json?                          // snapshot after change
  ipAddress             String?     @db.VarChar(45)
  userAgent             String?     @db.VarChar(500)
  createdAt             DateTime    @default(now())

  // Relations
  user                  User?       @relation("AuditUser", fields: [userId], references: [id])
  property              Property?   @relation("AuditProperty", fields: [propertyId], references: [id])

  // NO updatedAt — audit logs are immutable
  // NO deletedAt — audit logs are never deleted (only archived)

  @@index([userId])
  @@index([propertyId])
  @@index([entityType, entityId])
  @@index([propertyId, createdAt])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}


// ─────────────────────────────────────────────
// 25. EXPENSE TABLE
// ─────────────────────────────────────────────
// Property expenses logged by owner (for P&L).

model Expense {
  id                    String      @id @default(uuid()) @db.Uuid
  propertyId            String      @db.Uuid
  category              String      @db.VarChar(50) // "repairs", "staff_salary", "electricity", "property_tax", "insurance", "other"
  description           String      @db.VarChar(300)
  amount                Int                         // paisa
  expenseDate           DateTime    @db.Date
  receiptUrl            String?     @db.VarChar(500) // photo of receipt/bill
  notes                 String?     @db.Text
  recordedBy            String      @db.Uuid        // userId
  createdAt             DateTime    @default(now())
  updatedAt             DateTime    @updatedAt
  deletedAt             DateTime?

  @@index([propertyId])
  @@index([propertyId, expenseDate])
  @@index([propertyId, category])
  @@map("expenses")
}
```

---

## 5. Table-by-Table Documentation

### Table: `users`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | No | uuid() | Primary key |
| phone | VARCHAR(15) | No | — | Unique login identifier. Format: +919876543210 |
| name | VARCHAR(100) | No | — | Full name |
| email | VARCHAR(255) | Yes | — | Optional email for receipts and reports |
| avatarUrl | VARCHAR(500) | Yes | — | Profile photo URL |
| role | UserRole | No | OWNER | OWNER, TENANT, STAFF, or ADMIN |
| isActive | BOOLEAN | No | true | Account active status |
| lastLoginAt | TIMESTAMP | Yes | — | Last successful login time |
| onboardingCompleted | BOOLEAN | No | false | Has user completed onboarding wizard |
| onboardingState | JSONB | Yes | — | Wizard progress state |
| notificationPrefs | JSONB | Yes | — | Channel preferences |
| createdAt | TIMESTAMP | No | now() | Account creation time |
| updatedAt | TIMESTAMP | No | auto | Last modification time |
| deletedAt | TIMESTAMP | Yes | — | Soft delete timestamp |

**Business Rules:**
- Phone number must be unique across all users
- Phone number format: 10 digits (Indian mobile), stored with +91 prefix
- A user can be both OWNER (of their properties) and have a TENANT profile (at another property) — same user record, different role contexts
- Admin users are TenantEase internal team only

---

### Table: `properties`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | No | uuid() | Primary key |
| ownerId | UUID (FK→users) | No | — | Owner who manages this property |
| name | VARCHAR(200) | No | — | Property name (e.g., "Sharma PG for Boys") |
| type | PropertyType | No | PG | PG, HOSTEL, APARTMENT, etc. |
| addressLine1 | VARCHAR(300) | No | — | Street address |
| addressLine2 | VARCHAR(300) | Yes | — | Additional address info |
| city | VARCHAR(100) | No | — | City name |
| state | VARCHAR(100) | No | — | State name |
| pinCode | VARCHAR(6) | No | — | 6-digit PIN code |
| genderPolicy | GenderPolicy | No | ANY | Who can rent here |
| totalFloors | INT | Yes | 1 | Number of floors |
| amenities | TEXT[] | No | [] | List of amenity strings |
| photos | TEXT[] | No | [] | Photo URLs |
| ownerPan | VARCHAR(10) | Yes | — | Owner PAN for receipts (encrypted) |
| ownerUpiId | VARCHAR(100) | Yes | — | UPI ID shown in reminders |
| ownerBankDetails | JSONB | Yes | — | Bank account details |
| defaultRentDueDay | INT | No | 1 | Default rent due date (day of month) |
| gracePeriodDays | INT | No | 5 | Days after due before late fee |
| lateFeeType | VARCHAR(20) | Yes | — | "flat", "per_day", or "percentage" |
| lateFeeAmount | INT | Yes | 0 | Late fee value in paisa |
| reminderConfig | JSONB | Yes | — | Full reminder settings |
| electricityModel | BillingModel | Yes | FLAT_RATE | How electricity is billed |
| electricityRate | INT | Yes | 800 | Rate per unit in paisa |
| waterModel | BillingModel | Yes | FLAT_RATE | How water is billed |
| waterRate | INT | Yes | 0 | Rate per unit in paisa |
| isActive | BOOLEAN | No | true | Property active status |
| createdAt | TIMESTAMP | No | now() | Creation time |
| updatedAt | TIMESTAMP | No | auto | Last update time |
| deletedAt | TIMESTAMP | Yes | — | Soft delete timestamp |

**Business Rules:**
- Property count limited by subscription plan (Free: 1, Starter: 1, Pro: 3, Business: unlimited)
- PIN code must be exactly 6 digits
- ownerPan stored encrypted (AES-256)
- Cannot be deleted if it has active tenants

---

### Table: `rooms`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | No | uuid() | Primary key |
| propertyId | UUID (FK→properties) | No | — | Parent property |
| roomNumber | VARCHAR(20) | No | — | Room identifier ("101", "A-3") |
| floor | VARCHAR(20) | Yes | — | Floor identifier |
| type | RoomType | No | SINGLE | SINGLE, DOUBLE, TRIPLE, QUAD, DORMITORY |
| maxOccupancy | INT | No | 1 | Maximum persons in this room |
| currentOccupancy | INT | No | 0 | Current number of tenants |
| status | RoomStatus | No | VACANT | Calculated from occupancy |
| rentPerBed | INT | No | — | Monthly rent per person in paisa |
| depositAmount | INT | No | 0 | Security deposit per person in paisa |
| amenities | TEXT[] | No | [] | Room-specific amenities |
| photos | TEXT[] | No | [] | Room photo URLs |
| notes | TEXT | Yes | — | Owner's internal notes |
| createdAt | TIMESTAMP | No | now() | Creation time |
| updatedAt | TIMESTAMP | No | auto | Last update time |
| deletedAt | TIMESTAMP | Yes | — | Soft delete timestamp |

**Business Rules:**
- Room number must be unique within a property (enforced by unique constraint)
- currentOccupancy must always be between 0 and maxOccupancy
- status is derived: 0=VACANT, between=PARTIALLY_OCCUPIED, max=FULLY_OCCUPIED
- Cannot be deleted if it has active tenants
- rentPerBed is the default rent — individual tenants may have custom amounts

---

### Table: `tenants`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | No | uuid() | Primary key |
| userId | UUID (FK→users) | Yes | — | Linked user account (null until tenant registers on portal) |
| propertyId | UUID (FK→properties) | No | — | Which property |
| roomId | UUID (FK→rooms) | No | — | Which room |
| name | VARCHAR(100) | No | — | Full name |
| phone | VARCHAR(15) | No | — | Phone number (unique per property) |
| email | VARCHAR(255) | Yes | — | Email address |
| gender | Gender | No | MALE | Gender |
| dateOfBirth | DATE | Yes | — | Date of birth |
| avatarUrl | VARCHAR(500) | Yes | — | Profile photo URL |
| occupation | Occupation | Yes | — | Student, working professional, etc. |
| organization | VARCHAR(200) | Yes | — | College or company name |
| permanentAddress | TEXT | Yes | — | Home address |
| emergencyContactName | VARCHAR(100) | Yes | — | Emergency contact |
| emergencyContactPhone | VARCHAR(15) | Yes | — | Emergency phone |
| emergencyContactRelation | VARCHAR(50) | Yes | — | Relationship |
| aadhaarNumber | VARCHAR(500) | Yes | — | Encrypted Aadhaar number |
| aadhaarFrontUrl | VARCHAR(500) | Yes | — | Aadhaar front image URL |
| aadhaarBackUrl | VARCHAR(500) | Yes | — | Aadhaar back image URL |
| panNumber | VARCHAR(500) | Yes | — | Encrypted PAN number |
| otherIdUrl | VARCHAR(500) | Yes | — | Other ID document URL |
| moveInDate | DATE | No | — | When tenant moved in |
| expectedDuration | VARCHAR(50) | Yes | — | Expected stay duration |
| rentAmount | INT | No | — | Monthly rent in paisa (may differ from room base) |
| rentDueDay | INT | No | 1 | Day of month rent is due |
| status | TenantStatus | No | ACTIVE | ACTIVE, ON_NOTICE, VACATED, UPCOMING |
| vacatedDate | DATE | Yes | — | When tenant actually left |
| vacateReason | VARCHAR(200) | Yes | — | Why tenant left |
| additionalCharges | JSONB | Yes | — | Recurring extra charges |
| notes | TEXT | Yes | — | Owner's private notes |
| portalInviteSent | BOOLEAN | No | false | Whether invite SMS was sent |
| createdAt | TIMESTAMP | No | now() | When added to system |
| updatedAt | TIMESTAMP | No | auto | Last update |
| deletedAt | TIMESTAMP | Yes | — | Soft delete |

**Business Rules:**
- Phone must be unique within a property (same person can be tenant at multiple properties)
- aadhaarNumber and panNumber are encrypted before storage
- aadhaarNumber displayed masked in UI (XXXX XXXX 4567)
- When status changes to VACATED, room occupancy must decrease
- userId is null when owner adds tenant. It gets linked when tenant first logs into portal with matching phone
- rentAmount may differ from room's rentPerBed (negotiated rate, discount)
- additionalCharges: `[{ "label": "Mess", "amount": 300000, "type": "RECURRING" }]`

---

### Table: `rent_entries`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | No | uuid() | Primary key |
| tenantId | UUID (FK→tenants) | No | — | Which tenant |
| propertyId | UUID (FK→properties) | No | — | Which property (denormalized for query speed) |
| month | INT | No | — | Month number (1-12) |
| year | INT | No | — | Year (2025) |
| billingPeriodStart | DATE | No | — | Start of billing period |
| billingPeriodEnd | DATE | No | — | End of billing period |
| baseRent | INT | No | — | Base rent in paisa |
| additionalCharges | JSONB | Yes | — | `[{ "label": "Mess", "amount": 300000 }]` |
| utilityCharges | JSONB | Yes | — | `[{ "type": "ELECTRICITY", "amount": 85000, "units": 106 }]` |
| lateFee | INT | No | 0 | Late fee amount in paisa |
| discount | INT | No | 0 | Discount amount in paisa |
| totalAmount | INT | No | — | Sum of all charges in paisa |
| amountPaid | INT | No | 0 | Total received so far in paisa |
| balanceDue | INT | No | — | totalAmount - amountPaid in paisa |
| status | RentStatus | No | UNPAID | UNPAID, PARTIALLY_PAID, PAID, OVERDUE, WAIVED |
| dueDate | DATE | No | — | When payment is due |
| paidDate | DATE | Yes | — | When fully paid |
| isProRated | BOOLEAN | No | false | Whether this is a partial month |
| notes | TEXT | Yes | — | Notes about this entry |
| createdAt | TIMESTAMP | No | now() | When entry was created |
| updatedAt | TIMESTAMP | No | auto | Last update |

**Business Rules:**
- One entry per tenant per month (enforced by unique constraint on tenantId + month + year)
- totalAmount = baseRent + sum(additionalCharges) + sum(utilityCharges) + lateFee - discount
- balanceDue = totalAmount - amountPaid (computed on every payment)
- status transitions: UNPAID → PARTIALLY_PAID → PAID, or UNPAID → OVERDUE → PARTIALLY_PAID → PAID
- lateFee auto-calculated after gracePeriodDays past dueDate
- Pro-rated for first month if moveInDate is not the 1st

---

### Table: `payments`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | No | uuid() | Primary key |
| rentEntryId | UUID (FK→rent_entries) | No | — | Which rent entry this pays |
| tenantId | UUID (FK→tenants) | No | — | Which tenant (denormalized) |
| amount | INT | No | — | Payment amount in paisa |
| paymentMode | PaymentMode | No | — | CASH, UPI, BANK_TRANSFER, etc. |
| paymentDate | DATE | No | — | When payment was made |
| transactionRef | VARCHAR(100) | Yes | — | UPI reference, cheque number |
| notes | TEXT | Yes | — | Notes about this payment |
| razorpayPaymentId | VARCHAR(100) | Yes | — | Razorpay payment ID (online) |
| razorpayOrderId | VARCHAR(100) | Yes | — | Razorpay order ID |
| razorpaySignature | VARCHAR(500) | Yes | — | Razorpay signature for verification |
| isOnlinePayment | BOOLEAN | No | false | Whether paid through platform |
| recordedBy | UUID | Yes | — | Who recorded this (owner/staff userId) |
| isVoided | BOOLEAN | No | false | Whether this payment is voided |
| voidReason | VARCHAR(200) | Yes | — | Why voided |
| createdAt | TIMESTAMP | No | now() | When recorded in system |
| updatedAt | TIMESTAMP | No | auto | Last update |

**Business Rules:**
- After creating a payment, must update rent_entry: amountPaid += payment.amount, recalculate balanceDue, update status
- Multiple payments allowed per rent entry (partial payments)
- paymentDate can be in the past (back-dated recording)
- Cannot be edited after 90 days (enforced in application)
- Voiding a payment reverses the rent entry update
- Online payments: razorpayPaymentId must be verified via webhook before marking as successful

---

### Table: `receipts`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| id | UUID | No | uuid() | Primary key |
| paymentId | UUID (FK→payments) | No | — | One receipt per payment (unique) |
| tenantId | UUID (FK→tenants) | No | — | Which tenant (denormalized) |
| receiptNumber | VARCHAR(30) | No | — | Unique receipt number (e.g., TE-2025-06-00142) |
| pdfUrl | VARCHAR(500) | Yes | — | Stored PDF URL in R2 |
| pdfGeneratedAt | TIMESTAMP | Yes | — | When PDF was generated |
| receiptData | JSONB | No | — | Snapshot of all receipt content at generation time |
| sentToTenant | BOOLEAN | No | false | Whether sent to tenant |
| sentVia | NotificationChannel[] | No | [] | Channels used to send |
| sentAt | TIMESTAMP | Yes | — | When sent |
| isVoided | BOOLEAN | No | false | Voided if payment was edited |
| voidedAt | TIMESTAMP | Yes | — | When voided |
| voidReason | VARCHAR(200) | Yes | — | Why voided |
| createdAt | TIMESTAMP | No | now() | Creation time |
| updatedAt | TIMESTAMP | No | auto | Last update |

**Business Rules:**
- receiptNumber format: TE-{YYYY}-{MM}-{NNNNN} (globally unique, sequential)
- receiptData contains a snapshot of tenant name, owner name, PAN, property address, amount, breakdown at the TIME of generation. This ensures the receipt is accurate even if data is later edited.
- If the underlying payment is edited, the receipt is voided and a new one must be generated
- Receipts are never hard deleted (legal/tax documents)

---

## 6. Relationships Explained

### One-to-Many Relationships

| Parent | Child | Relationship | Description |
|---|---|---|---|
| User | Property | 1:N | One owner can have multiple properties |
| User | Tenant | 1:N | One user can be tenant at multiple properties |
| User | Notification | 1:N | One user receives many notifications |
| User | StaffAssignment | 1:N | One user can be staff at multiple properties |
| Property | Room | 1:N | One property has many rooms |
| Property | Tenant | 1:N | One property has many tenants |
| Property | RentEntry | 1:N | One property has many rent entries |
| Property | MaintenanceRequest | 1:N | One property has many maintenance requests |
| Property | Announcement | 1:N | One property has many announcements |
| Property | StaffAssignment | 1:N | One property can have many staff |
| Property | UtilityReading | 1:N | One property has many utility readings |
| Property | Enquiry | 1:N | One property receives many enquiries |
| Room | Tenant | 1:N | One room can have many tenants (sharing) |
| Room | UtilityReading | 1:N | One room has many readings over months |
| Tenant | RentEntry | 1:N | One tenant has many monthly rent entries |
| Tenant | Payment | 1:N | One tenant makes many payments |
| Tenant | Receipt | 1:N | One tenant has many receipts |
| Tenant | MaintenanceRequest | 1:N | One tenant raises many requests |
| Tenant | RoomTransfer | 1:N | One tenant can be transferred multiple times |
| RentEntry | Payment | 1:N | One rent entry can have multiple partial payments |
| MaintenanceRequest | MaintenanceComment | 1:N | One request has many comments |
| MaintenanceRequest | MaintenanceStatusChange | 1:N | One request has many status transitions |
| Subscription | Invoice | 1:N | One subscription generates many invoices |
| Announcement | AnnouncementRead | 1:N | One announcement read by many tenants |

### One-to-One Relationships

| Parent | Child | Relationship | Description |
|---|---|---|---|
| User | Subscription | 1:1 | One owner has one subscription |
| Tenant | SecurityDeposit | 1:1 | One tenant has one deposit record |
| Tenant | VacateRecord | 1:1 | One tenant has one vacate record (when vacated) |
| Payment | Receipt | 1:1 | One payment generates one receipt |

### Key Relationship Patterns

**Tenant ↔ User (Optional Link):**

```
When owner adds a tenant:
  → Tenant record created with name, phone, room
  → userId is NULL (tenant hasn't registered yet)

When tenant first logs into portal:
  → System finds tenant record by phone number
  → Creates or links User record
  → Sets tenant.userId = user.id
  → Now tenant has portal access

Why nullable?
  → Not all tenants will use the portal
  → Owner can manage tenants without tenants ever logging in
  → Portal access is a bonus, not a requirement
```

**PropertyId Denormalization:**

```
Some tables have propertyId even though it could be
derived through relationships:

  RentEntry has propertyId (could get via tenant → property)
  Payment has tenantId (could get via rentEntry → tenant)
  Receipt has tenantId (could get via payment → rentEntry → tenant)

Why denormalize?
  → Query performance: avoid JOINs on hot paths
  → "Show all rent entries for property X" is a constant query
  → Without denormalization: JOIN rent_entries → tenants → filter by propertyId
  → With denormalization: WHERE propertyId = X (direct, fast)
  → The cost is a few extra bytes per row and update consistency
  → Worth it for the query patterns we have
```

---

## 7. Indexing Strategy

### Index Categories

**Category 1: Primary Key Indexes (automatic)**

Every table has a UUID primary key. PostgreSQL auto-creates a unique B-tree index on it. No action needed.

**Category 2: Unique Constraint Indexes (automatic)**

```
users.phone                               → unique
rooms.(propertyId, roomNumber)            → composite unique
tenants.(propertyId, phone)               → composite unique
rent_entries.(tenantId, month, year)       → composite unique
receipts.receiptNumber                    → unique
maintenance_requests.requestNumber        → unique
staff_assignments.(userId, propertyId)    → composite unique
subscriptions.userId                      → unique
security_deposits.tenantId               → unique
vacate_records.tenantId                  → unique
payments.paymentId → receipts.paymentId   → unique (1:1)
invoices.invoiceNumber                   → unique
announcement_reads.(announcementId, tenantId) → composite unique
utility_readings.(propertyId, roomId, utilityType, month, year) → composite unique
```

**Category 3: Foreign Key Indexes**

```
Every foreign key column gets an index.
Prisma does NOT auto-create FK indexes — you must specify them.

properties.ownerId
rooms.propertyId
tenants.propertyId
tenants.roomId
tenants.userId
rent_entries.tenantId
rent_entries.propertyId
payments.rentEntryId
payments.tenantId
receipts.tenantId
maintenance_requests.propertyId
maintenance_requests.tenantId
maintenance_comments.requestId
maintenance_status_changes.requestId
announcements.propertyId
announcement_reads.announcementId
announcement_reads.tenantId
notifications.userId
staff_assignments.propertyId
staff_assignments.userId
invoices.subscriptionId
enquiries.propertyId
audit_logs.userId
audit_logs.propertyId
utility_readings.propertyId
utility_readings.roomId
```

**Category 4: Query-Specific Composite Indexes**

```
These indexes are designed for specific query patterns:

DASHBOARD QUERIES:
  properties(ownerId, deletedAt)
    → "Show all active properties for this owner"
  
  rooms(propertyId, status)
    → "Show occupied/vacant rooms for this property"
  
  rooms(propertyId, deletedAt)
    → "Show all active rooms"

RENT STATUS PAGE:
  rent_entries(propertyId, month, year)
    → "Show all rent entries for property X in June 2025"
  
  rent_entries(propertyId, status)
    → "Show all unpaid entries for this property"
  
  rent_entries(tenantId, status)
    → "Show unpaid entries for this tenant"

REMINDER JOB:
  rent_entries(status, dueDate)
    → "Find all UNPAID/OVERDUE entries due before today"
  
  rent_entries(propertyId, dueDate, status)
    → "Find overdue entries for specific property"

TENANT QUERIES:
  tenants(propertyId, status)
    → "Show active tenants for this property"
  
  tenants(propertyId, deletedAt)
    → "Show all non-deleted tenants"
  
  tenants(phone)
    → "Find tenant by phone number (portal login)"

MAINTENANCE:
  maintenance_requests(propertyId, status)
    → "Show open requests for this property"

NOTIFICATIONS:
  notifications(userId, isRead)
    → "Show unread notifications for this user"
  
  notifications(userId, isRead, createdAt)
    → "Show unread notifications sorted by date"
  
  notifications(userId, createdAt)
    → "All notifications sorted by date"

AUDIT LOG:
  audit_logs(entityType, entityId)
    → "Show all actions on tenant X"
  
  audit_logs(propertyId, createdAt)
    → "Show recent activity for property"
  
  audit_logs(createdAt)
    → "Global activity feed (admin)"

PAYMENTS:
  payments(tenantId, paymentDate)
    → "Payment history for tenant sorted by date"

RECEIPTS:
  receipts(tenantId, createdAt)
    → "Receipts for tenant sorted by date"

REMINDERS:
  reminder_logs(tenantId, sentAt)
    → "Reminder history for tenant"
  
  reminder_logs(tenantId, reminderType, sentAt)
    → "Check if reminder already sent today"

ANNOUNCEMENTS:
  announcements(propertyId, isActive, isPinned)
    → "Show pinned and active announcements"
  
  announcements(propertyId, createdAt)
    → "Announcements sorted by date"
```

---

## 8. Data Integrity Rules

### Database-Level Constraints

```
ENFORCED BY DATABASE:

  1. NOT NULL on required fields
     → name, phone, propertyId, roomId, etc.

  2. UNIQUE constraints
     → users.phone (globally unique)
     → rooms.(propertyId, roomNumber)
     → tenants.(propertyId, phone)
     → rent_entries.(tenantId, month, year)
     → receipts.receiptNumber

  3. ENUM constraints
     → PostgreSQL ENUMs prevent invalid status values
     → Can't insert status = "BANANA" into tenant_status

  4. CHECK constraints (added via raw SQL migration):
     → rooms.currentOccupancy >= 0
     → rooms.currentOccupancy <= rooms.maxOccupancy
     → rooms.rentPerBed >= 0
     → tenants.rentAmount >= 0
     → rent_entries.month BETWEEN 1 AND 12
     → rent_entries.year >= 2020
     → rent_entries.totalAmount >= 0
     → rent_entries.amountPaid >= 0
     → rent_entries.balanceDue >= 0
     → payments.amount > 0
     → tenants.rentDueDay BETWEEN 1 AND 28
     → properties.defaultRentDueDay BETWEEN 1 AND 28
     → properties.gracePeriodDays >= 0

  5. FOREIGN KEY constraints
     → ON DELETE RESTRICT (default — prevent orphaned records)
     → Can't delete a property that has rooms
     → Can't delete a room that has tenants
     → Can't delete a tenant that has payments
```

### Application-Level Integrity Rules

```
ENFORCED BY SERVICE LAYER:

  1. OCCUPANCY CONSISTENCY
     → Adding tenant: room.currentOccupancy += 1
     → Vacating tenant: room.currentOccupancy -= 1
     → Transfer: old room -=1, new room +=1
     → room.status recalculated after every change
     → Wrapped in database transaction

  2. RENT ENTRY CALCULATIONS
     → totalAmount = baseRent + sum(additionalCharges) 
                    + sum(utilityCharges) + lateFee - discount
     → After payment: amountPaid = sum of all payments for this entry
     → balanceDue = totalAmount - amountPaid
     → Status: PAID if balanceDue = 0, PARTIAL if 0 < amountPaid < totalAmount
     → Recalculated on every payment create/edit/delete

  3. RECEIPT NUMBER GENERATION
     → Format: TE-{YYYY}-{MM}-{NNNNN}
     → Sequential within month
     → Atomic: use database sequence or SELECT FOR UPDATE
     → Never reuse a number (even if receipt is voided)

  4. PLAN LIMIT ENFORCEMENT
     → Before creating property: count existing properties for owner
     → Before adding tenant: count active tenants for property
     → Before inviting staff: count active staff for owner
     → Return upgrade prompt if limit exceeded

  5. PAYMENT EDIT RESTRICTIONS
     → Cannot edit payments older than 90 days
     → Editing voids associated receipt
     → Edit creates audit log entry with previous values
```

---

## 9. Soft Delete Implementation

### Strategy

```
SOFT DELETE TABLES:
  → users (deletedAt)
  → properties (deletedAt)
  → rooms (deletedAt)
  → tenants (deletedAt)
  → announcements (deletedAt)
  → expenses (deletedAt)

NOT SOFT DELETED (immutable or lifecycle-managed):
  → rent_entries (never deleted, historical record)
  → payments (never deleted, financial record)
  → receipts (never deleted, legal document)
  → audit_logs (never deleted, compliance)
  → maintenance_requests (never deleted, archived)
  → security_deposits (lifecycle managed by tenant status)
  → vacate_records (created once, never deleted)
  → notifications (can be hard deleted after 90 days)
  → reminder_logs (can be hard deleted after 90 days)


PRISMA MIDDLEWARE FOR SOFT DELETE:

  Applied globally to all queries on soft-deletable models.

  ON FIND (findMany, findFirst, findUnique, count):
    → Auto-add: WHERE deletedAt IS NULL
    → Unless explicitly overridden: { where: { deletedAt: { not: null } } }

  ON DELETE (delete, deleteMany):
    → Convert to UPDATE: SET deletedAt = NOW()
    → Actual record stays in database

  ON UPDATE:
    → No special handling (soft-deleted records can still be updated
      for data correction, but should be rare)


HARD DELETE:
  → Cleanup job runs weekly
  → Finds records where deletedAt < NOW() - 90 days
  → Hard deletes them permanently
  → Logs the deletion count
  → Excludes financial records (payments, receipts, rent entries)
```

---

## 10. Audit Logging Design

### What Gets Logged

```
ALWAYS LOGGED (business-critical events):

  CREATE events:
  → Tenant added (who, which room, rent amount)
  → Property created
  → Room created
  → Payment recorded (amount, mode, tenant)
  → Receipt generated
  → Maintenance request raised
  → Announcement posted
  → Staff invited

  UPDATE events:
  → Tenant details edited (what changed)
  → Rent amount changed (old → new, effective date)
  → Payment edited (old amount → new amount)
  → Room details changed
  → Property settings changed
  → Subscription changed (plan upgrade/downgrade)

  DELETE events:
  → Tenant vacated (settlement details)
  → Payment voided (reason)
  → Receipt voided
  → Staff removed
  → Property deleted

  SPECIAL events:
  → Tenant room transfer (from → to)
  → Reminder sent (to whom, which channel)
  → Login / logout
  → Subscription payment (success/failure)

NOT LOGGED (too noisy):
  → Page views / navigation
  → Search queries
  → Cache hits/misses
  → Notification reads
  → Form drafts / auto-saves


AUDIT LOG ENTRY STRUCTURE:

  {
    id: "uuid",
    userId: "owner-uuid",         // who did it
    propertyId: "property-uuid",  // context
    action: "PAYMENT_RECORDED",   // what happened
    entityType: "payment",        // what entity
    entityId: "payment-uuid",     // which record
    description: "Payment of ₹11,500 recorded for Rahul (Room 204) for June 2025",
    previousData: null,           // null for CREATE
    newData: {                    // snapshot of new state
      amount: 1150000,
      mode: "UPI",
      tenantName: "Rahul Sharma",
      month: 6,
      year: 2025
    },
    ipAddress: "192.168.1.1",
    userAgent: "Mozilla/5.0...",
    createdAt: "2025-06-05T10:30:00Z"
  }

  For UPDATE:
  {
    action: "UPDATE",
    entityType: "tenant",
    entityId: "tenant-uuid",
    description: "Rent changed for Rahul from ₹8,000 to ₹8,500",
    previousData: { rentAmount: 800000 },
    newData: { rentAmount: 850000, effectiveDate: "2025-07-01" },
  }


RETENTION:
  → Audit logs are NEVER deleted
  → After 1 year: archived to cold storage (separate table or S3)
  → Always queryable through admin panel
  → Retention meets Indian IT Act requirements
```

---

## 11. Money Handling

### Paisa-Based Integer Storage

```
ALL MONEY VALUES STORED AS INTEGERS IN PAISA:

  ₹8,000.50 → 800050 (integer)
  ₹299.00   → 29900
  ₹0.50     → 50
  ₹1,00,000 → 10000000

DATABASE:
  → Column type: INT (4 bytes, max ₹2,14,74,836.47)
  → For larger amounts: BIGINT (8 bytes, effectively unlimited)
  → INT is sufficient for rent amounts (max ₹21 lakh per entry)

API:
  → All amounts sent and received in paisa
  → { "rentAmount": 800050 } not { "rentAmount": 8000.50 }

FRONTEND:
  → Convert for display: amount / 100
  → Convert for input: userInput * 100
  → Format: Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })
  → Display: ₹8,000.50

CALCULATIONS (all in paisa):
  totalAmount = baseRent + sum(additionalCharges) + sum(utilityCharges) + lateFee - discount
  balanceDue = totalAmount - amountPaid
  
  All operations use integer arithmetic — no floating point.
  Result is always exact. No rounding errors. Ever.

EDGE CASES:
  → ₹0 rent is allowed (owner's family, caretaker)
  → Negative amounts not allowed (CHECK constraint)
  → Overpayment: amountPaid > totalAmount → handled as advance
```

---

## 12. JSONB Column Schemas

### Defined Structures for All JSONB Columns

```
─────────────────────────────────────────
tenant.additionalCharges
─────────────────────────────────────────
[
  {
    "id": "charge-uuid-1",
    "label": "Mess/Food",
    "amount": 300000,         // ₹3,000 in paisa
    "type": "RECURRING"       // RECURRING or ONE_TIME
  },
  {
    "id": "charge-uuid-2",
    "label": "Laundry",
    "amount": 50000,          // ₹500
    "type": "RECURRING"
  },
  {
    "id": "charge-uuid-3",
    "label": "Key Replacement",
    "amount": 30000,          // ₹300
    "type": "ONE_TIME"
  }
]


─────────────────────────────────────────
rent_entry.additionalCharges
─────────────────────────────────────────
// Snapshot from tenant.additionalCharges at time of generation
[
  { "label": "Mess/Food", "amount": 300000 },
  { "label": "Laundry", "amount": 50000 }
]


─────────────────────────────────────────
rent_entry.utilityCharges
─────────────────────────────────────────
[
  {
    "type": "ELECTRICITY",
    "amount": 104000,         // ₹1,040
    "details": {
      "previousReading": 4520,
      "currentReading": 4650,
      "unitsConsumed": 130,
      "ratePerUnit": 800      // ₹8/unit in paisa
    }
  },
  {
    "type": "WATER",
    "amount": 20000,          // ₹200 flat rate
    "details": {
      "model": "FLAT_RATE"
    }
  }
]


─────────────────────────────────────────
receipt.receiptData
─────────────────────────────────────────
// Complete snapshot at time of generation
{
  "receiptNumber": "TE-2025-06-00142",
  "generatedAt": "2025-06-05T10:30:00Z",
  "tenant": {
    "name": "Rahul Sharma",
    "room": "204",
    "address": "Room 204, Sharma PG, MG Road, Koramangala, Bangalore 560034"
  },
  "owner": {
    "name": "Vijay Sharma",
    "pan": "ABCPS1234D",
    "property": "Sharma PG for Boys",
    "address": "45, MG Road, Koramangala, Bangalore 560034"
  },
  "payment": {
    "amount": 1150000,
    "amountInWords": "Rupees Eleven Thousand Five Hundred Only",
    "mode": "UPI",
    "date": "2025-06-05",
    "transactionRef": "UPI/406712345678"
  },
  "period": {
    "month": "June 2025",
    "startDate": "2025-06-01",
    "endDate": "2025-06-30"
  },
  "breakdown": [
    { "label": "Base Rent", "amount": 800000 },
    { "label": "Mess Charges", "amount": 300000 },
    { "label": "Maintenance", "amount": 50000 }
  ],
  "total": 1150000,
  "branding": "tenantease"     // "tenantease" (free) or "custom" (paid)
}


─────────────────────────────────────────
property.reminderConfig
─────────────────────────────────────────
{
  "enabled": true,
  "preDue": {
    "enabled": true,
    "daysBefore": 3
  },
  "onDue": {
    "enabled": true
  },
  "overdue": {
    "enabled": true,
    "intervalDays": 3,
    "maxDays": 30
  },
  "channels": {
    "email": true,
    "sms": true,
    "whatsapp": false
  },
  "sendTime": "10:00",
  "tone": "friendly",          // "friendly", "formal", "firm"
  "customNote": "Pay via UPI to 9876543210@paytm"
}


─────────────────────────────────────────
property.ownerBankDetails
─────────────────────────────────────────
{
  "bankName": "State Bank of India",
  "accountNumber": "XXXXXXXXXX1234",    // partially masked
  "ifscCode": "SBIN0001234",
  "accountHolderName": "Vijay Sharma"
}


─────────────────────────────────────────
user.notificationPrefs
─────────────────────────────────────────
{
  "email": {
    "enabled": true,
    "paymentReceived": true,
    "newMaintenanceRequest": true,
    "dailySummary": false,
    "weeklyReport": true
  },
  "sms": {
    "enabled": true,
    "paymentReceived": true,
    "newMaintenanceRequest": true
  },
  "inApp": {
    "enabled": true
  }
}


─────────────────────────────────────────
user.onboardingState
─────────────────────────────────────────
{
  "currentStep": 3,
  "completedSteps": [1, 2],
  "propertyId": "prop-uuid",
  "roomsAdded": 10,
  "tenantsAdded": 5,
  "dismissed": false
}


─────────────────────────────────────────
vacate_record.deductions
─────────────────────────────────────────
[
  {
    "label": "Wall damage near bed",
    "amount": 200000,           // ₹2,000
    "note": "Paint peeling and scratch marks"
  },
  {
    "label": "Cleaning charges",
    "amount": 50000             // ₹500
  },
  {
    "label": "Key not returned",
    "amount": 30000             // ₹300
  }
]


─────────────────────────────────────────
security_deposit.deductions
─────────────────────────────────────────
// Same structure as vacate_record.deductions
// (they share the same data, but stored in both for clarity)


─────────────────────────────────────────
notification.data
─────────────────────────────────────────
{
  "tenantId": "tenant-uuid",
  "tenantName": "Rahul Sharma",
  "roomNumber": "204",
  "amount": 1150000,
  "month": "June 2025"
}


─────────────────────────────────────────
agreement.agreementData
─────────────────────────────────────────
{
  "landlord": {
    "name": "Vijay Sharma",
    "pan": "ABCPS1234D",
    "address": "..."
  },
  "tenant": {
    "name": "Rahul Sharma",
    "aadhaar": "XXXX XXXX 4567",
    "address": "..."
  },
  "property": {
    "name": "Sharma PG",
    "address": "...",
    "room": "204"
  },
  "terms": {
    "rent": 800000,
    "deposit": 1600000,
    "duration": "12 months",
    "startDate": "2025-06-01",
    "endDate": "2026-05-31",
    "noticePeriod": "1 month"
  },
  "clauses": [
    "Standard clause 1...",
    "Standard clause 2...",
    "No guests after 10 PM",
    "No cooking in room"
  ]
}
```

---

## 13. Seed Data

### Development Seed Script

```typescript
// prisma/seed.ts — Development seed data

/*
  Creates a complete test environment:
  
  1 Owner (Vijay Sharma)
  ├── Property 1: "Sharma PG for Boys" (Bangalore)
  │   ├── 10 Rooms (101-110, mix of Single/Double/Triple)
  │   ├── 15 Tenants (mix of active, notice, vacated)
  │   ├── 3 months of rent entries (April-June 2025)
  │   ├── Payments for most entries
  │   ├── 5 Receipts
  │   ├── 3 Maintenance requests (mix of statuses)
  │   ├── 2 Announcements
  │   └── Reminder config enabled
  │
  └── Property 2: "Sharma PG for Girls" (Bangalore)
      ├── 5 Rooms
      ├── 8 Tenants
      └── 1 month of rent entries
  
  1 Additional Owner (Priya Patel)
  └── Property 3: "Patel Hostel" (Pune)
      ├── 20 Rooms
      └── 30 Tenants (to test bulk scenarios)
  
  TOTAL:
  → 3 owners
  → 3 properties
  → 35 rooms
  → 53 tenants
  → ~150 rent entries
  → ~100 payments
  → ~50 receipts
  → 10 maintenance requests
  → 5 announcements
*/


// KEY SEED DATA SCENARIOS TO COVER:

// Rent statuses: PAID, UNPAID, PARTIALLY_PAID, OVERDUE, WAIVED
// Tenant statuses: ACTIVE, ON_NOTICE, VACATED, UPCOMING
// Room statuses: VACANT, PARTIALLY_OCCUPIED, FULLY_OCCUPIED
// Maintenance: NEW, ACKNOWLEDGED, IN_PROGRESS, RESOLVED, CLOSED
// Payment modes: CASH, UPI, BANK_TRANSFER, ONLINE
// Deposits: PAID, PARTIALLY_PAID, PENDING
// Room types: SINGLE, DOUBLE, TRIPLE

// This ensures every UI state and edge case can be tested.
```

---

## 14. Migration Strategy

### Migration Workflow

```
DEVELOPMENT:
  1. Edit prisma/schema.prisma
  2. Run: npx prisma migrate dev --name descriptive_name
     → Prisma generates SQL migration file
     → Applies to dev database
     → Regenerates Prisma Client types
  3. Review generated SQL in prisma/migrations/
  4. Commit migration file to git

STAGING:
  1. Deploy to staging (Vercel preview)
  2. Run: npx prisma migrate deploy
     → Applies pending migrations to staging DB
  3. Test thoroughly
  4. If issues: fix in new migration (never edit existing)

PRODUCTION:
  1. Merge to main branch
  2. Vercel build runs
  3. Post-build script: npx prisma migrate deploy
     → Applies pending migrations to production DB
  4. If migration fails: Vercel deployment fails, rolls back
  5. Monitor for issues post-deploy


MIGRATION RULES:

  ✅ DO:
  → Always create new migration for every schema change
  → Name migrations descriptively: 
    "add_utility_readings_table"
    "add_late_fee_columns_to_properties"
    "add_index_rent_entries_status"
  → Review generated SQL before committing
  → Test migration on staging before production
  → Back up production DB before major migrations
  → Keep migrations small and focused (one concern per migration)

  ❌ DON'T:
  → Never edit an existing migration file after it's been applied
  → Never delete migration files
  → Never run prisma migrate dev in production (use deploy)
  → Never make a migration that deletes data without confirmation
  → Never rename columns in production (add new, migrate data, drop old)


DANGEROUS MIGRATIONS (extra care required):

  → Dropping a column:
    Step 1: Stop using column in code (deploy)
    Step 2: Wait 24 hours (ensure no issues)
    Step 3: Drop column in migration (deploy)
    
  → Renaming a column:
    Step 1: Add new column with migration
    Step 2: Backfill data: UPDATE table SET new_col = old_col
    Step 3: Update code to use new column (deploy)
    Step 4: Wait, verify
    Step 5: Drop old column
    
  → Changing column type:
    Same approach — add new, migrate, switch, drop old.
    Never ALTER TYPE directly on a production column with data.

  → Adding NOT NULL column to existing table:
    Step 1: Add column as NULLABLE with migration
    Step 2: Backfill data for existing rows
    Step 3: Add NOT NULL constraint in new migration


MIGRATION FILE STRUCTURE:

  prisma/migrations/
  ├── 20250601000000_initial_schema/
  │   └── migration.sql
  ├── 20250605120000_add_utility_readings/
  │   └── migration.sql
  ├── 20250610090000_add_announcement_tables/
  │   └── migration.sql
  ├── 20250615140000_add_staff_assignments/
  │   └── migration.sql
  ├── 20250620100000_add_index_rent_status/
  │   └── migration.sql
  └── migration_lock.toml
```

---

## 15. Query Patterns

### Common Query Examples

```
─────────────────────────────────────────
DASHBOARD: Financial Summary
─────────────────────────────────────────
"Show total expected vs collected for June 2025"

SELECT
  SUM(total_amount) as total_expected,
  SUM(amount_paid) as total_collected,
  SUM(balance_due) as total_pending,
  COUNT(*) as total_entries,
  COUNT(CASE WHEN status = 'PAID' THEN 1 END) as paid_count,
  COUNT(CASE WHEN status IN ('UNPAID', 'OVERDUE') THEN 1 END) as unpaid_count
FROM rent_entries
WHERE property_id = $1
  AND month = 6
  AND year = 2025;

Index used: rent_entries(propertyId, month, year)


─────────────────────────────────────────
DASHBOARD: Occupancy Overview
─────────────────────────────────────────
"Show room occupancy stats"

SELECT
  COUNT(*) as total_rooms,
  SUM(max_occupancy) as total_beds,
  SUM(current_occupancy) as occupied_beds,
  COUNT(CASE WHEN status = 'FULLY_OCCUPIED' THEN 1 END) as full_rooms,
  COUNT(CASE WHEN status = 'PARTIALLY_OCCUPIED' THEN 1 END) as partial_rooms,
  COUNT(CASE WHEN status = 'VACANT' THEN 1 END) as vacant_rooms
FROM rooms
WHERE property_id = $1
  AND deleted_at IS NULL;

Index used: rooms(propertyId, deletedAt)


─────────────────────────────────────────
RENT STATUS: Monthly Overview
─────────────────────────────────────────
"Show all tenants and their rent status for June 2025"

SELECT
  t.id as tenant_id,
  t.name as tenant_name,
  t.phone,
  r.room_number,
  re.total_amount,
  re.amount_paid,
  re.balance_due,
  re.status as rent_status,
  re.due_date,
  p.payment_date as last_payment_date,
  p.payment_mode as last_payment_mode
FROM tenants t
JOIN rooms r ON t.room_id = r.id
LEFT JOIN rent_entries re ON re.tenant_id = t.id
  AND re.month = 6 AND re.year = 2025
LEFT JOIN LATERAL (
  SELECT payment_date, payment_mode
  FROM payments
  WHERE rent_entry_id = re.id
  ORDER BY payment_date DESC
  LIMIT 1
) p ON true
WHERE t.property_id = $1
  AND t.status = 'ACTIVE'
  AND t.deleted_at IS NULL
ORDER BY r.room_number, t.name;

Indexes used: 
  tenants(propertyId, status)
  rent_entries(tenantId, month, year)


─────────────────────────────────────────
REMINDER JOB: Find Tenants Needing Reminder
─────────────────────────────────────────
"Find all unpaid/overdue entries for properties 
 with reminders enabled, due today or before"

SELECT
  re.id as rent_entry_id,
  re.total_amount,
  re.balance_due,
  re.due_date,
  re.status,
  t.name as tenant_name,
  t.phone as tenant_phone,
  t.email as tenant_email,
  p.name as property_name,
  p.reminder_config,
  p.owner_upi_id
FROM rent_entries re
JOIN tenants t ON re.tenant_id = t.id
JOIN properties p ON re.property_id = p.id
WHERE re.status IN ('UNPAID', 'PARTIALLY_PAID', 'OVERDUE')
  AND re.due_date <= CURRENT_DATE + INTERVAL '3 days'
  AND t.status = 'ACTIVE'
  AND p.reminder_config IS NOT NULL
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM reminder_logs rl
    WHERE rl.tenant_id = t.id
      AND rl.rent_entry_id = re.id
      AND rl.sent_at >= CURRENT_DATE
  );

Indexes used:
  rent_entries(status, dueDate)
  reminder_logs(tenantId, rentEntryId, sentAt)


─────────────────────────────────────────
TENANT PORTAL: Payment History
─────────────────────────────────────────
"Show tenant's payment history (all months)"

SELECT
  re.month,
  re.year,
  re.total_amount,
  re.amount_paid,
  re.status as rent_status,
  re.due_date,
  json_agg(json_build_object(
    'id', p.id,
    'amount', p.amount,
    'mode', p.payment_mode,
    'date', p.payment_date,
    'ref', p.transaction_ref
  ) ORDER BY p.payment_date) as payments
FROM rent_entries re
LEFT JOIN payments p ON p.rent_entry_id = re.id
  AND p.is_voided = false
WHERE re.tenant_id = $1
GROUP BY re.id
ORDER BY re.year DESC, re.month DESC;

Index used: rent_entries(tenantId) + payments(rentEntryId)


─────────────────────────────────────────
SEARCH: Find Tenant by Name or Phone
─────────────────────────────────────────
"Search tenants in a property"

SELECT id, name, phone, room_id, status
FROM tenants
WHERE property_id = $1
  AND deleted_at IS NULL
  AND (
    name ILIKE '%' || $2 || '%'
    OR phone ILIKE '%' || $2 || '%'
  )
ORDER BY name
LIMIT 20;

Index used: tenants(propertyId, deletedAt)
Note: ILIKE with leading % can't use B-tree index efficiently.
For MVP scale (<10,000 rows per property), this is fine.
At scale: add GIN trigram index for fast text search.


─────────────────────────────────────────
REPORT: Monthly Income Statement
─────────────────────────────────────────
"Income breakdown for a property for a month"

SELECT
  SUM(re.base_rent) as total_base_rent,
  SUM(re.late_fee) as total_late_fees,
  SUM(re.amount_paid) as total_collected,
  SUM(re.balance_due) as total_outstanding,
  COUNT(CASE WHEN re.status = 'PAID' THEN 1 END) as paid_count,
  COUNT(CASE WHEN re.status = 'OVERDUE' THEN 1 END) as overdue_count,
  (
    SELECT COALESCE(SUM(amount), 0)
    FROM expenses
    WHERE property_id = $1
      AND EXTRACT(MONTH FROM expense_date) = $2
      AND EXTRACT(YEAR FROM expense_date) = $3
      AND deleted_at IS NULL
  ) as total_expenses
FROM rent_entries re
WHERE re.property_id = $1
  AND re.month = $2
  AND re.year = $3;

Index used: rent_entries(propertyId, month, year)


─────────────────────────────────────────
ADMIN: Platform Metrics
─────────────────────────────────────────
"Overall platform statistics"

SELECT
  (SELECT COUNT(*) FROM users WHERE role = 'OWNER' AND deleted_at IS NULL) as total_owners,
  (SELECT COUNT(*) FROM properties WHERE deleted_at IS NULL) as total_properties,
  (SELECT COUNT(*) FROM tenants WHERE status = 'ACTIVE' AND deleted_at IS NULL) as total_active_tenants,
  (SELECT COALESCE(SUM(amount_paid), 0) FROM rent_entries 
   WHERE month = EXTRACT(MONTH FROM CURRENT_DATE) 
   AND year = EXTRACT(YEAR FROM CURRENT_DATE)) as rent_tracked_this_month,
  (SELECT COUNT(*) FROM subscriptions WHERE plan != 'FREE' AND status = 'ACTIVE') as paying_customers;
```

---

## 16. Performance Considerations

### Query Optimization Rules

```
1. ALWAYS USE INDEXES ON FILTER COLUMNS
   Every WHERE clause column should have an index.
   Especially: propertyId, status, month+year, tenantId.

2. LIMIT RESULT SETS
   All list queries must have LIMIT.
   Default page size: 25.
   Max page size: 100.
   Never SELECT * FROM tenants without LIMIT.

3. SELECT ONLY NEEDED COLUMNS
   Prisma: use select instead of include when possible.
   Don't fetch all 30 columns when you need 5.
   Especially: don't fetch JSONB columns unless needed.

4. AVOID N+1 QUERIES
   Use Prisma include for related data.
   Or use JOIN in raw queries.
   Dashboard: 3-5 queries max, not one per tenant.

5. CACHE HOT PATHS
   Dashboard financial summary: cache 5 min.
   Room occupancy: cache 5 min.
   Tenant list: cache 5 min.
   Invalidate on writes.

6. USE TRANSACTIONS FOR CONSISTENCY, NOT PERFORMANCE
   Transactions add overhead.
   Use them only when multiple writes must be atomic.
   Single writes don't need transactions.

7. CONNECTION POOLING
   Prisma connection pool: default 5 connections.
   Increase to 10-20 for production.
   Use PgBouncer for serverless (Supabase provides this).

8. PAGINATION STRATEGY
   Small datasets (<1000 rows): offset-based pagination.
   Large datasets (>1000 rows): cursor-based pagination.
   MVP: offset-based is fine everywhere.

9. BATCH OPERATIONS
   Bulk import: use createMany (single SQL INSERT with multiple rows).
   Bulk receipt generation: process in batches of 50.
   Bulk reminders: fetch all, process in memory, batch send.

10. MONITOR SLOW QUERIES
    Log all queries taking > 500ms.
    Add indexes for frequent slow queries.
    Use EXPLAIN ANALYZE for debugging.
    Prisma query logging in development.
```

### Expected Table Sizes

```
PER PROPERTY (average PG with 30 tenants):
  rooms: ~15 rows
  tenants: ~30 active + ~20 historical = ~50 rows
  rent_entries: ~30 × 12 months = ~360 rows/year
  payments: ~300 rows/year (not all pay every month)
  receipts: ~300 rows/year
  maintenance_requests: ~50 rows/year
  announcements: ~20 rows/year
  reminder_logs: ~30 × 3 × 12 = ~1,080 rows/year
  audit_logs: ~2,000 rows/year

PER PLATFORM at 1,000 properties:
  users: ~15,000
  properties: ~1,000
  rooms: ~15,000
  tenants: ~50,000
  rent_entries: ~360,000/year
  payments: ~300,000/year
  receipts: ~300,000/year
  audit_logs: ~2,000,000/year

  PostgreSQL handles tens of millions of rows easily.
  With proper indexes, query performance remains < 100ms.
```

---

## 17. Data Retention Policy

### Retention Rules

```
┌────────────────────────────┬─────────────┬───────────────────────┐
│ Data Type                  │ Retention   │ Reason                │
├────────────────────────────┼─────────────┼───────────────────────┤
│ User accounts              │ Indefinite  │ Account persistence   │
│ (active)                   │             │                       │
├────────────────────────────┼─────────────┼───────────────────────┤
│ User accounts              │ 90 days     │ After deletion request│
│ (deleted)                  │ then purge  │ DPDPA compliance      │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Properties (active)        │ Indefinite  │ Business data         │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Properties (soft deleted)  │ 90 days     │ Recovery window       │
│                            │ then purge  │                       │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Tenant records             │ 7 years     │ Tax/legal requirement │
│ (including vacated)        │ minimum     │ Indian IT Act         │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Rent entries               │ 7 years     │ Financial records     │
│                            │             │ Tax compliance        │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Payments                   │ 7 years     │ Financial records     │
│                            │             │ Tax compliance        │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Receipts (data + PDFs)     │ 7 years     │ Legal/tax documents   │
│                            │             │ HRA claims            │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Agreements                 │ 7 years     │ Legal documents       │
│                            │ after end   │                       │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Audit logs                 │ 7 years     │ Compliance            │
│                            │             │ Dispute resolution    │
├────────────────────────────┼─────────────┼───────────────────────┤
│ KYC documents              │ Duration of │ While tenant is active│
│ (Aadhaar, PAN images)      │ tenancy +   │ + 1 year after vacate │
│                            │ 1 year      │ then purge            │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Maintenance requests       │ 3 years     │ Historical reference  │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Notifications              │ 90 days     │ Not critical data     │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Reminder logs              │ 1 year      │ Delivery tracking     │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Announcements              │ 2 years     │ Historical reference  │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Enquiries                  │ 1 year      │ Lead management       │
├────────────────────────────┼─────────────┼───────────────────────┤
│ OTPs (Redis)               │ 5 minutes   │ Auto-expire via TTL   │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Sessions (Redis)           │ 30 days     │ Auto-expire via TTL   │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Cache (Redis)              │ 5-60 min    │ Auto-expire via TTL   │
├────────────────────────────┼─────────────┼───────────────────────┤
│ CSV import files           │ 7 days      │ Not needed after      │
│                            │             │ import complete       │
├────────────────────────────┼─────────────┼───────────────────────┤
│ Property/room photos       │ Lifetime of │ Visual reference      │
│                            │ property    │                       │
└────────────────────────────┴─────────────┴───────────────────────┘


CLEANUP JOB SCHEDULE:

  Weekly (Sunday 3 AM IST):
  → Purge soft-deleted records > 90 days old
  → Delete notifications > 90 days old
  → Delete orphaned files in R2
  → Delete expired import CSVs

  Monthly (1st of month 4 AM IST):
  → Archive reminder logs > 1 year to cold storage
  → Archive audit logs > 1 year to separate table
  → Delete enquiries > 1 year old (status: rejected)

  Annually (April 1st):
  → Review KYC documents for vacated tenants > 1 year
  → Flag for deletion (manual review required)
```

---

## 18. Schema Evolution Plan

### Phase-Wise Schema Changes

```
─────────────────────────────────────────
PHASE 1 (MVP) — Tables Created:
─────────────────────────────────────────

  ✅ users
  ✅ properties (basic fields only)
  ✅ rooms
  ✅ tenants
  ✅ security_deposits
  ✅ rent_entries
  ✅ payments
  ✅ receipts
  ✅ maintenance_requests
  ✅ maintenance_comments
  ✅ maintenance_status_changes
  ✅ notifications
  ✅ reminder_logs
  ✅ audit_logs

  NOT YET CREATED:
  ☐ utility_readings (Phase 2)
  ☐ announcements + announcement_reads (Phase 2)
  ☐ agreements (Phase 2)
  ☐ staff_assignments (Phase 2-3)
  ☐ subscriptions + invoices (Phase 2)
  ☐ enquiries (Phase 3)
  ☐ expenses (Phase 2)
  ☐ room_transfers (Phase 1 — but table created in MVP)
  ☐ vacate_records (Phase 1 — created in MVP)


─────────────────────────────────────────
PHASE 2 — Migrations:
─────────────────────────────────────────

  Migration: add_utility_readings_table
  → CREATE TABLE utility_readings (...)

  Migration: add_announcement_tables
  → CREATE TABLE announcements (...)
  → CREATE TABLE announcement_reads (...)

  Migration: add_agreements_table
  → CREATE TABLE agreements (...)

  Migration: add_subscription_tables
  → CREATE TABLE subscriptions (...)
  → CREATE TABLE invoices (...)
  → INSERT default FREE subscription for all existing owners

  Migration: add_expenses_table
  → CREATE TABLE expenses (...)

  Migration: add_online_payment_columns
  → ALTER TABLE payments ADD COLUMN razorpay_payment_id ...
  → ALTER TABLE payments ADD COLUMN razorpay_order_id ...
  → ALTER TABLE payments ADD COLUMN razorpay_signature ...
  → ALTER TABLE payments ADD COLUMN is_online_payment ...

  Migration: add_utility_charges_to_rent
  → Already handled by JSONB column (no migration needed)

  Migration: add_bulk_operations_indexes
  → CREATE INDEX for CSV import related queries


─────────────────────────────────────────
PHASE 3 — Migrations:
─────────────────────────────────────────

  Migration: add_staff_assignments_table
  → CREATE TABLE staff_assignments (...)

  Migration: add_enquiries_table
  → CREATE TABLE enquiries (...)

  Migration: add_agreement_esign_columns
  → ALTER TABLE agreements ADD COLUMN owner_signed ...
  → ALTER TABLE agreements ADD COLUMN tenant_signed ...
  → ALTER TABLE agreements ADD COLUMN e_sign_provider ...
  → ALTER TABLE agreements ADD COLUMN e_sign_doc_id ...

  Migration: add_vacancy_listing_columns
  → ALTER TABLE properties ADD COLUMN listing_slug VARCHAR(200)
  → ALTER TABLE properties ADD COLUMN listing_enabled BOOLEAN DEFAULT false
  → ALTER TABLE properties ADD COLUMN listing_description TEXT
  → CREATE UNIQUE INDEX ON properties(listing_slug)

  Migration: add_whatsapp_support
  → Already handled by notification channel enum
  → May need: ALTER TABLE reminder_logs ADD whatsapp_message_id


─────────────────────────────────────────
FUTURE — Potential Migrations:
─────────────────────────────────────────

  → Multi-language support columns
  → Mess/food management tables
  → API key management table (for Business plan)
  → White-label configuration table
  → Marketplace/vendor tables
  → Analytics/metrics materialized views
```

---

## Schema Summary

```
TOTAL TABLES: 25

CORE BUSINESS TABLES (10):
  users, properties, rooms, tenants, security_deposits,
  rent_entries, payments, receipts, room_transfers, vacate_records

FEATURE TABLES (8):
  maintenance_requests, maintenance_comments,
  maintenance_status_changes, announcements,
  announcement_reads, utility_readings, agreements, expenses

PLATFORM TABLES (4):
  subscriptions, invoices, staff_assignments, enquiries

SYSTEM TABLES (3):
  notifications, reminder_logs, audit_logs

TOTAL ENUMS: 22
TOTAL INDEXES: ~60 (including auto-created)
TOTAL JSONB COLUMNS: ~15

ESTIMATED STORAGE (per 1,000 properties, 1 year):
  Core data: ~2 GB
  Files (R2): ~50 GB (photos, PDFs, KYC docs)
  Audit logs: ~500 MB
  Total: ~3 GB database + 50 GB files

PostgreSQL handles this with zero performance concerns.
```

---

## End of Document 6

**Next Document:** DOC 7 — API Design Document