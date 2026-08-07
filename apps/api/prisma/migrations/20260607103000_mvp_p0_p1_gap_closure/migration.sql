-- Tenant profile and document metadata
CREATE TYPE "TenantDocumentCategory" AS ENUM ('KYC', 'PHOTO', 'OTHER');
CREATE TYPE "EnquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

ALTER TABLE "Tenant"
  ADD COLUMN "emergencyContactName" TEXT,
  ADD COLUMN "emergencyContactPhone" TEXT,
  ADD COLUMN "emergencyContactRelation" TEXT,
  ADD COLUMN "aadhaarLast4" TEXT,
  ADD COLUMN "notes" TEXT;

ALTER TABLE "TenantDocument"
  ADD COLUMN "category" "TenantDocumentCategory" NOT NULL DEFAULT 'KYC';

ALTER TABLE "VacateRecord"
  ADD COLUMN "settlementPdfPath" TEXT;

-- Public listings and enquiries
CREATE TABLE "property_listings" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "contactPhone" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT false,
  "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "photos" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "property_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enquiries" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "listingId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "email" TEXT,
  "message" TEXT,
  "status" "EnquiryStatus" NOT NULL DEFAULT 'NEW',
  "source" TEXT NOT NULL DEFAULT 'public_listing',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "enquiries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "property_listings_propertyId_key" ON "property_listings"("propertyId");
CREATE UNIQUE INDEX "property_listings_slug_key" ON "property_listings"("slug");
CREATE INDEX "property_listings_isEnabled_idx" ON "property_listings"("isEnabled");
CREATE INDEX "enquiries_propertyId_status_idx" ON "enquiries"("propertyId", "status");
CREATE INDEX "enquiries_phone_propertyId_createdAt_idx" ON "enquiries"("phone", "propertyId", "createdAt");

ALTER TABLE "property_listings"
  ADD CONSTRAINT "property_listings_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enquiries"
  ADD CONSTRAINT "enquiries_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "enquiries"
  ADD CONSTRAINT "enquiries_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "property_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
