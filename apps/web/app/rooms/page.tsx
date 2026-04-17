"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPaisa } from "@/lib/format";
import { BedDouble, Plus, Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import type { RoomDto } from "@tenantease/types";

export default function RoomsPage() {
  const { authorized } = useRequireRole("OWNER");
  const { activeProperty } = useProperty();
  const [showModal, setShowModal] = useState(false);
  
  const { data: rooms, loading: roomsLoading, refetch } = useApi<RoomDto[]>(
    activeProperty ? `/properties/${activeProperty.id}/rooms` : null
  );

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
               <Input placeholder="Search Room Number..." className="pl-9 bg-card" />
            </div>
            <Button onClick={() => setShowModal(true)} disabled={!activeProperty} className="rounded-xl shadow-soft shrink-0">
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
              ) : rooms && rooms.length > 0 ? (
                 <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                       <thead className="bg-secondary/30 text-muted-foreground uppercase text-[11px] font-bold tracking-wider border-b border-border">
                          <tr>
                             <th className="p-4 font-semibold">Room No.</th>
                             <th className="p-4 font-semibold">Type</th>
                             <th className="p-4 font-semibold">Availability</th>
                             <th className="p-4 font-semibold">Monthly Rent</th>
                             <th className="p-4 font-semibold">Status</th>
                             <th className="p-4 font-semibold text-right">Actions</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-border">
                          {rooms.map(room => (
                            <tr key={room.id} className="hover:bg-secondary/20 transition-colors">
                               <td className="p-4 font-bold text-foreground text-base tracking-tight">{room.roomNumber}</td>
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
                <div className="py-16 text-center">
                    <BedDouble className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <h3 className="text-lg font-bold text-foreground">No Rooms In Inventory</h3>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">You have not added any rooms to this property.</p>
                    <Button variant="outline"><Plus className="w-4 h-4 mr-2" /> Quick Add Rooms</Button>
                </div>
              )}
           </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
