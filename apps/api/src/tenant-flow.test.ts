import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./lib/db.js";
import { createApp } from "./app.js";
import { createRazorpayWebhookSignature } from "./providers/razorpay-provider.js";

const app = createApp();
const createdPhones = new Set<string>();

type OwnerAuthResult = {
  accessToken: string;
  ownerProfileId: string;
};

type TenantAuthResult = {
  accessToken: string;
  tenantId: string;
};

function randomPhone() {
  const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`;
  createdPhones.add(phone);
  return phone;
}

async function createOwnerAuth(): Promise<OwnerAuthResult> {
  const phone = randomPhone();
  await prisma.user.create({
    data: {
      phone,
      role: "OWNER",
      ownerProfile: { create: {} }
    }
  });
  
  const sendOtpRes = await app.inject({
    method: "POST",
    url: "/auth/send-otp",
    payload: { phone }
  });
  
  const sendOtpBody = sendOtpRes.json() as {
    data: { challengeId: string; debugOtp?: string };
  };
  
  const verifyRes = await app.inject({
    method: "POST",
    url: "/auth/verify-otp",
    payload: {
      phone,
      otp: sendOtpBody.data.debugOtp,
      challengeId: sendOtpBody.data.challengeId
    }
  });

  const verifyBody = verifyRes.json() as {
    data: { accessToken: string; user: { ownerProfileId: string } };
  };
  return { accessToken: verifyBody.data.accessToken, ownerProfileId: verifyBody.data.user.ownerProfileId };
}

async function createTenantAuth(phone: string): Promise<TenantAuthResult> {
  const sendOtpRes = await app.inject({
    method: "POST",
    url: "/auth/send-otp",
    payload: { phone }
  });
  
  const sendOtpBody = sendOtpRes.json() as {
    data: { challengeId: string; debugOtp?: string };
  };
  
  const verifyRes = await app.inject({
    method: "POST",
    url: "/auth/tenant/verify-otp",
    payload: {
      phone,
      otp: sendOtpBody.data.debugOtp,
      challengeId: sendOtpBody.data.challengeId
    }
  });

  const verifyBody = verifyRes.json() as {
    data: { accessToken: string; user: { tenantId: string } };
  };
  return { accessToken: verifyBody.data.accessToken, tenantId: verifyBody.data.user.tenantId };
}

describe("Tenant Flow Integration", () => {
  let ownerToken: string;
  let ownerId: string;
  let propertyId: string;
  let roomId: string;
  let tenantPhone = randomPhone();
  let tenantToken: string;
  let tenantId: string;

  beforeAll(async () => {
    await app.ready();

    // Setup: Create Owner, Property, Room, and a Tenant
    const auth = await createOwnerAuth();
    ownerToken = auth.accessToken;
    ownerId = auth.ownerProfileId;

    const propRes = await app.inject({
      method: "POST",
      url: "/properties",
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: "Tenant Flow Test PG",
        address: "Test St",
        city: "Test City",
        state: "Test State",
        pinCode: "123456",
        type: "PG"
      }
    });
    propertyId = (propRes.json() as { data: { id: string } }).data.id;

    const roomRes = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rooms`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        roomNumber: "T101",
        type: "SINGLE",
        bedCount: 1,
        monthlyRent: 1000000,
        depositAmount: 5000000
      }
    });
    roomId = (roomRes.json() as { data: { id: string } }).data.id;

    const tenantRes = await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/tenants`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        roomId,
        fullName: "Test Tenant Portal",
        phone: tenantPhone,
        moveInDate: "2024-05-01",
        monthlyRent: 1000000,
        depositPaid: 5000000
      }
    });
    tenantId = (tenantRes.json() as { data: { id: string } }).data.id;
  });

  afterAll(async () => {
    if (createdPhones.size > 0) {
      await prisma.user.deleteMany({
        where: { phone: { in: Array.from(createdPhones) } }
      });
    }
    await app.close();
  });

  it("should block tenant from accessing owner endpoints", async () => {
    // 1. Authenticate as Tenant
    const auth = await createTenantAuth(tenantPhone);
    tenantToken = auth.accessToken;
    expect(auth.tenantId).toBe(tenantId);

    // 2. Try to hit an owner endpoint (should fail with 403)
    const propertiesRes = await app.inject({
      method: "GET",
      url: "/properties",
      headers: { authorization: `Bearer ${tenantToken}` }
    });
    
    expect(propertiesRes.statusCode).toBe(403);
  });

  it("should allow tenant to access tenant-portal rent endpoint", async () => {
    // First, generate rent as the owner
    await app.inject({
      method: "POST",
      url: `/properties/${propertyId}/rent/generate`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { billingMonth: "2024-05" }
    });

    // Check rent as tenant
    const rentRes = await app.inject({
      method: "GET",
      url: "/tenant-portal/rent",
      headers: { authorization: `Bearer ${tenantToken}` }
    });

    expect(rentRes.statusCode).toBe(200);
    const rentEntries = (rentRes.json() as { data: Array<{ amountDue: number }> }).data;
    expect(rentEntries.length).toBeGreaterThanOrEqual(1);
    expect(rentEntries[0].amountDue).toBe(1000000);
  });

  it("should expose tenant portal home and profile only for authenticated tenant", async () => {
    const homeRes = await app.inject({
      method: "GET",
      url: "/tenant-portal/home",
      headers: { authorization: `Bearer ${tenantToken}` }
    });

    expect(homeRes.statusCode).toBe(200);
    const home = homeRes.json().data as {
      profile: { id: string; propertyName: string; roomNumber: string };
      currentRent: { amountDue: number } | null;
    };
    expect(home.profile.id).toBe(tenantId);
    expect(home.profile.propertyName).toBe("Tenant Flow Test PG");
    expect(home.profile.roomNumber).toBe("T101");
    expect(home.currentRent?.amountDue).toBe(1000000);

    const profileRes = await app.inject({
      method: "GET",
      url: "/tenant-portal/profile",
      headers: { authorization: `Bearer ${tenantToken}` }
    });

    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.json().data.id).toBe(tenantId);
  });

  it("should create an online rent order and record captured webhook payment", async () => {
    await prisma.subscription.update({
      where: { ownerProfileId: ownerId },
      data: {
        plan: "PRO",
        onlinePaymentsEnabled: true
      }
    });

    const rentEntry = await prisma.rentEntry.findFirstOrThrow({
      where: {
        tenantId,
        billingMonth: "2024-05"
      }
    });

    const orderRes = await app.inject({
      method: "POST",
      url: "/tenant-portal/payments/orders",
      headers: { authorization: `Bearer ${tenantToken}` },
      payload: { rentEntryId: rentEntry.id }
    });

    expect(orderRes.statusCode).toBe(200);
    const order = orderRes.json().data as {
      id: string;
      amount: number;
      providerOrderId: string;
      keyId: string;
    };
    expect(order.amount).toBe(1000000);
    expect(order.providerOrderId).toMatch(/^order_/);
    expect(order.keyId).toBeTruthy();

    const webhookPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_tenant_flow_001",
            order_id: order.providerOrderId,
            amount: order.amount,
            currency: "INR",
            status: "captured",
            captured_at: Math.floor(Date.now() / 1000)
          }
        }
      }
    };
    const rawWebhookPayload = JSON.stringify(webhookPayload);
    const webhookEventId = `evt_tenant_flow_${order.providerOrderId}`;

    const webhookRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay/payments",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": createRazorpayWebhookSignature(rawWebhookPayload),
        "x-razorpay-event-id": webhookEventId
      },
      payload: rawWebhookPayload
    });

    expect(webhookRes.statusCode).toBe(200);
    expect(webhookRes.json().data).toMatchObject({
      processed: true,
      eventId: webhookEventId
    });

    const rentAfterPayment = await prisma.rentEntry.findUnique({ where: { id: rentEntry.id } });
    expect(rentAfterPayment?.amountPaid).toBe(1000000);
    expect(rentAfterPayment?.status).toBe("PAID");

    const duplicateWebhookRes = await app.inject({
      method: "POST",
      url: "/webhooks/razorpay/payments",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": createRazorpayWebhookSignature(rawWebhookPayload),
        "x-razorpay-event-id": webhookEventId
      },
      payload: rawWebhookPayload
    });

    expect(duplicateWebhookRes.statusCode).toBe(200);
    expect(duplicateWebhookRes.json().data.reason).toBe("duplicate_event");

    const webhookEvent = await prisma.webhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider: "razorpay",
          eventId: webhookEventId
        }
      }
    });
    expect(webhookEvent).toMatchObject({
      eventType: "payment.captured",
      status: "PROCESSED",
      resourceType: "Payment"
    });
  });

  it("should let tenant notify owner about offline rent payment", async () => {
    const rentEntry = await prisma.rentEntry.create({
      data: {
        tenantId,
        billingMonth: "2024-06",
        dueDate: new Date("2024-06-05T00:00:00.000Z"),
        amountDue: 1000000,
        amountPaid: 0,
        status: "UNPAID"
      }
    });

    const notifyRes = await app.inject({
      method: "POST",
      url: "/tenant-portal/payments/offline",
      headers: { authorization: `Bearer ${tenantToken}` },
      payload: {
        idempotencyKey: crypto.randomUUID(),
        rentEntryId: rentEntry.id,
        amount: 250000,
        mode: "CASH",
        note: "Paid to caretaker"
      }
    });

    expect(notifyRes.statusCode).toBe(201);
    expect(notifyRes.json().data).toMatchObject({
      rentEntryId: rentEntry.id,
      amount: 250000,
      mode: "CASH"
    });

    const rentAfterNotify = await prisma.rentEntry.findUnique({ where: { id: rentEntry.id } });
    expect(rentAfterNotify?.amountPaid).toBe(0);

    const notification = await prisma.notification.findFirst({
      where: {
        category: "PAYMENT",
        content: { contains: "cash payment" }
      }
    });
    expect(notification?.title).toBe("Tenant payment update");

    const claimId = notifyRes.json().data.claimId as string;
    const claimsRes = await app.inject({
      method: "GET",
      url: `/properties/${propertyId}/payment-claims`,
      headers: { authorization: `Bearer ${ownerToken}` }
    });
    expect(claimsRes.statusCode).toBe(200);
    expect(claimsRes.json().data).toEqual(expect.arrayContaining([expect.objectContaining({ id: claimId, status: "PENDING" })]));

    const approveRes = await app.inject({
      method: "POST",
      url: `/payment-claims/${claimId}/resolve`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { decision: "APPROVE" }
    });
    expect(approveRes.statusCode).toBe(200);
    expect(approveRes.json().data.status).toBe("APPROVED");
    const rentAfterApproval = await prisma.rentEntry.findUnique({ where: { id: rentEntry.id } });
    expect(rentAfterApproval?.amountPaid).toBe(250000);
  });

  it("should allow tenant to list and download their agreements", async () => {
    if (!tenantToken) {
      const auth = await createTenantAuth(tenantPhone);
      tenantToken = auth.accessToken;
    }

    const agreementRes = await app.inject({
      method: "POST",
      url: `/tenants/${tenantId}/agreements`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        startDate: "2024-05-01",
        duration: "11 months",
        customClauses: ["Tenant must follow property house rules."]
      }
    });

    expect(agreementRes.statusCode).toBe(201);
    const agreementId = (agreementRes.json() as { data: { id: string } }).data.id;

    const listRes = await app.inject({
      method: "GET",
      url: `/tenants/${tenantId}/agreements`,
      headers: { authorization: `Bearer ${tenantToken}` }
    });

    expect(listRes.statusCode).toBe(200);
    expect((listRes.json() as { data: Array<{ id: string }> }).data).toEqual([
      expect.objectContaining({ id: agreementId })
    ]);

    const downloadRes = await app.inject({
      method: "GET",
      url: `/agreements/${agreementId}/download`,
      headers: { authorization: `Bearer ${tenantToken}` }
    });

    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.headers["content-type"]).toContain("application/pdf");
  });

  it("should allow tenant to create and fetch maintenance requests", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/tenant-portal/maintenance",
      headers: { authorization: `Bearer ${tenantToken}` },
      payload: {
        category: "PLUMBING",
        description: "The sink is leaking",
        urgency: "HIGH"
      }
    });

    expect(createRes.statusCode).toBe(200);
    expect((createRes.json() as { data: { status: string } }).data.status).toBe("NEW");

    const getRes = await app.inject({
      method: "GET",
      url: "/tenant-portal/maintenance",
      headers: { authorization: `Bearer ${tenantToken}` }
    });

    expect(getRes.statusCode).toBe(200);
    expect((getRes.json() as { data: Array<{ category: string }> }).data[0]?.category).toBe("PLUMBING");
  });

  it("should verify /system/sync-occupancy logic correctly", async () => {
    // End tenant's notice early to trigger vacancy
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { expectedVacateDate: new Date(Date.now() - 86400000), status: "NOTICE" }
    });

    const syncRes = await app.inject({
      method: "POST",
      url: "/system/sync-occupancy",
      headers: { authorization: "Bearer local_dev_cron_secret" }
    });

    expect(syncRes.statusCode).toBe(200);
    expect((syncRes.json() as { data: { synced: number } }).data.synced).toBeGreaterThanOrEqual(1);

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    expect(room?.occupiedBeds).toBe(0);
    expect(room?.status).toBe("VACANT");
  });
});
