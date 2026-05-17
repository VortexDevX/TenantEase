import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2, UploadCloud, Download, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { fetchApi } from "@/lib/api-client";

interface Props {
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function CsvImportModal({ propertyId, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ successCount: number; errors: {row: number, error: string}[] } | null>(null);

  const handleDownloadTemplate = () => {
    // This is simple redirect to the API that returns text/csv header
    const token = localStorage.getItem("te_access_token");
    window.open(`${API_URL}/properties/${propertyId}/tenants/import/template?token=${token}`, "_blank");
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const token = localStorage.getItem("te_access_token");
      const res = await fetch(`${API_URL}/properties/${propertyId}/tenants/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error?.message || "Upload failed");
      }

      setResult({ successCount: json.successCount, errors: json.errors });
    } catch (err: any) {
      setError(err.message || "Failed to import CSV");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-float border border-border overflow-hidden animate-slide-up my-auto">
        <div className="flex justify-between items-center p-4 border-b border-border bg-secondary/30">
          <div>
           <h2 className="font-bold text-lg text-foreground tracking-tight">Import Tenants from CSV</h2>
           <p className="text-sm text-muted-foreground">Bulk add multiple tenants by uploading a filled CSV file.</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-muted-foreground hover:bg-background rounded-full transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
        {!result ? (
          <div className="flex flex-col gap-6">
            
            {/* Step 1 */}
            <div className="flex flex-col gap-2">
               <span className="text-sm font-semibold text-foreground">Step 1: Download Template</span>
               <p className="text-sm text-muted-foreground mb-2">
                  Download the required CSV format. Do not modify the headers.
               </p>
               <Button variant="outline" onClick={handleDownloadTemplate} className="w-full sm:w-auto self-start">
                  <Download className="mr-2" size={16}/> Download CSV Template
               </Button>
            </div>

            <div className="h-px bg-border/50"></div>

            {/* Step 2 */}
            <div className="flex flex-col gap-2">
               <span className="text-sm font-semibold text-foreground">Step 2: Upload Filled CSV</span>
               
               <div className="mt-2 flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-secondary/10 hover:bg-secondary/30 transition-colors relative">
                  <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground text-center">
                    {file ? file.name : "Click to select or drag and drop"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    .csv format up to 5MB
                  </p>
                  <input 
                    type="file" 
                    accept=".csv"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
               </div>
            </div>

            {error && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                 <AlertCircle size={16} /> {error}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" onClick={onClose} disabled={uploading}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {uploading ? "Importing..." : "Upload & Import"}
              </Button>
            </div>

          </div>
        ) : (
          <div className="flex flex-col gap-4 py-2">
            
            <div className="flex flex-col items-center text-center gap-2 mb-4">
              <CheckCircle2 className="w-12 h-12 text-success" />
              <h3 className="text-xl font-bold">Import Completed</h3>
              <p className="text-muted-foreground text-sm">
                 Successfully imported <strong className="text-foreground">{result.successCount}</strong> tenants.
              </p>
            </div>

            {result.errors.length > 0 && (
              <div className="flex flex-col gap-2 bg-secondary/30 p-4 rounded-xl border border-border mt-2">
                 <span className="text-sm font-bold text-destructive flex items-center gap-2">
                    <AlertCircle size={15}/> {result.errors.length} failed rows
                 </span>
                 <ul className="text-xs text-muted-foreground max-h-32 overflow-auto space-y-1 mt-1 pr-2">
                    {result.errors.map((e, idx) => (
                      <li key={idx}><strong>Row {e.row}:</strong> {e.error}</li>
                    ))}
                 </ul>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <Button onClick={() => { if(result.successCount > 0) onSuccess(); else onClose(); }} className="w-full">
                Done
              </Button>
            </div>
            
          </div>
        )}
        </div>

      </div>
    </div>
  );
}
