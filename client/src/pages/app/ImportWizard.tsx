import { useState, useCallback, useRef } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

type Entity = 'LEAD' | 'CONTACT' | 'COMPANY';

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: string;
  options?: string[];
}

interface ParsedData {
  fileName: string;
  totalRows: number;
  headers: string[];
  autoMapping: Record<string, string>;
  entity: Entity;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

interface ValidationStats {
  total: number;
  valid: number;
  withErrors: number;
  duplicateCheck: number;
}

interface ImportResult {
  entity: string;
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

export function ImportWizard() {
  const [step, setStep] = useState<'choose' | 'upload' | 'map' | 'preview' | 'result'>('choose');
  const [entity, setEntity] = useState<Entity>('LEAD');
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [validation, setValidation] = useState<{ errors: ValidationError[]; warnings: ValidationWarning[]; stats: ValidationStats } | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rawFileRef = useRef<File | null>(null);

  const loadFields = useCallback(async (e: Entity) => {
    try {
      const data = await api<{ fields: FieldDef[] }>(`/import/fields/${e}`);
      setFields(data.fields);
    } catch {
      setFields([]);
    }
  }, []);

  const handleEntitySelect = async (e: Entity) => {
    setEntity(e);
    setStep('upload');
    await loadFields(e);
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError('');
    rawFileRef.current = file;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api<ParsedData & { csvRows?: Record<string, string>[] }>(`/import/parse?entity=${entity}`, { formData });
      setParsedData(data);
      setMapping(data.autoMapping || {});
      if (data.csvRows) setCsvData(data.csvRows);
      setStep('map');
    } catch (err: any) {
      setError(err?.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api<{ errors: ValidationError[]; warnings: ValidationWarning[]; stats: ValidationStats }>('/import/validate', {
        body: { entity, csvData, mapping },
      });
      setValidation(data);
      setStep('preview');
    } catch (err: any) {
      setError(err?.message || 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (dryRun: boolean) => {
    setLoading(true);
    setError('');
    try {
      const data = await api<ImportResult>('/import/execute', {
        body: { entity, csvData, mapping, dryRun },
      });
      setImportResult(data);
      setStep('result');
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Import</h1>
          <p className="text-sm text-gray-500 mt-1">Import leads, contacts, and companies from CSV files</p>
        </div>
        {step !== 'choose' && (
          <Button variant="outline" onClick={() => { setStep('choose'); setParsedData(null); setValidation(null); setImportResult(null); setCsvData([]); }}>
            Start Over
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(['choose', 'upload', 'map', 'preview', 'result'] as const).map((s, i) => (
          <div key={s} className={`px-3 py-1 rounded-full ${step === s ? 'bg-blue-600 text-white' : i < ['choose', 'upload', 'map', 'preview', 'result'].indexOf(step) ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
          </div>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Step: Choose Entity */}
      {step === 'choose' && (
        <div className="grid grid-cols-3 gap-4">
          {(['LEAD', 'CONTACT', 'COMPANY'] as Entity[]).map((e) => (
            <button key={e} onClick={() => handleEntitySelect(e)} className="border-2 border-gray-200 rounded-xl p-6 text-center hover:border-blue-500 hover:bg-blue-50 transition-all">
              <div className="text-3xl mb-2">{e === 'LEAD' ? '🎯' : e === 'CONTACT' ? '👤' : '🏢'}</div>
              <div className="font-semibold text-gray-900">{e === 'LEAD' ? 'Leads' : e === 'CONTACT' ? 'Contacts' : 'Companies'}</div>
              <div className="text-sm text-gray-500 mt-1">Import {e.toLowerCase()} data</div>
            </button>
          ))}
        </div>
      )}

      {/* Step: Upload */}
      {step === 'upload' && (
        <div
          className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".csv,.tsv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
          {loading ? (
            <Skeleton className="h-8 w-48 mx-auto" />
          ) : (
            <>
              <div className="text-4xl mb-3">📄</div>
              <div className="text-lg font-medium text-gray-700">Drop your CSV file here</div>
              <div className="text-sm text-gray-500 mt-1">or click to browse</div>
              <div className="text-xs text-gray-400 mt-3">Supports CSV and TSV files up to 10MB</div>
            </>
          )}
        </div>
      )}

      {/* Step: Map Fields */}
      {step === 'map' && parsedData && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">📄 {parsedData.fileName}</span>
              <Badge>{parsedData.totalRows} rows</Badge>
              <Badge>{parsedData.headers.length} columns</Badge>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">CSV Column</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Maps To</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Preview</th>
                </tr>
              </thead>
              <tbody>
                {parsedData.headers.map((header) => (
                  <tr key={header} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs">{header}</td>
                    <td className="px-4 py-2">
                      <select
                        value={mapping[header] || ''}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [header]: e.target.value }))}
                        className="w-full border rounded-md px-2 py-1 text-sm"
                      >
                        <option value="">— Skip —</option>
                        {fields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label} {f.required ? '*' : ''}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={handleValidate} disabled={loading || csvData.length === 0}>
              {loading ? 'Validating...' : 'Preview & Validate'}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && validation && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{validation.stats.total}</div>
              <div className="text-sm text-gray-500">Total Rows</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{validation.stats.valid}</div>
              <div className="text-sm text-gray-500">Valid</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{validation.stats.withErrors}</div>
              <div className="text-sm text-gray-500">With Errors</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{validation.stats.duplicateCheck}</div>
              <div className="text-sm text-gray-500">Duplicates</div>
            </div>
          </div>

          {validation.errors.length > 0 && (
            <div className="border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-4 py-2 font-medium text-sm text-red-700">Errors ({validation.errors.length})</div>
              <div className="max-h-48 overflow-y-auto">
                {validation.errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="px-4 py-2 border-t text-sm">
                    <span className="font-mono text-red-600">Row {e.row}</span> — {e.field}: {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="border border-yellow-200 rounded-xl overflow-hidden">
              <div className="bg-yellow-50 px-4 py-2 font-medium text-sm text-yellow-700">Warnings ({validation.warnings.length})</div>
              <div className="max-h-48 overflow-y-auto">
                {validation.warnings.slice(0, 50).map((w, i) => (
                  <div key={i} className="px-4 py-2 border-t text-sm">
                    <span className="font-mono text-yellow-600">Row {w.row}</span> — {w.field}: {w.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
            <Button variant="outline" onClick={() => handleImport(true)} disabled={loading}>
              Dry Run
            </Button>
            <Button onClick={() => handleImport(false)} disabled={loading || validation.stats.valid === 0}>
              {loading ? 'Importing...' : `Import ${validation.stats.valid} Records`}
            </Button>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === 'result' && importResult && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <div className="text-xl font-bold text-green-800">Import Complete</div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
              <div className="text-sm text-gray-500">Created</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-yellow-600">{importResult.skipped}</div>
              <div className="text-sm text-gray-500">Skipped</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
              <div className="text-sm text-gray-500">Errors</div>
            </div>
          </div>

          {importResult.errors.length > 0 && (
            <div className="border border-red-200 rounded-xl overflow-hidden">
              <div className="bg-red-50 px-4 py-2 font-medium text-sm text-red-700">Errors</div>
              <div className="max-h-48 overflow-y-auto">
                {importResult.errors.slice(0, 50).map((e, i) => (
                  <div key={i} className="px-4 py-2 border-t text-sm">
                    <span className="font-mono text-red-600">Row {e.row}</span> — {e.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center">
            <Button onClick={() => { setStep('choose'); setParsedData(null); setValidation(null); setImportResult(null); setCsvData([]); }}>
              Import Another File
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ImportWizard;
