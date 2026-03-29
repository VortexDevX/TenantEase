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
    const paymentId = paymentResponse.json().data.id as string;

    const receiptResponse = await app.inject({
      method: "POST",
      url: "/receipts",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { paymentId }
    });

    expect(receiptResponse.statusCode).toBe(200);
    const receiptId = receiptResponse.json().data.id as string;
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
    expect(transferResponse.json().data.roomId).toBe(roomB);

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
    expect(vacateResponse.json().data.status).toBe("VACATED");

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
    const paymentId = paymentResponse.json().data.id as string;

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
    expect(paymentUpdateResponse.json().data.amount).toBe(850000);

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
    expect(voidResponse.json().data.isVoided).toBe(true);

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
