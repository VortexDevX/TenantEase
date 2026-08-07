"use client";

import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Droplets, Loader2, Send, Zap } from "lucide-react";
import type { RoomDto, UtilityInputDto, UtilityReadingDto, UtilityType } from "@tenantease/types";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { MetricCard } from "@/components/shared/MetricCard";
import { MoneyValue } from "@/components/shared/MoneyValue";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRequireRoles } from "@/contexts/AuthContext";
import { fetchApi } from "@/lib/api-client";
import { formatPaisa } from "@/lib/format";
import { paisaToRupeesInput, rupeesToPaisa } from "@/lib/money";
import { useProperty } from "@/lib/PropertyContext";
import { useApi } from "@/lib/useApi";

type UtilityReadingRow = UtilityReadingDto & {
  roomNumber?: string | null;
  floor?: number | null;
};

type SubmitResult =
  | {
      status: "success";
      message: string;
      totalRooms: number;
      totalUnits: number;
      totalCharge: number;
    }
  | { status: "error"; message: string };

type UtilitySubmitResponse = {
  totalRooms: number;
  totalUnits: number;
  totalCharge: number;
  message: string;
};

const UTILITY_TYPES = [
  { value: "ELECTRICITY", label: "Electricity", icon: Zap, color: "text-amber-500" },
  { value: "WATER", label: "Water", icon: Droplets, color: "text-sky-500" }
] as const;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function buildYears(currentYear: number) {
  return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2];
}

function selectedUtilityConfig(type: UtilityType) {
  return UTILITY_TYPES.find((utility) => utility.value === type) ?? UTILITY_TYPES[0];
}

function readingValue(value: number | null | undefined) {
  return value ?? "-";
}

function useUtilityReadings(readings: UtilityReadingRow[] | undefined) {
  return useMemo(() => {
    const byRoom: Record<string, UtilityReadingRow> = {};
    let totalCharge = 0;
    let totalUnits = 0;

    for (const reading of readings ?? []) {
      if (reading.roomId) {
        byRoom[reading.roomId] = reading;
      }
      totalCharge += reading.totalCharge;
      totalUnits += reading.unitsConsumed ?? 0;
    }

    return {
      byRoom,
      totalCharge,
      totalUnits,
      count: readings?.length ?? 0
    };
  }, [readings]);
}

