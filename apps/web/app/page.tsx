"use client";

import { useEffect, useState } from "react";
import type {
  MaintenanceCommentDto,
  MaintenanceDetailDto,
  MaintenanceRequestDto,
  MaintenanceSummaryDto,
  PaymentDto,
  PropertyDto,
  ReceiptDto,
  RentEntryDto,
  RoomDto,
  TenantDto
} from "@tenantease/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function formatInrFromPaisa(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value / 100);
}

function inrToPaisa(value: string) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100);
}

type AuthState = {
  accessToken: string;
  refreshToken: string;
  ownerProfileId: string;
};

type ApiFailure = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

type ApiSuccess<T> = {
  success: true;
  data: T;
};

function isFailure<T>(value: ApiSuccess<T> | ApiFailure): value is ApiFailure {
  return value.success === false;
}

function Field({
  label,
  helper,
  children
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {helper ? <span className="helper">{helper}</span> : null}
    </div>
  );
}

async function apiRequest<T>(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    }
  });

  const data = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || isFailure(data)) {
    throw new Error(isFailure(data) ? data.error.message : "Request failed");
  }

  return data.data;
}

export default function HomePage() {
  const [phone, setPhone] = useState("9999999999");
  const [challengeId, setChallengeId] = useState("");
  const [otp, setOtp] = useState("");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [message, setMessage] = useState("Start by requesting a mock OTP.");
  const [error, setError] = useState("");

  const [properties, setProperties] = useState<PropertyDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [tenants, setTenants] = useState<TenantDto[]>([]);
  const [rentEntries, setRentEntries] = useState<(RentEntryDto & { tenantName?: string })[]>([]);
  const [payments, setPayments] = useState<PaymentDto[]>([]);
  const [receipts, setReceipts] = useState<ReceiptDto[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequestDto[]>([]);
  const [maintenanceSummary, setMaintenanceSummary] = useState<MaintenanceSummaryDto>({
    new: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    total: 0
  });
  const [maintenanceComments, setMaintenanceComments] = useState<MaintenanceCommentDto[]>([]);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState("");
  const [maintenanceStatusFilter, setMaintenanceStatusFilter] = useState("ALL");

  const [propertyForm, setPropertyForm] = useState({
    name: "TenantEase Residency",
    address: "45 Residency Road",
    city: "Bengaluru",
    state: "Karnataka",
    pinCode: "560025",
    type: "PG"
  });

  const [roomForm, setRoomForm] = useState({
    roomNumber: "201",
    type: "DOUBLE",
    bedCount: 2,
    monthlyRent: "8500.00",
    depositAmount: "12000.00"
  });

  const [tenantForm, setTenantForm] = useState({
    fullName: "Rahul Sharma",
    phone: "9876543210",
    email: "rahul@example.com",
    moveInDate: "2026-03-01",
    monthlyRent: "8500.00",
    depositPaid: "12000.00"
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: "8500.00",
    mode: "UPI",
    paidAt: new Date().toISOString().slice(0, 10),
    note: "Paid via admin shell"
  });

  const [maintenanceForm, setMaintenanceForm] = useState({
    category: "PLUMBING",
    urgency: "MEDIUM",
    preferredTime: "evening",
    description: "Bathroom tap is leaking and needs repair."
  });
  const [maintenanceUpdateForm, setMaintenanceUpdateForm] = useState({
    status: "IN_PROGRESS",
    assignedWorkerName: "Raju",
    assignedWorkerPhone: "9876543215",
    resolutionNotes: "",
    comment: "Worker assigned from internal shell.",
    isInternalNote: false
  });
  const [maintenanceCommentForm, setMaintenanceCommentForm] = useState({
    content: "",
    isInternal: false
  });

  const selectedProperty = properties[0];
  const selectedRoom = rooms[0];
  const selectedTenant = tenants[0];
  const selectedRentEntry = rentEntries[0];
  const selectedMaintenance = maintenance.find((item) => item.id === selectedMaintenanceId) ?? maintenance[0] ?? null;

  useEffect(() => {
    const stored = window.localStorage.getItem("tenantease-auth");
    if (stored) {
      setAuth(JSON.parse(stored) as AuthState);
    }
  }, []);

  useEffect(() => {
    if (!auth) {
      return;
    }
    window.localStorage.setItem("tenantease-auth", JSON.stringify(auth));
    void refreshAll(auth.accessToken);
  }, [auth]);

  async function loadMaintenanceDetail(token: string, requestId: string) {
    const detail = await apiRequest<MaintenanceDetailDto>(`/maintenance/${requestId}`, {}, token);
    setMaintenanceComments(detail.comments);
  }

  async function refreshAll(token: string) {
    const propertyList = await apiRequest<PropertyDto[]>("/properties", {}, token);
    setProperties(propertyList);
    if (propertyList[0]) {
      const propertyId = propertyList[0].id;
      const [roomList, tenantList, rentList] = await Promise.all([
        apiRequest<RoomDto[]>(`/properties/${propertyId}/rooms`, {}, token),
        apiRequest<TenantDto[]>(`/properties/${propertyId}/tenants`, {}, token).then(
          (value) => (Array.isArray(value) ? value : [])
        ),
        apiRequest<(RentEntryDto & { tenantName?: string })[]>(`/properties/${propertyId}/rent`, {}, token)
      ]);
      setRooms(roomList);
      setTenants(tenantList);
      setRentEntries(rentList);
      const maintenanceQuery = maintenanceStatusFilter !== "ALL" ? `?status=${maintenanceStatusFilter}` : "";
      const maintenanceResult = await apiRequest<{ items: MaintenanceRequestDto[]; summary: MaintenanceSummaryDto }>(
        `/properties/${propertyId}/maintenance${maintenanceQuery}`,
        {},
        token
      );
      setMaintenance(maintenanceResult.items);
      setMaintenanceSummary(maintenanceResult.summary);
      const nextMaintenanceId =
        maintenanceResult.items.find((item) => item.id === selectedMaintenanceId)?.id ??
        maintenanceResult.items[0]?.id ??
        "";
      setSelectedMaintenanceId(nextMaintenanceId);
      if (nextMaintenanceId) {
        await loadMaintenanceDetail(token, nextMaintenanceId);
      } else {
        setMaintenanceComments([]);
      }

      if (tenantList[0]) {
        const tenantReceipts = await apiRequest<ReceiptDto[]>(`/tenants/${tenantList[0].id}/receipts`, {}, token);
        setReceipts(tenantReceipts);
      } else {
        setReceipts([]);
      }
    } else {
      setRooms([]);
      setTenants([]);
      setRentEntries([]);
      setReceipts([]);
      setMaintenance([]);
      setMaintenanceSummary({
        new: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        total: 0
      });
      setSelectedMaintenanceId("");
      setMaintenanceComments([]);
    }
  }

  function handleFailure(value: unknown) {
    const message = value instanceof Error ? value.message : "Something failed";
    setError(message);
  }

  async function requestOtp() {
    try {
      setError("");
      const response = await apiRequest<{ challengeId: string; debugOtp?: string }>("/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone })
      });
      setChallengeId(response.challengeId);
      setOtp(response.debugOtp ?? "");
      setMessage(`OTP requested. Challenge ready for ${phone}.`);
    } catch (value) {
      handleFailure(value);
    }
  }

  async function verifyOtp() {
    try {
      setError("");
      const response = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: { ownerProfileId: string };
      }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone, otp, challengeId })
      });
      setAuth({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
        ownerProfileId: response.user.ownerProfileId
      });
      setMessage("Authenticated. Internal shell is now using your owner token.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function createProperty() {
    if (!auth) return;
    try {
      await apiRequest<PropertyDto>("/properties", {
        method: "POST",
        body: JSON.stringify(propertyForm)
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Property created.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function createRoom() {
    if (!auth || !selectedProperty) return;
    try {
      await apiRequest<RoomDto>(`/properties/${selectedProperty.id}/rooms`, {
        method: "POST",
        body: JSON.stringify({
          ...roomForm,
          monthlyRent: inrToPaisa(roomForm.monthlyRent),
          depositAmount: inrToPaisa(roomForm.depositAmount)
        })
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Room created.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function createTenant() {
    if (!auth || !selectedProperty || !selectedRoom) return;
    try {
      await apiRequest<TenantDto>(`/properties/${selectedProperty.id}/tenants`, {
        method: "POST",
        body: JSON.stringify({
          ...tenantForm,
          roomId: selectedRoom.id,
          monthlyRent: inrToPaisa(tenantForm.monthlyRent),
          depositPaid: inrToPaisa(tenantForm.depositPaid)
        })
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Tenant created.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function generateRent() {
    if (!auth || !selectedProperty) return;
    try {
      await apiRequest(`/properties/${selectedProperty.id}/rent/generate`, {
        method: "POST",
        body: JSON.stringify({})
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Rent entries generated for the current month.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function createPayment() {
    if (!auth || !selectedRentEntry) return;
    try {
      const payment = await apiRequest<PaymentDto>("/payments", {
        method: "POST",
        body: JSON.stringify({
          ...paymentForm,
          amount: inrToPaisa(paymentForm.amount),
          rentEntryId: selectedRentEntry.id,
          paidAt: new Date(paymentForm.paidAt).toISOString()
        })
      }, auth.accessToken);
      setPayments((current) => [payment, ...current]);
      await refreshAll(auth.accessToken);
      setMessage("Manual payment recorded.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function createReceipt() {
    if (!auth || !payments[0]) return;
    try {
      const receipt = await apiRequest<ReceiptDto>("/receipts", {
        method: "POST",
        body: JSON.stringify({ paymentId: payments[0].id })
      }, auth.accessToken);
      setReceipts((current) => [receipt, ...current]);
      setMessage("Receipt generated.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function createMaintenance() {
    if (!auth || !selectedProperty || !selectedTenant) return;
    try {
      await apiRequest<MaintenanceRequestDto>("/maintenance", {
        method: "POST",
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          tenantId: selectedTenant.id,
          ...maintenanceForm
        })
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Maintenance request created.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function markMaintenanceInProgress(requestId: string) {
    if (!auth) return;
    try {
      await apiRequest<MaintenanceRequestDto>(`/maintenance/${requestId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "IN_PROGRESS",
          assignedWorkerName: maintenanceUpdateForm.assignedWorkerName,
          assignedWorkerPhone: maintenanceUpdateForm.assignedWorkerPhone,
          comment: maintenanceUpdateForm.comment,
          isInternalNote: maintenanceUpdateForm.isInternalNote
        })
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Maintenance request moved to in-progress.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function closeMaintenance(requestId: string) {
    if (!auth) return;
    try {
      await apiRequest<MaintenanceRequestDto>(`/maintenance/${requestId}/close`, {
        method: "POST",
        body: JSON.stringify({})
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Maintenance request closed.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function resolveMaintenance(requestId: string) {
    if (!auth) return;
    try {
      await apiRequest<MaintenanceRequestDto>(`/maintenance/${requestId}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "RESOLVED",
          assignedWorkerName: maintenanceUpdateForm.assignedWorkerName || null,
          assignedWorkerPhone: maintenanceUpdateForm.assignedWorkerPhone || null,
          resolutionNotes: maintenanceUpdateForm.resolutionNotes,
          comment: maintenanceUpdateForm.comment || undefined,
          isInternalNote: maintenanceUpdateForm.isInternalNote
        })
      }, auth.accessToken);
      await refreshAll(auth.accessToken);
      setMessage("Maintenance request resolved.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function addMaintenanceComment() {
    if (!auth || !selectedMaintenance || !maintenanceCommentForm.content.trim()) return;
    try {
      await apiRequest<MaintenanceCommentDto>(`/maintenance/${selectedMaintenance.id}/comments`, {
        method: "POST",
        body: JSON.stringify(maintenanceCommentForm)
      }, auth.accessToken);
      setMaintenanceCommentForm({
        content: "",
        isInternal: false
      });
      await refreshAll(auth.accessToken);
      setMessage("Maintenance comment added.");
    } catch (value) {
      handleFailure(value);
    }
  }

  async function inspectMaintenance(requestId: string) {
    if (!auth) return;
    try {
      setSelectedMaintenanceId(requestId);
      await loadMaintenanceDetail(auth.accessToken, requestId);
      setMessage("Maintenance detail loaded.");
    } catch (value) {
      handleFailure(value);
    }
  }

  useEffect(() => {
    if (!auth) {
      return;
    }

    void refreshAll(auth.accessToken);
  }, [maintenanceStatusFilter]);

  async function downloadReceipt(receipt: ReceiptDto) {
    if (!auth) {
      setError("Log in before downloading receipts.");
      return;
    }

    try {
      setError("");
      const response = await fetch(`${API_URL}${receipt.fileUrl}`, {
        headers: {
          authorization: `Bearer ${auth.accessToken}`
        }
      });

      if (!response.ok) {
        const body = (await response.json()) as ApiFailure;
        throw new Error(body.error.message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${receipt.receiptNumber}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (value) {
      handleFailure(value);
    }
  }

  return (
    <main className="page">
      <section className="hero">
        <span className="badge">TenantEase Internal Admin Shell</span>
        <h1>Backend-first validation workspace</h1>
        <p>
          This UI is intentionally small. Its job is to exercise the core API flows for auth,
          properties, rooms, tenants, rent, payments, and receipts.
        </p>
      </section>

      <div className={`notice ${error ? "error" : ""}`}>{error || message}</div>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="section-title">
            <h2>1. Login with Mock OTP</h2>
            <p>Request the debug OTP, then verify it.</p>
          </div>
          <Field label="Owner phone">
            <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <button className="button" onClick={requestOtp}>Request OTP</button>
          <Field label="Challenge ID" helper="Auto-filled after OTP request.">
            <input
              className="input"
              value={challengeId}
              onChange={(event) => setChallengeId(event.target.value)}
            />
          </Field>
          <Field label="OTP code" helper="In local mode the OTP is shown automatically.">
            <input className="input" value={otp} onChange={(event) => setOtp(event.target.value)} />
          </Field>
          <button className="button secondary" onClick={verifyOtp}>Verify OTP</button>
        </div>

        <div className="card stack">
          <div className="section-title">
            <h2>2. Current Session</h2>
            <p>Confirms that the shell has an owner token.</p>
          </div>
          {auth ? (
            <div className="stack tight">
              <div className="item">
                <strong>Owner profile</strong>
                <div className="meta">{auth.ownerProfileId}</div>
              </div>
              <div className="item">
                <strong>Access token stored in localStorage</strong>
                <div className="meta">Ready for property and rent operations.</div>
              </div>
            </div>
          ) : (
            <div className="empty">Authenticate first to load owner-scoped data.</div>
          )}
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="section-title">
            <h2>3. Create Property</h2>
            <p>Creates the first owner-scoped property.</p>
          </div>
          <div className="row">
            <Field label="Property name">
              <input className="input" value={propertyForm.name} onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })} />
            </Field>
            <Field label="Address">
              <input className="input" value={propertyForm.address} onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })} />
            </Field>
            <Field label="City">
              <input className="input" value={propertyForm.city} onChange={(event) => setPropertyForm({ ...propertyForm, city: event.target.value })} />
            </Field>
            <Field label="State">
              <input className="input" value={propertyForm.state} onChange={(event) => setPropertyForm({ ...propertyForm, state: event.target.value })} />
            </Field>
            <Field label="PIN code">
              <input className="input" value={propertyForm.pinCode} onChange={(event) => setPropertyForm({ ...propertyForm, pinCode: event.target.value })} />
            </Field>
            <Field label="Property type">
              <select className="select" value={propertyForm.type} onChange={(event) => setPropertyForm({ ...propertyForm, type: event.target.value })}>
                <option value="PG">PG</option>
                <option value="HOSTEL">Hostel</option>
                <option value="FLAT">Flat</option>
                <option value="HOUSE">House</option>
              </select>
            </Field>
          </div>
          <button className="button" onClick={createProperty} disabled={!auth}>Create Property</button>
        </div>

        <div className="card stack">
          <div className="section-title">
            <h2>4. Property Snapshot</h2>
            <p>Shows the first property currently loaded.</p>
          </div>
          {selectedProperty ? (
            <div className="item">
              <strong>{selectedProperty.name}</strong>
              <div className="meta">{selectedProperty.address}, {selectedProperty.city}</div>
              <div className="meta">{selectedProperty.totalRooms} rooms, {selectedProperty.occupiedBeds} occupied beds</div>
            </div>
          ) : (
            <div className="empty">No property created yet.</div>
          )}
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="section-title">
            <h2>5. Add Room</h2>
            <p>Add a room to the first property.</p>
          </div>
          <div className="row">
            <Field label="Room number">
              <input className="input" value={roomForm.roomNumber} onChange={(event) => setRoomForm({ ...roomForm, roomNumber: event.target.value })} />
            </Field>
            <Field label="Room type">
              <select className="select" value={roomForm.type} onChange={(event) => setRoomForm({ ...roomForm, type: event.target.value })}>
                <option value="SINGLE">Single</option>
                <option value="DOUBLE">Double</option>
                <option value="TRIPLE">Triple</option>
                <option value="DORMITORY">Dormitory</option>
              </select>
            </Field>
            <Field label="Bed count">
              <input className="input" type="number" value={roomForm.bedCount} onChange={(event) => setRoomForm({ ...roomForm, bedCount: Number(event.target.value) })} />
            </Field>
            <Field label="Monthly rent (INR)">
              <input className="input" type="number" step="0.01" value={roomForm.monthlyRent} onChange={(event) => setRoomForm({ ...roomForm, monthlyRent: event.target.value })} />
            </Field>
            <Field label="Deposit amount (INR)">
              <input className="input" type="number" step="0.01" value={roomForm.depositAmount} onChange={(event) => setRoomForm({ ...roomForm, depositAmount: event.target.value })} />
            </Field>
          </div>
          <button className="button" onClick={createRoom} disabled={!auth || !selectedProperty}>Create Room</button>
        </div>

        <div className="card stack">
          <div className="section-title">
            <h2>6. Rooms</h2>
            <p>Room inventory for the first property.</p>
          </div>
          <div className="list">
            {rooms.length ? rooms.map((room) => (
              <div className="item" key={room.id}>
                <strong>Room {room.roomNumber}</strong>
                <div className="meta">{room.type} | {room.occupiedBeds}/{room.bedCount} beds | {formatInrFromPaisa(room.monthlyRent)}</div>
              </div>
            )) : <div className="empty">No rooms yet.</div>}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="section-title">
            <h2>7. Add Tenant</h2>
            <p>The first tenant is assigned into the first room.</p>
          </div>
          <div className="row">
            <Field label="Tenant name">
              <input className="input" value={tenantForm.fullName} onChange={(event) => setTenantForm({ ...tenantForm, fullName: event.target.value })} />
            </Field>
            <Field label="Phone">
              <input className="input" value={tenantForm.phone} onChange={(event) => setTenantForm({ ...tenantForm, phone: event.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" value={tenantForm.email} onChange={(event) => setTenantForm({ ...tenantForm, email: event.target.value })} />
            </Field>
            <Field label="Move-in date">
              <input className="input" type="date" value={tenantForm.moveInDate} onChange={(event) => setTenantForm({ ...tenantForm, moveInDate: event.target.value })} />
            </Field>
            <Field label="Monthly rent (INR)">
              <input className="input" type="number" step="0.01" value={tenantForm.monthlyRent} onChange={(event) => setTenantForm({ ...tenantForm, monthlyRent: event.target.value })} />
            </Field>
            <Field label="Deposit paid (INR)">
              <input className="input" type="number" step="0.01" value={tenantForm.depositPaid} onChange={(event) => setTenantForm({ ...tenantForm, depositPaid: event.target.value })} />
            </Field>
          </div>
          <button className="button" onClick={createTenant} disabled={!auth || !selectedRoom}>Create Tenant in First Room</button>
        </div>

        <div className="card stack">
          <div className="section-title">
            <h2>8. Tenants</h2>
            <p>Active tenant records loaded from the first property.</p>
          </div>
          <div className="list">
            {tenants.length ? tenants.map((tenant) => (
              <div className="item" key={tenant.id}>
                <strong>{tenant.fullName}</strong>
                <div className="meta">{tenant.phone} | {tenant.status} | {formatInrFromPaisa(tenant.monthlyRent)}</div>
              </div>
            )) : <div className="empty">No tenants yet.</div>}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="section-title">
            <h2>9. Rent and Payments</h2>
            <p>Generate monthly rent, then record and settle one payment.</p>
          </div>
          <button className="button" onClick={generateRent} disabled={!auth || !selectedProperty}>Generate Current Month Rent</button>
          <div className="row">
            <Field label="Amount (INR)">
              <input className="input" type="number" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
            </Field>
            <Field label="Payment mode">
              <select className="select" value={paymentForm.mode} onChange={(event) => setPaymentForm({ ...paymentForm, mode: event.target.value })}>
                <option value="UPI">UPI</option>
                <option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </Field>
            <Field label="Paid date">
              <input className="input" type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} />
            </Field>
            <Field label="Payment note">
              <input className="input" value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} />
            </Field>
          </div>
          <button className="button secondary" onClick={createPayment} disabled={!auth || !selectedRentEntry}>Record Payment for First Rent Entry</button>
          <button className="button" onClick={createReceipt} disabled={!auth || !payments[0]}>Generate Receipt for Latest Payment</button>
        </div>

        <div className="card stack">
          <div className="section-title">
            <h2>10. Rent Ledger and Receipts</h2>
            <p>Review rent state and download protected receipts.</p>
          </div>
          <div className="list">
            {rentEntries.length ? rentEntries.map((entry) => (
              <div className="item" key={entry.id}>
                <strong>{entry.tenantName ?? entry.tenantId}</strong>
                <div className="meta">{entry.billingMonth} | {entry.status} | due {formatInrFromPaisa(entry.amountDue)} | paid {formatInrFromPaisa(entry.amountPaid)}</div>
              </div>
            )) : <div className="empty">No rent entries yet.</div>}
          </div>
          <div className="list">
            {receipts.length ? receipts.map((receipt) => (
              <div className="item" key={receipt.id}>
                <strong>{receipt.receiptNumber}</strong>
                <div className="meta">{new Date(receipt.generatedAt).toLocaleString()}</div>
                <button className="link-button" onClick={() => void downloadReceipt(receipt)}>
                  Download receipt PDF
                </button>
              </div>
            )) : <div className="empty">No receipts generated yet.</div>}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="section-title">
            <h2>11. Maintenance Requests</h2>
            <p>Create a request for the first tenant and update its status.</p>
          </div>
          <div className="row">
            <Field label="Category">
              <select className="select" value={maintenanceForm.category} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, category: event.target.value })}>
                <option value="PLUMBING">Plumbing</option>
                <option value="ELECTRICAL">Electrical</option>
                <option value="FURNITURE">Furniture</option>
                <option value="INTERNET">Internet</option>
                <option value="CLEANING">Cleaning</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Urgency">
              <select className="select" value={maintenanceForm.urgency} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, urgency: event.target.value })}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="EMERGENCY">Emergency</option>
              </select>
            </Field>
            <Field label="Preferred time">
              <select className="select" value={maintenanceForm.preferredTime} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, preferredTime: event.target.value })}>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="anytime">Anytime</option>
              </select>
            </Field>
          </div>
          <Field label="Issue description">
            <input className="input" value={maintenanceForm.description} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, description: event.target.value })} />
          </Field>
          <button className="button" onClick={createMaintenance} disabled={!auth || !selectedTenant}>Create Maintenance Request</button>
        </div>

        <div className="card stack">
          <div className="section-title">
            <h2>12. Maintenance Board</h2>
            <p>Owner-side request list with simple actions.</p>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <span>New</span>
              <strong>{maintenanceSummary.new}</strong>
            </div>
            <div className="stat-card">
              <span>In Progress</span>
              <strong>{maintenanceSummary.inProgress}</strong>
            </div>
            <div className="stat-card">
              <span>Resolved</span>
              <strong>{maintenanceSummary.resolved}</strong>
            </div>
            <div className="stat-card">
              <span>Closed</span>
              <strong>{maintenanceSummary.closed}</strong>
            </div>
          </div>
          <Field label="Status filter">
            <select className="select" value={maintenanceStatusFilter} onChange={(event) => setMaintenanceStatusFilter(event.target.value)}>
              <option value="ALL">All requests</option>
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
          <div className="list">
            {maintenance.length ? maintenance.map((item) => (
              <div className={`item ${selectedMaintenance?.id === item.id ? "item-active" : ""}`} key={item.id}>
                <strong>{item.requestNumber} · {item.category}</strong>
                <div className="meta">{item.tenantName} · Room {item.roomNumber}</div>
                <div className="meta">{item.status} · {item.urgency} · {item.description}</div>
                <div className="meta">{item.assignedWorkerName ? `Worker: ${item.assignedWorkerName}` : "No worker assigned yet"}</div>
                <div className="row">
                  <button className="button secondary" onClick={() => void inspectMaintenance(item.id)}>
                    View Details
                  </button>
                  <button className="button secondary" onClick={() => void markMaintenanceInProgress(item.id)} disabled={item.status !== "NEW"}>
                    Move to In Progress
                  </button>
                  <button className="button secondary" onClick={() => void resolveMaintenance(item.id)} disabled={item.status !== "IN_PROGRESS"}>
                    Resolve Request
                  </button>
                  <button className="button" onClick={() => void closeMaintenance(item.id)} disabled={item.status !== "RESOLVED" && item.status !== "IN_PROGRESS"}>
                    Close Request
                  </button>
                </div>
              </div>
            )) : <div className="empty">No maintenance requests yet.</div>}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <div className="section-title">
            <h2>13. Maintenance Detail</h2>
            <p>Inspect one request and manage assignment or resolution.</p>
          </div>
          {selectedMaintenance ? (
            <>
              <div className="item">
                <strong>{selectedMaintenance.requestNumber}</strong>
                <div className="meta">{selectedMaintenance.tenantName} · Room {selectedMaintenance.roomNumber}</div>
                <div className="meta">{selectedMaintenance.status} · {selectedMaintenance.urgency} · preferred {selectedMaintenance.preferredTime ?? "not set"}</div>
                <div className="meta">{selectedMaintenance.description}</div>
                {selectedMaintenance.resolutionNotes ? (
                  <div className="meta">Resolution: {selectedMaintenance.resolutionNotes}</div>
                ) : null}
              </div>
              <div className="row">
                <Field label="Worker name">
                  <input className="input" value={maintenanceUpdateForm.assignedWorkerName} onChange={(event) => setMaintenanceUpdateForm({ ...maintenanceUpdateForm, assignedWorkerName: event.target.value })} />
                </Field>
                <Field label="Worker phone">
                  <input className="input" value={maintenanceUpdateForm.assignedWorkerPhone} onChange={(event) => setMaintenanceUpdateForm({ ...maintenanceUpdateForm, assignedWorkerPhone: event.target.value })} />
                </Field>
              </div>
              <Field label="Ops comment" helper="Saved as part of the status update when present.">
                <input className="input" value={maintenanceUpdateForm.comment} onChange={(event) => setMaintenanceUpdateForm({ ...maintenanceUpdateForm, comment: event.target.value })} />
              </Field>
              <Field label="Resolution notes" helper="Required before resolving a request.">
                <textarea className="input textarea" value={maintenanceUpdateForm.resolutionNotes} onChange={(event) => setMaintenanceUpdateForm({ ...maintenanceUpdateForm, resolutionNotes: event.target.value })} />
              </Field>
            </>
          ) : (
            <div className="empty">Select a maintenance request to inspect its timeline and details.</div>
          )}
        </div>

        <div className="card stack">
          <div className="section-title">
            <h2>14. Maintenance Comments</h2>
            <p>Simple request timeline for operator notes.</p>
          </div>
          {selectedMaintenance ? (
            <>
              <div className="list">
                {maintenanceComments.length ? maintenanceComments.map((comment) => (
                  <div className="item" key={comment.id}>
                    <strong>{comment.isInternal ? "Internal note" : "Request comment"}</strong>
                    <div className="meta">{new Date(comment.createdAt).toLocaleString()}</div>
                    <div className="meta">{comment.content}</div>
                  </div>
                )) : <div className="empty">No comments on this request yet.</div>}
              </div>
              <Field label="Add comment">
                <textarea className="input textarea" value={maintenanceCommentForm.content} onChange={(event) => setMaintenanceCommentForm({ ...maintenanceCommentForm, content: event.target.value })} />
              </Field>
              <label className="checkbox">
                <input type="checkbox" checked={maintenanceCommentForm.isInternal} onChange={(event) => setMaintenanceCommentForm({ ...maintenanceCommentForm, isInternal: event.target.checked })} />
                <span>Mark as internal note</span>
              </label>
              <button className="button" onClick={addMaintenanceComment} disabled={!selectedMaintenance || selectedMaintenance.status === "CLOSED"}>
                Add Comment
              </button>
            </>
          ) : (
            <div className="empty">Select a maintenance request first.</div>
          )}
        </div>
      </section>
    </main>
  );
}
