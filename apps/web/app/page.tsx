"use client";

import { useEffect, useState } from "react";
import type {
  PaymentDto,
  PropertyDto,
  ReceiptDto,
  RentEntryDto,
  RoomDto,
  TenantDto
} from "@tenantease/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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
    monthlyRent: 850000,
    depositAmount: 1200000
  });

  const [tenantForm, setTenantForm] = useState({
    fullName: "Rahul Sharma",
    phone: "9876543210",
    email: "rahul@example.com",
    moveInDate: "2026-03-01",
    monthlyRent: 850000,
    depositPaid: 1200000
  });

  const [paymentForm, setPaymentForm] = useState({
    amount: 850000,
    mode: "UPI",
    paidAt: new Date().toISOString().slice(0, 10),
    note: "Paid via admin shell"
  });

  const selectedProperty = properties[0];
  const selectedRoom = rooms[0];
  const selectedTenant = tenants[0];
  const selectedRentEntry = rentEntries[0];

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
        body: JSON.stringify(roomForm)
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
          roomId: selectedRoom.id
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
          <h2>1. Login with Mock OTP</h2>
          <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <button className="button" onClick={requestOtp}>Request OTP</button>
          <input
            className="input"
            placeholder="Challenge ID"
            value={challengeId}
            onChange={(event) => setChallengeId(event.target.value)}
          />
          <input className="input" placeholder="OTP" value={otp} onChange={(event) => setOtp(event.target.value)} />
          <button className="button secondary" onClick={verifyOtp}>Verify OTP</button>
        </div>

        <div className="card stack">
          <h2>2. Current Session</h2>
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
          <h2>3. Create Property</h2>
          <div className="row">
            <input className="input" value={propertyForm.name} onChange={(event) => setPropertyForm({ ...propertyForm, name: event.target.value })} />
            <input className="input" value={propertyForm.address} onChange={(event) => setPropertyForm({ ...propertyForm, address: event.target.value })} />
            <input className="input" value={propertyForm.city} onChange={(event) => setPropertyForm({ ...propertyForm, city: event.target.value })} />
            <input className="input" value={propertyForm.state} onChange={(event) => setPropertyForm({ ...propertyForm, state: event.target.value })} />
            <input className="input" value={propertyForm.pinCode} onChange={(event) => setPropertyForm({ ...propertyForm, pinCode: event.target.value })} />
            <select className="select" value={propertyForm.type} onChange={(event) => setPropertyForm({ ...propertyForm, type: event.target.value })}>
              <option value="PG">PG</option>
              <option value="HOSTEL">Hostel</option>
              <option value="FLAT">Flat</option>
              <option value="HOUSE">House</option>
            </select>
          </div>
          <button className="button" onClick={createProperty} disabled={!auth}>Create Property</button>
        </div>

        <div className="card stack">
          <h2>4. Property Snapshot</h2>
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
          <h2>5. Add Room</h2>
          <div className="row">
            <input className="input" value={roomForm.roomNumber} onChange={(event) => setRoomForm({ ...roomForm, roomNumber: event.target.value })} />
            <select className="select" value={roomForm.type} onChange={(event) => setRoomForm({ ...roomForm, type: event.target.value })}>
              <option value="SINGLE">Single</option>
              <option value="DOUBLE">Double</option>
              <option value="TRIPLE">Triple</option>
              <option value="DORMITORY">Dormitory</option>
            </select>
            <input className="input" type="number" value={roomForm.bedCount} onChange={(event) => setRoomForm({ ...roomForm, bedCount: Number(event.target.value) })} />
            <input className="input" type="number" value={roomForm.monthlyRent} onChange={(event) => setRoomForm({ ...roomForm, monthlyRent: Number(event.target.value) })} />
            <input className="input" type="number" value={roomForm.depositAmount} onChange={(event) => setRoomForm({ ...roomForm, depositAmount: Number(event.target.value) })} />
          </div>
          <button className="button" onClick={createRoom} disabled={!auth || !selectedProperty}>Create Room</button>
        </div>

        <div className="card stack">
          <h2>6. Rooms</h2>
          <div className="list">
            {rooms.length ? rooms.map((room) => (
              <div className="item" key={room.id}>
                <strong>Room {room.roomNumber}</strong>
                <div className="meta">{room.type} | {room.occupiedBeds}/{room.bedCount} beds | INR {(room.monthlyRent / 100).toFixed(2)}</div>
              </div>
            )) : <div className="empty">No rooms yet.</div>}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <h2>7. Add Tenant</h2>
          <div className="row">
            <input className="input" value={tenantForm.fullName} onChange={(event) => setTenantForm({ ...tenantForm, fullName: event.target.value })} />
            <input className="input" value={tenantForm.phone} onChange={(event) => setTenantForm({ ...tenantForm, phone: event.target.value })} />
            <input className="input" value={tenantForm.email} onChange={(event) => setTenantForm({ ...tenantForm, email: event.target.value })} />
            <input className="input" type="date" value={tenantForm.moveInDate} onChange={(event) => setTenantForm({ ...tenantForm, moveInDate: event.target.value })} />
            <input className="input" type="number" value={tenantForm.monthlyRent} onChange={(event) => setTenantForm({ ...tenantForm, monthlyRent: Number(event.target.value) })} />
            <input className="input" type="number" value={tenantForm.depositPaid} onChange={(event) => setTenantForm({ ...tenantForm, depositPaid: Number(event.target.value) })} />
          </div>
          <button className="button" onClick={createTenant} disabled={!auth || !selectedRoom}>Create Tenant in First Room</button>
        </div>

        <div className="card stack">
          <h2>8. Tenants</h2>
          <div className="list">
            {tenants.length ? tenants.map((tenant) => (
              <div className="item" key={tenant.id}>
                <strong>{tenant.fullName}</strong>
                <div className="meta">{tenant.phone} | {tenant.status} | INR {(tenant.monthlyRent / 100).toFixed(2)}</div>
              </div>
            )) : <div className="empty">No tenants yet.</div>}
          </div>
        </div>
      </section>

      <section className="grid two" style={{ marginTop: 20 }}>
        <div className="card stack">
          <h2>9. Rent and Payments</h2>
          <button className="button" onClick={generateRent} disabled={!auth || !selectedProperty}>Generate Current Month Rent</button>
          <div className="row">
            <input className="input" type="number" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: Number(event.target.value) })} />
            <select className="select" value={paymentForm.mode} onChange={(event) => setPaymentForm({ ...paymentForm, mode: event.target.value })}>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
            <input className="input" type="date" value={paymentForm.paidAt} onChange={(event) => setPaymentForm({ ...paymentForm, paidAt: event.target.value })} />
            <input className="input" value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} />
          </div>
          <button className="button secondary" onClick={createPayment} disabled={!auth || !selectedRentEntry}>Record Payment for First Rent Entry</button>
          <button className="button" onClick={createReceipt} disabled={!auth || !payments[0]}>Generate Receipt for Latest Payment</button>
        </div>

        <div className="card stack">
          <h2>10. Rent Ledger and Receipts</h2>
          <div className="list">
            {rentEntries.length ? rentEntries.map((entry) => (
              <div className="item" key={entry.id}>
                <strong>{entry.tenantName ?? entry.tenantId}</strong>
                <div className="meta">{entry.billingMonth} | {entry.status} | due INR {(entry.amountDue / 100).toFixed(2)} | paid INR {(entry.amountPaid / 100).toFixed(2)}</div>
              </div>
            )) : <div className="empty">No rent entries yet.</div>}
          </div>
          <div className="list">
            {receipts.length ? receipts.map((receipt) => (
              <div className="item" key={receipt.id}>
                <strong>{receipt.receiptNumber}</strong>
                <div className="meta">{new Date(receipt.generatedAt).toLocaleString()}</div>
                <a href={`${API_URL}${receipt.fileUrl}`} target="_blank" rel="noreferrer">Open receipt PDF</a>
              </div>
            )) : <div className="empty">No receipts generated yet.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}