function FiltersCard({
  selectedType,
  selectedMonth,
  selectedYear,
  years,
  ratePerUnit,
  onTypeChange,
  onMonthChange,
  onYearChange,
  onRateChange
}: {
  selectedType: UtilityType;
  selectedMonth: number;
  selectedYear: number;
  years: number[];
  ratePerUnit: number;
  onTypeChange: (value: UtilityType) => void;
  onMonthChange: (value: number) => void;
  onYearChange: (value: number) => void;
  onRateChange: (value: number) => void;
}) {
  return (
    <Card className="shadow-card">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-4">
        <FilterField label="Type">
          <select
            value={selectedType}
            onChange={(event) => onTypeChange(event.target.value as UtilityType)}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {UTILITY_TYPES.map((utility) => (
              <option key={utility.value} value={utility.value}>{utility.label}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Month">
          <select
            value={selectedMonth}
            onChange={(event) => onMonthChange(Number.parseInt(event.target.value, 10))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {MONTHS.map((month, index) => (
              <option key={month} value={index + 1}>{month}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Year">
          <select
            value={selectedYear}
            onChange={(event) => onYearChange(Number.parseInt(event.target.value, 10))}
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Rate/Unit (Rs)">
          <Input
            type="number"
            min={1}
            value={paisaToRupeesInput(ratePerUnit)}
            onChange={(event) => onRateChange(rupeesToPaisa(event.target.value || "0"))}
            className="h-10"
          />
        </FilterField>
      </CardContent>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SummaryCards({ count, totalUnits, totalCharge }: { count: number; totalUnits: number; totalCharge: number }) {
  if (count === 0) return null;

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <MetricCard title="Rooms Recorded" value={count} subtitle="Current filter" />
      <MetricCard title="Total Units" value={totalUnits} subtitle="Meter usage" />
      <MetricCard title="Total Charge" value={<MoneyValue amount={totalCharge} />} subtitle="Applied to ledgers" />
    </section>
  );
}

function SubmitResultCard({ result }: { result: SubmitResult | null }) {
  if (!result) return null;

  const isError = result.status === "error";
  return (
    <Card className={isError ? "border-destructive" : "border-success/40"}>
      <CardContent className="p-5">
        <p className={isError ? "text-sm font-semibold text-destructive" : "text-sm font-semibold text-success"}>
          {result.message}
        </p>
        {!isError ? (
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {result.totalRooms} rooms, {result.totalUnits} units, {formatPaisa(result.totalCharge)}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadingEntryCard({
  rooms,
  loading,
  selectedType,
  selectedMonth,
  selectedYear,
  ratePerUnit,
  readings,
  existingByRoom,
  submitting,
  onReadingChange,
  onSubmit
}: {
  rooms: RoomDto[] | undefined;
  loading: boolean;
  selectedType: UtilityType;
  selectedMonth: number;
  selectedYear: number;
  ratePerUnit: number;
  readings: Record<string, string>;
  existingByRoom: Record<string, UtilityReadingRow>;
  submitting: boolean;
  onReadingChange: (roomId: string, value: string) => void;
  onSubmit: () => void;
}) {
  const utilityConfig = selectedUtilityConfig(selectedType);
  const UtilityIcon = utilityConfig.icon;
  const hasInput = Object.values(readings).some((value) => value.trim() !== "");

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center gap-2 border-b border-border">
        <UtilityIcon className={`h-5 w-5 ${utilityConfig.color}`} />
        <CardTitle className="text-base">
          Enter Meter Readings - {utilityConfig.label} ({MONTHS[selectedMonth - 1]} {selectedYear})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-5">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !rooms?.length ? (
          <EmptyState title="No rooms found" description="Add rooms to this property before billing utilities." className="py-10" />
        ) : (
          <div className="space-y-4">
            <div className="hidden grid-cols-6 gap-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Room</span>
              <span>Floor</span>
              <span>Previous</span>
              <span>Current</span>
              <span>Units</span>
              <span className="text-right">Charge</span>
            </div>
            {rooms.map((room) => (
              <RoomReadingRow
                key={room.id}
                room={room}
                reading={readings[room.id] ?? ""}
                existing={existingByRoom[room.id]}
                ratePerUnit={ratePerUnit}
                onReadingChange={onReadingChange}
              />
            ))}
            <div className="flex justify-end pt-4">
              <Button type="button" onClick={onSubmit} disabled={submitting || !hasInput}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Submit Readings
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RoomReadingRow({
  room,
  reading,
  existing,
  ratePerUnit,
  onReadingChange
}: {
  room: RoomDto;
  reading: string;
  existing?: UtilityReadingRow;
  ratePerUnit: number;
  onReadingChange: (roomId: string, value: string) => void;
}) {
  const previousReading = existing?.currentReading ?? existing?.previousReading ?? 0;
  const currentReading = reading ? Number.parseInt(reading, 10) : null;
  const units = currentReading !== null && currentReading >= previousReading ? currentReading - previousReading : null;
  const charge = units !== null ? units * ratePerUnit : null;

  return (
    <div className="grid grid-cols-3 items-center gap-3 border-b border-border/50 py-3 last:border-0 sm:grid-cols-6">
      <Badge variant="outline" className="w-fit font-mono text-xs">{room.roomNumber}</Badge>
      <span className="hidden text-sm text-muted-foreground sm:block">{room.floor != null ? `Floor ${room.floor}` : "-"}</span>
      <span className="font-mono text-sm text-muted-foreground">{readingValue(previousReading)}</span>
      <Input
        type="number"
        placeholder="Enter reading"
        value={reading}
        onChange={(event) => onReadingChange(room.id, event.target.value)}
        className="h-9 font-mono text-sm"
        min={previousReading}
      />
      <span className="hidden font-mono text-sm text-foreground sm:block">{readingValue(units)}</span>
      <span className="hidden text-right text-sm font-semibold sm:block">{charge !== null ? formatPaisa(charge) : "-"}</span>
    </div>
  );
}

function RecordedReadingsCard({
  readings,
  selectedMonth,
  selectedYear
}: {
  readings: UtilityReadingRow[] | undefined;
  selectedMonth: number;
  selectedYear: number;
}) {
  if (!readings?.length) return null;

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b border-border">
        <CardTitle className="text-base">Recorded Readings - {MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-3 pl-5 pr-4 text-left">Room</th>
                <th className="px-4 py-3 text-right">Previous</th>
                <th className="px-4 py-3 text-right">Current</th>
                <th className="px-4 py-3 text-right">Units</th>
                <th className="py-3 pl-4 pr-5 text-right">Charge</th>
              </tr>
            </thead>
            <tbody>
              {readings.map((reading) => (
                <tr key={reading.id} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pl-5 pr-4 font-medium">{reading.roomNumber ?? reading.roomId?.slice(0, 8) ?? "-"}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{readingValue(reading.previousReading)}</td>
                  <td className="px-4 py-3 text-right font-mono">{readingValue(reading.currentReading)}</td>
                  <td className="px-4 py-3 text-right font-mono">{readingValue(reading.unitsConsumed)}</td>
                  <td className="py-3 pl-4 pr-5 text-right font-semibold text-primary">{formatPaisa(reading.totalCharge)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UtilitiesPage() {
  const { authorized } = useRequireRoles(["OWNER", "STAFF"]);
  const { activeProperty } = useProperty();
  const now = new Date();
  const currentYear = now.getFullYear();
  const years = useMemo(() => buildYears(currentYear), [currentYear]);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedType, setSelectedType] = useState<UtilityType>("ELECTRICITY");
  const [ratePerUnit, setRatePerUnit] = useState(800);
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const { data: rooms, loading: roomsLoading } = useApi<RoomDto[]>(
    activeProperty ? `/properties/${activeProperty.id}/rooms` : null
  );
  const readingsUrl = activeProperty
    ? `/properties/${activeProperty.id}/utilities?month=${selectedMonth}&year=${selectedYear}&type=${selectedType}`
    : null;
  const { data: existingReadings, loading: readingsLoading, refetch } = useApi<UtilityReadingRow[]>(readingsUrl);
  const readingSummary = useUtilityReadings(existingReadings ?? undefined);

  const handleReadingChange = useCallback((roomId: string, value: string) => {
    setReadings((previous) => ({ ...previous, [roomId]: value }));
  }, []);

  async function handleSubmit() {
    if (!activeProperty || !rooms) return;

    const readingEntries = buildReadingEntries(rooms, readings, readingSummary.byRoom);
    if (readingEntries.length === 0) return;

    setSubmitting(true);
    setSubmitResult(null);

    try {
      const result = await fetchApi<UtilitySubmitResponse>(`/properties/${activeProperty.id}/utilities`, {
        method: "POST",
        body: JSON.stringify({
          utilityType: selectedType,
          month: selectedMonth,
          year: selectedYear,
          billingModel: "INDIVIDUAL_METER",
          ratePerUnit,
          readings: readingEntries
        } satisfies UtilityInputDto)
      });
      setSubmitResult({ status: "success", ...result });
      setReadings({});
      refetch();
    } catch (error) {
      setSubmitResult({
        status: "error",
        message: error instanceof Error ? error.message : "Unable to submit readings."
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (!authorized) return null;

  return (
    <DashboardLayout activePath="/utilities">
      <div className="space-y-6">
        <PageHeader
          title="Utility Billing"
          description="Record meter readings and apply replace-safe charges to tenant rent entries."
        />
        <FiltersCard
          selectedType={selectedType}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          years={years}
          ratePerUnit={ratePerUnit}
          onTypeChange={setSelectedType}
          onMonthChange={setSelectedMonth}
          onYearChange={setSelectedYear}
          onRateChange={setRatePerUnit}
        />
        <SummaryCards
          count={readingSummary.count}
          totalUnits={readingSummary.totalUnits}
          totalCharge={readingSummary.totalCharge}
        />
        <SubmitResultCard result={submitResult} />
        <ReadingEntryCard
          rooms={rooms ?? undefined}
          loading={roomsLoading || readingsLoading}
          selectedType={selectedType}
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          ratePerUnit={ratePerUnit}
          readings={readings}
          existingByRoom={readingSummary.byRoom}
          submitting={submitting}
          onReadingChange={handleReadingChange}
          onSubmit={handleSubmit}
        />
        <RecordedReadingsCard readings={existingReadings ?? undefined} selectedMonth={selectedMonth} selectedYear={selectedYear} />
      </div>
    </DashboardLayout>
  );
}

function buildReadingEntries(
  rooms: RoomDto[],
  readings: Record<string, string>,
  existingByRoom: Record<string, UtilityReadingRow>
): UtilityInputDto["readings"] {
  return rooms.flatMap((room) => {
    const value = readings[room.id]?.trim();
    if (!value) return [];

    const currentReading = Number.parseInt(value, 10);
    if (!Number.isFinite(currentReading)) return [];

    const existing = existingByRoom[room.id];
    return [{
      roomId: room.id,
      currentReading,
      ...(existing?.currentReading != null ? { previousReading: existing.currentReading } : {})
    }];
  });
}
