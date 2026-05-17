"use client";

import { useState } from "react";
import { UserCircle, Building2, MapPin, Grid, CheckCircle2, ChevronRight, CornerDownRight } from "lucide-react";
import { fetchApi } from "../../lib/api-client";
import { useAuth } from "../../contexts/AuthContext";

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  // Profile State
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  
  // Property State
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [propName, setPropName] = useState("");
  const [propAddress, setPropAddress] = useState("");
  const [propCity, setPropCity] = useState("");
  const [propType, setPropType] = useState<"PG" | "HOSTEL" | "FLAT">("PG");
  
  // Room State
  const [rooms, setRooms] = useState([{ roomNumber: "", type: "SINGLE", bedCount: 1, monthlyRent: "" }]);

  const { user } = useAuth();

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !companyName) {
      setError("Please fill out all fields");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await fetchApi("/auth/complete-profile", {
        method: "PUT",
        body: JSON.stringify({ displayName, companyName }),
      });
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propName || !propAddress || !propCity) {
      setError("Please fill out required fields");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetchApi<any>("/properties", {
        method: "POST",
        body: JSON.stringify({
          name: propName,
          address: propAddress,
          city: propCity,
          state: "State", // Defaulting for simple onboarding
          pinCode: "000000",
          type: propType
        }),
      });
      setPropertyId(res.id);
      setStep(3);
    } catch (err: any) {
      setError(err.message || "Failed to create property");
    } finally {
      setLoading(false);
    }
  };

  const handleRoomsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId) return;

    setLoading(true);
    setError("");
    try {
      for (const r of rooms) {
        if (!r.roomNumber || !r.monthlyRent) continue;
        await fetchApi(`/properties/${propertyId}/rooms`, {
          method: "POST",
          body: JSON.stringify({
            roomNumber: r.roomNumber,
            type: r.type,
            bedCount: r.bedCount,
            monthlyRent: parseInt(r.monthlyRent) * 100, // paisa conversion
            floor: 0,
            depositAmount: parseInt(r.monthlyRent) * 100,
          }),
        });
      }
      setStep(4);
    } catch (err: any) {
      setError(err.message || "Failed to create rooms. You can skip and do this later.");
    } finally {
      setLoading(false);
    }
  };

  const skipToDashboard = () => {
    window.location.href = "/";
  };

  const addRoomRow = () => {
    setRooms([...rooms, { roomNumber: "", type: "SINGLE", bedCount: 1, monthlyRent: "" }]);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="flex justify-center mb-6">
          <div className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 1 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
            <div className={`h-1 w-12 ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 2 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
            <div className={`h-1 w-12 ${step >= 3 ? 'bg-primary' : 'bg-gray-200'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${step >= 3 ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
          </div>
        </div>

        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100">
          {error && (
            <div className="mb-4 bg-red-50 p-4 rounded-md">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {step === 1 && (
            <form className="space-y-6" onSubmit={handleProfileSubmit}>
              <div className="text-center mb-8">
                <UserCircle className="mx-auto h-12 w-12 text-primary" />
                <h2 className="mt-4 text-2xl font-bold text-gray-900">Complete Your Profile</h2>
                <p className="mt-2 text-sm text-gray-500">How should we address you and your business?</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text" required
                  className="mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                  placeholder="Rahul Sharma"
                  value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Company / Brand Name</label>
                <input
                  type="text" required
                  className="mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                  placeholder="Sharma PG / Royal Hostels"
                  value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors"
              >
                {loading ? "Saving..." : <><span className="mr-2">Continue</span> <ChevronRight size={16}/></>}
              </button>
            </form>
          )}

          {step === 2 && (
            <form className="space-y-6" onSubmit={handlePropertySubmit}>
              <div className="text-center mb-8">
                <Building2 className="mx-auto h-12 w-12 text-primary" />
                <h2 className="mt-4 text-2xl font-bold text-gray-900">Add Your First Property</h2>
                <p className="mt-2 text-sm text-gray-500">Set up the building where your tenants reside.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Property Name</label>
                <input
                  type="text" required
                  className="mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. Skyline PG, Sector 14"
                  value={propName} onChange={(e) => setPropName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">City</label>
                  <input
                    type="text" required
                    className="mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Bangalore"
                    value={propCity} onChange={(e) => setPropCity(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    className="mt-1 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={propType} onChange={(e) => setPropType(e.target.value as any)}
                  >
                    <option value="PG">PG / Co-living</option>
                    <option value="HOSTEL">Hostel</option>
                    <option value="FLAT">Flat / Apartment</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Street Address</label>
                <textarea
                  required
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="12/A Residency Road"
                  rows={2}
                  value={propAddress} onChange={(e) => setPropAddress(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <button type="button" onClick={skipToDashboard} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
                  Skip for now
                </button>
                <button type="submit" disabled={loading} className="flex-[2] flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors">
                  {loading ? "Creating..." : <><span className="mr-2">Create Property</span> <ChevronRight size={16}/></>}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <form className="space-y-6" onSubmit={handleRoomsSubmit}>
              <div className="text-center mb-8">
                <Grid className="mx-auto h-12 w-12 text-primary" />
                <h2 className="mt-4 text-2xl font-bold text-gray-900">Add Rooms</h2>
                <p className="mt-2 text-sm text-gray-500">Quickly add a few rooms to get started.</p>
              </div>

              <div className="space-y-4">
                {rooms.map((r, i) => (
                  <div key={i} className="flex gap-3 items-end">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Room No.</label>
                      <input type="text" placeholder="101" className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm" required value={r.roomNumber} onChange={e => { const nm = [...rooms]; nm[i].roomNumber = e.target.value; setRooms(nm); }} />
                    </div>
                    <div className="flex-[1.5]">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                      <select className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm" value={r.type} onChange={e => { 
                          const nm = [...rooms]; 
                          nm[i].type = e.target.value;
                          nm[i].bedCount = e.target.value === "SINGLE" ? 1 : e.target.value === "DOUBLE" ? 2 : e.target.value === "TRIPLE" ? 3 : 4; 
                          setRooms(nm); 
                        }}>
                        <option value="SINGLE">Single (1 Bed)</option>
                        <option value="DOUBLE">Double (2 Beds)</option>
                        <option value="TRIPLE">Triple (3 Beds)</option>
                      </select>
                    </div>
                    <div className="flex-[1.5]">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Rent / Bed (₹)</label>
                      <input type="number" min="0" placeholder="8000" className="flex h-10 w-full rounded-md border border-input px-3 py-2 text-sm" required value={r.monthlyRent} onChange={e => { const nm = [...rooms]; nm[i].monthlyRent = e.target.value; setRooms(nm); }} />
                    </div>
                  </div>
                ))}
              </div>
              
              <button type="button" onClick={addRoomRow} className="text-sm font-medium text-primary hover:text-primary/80 flex items-center">
                <CornerDownRight size={16} className="mr-1" /> Add another room
              </button>

              <div className="flex gap-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={skipToDashboard} className="flex-1 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors border border-gray-200">
                  Skip
                </button>
                <button type="submit" disabled={loading} className="flex-[2] flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors">
                  {loading ? "Saving..." : <><span className="mr-2">Complete Setup</span> <CheckCircle2 size={16}/></>}
                </button>
              </div>
            </form>
          )}

          {step === 4 && (
            <div className="text-center py-12">
              <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-500" />
              <h2 className="mt-6 text-3xl font-extrabold text-gray-900">You're All Set!</h2>
              <p className="mt-2 text-sm text-gray-600 mb-8">
                Your profile, property, and initial rooms have been created. Let's head to your dashboard!
              </p>
              <button onClick={skipToDashboard} className="w-full justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 transition-colors">
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
