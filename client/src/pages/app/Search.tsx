import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search as SearchIcon, Sparkles, Building2, Users, User, Globe, MapPin, ArrowRight, Loader2, X } from 'lucide-react';

interface SearchResult {
  results: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface NLResponse {
  filters: { field: string; operator: string; value: unknown }[];
  search?: string;
  explanation?: string;
  entityType?: string;
}

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [entityType, setEntityType] = useState<'companies' | 'contacts' | 'leads'>('companies');
  const [activeFilters, setActiveFilters] = useState<{ field: string; operator: string; value: unknown }[]>([]);
  const [searchText, setSearchText] = useState('');
  const [nlExplanation, setNlExplanation] = useState('');

  const nlMutation = useMutation({
    mutationFn: async (nlQuery: string) => {
      return api<NLResponse>('/search/natural-language', { method: 'POST', body: { query: nlQuery, entityType } });
    },
    onSuccess: (data) => {
      setActiveFilters(data.filters || []);
      setSearchText(data.search || '');
      setNlExplanation(data.explanation || '');
    },
  });

  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ['search', entityType, activeFilters, searchText],
    queryFn: async () => {
      return api<SearchResult>('/search', { method: 'POST', body: { entityType, filters: activeFilters, search: searchText || undefined, pageSize: 50 } });
    },
    enabled: activeFilters.length > 0 || !!searchText,
  });

  const handleNLSearch = () => { if (query.trim()) nlMutation.mutate(query); };
  const removeFilter = (index: number) => setActiveFilters((prev) => prev.filter((_, i) => i !== index));
  const clearAll = () => { setActiveFilters([]); setSearchText(''); setNlExplanation(''); setQuery(''); };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search</h1>
        <p className="text-sm text-slate-500">Find companies, contacts, and leads with advanced filters or natural language</p>
      </div>

      <div className="flex gap-2">
        {(['companies', 'contacts', 'leads'] as const).map((type) => (
          <button key={type} onClick={() => { setEntityType(type); clearAll(); }} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${entityType === type ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {type === 'companies' && <Building2 className="h-4 w-4" />}
            {type === 'contacts' && <Users className="h-4 w-4" />}
            {type === 'leads' && <User className="h-4 w-4" />}
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      <div className="rounded-lg border-2 border-dashed border-blue-200 bg-blue-50/50 p-6">
        <div className="mb-3 flex items-center gap-2"><Sparkles className="h-5 w-5 text-blue-600" /><h3 className="font-semibold text-blue-900">Natural Language Search</h3></div>
        <p className="mb-4 text-sm text-blue-700">Try: &ldquo;Find SaaS companies in India with 50-500 employees that are hiring salespeople&rdquo;</p>
        <div className="flex gap-2">
          <Input placeholder="Describe what you're looking for..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleNLSearch()} className="flex-1 bg-white" />
          <Button onClick={handleNLSearch} disabled={nlMutation.isPending || !query.trim()}>
            {nlMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Search
          </Button>
        </div>
        {nlExplanation && <p className="mt-3 text-sm text-blue-600"><strong>Interpreted as:</strong> {nlExplanation}</p>}
      </div>

      {activeFilters.length > 0 && (
        <div className="rounded-lg border bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700">Active Filters ({activeFilters.length})</h3>
            <Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f, i) => (
              <Badge key={i} tone="muted" className="gap-1">
                <span className="font-mono text-xs">{f.field}</span>
                <span className="text-slate-400">{f.operator}</span>
                <span className="font-mono text-xs">{Array.isArray(f.value) ? f.value.join(', ') : String(f.value)}</span>
                <button onClick={() => removeFilter(i)} className="ml-1 hover:text-red-600"><X className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Quick Filters</h3>
        <div className="flex flex-wrap gap-2">
          {entityType === 'companies' && (
            <>
              <QuickFilter label="SaaS Companies" filters={[{ field: 'industry', operator: 'eq', value: 'TECHNOLOGY' }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="50-200 Employees" filters={[{ field: 'employeeRange', operator: 'in', value: ['51-200'] }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="India" filters={[{ field: 'country', operator: 'eq', value: 'India' }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="Has Website" filters={[{ field: 'website', operator: 'exists', value: true }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="Score 80+" filters={[{ field: 'score', operator: 'gte', value: 80 }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
            </>
          )}
          {entityType === 'contacts' && (
            <>
              <QuickFilter label="C-Level" filters={[{ field: 'seniority', operator: 'eq', value: 'C_LEVEL' }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="VPs" filters={[{ field: 'seniority', operator: 'eq', value: 'VP' }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="Engineering" filters={[{ field: 'department', operator: 'eq', value: 'ENGINEERING' }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="Has LinkedIn" filters={[{ field: 'linkedinUrl', operator: 'exists', value: true }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
            </>
          )}
          {entityType === 'leads' && (
            <>
              <QuickFilter label="New Leads" filters={[{ field: 'status', operator: 'eq', value: 'NEW' }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="High Priority" filters={[{ field: 'priority', operator: 'in', value: ['HIGH', 'URGENT'] }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="Has Email" filters={[{ field: 'hasEmail', operator: 'exists', value: true }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
              <QuickFilter label="Score 70+" filters={[{ field: 'score', operator: 'gte', value: 70 }]} onClick={(f) => setActiveFilters((prev) => [...prev, ...f])} />
            </>
          )}
        </div>
      </div>

      {isLoading && <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />)}</div>}

      {data && data.results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{data.total} results found</p>
          <div className="divide-y rounded-lg border">
            {data.results.map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white px-4 py-3 hover:bg-slate-50">
                <div>
                  <p className="font-medium">{(item.name as string) || (item.firstName as string) || 'Unknown'}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {item.domain ? <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{String(item.domain)}</span> : null}
                    {item.industry ? <span>{String(item.industry)}</span> : null}
                    {item.country ? <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{String(item.country)}</span> : null}
                    {item.employeeRange ? <span>{String(item.employeeRange)}</span> : null}
                    {item.jobTitle ? <span>{String(item.jobTitle)}</span> : null}
                  </div>
                </div>
                <Link to={entityType === 'companies' ? `/app/companies/${String(item.id)}` : entityType === 'contacts' ? `/app/company-contacts/${String(item.id)}` : `/app/leads/${String(item.id)}`} className="rounded p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600">
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && data.results.length === 0 && activeFilters.length > 0 && !isLoading && (
        <div className="py-12 text-center text-slate-500"><SearchIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p>No results found</p></div>
      )}
    </div>
  );
}

function QuickFilter({ label, filters, onClick }: { label: string; filters: { field: string; operator: string; value: unknown }[]; onClick: (f: { field: string; operator: string; value: unknown }[]) => void }) {
  return <button onClick={() => onClick(filters)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700">{label}</button>;
}

export default SearchPage;
