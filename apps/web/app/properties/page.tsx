"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building, Plus, MapPin, Loader2 } from "lucide-react";
import { useProperty } from "@/lib/PropertyContext";
import { CreatePropertyModal } from "@/components/properties/CreatePropertyModal";

export default function PropertiesPage() {
  const { authorized } = useRequireRole("OWNER");
  const { properties, loading: propLoading, refetch } = useProperty();
  const [showModal, setShowModal] = useState(false);
  
  if (propLoading) return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/properties">
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
              <Card key={prop.id} className="shadow-float border-border/80 hover:border-primary/40 transition-all cursor-pointer group">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">{prop.name}</CardTitle>
                    <span className="text-xs font-bold bg-secondary px-2 py-1 rounded-md text-muted-foreground uppercase">{prop.type}</span>
                  </div>
                  <CardDescription className="flex items-center gap-1 mt-1 pb-1">
                    <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{prop.city}, {prop.state}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 bg-secondary/10 flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Address</span>
                      <span className="text-sm font-medium truncate w-[200px]">{prop.address} - {prop.pinCode}</span>
                   </div>
                   <Button variant="ghost" size="sm" className="hidden group-hover:flex">Manage</Button>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-border rounded-xl">
               <Building className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
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
      </div>
    </DashboardLayout>
  );
}
