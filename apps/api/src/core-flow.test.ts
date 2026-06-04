import fs from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./lib/db.js";
import { createApp } from "./app.js";

const app = createApp();
const createdPhones = new Set<string>();
const createdReceiptFiles = new Set<string>();

type AuthResult = {
  accessToken: string;
  refreshToken: string;
  ownerProfileId: string;
  phone: string;
};

function randomPhone() {
  const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  createdPhones.add(phone);
  return phone;
}

async function ownerAuth(phone = randomPhone()): Promise<AuthResult> {
  const ownerUser = await prisma.user.upsert({
    where: { phone },
    update: { role: "OWNER" },
    create: {
      phone,
      role: "OWNER",
      ownerProfile: { create: {} }
    },
    include: { ownerProfile: true }
  });
  if (!ownerUser.ownerProfile) {
    await prisma.ownerProfile.create({ data: { userId: ownerUser.id } });
  }

  const sendOtpResponse = await app.inject({
    method: "POST",
    url: "/auth/send-otp",
    payload: { phone }
  });

  expect(sendOtpResponse.statusCode).toBe(200);
  const sendOtpBody = sendOtpResponse.json() as {
    data: { challengeId: string; debugOtp?: string };
  };

  const verifyResponse = await app.inject({
    method: "POST",
    url: "/auth/verify-otp",
    payload: {
      phone,
      otp: sendOtpBody.data.debugOtp,
      challengeId: sendOtpBody.data.challengeId
    }
  });

  expect(verifyResponse.statusCode).toBe(200);
  const verifyBody = verifyResponse.json() as {
    data: { accessToken: string; refreshToken: string; user: { ownerProfileId: string } };
  };

  return {
    accessToken: verifyBody.data.accessToken,
    refreshToken: verifyBody.data.refreshToken,
    ownerProfileId: verifyBody.data.user.ownerProfileId,
    phone
  };
}

