"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaisa } from "@/lib/format";
import { BedDouble, Plus, Search, Loader2, List, Grid, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import type { RoomDto } from "@tenantease/types";

export default function RoomsPage() {
  const { authorized } = useRequireRole("OWNER");
  const { activeProperty } = useProperty();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  
  const { data: rooms, loading: roomsLoading, refetch } = useApi<RoomDto[]>(
    activeProperty ? `/properties/${activeProperty.id}/rooms` : null
  );

  const filteredRooms = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!rooms) {
      return [];
    }

    if (!query) {
      return rooms;
    }

    return rooms.filter((room) =>
      room.roomNumber.toLowerCase().includes(query) ||
      room.type.toLowerCase().includes(query) ||
      room.status.toLowerCase().includes(query)
    );
  }, [rooms, search]);

  const roomsByFloor = useMemo(() => {
    const grouped: Record<number, RoomDto[]> = {};
    filteredRooms.forEach(room => {
      const f = room.floor ?? 0;
      if (!grouped[f]) grouped[f] = [];
      grouped[f].push(room);
    });
    // Sort floors appropriately (assuming numeric, maybe ground floor is 0)
    return Object.fromEntries(
      Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b))
    );
  }, [filteredRooms]);

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/rooms">
      {showModal && activeProperty && (
        <CreateRoomModal 
           propertyId={activeProperty.id} 
           onClose={() => setShowModal(false)}
           onSuccess={() => {
             setShowModal(false);
             refetch();
           }}
        />
      )}

      <div className="flex flex-col gap-6 animate-fade-in pb-10">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <section>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <BedDouble className="w-8 h-8 text-primary" /> Rooms Inventory
            </h1>
            <p className="text-muted-foreground font-medium mt-1">
              Manage room availability, capacities, and base pricing.
            </p>
          </section>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-[250px]">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <Input
                 placeholder="Search room, type, or status..."
                 className="pl-9 bg-card"
                 value={search}
                 onChange={(event) => setSearch(event.target.value)}
               />
            </div>
            <div className="flex bg-secondary/50 rounded-xl p-1 shadow-soft h-10">
               <button 
                 onClick={() => setViewMode("list")} 
                 className={`flex items-center gap-2 px-3 rounded-lg text-sm font-semibold transition-colors ${viewMode === "list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
               >
                 <List className="w-4 h-4" />
               </button>
               <button 
                 onClick={() => setViewMode("grid")} 
                 className={`flex items-center gap-2 px-3 rounded-lg text-sm font-semibold transition-colors ${viewMode === "grid" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
               >
                 <Grid className="w-4 h-4" />
               </button>
            </div>
            <Button onClick={() => setShowModal(true)} disabled={!activeProperty} className="rounded-xl shadow-soft shrink-0 h-10">
              <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Room</span>
            </Button>
          </div>
        </div>

        <Card className="border-border/80 shadow-float">
           <CardContent className="p-0">
              {roomsLoading ? (
                 <div className="flex justify-center items-center py-20">
                   <Loader2 className="w-8 h-8 animate-spin text-primary" />
                 </div>
              ) : filteredRooms.length > 0 ? (
                  viewMode === "list" ? (
                     <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                           <thead className="bg-secondary/30 text-muted-foreground uppercase text-[11px] font-bold tracking-wider border-b border-border">
                              <tr>
                                 <th className="p-4 font-semibold">Room No.</th>
                                 <th className="p-4 font-semibold">Floor</th>
                                 <th className="p-4 font-semibold">Type</th>
                                 <th className="p-4 font-semibold">Availability</th>
                                 <th className="p-4 font-semibold">Monthly Rent</th>
                                 <th className="p-4 font-semibold">Status</th>
                                 <th className="p-4 font-semibold text-right">Actions</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border">
                              {filteredRooms.map(room => (
                                <tr key={room.id} className="hover:bg-secondary/20 transition-colors">
                                   <td className="p-4 font-bold text-foreground text-base tracking-tight">{room.roomNumber}</td>
                                   <td className="p-4 font-medium text-muted-foreground">{room.floor === 0 ? 'GF' : room.floor}</td>
                                   <td className="p-4 font-medium">{room.type}</td>
                                   <td className="p-4">
                                      <div className="flex items-center gap-2">
                                         <span className="font-bold text-foreground">{room.occupiedBeds}</span>
                                         <span className="text-muted-foreground">/ {room.bedCount} Beds</span>
                                      </div>
                                   </td>
                                   <td className="p-4 font-mono font-semibold">{formatPaisa(room.monthlyRent)}</td>
                                   <td className="p-4">
                                      <Badge variant={room.status === "VACANT" ? "success" : room.status === "OCCUPIED" ? "destructive" : "warning"}>
                                        {room.status}
                                      </Badge>
                                   </td>
                                   <td className="p-4 text-right">
                                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary-strong">Edit</Button>
                                   </td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  ) : (
                     <div className="flex flex-col gap-8 p-6 bg-secondary/10">
                       {Object.entries(roomsByFloor).map(([floor, fr]) => (
                         <div key={floor} className="flex flex-col gap-3">
                           <h3 className="font-bold text-foreground tracking-tight border-b border-border pb-2 flex items-center gap-2">
                             <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center text-sm font-black border border-border/50 text-muted-foreground">
                               {Number(floor) === 0 ? 'G' : floor}
                             </div>
                             Floor {Number(floor) === 0 ? 'Ground' : floor}
                             <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground ml-auto">
                               {fr.length} Rooms
                             </span>
                           </h3>
                           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                              {fr.map(room => {
                                const isVacant = room.status === "VACANT";
                                const isOccupied = room.status === "OCCUPIED";
                                
                                return (
                                 <div 
                                   key={room.id}
                                   className={`flex flex-col p-3 rounded-xl border-2 transition-all 
                                     ${isVacant ? 'bg-success/5 border-success/30 hover:border-success/50 hover:bg-success/10' : ''}
                                     ${isOccupied ? 'bg-destructive/5 border-destructive/20 hover:border-destructive/40' : ''}
                                     ${(!isVacant && !isOccupied) ? 'bg-warning/5 border-warning/40 hover:border-warning/60 hover:bg-warning/10' : ''}
                                   `}
                                 >
                                   <div className="flex justify-between items-start mb-2">
                                     <span className="font-black text-xl tracking-tighter text-foreground leading-none">{room.roomNumber}</span>
                                     {isVacant && <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />}
                                     {isOccupied && <span className="w-2 h-2 rounded-full bg-destructive/60" />}
                                   </div>
                                   
                                   <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                                     {room.type}
                                   </div>
                                   
                                   <div className="mt-auto flex items-center justify-between">
                                      <div className={`flex items-center gap-1.5 text-sm font-semibold rounded-md px-1.5 py-0.5
                                        ${isVacant ? 'text-success-foreground' : ''}
                                        ${isOccupied ? 'text-destructive-foreground' : ''}
                                        ${(!isVacant && !isOccupied) ? 'text-warning-foreground' : ''}
                                      `}>
                                        <Users size={14} className="opacity-70" />
                                        {room.occupiedBeds} / {room.bedCount}
                                      </div>
                                   </div>
                                 </div>
                                )
                              })}
                           </div>
                         </div>
                       ))}
                     </div>
                  )
              ) : (
                <div className="py-16 text-center">
                    <BedDouble className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-foreground">No Rooms In Inventory</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">You have not added any rooms to this property.</p>
                    <Button variant="outline" onClick={() => setShowModal(true)}><Plus className="w-4 h-4 mr-2" /> Quick Add Room</Button>
                </div>
              )}
           </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
