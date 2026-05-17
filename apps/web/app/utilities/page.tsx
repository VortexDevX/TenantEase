"use client";

import { useCallback, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useRequireRole } from "@/contexts/AuthContext";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPaisa } from "@/lib/format";
import { Loader2, Zap, Droplets, Send } from "lucide-react";
import type { RoomDto } from "@tenantease/types";

const UTILITY_TYPES = [
  { value: "ELECTRICITY", label: "Electricity", icon: Zap, color: "text-yellow-500" },
  { value: "WATER", label: "Water", icon: Droplets, color: "text-blue-500" },
] as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function UtilitiesPage() {
  const { authorized } = useRequireRole("OWNER");
  const { activeProperty } = useProperty();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedType, setSelectedType] = useState<string>("ELECTRICITY");
  const [ratePerUnit, setRatePerUnit] = useState(800); // paisa — ₹8 default
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<any>(null);

  // Room-level readings: roomId -> currentReading
  const [readings, setReadings] = useState<Record<string, string>>({});

  // Fetch rooms for this property
  const { data: rooms, loading: roomsLoading } = useApi<RoomDto[]>(
    activeProperty ? `/properties/${activeProperty.id}/rooms` : null
  );

  // Fetch existing readings for this month/year/type
  const readingsUrl = activeProperty
    ? `/properties/${activeProperty.id}/utilities?month=${selectedMonth}&year=${selectedYear}&type=${selectedType}`
    : null;
  const { data: existingReadings, loading: readingsLoading, refetch } = useApi<any[]>(readingsUrl);

  const existingByRoom = useMemo(() => {
    const map: Record<string, any> = {};
    if (existingReadings) {
      for (const r of existingReadings) {
        if (r.roomId) map[r.roomId] = r;
      }
    }
    return map;
  }, [existingReadings]);

  const handleReadingChange = useCallback((roomId: string, value: string) => {
    setReadings((prev) => ({ ...prev, [roomId]: value }));
  }, []);

  const handleSubmit = async () => {
    if (!activeProperty || !rooms) return;

    // Build readings array only for rooms with entered values
    const readingEntries = rooms
      .filter((room) => readings[room.id] && readings[room.id].trim() !== "")
      .map((room) => {
        const entry: any = {
          roomId: room.id,
          currentReading: parseInt(readings[room.id], 10),
        };
        const existing = existingByRoom[room.id];
        if (existing?.currentReading != null) {
          entry.previousReading = existing.currentReading;
        }
        return entry;
      });

    if (readingEntries.length === 0) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const token = localStorage.getItem("te_access_token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/properties/${activeProperty.id}/utilities`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            utilityType: selectedType,
            month: selectedMonth,
            year: selectedYear,
            billingModel: "INDIVIDUAL_METER",
            ratePerUnit,
            readings: readingEntries,
          }),
        }
      );
      const json = await res.json();
      if (json.success) {
        setSubmitResult(json);
        setReadings({});
        refetch();
      } else {
        setSubmitResult({ error: json.error?.message || "Submission failed" });
      }
    } catch {
      setSubmitResult({ error: "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!authorized) return null;

  const utilityConfig = UTILITY_TYPES.find((u) => u.value === selectedType) ?? UTILITY_TYPES[0];
  const UtilIcon = utilityConfig.icon;

  const totalCharge = existingReadings
    ? existingReadings.reduce((sum, r) => sum + r.totalCharge, 0)
    : 0;
  const totalUnits = existingReadings
    ? existingReadings.reduce((sum, r) => sum + (r.unitsConsumed ?? 0), 0)
    : 0;

  return (
    <DashboardLayout activePath="/utilities">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Utility Billing
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Record meter readings and apply charges to tenant rent entries.
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {/* Utility Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {UTILITY_TYPES.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>

              {/* Month */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Year */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              {/* Rate per Unit */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rate/Unit (₹)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={(ratePerUnit / 100).toFixed(2)}
                  onChange={(e) => setRatePerUnit(Math.round(parseFloat(e.target.value || "0") * 100))}
                  className="h-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {existingReadings && existingReadings.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5 pb-4 flex flex-col items-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Rooms Recorded</span>
                <span className="text-2xl font-bold text-foreground mt-1">{existingReadings.length}</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 pb-4 flex flex-col items-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Total Units</span>
                <span className="text-2xl font-bold text-foreground mt-1">{totalUnits}</span>
              </CardContent>
            </Card>
            <Card className="col-span-2 sm:col-span-1">
              <CardContent className="pt-5 pb-4 flex flex-col items-center">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Total Charge</span>
                <span className="text-2xl font-bold text-primary mt-1">{formatPaisa(totalCharge)}</span>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Submit Result */}
        {submitResult && (
          <Card className={submitResult.error ? "border-destructive" : "border-green-500"}>
            <CardContent className="pt-5 pb-4">
              {submitResult.error ? (
                <p className="text-destructive text-sm font-medium">❌ {submitResult.error}</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-green-600 text-sm font-semibold">✅ {submitResult.message || "Readings submitted successfully!"}</p>
                  {submitResult.data && (
                    <p className="text-sm text-muted-foreground">
                      {submitResult.data.totalRooms} rooms · {submitResult.data.totalUnits} units · {formatPaisa(submitResult.data.totalCharge)}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Room-wise Reading Entry */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <UtilIcon className={`w-5 h-5 ${utilityConfig.color}`} />
            <CardTitle className="text-base">
              Enter Meter Readings — {utilityConfig.label} ({MONTHS[selectedMonth - 1]} {selectedYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {roomsLoading || readingsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : !rooms || rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No rooms found. Add rooms to this property first.
              </p>
            ) : (
              <div className="space-y-4">
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-6 gap-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border">
                  <span>Room</span>
                  <span>Floor</span>
                  <span>Previous</span>
                  <span>Current</span>
                  <span>Units</span>
                  <span className="text-right">Charge</span>
                </div>

                {rooms.map((room) => {
                  const existing = existingByRoom[room.id];
                  const prevReading = existing?.currentReading ?? existing?.previousReading ?? 0;
                  const currentVal = readings[room.id] ?? "";
                  const currentNum = currentVal ? parseInt(currentVal, 10) : null;
                  const units = currentNum != null && currentNum >= prevReading ? currentNum - prevReading : null;
                  const charge = units != null ? units * ratePerUnit : null;

                  return (
                    <div
                      key={room.id}
                      className="grid grid-cols-3 sm:grid-cols-6 gap-3 items-center py-3 border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {room.roomNumber}
                        </Badge>
                      </div>
                      <span className="text-sm text-muted-foreground hidden sm:block">
                        {room.floor != null ? `Floor ${room.floor}` : "—"}
                      </span>
                      <span className="text-sm font-mono text-muted-foreground">
                        {existing ? (existing.currentReading ?? existing.previousReading ?? "—") : "—"}
                      </span>
                      <Input
                        type="number"
                        placeholder="Enter reading"
                        value={currentVal}
                        onChange={(e) => handleReadingChange(room.id, e.target.value)}
                        className="h-9 font-mono text-sm"
                        min={prevReading}
                      />
                      <span className="text-sm font-mono text-foreground hidden sm:block">
                        {units != null ? units : "—"}
                      </span>
                      <span className="text-sm font-semibold text-right hidden sm:block">
                        {charge != null ? formatPaisa(charge) : "—"}
                      </span>
                    </div>
                  );
                })}

                {/* Submit button */}
                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={submitting || Object.values(readings).filter(Boolean).length === 0}
                    className="gap-2"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Submit Readings
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Existing Readings Table */}
        {existingReadings && existingReadings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recorded Readings — {MONTHS[selectedMonth - 1]} {selectedYear}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="text-left py-2 pr-4">Room</th>
                      <th className="text-right py-2 px-4">Previous</th>
                      <th className="text-right py-2 px-4">Current</th>
                      <th className="text-right py-2 px-4">Units</th>
                      <th className="text-right py-2 pl-4">Charge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {existingReadings.map((r: any) => (
                      <tr key={r.id} className="border-b border-border/40">
                        <td className="py-2.5 pr-4 font-medium">{r.roomNumber ?? r.roomId?.substring(0, 8)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">{r.previousReading ?? "—"}</td>
                        <td className="py-2.5 px-4 text-right font-mono">{r.currentReading ?? "—"}</td>
                        <td className="py-2.5 px-4 text-right font-mono">{r.unitsConsumed ?? "—"}</td>
                        <td className="py-2.5 pl-4 text-right font-semibold text-primary">{formatPaisa(r.totalCharge)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
