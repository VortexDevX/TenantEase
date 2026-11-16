"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowUpRight, BedDouble, Building, Plus, MapPin, Loader2, ExternalLink } from "lucide-react";
import { useProperty } from "@/lib/PropertyContext";
import { fetchApi } from "@/lib/api-client";
import { paisaToRupeesInput, rupeesToPaisa } from "@/lib/money";
import { CreatePropertyModal } from "@/components/properties/CreatePropertyModal";
import type { EnquiryDto, PropertyListingDto, PropertySettingsDto } from "@tenantease/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";

function PropertiesContent() {
  const { properties, loading: propLoading, refetch, setActivePropertyId, activeProperty } = useProperty();
  const [showModal, setShowModal] = useState(false);
  const [settings, setSettings] = useState<PropertySettingsDto | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [listing, setListing] = useState<PropertyListingDto | null>(null);
  const [savedListing, setSavedListing] = useState<PropertyListingDto | null>(null);
  const [amenitiesDraft, setAmenitiesDraft] = useState("");
  const [enquiries, setEnquiries] = useState<EnquiryDto[]>([]);
  const [listingSaving, setListingSaving] = useState(false);
  const [status, setStatus] = useState<{ error: boolean; text: string } | null>(null);

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
        setAmenitiesDraft(item.amenities.join("\n"));
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
    setStatus(null);
    try {
      const saved = await fetchApi<PropertySettingsDto>(`/properties/${activeProperty.id}/settings`, {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings(saved);
      setStatus({ error: false, text: "Property settings saved." });
    } catch (err) {
      setStatus({ error: true, text: err instanceof Error ? err.message : "Could not save property settings." });
    } finally {
      setSettingsSaving(false);
    }
  }

  async function saveListing() {
    if (!activeProperty?.id || !listing) return;
    setListingSaving(true);
    setStatus(null);
    try {
      const saved = await fetchApi<PropertyListingDto>(`/properties/${activeProperty.id}/listing`, {
        method: "PUT",
        body: JSON.stringify({
          title: listing.title,
          description: listing.description,
          contactPhone: listing.contactPhone,
          isEnabled: listing.isEnabled,
          amenities: amenitiesDraft.split("\n").map((item) => item.trim()).filter(Boolean)
        })
      });
      setListing(saved);
      setSavedListing(saved);
      setAmenitiesDraft(saved.amenities.join("\n"));
      setStatus({ error: false, text: "Listing saved." });
    } catch (err) {
      setStatus({ error: true, text: err instanceof Error ? err.message : "Could not save listing." });
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
      amenitiesDraft !== savedListing.amenities.join("\n")
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
        <PageHeader title="Properties" description="Manage property settings, availability and public listings."
          actions={<Button onClick={() => setShowModal(true)}><Plus size={17} aria-hidden="true" /> Add property</Button>} />
        {status && <p role={status.error ? "alert" : "status"}
          className={`rounded-lg px-4 py-3 text-sm ${status.error ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success"}`}>
          {status.text}
        </p>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {properties.length > 0 ? (
            properties.map((prop) => (
              <Card key={prop.id} className="flex flex-col">
                <CardHeader className="grow">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="dashboard-row-icon"><Building size={18} aria-hidden="true" /></span>
                    <span className="rounded-md bg-secondary px-2 py-1 text-xs font-semibold text-muted-foreground">{prop.type}</span>
                  </div>
                  <CardTitle className="text-xl">{prop.name}</CardTitle>
                  <CardDescription className="flex items-start gap-1.5">
                    <MapPin size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                    <span className="break-words">{prop.address}, {prop.city}, {prop.state} {prop.pinCode}</span>
                  </CardDescription>
                  <p className="mt-3 flex items-center gap-2 text-sm font-medium"><BedDouble size={16} aria-hidden="true" />{prop.vacantBeds} vacant · {prop.occupiedBeds} occupied</p>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
                  {activeProperty?.id === prop.id ? (
                    <span className="px-2 text-xs font-semibold text-primary">Active property</span>
                  ) : <Button variant="ghost" size="sm" onClick={() => setActivePropertyId(prop.id)}>Set active</Button>}
                  <Button asChild variant="outline" size="sm">
                    <Link href="/" onClick={() => setActivePropertyId(prop.id)}>Overview<ArrowUpRight size={14} aria-hidden="true" /></Link>
                  </Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <EmptyState className="col-span-full" title="No properties yet" icon={<Building size={23} aria-hidden="true" />}
              description="Add a property to start tracking rooms and rent." />
          )}
        </div>

        {activeProperty && settings && (
          <Card className="shadow-soft">
            <CardHeader className="border-b border-border">
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
            <CardHeader className="border-b border-border">
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
                  className="flex w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="listing-amenities" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amenities</label>
                <textarea
                  id="listing-amenities"
                  rows={3}
                  aria-describedby="amenities-help"
                  value={amenitiesDraft}
                  onChange={(e) => setAmenitiesDraft(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 text-base sm:text-sm"
                />
                <p id="amenities-help" className="mt-1 text-sm text-muted-foreground">Enter one amenity per line.</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="listing-enabled"
                  type="checkbox"
                  checked={listing.isEnabled}
                  onChange={(e) => setListing({ ...listing, isEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-border bg-secondary/50 text-primary focus:ring-primary/50"
                />
                <label htmlFor="listing-enabled" className="text-sm font-semibold text-foreground">Publish listing</label>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                {canOpenPublicListing && savedListing ? (
                  <Button asChild variant="outline">
                    <Link href={savedListing.publicUrl} target="_blank" rel="noopener"><ExternalLink size={16} aria-hidden="true" />Open public page</Link>
                  </Button>
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
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg">Listing Enquiries</CardTitle>
              <CardDescription>{enquiries.length} enquiry{enquiries.length === 1 ? "" : "ies"} from public vacancy pages.</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {enquiries.length === 0 ? (
                <p className="rounded-lg bg-secondary/50 border border-border px-4 py-6 text-center text-sm font-medium text-muted-foreground">No enquiries yet.</p>
              ) : (
                <div className="space-y-3">
                  {enquiries.map((enquiry) => (
                    <div key={enquiry.id} className="rounded-lg border border-border bg-secondary/50 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-bold text-foreground">{enquiry.name}</p>
                          <p className="mt-1 text-sm font-medium text-muted-foreground">{enquiry.phone}{enquiry.email ? ` · ${enquiry.email}` : ""}</p>
                          {enquiry.message ? <p className="mt-2 text-sm text-foreground">{enquiry.message}</p> : null}
                        </div>
                        <select
                          value={enquiry.status}
                          onChange={(e) => updateEnquiryStatus(enquiry, e.target.value as EnquiryDto["status"])}
                          className="h-9 rounded-lg border border-border bg-secondary/50 px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 outline-none"
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
