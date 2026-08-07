"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building, Plus, MapPin, Loader2, ExternalLink } from "lucide-react";
import { useProperty } from "@/lib/PropertyContext";
import { fetchApi } from "@/lib/api-client";
import { paisaToRupeesInput, rupeesToPaisa } from "@/lib/money";
import { CreatePropertyModal } from "@/components/properties/CreatePropertyModal";
import type { EnquiryDto, PropertyListingDto, PropertySettingsDto } from "@tenantease/types";

function PropertiesContent() {
  const { properties, loading: propLoading, refetch, setActivePropertyId, activeProperty } = useProperty();
  const [showModal, setShowModal] = useState(false);
  const [settings, setSettings] = useState<PropertySettingsDto | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [listing, setListing] = useState<PropertyListingDto | null>(null);
  const [savedListing, setSavedListing] = useState<PropertyListingDto | null>(null);
  const [enquiries, setEnquiries] = useState<EnquiryDto[]>([]);
  const [listingSaving, setListingSaving] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup") === "property" && properties.length === 0 && !propLoading) {
      setShowModal(true);
    }
  }, [properties.length, propLoading]);

  useEffect(() => {
    if (!activeProperty?.id) return;
    fetchApi<PropertySettingsDto>(`/properties/${activeProperty.id}/settings`)
      .then(setSettings)
      .catch(() => setSettings(null));
    fetchApi<PropertyListingDto>(`/properties/${activeProperty.id}/listing`)
      .then((item) => {
        setListing(item);
        setSavedListing(item);
      })
      .catch(() => {
        setListing(null);
        setSavedListing(null);
      });
    fetchApi<EnquiryDto[]>(`/properties/${activeProperty.id}/enquiries`)
      .then(setEnquiries)
      .catch(() => setEnquiries([]));
  }, [activeProperty?.id]);

  async function saveSettings() {
    if (!activeProperty?.id || !settings) return;
    setSettingsSaving(true);
    try {
      const saved = await fetchApi<PropertySettingsDto>(`/properties/${activeProperty.id}/settings`, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(saved);
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveListing() {
    if (!activeProperty?.id || !listing) return;
    setListingSaving(true);
    try {
      const saved = await fetchApi<PropertyListingDto>(`/properties/${activeProperty.id}/listing`, {
        method: "PUT",
        body: JSON.stringify({
          title: listing.title,
          description: listing.description,
          contactPhone: listing.contactPhone,
          isEnabled: listing.isEnabled,
          amenities: listing.amenities
        })
      });
      setListing(saved);
      setSavedListing(saved);
    } finally {
      setListingSaving(false);
    }
  }

  async function updateEnquiryStatus(enquiry: EnquiryDto, status: EnquiryDto["status"]) {
    const saved = await fetchApi<EnquiryDto>(`/enquiries/${enquiry.id}`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
    setEnquiries((items) => items.map((item) => item.id === saved.id ? saved : item));
  }

  const listingDirty = Boolean(
    listing &&
    savedListing &&
    (
      listing.title !== savedListing.title ||
      listing.description !== savedListing.description ||
      listing.contactPhone !== savedListing.contactPhone ||
      listing.isEnabled !== savedListing.isEnabled ||
      listing.amenities.join("\n") !== savedListing.amenities.join("\n")
    )
  );
  const canOpenPublicListing = Boolean(savedListing?.isEnabled && !listingDirty);
  
  if (propLoading) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );

  return (
    <>
      {showModal && (
        <CreatePropertyModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            refetch();
          }}
        />
      )}

      <div className="flex flex-col gap-6 animate-fade-in pb-10">
        <div className="flex justify-between items-end">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Building className="w-8 h-8 text-primary" /> Properties
            </h1>
            <p className="text-muted-foreground font-medium mt-1">
              Manage all your PGs, hostels, and flats.
            </p>
          </section>
          <Button onClick={() => setShowModal(true)} className="rounded-xl shadow-soft">
            <Plus className="w-4 h-4 mr-2" /> Add Property
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mt-4">
          {properties.length > 0 ? (
            properties.map((prop) => (
              <Card key={prop.id} className="shadow-float border-white/[0.06] hover:border-primary/40 transition-all cursor-pointer group overflow-hidden">
                <CardHeader className="pb-3 border-b border-white/[0.04]">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">{prop.name}</CardTitle>
                    <span className="text-xs font-bold bg-white/[0.04] border border-white/[0.06] px-2 py-1 rounded-md text-muted-foreground uppercase">{prop.type}</span>
                  </div>
                  <CardDescription className="flex items-center gap-1 mt-1 pb-1">
                    <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate text-muted-foreground">{prop.city}, {prop.state}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 bg-white/[0.01] flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</span>
                      <span className="text-sm font-medium truncate w-[200px] text-foreground">{prop.address} - {prop.pinCode}</span>
                   </div>
                   <div className="hidden items-center gap-2 group-hover:flex">
                     <Button
                       variant={activeProperty?.id === prop.id ? "default" : "ghost"}
                       size="sm"
                       onClick={() => setActivePropertyId(prop.id)}
                     >
                       {activeProperty?.id === prop.id ? "Active" : "Set Active"}
                     </Button>
                     <Link href="/">
                       <Button variant="ghost" size="sm" onClick={() => setActivePropertyId(prop.id)}>
                         Open
                       </Button>
                     </Link>
                   </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-white/[0.08] rounded-xl bg-white/[0.01]">
               <Building className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
               <h3 className="text-lg font-bold">No Properties Found</h3>
               <p className="text-muted-foreground text-sm max-w-sm mx-auto mt-2 mb-4">
                 You haven't added any properties yet. Click the Add Property button to get started.
               </p>
               <Button onClick={() => setShowModal(true)} variant="outline">
                 <Plus className="w-4 h-4 mr-2" /> Quick Add Property
               </Button>
            </div>
          )}
        </div>

        {activeProperty && settings && (
          <Card className="shadow-soft">
            <CardHeader className="border-b border-white/[0.04]">
              <CardTitle className="text-lg">Property Settings</CardTitle>
              <CardDescription>Rent due date, late fees, and receipt details for {activeProperty.name}.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-5 p-6">
              <div>
                <label htmlFor="setting-due-day" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due Day</label>
                <Input id="setting-due-day" type="number" min={1} max={28} value={settings.rentDueDay} onChange={(e) => setSettings({ ...settings, rentDueDay: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="setting-late-fee" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Late Fee</label>
                <Input id="setting-late-fee" type="number" min={0} step="0.01" value={paisaToRupeesInput(settings.lateFeePerDay)} onChange={(e) => setSettings({ ...settings, lateFeePerDay: rupeesToPaisa(e.target.value || "0") })} />
              </div>
              <div>
                <label htmlFor="setting-grace-days" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Grace Days</label>
                <Input id="setting-grace-days" type="number" min={0} max={30} value={settings.lateFeeGraceDays} onChange={(e) => setSettings({ ...settings, lateFeeGraceDays: Number(e.target.value) })} />
              </div>
              <div>
                <label htmlFor="setting-owner-pan" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Owner PAN</label>
                <Input id="setting-owner-pan" value={settings.ownerPan ?? ""} onChange={(e) => setSettings({ ...settings, ownerPan: e.target.value.toUpperCase() || null })} />
              </div>
              <div>
                <label htmlFor="setting-contact" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact</label>
                <Input id="setting-contact" value={settings.contactPhone ?? ""} onChange={(e) => setSettings({ ...settings, contactPhone: e.target.value || null })} />
              </div>
              <div className="md:col-span-5 flex justify-end">
                <Button onClick={saveSettings} disabled={settingsSaving}>
                  {settingsSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeProperty && listing && (
          <Card className="shadow-soft">
            <CardHeader className="border-b border-white/[0.04]">
              <CardTitle className="text-lg">Public Listing</CardTitle>
              <CardDescription>Publish vacancy details and capture enquiries for {activeProperty.name}.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 p-6">
              <div>
                <label htmlFor="listing-title" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Title</label>
                <Input id="listing-title" value={listing.title} onChange={(e) => setListing({ ...listing, title: e.target.value })} />
              </div>
              <div>
                <label htmlFor="listing-contact" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Phone</label>
                <Input id="listing-contact" value={listing.contactPhone ?? ""} onChange={(e) => setListing({ ...listing, contactPhone: e.target.value || null })} />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="listing-description" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
                <textarea
                  id="listing-description"
                  rows={3}
                  value={listing.description ?? ""}
                  onChange={(e) => setListing({ ...listing, description: e.target.value || null })}
                  className="flex w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="listing-amenities" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amenities</label>
                <Input
                  id="listing-amenities"
                  value={listing.amenities.join(", ")}
                  onChange={(e) => setListing({ ...listing, amenities: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) })}
                  placeholder="WiFi, meals, laundry"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="listing-enabled"
                  type="checkbox"
                  checked={listing.isEnabled}
                  onChange={(e) => setListing({ ...listing, isEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-white/[0.08] bg-white/[0.04] text-primary focus:ring-primary/50"
                />
                <label htmlFor="listing-enabled" className="text-sm font-semibold text-foreground">Publish listing</label>
              </div>
              <div className="flex justify-end gap-3">
                {canOpenPublicListing && savedListing ? (
                  <Link href={savedListing.publicUrl} target="_blank">
                    <Button variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Open Public Page</Button>
                  </Link>
                ) : null}
                {listing.isEnabled && listingDirty ? (
                  <Button variant="outline" disabled>Save before opening</Button>
                ) : null}
                <Button onClick={saveListing} disabled={listingSaving}>
                  {listingSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Listing
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeProperty && (
          <Card className="shadow-soft">
            <CardHeader className="border-b border-white/[0.04]">
              <CardTitle className="text-lg">Listing Enquiries</CardTitle>
              <CardDescription>{enquiries.length} enquiry{enquiries.length === 1 ? "" : "ies"} from public vacancy pages.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {enquiries.length === 0 ? (
                <p className="rounded-lg bg-white/[0.02] border border-white/[0.04] px-4 py-6 text-center text-sm font-medium text-muted-foreground">No enquiries yet.</p>
              ) : (
                <div className="space-y-3">
                  {enquiries.map((enquiry) => (
                    <div key={enquiry.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-bold text-foreground">{enquiry.name}</p>
                          <p className="mt-1 text-sm font-medium text-muted-foreground">{enquiry.phone}{enquiry.email ? ` · ${enquiry.email}` : ""}</p>
                          {enquiry.message ? <p className="mt-2 text-sm text-foreground">{enquiry.message}</p> : null}
                        </div>
                        <select
                          value={enquiry.status}
                          onChange={(e) => updateEnquiryStatus(enquiry, e.target.value as EnquiryDto["status"])}
                          className="h-9 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 outline-none"
                        >
                          <option value="NEW">New</option>
                          <option value="CONTACTED">Contacted</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default function PropertiesPage() {
  const { authorized } = useRequireRole("OWNER");
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/properties">
      <PropertiesContent />
    </DashboardLayout>
  );
}
