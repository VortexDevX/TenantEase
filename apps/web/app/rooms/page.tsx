"use client";

import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRoles } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BedDouble, Plus, Search, Loader2, List, Grid, Users, Pencil, Trash2, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CreateRoomModal } from "@/components/rooms/CreateRoomModal";
import type { RoomDto } from "@tenantease/types";

// Ledger Calm Shared Components
import { PageHeader } from "@/components/shared/PageHeader";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { StatusBadge, StatusBadgeType } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchApi } from "@/lib/api-client";

export default function RoomsPage() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/rooms">
      <RoomsContent />
    </DashboardLayout>
  );
}

function RoomsContent() {
  const { activeProperty, loading: propertyLoading } = useProperty();
  const [showModal, setShowModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomDto | null>(null);
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

  const loading = propertyLoading || roomsLoading;

  function closeModal() {
    setShowModal(false);
    setEditingRoom(null);
  }

  function openCreateModal() {
    setEditingRoom(null);
    setShowModal(true);
  }

  function openEditModal(room: RoomDto) {
    setEditingRoom(room);
    setShowModal(true);
  }

  async function deleteRoom(room: RoomDto) {
    if (room.occupiedBeds > 0) {
      window.alert("Move or vacate tenants before deleting this room.");
      return;
    }

    const confirmed = window.confirm(`Delete room ${room.roomNumber}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    try {
      await fetchApi(`/rooms/${room.id}`, { method: "DELETE" });
      refetch();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete room.");
    }
  }

  return (
    <>
      {showModal && activeProperty && (
        <CreateRoomModal
           propertyId={activeProperty.id}
           room={editingRoom}
           onClose={closeModal}
           onSuccess={() => {
             closeModal();
             refetch();
           }}
        />
      )}

      <div className="flex flex-col gap-6 animate-fade-in pb-10">

        <PageHeader
          title="Rooms Inventory"
          description="Manage room availability, capacities, and base pricing."
          actions={
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
              <Button onClick={openCreateModal} disabled={!activeProperty} className="rounded-xl shadow-soft shrink-0 h-10">
                <Plus className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Add Room</span>
              </Button>
            </div>
          }
        />

        <Card className="border-border/80 shadow-float">
           <CardContent className="p-0">
              {loading ? (
                 <div className="flex justify-center items-center py-20">
                   <Loader2 className="w-8 h-8 animate-spin text-primary" />
                 </div>
              ) : !activeProperty ? (
                <EmptyState
                  title="Select A Property First"
                  description="Rooms belong to a property. Add or select a property before creating rooms."
                  icon={<Building2 />}
                  action={
                    <Button variant="outline" asChild>
                      <a href="/properties">Go To Properties</a>
                    </Button>
                  }
                  className="py-16"
                />
              ) : filteredRooms.length > 0 ? (
                  viewMode === "list" ? (
                    <Table>
                      <TableHeader className="bg-secondary/30">
                        <TableRow>
                          <TableHead className="font-semibold">Room No.</TableHead>
                          <TableHead className="font-semibold">Floor</TableHead>
                          <TableHead className="font-semibold">Type</TableHead>
                          <TableHead className="font-semibold">Availability</TableHead>
                          <TableHead className="font-semibold text-right">Monthly Rent</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="font-semibold text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRooms.map(room => (
                          <TableRow key={room.id} className="hover:bg-secondary/20 transition-colors">
                            <TableCell className="font-bold text-foreground text-base tracking-tight">{room.roomNumber}</TableCell>
                            <TableCell className="font-medium text-muted-foreground">{room.floor === 0 ? 'GF' : room.floor}</TableCell>
                            <TableCell className="font-medium">{room.type}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">{room.occupiedBeds}</span>
                                <span className="text-muted-foreground">/ {room.bedCount} Beds</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <MoneyValue amount={room.monthlyRent} />
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={room.status as StatusBadgeType} />
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditModal(room)}
                                  className="text-primary hover:text-primary-strong"
                                >
                                  <Pencil className="w-4 h-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteRoom(room)}
                                  disabled={room.occupiedBeds > 0}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4 sm:mr-2" />
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                     <div className="flex flex-col gap-8 p-6 bg-white/[0.01]">
                       {Object.entries(roomsByFloor).map(([floor, fr]) => (
                         <div key={floor} className="flex flex-col gap-3">
                           <h3 className="font-bold text-foreground tracking-tight border-b border-white/[0.04] pb-2 flex items-center gap-2">
                             <div className="w-6 h-6 rounded-md bg-white/[0.04] flex items-center justify-center text-sm font-black border border-white/[0.08] text-muted-foreground">
                               {Number(floor) === 0 ? 'G' : floor}
                             </div>
                             Floor {Number(floor) === 0 ? 'Ground' : floor}
                             <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/[0.02] border border-white/[0.06] text-muted-foreground ml-auto">
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
                                   className={`flex flex-col p-3.5 rounded-xl border backdrop-blur-md transition-all duration-300
                                     ${isVacant ? 'bg-success-soft/10 border-success/20 hover:border-success/40 hover:bg-success-soft/15 shadow-glass-success' : ''}
                                     ${isOccupied ? 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1]' : ''}
                                     ${(!isVacant && !isOccupied) ? 'bg-warning-soft/10 border-warning/20 hover:border-warning/40 hover:bg-warning-soft/15 shadow-glass-warning' : ''}
                                   `}
                                 >
                                   <div className="flex justify-between items-start mb-2">
                                     <span className="font-black text-xl tracking-tighter text-foreground leading-none">{room.roomNumber}</span>
                                     {isVacant && <span className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />}
                                     {isOccupied && <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />}
                                     {!isVacant && !isOccupied && <span className="w-2 h-2 rounded-full bg-warning shadow-[0_0_8px_rgba(234,179,8,0.6)] animate-pulse" />}
                                   </div>

                                   <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
                                     {room.type}
                                   </div>

                                   <div className="mt-auto flex items-center justify-between gap-2">
                                      <div className={`flex items-center gap-1.5 text-sm font-semibold rounded-md px-1.5 py-0.5
                                        ${isVacant ? 'text-success' : ''}
                                        ${isOccupied ? 'text-muted-foreground' : ''}
                                        ${(!isVacant && !isOccupied) ? 'text-warning' : ''}
                                      `}>
                                        <Users size={14} className="opacity-70" />
                                        {room.occupiedBeds} / {room.bedCount}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditModal(room)}
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-white/[0.04]"
                                        aria-label={`Edit room ${room.roomNumber}`}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                   </div>
                                 </div>
                                );
                              })}
                           </div>
                         </div>
                       ))}
                     </div>
                  )
              ) : (
                <EmptyState
                  title="No Rooms In Inventory"
                  description="You have not added any rooms to this property."
                  icon={<BedDouble />}
                  action={
                    <Button variant="outline" onClick={openCreateModal}>
                      <Plus className="w-4 h-4 mr-2" /> Quick Add Room
                    </Button>
                  }
                  className="py-16"
                />
              )}
           </CardContent>
        </Card>
      </div>
    </>
  );
}
