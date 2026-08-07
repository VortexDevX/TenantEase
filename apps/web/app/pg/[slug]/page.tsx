import { notFound } from "next/navigation";
import { Building2, IndianRupee, MapPin, Users } from "lucide-react";
import type { PublicListingDto } from "@tenantease/types";
import { formatPaisa } from "@/lib/format";
import { EnquiryForm } from "./EnquiryForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getListing(slug: string) {
  const res = await fetch(`${API_URL}/listings/${slug}`, { cache: "no-store" });
  if (res.status === 404) return null;
  const json = await res.json();
  if (!res.ok || json.success === false) return null;
  return json.data as PublicListingDto;
}

export default async function PublicListingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const listing = await getListing(slug);
  if (!listing) notFound();

  const rentText = listing.property.rentMin === null
    ? "Rent on request"
    : listing.property.rentMin === listing.property.rentMax
      ? formatPaisa(listing.property.rentMin)
      : `${formatPaisa(listing.property.rentMin)} - ${formatPaisa(listing.property.rentMax ?? listing.property.rentMin)}`;

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_380px]">
        <section className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-strong">TenantEase Listing</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">{listing.title}</h1>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {listing.property.address}, {listing.property.city}, {listing.property.state} {listing.property.pinCode}
              </p>
            </div>
          </div>

          {listing.description ? <p className="mt-6 max-w-3xl text-base leading-7 text-foreground">{listing.description}</p> : null}

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <IndianRupee className="mb-2 h-5 w-5 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rent</p>
              <p className="mt-1 text-lg font-bold text-foreground">{rentText}</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <Users className="mb-2 h-5 w-5 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vacancy</p>
              <p className="mt-1 text-lg font-bold text-foreground">{listing.property.vacantBeds}/{listing.property.totalBeds} beds</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <Building2 className="mb-2 h-5 w-5 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Type</p>
              <p className="mt-1 text-lg font-bold text-foreground">{listing.property.type}</p>
            </div>
          </div>

          {listing.amenities.length > 0 ? (
            <div className="mt-6">
              <p className="text-sm font-bold text-foreground">Amenities</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {listing.amenities.map((amenity) => (
                  <span key={amenity} className="rounded-full border border-border bg-secondary px-3 py-1 text-sm font-semibold text-foreground">{amenity}</span>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside>
          <EnquiryForm slug={slug} />
        </aside>
      </div>
    </main>
  );
}
