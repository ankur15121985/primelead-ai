import { useState } from 'react';
import { Plug, Zap, Copy, Check, Power, Trash2, Webhook, KeyRound, ExternalLink, ShieldCheck } from 'lucide-react';
import { useIntegrations, useConnectIntegration, useUpdateIntegration, useDisconnectIntegration } from '@/hooks/queries';
import { useToast } from '@/hooks/use-toast';
import { friendlyError, useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { IntegrationCatalogItem } from '@/types';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageCircle: Plug, Facebook: Plug, Instagram: Plug, Search: Plug, Store: Plug,
  PhoneCall: Plug, Briefcase: Plug, ShoppingBag: Plug, Zap, Code2: Webhook,
};

export function Integrations() {
  const { data, isLoading } = useIntegrations();
  const connect = useConnectIntegration();
  const updateI = useUpdateIntegration();
  const disconnect = useDisconnectIntegration();
  const { success, error } = useToast();
  const { user } = useAuth();
  const isManager = ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role || '');
  const [secretFor, setSecretFor] = useState<{ source: string; webhookUrl: string; webhookSecret: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const catalog = data?.catalog || [];
  const connections = data?.connections || [];
  const connBySource = new Map(connections.map((c) => [c.source, c]));

  const handleConnect = async (item: IntegrationCatalogItem) => {
    try {
      const res = await connect.mutateAsync(item.source);
      setSecretFor({ source: item.source, webhookUrl: res.integration.webhookUrl, webhookSecret: res.integration.webhookSecret, name: res.integration.name });
    } catch (err) {
      error('Could not connect', friendlyError(err));
    }
  };

  const toggle = async (source: string, enabled: boolean) => {
    try {
      await updateI.mutateAsync({ source, enabled: !enabled });
      success(enabled ? 'Paused' : 'Live again', enabled ? 'Incoming leads are paused.' : 'Incoming leads will flow again.');
    } catch (err) {
      error('Could not update', friendlyError(err));
    }
  };

  const handleDisconnect = async (source: string, name: string) => {
    if (!window.confirm(`Disconnect ${name}? The webhook will stop working.`)) return;
    try {
      await disconnect.mutateAsync(source);
      success('Disconnected', `${name} is disconnected.`);
    } catch (err) {
      error('Could not disconnect', friendlyError(err));
    }
  };

  const copySecret = async () => {
    if (!secretFor) return;
    try {
      await navigator.clipboard.writeText(secretFor.webhookSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      error('Could not copy', 'Please copy the secret manually.');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations"
        description="Connect your lead sources. Every connection uses a unique secret so only your business can push leads in."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((item) => {
            const Icon = ICONS[item.icon] || Plug;
            const conn = connBySource.get(item.source);
            return (
              <Card key={item.source} className="flex flex-col p-5">
                <div className="flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  {conn ? (
                    <Badge tone="success">Connected</Badge>
                  ) : (
                    <Badge tone="muted">Not connected</Badge>
                  )}
                </div>
                <h3 className="mt-3 font-semibold">{item.name}</h3>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">{item.description}</p>
                <div className="mt-4 flex items-center gap-2">
                  {!conn ? (
                    isManager ? (
                      <Button size="sm" onClick={() => handleConnect(item)} loading={connect.isPending && connect.variables === item.source}>
                        <Plug className="h-3.5 w-3.5" /> Connect
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manager access required</span>
                    )
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => toggle(item.source, conn.enabled)}>
                        <Power className="h-3.5 w-3.5" /> {conn.enabled ? 'Pause' : 'Resume'}
                      </Button>
                      {conn.webhookUrl && (
                        <Button size="sm" variant="ghost" onClick={() => setSecretFor({ source: item.source, webhookUrl: conn.webhookUrl!, webhookSecret: '', name: item.name })}>
                          <KeyRound className="h-3.5 w-3.5" /> Details
                        </Button>
                      )}
                      {isManager && (
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDisconnect(item.source, item.name)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {secretFor && (
        <SecretDialog
          name={secretFor.name}
          webhookUrl={secretFor.webhookUrl}
          webhookSecret={secretFor.webhookSecret}
          copied={copied}
          onCopy={copySecret}
          onClose={() => { setSecretFor(null); setCopied(false); }}
        />
      )}
    </div>
  );
}

function SecretDialog({
  name, webhookUrl, webhookSecret, copied, onCopy, onClose,
}: {
  name: string;
  webhookUrl: string;
  webhookSecret: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const hasSecret = Boolean(webhookSecret);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        title={`${name} — webhook details`}
        description="Use this URL and secret to send leads to PRIMELEAD from this source. The secret is shown once on creation."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Webhook URL</p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-2.5">
              <Webhook className="h-4 w-4 shrink-0 text-muted-foreground" />
              <code className="min-w-0 flex-1 truncate text-xs">{webhookUrl}</code>
              <button onClick={() => navigator.clipboard.writeText(webhookUrl).catch(() => undefined)} className="rounded p-1 hover:bg-accent" aria-label="Copy URL">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Webhook secret</p>
            {hasSecret ? (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5">
                <KeyRound className="h-4 w-4 shrink-0 text-amber-600" />
                <code className="min-w-0 flex-1 break-all text-xs font-semibold">{webhookSecret}</code>
                <button onClick={onCopy} className="rounded p-1 hover:bg-accent" aria-label="Copy secret">
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            ) : (
              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                The secret was shown when you connected this integration. Reconnect to generate a new one.
              </div>
            )}
            <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Send it as the <code className="rounded bg-muted px-1">x-webhook-secret</code> header.
            </p>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-semibold">Example</p>
            <code className="block whitespace-pre-wrap">{`curl -X POST ${webhookUrl} \\
  -H "x-webhook-secret: ${hasSecret ? webhookSecret : '…'}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Rahul","phone":"98111 11111","email":"rahul@example.com"}'`}</code>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => window.open(webhookUrl, '_blank')}>
              <ExternalLink className="h-4 w-4" /> Open
            </Button>
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
