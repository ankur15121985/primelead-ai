import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  KanbanSquare, Phone, MessageCircle, Plus, Pencil, Trash2, Target, CheckCircle2, XCircle, CalendarDays,
} from 'lucide-react';
import {
  usePipeline, useMoveLead, useCreatePipeline, useUpdatePipeline, useDeletePipeline,
  useCreateStage, useUpdateStage, useDeleteStage,
} from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { formatINR, formatDate } from '@/lib/format';
import { sourceLabel } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Lead, Pipeline, PipelineStage } from '@/types';

const STAGE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];

export function Pipeline() {
  const { user } = useAuth();
  const isManager = user && ['OWNER', 'ADMIN', 'MANAGER'].includes(user.role);
  const { data, isLoading } = usePipeline();
  const { success, error } = useToast();
  const [pipelineId, setPipelineId] = useState<string | undefined>(undefined);
  const board = usePipeline(pipelineId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales pipeline"
        description="Drag leads between stages. Stage changes are logged automatically."
        actions={
          <div className="flex flex-wrap gap-2">
            {data && data.pipelines.length > 1 && (
              <PipelinePicker value={pipelineId || data.pipeline?.id || ''} pipelines={data.pipelines} onChange={setPipelineId} />
            )}
            {isManager && <CreatePipelineButton />}
            <Link to="/app/leads">
              <Button variant="outline">Manage leads</Button>
            </Link>
          </div>
        }
      />

      {board.isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[420px] w-72 shrink-0" />)}
        </div>
      ) : !board.data || board.data.stages.length === 0 ? (
        <EmptyState
          icon={<KanbanSquare className="h-6 w-6" />}
          title={board.data?.pipelines.length ? 'No stages in this pipeline' : 'No pipeline yet'}
          description={board.data?.pipelines.length ? 'Add a stage to start tracking deals.' : 'Your default pipeline is created automatically when you sign up.'}
          action={isManager && !board.data?.pipelines.length ? <CreatePipelineButton /> : undefined}
        />
      ) : (
        <Board data={board.data} isManager={Boolean(isManager)} onMoved={() => undefined} />
      )}
    </div>
  );
}

function PipelinePicker({ value, pipelines, onChange }: { value: string; pipelines: Pipeline[]; onChange: (id: string) => void }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-48">
      {pipelines.map((p) => (
        <option key={p.id} value={p.id}>{p.name}{p.isDefault ? ' (default)' : ''}</option>
      ))}
    </Select>
  );
}

