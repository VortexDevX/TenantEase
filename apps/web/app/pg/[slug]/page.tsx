import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, BedDouble, Building2, Check, IndianRupee, MapPin } from "lucide-react";
import type { PublicListingDto } from "@tenantease/types";
import { Brand } from "@/components/shared/Brand";
import { apiUrl } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { EnquiryForm } from "./EnquiryForm";

async function getListing(slug: string): Promise<PublicListingDto | null> {
  const result = await fetch(apiUrl(`/listings/${encodeURIComponent(slug)}`), {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (result.status === 404) return null;
  if (!result.ok) throw new Error("Listing service unavailable");
  return (await result.json()).data;
}

const propertyTypes: Record<PublicListingDto["property"]["type"], string> = {
  PG: "Paying guest",
  HOSTEL: "Hostel",
  FLAT: "Flat",
  HOUSE: "House",
};

export default async function PublicListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let listing: PublicListingDto | null;
  try {
    listing = await getListing(slug);
  } catch {
    return (
      <main className="listing-page">
        <Brand href="/login" />
        <h1 className="mt-10 text-3xl font-bold">Listing temporarily unavailable</h1>
        <p className="mt-2 text-muted-foreground">Reload the page to try again.</p>
      </main>
    );
  }
  if (!listing) notFound();

  const { property } = listing;
  const rent = property.rentMin === null ? "On request" : formatPaisa(property.rentMin);
  const rentRange = property.rentMax !== null && property.rentMax !== property.rentMin ? ` – ${formatPaisa(property.rentMax)}` : "";

  return (
    <main className="listing-page">
      <header className="listing-brand">
        <Brand href="/login" />
        <Link href="/login" className="dashboard-link">Sign in<ArrowUpRight size={15} aria-hidden="true" /></Link>
      </header>
      <div className="listing-hero">
        <span className="listing-type"><Building2 size={16} aria-hidden="true" />{propertyTypes[property.type] ?? property.type}</span>
        <h1>{listing.title}</h1>
        <p><MapPin size={17} aria-hidden="true" /><span>{property.address}, {property.city}, {property.state} {property.pinCode}</span></p>
      </div>
      <div className="listing-content">
        <div className="min-w-0 space-y-4">
          <section className="listing-facts" aria-label="Rent and availability">
            <div><IndianRupee size={19} aria-hidden="true" /><span>Monthly rent</span><strong>{rent}{rentRange}</strong></div>
            <div><BedDouble size={19} aria-hidden="true" /><span>Beds available</span><strong>{property.vacantBeds} of {property.totalBeds}</strong></div>
          </section>
          {listing.description && (
            <section className="dashboard-panel">
              <h2 className="mb-3 text-xl font-bold tracking-tight">About this property</h2>
              <p className="whitespace-pre-line break-words leading-7 text-muted-foreground">{listing.description}</p>
            </section>
          )}
          {listing.amenities.length > 0 && (
            <section className="dashboard-panel">
              <h2 className="mb-3 text-xl font-bold tracking-tight">Amenities</h2>
              <ul className="flex flex-wrap gap-2">
                {listing.amenities.map((amenity, index) => (
                  <li key={`${amenity}-${index}`} className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-sm">
                    <Check size={14} aria-hidden="true" />{amenity}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <EnquiryForm slug={slug} />
      </div>
    </main>
  );
}
