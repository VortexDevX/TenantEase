"use client";

import { TenantLayout } from "@/components/layout/TenantLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useApi } from "@/lib/useApi";
import { fetchApi } from "@/lib/api-client";
import { Megaphone, Loader2, AlertCircle, Calendar, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useRequireRole } from "@/contexts/AuthContext";

type AnnouncementCategory = "GENERAL" | "MAINTENANCE" | "PAYMENT" | "RULE_CHANGE" | "EMERGENCY";

interface TenantAnnouncementDto {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  isImportant: boolean;
  createdAt: string;
  isRead: boolean;
}

function TenantAnnouncementsContent() {
  const { data: announcements, loading, refetch } = useApi<TenantAnnouncementDto[]>("/tenant-portal/announcements");
  const [markingId, setMarkingId] = useState<string | null>(null);

  const getCategoryBadge = (category: AnnouncementCategory) => {
    switch (category) {
      case "EMERGENCY": return <Badge variant="destructive">Emergency</Badge>;
      case "MAINTENANCE": return <Badge variant="warning">Maintenance</Badge>;
      case "PAYMENT": return <Badge variant="success">Payment</Badge>;
      case "RULE_CHANGE": return <Badge variant="secondary">Rule</Badge>;
      default: return <Badge variant="outline">General</Badge>;
    }
  };

  const handleMarkAsRead = async (id: string, isRead: boolean) => {
    if (isRead || markingId) return;
    setMarkingId(id);
    try {
      await fetchApi(`/tenant-portal/announcements/${id}/read`, { method: "POST" });
      refetch(); // Reload to reflect changes
    } catch (e) {
      console.error(e);
    } finally {
      setMarkingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-10">
      {/* Header */}
      <section className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Megaphone className="w-8 h-8 text-primary" />
          Notice Board
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          Important updates and announcements from property management.
        </p>
      </section>

      {/* List Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-secondary/20">
          <p className="text-muted-foreground font-medium text-center">No new announcements at this time.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
           {announcements.map((a, idx) => (
             <Card 
               key={a.id} 
               className={`overflow-hidden transition-all ${a.isImportant ? 'border-destructive/50 ring-1 ring-destructive/20' : ''} ${!a.isRead ? 'bg-primary/5 shadow-md scale-[1.01]' : 'opacity-80 scale-100 hover:opacity-100'} cursor-pointer hover:shadow-lg`} 
               onClick={() => handleMarkAsRead(a.id, a.isRead)}
               style={{ animationDelay: `${idx * 40}ms` }}
             >
                <CardContent className="p-5 flex flex-col gap-3">
                   <div className="flex justify-between items-start gap-4">
                      <div className="flex flex-col gap-1.5 w-full">
                         <div className="flex justify-between items-start w-full">
                           <div className="flex items-center gap-2">
                              {!a.isRead && <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse mr-1 border border-background shadow-sm" />}
                              {a.isImportant && <AlertCircle className="w-4 h-4 text-destructive" />}
                              <h3 className={`font-bold text-lg text-foreground ${!a.isRead ? '' : 'text-muted-foreground'}`}>{a.title}</h3>
                           </div>
                           
                           {/* Mark as read indicator */}
                           {a.isRead ? (
                             <span className="text-xs font-semibold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-border">
                               <CheckCircle2 className="w-3 h-3"/> Read
                             </span>
                           ) : markingId === a.id ? (
                             <Loader2 className="w-4 h-4 text-primary animate-spin" />
                           ) : (
                             <span className="text-[10px] font-bold text-primary-strong uppercase tracking-wider bg-primary/10 px-2 flex items-center h-5 border border-primary/20 rounded-md">
                               New
                             </span>
                           )}
                         </div>

                         <div className="flex flex-wrap items-center gap-2 mt-1">
                           {getCategoryBadge(a.category)}
                           <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
                             <Calendar size={12} /> {new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(a.createdAt))}
                           </span>
                         </div>
                      </div>
                   </div>
                   
                   <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed bg-background/50 p-4 rounded-xl border border-border/50">
                     {a.content}
                   </p>
                </CardContent>
             </Card>
           ))}
        </section>
      )}
    </div>
  );
}

export default function TenantAnnouncementsPage() {
  const { authorized } = useRequireRole("TENANT");
  if (!authorized) return null;

  return (
    <TenantLayout activePath="/tenant/announcements">
      <TenantAnnouncementsContent />
    </TenantLayout>
  );
}
