# 📄 DOCUMENT 8: AUTH & SECURITY DOCUMENT

| Field | Value |
| :--- | :--- |
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Status** | Approved |
| **Date** | 29 March 2026 |

---

## Table of Contents

1. [Security Objectives](#1-security-objectives)
2. [Authentication Architecture](#2-authentication-architecture)
3. [Authorization Model (RBAC)](#3-authorization-model-rbac)
4. [OTP Authentication Flow](#4-otp-authentication-flow)
5. [Token, Session, and Device Policy](#5-token-session-and-device-policy)
6. [API Security Controls](#6-api-security-controls)
7. [Data Security & Encryption](#7-data-security--encryption)
8. [Document Upload Security (KYC)](#8-document-upload-security-kyc)
9. [Webhook & Payment Security](#9-webhook--payment-security)
10. [Privacy & Compliance (India)](#10-privacy--compliance-india)
11. [Audit Logging & Forensics](#11-audit-logging--forensics)
12. [Threat Model & Mitigations](#12-threat-model--mitigations)
13. [Security Testing Checklist](#13-security-testing-checklist)
14. [Incident Response Basics](#14-incident-response-basics)
15. [Security Acceptance Criteria](#15-security-acceptance-criteria)

---

## 1. Security Objectives

TenantEase handles rent payments, KYC documents, identity data, and financial events. Security goals:

- Prevent unauthorized access across tenants/properties.
- Protect sensitive user data at rest and in transit.
- Prevent payment fraud and webhook spoofing.
- Guarantee traceability of critical actions (audit logs).
- Meet practical compliance expectations for Indian SaaS operations.

---

## 2. Authentication Architecture

### 2.1 Login Method
- Primary auth: phone OTP (owner, staff, tenant).
- Optional: email as secondary contact, not primary credential.
- No password-based login in MVP.

### 2.2 Identity Providers
- SMS OTP provider: MSG91 (primary), Twilio (fallback).
- Email provider: Resend/SES for fallback OTP and notifications.

### 2.3 Authentication Boundary
- API gateway validates access token for all protected `/api/v1/*` routes.
- Public routes restricted to:
  - `/api/v1/auth/send-otp`
  - `/api/v1/auth/verify-otp`
  - `/api/v1/listings/:slug`
  - `/api/v1/listings/:slug/enquiry`
  - `/api/v1/health`

---

## 3. Authorization Model (RBAC)

### 3.1 Roles
- `OWNER`: Full control of own account, properties, billing, staff.
- `STAFF`: Limited actions based on granted permission set.
- `TENANT`: Access only to own portal data.
- `ADMIN`: Internal platform operations only.

### 3.2 Property Isolation Rule
- Every business object has `ownerId` and/or `propertyId`.
- Access check must validate:
  1. User role is permitted.
  2. User belongs to same owner account or mapped tenant profile.
  3. Object property belongs to that owner account.

### 3.3 Staff Permission Keys
- `TENANTS_READ`, `TENANTS_WRITE`
- `RENT_READ`, `PAYMENTS_WRITE`
- `MAINTENANCE_READ`, `MAINTENANCE_WRITE`
- `ANNOUNCEMENTS_WRITE`
- `REPORTS_READ`

Default staff profile: read-heavy, no billing/subscription access.

---

## 4. OTP Authentication Flow

### 4.1 OTP Rules
- Length: 6 digits.
- TTL: 5 minutes.
- Max attempts: 5 per OTP session.
- Resend cooldown: 30 seconds.
- Max send attempts: 3/hour per phone; 10/minute per IP.

### 4.2 Verification Outcomes
- Success: issue access + refresh token, create/update user session.
- Failure (invalid): increment attempt counter.
- Failure (expired): require resend.
- Lockout: temporary (15 minutes) after abuse thresholds.

### 4.3 Abuse Protection
- Device fingerprint + IP-based risk scoring.
- Block disposable/known fraud ranges where feasible.
- Add CAPTCHA after suspicious retry behavior.

---

## 5. Token, Session, and Device Policy

### 5.1 Token Design
- Access token: JWT, short-lived (15 minutes).
- Refresh token: opaque random token, 30 days, stored hashed in DB.
- Rotation: every refresh call rotates refresh token.

### 5.2 Token Claims (Access JWT)
- `sub` (userId), `role`, `ownerId`, `propertyScope` (optional), `jti`, `exp`, `iat`.
- No PII (phone, email) inside token payload.

### 5.3 Session Controls
- One refresh token per device session.
- Server-side revocation table for logout and incident response.
- Force logout all sessions from profile security page and admin panel.

### 5.4 Cookie/Header Strategy
- Mobile web and frontend app use `Authorization: Bearer`.
- Refresh token stored in secure, httpOnly cookie for browser clients.
- `SameSite=Lax` for auth cookie; `Secure=true` in production.

---

## 6. API Security Controls

### 6.1 Transport Security
- HTTPS only (TLS 1.2+; prefer TLS 1.3).
- HSTS enabled for production domain.
- Reject plain HTTP with 301 redirect at edge.

### 6.2 Request Security
- Input validation at controller boundary (Zod/class-validator).
- Output filtering to avoid leaking internal fields.
- Strict JSON content-type checks.
- Request size limits (e.g., 1 MB for JSON payloads).

### 6.3 Rate Limiting
- Enforce limits defined in DOC7 section 26.
- Separate stricter limits for auth and public enquiry endpoints.

### 6.4 CORS
- Allowlist exact frontend domains per environment.
- Disable wildcard origins in production.
- Allow credentials only for trusted origins.

### 6.5 Security Headers
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 7. Data Security & Encryption

### 7.1 Data Classification

| Class | Examples | Handling |
| :--- | :--- | :--- |
| Public | Listing info, public property details | No auth needed, sanitized |
| Internal | Occupancy, reminders, analytics | Auth required |
| Sensitive | Phone, email, Aadhaar/PAN docs, payment refs | Encrypt at rest, strict access |
| Highly Sensitive | KYC document images, webhook secrets, JWT keys | KMS-managed secrets, least privilege |

### 7.2 Encryption Requirements
- In transit: TLS for all services.
- At rest: DB volume encryption + object storage encryption.
- Application-level encryption for Aadhaar/PAN numbers where stored as text.

### 7.3 Data Masking
- Show masked Aadhaar/PAN in UI by default.
- Full value visible only to owner/admin with explicit reveal action and audit log.

---

## 8. Document Upload Security (KYC)

### 8.1 File Intake Rules
- Allowed MIME: `image/jpeg`, `image/png`, `application/pdf`.
- Max size: 5 MB per file.
- Virus/malware scan before finalizing upload.
- Rename with UUID and store outside public bucket paths.

### 8.2 Access Control
- Documents fetched through signed URLs (short TTL, e.g., 5 minutes).
- Tenant cannot access other tenant documents.
- Staff access based on explicit permission only.

### 8.3 Retention
- KYC docs retained while tenant active and for required legal/business retention period.
- Secure deletion workflow after retention window.

---

## 9. Webhook & Payment Security

### 9.1 Razorpay Webhook Validation
- Verify `X-Razorpay-Signature` with HMAC SHA256 + shared secret.
- Reject unsigned/invalid payloads with 401.
- Enforce idempotency by event ID and payment/order IDs.

### 9.2 Payment Safety Controls
- Never trust client-side payment success callbacks alone.
- Rent entry marked paid only after verified webhook event.
- Log every payment state transition with actor/source.

### 9.3 Replay Protection
- Maintain processed webhook event table with TTL and checksum.
- Ignore duplicate events after successful processing.

---

## 10. Privacy & Compliance (India)

### 10.1 Baseline Controls
- Privacy policy and terms available at onboarding.
- Explicit consent for notifications and data processing.
- Purpose limitation for KYC and billing data.

### 10.2 DPDPA-Style Operational Controls
- Data minimization: collect only required fields.
- Consent records stored with timestamp/version.
- User rights workflow:
  - Access data request
  - Correction request
  - Deletion request (subject to legal retention)

### 10.3 Vendor Management
- DPAs with SMS, email, cloud, payment providers.
- Vendor list and data flow map maintained quarterly.

---

## 11. Audit Logging & Forensics

### 11.1 Must-Log Events
- Login, logout, token refresh, failed OTP attempts.
- Tenant create/update/vacate/transfer.
- Payment create/edit/void.
- Receipt generation/sending.
- Staff role/permission changes.
- Admin impersonation and critical actions.

### 11.2 Log Fields
- `eventId`, `timestamp`, `actorUserId`, `actorRole`, `ip`, `userAgent`,
  `resourceType`, `resourceId`, `oldValue`, `newValue`, `result`.

### 11.3 Tamper Resistance
- Append-only log store.
- Restricted write permissions.
- Centralized retention (minimum 1 year for security logs).

---

## 12. Threat Model & Mitigations

| Threat | Risk | Mitigation |
| :--- | :--- | :--- |
| OTP brute-force | Account takeover | Attempt limits, cooldown, risk scoring |
| Broken object-level auth | Cross-tenant data leak | Property ownership checks on every read/write |
| SQL injection | Data compromise | ORM parameterization + input validation |
| XSS in notes/comments | Session theft | Output encoding + CSP |
| Webhook spoofing | Fake payment confirmation | Signature verification + idempotency |
| Stolen refresh token | Session hijack | Token rotation + hashed storage + revoke-all |
| Public bucket exposure | KYC leak | Private bucket + signed URLs only |

---

## 13. Security Testing Checklist

### 13.1 Per Release
- Authentication tests pass (OTP expiry, lockouts, token refresh).
- Authorization tests pass for OWNER/STAFF/TENANT path isolation.
- Dependency vulnerabilities reviewed (`npm audit`/SCA tool).
- Basic DAST scan on staging APIs.
- Secrets scan on repository and deployment configs.

### 13.2 Quarterly
- External penetration test on staging/prod-like environment.
- Webhook replay/fraud simulation.
- Disaster recovery drill for auth and billing paths.

---

## 14. Incident Response Basics

### 14.1 Severity Levels
- `SEV-1`: Active breach, cross-tenant leak, payment corruption.
- `SEV-2`: Partial security impact, high-risk auth outage.
- `SEV-3`: Low-impact vulnerability with workaround.

### 14.2 First 30 Minutes
1. Triage and classify severity.
2. Contain: revoke sessions, disable impacted endpoint if needed.
3. Preserve evidence (logs, payloads, timeline).
4. Notify core response group.
5. Publish internal incident status update.

### 14.3 Post-Incident
- Root cause analysis in 48 hours.
- Corrective action plan with owner and deadlines.
- Security regression tests added before closure.

---

## 15. Security Acceptance Criteria

The platform is security-ready for production only if all checks below pass:

- Auth and RBAC test suites are green.
- No critical/high unresolved vulnerabilities.
- Webhook signature validation and idempotency verified in staging.
- KYC upload path uses private storage + signed URL retrieval.
- Audit logging enabled for all critical finance/security actions.
- Incident response contacts and procedures documented.

---

**Next Document:** DOC 9 — Deployment & DevOps Document

## End of Document 8

