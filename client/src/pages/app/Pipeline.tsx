import { useState } from 'react';
import { Link } from 'react-router-dom';
import { KanbanSquare, Phone, MessageCircle } from 'lucide-react';
import { usePipeline, useMoveLead } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatINR, inrShort } from '@/lib/format';
import { sourceLabel } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Lead, PipelineStage } from '@/types';

const STATUS_FOR_STAGE: Record<string, string> = {
  New: 'NEW', Contacted: 'CONTACTED', Qualified: 'QUALIFIED', Proposal: 'PROPOSAL',
  Negotiation: 'NEGOTIATION', Won: 'WON', Lost: 'LOST',
};

export function Pipeline() {
  const { data, isLoading } = usePipeline();
  const moveLead = useMoveLead();
  const { success, error } = useToast();
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const move = async (lead: Lead, stage: PipelineStage) => {
    setDragging(null);
    setOverStage(null);
    if (lead.stageId === stage.id) return;
    try {
      await moveLead.mutateAsync({ id: lead.id, stageId: stage.id, status: STATUS_FOR_STAGE[stage.name] || lead.status });
      success('Lead moved', `${lead.name} → ${stage.name}`);
    } catch (err) {
      error('Could not move lead', friendlyError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales pipeline"
        description="Drag leads between stages. Stage changes are logged automatically."
        actions={
          <Link to="/app/leads">
            <Button variant="outline">Manage leads</Button>
          </Link>
        }
      />

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[420px] w-72 shrink-0" />)}
        </div>
      ) : !data || data.stages.length === 0 ? (
        <EmptyState icon={<KanbanSquare className="h-6 w-6" />} title="No pipeline yet" description="Your default pipeline is created automatically when you sign up." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: 'x proximity' }}>
          {data.stages.map((stage) => {
            const total = stage.leads.reduce((s, l) => s + l.expectedValue, 0);
            const isOver = overStage === stage.id && dragging;
            return (
              <div
                key={stage.id}
                onDragOver={(e) => { e.preventDefault(); setOverStage(stage.id); }}
                onDragLeave={() => setOverStage((s) => (s === stage.id ? null : s))}
                onDrop={() => dragging && move(dragging, stage)}
                className={cn(
                  'flex w-72 shrink-0 flex-col rounded-2xl border bg-muted/30 transition-colors',
                  isOver && 'border-primary/60 bg-primary/5'
                )}
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
                    <span className="text-sm font-bold">{stage.name}</span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{stage.leads.length}</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{inrShort.format(total)}</span>
                </div>
                <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-3" style={{ maxHeight: '60vh' }}>
                  {stage.leads.length === 0 && (
                    <div className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground">Drop a lead here</div>
                  )}
                  {stage.leads.map((lead) => (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDragging(lead)}
                      onDragEnd={() => { setDragging(null); setOverStage(null); }}
                      className={cn(
                        'cursor-grab rounded-xl border bg-card p-3.5 shadow-sm transition-all hover:shadow-md active:cursor-grabbing',
                        dragging?.id === lead.id && 'opacity-40'
                      )}
                    >
                      <Link to={`/app/leads/${lead.id}`} className="block">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold">{lead.name}</p>
                          <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                            lead.priority === 'URGENT' ? 'bg-red-100 text-red-700' : lead.priority === 'HIGH' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600')}>
                            {lead.priority}
                          </span>
                        </div>
                        {lead.company && <p className="truncate text-xs text-muted-foreground">{lead.company}</p>}
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="text-xs font-bold">{formatINR(lead.expectedValue)}</span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <span className="rounded bg-muted px-1.5 py-0.5">{sourceLabel(lead.source)}</span>
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between border-t pt-2">
                          <span className="text-[11px] text-muted-foreground">
                            {lead.owner?.name || 'Unassigned'}
                          </span>
                          <span className="flex gap-1">
                            {lead.phone && <Phone className="h-3 w-3 text-muted-foreground" />}
                            {lead.phone && <MessageCircle className="h-3 w-3 text-muted-foreground" />}
                          </span>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
