import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Plus, Search, Filter, Globe, MapPin, Users, DollarSign,
  ExternalLink, Trash2, Edit,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  legalName?: string | null;
  website?: string | null;
  domain?: string | null;
  industry?: string | null;
  subIndustry?: string | null;
  description?: string | null;
  foundedYear?: number | null;
  employeeCount?: number | null;
  employeeRange?: string | null;
  revenueRange?: string | null;
  fundingTotal?: number | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  headquarters?: string | null;
  technologies?: string[] | null;
  phone?: string | null;
  companyType?: string | null;
  status?: string;
  score?: number;
  tags?: string[] | null;
  _count?: { contacts: number };
}

interface SearchResult {
  results: Company[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const INDUSTRIES = [
  'TECHNOLOGY', 'HEALTHCARE', 'FINANCE', 'MANUFACTURING', 'RETAIL',
  'EDUCATION', 'REAL_ESTATE', 'ENERGY', 'CONSULTING', 'LEGAL',
  'MEDIA', 'HOSPITALITY', 'TRANSPORTATION', 'AGRICULTURE', 'OTHER',
];
const EMPLOYEE_RANGES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'];
const REVENUE_RANGES = ['0-1M', '1M-10M', '10M-50M', '50M-100M', '100M-500M', '500M-1B', '1B+'];
const COUNTRIES = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Singapore', 'UAE', 'Other'];

export function Companies() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ['companies', search, page, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', '25');
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      return api<SearchResult>(`/companies?${params}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api<{ deleted: boolean }>(`/companies/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['companies'] }),
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => { setFilters({}); setPage(1); };
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-sm text-slate-500">{data?.total ?? 0} companies in your database</p>
        </div>
        <Link to="/app/companies/new">
          <Button><Plus className="mr-2 h-4 w-4" /> Add Company</Button>
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Search companies by name, domain, industry..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
        </div>
        <Button variant={showFilters ? 'primary' : 'outline'} onClick={() => setShowFilters(!showFilters)}>
          <Filter className="mr-2 h-4 w-4" /> Filters
          {activeFilterCount > 0 && <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs">{activeFilterCount}</Badge>}
        </Button>
      </div>

      {showFilters && (
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <FilterSelect label="Industry" value={filters.industry || ''} options={INDUSTRIES} onChange={(v) => handleFilterChange('industry', v)} />
            <FilterSelect label="Country" value={filters.country || ''} options={COUNTRIES} onChange={(v) => handleFilterChange('country', v)} />
            <FilterSelect label="Employee Range" value={filters.employeeRange || ''} options={EMPLOYEE_RANGES} onChange={(v) => handleFilterChange('employeeRange', v)} />
            <FilterSelect label="Revenue Range" value={filters.revenueRange || ''} options={REVENUE_RANGES} onChange={(v) => handleFilterChange('revenueRange', v)} />
            <FilterSelect label="Status" value={filters.status || ''} options={['ACTIVE', 'INACTIVE', 'ARCHIVED']} onChange={(v) => handleFilterChange('status', v)} />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Input placeholder="Min employees" type="number" value={filters.minEmployees || ''} onChange={(e) => handleFilterChange('minEmployees', e.target.value)} className="w-32" />
            <span className="text-slate-400">—</span>
            <Input placeholder="Max employees" type="number" value={filters.maxEmployees || ''} onChange={(e) => handleFilterChange('maxEmployees', e.target.value)} className="w-32" />
            {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={clearFilters}>Clear all</Button>}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-slate-200" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-slate-200" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-slate-200" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-slate-200" /></td>
                  <td className="px-4 py-3"><div className="h-4 w-8 rounded bg-slate-200" /></td>
                  <td className="px-4 py-3" />
                </tr>
              ))
            ) : data?.results?.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                  <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p>No companies found</p>
                  <p className="text-xs">Try adjusting your search or filters</p>
                </td>
              </tr>
            ) : (
              data?.results?.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/app/companies/${company.id}`} className="font-medium text-blue-600 hover:underline">{company.name}</Link>
                    {company.domain && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Globe className="h-3 w-3" /> {company.domain}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {company.industry ? <Badge tone="muted">{company.industry}</Badge> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-slate-600">
                      <MapPin className="h-3 w-3" />
                      {[company.city, company.country].filter(Boolean).join(', ') || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-slate-600">
                      <Users className="h-3 w-3" /> {company.employeeRange || company.employeeCount || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-slate-600">
                      <DollarSign className="h-3 w-3" /> {company.revenueRange || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {company.score ? <ScoreBadge score={company.score} /> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link to={`/app/companies/${company.id}`} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Edit className="h-4 w-4" /></Link>
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><ExternalLink className="h-4 w-4" /></a>
                      )}
                      <button onClick={() => { if (confirm('Delete this company?')) deleteMutation.mutate(company.id); }} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.page * data.pageSize, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={data.page >= data.totalPages} onClick={() => setPage(data.page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: readonly string[] | string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
        <option value="">All</option>
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-100 text-emerald-700' : score >= 60 ? 'bg-blue-100 text-blue-700' : score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{score}</span>;
}

export default Companies;
