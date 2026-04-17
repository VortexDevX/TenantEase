import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./lib/db.js";
import { createApp } from "./app.js";

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
  
  const sendOtpRes = await app.inject({
    method: "POST",
    url: "/auth/send-otp",
    payload: { phone }
  });
  
  const { challengeId, debugOtp } = sendOtpRes.json();
  
  const verifyRes = await app.inject({
    method: "POST",
    url: "/auth/verify-otp",
    payload: { phone, otp: debugOtp, challengeId }
  });

  const { accessToken, user } = verifyRes.json();
  return { accessToken, ownerProfileId: user.ownerProfileId };
}

async function createTenantAuth(phone: string): Promise<TenantAuthResult> {
  const sendOtpRes = await app.inject({
    method: "POST",
    url: "/auth/send-otp",
    payload: { phone }
  });
  
  const { challengeId, debugOtp } = sendOtpRes.json();
  
  const verifyRes = await app.inject({
    method: "POST",
    url: "/auth/tenant/verify-otp",
    payload: { phone, otp: debugOtp, challengeId }
  });

  const { accessToken, user } = verifyRes.json();
  return { accessToken, tenantId: user.tenantId };
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
    propertyId = propRes.json().id;

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
    roomId = roomRes.json().id;

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
    tenantId = tenantRes.json().id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { phone: { in: Array.from(createdPhones) } }
    });
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
    const rentEntries = rentRes.json();
    expect(rentEntries.length).toBeGreaterThanOrEqual(1);
    expect(rentEntries[0].amount).toBe(1000000);
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
    expect(createRes.json().status).toBe("NEW");

    const getRes = await app.inject({
      method: "GET",
      url: "/tenant-portal/maintenance",
      headers: { authorization: `Bearer ${tenantToken}` }
    });

    expect(getRes.statusCode).toBe(200);
    expect(getRes.json()[0].category).toBe("PLUMBING");
  });

  it("should verify /system/sync-occupancy logic correctly", async () => {
    // End tenant's notice early to trigger vacancy
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { vacatedAt: new Date(Date.now() - 86400000), status: "NOTICE" }
    });

    const syncRes = await app.inject({
      method: "POST",
      url: "/system/sync-occupancy"
    });

    expect(syncRes.statusCode).toBe(200);
    expect(syncRes.json().synced).toBeGreaterThanOrEqual(1);

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    expect(room?.occupiedBeds).toBe(0);
    expect(room?.status).toBe("VACANT");
  });
});
