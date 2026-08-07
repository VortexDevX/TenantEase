import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { assertPropertyAccess } from "../../lib/auth-guards.js";
import { prisma } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { ok } from "../../lib/http.js";
import { createAuditLog } from "../common/audit.js";

const listingInputSchema = z.object({
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(2000).optional().nullable(),
  contactPhone: z.string().regex(/^\d{10}$/).optional().nullable(),
  isEnabled: z.boolean(),
  amenities: z.array(z.string().trim().min(1).max(60)).max(30).default([])
});

const enquiryInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().regex(/^\d{10}$/),
  email: z.preprocess((value) => (value === "" ? null : value), z.string().email().optional().nullable()),
  message: z.string().trim().max(1000).optional().nullable()
});

const enquiryUpdateSchema = z.object({
  status: z.enum(["NEW", "CONTACTED", "CLOSED"])
});

export async function listingRoutes(app: FastifyInstance) {
  app.get("/properties/:propertyId/listing", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyAccess(request, params.propertyId, "property:read");
    const listing = await ensureListing(params.propertyId);
    return ok(toListingDto(listing));
  });

  app.put("/properties/:propertyId/listing", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    const body = listingInputSchema.parse(request.body);
    await assertPropertyAccess(request, params.propertyId, "property:write");
    const existing = await ensureListing(params.propertyId);
    const listing = await prisma.propertyListing.update({
      where: { id: existing.id },
      data: body
    });
    await createAuditLog({
      userId: request.user.sub,
      action: "listing.update",
      resource: "PropertyListing",
      resourceId: listing.id,
      payload: body,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"]?.toString()
    });
    return ok(toListingDto(listing));
  });

  app.get("/listings/:slug", async (request) => {
    const params = request.params as { slug: string };
    const listing = await prisma.propertyListing.findUnique({
      where: { slug: params.slug },
      include: {
        property: {
          include: {
            rooms: true
          }
        }
      }
    });

    if (!listing?.isEnabled) {
      throw new AppError(404, "NOT_FOUND", "Listing not found");
    }

    const totalBeds = listing.property.rooms.reduce((sum, room) => sum + room.bedCount, 0);
    const occupiedBeds = listing.property.rooms.reduce((sum, room) => sum + room.occupiedBeds, 0);
    const rentRange = listing.property.rooms.reduce<{ min: number | null; max: number | null }>((range, room) => ({
      min: range.min === null ? room.monthlyRent : Math.min(range.min, room.monthlyRent),
      max: range.max === null ? room.monthlyRent : Math.max(range.max, room.monthlyRent)
    }), { min: null, max: null });

    return ok({
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      description: listing.description,
      contactPhone: listing.contactPhone,
      amenities: listing.amenities,
      property: {
        name: listing.property.name,
        address: listing.property.address,
        city: listing.property.city,
        state: listing.property.state,
        pinCode: listing.property.pinCode,
        type: listing.property.type,
        totalBeds,
        vacantBeds: totalBeds - occupiedBeds,
        rentMin: rentRange.min,
        rentMax: rentRange.max
      }
    });
  });

  app.post("/listings/:slug/enquiry", async (request, reply) => {
    const params = request.params as { slug: string };
    const body = enquiryInputSchema.parse(request.body);
    const listing = await prisma.propertyListing.findUnique({ where: { slug: params.slug } });
    if (!listing?.isEnabled) {
      throw new AppError(404, "NOT_FOUND", "Listing not found");
    }

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const recentCount = await prisma.enquiry.count({
      where: {
        propertyId: listing.propertyId,
        phone: body.phone,
        createdAt: { gte: dayStart }
      }
    });
    if (recentCount >= 3) {
      throw new AppError(429, "RATE_LIMITED", "Too many enquiries for this property today");
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        propertyId: listing.propertyId,
        listingId: listing.id,
        name: body.name,
        phone: body.phone,
        email: body.email ?? null,
        message: body.message ?? null
      }
    });

    await prisma.notification.create({
      data: {
        propertyId: listing.propertyId,
        title: "New listing enquiry",
        content: `${body.name} asked about your property.`,
        category: "ENQUIRY"
      }
    });

    return reply.status(201).send(ok(toEnquiryDto(enquiry)));
  });

  app.get("/properties/:propertyId/enquiries", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { propertyId: string };
    await assertPropertyAccess(request, params.propertyId, "property:read");
    const enquiries = await prisma.enquiry.findMany({
      where: { propertyId: params.propertyId },
      orderBy: { createdAt: "desc" }
    });
    return ok(enquiries.map(toEnquiryDto));
  });

  app.put("/enquiries/:id", { preHandler: [app.authenticateOwnerOrStaff] }, async (request) => {
    const params = request.params as { id: string };
    const body = enquiryUpdateSchema.parse(request.body);
    const existing = await prisma.enquiry.findUnique({ where: { id: params.id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Enquiry not found");
    await assertPropertyAccess(request, existing.propertyId, "property:write");
    const enquiry = await prisma.enquiry.update({
      where: { id: params.id },
      data: { status: body.status }
    });
    return ok(toEnquiryDto(enquiry));
  });
}

async function ensureListing(propertyId: string) {
  const property = await prisma.property.findUnique({ where: { id: propertyId }, include: { settings: true } });
  if (!property) throw new AppError(404, "PROPERTY_NOT_FOUND", "Property not found");

  return prisma.propertyListing.upsert({
    where: { propertyId },
    update: {},
    create: {
      propertyId,
      slug: `${slugify(property.name)}-${property.id.slice(0, 8)}`,
      title: property.name,
      description: `${property.type} in ${property.city}`,
      contactPhone: property.settings?.contactPhone ?? null
    }
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "property";
}

function toListingDto(input: {
  id: string;
  propertyId: string;
  slug: string;
  title: string;
  description: string | null;
  contactPhone: string | null;
  isEnabled: boolean;
  amenities: string[];
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...input,
    publicUrl: `/pg/${input.slug}`,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString()
  };
}

function toEnquiryDto(input: {
  id: string;
  propertyId: string;
  listingId: string | null;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
  status: "NEW" | "CONTACTED" | "CLOSED";
  source: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...input,
    createdAt: input.createdAt.toISOString(),
    updatedAt: input.updatedAt.toISOString()
  };
}
