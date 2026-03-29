# 📄 DOCUMENT 7: API DESIGN

| Field | Value |
|---|---|
| **Product Name** | TenantEase |
| **Version** | 1.0 |
| **Author** | [Your Name] |
| **Last Updated** | [Date] |
| **Status** | Draft |
| **Parent Docs** | DOC 1–6 |

---

## 📑 Table of Contents

1. [API Design Principles](#1-api-design-principles)
2. [Base Configuration](#2-base-configuration)
3. [Authentication & Response Standards](#3-authentication--response-standards)
4. [Endpoint Reference — Authentication](#4-endpoint-reference--authentication)
5. [Endpoint Reference — Properties](#5-endpoint-reference--properties)
6. [Endpoint Reference — Rooms](#6-endpoint-reference--rooms)
7. [Endpoint Reference — Tenants](#7-endpoint-reference--tenants)
8. [Endpoint Reference — Rent Entries](#8-endpoint-reference--rent-entries)
9. [Endpoint Reference — Payments](#9-endpoint-reference--payments)
10. [Endpoint Reference — Receipts](#10-endpoint-reference--receipts)
11. [Endpoint Reference — Maintenance](#11-endpoint-reference--maintenance)
12. [Endpoint Reference — Reminders](#12-endpoint-reference--reminders)
13. [Endpoint Reference — Announcements](#13-endpoint-reference--announcements)
14. [Endpoint Reference — Utility Billing](#14-endpoint-reference--utility-billing)
15. [Endpoint Reference — Agreements](#15-endpoint-reference--agreements)
16. [Endpoint Reference — Notifications](#16-endpoint-reference--notifications)
17. [Endpoint Reference — Reports & Analytics](#17-endpoint-reference--reports--analytics)
18. [Endpoint Reference — Subscriptions](#18-endpoint-reference--subscriptions)
19. [Endpoint Reference — Staff](#19-endpoint-reference--staff)
20. [Endpoint Reference — File Uploads](#20-endpoint-reference--file-uploads)
21. [Endpoint Reference — Tenant Portal](#21-endpoint-reference--tenant-portal)
22. [Endpoint Reference — Vacancy & Enquiries](#22-endpoint-reference--vacancy--enquiries)
23. [Endpoint Reference — Webhooks](#23-endpoint-reference--webhooks)
24. [Endpoint Reference — Admin (Internal)](#24-endpoint-reference--admin-internal)
25. [Complete Endpoint Map](#25-complete-endpoint-map)
26. [Rate Limiting per Endpoint](#26-rate-limiting-per-endpoint)
27. [Pagination, Filtering, Sorting](#27-pagination-filtering-sorting)
28. [Versioning Strategy](#28-versioning-strategy)
29. [Error Catalog](#29-error-catalog)

---

## 1. API Design Principles

### Rules Every Endpoint Follows

**1. REST conventions strictly.**

Resources are nouns. Actions are HTTP verbs. No `/api/getTenants` or `/api/createPayment`. Instead: `GET /api/v1/tenants` and `POST /api/v1/payments`.

**2. Every endpoint validates input with Zod.**

No raw request body is ever trusted. Every field is validated for type, format, length, and business rules before touching the database.

**3. Every endpoint checks authentication.**

Except: public listing pages, health check, and webhooks (which use signature verification instead).

**4. Every endpoint checks authorization.**

Authentication tells us WHO you are. Authorization tells us WHAT you can do. An authenticated tenant cannot access owner endpoints. An owner cannot access another owner's data.

**5. Every mutation creates an audit log.**

POST, PUT, PATCH, DELETE — all create an entry in the audit_logs table with before/after snapshots.

**6. Every list endpoint supports pagination.**

No unbounded queries. Default limit: 25. Max limit: 100.

**7. Every money value is in paisa (integer).**

API accepts and returns money as integers. `{ "rentAmount": 800000 }` means ₹8,000.00.

**8. Every timestamp is ISO 8601 UTC.**

`"2025-06-05T10:30:00.000Z"` — always UTC. Frontend converts to IST.

**9. Consistent response envelope.**

Every response uses the same wrapper structure. Success or error, the shape is predictable.

---

## 2. Base Configuration

### URL Structure

```
Production:  https://tenantease.com/api/v1
Staging:     https://staging.tenantease.com/api/v1
Development: http://localhost:3000/api/v1
```

### Content Type

```
Request:  Content-Type: application/json
Response: Content-Type: application/json

File uploads: Content-Type: multipart/form-data
  (only for /api/v1/upload endpoint)
```

### Authentication Header

```
Authorization: Bearer <access_token>

Access token is a JWT with 15-minute expiry.
Refresh token is in httpOnly cookie (automatic).
```

---

## 3. Authentication & Response Standards

### 3.1 Standard Success Response

```json
{
  "success": true,
  "data": { },
  "message": "Operation successful"
}
```

### 3.2 Standard Success Response (List)

```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 148,
    "totalPages": 6,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### 3.3 Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "phone",
        "message": "Phone number must be 10 digits"
      }
    ]
  }
}
```

### 3.4 HTTP Status Codes Used

| Code | Meaning | When Used |
|---|---|---|
| 200 | OK | GET success, PUT/PATCH success |
| 201 | Created | POST that creates a new resource |
| 204 | No Content | DELETE success (no response body) |
| 400 | Bad Request | Validation error, malformed request |
| 401 | Unauthorized | Not authenticated, invalid/expired token |
| 403 | Forbidden | Authenticated but no permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate entry (phone already exists) |
| 422 | Unprocessable Entity | Business rule violation |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Unexpected server error |
| 503 | Service Unavailable | External service down |

### 3.5 Role-Based Access Notation

Throughout this document:

| Symbol | Meaning |
|---|---|
| 🔓 PUBLIC | No authentication required |
| 🔐 OWNER | Requires authenticated owner |
| 🔐 TENANT | Requires authenticated tenant |
| 🔐 STAFF | Requires authenticated staff member |
| 🔐 OWNER+STAFF | Owner or staff with appropriate role |
| 🔐 ADMIN | Internal TenantEase admin only |
| 🔒 WEBHOOK | Signature verification (not JWT) |

---

## 4. Endpoint Reference — Authentication

### 4.1 Send OTP

```
POST /api/v1/auth/send-otp
🔓 PUBLIC
```

**Description:** Send a 6-digit OTP to the provided phone number via SMS.

**Request Body:**

```json
{
  "phone": "9876543210",
  "purpose": "login"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| phone | string | Yes | 10 digits, starts with 6-9 |
| purpose | string | Yes | "login" or "register" |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "phone": "9876543210",
    "otpSent": true,
    "expiresIn": 300,
    "isExistingUser": true
  },
  "message": "OTP sent to +91 98765 XXXXX"
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 400 | VALIDATION_ERROR | Invalid phone number format |
| 429 | RATE_LIMITED | More than 3 OTP requests in 1 hour |
| 503 | SMS_SERVICE_DOWN | MSG91 is unreachable |

**Business Rules:**
- Rate limit: 3 OTP requests per phone number per hour
- OTP is 6 digits, stored in Redis with 5-minute TTL
- If phone exists in users table, `isExistingUser: true`
- If phone doesn't exist, `isExistingUser: false`
- OTP is NOT returned in the response (security)

---

### 4.2 Verify OTP

```
POST /api/v1/auth/verify-otp
🔓 PUBLIC
```

**Description:** Verify OTP and return authentication tokens.

**Request Body:**

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| phone | string | Yes | 10 digits |
| otp | string | Yes | 6 digits |

**Success Response — Existing User (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-here",
      "name": "Vijay Sharma",
      "phone": "9876543210",
      "email": "vijay@example.com",
      "role": "OWNER",
      "onboardingCompleted": true
    },
    "isNewUser": false
  },
  "message": "Login successful"
}
```

**Success Response — New User (201):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid-here",
      "name": null,
      "phone": "9876543210",
      "email": null,
      "role": "OWNER",
      "onboardingCompleted": false
    },
    "isNewUser": true
  },
  "message": "Account created. Please complete your profile."
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 400 | VALIDATION_ERROR | Invalid format |
| 401 | AUTH_INVALID_OTP | Wrong OTP |
| 401 | AUTH_OTP_EXPIRED | OTP expired (> 5 min) |
| 429 | RATE_LIMITED | 5+ failed attempts |

**Business Rules:**
- On success: delete OTP from Redis (single use)
- On success: generate access token (15 min) + refresh token (30 days)
- Refresh token set as httpOnly secure cookie
- On new user: create user record with role OWNER
- Failed attempt counter in Redis (max 5 per OTP session)
- After 5 failures: OTP is invalidated, must request new one

**Headers Set:**

```
Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth; Max-Age=2592000
```

---

### 4.3 Complete Profile (New User)

```
PUT /api/v1/auth/complete-profile
🔐 OWNER
```

**Description:** Complete profile setup for newly registered user.

**Request Body:**

```json
{
  "name": "Vijay Sharma",
  "email": "vijay@example.com",
  "city": "Bangalore",
  "referralSource": "google_search"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| name | string | Yes | 2-100 chars |
| email | string | No | Valid email format |
| city | string | Yes | From supported cities list |
| referralSource | string | No | Enum: google_search, social_media, friend, community, other |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Vijay Sharma",
      "phone": "9876543210",
      "email": "vijay@example.com",
      "role": "OWNER",
      "onboardingCompleted": false
    }
  },
  "message": "Profile updated"
}
```

---

### 4.4 Refresh Token

```
POST /api/v1/auth/refresh
🔓 PUBLIC (uses cookie, not Bearer token)
```

**Description:** Get a new access token using the refresh token cookie.

**Request:** No body. Refresh token read from httpOnly cookie.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 401 | AUTH_REFRESH_INVALID | Missing/invalid/expired refresh token |
| 401 | AUTH_REFRESH_REVOKED | Token was blacklisted (logged out) |

---

### 4.5 Logout

```
POST /api/v1/auth/logout
🔐 OWNER / TENANT / STAFF
```

**Description:** Invalidate current session.

**Request:** No body.

**Success Response (200):**

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Actions:**
- Clear refreshToken cookie
- Add refresh token to Redis blacklist (TTL = remaining token lifetime)
- Create audit log: LOGOUT

---

### 4.6 Get Current User

```
GET /api/v1/auth/me
🔐 OWNER / TENANT / STAFF
```

**Description:** Get authenticated user's profile and subscription info.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "name": "Vijay Sharma",
      "phone": "9876543210",
      "email": "vijay@example.com",
      "avatarUrl": "https://r2.../avatar.webp",
      "role": "OWNER",
      "onboardingCompleted": true,
      "createdAt": "2025-01-15T08:30:00.000Z"
    },
    "subscription": {
      "plan": "PRO",
      "status": "ACTIVE",
      "currentPeriodEnd": "2025-07-01",
      "maxProperties": 3,
      "maxTenantsPerProperty": 100,
      "smsEnabled": true,
      "onlinePaymentsEnabled": true
    },
    "stats": {
      "totalProperties": 2,
      "totalActiveTenants": 45
    }
  }
}
```

---

## 5. Endpoint Reference — Properties

### 5.1 List Properties

```
GET /api/v1/properties
🔐 OWNER
```

**Description:** Get all properties owned by the authenticated user.

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | Page number |
| limit | number | 25 | Items per page (max 100) |
| status | string | "active" | "active" or "all" (include deleted) |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "prop-uuid-1",
      "name": "Sharma PG for Boys",
      "type": "PG",
      "city": "Bangalore",
      "addressLine1": "45, MG Road, Koramangala",
      "genderPolicy": "BOYS_ONLY",
      "photos": ["https://r2.../photo1.webp"],
      "stats": {
        "totalRooms": 15,
        "totalBeds": 30,
        "occupiedBeds": 27,
        "vacantBeds": 3,
        "occupancyRate": 90.0,
        "totalActiveTenants": 27,
        "thisMonthExpected": 2850000,
        "thisMonthCollected": 1920000,
        "thisMonthPending": 930000,
        "collectionRate": 67.4
      },
      "createdAt": "2025-01-15T08:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 25,
    "total": 2,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

**Business Rules:**
- Only returns properties where ownerId matches authenticated user
- Stats are computed: rooms, occupancy, this month's rent totals
- Soft-deleted properties excluded unless `status=all`

---

### 5.2 Get Property Detail

```
GET /api/v1/properties/:propertyId
🔐 OWNER+STAFF
```

**Description:** Get detailed information about a single property.

**Path Parameters:**

| Param | Type | Description |
|---|---|---|
| propertyId | UUID | Property ID |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "prop-uuid-1",
    "name": "Sharma PG for Boys",
    "type": "PG",
    "addressLine1": "45, MG Road, Koramangala",
    "addressLine2": null,
    "city": "Bangalore",
    "state": "Karnataka",
    "pinCode": "560034",
    "genderPolicy": "BOYS_ONLY",
    "totalFloors": 3,
    "amenities": ["WiFi", "AC", "Hot Water", "Parking", "Mess"],
    "photos": ["https://r2.../photo1.webp", "https://r2.../photo2.webp"],
    "ownerPan": "ABCP*****D",
    "ownerUpiId": "9876543210@paytm",
    "defaultRentDueDay": 5,
    "gracePeriodDays": 5,
    "lateFeeType": "per_day",
    "lateFeeAmount": 5000,
    "reminderConfig": { },
    "electricityModel": "INDIVIDUAL_METER",
    "electricityRate": 800,
    "stats": {
      "totalRooms": 15,
      "totalBeds": 30,
      "occupiedBeds": 27,
      "vacantBeds": 3,
      "occupancyRate": 90.0,
      "totalActiveTenants": 27,
      "tenantsOnNotice": 2,
      "openMaintenanceRequests": 3,
      "thisMonthExpected": 2850000,
      "thisMonthCollected": 1920000,
      "thisMonthPending": 930000,
      "collectionRate": 67.4,
      "overdueCount": 5
    },
    "createdAt": "2025-01-15T08:30:00.000Z",
    "updatedAt": "2025-06-01T12:00:00.000Z"
  }
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 404 | NOT_FOUND | Property doesn't exist |
| 403 | AUTH_FORBIDDEN | User doesn't own this property |

**Business Rules:**
- Owner PAN is masked in response (show only first 4 + last 1)
- Staff can access only if assigned to this property
- Stats computed on the fly (or from cache)

---

### 5.3 Create Property

```
POST /api/v1/properties
🔐 OWNER
```

**Description:** Create a new property.

**Request Body:**

```json
{
  "name": "Sharma PG for Boys",
  "type": "PG",
  "addressLine1": "45, MG Road, Koramangala",
  "addressLine2": null,
  "city": "Bangalore",
  "state": "Karnataka",
  "pinCode": "560034",
  "genderPolicy": "BOYS_ONLY",
  "totalFloors": 3,
  "amenities": ["WiFi", "AC", "Hot Water"],
  "defaultRentDueDay": 5,
  "gracePeriodDays": 5
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| name | string | Yes | 2-200 chars |
| type | PropertyType | Yes | Enum value |
| addressLine1 | string | Yes | 5-300 chars |
| addressLine2 | string | No | Max 300 chars |
| city | string | Yes | From supported cities |
| state | string | Yes | Indian state |
| pinCode | string | Yes | Exactly 6 digits |
| genderPolicy | GenderPolicy | Yes | Enum value |
| totalFloors | number | No | 1-50 |
| amenities | string[] | No | Array of strings |
| defaultRentDueDay | number | No | 1-28 |
| gracePeriodDays | number | No | 0-30 |

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "prop-uuid-new",
    "name": "Sharma PG for Boys",
    "type": "PG",
    "city": "Bangalore"
  },
  "message": "Property created successfully"
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 400 | VALIDATION_ERROR | Invalid fields |
| 403 | PLAN_LIMIT_REACHED | Property count exceeds plan limit |

**Business Rules:**
- Check plan limit before creating
- Free plan: max 1 property, Starter: 1, Pro: 3, Business: unlimited
- Create audit log entry
- Invalidate property list cache

---

### 5.4 Update Property

```
PUT /api/v1/properties/:propertyId
🔐 OWNER
```

**Description:** Update property details.

**Request Body:** Same fields as create, all optional (partial update).

```json
{
  "name": "Sharma Premium PG",
  "amenities": ["WiFi", "AC", "Hot Water", "Gym", "CCTV"],
  "ownerPan": "ABCPS1234D",
  "ownerUpiId": "9876543210@paytm"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "prop-uuid",
    "name": "Sharma Premium PG"
  },
  "message": "Property updated"
}
```

**Business Rules:**
- Only owner can update (not staff)
- ownerPan is encrypted before storage
- Audit log with previous values
- Invalidate property cache

---

### 5.5 Delete Property

```
DELETE /api/v1/properties/:propertyId
🔐 OWNER
```

**Description:** Soft-delete a property.

**Request Body:**

```json
{
  "confirmName": "Sharma PG for Boys"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| confirmName | string | Yes | Must exactly match property name |

**Success Response (200):**

```json
{
  "success": true,
  "message": "Property deleted. Data retained for 90 days."
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 422 | BUSINESS_RULE_VIOLATED | Property has active tenants |
| 400 | VALIDATION_ERROR | confirmName doesn't match |

**Business Rules:**
- BLOCKED if property has any active tenants
- Must type exact property name to confirm
- Soft delete: sets deletedAt = now()
- Recoverable for 90 days via support
- Audit log created

---

## 6. Endpoint Reference — Rooms

### 6.1 List Rooms

```
GET /api/v1/properties/:propertyId/rooms
🔐 OWNER+STAFF
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page |
| status | string | "all" | VACANT, PARTIALLY_OCCUPIED, FULLY_OCCUPIED, UNDER_MAINTENANCE |
| floor | string | — | Filter by floor |
| type | RoomType | — | Filter by room type |
| view | string | "list" | "list" or "grid" (same data, hint for frontend) |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "room-uuid",
      "roomNumber": "101",
      "floor": "1st",
      "type": "DOUBLE",
      "maxOccupancy": 2,
      "currentOccupancy": 1,
      "status": "PARTIALLY_OCCUPIED",
      "rentPerBed": 800000,
      "depositAmount": 800000,
      "amenities": ["Attached Bathroom", "AC"],
      "photos": [],
      "tenants": [
        {
          "id": "tenant-uuid",
          "name": "Rahul Sharma",
          "phone": "9876543210",
          "rentStatus": "PAID"
        }
      ]
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  },
  "summary": {
    "totalRooms": 15,
    "totalBeds": 30,
    "occupiedBeds": 27,
    "vacantBeds": 3,
    "fullyOccupied": 10,
    "partiallyOccupied": 3,
    "vacant": 2
  }
}
```

---

### 6.2 Create Room

```
POST /api/v1/properties/:propertyId/rooms
🔐 OWNER
```

**Request Body:**

```json
{
  "roomNumber": "101",
  "floor": "1st",
  "type": "DOUBLE",
  "maxOccupancy": 2,
  "rentPerBed": 800000,
  "depositAmount": 800000,
  "amenities": ["Attached Bathroom", "AC"],
  "notes": "Corner room, good ventilation"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| roomNumber | string | Yes | 1-20 chars, unique in property |
| floor | string | No | 1-20 chars |
| type | RoomType | Yes | Enum value |
| maxOccupancy | number | No | Auto from type, 1-20 |
| rentPerBed | number | Yes | ≥ 0, in paisa |
| depositAmount | number | No | ≥ 0, in paisa |
| amenities | string[] | No | Array of strings |
| notes | string | No | Max 1000 chars |

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "room-uuid",
    "roomNumber": "101",
    "type": "DOUBLE",
    "status": "VACANT"
  },
  "message": "Room 101 created"
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 409 | CONFLICT | Room number already exists in this property |

---

### 6.3 Bulk Create Rooms

```
POST /api/v1/properties/:propertyId/rooms/bulk
🔐 OWNER
```

**Request Body:**

```json
{
  "rooms": [
    {
      "roomNumber": "101",
      "floor": "1st",
      "type": "DOUBLE",
      "rentPerBed": 800000,
      "depositAmount": 800000
    },
    {
      "roomNumber": "102",
      "floor": "1st",
      "type": "DOUBLE",
      "rentPerBed": 800000,
      "depositAmount": 800000
    }
  ]
}
```

**Alternative — Range-based:**

```json
{
  "range": {
    "from": "101",
    "to": "120"
  },
  "floor": "1st",
  "type": "DOUBLE",
  "rentPerBed": 800000,
  "depositAmount": 800000
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "created": 18,
    "skipped": 2,
    "errors": [
      { "roomNumber": "105", "reason": "Already exists" },
      { "roomNumber": "110", "reason": "Already exists" }
    ]
  },
  "message": "18 rooms created, 2 skipped"
}
```

---

### 6.4 Update Room

```
PUT /api/v1/properties/:propertyId/rooms/:roomId
🔐 OWNER
```

**Request Body (partial):**

```json
{
  "rentPerBed": 850000,
  "amenities": ["Attached Bathroom", "AC", "Geyser"],
  "applyRentToExisting": true
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| All room fields | various | No | Same as create |
| applyRentToExisting | boolean | No | Whether to update existing tenants' rent |

**Business Rules:**
- If `rentPerBed` changes and `applyRentToExisting: true`, update all active tenants in this room
- Cannot reduce `maxOccupancy` below `currentOccupancy`
- Audit log with old and new values

---

### 6.5 Delete Room

```
DELETE /api/v1/properties/:propertyId/rooms/:roomId
🔐 OWNER
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 422 | BUSINESS_RULE_VIOLATED | Room has active tenants |

**Business Rules:**
- BLOCKED if room has active tenants
- Soft delete: sets deletedAt

---

## 7. Endpoint Reference — Tenants

### 7.1 List Tenants

```
GET /api/v1/properties/:propertyId/tenants
🔐 OWNER+STAFF
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | Page number |
| limit | number | 25 | Items per page |
| status | TenantStatus | "ACTIVE" | ACTIVE, ON_NOTICE, VACATED, UPCOMING, all |
| rentStatus | string | — | PAID, UNPAID, OVERDUE (this month) |
| roomId | UUID | — | Filter by room |
| floor | string | — | Filter by floor |
| search | string | — | Search by name or phone |
| sort | string | "name" | name, room, moveInDate, rentAmount |
| order | string | "asc" | asc, desc |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "tenant-uuid",
      "name": "Rahul Sharma",
      "phone": "9876543210",
      "email": "rahul@example.com",
      "avatarUrl": null,
      "gender": "MALE",
      "room": {
        "id": "room-uuid",
        "roomNumber": "204",
        "floor": "2nd",
        "type": "DOUBLE"
      },
      "rentAmount": 800000,
      "moveInDate": "2025-01-15",
      "status": "ACTIVE",
      "currentMonthRent": {
        "month": 6,
        "year": 2025,
        "totalAmount": 1150000,
        "amountPaid": 0,
        "status": "UNPAID",
        "dueDate": "2025-06-05"
      },
      "createdAt": "2025-01-15T08:30:00.000Z"
    }
  ],
  "meta": { },
  "summary": {
    "totalActive": 27,
    "paidThisMonth": 19,
    "unpaidThisMonth": 5,
    "overdueThisMonth": 3
  }
}
```

---

### 7.2 Get Tenant Detail

```
GET /api/v1/tenants/:tenantId
🔐 OWNER+STAFF
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "tenant-uuid",
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "avatarUrl": null,
    "gender": "MALE",
    "dateOfBirth": "2000-05-15",
    "occupation": "WORKING_PROFESSIONAL",
    "organization": "Infosys",
    "permanentAddress": "123, Main Street, Jaipur, Rajasthan",
    "emergencyContact": {
      "name": "Suresh Sharma",
      "phone": "9876543200",
      "relation": "Father"
    },
    "kyc": {
      "aadhaarNumber": "XXXX XXXX 4567",
      "aadhaarUploaded": true,
      "panNumber": "ABCPS****D",
      "panUploaded": false,
      "otherIdUploaded": false
    },
    "room": {
      "id": "room-uuid",
      "roomNumber": "204",
      "floor": "2nd",
      "type": "DOUBLE"
    },
    "tenancy": {
      "moveInDate": "2025-01-15",
      "expectedDuration": "1 year",
      "rentAmount": 800000,
      "rentDueDay": 5,
      "status": "ACTIVE",
      "additionalCharges": [
        { "id": "ch-1", "label": "Mess", "amount": 300000, "type": "RECURRING" },
        { "id": "ch-2", "label": "Parking", "amount": 50000, "type": "RECURRING" }
      ]
    },
    "deposit": {
      "amount": 1600000,
      "amountPaid": 1600000,
      "status": "PAID",
      "paymentMode": "UPI",
      "paymentDate": "2025-01-15"
    },
    "currentMonthRent": {
      "id": "re-uuid",
      "month": 6,
      "year": 2025,
      "totalAmount": 1150000,
      "amountPaid": 0,
      "balanceDue": 1150000,
      "status": "UNPAID",
      "dueDate": "2025-06-05",
      "breakdown": {
        "baseRent": 800000,
        "additionalCharges": [
          { "label": "Mess", "amount": 300000 },
          { "label": "Parking", "amount": 50000 }
        ],
        "utilityCharges": [],
        "lateFee": 0,
        "discount": 0
      }
    },
    "portalInviteSent": true,
    "notes": "Referred by Amit. Night shift — different schedule.",
    "createdAt": "2025-01-15T08:30:00.000Z"
  }
}
```

**Business Rules:**
- Aadhaar masked to last 4 digits
- PAN masked to first 4 + last 1
- KYC document URLs NOT included (separate endpoint)
- Notes visible only to owner/staff, never to tenant

---

### 7.3 Create Tenant

```
POST /api/v1/properties/:propertyId/tenants
🔐 OWNER+STAFF(MANAGER)
```

**Request Body:**

```json
{
  "name": "Rahul Sharma",
  "phone": "9876543210",
  "email": "rahul@example.com",
  "gender": "MALE",
  "dateOfBirth": "2000-05-15",
  "occupation": "WORKING_PROFESSIONAL",
  "organization": "Infosys",
  "permanentAddress": "123, Main Street, Jaipur",
  "emergencyContactName": "Suresh Sharma",
  "emergencyContactPhone": "9876543200",
  "emergencyContactRelation": "Father",
  "roomId": "room-uuid",
  "moveInDate": "2025-06-01",
  "expectedDuration": "1 year",
  "rentAmount": 800000,
  "rentDueDay": 5,
  "depositAmount": 1600000,
  "depositStatus": "PAID",
  "depositPaymentMode": "UPI",
  "additionalCharges": [
    { "label": "Mess", "amount": 300000, "type": "RECURRING" }
  ],
  "notes": "Referred by Amit"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| name | string | Yes | 2-100 chars |
| phone | string | Yes | 10 digits, unique in property |
| email | string | No | Valid email |
| gender | Gender | Yes | Enum |
| dateOfBirth | date | No | Past date |
| occupation | Occupation | No | Enum |
| organization | string | No | Max 200 chars |
| permanentAddress | string | No | Max 500 chars |
| emergencyContactName | string | No | Max 100 chars |
| emergencyContactPhone | string | No | 10 digits |
| emergencyContactRelation | string | No | Max 50 chars |
| roomId | UUID | Yes | Must exist, must have vacancy |
| moveInDate | date | Yes | Any date |
| expectedDuration | string | No | Max 50 chars |
| rentAmount | number | Yes | ≥ 0, in paisa |
| rentDueDay | number | No | 1-28, default from property |
| depositAmount | number | No | ≥ 0 |
| depositStatus | DepositStatus | No | Default: PENDING |
| depositPaymentMode | PaymentMode | No | Required if status is PAID |
| additionalCharges | array | No | Array of { label, amount, type } |
| notes | string | No | Max 2000 chars |

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "tenant-uuid-new",
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "room": {
      "roomNumber": "204"
    },
    "rentAmount": 800000,
    "status": "ACTIVE"
  },
  "message": "Tenant Rahul Sharma added to Room 204"
}
```

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 409 | CONFLICT | Phone number already exists in this property |
| 422 | BUSINESS_RULE_VIOLATED | Room has no vacancy |
| 403 | PLAN_LIMIT_REACHED | Tenant count exceeds plan limit |

**Business Rules (Transaction):**
1. Check plan limit (tenant count)
2. Check room has vacancy
3. Create tenant record
4. Create security deposit record
5. Update room: currentOccupancy += 1, recalculate status
6. Generate current month rent entry (pro-rated if mid-month)
7. Send portal invite SMS (if SMS enabled on plan)
8. Create audit log
9. Invalidate caches: tenants, rooms, dashboard

---

### 7.4 Update Tenant

```
PUT /api/v1/tenants/:tenantId
🔐 OWNER+STAFF(MANAGER)
```

**Request Body (partial):**

```json
{
  "email": "rahul.new@example.com",
  "rentAmount": 850000,
  "rentEffectiveFrom": "next_month",
  "additionalCharges": [
    { "label": "Mess", "amount": 350000, "type": "RECURRING" },
    { "label": "Laundry", "amount": 50000, "type": "RECURRING" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| All tenant fields | various | Same as create, all optional |
| rentEffectiveFrom | string | "this_month", "next_month", or ISO date |

**Business Rules:**
- Rent change: audit log with old → new + effective date
- Phone change: update portal login phone
- Room change: use transfer endpoint instead (not this one)
- Status change: use vacate endpoint instead

---

### 7.5 Vacate Tenant

```
POST /api/v1/tenants/:tenantId/vacate
🔐 OWNER
```

**Request Body:**

```json
{
  "vacateDate": "2025-06-30",
  "reason": "End of planned stay",
  "deductions": [
    { "label": "Wall damage", "amount": 200000, "note": "Paint peeling" },
    { "label": "Cleaning", "amount": 50000 }
  ],
  "refundStatus": "pending",
  "notes": "Cooperative tenant. Room in good condition."
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| vacateDate | date | Yes | Not before moveInDate |
| reason | string | No | Max 200 chars |
| deductions | array | No | Array of { label, amount, note? } |
| refundStatus | string | No | "refunded", "pending", "no_refund" |
| notes | string | No | Max 2000 chars |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-uuid",
    "tenantName": "Rahul Sharma",
    "settlement": {
      "pendingRent": 1150000,
      "pendingUtilities": 0,
      "pendingLateFees": 0,
      "totalPendingDues": 1150000,
      "depositHeld": 1600000,
      "totalDeductions": 1400000,
      "netRefundable": 200000,
      "refundStatus": "pending"
    },
    "settlementPdfUrl": "https://r2.../settlement.pdf"
  },
  "message": "Rahul Sharma vacated from Room 204"
}
```

**Business Rules (Transaction):**
1. Calculate pending dues (unpaid rent entries)
2. Calculate deductions
3. Calculate net refundable deposit
4. Update tenant status → VACATED
5. Update room: currentOccupancy -= 1, recalculate status
6. Cancel future rent entries
7. Cancel pending reminders
8. Create vacate record
9. Update security deposit record
10. Generate settlement PDF
11. Notify tenant
12. Create audit log
13. Invalidate caches

---

### 7.6 Transfer Tenant Room

```
POST /api/v1/tenants/:tenantId/transfer
🔐 OWNER
```

**Request Body:**

```json
{
  "newRoomId": "room-uuid-302",
  "transferDate": "2025-06-15",
  "newRentAmount": 750000,
  "reason": "Tenant requested quieter room"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| newRoomId | UUID | Yes | Must have vacancy |
| transferDate | date | No | Default: today |
| newRentAmount | number | No | ≥ 0, default: new room's rentPerBed |
| reason | string | No | Max 500 chars |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "tenantId": "tenant-uuid",
    "fromRoom": "204",
    "toRoom": "302",
    "previousRent": 800000,
    "newRent": 750000,
    "effectiveDate": "2025-06-15"
  },
  "message": "Rahul transferred from Room 204 to Room 302"
}
```

**Business Rules (Transaction):**
1. Verify new room has vacancy
2. Old room: currentOccupancy -= 1, update status
3. New room: currentOccupancy += 1, update status
4. Update tenant: roomId = new room
5. Update tenant: rentAmount if changed
6. Create room transfer record
7. Notify tenant
8. Create audit log
9. Past payment records retain old room (historical)

---

### 7.7 Bulk Import Tenants

```
POST /api/v1/properties/:propertyId/tenants/import
🔐 OWNER
```

**Request Body:**

```json
{
  "tenants": [
    {
      "name": "Rahul Sharma",
      "phone": "9876543210",
      "email": "rahul@example.com",
      "roomNumber": "101",
      "rentAmount": 800000,
      "depositAmount": 800000,
      "depositStatus": "PAID",
      "moveInDate": "2025-01-15"
    }
  ]
}
```

**Alternative — CSV upload:**

```
POST /api/v1/properties/:propertyId/tenants/import/upload
Content-Type: multipart/form-data

file: tenants.csv
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "total": 20,
    "imported": 18,
    "skipped": 2,
    "errors": [
      { "row": 5, "name": "Amit Kumar", "reason": "Room 105 is fully occupied" },
      { "row": 12, "name": "Sneha Jain", "reason": "Phone number is required" }
    ]
  },
  "message": "18 tenants imported, 2 skipped"
}
```

---

### 7.8 Get Tenant KYC Documents

```
GET /api/v1/tenants/:tenantId/documents
🔐 OWNER
```

**Description:** Get presigned URLs for tenant KYC documents.

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "aadhaarFront": {
      "url": "https://r2.../signed-url?expires=900",
      "uploaded": true,
      "expiresIn": 900
    },
    "aadhaarBack": {
      "url": "https://r2.../signed-url?expires=900",
      "uploaded": true,
      "expiresIn": 900
    },
    "pan": {
      "url": null,
      "uploaded": false
    },
    "otherId": {
      "url": null,
      "uploaded": false
    }
  }
}
```

**Business Rules:**
- Only owner can view KYC documents (not staff, not tenant)
- URLs are presigned with 15-minute expiry
- Audit log created for every document view

---

## 8. Endpoint Reference — Rent Entries

### 8.1 Get Monthly Rent Status

```
GET /api/v1/properties/:propertyId/rent
🔐 OWNER+STAFF
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| month | number | current | Month (1-12) |
| year | number | current | Year |
| status | RentStatus | "all" | PAID, UNPAID, PARTIALLY_PAID, OVERDUE |
| sort | string | "room" | room, name, amount, status |
| order | string | "asc" | asc, desc |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "re-uuid",
      "tenant": {
        "id": "tenant-uuid",
        "name": "Rahul Sharma",
        "phone": "9876543210",
        "roomNumber": "204"
      },
      "month": 6,
      "year": 2025,
      "baseRent": 800000,
      "additionalCharges": [
        { "label": "Mess", "amount": 300000 },
        { "label": "Parking", "amount": 50000 }
      ],
      "utilityCharges": [],
      "lateFee": 0,
      "discount": 0,
      "totalAmount": 1150000,
      "amountPaid": 0,
      "balanceDue": 1150000,
      "status": "UNPAID",
      "dueDate": "2025-06-05",
      "paidDate": null,
      "lastPayment": null
    }
  ],
  "summary": {
    "totalExpected": 2850000,
    "totalCollected": 1920000,
    "totalPending": 930000,
    "collectionRate": 67.4,
    "tenantsPaid": 19,
    "tenantsUnpaid": 5,
    "tenantsOverdue": 3,
    "tenantsTotal": 27
  }
}
```

---

### 8.2 Get Tenant Rent History

```
GET /api/v1/tenants/:tenantId/rent
🔐 OWNER+STAFF
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| year | number | — | Filter by year |
| page | number | 1 | Page |
| limit | number | 12 | Items |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "re-uuid",
      "month": 6,
      "year": 2025,
      "totalAmount": 1150000,
      "amountPaid": 0,
      "balanceDue": 1150000,
      "status": "UNPAID",
      "dueDate": "2025-06-05",
      "paidDate": null,
      "payments": []
    },
    {
      "id": "re-uuid-2",
      "month": 5,
      "year": 2025,
      "totalAmount": 1150000,
      "amountPaid": 1150000,
      "balanceDue": 0,
      "status": "PAID",
      "dueDate": "2025-05-05",
      "paidDate": "2025-05-03",
      "payments": [
        {
          "id": "pay-uuid",
          "amount": 1150000,
          "mode": "UPI",
          "date": "2025-05-03",
          "ref": "UPI/4067123"
        }
      ]
    }
  ],
  "meta": { }
}
```

---

## 9. Endpoint Reference — Payments

### 9.1 Record Payment

```
POST /api/v1/payments
🔐 OWNER+STAFF(MANAGER, ACCOUNTANT)
```

**Request Body:**

```json
{
  "rentEntryId": "re-uuid",
  "tenantId": "tenant-uuid",
  "amount": 1150000,
  "paymentMode": "UPI",
  "paymentDate": "2025-06-05",
  "transactionRef": "UPI/406712345678",
  "notes": ""
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| rentEntryId | UUID | Yes | Must exist, belong to tenant |
| tenantId | UUID | Yes | Must match rentEntry's tenant |
| amount | number | Yes | > 0, in paisa |
| paymentMode | PaymentMode | Yes | Enum value |
| paymentDate | date | Yes | Not in future |
| transactionRef | string | No | Max 100 chars |
| notes | string | No | Max 500 chars |

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "pay-uuid-new",
      "amount": 1150000,
      "paymentMode": "UPI",
      "paymentDate": "2025-06-05"
    },
    "rentEntry": {
      "id": "re-uuid",
      "totalAmount": 1150000,
      "amountPaid": 1150000,
      "balanceDue": 0,
      "status": "PAID"
    },
    "overpayment": null,
    "receiptPrompt": true
  },
  "message": "Payment of ₹11,500 recorded for Rahul (June 2025)"
}
```

**Overpayment Response (amount > balanceDue):**

```json
{
  "success": true,
  "data": {
    "payment": { },
    "rentEntry": {
      "status": "PAID",
      "amountPaid": 1150000,
      "balanceDue": 0
    },
    "overpayment": {
      "excessAmount": 350000,
      "appliedAsAdvance": false,
      "message": "Payment exceeds due amount by ₹3,500"
    }
  }
}
```

**Business Rules (Transaction):**
1. Validate rentEntry exists and belongs to this tenant/property
2. Create payment record
3. Update rentEntry: amountPaid += amount
4. Recalculate balanceDue = totalAmount - amountPaid
5. Update status: if balanceDue = 0 → PAID, if > 0 → PARTIALLY_PAID
6. If fully paid: set paidDate, cancel pending reminders
7. Handle overpayment: flag for advance or record as-is
8. Create audit log
9. Invalidate caches: rent status, dashboard, tenant
10. Queue notification to owner (if recorded by staff)

---

### 9.2 Update Payment

```
PUT /api/v1/payments/:paymentId
🔐 OWNER
```

**Request Body (partial):**

```json
{
  "amount": 1200000,
  "paymentMode": "BANK_TRANSFER",
  "transactionRef": "NEFT/12345",
  "notes": "Corrected amount"
}
```

**Business Rules:**
- Only owner can edit (not staff)
- Cannot edit payments older than 90 days
- If receipt exists for this payment → void old receipt, prompt for new
- Recalculate rent entry after edit
- Audit log with previous values

**Error Responses:**

| Code | Error Code | Condition |
|---|---|---|
| 422 | BUSINESS_RULE_VIOLATED | Payment is older than 90 days |
| 422 | BUSINESS_RULE_VIOLATED | Payment is voided |

---

### 9.3 Delete Payment

```
DELETE /api/v1/payments/:paymentId
🔐 OWNER
```

**Request Body:**

```json
{
  "reason": "Duplicate entry"
}
```

**Business Rules:**
- Only owner can delete
- Cannot delete payments older than 90 days
- Voids associated receipt
- Reverses rent entry: amountPaid -= payment.amount, recalculate status
- Soft voids payment (isVoided = true), doesn't hard delete
- Audit log with full payment details

---

### 9.4 Get Payment Detail

```
GET /api/v1/payments/:paymentId
🔐 OWNER+STAFF
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "pay-uuid",
    "rentEntry": {
      "id": "re-uuid",
      "month": 6,
      "year": 2025,
      "totalAmount": 1150000
    },
    "tenant": {
      "id": "tenant-uuid",
      "name": "Rahul Sharma",
      "roomNumber": "204"
    },
    "amount": 1150000,
    "paymentMode": "UPI",
    "paymentDate": "2025-06-05",
    "transactionRef": "UPI/406712345678",
    "notes": "",
    "isOnlinePayment": false,
    "recordedBy": {
      "id": "owner-uuid",
      "name": "Vijay Sharma"
    },
    "receipt": {
      "id": "receipt-uuid",
      "receiptNumber": "TE-2025-06-00142",
      "pdfUrl": "https://r2.../receipt.pdf"
    },
    "isVoided": false,
    "createdAt": "2025-06-05T10:30:00.000Z"
  }
}
```

---

## 10. Endpoint Reference — Receipts

### 10.1 Generate Receipt

```
POST /api/v1/receipts
🔐 OWNER+STAFF(ACCOUNTANT)
```

**Request Body:**

```json
{
  "paymentId": "pay-uuid"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "receipt-uuid",
    "receiptNumber": "TE-2025-06-00142",
    "pdfUrl": "https://r2.../receipts/2025/06/TE-2025-06-00142.pdf",
    "tenant": {
      "name": "Rahul Sharma",
      "roomNumber": "204"
    },
    "amount": 1150000,
    "month": "June 2025"
  },
  "message": "Receipt TE-2025-06-00142 generated"
}
```

**Business Rules:**
- Generate unique receipt number (sequential)
- Snapshot all data into receiptData JSONB (immutable)
- Generate PDF using React-PDF
- Upload PDF to R2
- Link receipt to payment
- One receipt per payment (reject if receipt already exists, unless voided)

---

### 10.2 Bulk Generate Receipts

```
POST /api/v1/properties/:propertyId/receipts/bulk
🔐 OWNER
```

**Request Body:**

```json
{
  "month": 6,
  "year": 2025,
  "sendToTenants": true,
  "sendVia": ["EMAIL"]
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "total": 27,
    "alreadyGenerated": 5,
    "newlyGenerated": 19,
    "skipped": 3,
    "skippedReasons": [
      { "tenant": "Amit Kumar", "reason": "No payment recorded for June" }
    ],
    "sentToTenants": 15,
    "notSent": 4,
    "notSentReasons": [
      { "tenant": "Priya Singh", "reason": "No email address" }
    ],
    "downloadUrl": "https://r2.../bulk/receipts-june-2025.pdf",
    "zipUrl": "https://r2.../bulk/receipts-june-2025.zip"
  },
  "message": "19 receipts generated, 15 sent to tenants"
}
```

**Business Rules:**
- Only generate for tenants with PAID status for that month
- Skip tenants who already have receipts
- Compile all into single PDF + ZIP
- Send to tenants who have email (and opted in)
- This may be a long operation → queue as background job, return job ID for polling

---

### 10.3 Download Receipt PDF

```
GET /api/v1/receipts/:receiptId/download
🔐 OWNER+STAFF+TENANT
```

**Response:** PDF file stream with appropriate headers.

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="TE-2025-06-00142.pdf"
```

**Business Rules:**
- Owner and staff can download any receipt for their property
- Tenant can download only their own receipts
- Returns presigned URL redirect or streams PDF directly

---

### 10.4 Send Receipt to Tenant

```
POST /api/v1/receipts/:receiptId/send
🔐 OWNER+STAFF(ACCOUNTANT)
```

**Request Body:**

```json
{
  "channels": ["EMAIL", "SMS"]
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "sentVia": ["EMAIL"],
    "notSent": ["SMS"],
    "notSentReasons": {
      "SMS": "SMS not enabled on current plan"
    }
  },
  "message": "Receipt sent to Rahul via email"
}
```

---

### 10.5 Get Annual Summary

```
GET /api/v1/tenants/:tenantId/receipts/annual
🔐 OWNER+STAFF+TENANT
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| financialYear | string | current | "2024-25" format |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "financialYear": "2024-25",
    "tenant": {
      "name": "Rahul Sharma",
      "roomNumber": "204"
    },
    "owner": {
      "name": "Vijay Sharma",
      "pan": "ABCPS1234D"
    },
    "property": {
      "name": "Sharma PG for Boys",
      "address": "45, MG Road, Koramangala, Bangalore 560034"
    },
    "months": [
      { "month": "April 2024", "amount": 1150000, "status": "PAID", "paidDate": "2024-04-03" },
      { "month": "May 2024", "amount": 1150000, "status": "PAID", "paidDate": "2024-05-02" }
    ],
    "totalPaid": 13800000,
    "pdfUrl": "https://r2.../annual/2024-25/tenant-uuid.pdf"
  }
}
```

---

## 11. Endpoint Reference — Maintenance

### 11.1 List Maintenance Requests

```
GET /api/v1/properties/:propertyId/maintenance
🔐 OWNER+STAFF
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | Page |
| limit | number | 25 | Items |
| status | MaintenanceStatus | "all" | NEW, IN_PROGRESS, RESOLVED, etc. |
| category | MaintenanceCategory | — | PLUMBING, ELECTRICAL, etc. |
| urgency | MaintenanceUrgency | — | LOW, MEDIUM, HIGH, EMERGENCY |
| tenantId | UUID | — | Filter by tenant |
| sort | string | "createdAt" | createdAt, urgency, status |
| order | string | "desc" | asc, desc |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "mr-uuid",
      "requestNumber": "MR-00042",
      "tenant": {
        "id": "tenant-uuid",
        "name": "Rahul Sharma",
        "roomNumber": "204",
        "phone": "9876543210"
      },
      "category": "PLUMBING",
      "description": "Bathroom tap is leaking continuously",
      "photos": ["https://r2.../photo1.webp"],
      "urgency": "HIGH",
      "status": "NEW",
      "assignedWorkerName": null,
      "assignedWorkerPhone": null,
      "createdAt": "2025-06-05T10:30:00.000Z",
      "updatedAt": "2025-06-05T10:30:00.000Z"
    }
  ],
  "summary": {
    "new": 3,
    "inProgress": 2,
    "resolved": 15,
    "total": 20
  }
}
```

---

### 11.2 Create Maintenance Request (Tenant)

```
POST /api/v1/maintenance
🔐 TENANT
```

**Request Body:**

```json
{
  "category": "PLUMBING",
  "description": "Bathroom tap is leaking continuously. Water pooling on floor.",
  "urgency": "HIGH",
  "preferredTime": "evening"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| category | MaintenanceCategory | Yes | Enum |
| description | string | Yes | 10-2000 chars |
| urgency | MaintenanceUrgency | Yes | Enum |
| preferredTime | string | No | morning, afternoon, evening, anytime |

**Note:** Photos uploaded separately via /api/v1/upload, URLs attached to request.

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "mr-uuid",
    "requestNumber": "MR-00042",
    "status": "NEW"
  },
  "message": "Request #MR-00042 submitted. We'll notify you on updates."
}
```

**Business Rules:**
- Auto-assign request number (sequential: MR-NNNNN)
- Tenant is auto-determined from auth token
- Property is auto-determined from tenant's property
- Notify owner via in-app + SMS/email
- Create initial status change record

---

### 11.3 Update Request Status (Owner)

```
PUT /api/v1/maintenance/:requestId
🔐 OWNER+STAFF(MANAGER, WARDEN)
```

**Request Body:**

```json
{
  "status": "IN_PROGRESS",
  "assignedWorkerName": "Raju",
  "assignedWorkerPhone": "9876543215",
  "comment": "Plumber will visit today evening between 5-7 PM",
  "isInternalNote": false
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| status | MaintenanceStatus | No | New status |
| assignedWorkerName | string | No | Worker name |
| assignedWorkerPhone | string | No | Worker phone |
| comment | string | No | Comment/note |
| isInternalNote | boolean | No | If true, not visible to tenant |

**Business Rules:**
- Status change creates MaintenanceStatusChange record
- Comment creates MaintenanceComment record
- Tenant notified on every status change and non-internal comment
- RESOLVED → tenant gets "Confirm fixed?" prompt
- REJECTED requires reason in comment

---

### 11.4 Add Comment to Request

```
POST /api/v1/maintenance/:requestId/comments
🔐 OWNER+STAFF+TENANT
```

**Request Body:**

```json
{
  "content": "It's been 2 days, any update?",
  "isInternal": false
}
```

**Business Rules:**
- Tenant can only add non-internal comments
- Owner/staff can add internal notes (not visible to tenant)
- Notify other party on new comment

---

### 11.5 Close / Reopen Request (Tenant)

```
POST /api/v1/maintenance/:requestId/close
🔐 TENANT
```

```json
{
  "action": "close"
}
```

OR

```json
{
  "action": "reopen",
  "reason": "Issue came back after 2 days"
}
```

**Business Rules:**
- Close: status → CLOSED
- Reopen: status → IN_PROGRESS, notify owner
- Only the tenant who raised it can close/reopen
- Auto-close after 7 days if status is RESOLVED and no response

---

## 12. Endpoint Reference — Reminders

### 12.1 Get Reminder Configuration

```
GET /api/v1/properties/:propertyId/reminders/config
🔐 OWNER
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "preDue": { "enabled": true, "daysBefore": 3 },
    "onDue": { "enabled": true },
    "overdue": { "enabled": true, "intervalDays": 3, "maxDays": 30 },
    "channels": { "email": true, "sms": true, "whatsapp": false },
    "sendTime": "10:00",
    "tone": "friendly",
    "customNote": "Pay via UPI to 9876543210@paytm"
  }
}
```

---

### 12.2 Update Reminder Configuration

```
PUT /api/v1/properties/:propertyId/reminders/config
🔐 OWNER
```

**Request Body:** Full or partial reminder config object.

---

### 12.3 Send Manual Reminder

```
POST /api/v1/reminders/send
🔐 OWNER+STAFF(MANAGER)
```

**Request Body:**

```json
{
  "tenantIds": ["tenant-uuid-1", "tenant-uuid-2"],
  "channels": ["SMS", "EMAIL"],
  "customMessage": null
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "sent": 2,
    "failed": 0,
    "details": [
      { "tenantId": "tenant-uuid-1", "name": "Rahul", "sms": "sent", "email": "sent" },
      { "tenantId": "tenant-uuid-2", "name": "Priya", "sms": "sent", "email": "no_email" }
    ]
  },
  "message": "Reminders sent to 2 tenants"
}
```

**Business Rules:**
- Rate limit: max 5 manual reminders per tenant per day
- SMS only available on paid plans
- Log each reminder in reminder_logs
- Cannot send to tenants with PAID status this month

---

### 12.4 Get Reminder Logs

```
GET /api/v1/properties/:propertyId/reminders/logs
🔐 OWNER
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| tenantId | UUID | — | Filter by tenant |
| type | string | "all" | pre_due, on_due, overdue, manual |
| channel | NotificationChannel | — | EMAIL, SMS, WHATSAPP |
| dateFrom | date | — | Start date |
| dateTo | date | — | End date |
| page | number | 1 | Page |
| limit | number | 25 | Items |

---

## 13. Endpoint Reference — Announcements

### 13.1 List Announcements

```
GET /api/v1/properties/:propertyId/announcements
🔐 OWNER+STAFF
```

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "ann-uuid",
      "title": "Water Supply Disruption",
      "body": "Water supply off Sunday 10am-2pm for tank cleaning.",
      "category": "MAINTENANCE",
      "targetType": "all",
      "isPinned": true,
      "isActive": true,
      "readCount": 18,
      "totalTargeted": 27,
      "createdAt": "2025-06-04T08:00:00.000Z"
    }
  ]
}
```

---

### 13.2 Create Announcement

```
POST /api/v1/properties/:propertyId/announcements
🔐 OWNER+STAFF(MANAGER, WARDEN)
```

**Request Body:**

```json
{
  "title": "Water Supply Disruption",
  "body": "Water supply will be off on Sunday 8th June from 10 AM to 2 PM due to tank cleaning. Please store water accordingly.",
  "category": "MAINTENANCE",
  "targetType": "all",
  "targetValue": [],
  "isPinned": true,
  "notifyTenants": true
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| title | string | Yes | 5-200 chars |
| body | string | Yes | 10-5000 chars |
| category | AnnouncementCategory | Yes | Enum |
| targetType | string | No | "all", "floor", "rooms" |
| targetValue | string[] | No | Floor names or room IDs |
| isPinned | boolean | No | Default false |
| notifyTenants | boolean | No | Default true |

---

### 13.3 Update Announcement

```
PUT /api/v1/announcements/:announcementId
🔐 OWNER+STAFF
```

---

### 13.4 Delete Announcement

```
DELETE /api/v1/announcements/:announcementId
🔐 OWNER
```

---

## 14. Endpoint Reference — Utility Billing

### 14.1 Get Utility Readings

```
GET /api/v1/properties/:propertyId/utilities
🔐 OWNER+STAFF(ACCOUNTANT)
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| month | number | current | Month |
| year | number | current | Year |
| type | UtilityType | "ELECTRICITY" | Utility type |

---

### 14.2 Submit Meter Readings

```
POST /api/v1/properties/:propertyId/utilities
🔐 OWNER+STAFF(ACCOUNTANT)
```

**Request Body:**

```json
{
  "utilityType": "ELECTRICITY",
  "month": 6,
  "year": 2025,
  "billingModel": "INDIVIDUAL_METER",
  "ratePerUnit": 800,
  "readings": [
    { "roomId": "room-uuid-101", "previousReading": 4520, "currentReading": 4650 },
    { "roomId": "room-uuid-102", "previousReading": 3210, "currentReading": 3380 },
    { "roomId": "room-uuid-103", "previousReading": 2890, "currentReading": 2980 }
  ]
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "totalRooms": 3,
    "totalUnits": 390,
    "totalCharge": 312000,
    "readings": [
      { "room": "101", "units": 130, "charge": 104000 },
      { "room": "102", "units": 170, "charge": 136000 },
      { "room": "103", "units": 90, "charge": 72000 }
    ],
    "appliedToRentEntries": true
  },
  "message": "Electricity charges applied to 3 tenants for June 2025"
}
```

**Business Rules:**
- currentReading must be ≥ previousReading
- previousReading auto-fills from last month's current
- Charges auto-added to corresponding rent entries as utilityCharges
- Recalculate totalAmount and balanceDue on affected rent entries
- If rent entry doesn't exist for that month, create it first

---

## 15. Endpoint Reference — Agreements

### 15.1 Generate Agreement

```
POST /api/v1/tenants/:tenantId/agreements
🔐 OWNER
```

**Request Body:**

```json
{
  "templateType": "pg",
  "state": "karnataka",
  "startDate": "2025-06-01",
  "endDate": "2026-05-31",
  "duration": "12 months",
  "customClauses": [
    "No guests allowed after 10 PM",
    "No cooking in room",
    "1 month notice period for vacating"
  ]
}
```

**Success Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "agr-uuid",
    "pdfUrl": "https://r2.../agreements/agr-uuid.pdf",
    "status": "draft"
  },
  "message": "Agreement generated for Rahul Sharma"
}
```

---

### 15.2 List Agreements

```
GET /api/v1/tenants/:tenantId/agreements
🔐 OWNER+TENANT
```

---

### 15.3 Download Agreement PDF

```
GET /api/v1/agreements/:agreementId/download
🔐 OWNER+TENANT
```

---

## 16. Endpoint Reference — Notifications

### 16.1 Get Notifications

```
GET /api/v1/notifications
🔐 OWNER / TENANT / STAFF
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| page | number | 1 | Page |
| limit | number | 20 | Items |
| isRead | boolean | — | Filter read/unread |

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "notif-uuid",
      "type": "PAYMENT_RECEIVED",
      "title": "Payment Received",
      "body": "Rahul Sharma (Room 204) paid ₹11,500 for June 2025",
      "data": {
        "tenantId": "tenant-uuid",
        "amount": 1150000
      },
      "actionUrl": "/properties/prop-uuid/tenants/tenant-uuid",
      "isRead": false,
      "createdAt": "2025-06-05T10:30:00.000Z"
    }
  ],
  "meta": { },
  "unreadCount": 5
}
```

---

### 16.2 Mark Notification as Read

```
PUT /api/v1/notifications/:notificationId/read
🔐 OWNER / TENANT / STAFF
```

---

### 16.3 Mark All as Read

```
PUT /api/v1/notifications/read-all
🔐 OWNER / TENANT / STAFF
```

---

### 16.4 Get Unread Count

```
GET /api/v1/notifications/unread-count
🔐 OWNER / TENANT / STAFF
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

---

## 17. Endpoint Reference — Reports & Analytics

### 17.1 Dashboard Stats

```
GET /api/v1/properties/:propertyId/dashboard
🔐 OWNER+STAFF
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "financial": {
      "month": 6,
      "year": 2025,
      "expected": 2850000,
      "collected": 1920000,
      "pending": 930000,
      "collectionRate": 67.4,
      "tenantsPaid": 19,
      "tenantsUnpaid": 5,
      "tenantsOverdue": 3
    },
    "occupancy": {
      "totalRooms": 15,
      "totalBeds": 30,
      "occupiedBeds": 27,
      "vacantBeds": 3,
      "occupancyRate": 90.0
    },
    "actionItems": [
      { "type": "overdue", "count": 3, "label": "tenants overdue on rent" },
      { "type": "maintenance", "count": 2, "label": "new maintenance requests" },
      { "type": "notice", "count": 1, "label": "tenant on notice period" },
      { "type": "vacant", "count": 3, "label": "vacant beds available" }
    ],
    "recentActivity": [
      {
        "type": "payment",
        "description": "Rahul (Room 204) paid ₹11,500",
        "timestamp": "2025-06-05T10:30:00.000Z"
      },
      {
        "type": "maintenance",
        "description": "New request from Priya (Room 301): Electrical",
        "timestamp": "2025-06-05T09:15:00.000Z"
      }
    ]
  }
}
```

---

### 17.2 Monthly Financial Report

```
GET /api/v1/properties/:propertyId/reports/monthly
🔐 OWNER+STAFF(ACCOUNTANT)
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| month | number | current | Month |
| year | number | current | Year |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "period": "June 2025",
    "income": {
      "totalBaseRent": 2160000,
      "totalAdditionalCharges": 540000,
      "totalUtilityCharges": 150000,
      "totalLateFees": 25000,
      "grossIncome": 2875000,
      "totalDiscounts": 25000,
      "netExpected": 2850000,
      "totalCollected": 1920000,
      "totalOutstanding": 930000,
      "collectionRate": 67.4
    },
    "payments": {
      "cash": 480000,
      "upi": 1200000,
      "bankTransfer": 240000,
      "online": 0,
      "total": 1920000
    },
    "occupancy": {
      "averageOccupancy": 90.0,
      "newTenants": 2,
      "vacatedTenants": 1
    },
    "expenses": {
      "repairs": 150000,
      "staffSalary": 300000,
      "electricity": 200000,
      "other": 50000,
      "totalExpenses": 700000
    },
    "profitLoss": {
      "totalIncome": 1920000,
      "totalExpenses": 700000,
      "netProfit": 1220000
    },
    "defaulters": [
      { "name": "Amit Kumar", "room": "102", "amountDue": 1150000, "daysOverdue": 15 }
    ],
    "comparisonWithLastMonth": {
      "incomeChange": 5.2,
      "collectionRateChange": -2.1,
      "occupancyChange": 0
    }
  }
}
```

---

### 17.3 Annual Financial Report

```
GET /api/v1/properties/:propertyId/reports/annual
🔐 OWNER+STAFF(ACCOUNTANT)
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| financialYear | string | current | "2024-25" format |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "financialYear": "2024-25",
    "monthlyBreakdown": [
      { "month": "Apr 2024", "expected": 2700000, "collected": 2500000, "expenses": 600000 }
    ],
    "annualSummary": {
      "totalExpected": 33600000,
      "totalCollected": 31200000,
      "totalExpenses": 7800000,
      "netProfit": 23400000,
      "averageCollectionRate": 92.8,
      "averageOccupancy": 88.5
    }
  }
}
```

---

### 17.4 Export Report

```
GET /api/v1/properties/:propertyId/reports/export
🔐 OWNER+STAFF(ACCOUNTANT)
```

**Query Parameters:**

| Param | Type | Required | Description |
|---|---|---|---|
| type | string | Yes | "monthly", "annual", "tenants", "payments", "defaulters" |
| format | string | Yes | "csv", "excel", "pdf" |
| month | number | Conditional | For monthly reports |
| year | number | Conditional | For monthly/annual |

**Response:** File download with appropriate Content-Type header.

---

### 17.5 Analytics Charts Data

```
GET /api/v1/properties/:propertyId/analytics
🔐 OWNER
```

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| period | string | "12months" | "6months", "12months", "all" |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "incomeChart": [
      { "month": "Jul 2024", "expected": 2700000, "collected": 2500000 },
      { "month": "Aug 2024", "expected": 2700000, "collected": 2650000 }
    ],
    "occupancyChart": [
      { "month": "Jul 2024", "rate": 85.0 },
      { "month": "Aug 2024", "rate": 88.0 }
    ],
    "collectionChart": [
      { "month": "Jul 2024", "rate": 92.6 },
      { "month": "Aug 2024", "rate": 98.1 }
    ],
    "paymentModeChart": {
      "CASH": 4800000,
      "UPI": 12000000,
      "BANK_TRANSFER": 2400000,
      "ONLINE": 0
    },
    "expenseChart": {
      "repairs": 1500000,
      "staffSalary": 3600000,
      "electricity": 2400000,
      "other": 600000
    }
  }
}
```

