import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

interface ForecastResult {
  period: string;
  periodType: string;
  pipelineValue: number;
  commitValue: number;
  bestCaseValue: number;
  closedWon: number;
  closedLost: number;
  confidence: number;
  dealCount: number;
  weightedPipeline: number;
  manualCommit: number | null;
  manualBestCase: number | null;
  manualPipeline: number | null;
  aiPrediction: number | null;
  aiConfidence: number | null;
  aiFactors: string[];
  stageBreakdown: Array<{ stage: string; count: number; value: number; probability: number }>;
}

interface ForecastEntry {
  id: string;
  period: string;
  periodType: string;
  pipelineValue: number;
  commitValue: number;
  bestCaseValue: number;
  closedWon: number;
  closedLost: number;
  confidence: number;
  dealCount: number;
  weightedPipeline: number;
  manualCommit: number | null;
  manualBestCase: number | null;
  manualPipeline: number | null;
  aiPrediction: number | null;
  user?: { id: string; name: string; email: string };
  createdAt: string;
}

function formatCurrency(paise: number): string {
  if (paise >= 10000000) return `₹${(paise / 10000000).toFixed(1)}Cr`;
  if (paise >= 100000) return `₹${(paise / 100000).toFixed(1)}L`;
  if (paise >= 1000) return `₹${(paise / 1000).toFixed(1)}K`;
  return `₹${paise}`;
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function ForecastDashboard() {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [forecasts, setForecasts] = useState<ForecastEntry[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [period, setPeriod] = useState(getCurrentPeriod());
  const [periodType, setPeriodType] = useState<'MONTH' | 'QUARTER'>('MONTH');
  const [tab, setTab] = useState<'overview' | 'saved' | 'summary'>('overview');

  // Manual overrides
  const [manualCommit, setManualCommit] = useState('');
  const [manualBestCase, setManualBestCase] = useState('');
  const [manualPipeline, setManualPipeline] = useState('');

  const calculate = useCallback(async () => {
    setCalculating(true);
    try {
      const data = await api<{ forecast: ForecastResult }>('/forecast/calculate', {
        body: { period, periodType },
      });
      setForecast(data.forecast);
    } catch { /* ignore */ }
    setCalculating(false);
  }, [period, periodType]);

  const loadSaved = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ forecasts: ForecastEntry[] }>('/forecast');
      setForecasts(data.forecasts || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ summary: any }>(`/forecast/summary?period=${period}`);
      setSummary(data.summary);
    } catch { /* ignore */ }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    if (tab === 'overview') calculate();
    else if (tab === 'saved') loadSaved();
    else loadSummary();
  }, [tab, calculate, loadSaved, loadSummary]);

  const saveForecast = async () => {
    try {
      await api('/forecast/save', {
        body: {
          period,
          periodType,
          manualCommit: manualCommit ? Number(manualCommit) : undefined,
          manualBestCase: manualBestCase ? Number(manualBestCase) : undefined,
          manualPipeline: manualPipeline ? Number(manualPipeline) : undefined,
        },
      });
      loadSaved();
    } catch { /* ignore */ }
  };

  const maxBarValue = Math.max(
    forecast?.pipelineValue || 0,
    forecast?.commitValue || 0,
    forecast?.bestCaseValue || 1,
    1,
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Forecast</h1>
          <p className="text-sm text-gray-500 mt-1">Pipeline projection, commit/best-case breakdown, and AI predictions</p>
        </div>
        <div className="flex gap-2 items-center">
          <select value={periodType} onChange={(e) => setPeriodType(e.target.value as any)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="MONTH">Monthly</option>
            <option value="QUARTER">Quarterly</option>
          </select>
          <input value={period} onChange={(e) => setPeriod(e.target.value)} className="border rounded-lg px-3 py-2 text-sm w-32" placeholder="2024-01" />
          <Button onClick={calculate} disabled={calculating}>{calculating ? 'Calculating...' : 'Recalculate'}</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['overview', 'saved', 'summary'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'overview' ? 'Pipeline Forecast' : t === 'saved' ? `Saved Forecasts (${forecasts.length})` : 'Team Summary'}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && forecast && (
        <div className="space-y-6">
          {/* Key metrics */}
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{forecast.dealCount}</div>
              <div className="text-sm text-gray-500">Active Deals</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-blue-600">{formatCurrency(forecast.pipelineValue)}</div>
              <div className="text-sm text-gray-500">Pipeline</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-green-600">{formatCurrency(forecast.commitValue)}</div>
              <div className="text-sm text-gray-500">Commit</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-yellow-600">{formatCurrency(forecast.bestCaseValue)}</div>
              <div className="text-sm text-gray-500">Best Case</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-purple-600">{formatCurrency(forecast.closedWon)}</div>
              <div className="text-sm text-gray-500">Closed Won</div>
            </div>
          </div>

          {/* Pipeline bar chart */}
          <div className="border rounded-xl p-4 space-y-3">
            <h3 className="font-medium text-gray-900">Pipeline Breakdown</h3>
            <div className="space-y-2">
              {[
                { label: 'Total Pipeline', value: forecast.pipelineValue, color: 'bg-blue-500' },
                { label: 'Weighted Pipeline', value: forecast.weightedPipeline, color: 'bg-indigo-500' },
                { label: 'Commit', value: forecast.commitValue, color: 'bg-green-500' },
                { label: 'Best Case', value: forecast.bestCaseValue, color: 'bg-yellow-500' },
                { label: 'Closed Won', value: forecast.closedWon, color: 'bg-emerald-500' },
              ].map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-gray-600">{bar.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                    <div className={`${bar.color} h-full rounded-full transition-all`} style={{ width: `${maxBarValue > 0 ? (bar.value / maxBarValue) * 100 : 0}%` }} />
                  </div>
                  <div className="w-20 text-sm text-right font-mono">{formatCurrency(bar.value)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage breakdown */}
          {forecast.stageBreakdown.length > 0 && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Stage</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Deals</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Value</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Probability</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Weighted</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.stageBreakdown.map((stage) => (
                    <tr key={stage.stage} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">{stage.stage}</td>
                      <td className="px-4 py-2 text-center">{stage.count}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(stage.value)}</td>
                      <td className="px-4 py-2 text-center">{stage.probability}%</td>
                      <td className="px-4 py-2 text-right font-mono">{formatCurrency(Math.round(stage.value * stage.probability / 100))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Manual overrides + AI prediction */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-gray-900">Manual Overrides</h3>
              <input placeholder={`Commit (auto: ${formatCurrency(forecast.commitValue)})`} value={manualCommit} onChange={(e) => setManualCommit(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder={`Best Case (auto: ${formatCurrency(forecast.bestCaseValue)})`} value={manualBestCase} onChange={(e) => setManualBestCase(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <input placeholder={`Pipeline (auto: ${formatCurrency(forecast.pipelineValue)})`} value={manualPipeline} onChange={(e) => setManualPipeline(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
              <Button size="sm" onClick={saveForecast}>Save Forecast</Button>
            </div>
            <div className="border rounded-xl p-4 space-y-3">
              <h3 className="font-medium text-gray-900">AI Prediction</h3>
              {forecast.aiPrediction ? (
                <>
                  <div className="text-2xl font-bold text-purple-600">{formatCurrency(forecast.aiPrediction)}</div>
                  <div className="text-sm text-gray-500">Predicted revenue · {forecast.aiConfidence || 0}% confidence</div>
                  <ul className="text-xs text-gray-500 space-y-1 mt-2">
                    {forecast.aiFactors.map((f, i) => <li key={i}>• {f}</li>)}
                  </ul>
                </>
              ) : (
                <div className="text-sm text-gray-400">AI prediction unavailable — add pipeline data</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'overview' && !forecast && !calculating && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <div className="text-4xl mb-2">📈</div>
          <div>Click Calculate to generate a forecast</div>
        </div>
      )}

      {/* Saved Forecasts */}
      {tab === 'saved' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : forecasts.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <div className="text-4xl mb-2">📋</div>
              <div>No saved forecasts yet</div>
            </div>
          ) : (
            forecasts.map((f) => (
              <div key={f.id} className="border rounded-xl p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge>{f.period}</Badge>
                    <span className="text-sm text-gray-500">{f.periodType}</span>
                    {f.user && <span className="text-sm text-gray-700">{f.user.name}</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-500">Pipeline: <span className="font-mono">{formatCurrency(f.pipelineValue)}</span></span>
                    <span className="text-green-600">Commit: <span className="font-mono">{formatCurrency(f.manualCommit || f.commitValue)}</span></span>
                    <span className="text-yellow-600">Best: <span className="font-mono">{formatCurrency(f.manualBestCase || f.bestCaseValue)}</span></span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Team Summary */}
      {tab === 'summary' && summary && (
        <div className="space-y-4">
          <div className="grid grid-cols-5 gap-4">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{summary.repCount}</div>
              <div className="text-sm text-gray-500">Reps</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalPipeline)}</div>
              <div className="text-sm text-gray-500">Total Pipeline</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-green-600">{formatCurrency(summary.totalCommit)}</div>
              <div className="text-sm text-gray-500">Total Commit</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-yellow-600">{formatCurrency(summary.totalBestCase)}</div>
              <div className="text-sm text-gray-500">Total Best Case</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-lg font-bold text-purple-600">{formatCurrency(summary.totalClosedWon)}</div>
              <div className="text-sm text-gray-500">Closed Won</div>
            </div>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Rep</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Deals</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Pipeline</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Commit</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Best Case</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Won</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {summary.forecasts.map((f: ForecastEntry) => (
                  <tr key={f.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-2">{f.user?.name || 'Org-wide'}</td>
                    <td className="px-4 py-2 text-center">{f.dealCount}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatCurrency(f.pipelineValue)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatCurrency(f.manualCommit || f.commitValue)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatCurrency(f.manualBestCase || f.bestCaseValue)}</td>
                    <td className="px-4 py-2 text-right font-mono">{formatCurrency(f.closedWon)}</td>
                    <td className="px-4 py-2 text-center">{f.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'summary' && !summary && !loading && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <div className="text-4xl mb-2">📊</div>
          <div>No forecast data for this period</div>
        </div>
      )}
    </div>
  );
}

export default ForecastDashboard;