function CreatePipelineButton() {
  const create = useCreatePipeline();
  const { success, error } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await create.mutateAsync({ name: name.trim() });
      success('Pipeline created', `"${res.pipeline.name}" is ready — add stages to it.`);
      setOpen(false);
      setName('');
    } catch (err) {
      error('Could not create pipeline', friendlyError(err));
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New pipeline</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title="New pipeline" description="Start with an empty board, then add your stages.">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pipeline name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Web Development Sales" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" loading={create.isPending}>Create pipeline</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Board({ data, isManager }: { data: { stages: PipelineStage[]; pipeline: Pipeline | null; forecast: number }; isManager: boolean; onMoved: () => void }) {
  const moveLead = useMoveLead();
  const { success, error } = useToast();
  const [dragging, setDragging] = useState<Lead | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [reasonTarget, setReasonTarget] = useState<{ lead: Lead; stage: PipelineStage } | null>(null);
  const [stageDialog, setStageDialog] = useState<{ mode: 'create' | 'edit'; stage?: PipelineStage } | null>(null);

  const move = async (lead: Lead, stage: PipelineStage) => {
    setDragging(null);
    setOverStage(null);
    if (lead.stageId === stage.id) return;
    // Terminal stages ask for a reason — win/lost insight is gold.
    if (stage.isWon || stage.isLost) {
      setReasonTarget({ lead, stage });
      return;
    }
    try {
      await moveLead.mutateAsync({ id: lead.id, stageId: stage.id });
      success('Lead moved', `${lead.name} → ${stage.name}`);
    } catch (err) {
      error('Could not move lead', friendlyError(err));
    }
  };

  const confirmReason = async (reason: string) => {
    if (!reasonTarget) return;
    const { lead, stage } = reasonTarget;
    setReasonTarget(null);
    try {
      await moveLead.mutateAsync({
        id: lead.id,
        stageId: stage.id,
        ...(stage.isWon ? { wonReason: reason || undefined } : { lostReason: reason || undefined }),
      });
      success(stage.isWon ? 'Deal won 🎉' : 'Deal lost', reason ? `${lead.name} — ${reason}` : `${lead.name} moved to ${stage.name}`);
    } catch (err) {
      error('Could not move lead', friendlyError(err));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Target className="h-4 w-4" />
          <span>
            Weighted forecast <span className="font-bold text-foreground">{formatINR(data.forecast)}</span>
            <span className="hidden sm:inline"> · value × stage probability</span>
          </span>
        </div>
        {isManager && data.pipeline && (
          <Button size="sm" variant="outline" onClick={() => setStageDialog({ mode: 'create' })}>
            <Plus className="h-4 w-4" /> Add stage
          </Button>
        )}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: 'x proximity' }}>
        {data.stages.map((stage) => {
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
              <StageHeader stage={stage} isManager={isManager} onEdit={() => setStageDialog({ mode: 'edit', stage })} />
              <div className="flex-1 space-y-2.5 overflow-y-auto px-3 pb-3" style={{ maxHeight: '58vh' }}>
                {stage.leads.length === 0 && (
                  <div className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground">Drop a lead here</div>
                )}
                {stage.leads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} dragging={dragging?.id === lead.id} onDragStart={() => setDragging(lead)} onDragEnd={() => { setDragging(null); setOverStage(null); }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {reasonTarget && (
        <ReasonDialog
          stage={reasonTarget.stage}
          onClose={() => setReasonTarget(null)}
          onConfirm={confirmReason}
        />
      )}
      {stageDialog && (
        <StageDialog
          pipelineId={data.pipeline?.id}
          stage={stageDialog.stage}
          onClose={() => setStageDialog(null)}
        />
      )}
    </>
  );
}

function StageHeader({ stage, isManager, onEdit }: { stage: PipelineStage; isManager: boolean; onEdit: () => void }) {
  return (    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: stage.color }} />
        <span className="text-sm font-bold">{stage.name}</span>
        {stage.isWon && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
        {stage.isLost && <XCircle className="h-3.5 w-3.5 text-destructive" />}
        <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{stage.leads.length}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {stage.probability > 0 && (
          <span className="rounded bg-background px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{stage.probability}%</span>
        )}
        {isManager && (
          <button onClick={onEdit} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Edit ${stage.name}`}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function LeadCard({ lead, dragging, onDragStart, onDragEnd }: { lead: Lead; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'cursor-grab rounded-xl border bg-card p-3.5 shadow-sm transition-all hover:shadow-md active:cursor-grabbing',
        dragging && 'opacity-40'
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
        {lead.expectedCloseAt && (
          <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> Close {formatDate(lead.expectedCloseAt)}
          </div>
        )}
        {lead.wonReason && (
          <p className="mt-1.5 truncate rounded bg-success/10 px-1.5 py-0.5 text-[11px] text-success">Won: {lead.wonReason}</p>
        )}
        {lead.lostReason && (
          <p className="mt-1.5 truncate rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">Lost: {lead.lostReason}</p>
        )}
        <div className="mt-2 flex items-center justify-between border-t pt-2">
          <span className="text-[11px] text-muted-foreground">{lead.owner?.name || 'Unassigned'}</span>
          <span className="flex gap-1">
            {lead.phone && <Phone className="h-3 w-3 text-muted-foreground" />}
            {lead.phone && <MessageCircle className="h-3 w-3 text-muted-foreground" />}
          </span>
        </div>
      </Link>
    </div>
  );
}

function ReasonDialog({ stage, onClose, onConfirm }: { stage: PipelineStage; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  const won = stage.isWon;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        title={won ? 'Mark as won' : 'Mark as lost'}
        description={`${won ? 'Congratulations! 🎉' : 'Sorry to hear that.'} What ${won ? 'won' : 'lost'} this deal? (optional)`}
      >
        <div className="space-y-4">
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={won ? 'e.g. Best pricing, quick delivery, strong relationship' : 'e.g. Too expensive, went with a competitor, no budget'}
            className="min-h-[90px]"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Skip</Button>
            <Button onClick={() => onConfirm(reason.trim())}>{won ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />} {won ? 'Mark won' : 'Mark lost'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StageDialog({ pipelineId, stage, onClose }: { pipelineId?: string; stage?: PipelineStage; onClose: () => void }) {
  const create = useCreateStage();
  const update = useUpdateStage();
  const remove = useDeleteStage();
  const { success, error } = useToast();
  const [name, setName] = useState(stage?.name || '');
  const [color, setColor] = useState(stage?.color || STAGE_COLORS[0]);
  const [probability, setProbability] = useState(String(stage?.probability ?? 0));
  const [isWon, setIsWon] = useState(stage?.isWon || false);
  const [isLost, setIsLost] = useState(stage?.isLost || false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      if (stage) {
        await update.mutateAsync({ id: stage.id, name: name.trim(), color, probability: Number(probability) || 0, isWon, isLost });
        success('Stage updated');
      } else {
        await create.mutateAsync({ pipelineId, name: name.trim(), color, probability: Number(probability) || 0, isWon, isLost });
        success('Stage added');
      }
      onClose();
    } catch (err) {
      error('Could not save stage', friendlyError(err));
    }
  };

  const removeStage = async () => {
    if (!stage) return;
    if (!window.confirm(`Delete "${stage.name}"? Its leads stay on the board as unassigned.`)) return;
    try {
      await remove.mutateAsync(stage.id);
      success('Stage deleted');
      onClose();
    } catch (err) {
      error('Could not delete stage', friendlyError(err));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent title={stage ? 'Edit stage' : 'Add stage'} description="Stages marked won/lost flip leads' status automatically when moved.">
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Stage name</Label>
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Proposal Sent" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Win probability (%)</Label>
              <Input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">Used for the weighted forecast.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {STAGE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn('h-7 w-7 rounded-full border-2 transition-transform', color === c ? 'scale-110 border-foreground' : 'border-transparent')}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isWon} onChange={(e) => { setIsWon(e.target.checked); if (e.target.checked) setIsLost(false); }} className="h-4 w-4 accent-emerald-600" />
              Won stage
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isLost} onChange={(e) => { setIsLost(e.target.checked); if (e.target.checked) setIsWon(false); }} className="h-4 w-4 accent-red-600" />
              Lost stage
            </label>
          </div>
          <div className="flex justify-between gap-2">
            {stage ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={removeStage}><Trash2 className="h-4 w-4" /> Delete</Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={create.isPending || update.isPending}>Save stage</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
