# 📄 DOCUMENT 2: PRODUCT REQUIREMENTS DOCUMENT (PRD)

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 05 June 2025 |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Target Audience & Personas](#2-target-audience--personas)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Functional Requirements (Overview)](#4-functional-requirements-overview)
5. [Feature Module 01 — Auth & Onboarding](#5-feature-module-01--auth--onboarding)
6. [Feature Module 02 — Property & Tenant Mgmt](#6-feature-module-02--property--tenant-mgmt)
7. [Feature Module 03 — Rent & Billing](#7-feature-module-03--rent--billing)
8. [Feature Module 04 — Automated Reminders](#8-feature-module-04--automated-reminders)
9. [Feature Module 05 — Rent Receipts](#9-feature-module-05--rent-receipts)
10. [Feature Module 06 — Maintenance Requests](#10-feature-module-06--maintenance-requests)
11. [Feature Module 07 — Tenant Portal](#11-feature-module-07--tenant-portal)
12. [Feature Module 08 — Owner Dashboard](#12-feature-module-08--owner-dashboard)
13. [Feature Module 09 — Utility Billing](#13-feature-module-09--utility-billing)
14. [Feature Module 10 — Rental Agreements](#14-feature-module-10--rental-agreements)
15. [Feature Module 11 — Online Payments](#15-feature-module-11--online-payments)
16. [Feature Module 12 — Reports & Analytics](#16-feature-module-12--reports--analytics)
17. [Non-Functional Requirements](#17-non-functional-requirements)
18. [Feature Priority Matrix](#18-feature-priority-matrix)
19. [Release Plan](#19-release-plan)

---

## 1. Introduction

This document outlines the detailed functional and technical requirements for **TenantEase**, a property management SaaS platform tailored for the Indian PG and rental market.

### Objective
To build a scalable, mobile-first web application that allows property owners to manage their business digitally and provides tenants with a professional rental experience.

---

## 2. Target Audience & Personas

Refer to **Document 1 (Product Vision & Context)** for detailed personas.

- **Primary Persona:** PG/Hostel Owner (e.g., Vijay, 45, manages 40 beds).
- **Secondary Persona:** Tenant (e.g., Rahul, 24, IT professional, stays in PG).
- **Tertiary Persona:** Staff/Warden (e.g., Suresh, 35, handles day-to-day for owner).

---

## 3. User Roles & Permissions

| Feature | Owner | Manager | Accountant | Warden | Tenant |
| :--- | :---: | :---: | :---: | :---: | :---: |
| View Financials | ✅ | ❌ | ✅ | ❌ | ❌ |
| Record Payment | ✅ | ✅ | ✅ | ❌ | ❌ |
| Add/Edit Tenant | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete Data | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Staff | ✅ | ❌ | ❌ | ❌ | ❌ |
| Raise Maint. Req | ✅ | ✅ | ❌ | ✅ | ✅ |
| Resolve Maint. Req| ✅ | ✅ | ❌ | ✅ | ❌ |
| Issue Receipts | ✅ | ❌ | ✅ | ❌ | ❌ |
| View Own Data | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 4. Functional Requirements (Overview)

The application is divided into several modules based on the roadmap.

- **Phase 1 (MVP):** Auth, Properties, Tenants, Rent Tracking, Receipts, Reminders, Maint. Requests, Dashboard.
- **Phase 2:** Utility Billing, Online Payments, Analytics, Agreements, Bulk Ops.
- **Phase 3:** Staff Roles, Multi-property, Mobile Experience, Advanced workflows.

---

## 5. FEATURE MODULE 01 — AUTH & ONBOARDING

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

### 5.1 Owner Registration & Login
**User Story:** As an owner, I want to create an account using my phone number so I don't have to remember a password.

**Requirements:**
- Input: Mobile number (unverified).
- Action: Send 6-digit OTP via SMS (MSG91/Twilio).
- Validation: Verify OTP (expiry 5 mins).
- Registration: If new user → capture Name, Email, Property Name (initial).
- Session: JWT-based persistent session (30 days).

**Acceptance Criteria:**
- [x] OTP delivered within 10 seconds.
- [x] Invalid OTP shows error.
- [x] Expired OTP requires resend.
- [x] Successful login redirects to Dashboard or Onboarding.

### 5.2 Tenant Login
**User Story:** As a tenant, I want to log in using my phone number to view my receipts and rent status.

**Requirements:**
- Input: Mobile number (must exist in system as added by an owner).
- Verification: Same OTP flow as Owner.
- Data Scope: Tenant sees ONLY their data across all properties they are linked to.

### 5.3 Onboarding Wizard (Owner)
**User Story:** As a new owner, I want a step-by-step guide to set up my first property.

**Requirements:**
1. **Property Details:** Name, Address, City.
2. **Room Config:** Total rooms, room types (Single/Double/etc.).
3. **Rent Basics:** Default rent due date, default rent per room type.
4. **Finalize:** Reach Dashboard with "Create Room" or "Add Tenant" prompt.

---

## 6. FEATURE MODULE 02 — PROPERTY & TENANT MGMT

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

### 6.1 Property Management
**Requirements:**
- CRUD operations for properties.
- Fields: Name, Address, City, Pincode, State, Contact Phone, Property Type (PG/Hostel/Flat).
- Property Settings: Rent due date, late fee rules, owner PAN (for receipts).

### 6.2 Room Management
**Requirements:**
- CRUD operations for rooms.
- Fields: Room Number/Name, Floor, Room Type (Single, Double, Triple, 4-Share, etc.), Monthly Rent, Amenities (AC, Attached Bath, WiFi).
- Total beds calculated from Room Type.
- Visual Map: Color-coded grid showing Occupied vs. Vacant beds.

### 6.3 Add/Edit Tenant
**Requirements:**
- Comprehensive profile: Name, Phone, Email, Photo, Aadhaar, Move-in Date, Rent Amount, Security Deposit, Deposit Status (Paid/Pending), Emergency Contact.
- Assignment: Assign tenant to specific Room and Bed.

### 6.4 Tenant List & Search
**Requirements:**
- Filter by: Status (Active/Vacated), Property, Rent Status (Paid/Unpaid).
- Search: By name or phone number.
- Quick Actions: Send reminder, Record payment, View profile.

### 6.5 Room Transfer
**User Story:** As an owner, I want to move a tenant from one room to another when they request a change.

**Requirements:**
- On tenant profile → "Transfer Room" button.
- Select new room/bed from vacant options.
- Update rent amount if applicable.
- Historical accuracy: Room transfer does NOT affect past payment records (they stay linked to the old room).

### 6.6 Vacate Tenant
**User Story:** As an owner, I want to mark a tenant as vacated with proper settlement.

**Requirements:**
- Final settlement calculation: (Deposit - Damage - Unpaid Rent = Refund).
- Status changes to "Vacated"; Bed marked vacant immediately.
- Final settlement receipt generated as PDF.

### 6.7 Bulk Tenant Import
**User Story:** As a PG owner migrating from a notebook, I want to import all existing tenants via CSV.

**Requirements:**
- Download template → Upload filled CSV → Validation → Preview → Confirm.

---

## 7. FEATURE MODULE 03 — RENT & BILLING

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

### 7.1 Monthly Rent Generation
**Requirements:**
- Scheduled job (cron) runs daily at midnight.
- Automatically generates rent entries for active tenants on their due date.
- Fields: Month/Year, Base Rent, Additional Charges, Status (Unpaid).

### 7.2 Record Payment
**Requirements:**
- Options: Record from dashboard or tenant profile.
- Capture: Amount, Date, Mode (Cash/UPI/Bank/Online), Ref No, Notes.
- Logic: Full payment (Paid), Partial payment (Partially Paid), Overpayment (Advance).

### 7.3 Edit / Delete Payment
**Requirements:**
- Full CRUD for payments (restricted to Owner role).
- Audit log captures who changed what and when.
- 90-day lock on historical edits.

### 7.4 Rent Status View (Monthly Overview)
**Requirements:**
- Comprehensive status table for the current month.
- Summary bar: Total Expected, Collected, Pending, Collection Rate.
- Color codes: Green (Paid), Yellow (Partial), Red (Overdue).

---

## 8. FEATURE MODULE 04 — AUTOMATED REMINDERS

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

### 8.1 Configuration
**Requirements:**
- Pre-due (e.g., 3 days before).
- On-due (on due date).
- Overdue (daily or weekly after due date).
- Channels: In-app (free), Email (free), SMS (paid), WhatsApp (Phase 2).

### 8.2 Templates
**Examples:**
- **Friendly (Pre-due):** "Hi {{name}}, your rent for {{month}} is due on {{date}}."
- **Firm (Overdue):** "Dear {{name}}, your rent is overdue by {{days}} days. Please pay immediately."

---

## 9. FEATURE MODULE 05 — RENT RECEIPTS

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

### 9.1 Receipt Generation
**Requirements:**
- Auto-generated upon recording payment.
- Professional A4 PDF containing: Receipt No, Date, Payer Name, Amount (in words), Period, Property/Owner Details, PAN, Mode, Ref No.
- Legally valid for Indian HRA tax claims.

### 9.2 Bulk & Annual Receipts
**Requirements:**
- Bulk: Generate all receipts for a month in one PDF/ZIP.
- Annual: Consolidated summary for the financial year (April-March).

---

## 10. FEATURE MODULE 06 — MAINTENANCE REQUESTS

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

### 10.1 Raise Request (Tenant)
**Requirements:**
- Tenant portal → Form: Category (Plumbing, Electrical, etc.), Description, Urgency, Photos.

### 10.2 Management (Owner)
**Requirements:**
- Dashboard to track status: New → Acknowledged → In Progress → Resolved → Closed.
- Assign workers (name + phone).
- Add internal and tenant-facing notes.

---

## 11. FEATURE MODULE 07 — TENANT PORTAL

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

**Description:** Responsive web dashboard for tenants (no app install required).

**Features:**
- Current Rent Status & "Pay Now" button.
- Downloadable Receipts & Annual Summaries.
- Maintenance Request raising & tracking.
- Property Announcements.
- Personal Profile view.

---

## 12. FEATURE MODULE 08 — OWNER DASHBOARD

**Priority:** 🔴 P0 (MVP) | **Phase:** 1

**Layout Sections:**
1. **Financial Summary:** Expected vs Collected vs Pending (Progress circle).
2. **Occupancy:** Total beds, Occupied count, Vacancy count.
3. **Action Items:** "8 tenants overdue", "3 new requests".
4. **Recent Activity:** Last 10-20 actions (payments, new tenants).
5. **Quick Actions:** Buttons for Add Tenant, Record Payment, etc.

---

## 13. FEATURE MODULE 09 — UTILITY BILLING

**Priority:** 🟡 P1 | **Phase:** 2

### 13.1 Electricity & Water Billing
**Models:**
- **Individual Meter:** Previous/Current reading entry → Auto-calculate.
- **Shared Split:** Equal split or occupancy-based split of a single bill.
- **Flat Rate:** Fixed monthly charge.

---

## 14. FEATURE MODULE 10 — RENTAL AGREEMENTS

**Priority:** 🟡 P1 | **Phase:** 2

### 14.1 Generation
**Features:**
- State-specific templates (Maharashtra, Karnataka, etc.).
- Auto-fill data from property and tenant profiles.
- Custom clauses and witness sections.
- Export as printable PDF.

---

## 15. FEATURE MODULE 11 — ONLINE PAYMENTS

**Priority:** 🟡 P1 | **Phase:** 2

### 15.1 Payment Gateway
**Requirements:**
- Integration with Razorpay/Cashfree.
- Direct-to-owner settlements (T+2).
- Transaction fee handling (Owner vs Tenant vs Split).
- Auto-reconciliation (Rent status updates to "Paid" automatically).

---

## 16. FEATURE MODULE 12 — REPORTS & ANALYTICS

**Priority:** 🟢 P2 | **Phase:** 2

### 16.1 Reports
- Monthly/Annual Income Reports.
- Defaulter List.
- Deposit Liability Report.
- Expense Tracking & Basic P&L.
- Exports to Excel/PDF.

### 16.2 Charts (Phase 3)
- Income trends (Bar chart).
- Occupancy trends (Line chart).
- Revenue by room type (Pie chart).

---

## 17. NON-FUNCTIONAL REQUIREMENTS

| Category | Requirement |
| :--- | :--- |
| **Performance** | Page load < 3s on 4G; API response < 500ms. |
| **Security** | TLS 1.3, Encrypt sensitive data (Aadhaar/PAN), DPDPA 2023 compliance. |
| **Availability** | 99.9% targeted uptime. |
| **Accessibility** | Mobile-first, min 44px tap targets, WCAG AA contrast. |
| **Scalability** | Support 1 million+ records via horizontal scaling. |

---

## 18. FEATURE PRIORITY MATRIX

### 🔴 P0 — MVP (Phase 1)
- Auth (Owner/Tenant), Onboarding wizard.
- Property & Room Management, Tenant Profile, Room Transfer, Vacate.
- Monthly Rent Gen, Manual Payment Recording, Rent Status Overview.
- Auto-Reminders (Email/SMS), Receipt PDF Generation.
- Maintenance Requests, Tenant Portal, Owner Dashboard.

### 🟡 P1 — Phase 2 (Monetization)
- Utility Billing (Electric/Water), Online Payments (Razorpay).
- Rental Agreement Generator, Bulk Ops (CSV Import).
- Annual Receipt Summary, Advanced Reports.
- Platform Subscription Management.

---

## 19. RELEASE PLAN

1. **v1.0 (MVP):** Months 1-3. All P0 features. Free beta for 20-30 properties.
2. **v1.1:** Months 3-4. UX cleanup + Bulk operations.
3. **v2.0:** Months 4-6. Online Payments + Utility Billing + Paid Plans.
4. **v3.0:** Months 6-12. Multi-property + Staff roles + Mobile App (PWA).

---

**END OF DOCUMENT 2**
