import { useRef, useState } from 'react';
import { FileUp, Download, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api, download } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';

const TEMPLATE = `Name,Phone,Email,Company,Expected Value,Notes
Ramesh Kumar,9810012345,ramesh@example.com,Kumar Interiors,100000,Interested in office fit-out
Sita Iyer,9820012346,,Iyer & Co,25000,
`;

export function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { success, error } = useToast();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api<{ created: number; skipped: number; errors: string[] }>('/leads/import', { formData: fd });
      setResult(res);
      success('Import finished', `${res.created} lead(s) created, ${res.skipped} skipped.`);
    } catch (err) {
      error('Import failed', friendlyError(err));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Import leads from CSV / Excel" description="Save your Excel as CSV, or download the template below. Duplicate phone/email rows are skipped automatically.">
        <div className="space-y-4">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
          >
            <FileUp className="h-8 w-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">{busy ? 'Importing…' : 'Click to choose your CSV file'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Columns: Name, Phone, Email, Company, Expected Value, Notes (max 5 MB)</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
            />
          </button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              const blob = new Blob([TEMPLATE], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'primelead-leads-template.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" /> Download CSV template
          </Button>
          {result && result.skipped > 0 && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold text-warning-foreground">
                <AlertTriangle className="h-4 w-4" /> {result.skipped} row(s) skipped
              </p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
                {result.errors.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