async function createProperty(accessToken: string, name = "TenantEase Test Residency") {
  const response = await app.inject({
    method: "POST",
    url: "/properties",
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      name,
      address: "99 Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      pinCode: "560025",
      type: "PG"
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json().data.id as string;
}

async function createRoom(accessToken: string, propertyId: string, roomNumber: string, bedCount = 2) {
  const response = await app.inject({
    method: "POST",
    url: `/properties/${propertyId}/rooms`,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      roomNumber,
      type: bedCount === 1 ? "SINGLE" : "DOUBLE",
      bedCount,
      monthlyRent: 850000,
      depositAmount: 1200000
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json().data.id as string;
}

async function createTenant(accessToken: string, propertyId: string, roomId: string, fullName: string, phone: string) {
  const response = await app.inject({
    method: "POST",
    url: `/properties/${propertyId}/tenants`,
    headers: { authorization: `Bearer ${accessToken}` },
    payload: {
      roomId,
      fullName,
      phone,
      email: `${phone}@example.com`,
      moveInDate: "2026-03-01",
      monthlyRent: 850000,
      depositPaid: 1200000
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json().data.id as string;
}

beforeAll(async () => {
  await app.ready();
});

afterAll(async () => {
  for (const filePath of createdReceiptFiles) {
    await fs.unlink(filePath).catch(() => undefined);
  }

  await prisma.user.deleteMany({
    where: {
      phone: { in: Array.from(createdPhones) }
    }
  });

  await app.close();
});

describe("core owner flow", () => {
  it("should complete auth, property, tenant, rent, payment, and receipt flow", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken);
    const roomId = await createRoom(auth.accessToken, propertyId, "301");
    const tenantId = await createTenant(
      auth.accessToken,
      propertyId,
      roomId,
      "Integration Test Tenant",
      "9876543210"
    );

    const rentGenerateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rent/generate`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {}
    });

    expect(rentGenerateResponse.statusCode).toBe(200);

    const rentListResponse = await app.inject({
      method: "GET",
      url: `/tenants/${tenantId}/rent`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(rentListResponse.statusCode).toBe(200);
    const rentEntries = rentListResponse.json().data as Array<{ id: string; status: string }>;
    expect(rentEntries.length).toBeGreaterThan(0);
    const rentEntryId = rentEntries[0].id;

    const paymentResponse = await app.inject({
      method: "POST",
      url: "/payments",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        rentEntryId,
        amount: 850000,
        mode: "UPI",
        paidAt: new Date().toISOString(),
        note: "integration payment"
      }
    });

    expect(paymentResponse.statusCode).toBe(200);
    const paymentData = paymentResponse.json().data as {
      payment: { id: string };
      receipt: { id: string };
    };
    const paymentId = paymentData.payment.id;
    const autoReceiptId = paymentData.receipt.id;
    expect(autoReceiptId).toBeTruthy();

    const receiptResponse = await app.inject({
      method: "POST",
      url: "/receipts",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { paymentId }
    });

    expect(receiptResponse.statusCode).toBe(200);
    const receiptId = receiptResponse.json().data.id as string;
    expect(receiptId).toBe(autoReceiptId);
    const dbReceipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
    expect(dbReceipt).not.toBeNull();
    if (dbReceipt?.filePath) {
      createdReceiptFiles.add(dbReceipt.filePath);
    }

    const receiptDownloadResponse = await app.inject({
      method: "GET",
      url: `/receipts/${receiptId}/download`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(receiptDownloadResponse.statusCode).toBe(200);
    expect(receiptDownloadResponse.headers["content-type"]).toContain("application/pdf");
  });

  it("should use property settings for rent due date and reminder logs", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Settings Residency");
    const roomId = await createRoom(auth.accessToken, propertyId, "302");
    await createTenant(auth.accessToken, propertyId, roomId, "Reminder Tenant", "9876543214");

    const settingsResponse = await app.inject({
      method: "PUT",
      url: `/properties/${propertyId}/settings`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        rentDueDay: 12,
        lateFeePerDay: 2500,
        lateFeeGraceDays: 2,
        ownerPan: "ABCDE1234F",
        contactPhone: "9876543214"
      }
    });
    expect(settingsResponse.statusCode).toBe(200);

    const rentGenerateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rent/generate`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { billingMonth: "2026-04" }
    });
    expect(rentGenerateResponse.statusCode).toBe(200);

    const rentListResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/rent?month=2026-04`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    const rentEntries = rentListResponse.json().data as Array<{ dueDate: string }>;
    expect(rentEntries[0].dueDate.startsWith("2026-04-12")).toBe(true);

    await prisma.rentEntry.updateMany({
      where: {
        tenant: { propertyId },
        billingMonth: "2026-04"
      },
      data: {
        status: "OVERDUE",
        dueDate: new Date("2026-04-01T00:00:00.000Z")
      }
    });

    const sendResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/reminders/send`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { mode: "OVERDUE", billingMonth: "2026-04" }
    });
    expect(sendResponse.statusCode).toBe(200);
    expect(sendResponse.json().data.sentCount).toBeGreaterThan(0);

    const logsResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/reminders/logs`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(logsResponse.statusCode).toBe(200);
    expect((logsResponse.json().data as Array<unknown>).length).toBeGreaterThan(0);
  });

  it("should expose free subscription limits and block second property", async () => {
    const auth = await ownerAuth();
    await createProperty(auth.accessToken, "Plan Limit Residency");

    const subscriptionResponse = await app.inject({
      method: "GET",
      url: "/subscription",
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(subscriptionResponse.statusCode).toBe(200);
    expect(subscriptionResponse.json()).toMatchObject({
      success: true,
      data: {
        plan: "FREE",
        maxProperties: 1,
        usage: {
          properties: 1
        }
      }
    });

    const secondPropertyResponse = await app.inject({
      method: "POST",
      url: "/properties",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        name: "Blocked Second Residency",
        address: "100 Residency Road",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560026",
        type: "PG"
      }
    });

    expect(secondPropertyResponse.statusCode).toBe(402);
    expect(secondPropertyResponse.json()).toMatchObject({
      success: false,
      error: {
        code: "PLAN_LIMIT_PROPERTIES"
      }
    });
  });

  it("should enforce owner isolation and support refresh/logout", async () => {
    const ownerA = await ownerAuth();
    const ownerB = await ownerAuth();
    const propertyId = await createProperty(ownerA.accessToken, "Isolation Residency");

    const forbiddenResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}`,
      headers: { authorization: `Bearer ${ownerB.accessToken}` }
    });

    expect(forbiddenResponse.statusCode).toBe(404);
    expect(forbiddenResponse.json()).toMatchObject({
      success: false,
      error: { code: "PROPERTY_NOT_FOUND" }
    });

    const refreshResponse = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: ownerA.refreshToken }
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshed = refreshResponse.json().data as { accessToken: string; refreshToken: string };
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.refreshToken).toBeTruthy();

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      payload: { refreshToken: refreshed.refreshToken }
    });

    expect(logoutResponse.statusCode).toBe(200);

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      payload: { refreshToken: refreshed.refreshToken }
    });

    expect(refreshAfterLogout.statusCode).toBe(401);
  });

  it("should handle transfer, vacate, payment update, and old payment restrictions", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Lifecycle Residency");
    const roomA = await createRoom(auth.accessToken, propertyId, "401");
    const roomB = await createRoom(auth.accessToken, propertyId, "402", 1);
    const tenantId = await createTenant(
      auth.accessToken,
      propertyId,
      roomA,
      "Lifecycle Tenant",
      "9876543211"
    );

    const transferResponse = await app.inject({
      method: "POST",
      url: `/tenants/${tenantId}/transfer`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { roomId: roomB }
    });

    expect(transferResponse.statusCode).toBe(200);
    expect(transferResponse.json().data.tenant.roomId).toBe(roomB);
    expect(transferResponse.json().data.transferRecord.fromRoomId).toBe(roomA);

    const roomsResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/rooms`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(roomsResponse.statusCode).toBe(200);
    const rooms = roomsResponse.json().data as Array<{ id: string; occupiedBeds: number; status: string }>;
    const originRoom = rooms.find((room) => room.id === roomA);
    const destinationRoom = rooms.find((room) => room.id === roomB);
    expect(originRoom).toMatchObject({ occupiedBeds: 0, status: "VACANT" });
    expect(destinationRoom).toMatchObject({ occupiedBeds: 1, status: "OCCUPIED" });

    const vacateResponse = await app.inject({
      method: "POST",
      url: `/tenants/${tenantId}/vacate`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { vacatedAt: "2026-03-18" }
    });

    expect(vacateResponse.statusCode).toBe(200);
    expect(vacateResponse.json().data.tenant.status).toBe("VACATED");
    expect(vacateResponse.json().data.vacateRecord.refundAmount).toBeGreaterThanOrEqual(0);

    const vacateAgainResponse = await app.inject({
      method: "POST",
      url: `/tenants/${tenantId}/vacate`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { vacatedAt: "2026-03-19" }
    });

    expect(vacateAgainResponse.statusCode).toBe(422);
    expect(vacateAgainResponse.json()).toMatchObject({
      success: false,
      error: { code: "TENANT_ALREADY_VACATED" }
    });

    const freshTenantId = await createTenant(
      auth.accessToken,
      propertyId,
      roomA,
      "Payment Tenant",
      "9876543212"
    );

    await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rent/generate`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {}
    });

    const rentEntriesResponse = await app.inject({
      method: "GET",
      url: `/tenants/${freshTenantId}/rent`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    const freshRentEntryId = (rentEntriesResponse.json().data as Array<{ id: string }>)[0].id;

    const paymentResponse = await app.inject({
      method: "POST",
      url: "/payments",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        rentEntryId: freshRentEntryId,
        amount: 200000,
        mode: "CASH",
        paidAt: new Date().toISOString(),
        note: "partial"
      }
    });

    expect(paymentResponse.statusCode).toBe(200);
    const paymentId = paymentResponse.json().data.payment.id as string;

    const paymentUpdateResponse = await app.inject({
      method: "PUT",
      url: `/payments/${paymentId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        amount: 850000,
        mode: "BANK_TRANSFER",
        note: "updated to full"
      }
    });

    expect(paymentUpdateResponse.statusCode).toBe(200);
    expect(paymentUpdateResponse.json().data.payment.amount).toBe(850000);
    expect(paymentUpdateResponse.json().data.receipt.id).toBeTruthy();

    const rentAfterUpdate = await prisma.rentEntry.findUnique({ where: { id: freshRentEntryId } });
    expect(rentAfterUpdate?.status).toBe("PAID");

    const voidResponse = await app.inject({
      method: "PUT",
      url: `/payments/${paymentId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        isVoided: true
      }
    });

    expect(voidResponse.statusCode).toBe(200);
    expect(voidResponse.json().data.payment.isVoided).toBe(true);

    const rentAfterVoid = await prisma.rentEntry.findUnique({ where: { id: freshRentEntryId } });
    expect(rentAfterVoid?.status).toMatch(/UNPAID|OVERDUE/);

    const oldPayment = await prisma.payment.create({
      data: {
        rentEntryId: freshRentEntryId,
        amount: 100000,
        mode: "CASH",
        paidAt: new Date("2025-01-01T00:00:00.000Z"),
        note: "old payment"
      }
    });

    const oldPaymentUpdateResponse = await app.inject({
      method: "PUT",
      url: `/payments/${oldPayment.id}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        amount: 120000
      }
    });

    expect(oldPaymentUpdateResponse.statusCode).toBe(422);
    expect(oldPaymentUpdateResponse.json()).toMatchObject({
      success: false,
      error: { code: "PAYMENT_TOO_OLD" }
    });
  });

  it("should create, update, comment on, and close maintenance requests", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Maintenance Residency");
    const roomId = await createRoom(auth.accessToken, propertyId, "501");
    const tenantId = await createTenant(
      auth.accessToken,
      propertyId,
      roomId,
      "Maintenance Tenant",
      "9876543213"
    );

    const createResponse = await app.inject({
      method: "POST",
      url: "/maintenance",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        propertyId,
        tenantId,
        category: "PLUMBING",
        description: "Bathroom tap is leaking and water is collecting near the drain.",
        urgency: "HIGH",
        preferredTime: "evening"
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const requestId = createResponse.json().data.id as string;

    const listResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/maintenance`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data.summary).toMatchObject({
      new: 1,
      total: 1
    });

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/maintenance/${requestId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        status: "IN_PROGRESS",
        assignedWorkerName: "Raju",
        assignedWorkerPhone: "9876543215",
        comment: "Plumber scheduled for evening.",
        isInternalNote: false
      }
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data.status).toBe("IN_PROGRESS");

    const commentResponse = await app.inject({
      method: "POST",
      url: `/maintenance/${requestId}/comments`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        content: "Please carry spare washer as well.",
        isInternal: true
      }
    });

    expect(commentResponse.statusCode).toBe(200);

    const detailResponse = await app.inject({
      method: "GET",
      url: `/maintenance/${requestId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().data.comments.length).toBeGreaterThanOrEqual(2);

    const resolveWithoutNotesResponse = await app.inject({
      method: "PUT",
      url: `/maintenance/${requestId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        status: "RESOLVED"
      }
    });

    expect(resolveWithoutNotesResponse.statusCode).toBe(422);
    expect(resolveWithoutNotesResponse.json()).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR" }
    });

    const resolveResponse = await app.inject({
      method: "PUT",
      url: `/maintenance/${requestId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        status: "RESOLVED",
        resolutionNotes: "Washer replaced and leak stopped."
      }
    });

    expect(resolveResponse.statusCode).toBe(200);
    expect(resolveResponse.json().data.status).toBe("RESOLVED");

    const closeResponse = await app.inject({
      method: "POST",
      url: `/maintenance/${requestId}/close`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.json().data.status).toBe("CLOSED");

    const commentAfterCloseResponse = await app.inject({
      method: "POST",
      url: `/maintenance/${requestId}/comments`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        content: "Post-close comment should fail.",
        isInternal: false
      }
    });

    expect(commentAfterCloseResponse.statusCode).toBe(422);
    expect(commentAfterCloseResponse.json()).toMatchObject({
      success: false,
      error: { code: "INVALID_MAINTENANCE_TRANSITION" }
    });
  });
});

describe("staff assignment flow", () => {
  it("enforces plan limits, invites staff, accepts OTP login, and revokes access", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Staff Test Residency");
    const staffPhone = randomPhone();

    const freeInviteResponse = await app.inject({
      method: "POST",
      url: "/staff/invite",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        propertyId,
        phone: staffPhone,
        role: "MANAGER"
      }
    });

    expect(freeInviteResponse.statusCode).toBe(402);
    expect(freeInviteResponse.json()).toMatchObject({
      success: false,
      error: { code: "PLAN_LIMIT_STAFF" }
    });

    await prisma.subscription.update({
      where: { ownerProfileId: auth.ownerProfileId },
      data: {
        plan: "STARTER",
        maxStaffAccounts: 1,
        smsEnabled: true
      }
    });

    const inviteResponse = await app.inject({
      method: "POST",
      url: "/staff/invite",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        propertyId,
        phone: staffPhone,
        email: "staff@example.com",
        role: "MANAGER"
      }
    });

    expect(inviteResponse.statusCode).toBe(200);
    const assignmentId = inviteResponse.json().data.id as string;
    expect(inviteResponse.json().data).toMatchObject({
      phone: staffPhone,
      propertyId,
      role: "MANAGER",
      inviteStatus: "PENDING",
      isActive: true
    });

    const sendOtpResponse = await app.inject({
      method: "POST",
      url: "/auth/send-otp",
      payload: { phone: staffPhone }
    });
    expect(sendOtpResponse.statusCode).toBe(200);

    const verifyResponse = await app.inject({
      method: "POST",
      url: "/auth/verify-otp",
      payload: {
        phone: staffPhone,
        otp: sendOtpResponse.json().data.debugOtp,
        challengeId: sendOtpResponse.json().data.challengeId
      }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().data.user.role).toBe("STAFF");
    const staffAccessToken = verifyResponse.json().data.accessToken as string;

    const meResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().data.staffAssignments).toEqual([
      expect.objectContaining({
        id: assignmentId,
        propertyId,
        propertyName: "Staff Test Residency",
        role: "MANAGER",
        inviteStatus: "ACCEPTED"
      })
    ]);

    const staffRoomsResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/rooms`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(staffRoomsResponse.statusCode).toBe(200);

    const staffRoomCreateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rooms`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        roomNumber: "S101",
        type: "DOUBLE",
        bedCount: 2,
        monthlyRent: 750000,
        depositAmount: 1000000
      }
    });

    expect(staffRoomCreateResponse.statusCode).toBe(200);
    const staffRoomId = staffRoomCreateResponse.json().data.id as string;
    const staffTenantPhone = randomPhone();

    const staffTenantCreateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/tenants`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        roomId: staffRoomId,
        fullName: "Staff Managed Tenant",
        phone: staffTenantPhone,
        moveInDate: "2026-03-01",
        monthlyRent: 750000,
        depositPaid: 1000000
      }
    });

    expect(staffTenantCreateResponse.statusCode).toBe(200);
    const staffTenantId = staffTenantCreateResponse.json().data.id as string;

    const staffRentGenerateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rent/generate`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: { billingMonth: "2026-05" }
    });

    expect(staffRentGenerateResponse.statusCode).toBe(200);

    const staffRentResponse = await app.inject({
      method: "GET",
      url: `/tenants/${staffTenantId}/rent`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(staffRentResponse.statusCode).toBe(200);
    const staffRentEntryId = (staffRentResponse.json().data as Array<{ id: string }>).find(Boolean)?.id;
    expect(staffRentEntryId).toBeTruthy();

    const staffPaymentResponse = await app.inject({
      method: "POST",
      url: "/payments",
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        rentEntryId: staffRentEntryId,
        amount: 750000,
        mode: "UPI",
        paidAt: new Date().toISOString()
      }
    });

    expect(staffPaymentResponse.statusCode).toBe(200);

    const staffSubscriptionResponse = await app.inject({
      method: "GET",
      url: "/subscription",
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(staffSubscriptionResponse.statusCode).toBe(403);

    const accountantUpdateResponse = await app.inject({
      method: "PUT",
      url: `/staff/${assignmentId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        role: "ACCOUNTANT"
      }
    });

    expect(accountantUpdateResponse.statusCode).toBe(200);

    const accountantTenantCreateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/tenants`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        roomId: staffRoomId,
        fullName: "Blocked Accountant Tenant",
        phone: randomPhone(),
        moveInDate: "2026-03-01",
        monthlyRent: 750000,
        depositPaid: 1000000
      }
    });

    expect(accountantTenantCreateResponse.statusCode).toBe(403);
    expect(accountantTenantCreateResponse.json()).toMatchObject({
      success: false,
      error: { code: "AUTH_STAFF_NO_PERMISSION" }
    });

    const accountantReportResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/reports/monthly?month=5&year=2026`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(accountantReportResponse.statusCode).toBe(200);

    const subscriptionResponse = await app.inject({
      method: "GET",
      url: "/subscription",
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(subscriptionResponse.statusCode).toBe(200);
    expect(subscriptionResponse.json().data.usage.staffAccounts).toBe(1);

    const revokeResponse = await app.inject({
      method: "DELETE",
      url: `/staff/${assignmentId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(revokeResponse.statusCode).toBe(200);
    expect(revokeResponse.json().data).toMatchObject({
      inviteStatus: "REVOKED",
      isActive: false
    });

    const subscriptionAfterRevokeResponse = await app.inject({
      method: "GET",
      url: "/subscription",
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(subscriptionAfterRevokeResponse.statusCode).toBe(200);
    expect(subscriptionAfterRevokeResponse.json().data.usage.staffAccounts).toBe(0);

    const revokedStaffRoomsResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/rooms`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(revokedStaffRoomsResponse.statusCode).toBe(403);
  });
});
