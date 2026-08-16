import { useEffect, useRef, useState } from 'react';
import { Bot, Sparkles, Send, Plus, History, AlertCircle, User, FileText, Gauge, Crosshair, Settings2, Check } from 'lucide-react';
import { useAiChat, useAiConversations, useAiConversation, useAiStatus, useAiUsage, useLeadInsight, useLeads, useAiSettings, useUpdateAiSettings } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const SUGGESTIONS = [
  'How many leads did we get this week?',
  'Which leads are overdue for a follow-up?',
  'Show me leads worth more than ₹5 lakh.',
  'Which source gives us the most leads?',
  'Draft a follow-up message for my best lead.',
  'What is our conversion rate?',
];

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

export function AiAssistant() {
  const { user } = useAuth();
  const { data: status } = useAiStatus();
  const { data: convData } = useAiConversations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: active } = useAiConversation(activeId || '');
  const chat = useAiChat();
  const { success, error } = useToast();
  const [input, setInput] = useState('');
  const [local, setLocal] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const configured = status?.configured ?? true;
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');

  useEffect(() => {
    if (active?.conversation?.messages) {
      setLocal(active.conversation.messages.filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role as Msg['role'], content: m.content })));
    }
  }, [active?.conversation?.messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [local, busy]);

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || busy) return;
    setInput('');
    setLocal((p) => [...p, { role: 'user', content: message }]);
    setBusy(true);
    try {
      const res = await chat.mutateAsync({ message, conversationId: activeId || undefined });
      if (res.conversationId) setActiveId(res.conversationId);
      setLocal((p) => [...p, { role: 'assistant', content: res.reply || '⚠️ AI is not configured yet. Add an API key in Settings → AI to unlock the assistant.' }]);
    } catch (err) {
      setLocal((p) => [...p, { role: 'assistant', content: 'Sorry, I could not answer that. ' + friendlyError(err) }]);
    } finally {
      setBusy(false);
    }
  };

  const newChat = () => {
    setActiveId(null);
    setLocal([]);
    setInput('');
  };

  return (
    <div className="flex h-[calc(100vh-9rem)] gap-4">
      {/* Conversations sidebar */}
      <Card className="hidden w-60 shrink-0 flex-col p-3 md:flex">
        <Button variant="outline" size="sm" className="mb-2 justify-start" onClick={newChat}>
          <Plus className="h-4 w-4" /> New conversation
        </Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">History</p>
          {(convData?.conversations || []).map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                'w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                c.id === activeId ? 'bg-primary/10 text-primary' : 'hover:bg-accent'
              )}
            >
              <p className="flex items-center gap-1.5 truncate font-medium"><History className="h-3 w-3 shrink-0" /> {c.topic}</p>
              <p className="mt-0.5 line-clamp-1 text-muted-foreground">{c.preview}</p>
            </button>
          ))}
          {(convData?.conversations || []).length === 0 && <p className="px-2 text-xs text-muted-foreground">No conversations yet.</p>}
        </div>
      </Card>

      {/* Chat */}
      <Card className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">PRIMELEAD Assistant</p>
            <p className="text-xs text-muted-foreground">Answers from your own CRM data</p>
          </div>
          {configured ? (
            <Badge tone="success"><Sparkles className="h-3 w-3" /> AI ready</Badge>
          ) : (
            <Badge tone="warning">AI not configured</Badge>
          )}
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {local.length === 0 && (
            <div className="mx-auto max-w-md pt-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-6 w-6" /></span>
              <h2 className="mt-3 text-lg font-semibold">Ask anything about your business</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {configured
                  ? 'Try one of these — the assistant reads live data from your CRM (leads, follow-ups, sources, revenue).'
                  : 'Add an API key in Settings → AI to unlock the assistant. Until then, questions are stored but not answered.'}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {local.map((m, i) => (
            <div key={i} className={cn('flex gap-2.5', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              {m.role === 'assistant' && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="h-3.5 w-3.5" /></span>
              )}
              <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'border bg-background')}>
                {m.content}
              </div>
              {m.role === 'user' && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><User className="h-3.5 w-3.5" /></span>
              )}
            </div>
          ))}

          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bot className="h-3.5 w-3.5" /></span>
              <span className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
                ))}
              </span>
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3">
          {!configured && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-amber-600">
              <AlertCircle className="h-3.5 w-3.5" /> AI is not configured. Ask your admin to add an API key in Settings → AI.
            </p>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Ask about your leads${user ? ', follow-ups or revenue' : ''}…`}
              className="min-h-[52px] max-h-32"
            />
            <Button size="icon" onClick={() => send()} disabled={!input.trim() || busy} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Lead intelligence panel */}
      <LeadIntelligencePanel isManager={isManager} />
    </div>
  );
}

function LeadIntelligencePanel({ isManager }: { isManager: boolean }) {
  const { data: leads } = useLeads({ pageSize: 100, sort: 'createdAt', dir: 'desc' });
  const [leadId, setLeadId] = useState('');
  const [result, setResult] = useState<{ kind: string; text: string; meta?: string } | null>(null);
  const [error, setError] = useState('');
  const summary = useLeadInsight('summary');
  const score = useLeadInsight('score');
  const nextAction = useLeadInsight('next-action');
  const usage = useAiUsage();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const busy = summary.isPending || score.isPending || nextAction.isPending;

  const run = async (kind: 'summary' | 'score' | 'next-action', fn: typeof summary.mutateAsync) => {
    if (!leadId) return;
    setError('');
    setResult(null);
    try {
      const res = await fn(leadId);
      if (!res.enabled) {
        setResult({ kind, text: 'AI is switched OFF for this workspace. Enable it in AI settings.', meta: 'mode: OFF' });
        return;
      }
      if (kind === 'summary') {
        setResult({ kind, text: res.summary || 'No summary available.', meta: `source: ${res.source}` });
      } else if (kind === 'score') {
        setResult({ kind, text: `Score: ${res.score ?? '—'}/100\n\n${res.reasoning || ''}`, meta: `source: ${res.source}${res.baseScore ? ` · base: ${res.baseScore}` : ''}` });
      } else {
        setResult({ kind, text: res.action || 'No action suggested.', meta: `source: ${res.source}${res.createdTaskId ? ' · follow-up task created' : ''}` });
      }
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const budget = usage.data?.budget;
  const spent = budget?.spentRupees || 0;
  const limit = budget?.monthlyLimitRupees || 0;
  const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;

  return (
    <Card className="hidden w-80 shrink-0 flex-col p-4 lg:flex">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">Lead intelligence</p>
          <p className="text-xs text-muted-foreground">Summary, scoring & next action</p>
        </div>
        {isManager && (
          <button onClick={() => setSettingsOpen(true)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent" aria-label="AI settings">
            <Settings2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3">
        <Select value={leadId} onChange={(e) => setLeadId(e.target.value)} aria-label="Pick a lead">
          <option value="">Pick a lead…</option>
          {(leads?.rows || []).map((l) => (
            <option key={l.id} value={l.id}>{l.name}{l.phone ? ` · ${l.phone}` : ''}</option>
          ))}
        </Select>

        <div className="grid grid-cols-3 gap-2">
          <Button size="sm" variant="outline" onClick={() => run('summary', summary.mutateAsync)} disabled={!leadId || busy}>
            <FileText className="h-3.5 w-3.5" /> Summary
          </Button>
          <Button size="sm" variant="outline" onClick={() => run('score', score.mutateAsync)} disabled={!leadId || busy}>
            <Gauge className="h-3.5 w-3.5" /> Score
          </Button>
          <Button size="sm" variant="outline" onClick={() => run('next-action', nextAction.mutateAsync)} disabled={!leadId || busy}>
            <Crosshair className="h-3.5 w-3.5" /> Action
          </Button>
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {result && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{result.meta}</p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed">{result.text}</p>
          </div>
        )}

        <div className="mt-2 rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">This month's AI usage</p>
            <p className="text-[11px] text-muted-foreground">
              {usage.data?.stats.calls ?? 0} call{(usage.data?.stats.calls ?? 0) === 1 ? '' : 's'} · {(usage.data?.stats.totalTokens ?? 0).toLocaleString('en-IN')} tokens
            </p>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', pct >= 90 ? 'bg-destructive' : pct >= 60 ? 'bg-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            ₹{spent.toLocaleString('en-IN')} of ₹{limit.toLocaleString('en-IN')} budget {limit > 0 ? `(${pct}%)` : ''}
          </p>
        </div>
      </div>

      {settingsOpen && <AiSettingsDialog onClose={() => setSettingsOpen(false)} />}
    </Card>
  );
}

function AiSettingsDialog({ onClose }: { onClose: () => void }) {
  const { data } = useAiSettings();
  const update = useUpdateAiSettings();
  const [mode, setMode] = useState('');
  const [budget, setBudget] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const effectiveMode = mode || data?.mode || 'SUGGEST';
  const effectiveBudget = budget || String(data?.budget?.monthlyLimitRupees ?? 500);

  const save = async () => {
    setError('');
    try {
      await update.mutateAsync({ mode: effectiveMode, monthlyLimitRupees: Number(effectiveBudget) });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-2xl">
        <p className="text-lg font-semibold">AI settings</p>
        <p className="mt-1 text-sm text-muted-foreground">Control how AI behaves and what it may spend.</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">AI mode</label>
            <Select value={effectiveMode} onChange={(e) => setMode(e.target.value)}>
              <option value="OFF">OFF — AI suggestions disabled</option>
              <option value="SUGGEST">SUGGEST — human approves every action</option>
              <option value="AUTOMATIC">AUTOMATIC — next-action may create follow-up tasks</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Monthly budget (₹)</label>
            <Input type="number" min={0} value={effectiveBudget} onChange={(e) => setBudget(e.target.value)} />
            <p className="mt-1 text-[11px] text-muted-foreground">0 disables the cap. Requests over budget are refused before they reach the provider.</p>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {saved && <p className="flex items-center gap-1 text-xs text-success"><Check className="h-3.5 w-3.5" /> Saved.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save} loading={update.isPending}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
