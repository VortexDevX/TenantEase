import fs from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./lib/db.js";
import { createApp } from "./app.js";
import { createRazorpayWebhookSignature } from "./providers/razorpay-provider.js";

const app = createApp();
const createdPhones = new Set<string>();
const createdReceiptFiles = new Set<string>();

type AuthResult = {
  accessToken: string;
  refreshCookie: string;
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
    data: { accessToken: string; user: { ownerProfileId: string } };
  };
  const refreshCookie = String(verifyResponse.headers["set-cookie"]).split(";")[0];

  return {
    accessToken: verifyBody.data.accessToken,
    refreshCookie,
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
  it("should let a new phone register directly as an owner", async () => {
    const phone = randomPhone();

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
      url: "/auth/owner/verify-otp",
      payload: {
        phone,
        otp: sendOtpBody.data.debugOtp,
        challengeId: sendOtpBody.data.challengeId
      }
    });

    expect(verifyResponse.statusCode).toBe(200);
    expect(verifyResponse.json().data.user).toMatchObject({
      phone,
      role: "OWNER",
      ownerProfileId: expect.any(String)
    });

    const ownerProfile = await prisma.ownerProfile.findFirst({
      where: { user: { phone } }
    });
    expect(ownerProfile).not.toBeNull();
  });

  it("should allow browser preflight for admin PUT requests", async () => {
    const response = await app.inject({
      method: "OPTIONS",
      url: "/admin/users/cb7d643b-244d-430a-be2b-504c3dfe76c0/role",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "authorization,content-type"
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-methods"]?.toString()).toContain("PUT");
    expect(response.headers["access-control-allow-headers"]?.toString().toLowerCase()).toContain("authorization");
  });

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

  it("should reject duplicate room numbers within the same property", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Duplicate Room Residency");

    await createRoom(auth.accessToken, propertyId, "D101");

    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rooms`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        roomNumber: "D101",
        type: "DOUBLE",
        bedCount: 2,
        monthlyRent: 850000,
        depositAmount: 1200000
      }
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "A room with this number already exists in this property"
      }
    });
  });

  it("should onboard tenants with blank optional email and reject duplicate active phone", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Tenant Validation Residency");
    const roomId = await createRoom(auth.accessToken, propertyId, "D102");
    const phone = "9876500102";

    const createResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/tenants`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        roomId,
        fullName: "Tenant Validation",
        phone,
        email: "",
        moveInDate: "2026-06-06",
        monthlyRent: 850000,
        depositPaid: 1200000
      }
    });

    expect(createResponse.statusCode).toBe(200);
    expect(createResponse.json().data).toMatchObject({
      phone,
      email: null
    });

    const duplicateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/tenants`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        roomId,
        fullName: "Duplicate Tenant Validation",
        phone,
        moveInDate: "2026-06-06",
        monthlyRent: 850000,
        depositPaid: 1200000
      }
    });

    expect(duplicateResponse.statusCode).toBe(409);
    expect(duplicateResponse.json()).toMatchObject({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "An active tenant with this phone number already exists"
      }
    });
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

  it("should start subscription checkout, activate from signed webhook, and cancel", async () => {
    const auth = await ownerAuth();

    const checkoutResponse = await app.inject({
      method: "POST",
      url: "/subscription/checkout",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { plan: "PRO" }
    });

    expect(checkoutResponse.statusCode).toBe(200);
    const checkout = checkoutResponse.json().data as {
      providerSubscriptionId: string;
      subscription: { plan: string; pendingPlan: string | null };
      invoice: { id: string; status: string };
    };
    expect(checkout.providerSubscriptionId).toMatch(/^sub_/);
    expect(checkout.subscription).toMatchObject({
      plan: "FREE",
      pendingPlan: "PRO"
    });
    expect(checkout.invoice.status).toBe("PENDING");

    const nowSeconds = Math.floor(Date.now() / 1000);
    const webhookPayload = {
      event: "subscription.activated",
      payload: {
        subscription: {
          entity: {
            id: checkout.providerSubscriptionId,
            current_start: nowSeconds,
            current_end: nowSeconds + 30 * 24 * 60 * 60,
            notes: {
              ownerProfileId: auth.ownerProfileId,
              plan: "PRO"
            }
          }
        },
        invoice: {
          entity: {
            subscription_id: checkout.providerSubscriptionId,
            payment_id: "pay_subscription_flow_001",
            status: "paid"
          }
        }
      }
    };
    const rawWebhookPayload = JSON.stringify(webhookPayload);
    const webhookEventId = `evt_subscription_flow_${auth.ownerProfileId}`;

    const webhookResponse = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay/subscriptions",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": createRazorpayWebhookSignature(rawWebhookPayload),
        "x-razorpay-event-id": webhookEventId
      },
      payload: rawWebhookPayload
    });

    expect(webhookResponse.statusCode).toBe(200);
    expect(webhookResponse.json().data).toMatchObject({
      processed: true,
      eventId: webhookEventId
    });

    const duplicateWebhookResponse = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay/subscriptions",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": createRazorpayWebhookSignature(rawWebhookPayload),
        "x-razorpay-event-id": webhookEventId
      },
      payload: rawWebhookPayload
    });

    expect(duplicateWebhookResponse.statusCode).toBe(200);
    expect(duplicateWebhookResponse.json().data.reason).toBe("duplicate_event");

    const subscriptionResponse = await app.inject({
      method: "GET",
      url: "/subscription",
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });

    expect(subscriptionResponse.statusCode).toBe(200);
    expect(subscriptionResponse.json().data).toMatchObject({
      plan: "PRO",
      pendingPlan: null,
      onlinePaymentsEnabled: true,
      maxStaffAccounts: 3
    });

    const invoicesResponse = await app.inject({
      method: "GET",
      url: "/subscription/invoices",
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(invoicesResponse.statusCode).toBe(200);
    expect(invoicesResponse.json().data[0]).toMatchObject({
      status: "PAID",
      paidAt: expect.any(String)
    });

    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: "razorpay",
          eventId: webhookEventId
        }
      }
    });
    expect(webhookEvent).toMatchObject({
      eventType: "subscription.activated",
      status: "PROCESSED",
      resourceType: "Subscription"
    });

    const cancelResponse = await app.inject({
      method: "POST",
      url: "/subscription/cancel",
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { cancelAtCycleEnd: false }
    });

    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json().data.subscription).toMatchObject({
      plan: "FREE",
      pendingPlan: null,
      onlinePaymentsEnabled: false
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
      headers: { cookie: ownerA.refreshCookie }
    });

    expect(refreshResponse.statusCode).toBe(200);
    const refreshed = refreshResponse.json().data as { accessToken: string };
    expect(refreshed.accessToken).toBeTruthy();
    const rotatedCookie = String(refreshResponse.headers["set-cookie"]).split(";")[0];
    expect(rotatedCookie).toContain("te_refresh_token=");

    const logoutResponse = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: { cookie: rotatedCookie }
    });

    expect(logoutResponse.statusCode).toBe(200);

    const refreshAfterLogout = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { cookie: rotatedCookie }
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
  it("repairs legacy staff users whose user role was still tenant", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Legacy Staff Residency");
    const staffPhone = randomPhone();
    const ownerUser = await prisma.user.findUniqueOrThrow({ where: { phone: auth.phone } });
    const staffUser = await prisma.user.create({
      data: {
        phone: staffPhone,
        role: "TENANT"
      }
    });

    const assignment = await prisma.staffAssignment.create({
      data: {
        userId: staffUser.id,
        propertyId,
        invitedByUserId: ownerUser.id,
        invitePhone: staffPhone,
        role: "WARDEN"
      }
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

    await expect(prisma.user.findUnique({ where: { id: staffUser.id } })).resolves.toMatchObject({
      role: "STAFF"
    });

    const meResponse = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: { authorization: `Bearer ${verifyResponse.json().data.accessToken}` }
    });

    expect(meResponse.statusCode).toBe(200);
    expect(meResponse.json().data.staffAssignments).toEqual([
      expect.objectContaining({
        id: assignment.id,
        inviteStatus: "ACCEPTED",
        role: "WARDEN"
      })
    ]);
  });

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

    const managerDocumentsResponse = await app.inject({
      method: "GET",
      url: `/tenants/${staffTenantId}/documents`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(managerDocumentsResponse.statusCode).toBe(200);
    expect(managerDocumentsResponse.json().data).toEqual([]);

    const managerAgreementResponse = await app.inject({
      method: "POST",
      url: `/tenants/${staffTenantId}/agreements`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        startDate: "2026-03-01",
        duration: "11 months",
        customClauses: ["Quiet hours after 10 PM."]
      }
    });

    expect(managerAgreementResponse.statusCode).toBe(201);

    const managerAgreementsResponse = await app.inject({
      method: "GET",
      url: `/tenants/${staffTenantId}/agreements`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(managerAgreementsResponse.statusCode).toBe(200);
    expect(managerAgreementsResponse.json().data).toEqual([
      expect.objectContaining({ tenantId: staffTenantId, status: "draft" })
    ]);

    const managerImportTemplateResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/tenants/import/template`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(managerImportTemplateResponse.statusCode).toBe(200);
    expect(managerImportTemplateResponse.body).toContain("fullName,phone,email,moveInDate,monthlyRent,depositPaid,roomNumber");

    const managerAnnouncementResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/announcements`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        title: "Water supply notice",
        content: "Water supply will pause from 2 PM to 4 PM today.",
        category: "MAINTENANCE",
        isImportant: true
      }
    });

    expect(managerAnnouncementResponse.statusCode).toBe(201);

    const managerAnnouncementListResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/announcements`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(managerAnnouncementListResponse.statusCode).toBe(200);
    expect(managerAnnouncementListResponse.json().data).toEqual([
      expect.objectContaining({ title: "Water supply notice" })
    ]);

    const managerReminderConfigResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/reminders/config`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(managerReminderConfigResponse.statusCode).toBe(200);

    const managerUtilityResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/utilities`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        utilityType: "ELECTRICITY",
        month: 5,
        year: 2026,
        billingModel: "INDIVIDUAL_METER",
        ratePerUnit: 1200,
        readings: [{ roomId: staffRoomId, currentReading: 10 }]
      }
    });

    expect(managerUtilityResponse.statusCode).toBe(201);
    expect(managerUtilityResponse.json().data).toMatchObject({
      totalRooms: 1,
      totalUnits: 10,
      totalCharge: 12000
    });

    const managerUtilityListResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/utilities?month=5&year=2026&type=ELECTRICITY`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(managerUtilityListResponse.statusCode).toBe(200);
    expect(managerUtilityListResponse.json().data).toEqual([
      expect.objectContaining({ roomId: staffRoomId, currentReading: 10 })
    ]);

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

    const accountantDocumentsResponse = await app.inject({
      method: "GET",
      url: `/tenants/${staffTenantId}/documents`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(accountantDocumentsResponse.statusCode).toBe(403);
    expect(accountantDocumentsResponse.json()).toMatchObject({
      success: false,
      error: { code: "AUTH_STAFF_NO_PERMISSION" }
    });

    const accountantAgreementsResponse = await app.inject({
      method: "GET",
      url: `/tenants/${staffTenantId}/agreements`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(accountantAgreementsResponse.statusCode).toBe(200);

    const accountantAgreementCreateResponse = await app.inject({
      method: "POST",
      url: `/tenants/${staffTenantId}/agreements`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        startDate: "2026-04-01"
      }
    });

    expect(accountantAgreementCreateResponse.statusCode).toBe(403);
    expect(accountantAgreementCreateResponse.json()).toMatchObject({
      success: false,
      error: { code: "AUTH_STAFF_NO_PERMISSION" }
    });

    const accountantImportTemplateResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/tenants/import/template`,
      headers: { authorization: `Bearer ${staffAccessToken}` }
    });

    expect(accountantImportTemplateResponse.statusCode).toBe(200);

    const accountantAnnouncementCreateResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/announcements`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        title: "Blocked finance notice",
        content: "Accountants should not post property announcements.",
        category: "PAYMENT"
      }
    });

    expect(accountantAnnouncementCreateResponse.statusCode).toBe(403);
    expect(accountantAnnouncementCreateResponse.json()).toMatchObject({
      success: false,
      error: { code: "AUTH_STAFF_NO_PERMISSION" }
    });

    const accountantReminderSendResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/reminders/send`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: { mode: "OVERDUE", billingMonth: "2026-05" }
    });

    expect(accountantReminderSendResponse.statusCode).toBe(200);

    const accountantUtilityResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/utilities`,
      headers: { authorization: `Bearer ${staffAccessToken}` },
      payload: {
        utilityType: "ELECTRICITY",
        month: 5,
        year: 2026,
        billingModel: "INDIVIDUAL_METER",
        ratePerUnit: 1200,
        readings: [{ roomId: staffRoomId, currentReading: 15 }]
      }
    });

    expect(accountantUtilityResponse.statusCode).toBe(201);

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

describe("mvp p0/p1 gap closure", () => {
  it("persists richer tenant profile fields and creates downloadable settlement PDF", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Settlement Residency");
    const roomId = await createRoom(auth.accessToken, propertyId, "SET101", 1);
    const phone = randomPhone();

    const createResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/tenants`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        roomId,
        fullName: "Settlement Tenant",
        phone,
        email: "",
        emergencyContactName: "Emergency Person",
        emergencyContactPhone: "9876543201",
        emergencyContactRelation: "Brother",
        aadhaarLast4: "4567",
        notes: "Night shift tenant",
        moveInDate: "2026-04-01",
        monthlyRent: 900000,
        depositPaid: 2000000
      }
    });

    expect(createResponse.statusCode).toBe(200);
    const tenantId = createResponse.json().data.id as string;

    const detailResponse = await app.inject({
      method: "GET",
      url: `/tenants/${tenantId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().data).toMatchObject({
      emergencyContactName: "Emergency Person",
      emergencyContactPhone: "9876543201",
      aadhaarLast4: "4567",
      notes: "Night shift tenant"
    });

    const vacateResponse = await app.inject({
      method: "POST",
      url: `/tenants/${tenantId}/vacate`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        vacatedAt: "2026-05-01",
        damageDeduction: 100000,
        refundStatus: "pending",
        finalNotes: "Keys returned"
      }
    });

    expect(vacateResponse.statusCode).toBe(200);
    const vacateRecord = vacateResponse.json().data.vacateRecord as { id: string; settlementPdfUrl: string };
    expect(vacateRecord.settlementPdfUrl).toBe(`/vacate-records/${vacateRecord.id}/download`);

    const dbRecord = await prisma.vacateRecord.findUnique({ where: { id: vacateRecord.id } });
    if (dbRecord?.settlementPdfPath) {
      createdReceiptFiles.add(dbRecord.settlementPdfPath);
    }

    const downloadResponse = await app.inject({
      method: "GET",
      url: vacateRecord.settlementPdfUrl,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(downloadResponse.statusCode).toBe(200);
    expect(downloadResponse.headers["content-type"]).toContain("application/pdf");
  });

  it("runs cron rent/reminders and applies utility and late-fee charges idempotently", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Cron Charge Residency");
    const roomId = await createRoom(auth.accessToken, propertyId, "CR101", 1);
    await createTenant(auth.accessToken, propertyId, roomId, "Cron Tenant", randomPhone());

    await app.inject({
      method: "PUT",
      url: `/properties/${propertyId}/settings`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        rentDueDay: 1,
        lateFeePerDay: 1000,
        lateFeeGraceDays: 0,
        ownerPan: null,
        contactPhone: null
      }
    });

    const firstCron = await app.inject({
      method: "POST",
      url: "/cron/rent/generate",
      headers: { authorization: "Bearer local_dev_cron_secret" },
      payload: { billingMonth: "2026-04" }
    });
    const secondCron = await app.inject({
      method: "POST",
      url: "/cron/rent/generate",
      headers: { authorization: "Bearer local_dev_cron_secret" },
      payload: { billingMonth: "2026-04" }
    });

    expect(firstCron.statusCode).toBe(200);
    expect(secondCron.statusCode).toBe(200);
    const rentEntries = await prisma.rentEntry.findMany({
      where: { tenant: { propertyId }, billingMonth: "2026-04" }
    });
    expect(rentEntries).toHaveLength(1);

    await prisma.reminderConfig.update({
      where: { propertyId },
      data: {
        inAppEnabled: true,
        smsEnabled: false,
        whatsappEnabled: false,
        emailEnabled: false
      }
    });

    const reminderCron = await app.inject({
      method: "POST",
      url: "/cron/reminders",
      headers: { authorization: "Bearer local_dev_cron_secret" }
    });
    expect(reminderCron.statusCode).toBe(200);
    expect(reminderCron.json().data.sentCount).toBeGreaterThan(0);
    await expect(prisma.reminderLog.count({ where: { propertyId, channel: "IN_APP" } })).resolves.toBeGreaterThan(0);

    const lateFeeResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/late-fees/apply`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(lateFeeResponse.statusCode).toBe(200);
    const amountAfterLateFee = (await prisma.rentEntry.findFirstOrThrow({ where: { tenant: { propertyId }, billingMonth: "2026-04" } })).amountDue;

    const secondLateFeeResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/late-fees/apply`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(secondLateFeeResponse.statusCode).toBe(200);
    await expect(prisma.rentEntry.findFirstOrThrow({ where: { tenant: { propertyId }, billingMonth: "2026-04" } })).resolves.toMatchObject({
      amountDue: amountAfterLateFee
    });

    const utilityPayload = {
      utilityType: "ELECTRICITY",
      month: 4,
      year: 2026,
      billingModel: "INDIVIDUAL_METER",
      ratePerUnit: 1000,
      readings: [{ roomId, currentReading: 10 }]
    };
    const utilityResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/utilities`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: utilityPayload
    });
    expect(utilityResponse.statusCode).toBe(201);
    const amountAfterUtility = (await prisma.rentEntry.findFirstOrThrow({ where: { tenant: { propertyId }, billingMonth: "2026-04" } })).amountDue;

    const secondUtilityResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/utilities`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: utilityPayload
    });
    expect(secondUtilityResponse.statusCode).toBe(201);
    await expect(prisma.rentEntry.findFirstOrThrow({ where: { tenant: { propertyId }, billingMonth: "2026-04" } })).resolves.toMatchObject({
      amountDue: amountAfterUtility
    });
  });

  it("generates real bulk receipt PDFs and handles public listing enquiries", async () => {
    const auth = await ownerAuth();
    const propertyId = await createProperty(auth.accessToken, "Public Listing Residency");
    const roomId = await createRoom(auth.accessToken, propertyId, "PL101", 1);
    const tenantId = await createTenant(auth.accessToken, propertyId, roomId, "Bulk Receipt Tenant", randomPhone());

    await prisma.rentEntry.create({
      data: {
        tenantId,
        billingMonth: "2026-05",
        dueDate: new Date("2026-05-01T00:00:00.000Z"),
        amountDue: 850000,
        amountPaid: 850000,
        status: "PAID",
        payments: {
          create: {
            amount: 850000,
            mode: "UPI",
            paidAt: new Date("2026-05-02T00:00:00.000Z")
          }
        }
      }
    });

    const bulkResponse = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/receipts/bulk?month=5&year=2026`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(bulkResponse.statusCode).toBe(201);
    const receiptId = bulkResponse.json().data.receipts[0].receiptId as string;
    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (receipt?.filePath) {
      createdReceiptFiles.add(receipt.filePath);
    }

    const receiptDownload = await app.inject({
      method: "GET",
      url: `/receipts/${receiptId}/download`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(receiptDownload.statusCode).toBe(200);
    expect(receiptDownload.headers["content-type"]).toContain("application/pdf");

    const listingResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/listing`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(listingResponse.statusCode).toBe(200);
    const listing = listingResponse.json().data as { slug: string };

    const publishResponse = await app.inject({
      method: "PUT",
      url: `/properties/${propertyId}/listing`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: {
        title: "Public Listing Residency",
        description: "Clean PG near metro",
        contactPhone: "9876543210",
        isEnabled: true,
        amenities: ["WiFi", "Meals"]
      }
    });
    expect(publishResponse.statusCode).toBe(200);

    const publicResponse = await app.inject({ method: "GET", url: `/listings/${listing.slug}` });
    expect(publicResponse.statusCode).toBe(200);
    expect(publicResponse.json().data.property.vacantBeds).toBe(0);

    for (let i = 0; i < 3; i++) {
      const enquiryResponse = await app.inject({
        method: "POST",
        url: `/listings/${listing.slug}/enquiry`,
        payload: {
          name: `Enquiry ${i}`,
          phone: "9876500999",
          email: "",
          message: "Is a bed available?"
        }
      });
      expect(enquiryResponse.statusCode).toBe(201);
    }

    const rateLimitedResponse = await app.inject({
      method: "POST",
      url: `/listings/${listing.slug}/enquiry`,
      payload: {
        name: "Rate Limited",
        phone: "9876500999",
        message: "Fourth enquiry"
      }
    });
    expect(rateLimitedResponse.statusCode).toBe(429);

    const enquiriesResponse = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/enquiries`,
      headers: { authorization: `Bearer ${auth.accessToken}` }
    });
    expect(enquiriesResponse.statusCode).toBe(200);
    const enquiryId = enquiriesResponse.json().data[0].id as string;

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/enquiries/${enquiryId}`,
      headers: { authorization: `Bearer ${auth.accessToken}` },
      payload: { status: "CONTACTED" }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().data.status).toBe("CONTACTED");
  });
});
