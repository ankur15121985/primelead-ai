import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search, Plus, Download, Upload, ChevronLeft, ChevronRight, MoreHorizontal, Filter,
  Users, X, Phone, Mail,
} from 'lucide-react';
import { useLeads, useBulkLeads, useExportLeads, useTeam, type LeadFilters } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { DropdownMenu, DropdownItem, DropdownLabel, DropdownSeparator } from '@/components/ui/dropdown-menu';
import { StatusBadge, PriorityBadge } from '@/components/leads/StatusBadge';
import { NewLeadDialog } from '@/components/leads/NewLeadDialog';
import { ImportDialog } from '@/components/leads/ImportDialog';
import { formatINR, formatDate, dueLabel } from '@/lib/format';
import { LEAD_SOURCES, LEAD_STATUSES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function Leads() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const { success, error } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const filters: LeadFilters = useMemo(
    () => ({
      search: params.get('search') || undefined,
      status: params.get('status') || undefined,
      source: params.get('source') || undefined,
      ownerId: params.get('ownerId') || undefined,
      page: Number(params.get('page') || 1),
      sort: params.get('sort') || 'createdAt',
      dir: (params.get('dir') as 'asc' | 'desc') || 'desc',
    }),
    [params]
  );

  const { data, isLoading, isFetching } = useLeads(filters);
  const bulk = useBulkLeads();
  const exportCsv = useExportLeads(filters);
  const { data: team } = useTeam();

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === 'ALL') next.delete(key);
    else next.set(key, value);
    next.delete('page');
    setParams(next);
  };

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.rows.length) setSelected(new Set());
    else setSelected(new Set(data.rows.map((r) => r.id)));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const runBulk = async (action: 'assign' | 'status' | 'delete', value?: string) => {
    if (!selected.size) return;
    try {
      await bulk.mutateAsync({ ids: [...selected], action, ownerId: action === 'assign' ? value : undefined, status: action === 'status' ? value : undefined });
      success('Done', `${selected.size} lead(s) updated.`);
      setSelected(new Set());
    } catch (err) {
      error('Action failed', friendlyError(err));
    }
  };

  const page = data?.pagination;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leads"
        description={page ? `${page.total} lead${page.total === 1 ? '' : 's'} in your inbox` : 'Every enquiry, in one place.'}
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import</Button>
            <Button variant="outline" onClick={() => exportCsv.exportCsv()}><Download className="h-4 w-4" /> Export</Button>
            <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Add lead</Button>
          </>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search name, phone, company…"
            defaultValue={filters.search || ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setFilter('search', (e.target as HTMLInputElement).value.trim());
            }}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={filters.status || 'ALL'} onChange={(e) => setFilter('status', e.target.value)} className="h-9 w-36">
            <option value="ALL">All statuses</option>
            {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
          </Select>
          <Select value={filters.source || 'ALL'} onChange={(e) => setFilter('source', e.target.value)} className="h-9 w-40">
            <option value="ALL">All sources</option>
            {LEAD_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </Select>
          {user && user.role !== 'SALES' && (
            <Select value={filters.ownerId || 'ALL'} onChange={(e) => setFilter('ownerId', e.target.value)} className="h-9 w-36">
              <option value="ALL">All owners</option>
              {team?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </Select>
          )}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium', showFilters ? 'bg-accent' : 'bg-background hover:bg-accent')}
          >
            <Filter className="h-4 w-4" /> More
          </button>
        </div>
      </div>

      {/* Advanced filters */}
      {showFilters && (
        <div className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-3 animate-fade-in">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Priority</label>
            <Select value={params.get('priority') || 'ALL'} onChange={(e) => setFilter('priority', e.target.value)} className="mt-1">
              <option value="ALL">All priorities</option>
              {['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
            </Select>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Minimum value (₹)</label>
            <Input type="number" min={0} className="mt-1" placeholder="e.g. 100000" onBlur={(e) => setFilter('minValue', e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Sort by</label>
            <Select
              value={`${filters.sort || 'createdAt'}:${filters.dir || 'desc'}`}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split(':');
                setFilter('sort', sort);
                setFilter('dir', dir);
              }}
              className="mt-1"
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="expectedValue:desc">Value: high → low</option>
              <option value="score:desc">Score: high → low</option>
              <option value="nextFollowUpAt:asc">Follow-up: soonest</option>
            </Select>
          </div>
        </div>
      )}

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 animate-fade-in">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          {user && user.role !== 'SALES' && (
            <>
              <Select className="h-8 w-40" defaultValue="" onChange={(e) => { if (e.target.value) runBulk('assign', e.target.value); e.target.value = ''; }}>
                <option value="" disabled>Assign to…</option>
                {team?.users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
              <Select className="h-8 w-40" defaultValue="" onChange={(e) => { if (e.target.value) runBulk('status', e.target.value); e.target.value = ''; }}>
                <option value="" disabled>Set status…</option>
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
              </Select>
            </>
          )}
          <Button variant="destructive" size="sm" onClick={() => runBulk('delete')}><X className="h-4 w-4" /> Delete</Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      {/* Table */}
      <CardTable>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <input type="checkbox" checked={selected.size > 0 && selected.size === (data?.rows.length || 0)} onChange={toggleAll} aria-label="Select all leads" className="h-4 w-4 accent-primary" />
            </TableHead>
            <TableHead>Lead</TableHead>
            <TableHead className="hidden md:table-cell">Source</TableHead>
            <TableHead className="hidden lg:table-cell">Status</TableHead>
            <TableHead className="hidden sm:table-cell">Owner</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="hidden xl:table-cell">Next follow-up</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}><TableCell colSpan={8}><Skeleton className="h-10" /></TableCell></TableRow>
            ))
          )}
          {!isLoading && data && data.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={8}>
                <EmptyState
                  icon={<Users className="h-6 w-6" />}
                  title={filters.search || filters.status || filters.source ? 'No leads match your filters' : 'No leads yet'}
                  description="Connect your first lead source, import your Excel file, or add a lead manually."
                  action={
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Add lead</Button>
                      <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" /> Import CSV</Button>
                    </div>
                  }
                />
              </TableCell>
            </TableRow>
          )}
          {data?.rows.map((lead) => {
            const dl = dueLabel(lead.nextFollowUpAt);
            return (
              <TableRow key={lead.id} className={selected.has(lead.id) ? 'bg-primary/5' : ''}>
                <TableCell>
                  <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)} aria-label={`Select ${lead.name}`} className="h-4 w-4 accent-primary" />
                </TableCell>
                <TableCell>
                  <Link to={`/app/leads/${lead.id}`} className="group">
                    <p className="font-semibold group-hover:text-primary">{lead.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      {lead.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" />{lead.phone}</span>}
                      {lead.phone && lead.email && <span>·</span>}
                      {lead.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" />{lead.email}</span>}
                    </p>
                  </Link>
                </TableCell>
                <TableCell className="hidden md:table-cell"><Badge tone="muted">{lead.source}</Badge></TableCell>
                <TableCell className="hidden lg:table-cell"><StatusBadge status={lead.status} /></TableCell>
                <TableCell className="hidden sm:table-cell">
                  {lead.owner ? (
                    <span className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {lead.owner.name.split(' ').map((p) => p[0]).join('')}
                      </span>
                      <span className="text-sm">{lead.owner.name}</span>
                    </span>
                  ) : <span className="text-xs text-muted-foreground">Unassigned</span>}
                </TableCell>
                <TableCell className="text-right">
                  <p className="font-semibold">{formatINR(lead.expectedValue)}</p>
                  <PriorityBadge priority={lead.priority} />
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {lead.nextFollowUpAt ? (
                    <span className={cn('text-xs font-medium', dl.tone === 'danger' ? 'text-destructive' : dl.tone === 'warning' ? 'text-amber-600' : 'text-muted-foreground')}>
                      {dl.label}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <DropdownMenu
                    trigger={<button className="rounded-lg p-1.5 hover:bg-accent" aria-label="Lead actions"><MoreHorizontal className="h-4 w-4" /></button>}
                  >
                    <DropdownItem onSelect={() => undefined}>
                      <Link to={`/app/leads/${lead.id}`} className="w-full">View lead</Link>
                    </DropdownItem>
                    <DropdownItem onSelect={() => setSelected(new Set([lead.id]))}>Select</DropdownItem>
                    {user && user.role !== 'SALES' && (
                      <>
                        <DropdownSeparator />
                        <DropdownItem danger onSelect={() => runBulk('delete')}>Delete</DropdownItem>
                      </>
                    )}
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </CardTable>

      {/* Pagination */}
      {page && page.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page.page} of {page.pages} · {page.total} leads
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={page.page <= 1 || isFetching}
              onClick={() => setFilter('page', String(page.page - 1))}
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={page.page >= page.pages || isFetching}
              onClick={() => setFilter('page', String(page.page + 1))}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <NewLeadDialog open={newOpen} onOpenChange={setNewOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

import { Card } from '@/components/ui/card';
function CardTable({ children }: { children: React.ReactNode }) {
  return <Card className="overflow-hidden"><div className="p-1">{children}</div></Card>;
}
