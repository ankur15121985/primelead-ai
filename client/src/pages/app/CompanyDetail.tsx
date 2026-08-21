import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Building2, Globe, MapPin, Users, DollarSign, Calendar,
  Phone, Mail, ExternalLink, RefreshCw, Plus, Edit,
  Database, Tag, Briefcase, TrendingUp,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  legalName?: string | null;
  website?: string | null;
  domain?: string | null;
  industry?: string | null;
  description?: string | null;
  foundedYear?: number | null;
  employeeCount?: number | null;
  employeeRange?: string | null;
  employeeGrowth?: number | null;
  revenueRange?: string | null;
  fundingTotal?: number | null;
  headquarters?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  technologies?: string[] | null;
  socialProfiles?: Record<string, string> | null;
  phone?: string | null;
  emailDomains?: string[] | null;
  naicsCode?: string | null;
  sicCode?: string | null;
  companyType?: string | null;
  score?: number;
  tags?: string[] | null;
  contacts?: Contact[];
}

interface Contact {
  id: string;
  firstName: string;
  lastName?: string | null;
  fullName?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  seniority?: string | null;
  email?: string | null;
  phone?: string | null;
  score?: number;
}

interface ProvenanceRecord {
  id: string;
  fieldName: string;
  value?: string | null;
  source: string;
  confidence?: number | null;
  collectedAt: string;
  provider?: { name: string; type: string } | null;
}