---

## 18. Endpoint Reference — Subscriptions

### 18.1 Get Current Plan

```
GET /api/v1/subscription
🔐 OWNER
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "plan": "PRO",
    "status": "ACTIVE",
    "billingCycle": "ANNUAL",
    "currentPeriodStart": "2025-01-01",
    "currentPeriodEnd": "2025-12-31",
    "limits": {
      "maxProperties": 3,
      "maxTenantsPerProperty": 100,
      "maxStaffAccounts": 3,
      "smsEnabled": true,
      "whatsappEnabled": false,
      "onlinePaymentsEnabled": true,
      "reportsEnabled": true,
      "removeBranding": true
    },
    "usage": {
      "properties": 2,
      "tenants": 45,
      "staff": 1
    }
  }
}
```

---

### 18.2 Get Plan Options

```
GET /api/v1/subscription/plans
🔓 PUBLIC
```

**Success Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "plan": "FREE",
      "monthlyPrice": 0,
      "annualPrice": 0,
      "features": {
        "maxProperties": 1,
        "maxTenantsPerProperty": 5,
        "maxStaffAccounts": 0,
        "emailReminders": true,
        "smsReminders": false,
        "onlinePayments": false,
        "reports": false,
        "branding": true
      }
    },
    {
      "plan": "STARTER",
      "monthlyPrice": 29900,
      "annualPrice": 299900,
      "features": { }
    },
    {
      "plan": "PRO",
      "monthlyPrice": 69900,
      "annualPrice": 699900,
      "features": { }
    },
    {
      "plan": "BUSINESS",
      "monthlyPrice": 149900,
      "annualPrice": 1499900,
      "features": { }
    }
  ]
}
```

---

### 18.3 Upgrade / Change Plan

```
POST /api/v1/subscription/upgrade
🔐 OWNER
```

**Request Body:**

```json
{
  "plan": "PRO",
  "billingCycle": "ANNUAL"
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_abc123",
    "amount": 699900,
    "currency": "INR",
    "plan": "PRO",
    "billingCycle": "ANNUAL"
  },
  "message": "Complete payment to activate Pro plan"
}
```

**Business Rules:**
- Creates Razorpay order
- On successful payment (via webhook), activate plan
- Pro-rated for mid-cycle upgrades
- Downgrade warnings if usage exceeds lower plan limits

---

### 18.4 Cancel Subscription

```
POST /api/v1/subscription/cancel
🔐 OWNER
```

**Request Body:**

```json
{
  "reason": "Too expensive",
  "feedback": "Would use if cheaper"
}
```

**Business Rules:**
- Cancellation effective at end of current billing period
- Data retained for 90 days after expiry
- Downgraded to FREE plan after period ends
- Audit log created

---

### 18.5 Get Invoices

```
GET /api/v1/subscription/invoices
🔐 OWNER
```

---

## 19. Endpoint Reference — Staff

### 19.1 List Staff

```
GET /api/v1/staff
🔐 OWNER
```

---

### 19.2 Invite Staff

```
POST /api/v1/staff/invite
🔐 OWNER
```

**Request Body:**

```json
{
  "name": "Ramu",
  "phone": "9876543222",
  "email": null,
  "role": "WARDEN",
  "propertyIds": ["prop-uuid-1"]
}
```

---

### 19.3 Update Staff Role

```
PUT /api/v1/staff/:staffAssignmentId
🔐 OWNER
```

---

### 19.4 Remove Staff

```
DELETE /api/v1/staff/:staffAssignmentId
🔐 OWNER
```

---

## 20. Endpoint Reference — File Uploads

### 20.1 Get Upload URL (Presigned)

```
POST /api/v1/upload/presigned-url
🔐 OWNER+STAFF+TENANT
```

**Request Body:**

```json
{
  "fileName": "aadhaar-front.jpg",
  "fileType": "image/jpeg",
  "fileSize": 2048576,
  "category": "kyc",
  "entityId": "tenant-uuid"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| fileName | string | Yes | Valid file name |
| fileType | string | Yes | image/jpeg, image/png, image/webp, application/pdf |
| fileSize | number | Yes | Max 5MB for images, 10MB for PDFs |
| category | string | Yes | "kyc", "property_photo", "room_photo", "maintenance", "avatar" |
| entityId | string | No | Related entity ID |

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "uploadUrl": "https://r2.../presigned-upload-url?...",
    "fileKey": "tenants/tenant-uuid/documents/aadhaar-front-abc123.webp",
    "publicUrl": "https://r2.../tenants/tenant-uuid/documents/aadhaar-front-abc123.webp",
    "expiresIn": 900
  }
}
```

**Business Rules:**
- Validate file type is in allowed list
- Validate file size within limits
- Generate unique file key (UUID suffix prevents collisions)
- Presigned URL valid for 15 minutes
- After upload, client calls confirm endpoint

---

### 20.2 Confirm Upload

```
POST /api/v1/upload/confirm
🔐 OWNER+STAFF+TENANT
```

**Request Body:**

```json
{
  "fileKey": "tenants/tenant-uuid/documents/aadhaar-front-abc123.webp",
  "category": "kyc",
  "entityType": "tenant",
  "entityId": "tenant-uuid",
  "field": "aadhaarFrontUrl"
}
```

**Business Rules:**
- Verify file exists in R2
- Update entity record with file URL
- For images: trigger background thumbnail generation
- Audit log for KYC document uploads

---

## 21. Endpoint Reference — Tenant Portal

### 21.1 Tenant Portal Home

```
GET /api/v1/portal/home
🔐 TENANT
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "tenant": {
      "name": "Rahul Sharma",
      "roomNumber": "204",
      "property": {
        "name": "Sharma PG for Boys",
        "address": "45, MG Road, Koramangala"
      }
    },
    "currentRent": {
      "month": "June 2025",
      "totalAmount": 1150000,
      "amountPaid": 0,
      "balanceDue": 1150000,
      "status": "UNPAID",
      "dueDate": "2025-06-05",
      "breakdown": [
        { "label": "Base Rent", "amount": 800000 },
        { "label": "Mess", "amount": 300000 },
        { "label": "Parking", "amount": 50000 }
      ],
      "payOnlineEnabled": false
    },
    "recentActivity": [
      { "type": "receipt", "description": "May receipt generated", "date": "2025-05-05" },
      { "type": "maintenance", "description": "Request #42 resolved", "date": "2025-05-28" }
    ],
    "unreadAnnouncements": 2,
    "openMaintenanceRequests": 1
  }
}
```

---

### 21.2 Tenant Payment History

```
GET /api/v1/portal/payments
🔐 TENANT
```

Returns only authenticated tenant's payment data.

---

### 21.3 Tenant Receipts

```
GET /api/v1/portal/receipts
🔐 TENANT
```

Returns only authenticated tenant's receipts.

---

### 21.4 Tenant Maintenance Requests

```
GET /api/v1/portal/maintenance
🔐 TENANT
```

Returns only authenticated tenant's maintenance requests.

---

### 21.5 Tenant Announcements

```
GET /api/v1/portal/announcements
🔐 TENANT
```

Returns announcements targeted at this tenant's property/floor/room.

---

### 21.6 Tenant Profile

```
GET /api/v1/portal/profile
🔐 TENANT
```

```
PUT /api/v1/portal/profile
🔐 TENANT
```

Tenant can update: name, email, phone (with OTP re-verification), avatar.
Tenant CANNOT update: room, rent, status, KYC.

---

### 21.7 Initiate Online Payment (Phase 2)

```
POST /api/v1/portal/pay
🔐 TENANT
```

**Request Body:**

```json
{
  "rentEntryId": "re-uuid",
  "amount": 1150000
}
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "razorpayOrderId": "order_xyz789",
    "amount": 1150000,
    "currency": "INR",
    "tenantName": "Rahul Sharma",
    "propertyName": "Sharma PG for Boys",
    "month": "June 2025",
    "razorpayKeyId": "rzp_live_xxxxx"
  }
}
```

**Business Rules:**
- Create Razorpay order
- Minimum payment: ₹500 (50000 paisa)
- Return Razorpay key and order details for checkout
- Actual payment confirmation happens via webhook (endpoint 23.1)

---

## 22. Endpoint Reference — Vacancy & Enquiries

### 22.1 Get Public Listing

```
GET /api/v1/listings/:slug
🔓 PUBLIC
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "property": {
      "name": "Sharma PG for Boys",
      "type": "PG",
      "address": "45, MG Road, Koramangala, Bangalore 560034",
      "genderPolicy": "BOYS_ONLY",
      "amenities": ["WiFi", "AC", "Hot Water", "Parking", "Mess"],
      "photos": ["https://r2.../photo1.webp", "https://r2.../photo2.webp"],
      "location": { "lat": 12.9352, "lng": 77.6245 }
    },
    "availableRooms": [
      {
        "id": "room-uuid",
        "roomNumber": "302",
        "type": "DOUBLE",
        "rentPerBed": 750000,
        "availableBeds": 1,
        "amenities": ["AC", "Attached Bathroom"]
      }
    ],
    "totalVacantBeds": 4
  }
}
```

**Business Rules:**
- Only show rooms with vacancy
- Only show properties with listing enabled
- SEO-optimized (server-rendered by Next.js)
- No auth required — public page

---

### 22.2 Submit Enquiry

```
POST /api/v1/listings/:slug/enquiry
🔓 PUBLIC
```

**Request Body:**

```json
{
  "name": "Suresh Kumar",
  "phone": "9876543299",
  "email": "suresh@example.com",
  "interestedRoomId": "room-uuid",
  "preferredMoveIn": "2025-07-01",
  "message": "Interested in double sharing room"
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| name | string | Yes | 2-100 chars |
| phone | string | Yes | 10 digits |
| email | string | No | Valid email |
| interestedRoomId | UUID | No | Must exist in property |
| preferredMoveIn | date | No | Future date |
| message | string | No | Max 500 chars |

**Success Response (201):**

```json
{
  "success": true,
  "message": "Thank you! The owner will contact you shortly."
}
```

**Business Rules:**
- Create enquiry record
- Notify owner via in-app + SMS + email
- Rate limit: 3 enquiries per phone per property per day
- No auth required

---

### 22.3 Manage Enquiries (Owner)

```
GET /api/v1/properties/:propertyId/enquiries
🔐 OWNER
```

```
PUT /api/v1/enquiries/:enquiryId
🔐 OWNER
```

**Update Body:**

```json
{
  "status": "contacted",
  "ownerNotes": "Called, will visit tomorrow"
}
```

---

## 23. Endpoint Reference — Webhooks

### 23.1 Razorpay Payment Webhook

```
POST /api/v1/webhooks/razorpay
🔒 WEBHOOK (Razorpay signature verification)
```

**Description:** Called by Razorpay when a payment succeeds or fails.

**Verification:**
```
X-Razorpay-Signature header verified against webhook secret
using HMAC SHA256
```

**Payload (from Razorpay):**

```json
{
  "entity": "event",
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_razorpay_id",
        "order_id": "order_razorpay_id",
        "amount": 1150000,
        "currency": "INR",
        "status": "captured",
        "method": "upi"
      }
    }
  }
}
```

**Processing on `payment.captured`:**
1. Verify Razorpay signature
2. Find rent entry by order ID (stored when order was created)
3. Create payment record (isOnlinePayment: true)
4. Update rent entry status
5. Generate receipt automatically
6. Notify owner
7. Notify tenant (confirmation)
8. Invalidate caches

**Processing on `payment.failed`:**
1. Log failure reason
2. Notify tenant: "Payment failed. Please try again."
3. No changes to rent entry

**Response:** 200 OK (Razorpay expects 2xx to stop retrying)

```json
{
  "status": "ok"
}
```

---

### 23.2 Razorpay Subscription Webhook

```
POST /api/v1/webhooks/razorpay/subscription
🔒 WEBHOOK
```

**Events handled:**
- `subscription.charged` → Renew subscription, create invoice
- `subscription.pending` → Mark as PAST_DUE, notify owner
- `subscription.cancelled` → Mark as CANCELLED
- `subscription.halted` → Mark as EXPIRED, downgrade to FREE

---

## 24. Endpoint Reference — Admin (Internal)

### 24.1 Platform Stats

```
GET /api/v1/admin/stats
🔐 ADMIN
```

**Success Response (200):**

```json
{
  "success": true,
  "data": {
    "users": {
      "totalOwners": 1250,
      "totalTenants": 18500,
      "newOwnersThisWeek": 45,
      "newOwnersThisMonth": 180
    },
    "properties": {
      "total": 1180,
      "active": 1120
    },
    "revenue": {
      "mrr": 345000,
      "arr": 4140000,
      "activeSubscriptions": {
        "free": 800,
        "starter": 250,
        "pro": 120,
        "business": 10
      }
    },
    "platform": {
      "rentTrackedThisMonth": 450000000,
      "receiptsGeneratedThisMonth": 12500,
      "reminderseSentThisMonth": 35000
    }
  }
}
```

---

### 24.2 Search Users

```
GET /api/v1/admin/users
🔐 ADMIN
```

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| search | string | Search by name, phone, email |
| role | UserRole | Filter by role |
| plan | PlanType | Filter by plan |
| page | number | Page |
| limit | number | Items |

---

### 24.3 Get User Detail (Admin View)

```
GET /api/v1/admin/users/:userId
🔐 ADMIN
```

---

### 24.4 Impersonate User

```
POST /api/v1/admin/impersonate/:userId
🔐 ADMIN
```

**Business Rules:**
- Creates audit log: "Admin [name] impersonated user [name]"
- Returns access token for that user
- All actions during impersonation are logged with admin context
- Impersonation sessions limited to 1 hour

---

### 24.5 Change User Plan (Manual)

```
PUT /api/v1/admin/users/:userId/plan
🔐 ADMIN
```

**Request Body:**

```json
{
  "plan": "PRO",
  "reason": "Beta tester reward",
  "durationMonths": 3
}
```

---

## 25. Complete Endpoint Map

### Summary Table

```
AUTHENTICATION (6 endpoints):
  POST   /auth/send-otp
  POST   /auth/verify-otp
  PUT    /auth/complete-profile
  POST   /auth/refresh
  POST   /auth/logout
  GET    /auth/me

PROPERTIES (5 endpoints):
  GET    /properties
  GET    /properties/:id
  POST   /properties
  PUT    /properties/:id
  DELETE /properties/:id

ROOMS (6 endpoints):
  GET    /properties/:id/rooms
  POST   /properties/:id/rooms
  POST   /properties/:id/rooms/bulk
  GET    /rooms/:id
  PUT    /properties/:id/rooms/:id
  DELETE /properties/:id/rooms/:id

TENANTS (9 endpoints):
  GET    /properties/:id/tenants
  GET    /tenants/:id
  POST   /properties/:id/tenants
  PUT    /tenants/:id
  POST   /tenants/:id/vacate
  POST   /tenants/:id/transfer
  POST   /properties/:id/tenants/import
  POST   /properties/:id/tenants/import/upload
  GET    /tenants/:id/documents

RENT ENTRIES (2 endpoints):
  GET    /properties/:id/rent
  GET    /tenants/:id/rent

PAYMENTS (4 endpoints):
  POST   /payments
  GET    /payments/:id
  PUT    /payments/:id
  DELETE /payments/:id

RECEIPTS (6 endpoints):
  POST   /receipts
  POST   /properties/:id/receipts/bulk
  GET    /receipts/:id/download
  POST   /receipts/:id/send
  GET    /tenants/:id/receipts
  GET    /tenants/:id/receipts/annual

MAINTENANCE (6 endpoints):
  GET    /properties/:id/maintenance
  GET    /maintenance/:id
  POST   /maintenance
  PUT    /maintenance/:id
  POST   /maintenance/:id/comments
  POST   /maintenance/:id/close

REMINDERS (4 endpoints):
  GET    /properties/:id/reminders/config
  PUT    /properties/:id/reminders/config
  POST   /reminders/send
  GET    /properties/:id/reminders/logs

ANNOUNCEMENTS (4 endpoints):
  GET    /properties/:id/announcements
  POST   /properties/:id/announcements
  PUT    /announcements/:id
  DELETE /announcements/:id

UTILITY BILLING (2 endpoints):
  GET    /properties/:id/utilities
  POST   /properties/:id/utilities

AGREEMENTS (3 endpoints):
  POST   /tenants/:id/agreements
  GET    /tenants/:id/agreements
  GET    /agreements/:id/download

NOTIFICATIONS (4 endpoints):
  GET    /notifications
  PUT    /notifications/:id/read
  PUT    /notifications/read-all
  GET    /notifications/unread-count

REPORTS (5 endpoints):
  GET    /properties/:id/dashboard
  GET    /properties/:id/reports/monthly
  GET    /properties/:id/reports/annual
  GET    /properties/:id/reports/export
  GET    /properties/:id/analytics

SUBSCRIPTIONS (5 endpoints):
  GET    /subscription
  GET    /subscription/plans
  POST   /subscription/upgrade
  POST   /subscription/cancel
  GET    /subscription/invoices

STAFF (4 endpoints):
  GET    /staff
  POST   /staff/invite
  PUT    /staff/:id
  DELETE /staff/:id

FILE UPLOADS (2 endpoints):
  POST   /upload/presigned-url
  POST   /upload/confirm

TENANT PORTAL (8 endpoints):
  GET    /portal/home
  GET    /portal/payments
  GET    /portal/receipts
  GET    /portal/maintenance
  GET    /portal/announcements
  GET    /portal/profile
  PUT    /portal/profile
  POST   /portal/pay

VACANCY & ENQUIRIES (4 endpoints):
  GET    /listings/:slug
  POST   /listings/:slug/enquiry
  GET    /properties/:id/enquiries
  PUT    /enquiries/:id

WEBHOOKS (2 endpoints):
  POST   /webhooks/razorpay
  POST   /webhooks/razorpay/subscription

ADMIN (5 endpoints):
  GET    /admin/stats
  GET    /admin/users
  GET    /admin/users/:id
  POST   /admin/impersonate/:id
  PUT    /admin/users/:id/plan

HEALTH (1 endpoint):
  GET    /health

────────────────────────────
TOTAL: 90 endpoints
────────────────────────────

MVP ENDPOINTS (Phase 1): ~45
Phase 2 ENDPOINTS: ~25
Phase 3 ENDPOINTS: ~20
```

---

## 26. Rate Limiting per Endpoint

### Rate Limit Configuration

| Endpoint Group | Limit | Window | Scope |
|---|---|---|---|
| POST /auth/send-otp | 3 requests | per hour | per phone |
| POST /auth/verify-otp | 5 requests | per OTP session | per phone |
| POST /auth/* | 10 requests | per minute | per IP |
| GET /api/* (authenticated) | 120 requests | per minute | per user |
| POST /api/* (authenticated) | 30 requests | per minute | per user |
| POST /reminders/send | 50 requests | per hour | per user |
| POST /upload/* | 20 requests | per hour | per user |
| GET /listings/* (public) | 60 requests | per minute | per IP |
| POST /listings/*/enquiry | 3 requests | per day | per phone+property |
| POST /webhooks/* | 100 requests | per minute | per IP |
| GET /admin/* | 60 requests | per minute | per user |

### Rate Limit Response

```
HTTP 429 Too Many Requests

Headers:
  Retry-After: 45
  X-RateLimit-Limit: 120
  X-RateLimit-Remaining: 0
  X-RateLimit-Reset: 1717578900

Body:
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again in 45 seconds.",
    "retryAfter": 45
  }
}
```

---

## 27. Pagination, Filtering, Sorting

### 27.1 Pagination

**Request:**

```
GET /api/v1/properties/:id/tenants?page=2&limit=25
```

| Param | Type | Default | Max | Description |
|---|---|---|---|---|
| page | number | 1 | — | 1-indexed page number |
| limit | number | 25 | 100 | Items per page |

**Response meta:**

```json
{
  "meta": {
    "page": 2,
    "limit": 25,
    "total": 48,
    "totalPages": 2,
    "hasNext": false,
    "hasPrev": true
  }
}
```

### 27.2 Filtering

Filters are passed as query parameters:

```
GET /api/v1/properties/:id/tenants?status=ACTIVE&rentStatus=UNPAID&floor=2nd
```

Multiple values for same filter (OR logic):

```
GET /api/v1/properties/:id/tenants?status=ACTIVE&status=ON_NOTICE
```

### 27.3 Sorting

```
GET /api/v1/properties/:id/tenants?sort=name&order=asc
GET /api/v1/properties/:id/tenants?sort=moveInDate&order=desc
```

| Param | Type | Default | Description |
|---|---|---|---|
| sort | string | varies | Column to sort by |
| order | string | "asc" | "asc" or "desc" |

### 27.4 Searching

```
GET /api/v1/properties/:id/tenants?search=rahul
GET /api/v1/properties/:id/tenants?search=9876
```

Searches across: name, phone number. Case-insensitive. Partial match.

### 27.5 Date Range Filtering

```
GET /api/v1/properties/:id/reports/export?dateFrom=2025-01-01&dateTo=2025-06-30
```

| Param | Type | Format | Description |
|---|---|---|---|
| dateFrom | string | YYYY-MM-DD | Start date (inclusive) |
| dateTo | string | YYYY-MM-DD | End date (inclusive) |

---

## 28. Versioning Strategy

### URL-Based Versioning

```
Current: /api/v1/...
Future:  /api/v2/...
```

**Rules:**

1. All endpoints prefixed with `/api/v1/`
2. Breaking changes require new version (`v2`)
3. Non-breaking additions (new fields, new endpoints) can go in `v1`
4. Old version supported for minimum 6 months after new version release
5. Deprecation notices sent via response header:

```
X-API-Deprecated: true
X-API-Sunset: 2026-06-01
X-API-New-Version: v2
```

**What counts as breaking:**
- Removing a field from response
- Changing field type
- Changing field name
- Changing URL structure
- Changing error codes
- Making optional field required

**What is NOT breaking:**
- Adding new field to response
- Adding new optional parameter
- Adding new endpoint
- Adding new enum value
- Improving error messages

---

## 29. Error Catalog

### Complete Error Code Reference

```
AUTHENTICATION ERRORS (401):
  AUTH_REQUIRED              No token provided
  AUTH_INVALID_TOKEN         Token malformed or invalid signature
  AUTH_TOKEN_EXPIRED         Access token expired (use refresh)
  AUTH_REFRESH_INVALID       Refresh token invalid or expired
  AUTH_REFRESH_REVOKED       Refresh token was revoked (logged out)
  AUTH_INVALID_OTP           OTP doesn't match
  AUTH_OTP_EXPIRED           OTP has expired (> 5 minutes)
  AUTH_OTP_MAX_ATTEMPTS      Too many failed OTP attempts

AUTHORIZATION ERRORS (403):
  AUTH_FORBIDDEN             User doesn't have required role
  AUTH_NOT_OWNER             User doesn't own this resource
  AUTH_STAFF_NO_PERMISSION   Staff role doesn't allow this action
  AUTH_TENANT_NO_ACCESS      Tenant can't access this resource
  PLAN_LIMIT_PROPERTIES      Property count exceeds plan limit
  PLAN_LIMIT_TENANTS         Tenant count exceeds plan limit
  PLAN_LIMIT_STAFF           Staff count exceeds plan limit
  PLAN_FEATURE_DISABLED      Feature not available on current plan

VALIDATION ERRORS (400):
  VALIDATION_ERROR           Generic validation failure (with details)
  INVALID_PHONE              Phone number format invalid
  INVALID_EMAIL              Email format invalid
  INVALID_PIN_CODE           PIN code format invalid
  INVALID_AADHAAR            Aadhaar format invalid
  INVALID_PAN                PAN format invalid
  INVALID_DATE               Date format invalid
  INVALID_AMOUNT             Amount must be positive integer
  MISSING_REQUIRED_FIELD     Required field not provided
  INVALID_ENUM_VALUE         Value not in allowed enum list

NOT FOUND ERRORS (404):
  NOT_FOUND                  Generic resource not found
  PROPERTY_NOT_FOUND         Property doesn't exist
  ROOM_NOT_FOUND             Room doesn't exist
  TENANT_NOT_FOUND           Tenant doesn't exist
  RENT_ENTRY_NOT_FOUND       Rent entry doesn't exist
  PAYMENT_NOT_FOUND          Payment doesn't exist
  RECEIPT_NOT_FOUND          Receipt doesn't exist
  REQUEST_NOT_FOUND          Maintenance request doesn't exist
  ANNOUNCEMENT_NOT_FOUND     Announcement doesn't exist

CONFLICT ERRORS (409):
  CONFLICT                   Generic conflict
  PHONE_ALREADY_EXISTS       Phone number already registered
  TENANT_PHONE_EXISTS        Phone already exists in this property
  ROOM_NUMBER_EXISTS         Room number already exists in property
  RENT_ENTRY_EXISTS          Rent entry already exists for this month
  RECEIPT_ALREADY_EXISTS     Receipt already generated for this payment

BUSINESS RULE ERRORS (422):
  BUSINESS_RULE_VIOLATED     Generic business rule violation
  ROOM_NO_VACANCY            Room has no vacant beds
  ROOM_HAS_TENANTS           Can't delete room with active tenants
  PROPERTY_HAS_TENANTS       Can't delete property with active tenants
  PAYMENT_TOO_OLD            Can't edit payment older than 90 days
  PAYMENT_VOIDED             Payment is voided, can't edit
  TENANT_ALREADY_VACATED     Tenant is already vacated
  INVALID_VACATE_DATE        Vacate date before move-in date
  REMINDER_RATE_EXCEEDED     Too many reminders sent today
  OCCUPANCY_MISMATCH         Occupancy would exceed max
  RENT_ALREADY_PAID          Rent for this month is already paid
  INVALID_TRANSFER           Can't transfer to same room
  DOWNGRADE_USAGE_EXCEEDED   Can't downgrade, usage exceeds limit

RATE LIMIT ERRORS (429):
  RATE_LIMITED               Too many requests

EXTERNAL SERVICE ERRORS (503):
  SMS_SERVICE_DOWN           SMS provider unavailable
  EMAIL_SERVICE_DOWN         Email provider unavailable
  PAYMENT_GATEWAY_DOWN       Razorpay unavailable
  STORAGE_SERVICE_DOWN       R2/S3 unavailable

INTERNAL ERRORS (500):
  INTERNAL_ERROR             Unexpected server error
  DATABASE_ERROR             Database connection/query error
  PDF_GENERATION_ERROR       PDF generation failed
  FILE_UPLOAD_ERROR          File upload failed
```

---

## Health Check Endpoint

```
GET /api/v1/health
🔓 PUBLIC
```

**Success Response (200):**

```json
{
  "status": "healthy",
  "timestamp": "2025-06-05T10:30:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "connected",
    "storage": "connected"
  }
}
```

**Degraded Response (200 with warnings):**

```json
{
  "status": "degraded",
  "timestamp": "2025-06-05T10:30:00.000Z",
  "version": "1.0.0",
  "services": {
    "database": "connected",
    "redis": "disconnected",
    "storage": "connected"
  },
  "warnings": ["Redis unavailable — caching disabled"]
}
```

---

## End of Document 7

**Next Document:** DOC 8 — Auth & Security Document