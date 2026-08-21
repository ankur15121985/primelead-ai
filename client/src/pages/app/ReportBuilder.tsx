import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface MetricDef {
  key: string;
  label: string;
  type: string;
  field?: string;
}

interface DimensionDef {
  key: string;
  label: string;
  type: string;
  field?: string;
  dateGroupBy?: string;
}

interface EntityMeta {
  metrics: MetricDef[];
  dimensions: DimensionDef[];
}

interface ReportGroup extends Record<string, unknown> {
  _count?: number;
}

interface ReportResult {
  config: { entity: string; metrics: string[]; dimensions: string[]; filters?: Record<string, string>; dateFrom?: string; dateTo?: string };
  groups: ReportGroup[];
  totals: Record<string, number>;
  generatedAt: string;
}

interface SavedReport {
  id: string;
  name: string;
  description?: string;
  entityType: string;
  metrics: string[];
  dimensions: string[];
  filters?: Record<string, unknown>;
  chartType: string;
  viewCount: number;
  createdAt: string;
}

export function ReportBuilder() {
  const [metadata, setMetadata] = useState<Record<string, EntityMeta>>({});
  const [entities, setEntities] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState('LEAD');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['leadCount']);
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [reportName, setReportName] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'build' | 'saved'>('build');

  useEffect(() => {
    api<{ entities: string[]; metadata: Record<string, EntityMeta> }>('/reports/metadata').then((data) => {
      setMetadata(data.metadata);
      setEntities(data.entities);
    });
    api<{ reports: SavedReport[] }>('/reports/saved').then((data) => setSavedReports(data.reports || []));
  }, []);

  const entityMeta = metadata[selectedEntity];

  const toggleMetric = (key: string) => {
    setSelectedMetrics((prev) => prev.includes(key) ? prev.filter((m) => m !== key) : [...prev, key]);
  };

  const toggleDimension = (key: string) => {
    setSelectedDimensions((prev) => prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]);
  };

  const runReport = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<ReportResult>('/reports/execute', {
        body: {
          entity: selectedEntity,
          metrics: selectedMetrics,
          dimensions: selectedDimensions,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      });
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [selectedEntity, selectedMetrics, selectedDimensions, filters, dateFrom, dateTo]);

  const saveReport = async () => {
    if (!reportName) return;
    try {
      await api('/reports/saved', {
        body: {
          name: reportName,
          entityType: selectedEntity,
          metrics: selectedMetrics,
          dimensions: selectedDimensions,
          filters: Object.keys(filters).length > 0 ? filters : undefined,
          chartType: 'TABLE',
        },
      });
      const data = await api<{ reports: SavedReport[] }>('/reports/saved');
      setSavedReports(data.reports || []);
      setReportName('');
    } catch {
      // ignore
    }
  };

  const loadSavedReport = async (report: SavedReport) => {
    setSelectedEntity(report.entityType);
    setSelectedMetrics(report.metrics || []);
    setSelectedDimensions(report.dimensions || []);
    setFilters((report.filters as Record<string, string>) || {});
    setTab('build');
    // Auto-run
    setLoading(true);
    try {
      const data = await api<ReportResult>(`/reports/saved/${report.id}/run`);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const deleteSavedReport = async (id: string) => {
    try {
      await api(`/reports/saved/${id}`, { method: 'DELETE' });
      setSavedReports((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Builder</h1>
          <p className="text-sm text-gray-500 mt-1">Create custom reports with configurable metrics and dimensions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['build', 'saved'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'build' ? 'Build Report' : `Saved Reports (${savedReports.length})`}
          </button>
        ))}
      </div>

      {tab === 'build' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Config panel */}
          <div className="col-span-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
              <select value={selectedEntity} onChange={(e) => { setSelectedEntity(e.target.value); setSelectedMetrics([]); setSelectedDimensions([]); }} className="w-full border rounded-lg px-3 py-2 text-sm">
                {entities.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>

            {entityMeta && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Metrics</label>
                  <div className="space-y-1">
                    {entityMeta.metrics.map((m) => (
                      <label key={m.key} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedMetrics.includes(m.key)} onChange={() => toggleMetric(m.key)} className="rounded" />
                        <span>{m.label}</span>
                        <span className="text-xs text-gray-400 ml-auto">{m.type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Group By (Dimensions)</label>
                  <div className="space-y-1">
                    {entityMeta.dimensions.map((d) => (
                      <label key={d.key} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer text-sm">
                        <input type="checkbox" checked={selectedDimensions.includes(d.key)} onChange={() => toggleDimension(d.key)} className="rounded" />
                        <span>{d.label}</span>
                        <span className="text-xs text-gray-400 ml-auto">{d.type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={runReport} disabled={loading || (selectedMetrics.length === 0 && selectedDimensions.length === 0)}>
                {loading ? 'Running...' : 'Run Report'}
              </Button>
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Save Report</label>
              <div className="flex gap-2">
                <input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="Report name..." className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <Button variant="outline" onClick={saveReport} disabled={!reportName}>Save</Button>
              </div>
            </div>
          </div>

          {/* Results panel */}
          <div className="col-span-8">
            {!result && !loading && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
                <div className="text-4xl mb-2">📊</div>
                <div>Select metrics and dimensions, then run the report</div>
              </div>
            )}

            {loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            )}

            {result && !loading && (
              <div className="space-y-4">
                {/* Totals */}
                <div className="grid grid-cols-4 gap-3">
                  {Object.entries(result.totals).map(([key, val]) => (
                    <div key={key} className="bg-white border rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-900">{typeof val === 'number' ? val.toLocaleString() : val}</div>
                      <div className="text-xs text-gray-500">{key}</div>
                    </div>
                  ))}
                </div>

                {/* Data table */}
                {result.groups.length > 0 ? (
                  <div className="border rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          {result.config.dimensions.map((d) => (
                            <th key={d} className="text-left px-4 py-3 font-medium text-gray-600">{d}</th>
                          ))}
                          {result.config.metrics.map((m) => (
                            <th key={m} className="text-right px-4 py-3 font-medium text-gray-600">{m}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.groups.map((group, i) => (
                          <tr key={i} className="border-t hover:bg-gray-50">
                            {result.config.dimensions.map((d) => (
                              <td key={d} className="px-4 py-2">{String(group[d] ?? '—')}</td>
                            ))}
                            {result.config.metrics.map((m) => (
                              <td key={m} className="px-4 py-2 text-right font-mono">
                                {typeof group[m] === 'number' ? (group[m] as number).toLocaleString() : String(group[m] ?? 0)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400 border rounded-xl">No data matches the selected filters</div>
                )}

                <div className="text-xs text-gray-400 text-right">
                  Generated at {new Date(result.generatedAt).toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'saved' && (
        <div className="space-y-3">
          {savedReports.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <div>No saved reports yet. Build a report and save it!</div>
            </div>
          ) : (
            savedReports.map((report) => (
              <div key={report.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{report.name}</span>
                    <Badge>{report.entityType}</Badge>
                    <Badge>{report.chartType || 'TABLE'}</Badge>
                  </div>
                  {report.description && <div className="text-sm text-gray-500 mt-1">{report.description}</div>}
                  <div className="text-xs text-gray-400 mt-1">
                    {(report.metrics || []).length} metrics · {(report.dimensions || []).length} dimensions · Viewed {report.viewCount}x
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => loadSavedReport(report)}>Run</Button>
                  <Button variant="outline" size="sm" onClick={() => deleteSavedReport(report.id)} className="text-red-600 hover:text-red-700">Delete</Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default ReportBuilder;