export function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'contacts' | 'provenance'>('overview');

  const { data, isLoading } = useQuery<{ company: Company }>({
    queryKey: ['company', id],
    queryFn: async () => api<{ company: Company }>(`/companies/${id}`),
    enabled: !!id,
  });

  const { data: provData } = useQuery<{ provenance: ProvenanceRecord[] }>({
    queryKey: ['company-provenance', id],
    queryFn: async () => api<{ provenance: ProvenanceRecord[] }>(`/companies/${id}/provenance`),
    enabled: !!id,
  });

  const enrichMutation = useMutation({
    mutationFn: async () => api<{ enriched: boolean; message?: string }>(`/companies/${id}/enrich`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] });
      queryClient.invalidateQueries({ queryKey: ['company-provenance', id] });
    },
  });

  const company = data?.company;
  if (isLoading) return <div className="space-y-4"><div className="h-8 w-48 animate-pulse rounded bg-slate-200" /><div className="h-64 animate-pulse rounded-lg bg-slate-100" /></div>;
  if (!company) return <div className="py-12 text-center text-slate-500"><Building2 className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p>Company not found</p><Button variant="outline" className="mt-4" onClick={() => navigate('/app/companies')}>Back to Companies</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/app/companies" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"><ArrowLeft className="h-4 w-4" /> Companies</Link>
          <h1 className="text-2xl font-bold">{company.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {company.domain && <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> {company.domain}</span>}
            {company.industry && <Badge tone="muted">{company.industry}</Badge>}
            {company.employeeRange && <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {company.employeeRange}</span>}
            {company.country && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {[company.city, company.country].filter(Boolean).join(', ')}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => enrichMutation.mutate()} disabled={enrichMutation.isPending}>
            <RefreshCw className={`mr-2 h-4 w-4 ${enrichMutation.isPending ? 'animate-spin' : ''}`} /> Enrich
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {(['overview', 'contacts', 'provenance'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>{tab}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {company.description && <Card title="About"><p className="text-sm text-slate-600">{company.description}</p></Card>}
            <Card title="Company Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoRow icon={<Building2 />} label="Legal Name" value={company.legalName} />
                <InfoRow icon={<Briefcase />} label="Type" value={company.companyType} />
                <InfoRow icon={<Calendar />} label="Founded" value={company.foundedYear ? String(company.foundedYear) : undefined} />
                <InfoRow icon={<Users />} label="Employees" value={company.employeeCount ? company.employeeCount.toLocaleString() : company.employeeRange} />
                <InfoRow icon={<TrendingUp />} label="Growth" value={company.employeeGrowth ? `${company.employeeGrowth}%` : undefined} />
                <InfoRow icon={<DollarSign />} label="Revenue" value={company.revenueRange} />
                <InfoRow icon={<MapPin />} label="HQ" value={company.headquarters || [company.city, company.state, company.country].filter(Boolean).join(', ')} />
                <InfoRow icon={<Globe />} label="NAICS" value={company.naicsCode} />
                <InfoRow icon={<Globe />} label="SIC" value={company.sicCode} />
              </div>
            </Card>
            {company.technologies && company.technologies.length > 0 && (
              <Card title="Technologies"><div className="flex flex-wrap gap-2">{company.technologies.map((t) => <Badge key={t} tone="muted">{t}</Badge>)}</div></Card>
            )}
            {company.tags && company.tags.length > 0 && (
              <Card title="Tags"><div className="flex flex-wrap gap-2">{company.tags.map((t) => <Badge key={t} tone="muted"><Tag className="mr-1 h-3 w-3" />{t}</Badge>)}</div></Card>
            )}
          </div>
          <div className="space-y-4">
            <Card title="Contact Info">
              <div className="space-y-3">
                {company.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-slate-400" /><span>{company.phone}</span></div>}
                {company.website && <div className="flex items-center gap-2 text-sm"><Globe className="h-4 w-4 text-slate-400" /><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{company.website}</a></div>}
                {company.emailDomains && company.emailDomains.length > 0 && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-slate-400" /><span>{company.emailDomains.join(', ')}</span></div>}
              </div>
            </Card>
            {company.socialProfiles && Object.keys(company.socialProfiles).length > 0 && (
              <Card title="Social Profiles">
                <div className="space-y-2">
                  {Object.entries(company.socialProfiles).map(([platform, url]) => (
                    <a key={platform} href={url as string} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline"><ExternalLink className="h-3 w-3" />{platform}</a>
                  ))}
                </div>
              </Card>
            )}
            {company.score !== undefined && company.score > 0 && (
              <Card title="Score"><div className="text-center"><div className="text-3xl font-bold">{company.score}</div><p className="text-xs text-slate-500">out of 100</p></div></Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{company.contacts?.length || 0} Contacts</h3>
            <Link to={`/app/company-contacts/new?companyId=${id}`}><Button size="sm"><Plus className="mr-2 h-4 w-4" /> Add Contact</Button></Link>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Seniority</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(!company.contacts || company.contacts.length === 0) ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">No contacts yet.</td></tr>
                ) : company.contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{c.fullName || [c.firstName, c.lastName].filter(Boolean).join(' ')}</td>
                    <td className="px-4 py-3 text-slate-600">{c.jobTitle || '—'}</td>
                    <td className="px-4 py-3">{c.department ? <Badge tone="muted">{c.department}</Badge> : '—'}</td>
                    <td className="px-4 py-3">{c.seniority ? <Badge tone="muted">{c.seniority}</Badge> : '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'provenance' && (
        <div>
          {(!provData?.provenance || provData.provenance.length === 0) ? (
            <div className="py-8 text-center text-slate-500"><Database className="mx-auto mb-2 h-8 w-8 text-slate-300" /><p>No provenance data yet</p><p className="text-xs">Run enrichment to see data sources and confidence scores</p></div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Field</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Confidence</th>
                    <th className="px-4 py-3">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {provData.provenance.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">{r.fieldName}</td>
                      <td className="px-4 py-3 text-slate-600">{r.value || '—'}</td>
                      <td className="px-4 py-3"><Badge tone="muted">{r.source}</Badge></td>
                      <td className="px-4 py-3">
                        {r.confidence != null ? <span className={`font-medium ${r.confidence >= 0.8 ? 'text-emerald-600' : r.confidence >= 0.5 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(r.confidence * 100)}%</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{new Date(r.collectedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-white p-4"><h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>{children}</div>;
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return <div className="flex items-center gap-2"><span className="text-slate-400">{icon}</span><div><p className="text-xs text-slate-500">{label}</p><p className="text-sm font-medium">{value}</p></div></div>;
}

export default CompanyDetail;
