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
      case "EMERGENCY": return <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/20">Emergency</Badge>;
      case "MAINTENANCE": return <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20">Maintenance</Badge>;
      case "PAYMENT": return <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Payment</Badge>;
      case "RULE_CHANGE": return <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20">Rule Change</Badge>;
      default: return <Badge className="bg-violet-500/10 text-violet-400 border border-violet-500/20">General</Badge>;
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
          <Megaphone className="w-8 h-8 text-violet-400 animate-pulse" />
          Notice Board
        </h1>
        <p className="text-muted-foreground font-medium text-sm">
          Important updates and announcements from property management.
        </p>
      </section>

      {/* List Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
        </div>
      ) : !announcements || announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 border border-white/[0.06] bg-white/[0.01] rounded-2xl shadow-glass">
          <p className="text-muted-foreground font-semibold text-center">No new announcements at this time.</p>
        </div>
      ) : (
        <section className="flex flex-col gap-4">
           {announcements.map((a, idx) => {
             const isEmergency = a.category === "EMERGENCY" || a.isImportant;
             const bgClass = !a.isRead
               ? isEmergency
                 ? "bg-rose-500/[0.02] border-rose-500/30 shadow-glass-rose scale-[1.01]"
                 : "bg-violet-500/[0.02] border-violet-500/30 shadow-glow scale-[1.01]"
               : "bg-white/[0.01] border-white/[0.06] opacity-80 scale-100 hover:opacity-100 hover:border-white/[0.08]";

             return (
               <Card
                 key={a.id}
                 className={`overflow-hidden transition-all duration-300 border cursor-pointer hover:shadow-lg ${bgClass}`}
                 onClick={() => handleMarkAsRead(a.id, a.isRead)}
                 style={{ animationDelay: `${idx * 40}ms` }}
               >
                  <CardContent className="p-5 flex flex-col gap-3">
                     <div className="flex justify-between items-start gap-4">
                        <div className="flex flex-col gap-1.5 w-full">
                           <div className="flex justify-between items-start w-full gap-2">
                             <div className="flex items-center gap-2">
                                {!a.isRead && (
                                  <div className="w-2.5 h-2.5 bg-violet-400 rounded-full animate-pulse mr-1 border border-background shadow-glow" />
                                )}
                                {a.isImportant && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
                                <h3 className={`font-bold text-lg text-foreground ${!a.isRead ? '' : 'text-muted-foreground'}`}>{a.title}</h3>
                             </div>

                             {/* Mark as read indicator */}
                             {a.isRead ? (
                               <span className="text-[10px] font-bold text-muted-foreground bg-white/[0.04] px-2 py-1 rounded-md flex items-center gap-1 border border-white/[0.06] shrink-0">
                                 <CheckCircle2 className="w-3 h-3 text-muted-foreground"/> Read
                               </span>
                             ) : markingId === a.id ? (
                               <Loader2 className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
                             ) : (
                               <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider bg-violet-500/10 px-2 py-0.5 border border-violet-500/20 rounded-md shrink-0">
                                 New
                               </span>
                             )}
                           </div>

                           <div className="flex flex-wrap items-center gap-2 mt-1">
                             {getCategoryBadge(a.category)}
                             <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2 font-medium">
                               <Calendar size={12} className="text-violet-400/80" /> {new Intl.DateTimeFormat('en-IN', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(a.createdAt))}
                             </span>
                           </div>
                        </div>
                     </div>

                     <p className="text-sm font-semibold text-foreground/90 whitespace-pre-wrap leading-relaxed bg-white/[0.01] p-4 rounded-xl border border-white/[0.04]">
                       {a.content}
                     </p>
                  </CardContent>
               </Card>
             );
           })}
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
