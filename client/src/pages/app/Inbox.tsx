import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Check, CheckCheck, Inbox as InboxIcon, MessageSquare, Phone, Send,
  Settings2, Sparkles, UserRound, X,
} from 'lucide-react';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import {
  useConversation, useConversations, useDemoInbound, useMarkConversationRead, useSendMessage,
  useUpdateConversation, useUpdateWaSettings, useWaSettings, useWaTemplates, useTeam,
} from '@/hooks/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { timeAgo, formatDateTime } from '@/lib/format';
import type { Conversation, WaMessage, WaTemplate } from '@/types';

const STATUS_TABS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'ALL', label: 'All' },
];

/** Fill {{n}} placeholders with the given params. */
export function renderTemplateBody(body: string, params: string[]): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => params[Number(n) - 1] ?? `{{${n}}}`);
}

export function Inbox() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('c') || '';
  const can = (p: string) => user?.permissions?.includes(p) ?? false;

  const [status, setStatus] = useState('OPEN');
  const [mine, setMine] = useState(false);
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [simulateOpen, setSimulateOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const conversations = useConversations({ status, q, mine });
  const detail = useConversation(selectedId);
  const markRead = useMarkConversationRead();
  const sendMsg = useSendMessage();
  const updateConv = useUpdateConversation();
  const demoInbound = useDemoInbound();
  const team = useTeam();
  const templates = useWaTemplates();

  const active = useMemo(
    () => conversations.data?.conversations.find((c) => c.id === selectedId) || null,
    [conversations.data, selectedId]
  );

  // Mark the thread read when it's opened.
  useEffect(() => {
    if (active && active.unreadCount > 0 && can('inbox.view')) {
      markRead.mutate(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, active?.unreadCount]);

  const openConversation = (id: string) => {
    const next = new URLSearchParams(params);
    next.set('c', id);
    setParams(next, { replace: true });
  };

  const search = () => setQ(searchInput.trim());
  const unreadTotal = conversations.data?.unreadTotal || 0;

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            WhatsApp conversations with your team
            {unreadTotal > 0 && <span className="ml-2 font-semibold text-primary">{unreadTotal} unread</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can('inbox.send') && (
            <Button variant="outline" size="sm" onClick={() => setSimulateOpen(true)}>
              <MessageSquare className="h-4 w-4" /> Simulate inbound
            </Button>
          )}
          {can('inbox.manage') && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="h-4 w-4" /> WhatsApp settings
            </Button>
          )}
        </div>
      </div>

      {conversations.isLoading ? (
        <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Loading conversations…</div>
      ) : (
        <div className="grid h-[calc(100vh-13rem)] min-h-[420px] gap-4 lg:grid-cols-[320px_1fr]">
          {/* ── Conversation list ── */}
          <div className="flex flex-col overflow-hidden rounded-xl border bg-background">
            <div className="border-b p-3">
              <div className="flex gap-1.5">
                {STATUS_TABS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setStatus(t.value)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                      status === t.value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                  placeholder="Search name or number…"
                  className="h-8"
                />
                <Button variant="outline" size="sm" className="h-8" onClick={search}>Go</Button>
              </div>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-3.5 w-3.5 accent-primary" />
                Assigned to me only
              </label>
            </div>

            <div className="flex-1 divide-y overflow-y-auto">
              {conversations.data?.conversations.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <InboxIcon className="mx-auto mb-2 h-8 w-8 opacity-40" />
                  No conversations{status !== 'ALL' ? ' in this view' : ''}. Simulate an inbound message to get started.
                </div>
              )}
              {conversations.data?.conversations.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={c.id === selectedId}
                  onOpen={() => openConversation(c.id)}
                />
              ))}
            </div>
          </div>

          {/* ── Thread ── */}
          <div className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-background">
            {!active || !detail.data ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState
                  icon={<MessageSquare className="h-6 w-6" />}
                  title="Pick a conversation"
                  description="Select a thread on the left to read and reply. New customer messages appear here automatically."
                />
              </div>
            ) : (
              <ThreadPane
                conversation={active}
                messages={detail.data.messages}
                templates={templates.data?.templates || []}
                team={team.data?.users || []}
                canAssign={can('inbox.assign')}
                canSend={can('inbox.send')}
                onSend={(input) => sendMsg.mutateAsync({ conversationId: active.id, ...input })}
                onAssign={(assigneeId) => updateConv.mutate({ id: active.id, assigneeId })}
                onClose={() => updateConv.mutate({ id: active.id, status: active.status === 'OPEN' ? 'CLOSED' : 'OPEN' })}
              />
            )}
          </div>
        </div>
      )}

      {simulateOpen && (
        <SimulateDialog
          open={simulateOpen}
          onClose={() => setSimulateOpen(false)}
          onSimulate={async (input) => {
            await demoInbound.mutateAsync(input);
            setSimulateOpen(false);
          }}
        />
      )}

      {settingsOpen && (
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

function ConversationRow({ conversation, active, onOpen }: { conversation: Conversation; active: boolean; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className={cn(
        'flex w-full items-start gap-3 px-3 py-3 text-left transition-colors',
        active ? 'bg-primary/5' : 'hover:bg-accent/60'
      )}
    >
      <Avatar name={conversation.customerName} className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-semibold">
            {conversation.customerName}
            {conversation.lead && <span className="ml-1 font-normal text-muted-foreground">· {conversation.lead.name}</span>}
          </p>
          <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(conversation.lastMessageAt)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className={cn('truncate text-xs', conversation.unreadCount > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>
            {conversation.lastMessagePreview || 'No messages yet'}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {conversation.unreadCount}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2">
          {conversation.status === 'CLOSED' && <Badge tone="muted" className="text-[10px]">Closed</Badge>}
          {conversation.assignee ? (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <UserRound className="h-3 w-3" /> {conversation.assignee.name.split(' ')[0]}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">Unassigned</span>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({ message }: { message: WaMessage }) {
  const inbound = message.direction === 'INBOUND';
  const tick = message.status === 'READ' ? <CheckCheck className="h-3.5 w-3.5" /> : message.status === 'DELIVERED' ? <CheckCheck className="h-3.5 w-3.5 opacity-60" /> : <Check className="h-3.5 w-3.5 opacity-60" />;
  return (
    <div className={cn('flex', inbound ? 'justify-start' : 'justify-end')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[65%]',
          inbound ? 'rounded-tl-sm bg-muted' : 'rounded-tr-sm bg-primary text-primary-foreground'
        )}
      >
        {message.type === 'TEMPLATE' && (
          <p className={cn('mb-1 text-[10px] font-semibold uppercase tracking-wide', inbound ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
            Template · {message.waTemplateName}
          </p>
        )}
        {message.mediaUrl && (
          <p className={cn('mb-1 flex items-center gap-1.5 text-xs', inbound ? 'text-muted-foreground' : 'text-primary-foreground/80')}>
            <Phone className="h-3.5 w-3.5" /> {message.mediaType || 'Media'}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={cn('mt-1 flex items-center justify-end gap-1 text-[10px]', inbound ? 'text-muted-foreground' : 'text-primary-foreground/70')}>
          {formatDateTime(message.createdAt)}
          {!inbound && tick}
        </p>
      </div>
    </div>
  );
}

function ThreadPane({
  conversation, messages, templates, team, canAssign, canSend, onSend, onAssign, onClose,
}: {
  conversation: Conversation;
  messages: WaMessage[];
  templates: WaTemplate[];
  team: Array<{ id: string; name: string }>;
  canAssign: boolean;
  canSend: boolean;
  onSend: (input: { body?: string; templateName?: string; templateParams?: string[] }) => Promise<unknown>;
  onAssign: (assigneeId: string | null) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [params, setParams] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedTemplate = templates.find((t) => t.id === templateId) || null;
  const placeholderCount = useMemo(() => {
    if (!selectedTemplate) return 0;
    const max = Math.max(0, ...[...(selectedTemplate.body.matchAll(/\{\{(\d+)\}\}/g))].map((m) => Number(m[1])));
    return max;
  }, [selectedTemplate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, conversation.id]);

  const send = async () => {
    if (sending) return;
    if (!text.trim() && !selectedTemplate) return;
    setError('');
    setSending(true);
    try {
      await onSend(
        selectedTemplate
          ? { templateName: selectedTemplate.name, templateParams: params }
          : { body: text.trim() }
      );
      setText('');
      setTemplateId('');
      setParams([]);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Avatar name={conversation.customerName} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{conversation.customerName}</p>
            {conversation.status === 'CLOSED' && <Badge tone="muted" className="text-[10px]">Closed</Badge>}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.waId}
            {conversation.lead && (
              <Link to={`/app/leads/${conversation.lead.id}`} className="ml-2 font-medium text-primary hover:underline">
                → {conversation.lead.name}
              </Link>
            )}
          </p>
        </div>
        {canAssign && (
          <div className="flex items-center gap-2">
            <Select
              value={conversation.assigneeId || ''}
              onChange={(e) => onAssign(e.target.value || null)}
              className="h-8 w-36 text-xs"
              aria-label="Assign conversation"
            >
              <option value="">Unassigned</option>
              {team.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </Select>
            <Button variant="outline" size="sm" onClick={onClose}>
              {conversation.status === 'OPEN' ? 'Close' : 'Reopen'}
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/50 p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No messages yet in this conversation.</p>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t p-3">
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        {selectedTemplate ? (
          <div className="mb-2 rounded-lg border bg-muted/40 p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Template: {selectedTemplate.name}
              </p>
              <button onClick={() => { setTemplateId(''); setParams([]); }} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Clear template">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{selectedTemplate.body}</p>
            {placeholderCount > 0 && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {Array.from({ length: placeholderCount }, (_, i) => (
                  <Input
                    key={i}
                    value={params[i] || ''}
                    onChange={(e) => {
                      const next = [...params];
                      next[i] = e.target.value;
                      setParams(next);
                    }}
                    placeholder={`Value for {{${i + 1}}}`}
                    className="h-8 text-xs"
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          templates.length > 0 && canSend && (
            <div className="mb-2 flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">Template:</span>
              <Select value="" onChange={(e) => setTemplateId(e.target.value)} className="h-7 w-40 text-xs" aria-label="Pick a template">
                <option value="">Pick one…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          )
        )}
        {canSend ? (
          <div className="flex items-end gap-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={selectedTemplate ? 'Send this template…' : 'Type a message (Enter to send, Shift+Enter for a new line)…'}
              className="min-h-10 flex-1 resize-none"
              rows={1}
            />
            <Button onClick={send} loading={sending} disabled={!text.trim() && !selectedTemplate} aria-label="Send message">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">You don't have permission to send messages.</p>
        )}
      </div>
    </>
  );
}

// ── Demo inbound simulator ────────────────────────────────────────
function SimulateDialog({ open, onClose, onSimulate }: {
  open: boolean;
  onClose: () => void;
  onSimulate: (input: { from: string; body: string }) => Promise<unknown>;
}) {
  const [from, setFrom] = useState('919876543210');
  const [body, setBody] = useState('Hi, I saw your services online. Can you share pricing?');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!from.trim() || !body.trim()) return;
    setError('');
    setBusy(true);
    try {
      await onSimulate({ from: from.trim(), body: body.trim() });
      onClose();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Simulate an inbound WhatsApp message" description="Demo mode only — this drives the same pipeline a real Meta webhook would.">
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Customer WhatsApp number</label>
            <Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="e.g. 919876543210" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Message</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} loading={busy} disabled={!from.trim() || !body.trim()}>
              <MessageSquare className="h-4 w-4" /> Simulate
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── WhatsApp settings ─────────────────────────────────────────────
function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useWaSettings();
  const update = useUpdateWaSettings();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [provider, setProvider] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Sync from server once loaded.
  const loaded = data?.settings;
  const effectiveEnabled = enabled ?? loaded?.enabled ?? false;
  const effectiveProvider = provider || loaded?.provider || 'demo';

  const save = async () => {
    setError('');
    setSaved(false);
    try {
      await update.mutateAsync({
        enabled: effectiveEnabled,
        provider: effectiveProvider,
        phoneNumberId: phoneNumberId || null,
        verifyToken: verifyToken || null,
        ...(token ? { token } : {}),
      });
      setPhoneNumberId('');
      setVerifyToken('');
      setToken('');
      setSaved(true);
    } catch (err) {
      setError(friendlyError(err));
    }
  };

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhooks/whatsapp` : '/api/webhooks/whatsapp';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="WhatsApp settings" description="Connect the official WhatsApp Business Platform, or stay in demo mode. Keys never leave the server." className="max-w-xl">
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Inbox enabled</p>
              <p className="text-xs text-muted-foreground">Accept inbound WhatsApp messages</p>
            </div>
            <input
              type="checkbox"
              checked={effectiveEnabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Provider</label>
            <Select value={effectiveProvider} onChange={(e) => setProvider(e.target.value)}>
              <option value="demo">Demo (no external credentials — simulate messages)</option>
              <option value="meta">Meta WhatsApp Business Platform</option>
            </Select>
            {effectiveProvider === 'demo' && (
              <p className="mt-2 text-xs text-muted-foreground">
                In demo mode you can simulate inbound messages and send replies locally. No messages reach real phones.
              </p>
            )}
          </div>

          {effectiveProvider === 'meta' && (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Phone number ID</label>
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="e.g. 105612345678901" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Verify token (for webhook handshake)</label>
                <Input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value)} placeholder="Your chosen verify token" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Permanent access token {loaded?.hasToken && <span className="text-success">· saved</span>}
                </label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste to replace the saved token" type="password" />
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-semibold">Webhook URL (configure in Meta App Dashboard)</p>
                <p className="mt-1 select-all break-all text-xs text-muted-foreground">{webhookUrl}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Point Meta to this URL with your verify token. Outbound sends are marked IMPLEMENTATION REQUIRED until exercised with a real business number.
                </p>
              </div>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          {saved && <p className="text-xs text-success">Settings saved.</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save} loading={update.isPending}><Check className="h-4 w-4" /> Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
