"use client";

import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { Plus, Megaphone, Loader2, AlertCircle, Calendar } from "lucide-react";
import { AnnouncementModal } from "@/components/announcements/AnnouncementModal";
import { useRequireRole } from "@/contexts/AuthContext";

type AnnouncementCategory = "GENERAL" | "MAINTENANCE" | "PAYMENT" | "RULE_CHANGE" | "EMERGENCY";

interface AnnouncementDto {
  id: string;
  propertyId: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  isImportant: boolean;
  targetFloor: number | null;
  targetRoomId: string | null;
  createdAt: string;
  readCount: number;
}

function AnnouncementsContent() {
  const { activeProperty, loading: propLoading } = useProperty();
  const propertyId = activeProperty?.id;
  const [showModal, setShowModal] = useState(false);

  const { data: announcements, loading, refetch } = useApi<AnnouncementDto[]>(
    propertyId ? `/properties/${propertyId}/announcements` : null
  );

  const isLoading = propLoading || loading;

  const getCategoryBadge = (category: AnnouncementCategory) => {
    switch (category) {
      case "EMERGENCY": return <Badge variant="destructive">Emergency</Badge>;
      case "MAINTENANCE": return <Badge variant="warning">Maintenance</Badge>;
      case "PAYMENT": return <Badge variant="success">Payment</Badge>;
      case "RULE_CHANGE": return <Badge variant="secondary">Rule Change</Badge>;
      default: return <Badge variant="outline">General</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {showModal && propertyId && (
        <AnnouncementModal
          propertyId={propertyId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            refetch();
          }}
        />
      )}

      {/* Header & Actions */}
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary" />
            Announcements
          </h1>
          <p className="text-muted-foreground font-medium text-sm mt-1">
            {isLoading ? "Loading..." : `Broadcast messages to your tenants.`}
          </p>
        </div>
        <Button onClick={() => setShowModal(true)} disabled={!propertyId} className="shadow-float">
           <Plus className="mr-2" size={18} /> Post Announcement
        </Button>
      </section>

      {/* List Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-secondary/20">
          <p className="text-muted-foreground font-medium text-center">No announcements posted yet.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-4 pb-10">
           {announcements.map((a, idx) => (
             <Card key={a.id} className={`overflow-hidden animate-slide-up ${a.isImportant ? 'border-destructive/50 ring-1 ring-destructive/20' : ''}`} style={{ animationDelay: `${idx * 40}ms` }}>
                <CardContent className="p-5 flex flex-col gap-3">
                   <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-col gap-1.5">
                         <div className="flex items-center gap-2">
                            {a.isImportant && <AlertCircle className="w-4 h-4 text-destructive" />}
                            <h3 className="font-bold text-lg text-foreground">{a.title}</h3>
                         </div>
                         <div className="flex flex-wrap items-center gap-2 mt-1">
                           {getCategoryBadge(a.category)}
                           {a.targetFloor !== null && <Badge variant="outline">Floor {a.targetFloor}</Badge>}
                           {a.targetRoomId && <Badge variant="outline">Specific Room</Badge>}
                           <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                             <Calendar size={12} /> {new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(a.createdAt))}
                           </span>
                         </div>
                      </div>
                   </div>
                   
                   <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed bg-secondary/10 p-4 rounded-lg border border-border/50">
                     {a.content}
                   </p>

                   <div className="flex justify-between items-center mt-2 border-t border-border pt-3">
                     <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-primary/20 text-primary-strong flex items-center justify-center border border-primary/30">✓</span> 
                        Read by {a.readCount} tenant{a.readCount === 1 ? '' : 's'}
                     </div>
                   </div>
                </CardContent>
             </Card>
           ))}
        </section>
      )}
    </div>
  );
}

export default function AnnouncementsPage() {
  const { authorized } = useRequireRole("OWNER");
  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/announcements">
      <AnnouncementsContent />
    </DashboardLayout>
  );
}
