import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutDashboard, Users, Building2, Phone, Mail, Calendar, BarChart3, Settings, Bot, Zap, FileText, Target, Inbox, ListTodo, MessageSquare, Workflow, ShieldCheck, Key, Webhook, Upload, Map, TrendingUp, GraduationCap, Database, GitMerge, PieChart, UserCheck, Route, Globe, QrCode, CreditCard, ShieldAlert, CalendarDays, ListChecks, Mic } from 'lucide-react';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: string;
  shortcut?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const items: CommandItem[] = [
    // Navigation
    { id: 'nav-dashboard', label: 'Dashboard', description: 'Go to dashboard', icon: <LayoutDashboard className="h-4 w-4" />, action: () => navigate('/app/dashboard'), category: 'Navigation' },
    { id: 'nav-leads', label: 'Leads', description: 'Manage leads', icon: <Target className="h-4 w-4" />, action: () => navigate('/app/leads'), category: 'Navigation' },
    { id: 'nav-pipeline', label: 'Pipeline', description: 'Sales pipeline', icon: <TrendingUp className="h-4 w-4" />, action: () => navigate('/app/pipeline'), category: 'Navigation' },
    { id: 'nav-contacts', label: 'Contacts', description: 'Manage contacts', icon: <Users className="h-4 w-4" />, action: () => navigate('/app/contacts'), category: 'Navigation' },
    { id: 'nav-companies', label: 'Companies', description: 'Company database', icon: <Building2 className="h-4 w-4" />, action: () => navigate('/app/companies'), category: 'Navigation' },
    { id: 'nav-inbox', label: 'Inbox', description: 'Unified inbox', icon: <Inbox className="h-4 w-4" />, action: () => navigate('/app/inbox'), category: 'Navigation' },
    { id: 'nav-tasks', label: 'Tasks', description: 'Follow-ups & tasks', icon: <ListTodo className="h-4 w-4" />, action: () => navigate('/app/tasks'), category: 'Navigation' },
    { id: 'nav-calls', label: 'Calls', description: 'Call log & dialer', icon: <Phone className="h-4 w-4" />, action: () => navigate('/app/calls'), category: 'Navigation' },
    { id: 'nav-meetings', label: 'Meetings', description: 'Schedule & manage', icon: <Calendar className="h-4 w-4" />, action: () => navigate('/app/meetings'), category: 'Navigation' },
    { id: 'nav-calendar', label: 'Calendar', description: 'Follow-up calendar', icon: <CalendarDays className="h-4 w-4" />, action: () => navigate('/app/calendar'), category: 'Navigation' },
    { id: 'nav-sequences', label: 'Sequences', description: 'Email sequences', icon: <Mail className="h-4 w-4" />, action: () => navigate('/app/sequences'), category: 'Navigation' },
    { id: 'nav-quotations', label: 'Quotations', description: 'Create quotations', icon: <FileText className="h-4 w-4" />, action: () => navigate('/app/quotations'), category: 'Navigation' },
    { id: 'nav-invoices', label: 'Invoices', description: 'GST invoices', icon: <FileText className="h-4 w-4" />, action: () => navigate('/app/invoices'), category: 'Navigation' },
    // Intelligence
    { id: 'nav-ai', label: 'AI Assistant', description: 'Ask AI anything', icon: <Bot className="h-4 w-4" />, action: () => navigate('/app/ai'), category: 'Intelligence' },
    { id: 'nav-ai-research', label: 'AI Research', description: 'Research companies & contacts', icon: <Bot className="h-4 w-4" />, action: () => navigate('/app/ai-research'), category: 'Intelligence' },
    { id: 'nav-intelligence', label: 'Conversation Intelligence', description: 'Analyze calls & meetings', icon: <MessageSquare className="h-4 w-4" />, action: () => navigate('/app/intelligence'), category: 'Intelligence' },
    { id: 'nav-icps', label: 'ICPs', description: 'Ideal Customer Profiles', icon: <Target className="h-4 w-4" />, action: () => navigate('/app/icps'), category: 'Intelligence' },
    { id: 'nav-personas', label: 'Personas', description: 'Buyer personas', icon: <UserCheck className="h-4 w-4" />, action: () => navigate('/app/personas'), category: 'Intelligence' },
    { id: 'nav-scoring', label: 'Lead Scoring', description: 'Scoring rules', icon: <PieChart className="h-4 w-4" />, action: () => navigate('/app/scoring'), category: 'Intelligence' },
    { id: 'nav-signals', label: 'Signals', description: 'Buying intent signals', icon: <Zap className="h-4 w-4" />, action: () => navigate('/app/signals'), category: 'Intelligence' },
    // Analytics
    { id: 'nav-analytics', label: 'Analytics', description: 'Sales analytics', icon: <BarChart3 className="h-4 w-4" />, action: () => navigate('/app/analytics-v2'), category: 'Analytics' },
    { id: 'nav-reports', label: 'Reports', description: 'Sales reports', icon: <FileText className="h-4 w-4" />, action: () => navigate('/app/reports'), category: 'Analytics' },
    { id: 'nav-report-builder', label: 'Report Builder', description: 'Custom reports', icon: <PieChart className="h-4 w-4" />, action: () => navigate('/app/report-builder'), category: 'Analytics' },
    { id: 'nav-coaching', label: 'Sales Coaching', description: 'Rep performance', icon: <GraduationCap className="h-4 w-4" />, action: () => navigate('/app/coaching'), category: 'Analytics' },
    { id: 'nav-forecast', label: 'Forecasting', description: 'Revenue forecast', icon: <TrendingUp className="h-4 w-4" />, action: () => navigate('/app/forecast'), category: 'Analytics' },
    // Tools
    { id: 'nav-qr-codes', label: 'QR Codes', description: 'QR lead capture', icon: <QrCode className="h-4 w-4" />, action: () => navigate('/app/qr-codes'), category: 'Tools' },
    { id: 'nav-automations', label: 'Automations', description: 'Automation rules', icon: <Workflow className="h-4 w-4" />, action: () => navigate('/app/automations'), category: 'Tools' },
    { id: 'nav-workflows', label: 'Workflows', description: 'Visual workflow builder', icon: <Workflow className="h-4 w-4" />, action: () => navigate('/app/workflows'), category: 'Tools' },
    { id: 'nav-forms', label: 'Forms', description: 'Lead capture forms', icon: <FileText className="h-4 w-4" />, action: () => navigate('/app/forms'), category: 'Tools' },
    { id: 'nav-inbound', label: 'Inbound Routing', description: 'Lead routing rules', icon: <Route className="h-4 w-4" />, action: () => navigate('/app/inbound'), category: 'Tools' },
    { id: 'nav-import', label: 'Import Data', description: 'CSV/Excel import', icon: <Upload className="h-4 w-4" />, action: () => navigate('/app/import'), category: 'Tools' },
    { id: 'nav-deliverability', label: 'Deliverability', description: 'Email deliverability metrics', icon: <Globe className="h-4 w-4" />, action: () => navigate('/app/deliverability'), category: 'Tools' },
    { id: 'nav-data-providers', label: 'Data Providers', description: 'Data enrichment sources', icon: <Database className="h-4 w-4" />, action: () => navigate('/app/data-providers'), category: 'Tools' },
    { id: 'nav-territories', label: 'Territories', description: 'Territory management', icon: <Map className="h-4 w-4" />, action: () => navigate('/app/territories'), category: 'Tools' },
    { id: 'nav-sms-leads', label: 'SMS Leads', description: 'Inbound SMS lead generation', icon: <MessageSquare className="h-4 w-4" />, action: () => navigate('/app/sms-leads'), category: 'Tools' },
    { id: 'nav-recordings', label: 'Recordings', description: 'Call & video recordings', icon: <Mic className="h-4 w-4" />, action: () => navigate('/app/recordings'), category: 'Tools' },
    { id: 'nav-video-call', label: 'Video Call', description: 'WebRTC video rooms', icon: <Mic className="h-4 w-4" />, action: () => navigate('/app/video-call'), category: 'Tools' },
    { id: 'nav-bulk-calls', label: 'Bulk Calls', description: 'Initiate calls to multiple contacts', icon: <Phone className="h-4 w-4" />, action: () => navigate('/app/bulk-calls'), category: 'Tools' },
    // Settings
    { id: 'nav-settings', label: 'Settings', description: 'Workspace settings', icon: <Settings className="h-4 w-4" />, action: () => navigate('/app/settings'), category: 'Settings' },
    { id: 'nav-security', label: 'Security Center', description: 'Audit logs & sessions', icon: <ShieldCheck className="h-4 w-4" />, action: () => navigate('/app/security'), category: 'Settings' },
    { id: 'nav-api-keys', label: 'API Keys', description: 'Manage API keys', icon: <Key className="h-4 w-4" />, action: () => navigate('/app/api-keys'), category: 'Settings' },
    { id: 'nav-webhooks', label: 'Webhooks', description: 'Webhook platform', icon: <Webhook className="h-4 w-4" />, action: () => navigate('/app/webhooks-platform'), category: 'Settings' },
    { id: 'nav-compliance', label: 'Compliance', description: 'GDPR & data protection', icon: <ShieldAlert className="h-4 w-4" />, action: () => navigate('/app/compliance'), category: 'Settings' },
    { id: 'nav-integrations', label: 'Integrations', description: 'Connect tools', icon: <Zap className="h-4 w-4" />, action: () => navigate('/app/integrations'), category: 'Settings' },
    { id: 'nav-team', label: 'Team', description: 'Manage team members', icon: <Users className="h-4 w-4" />, action: () => navigate('/app/team'), category: 'Settings' },
    { id: 'nav-billing', label: 'Billing', description: 'Plans & payments', icon: <CreditCard className="h-4 w-4" />, action: () => navigate('/app/billing'), category: 'Settings' },
    { id: 'nav-data-quality', label: 'Data Quality', description: 'Clean your data', icon: <Database className="h-4 w-4" />, action: () => navigate('/app/data-quality'), category: 'Settings' },
    { id: 'nav-duplicates', label: 'Duplicates', description: 'Merge duplicates', icon: <GitMerge className="h-4 w-4" />, action: () => navigate('/app/duplicates'), category: 'Settings' },
  ];

  // Keyboard shortcut to open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Filter
  const filtered = query.trim()
    ? items.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q)) ||
          item.category.toLowerCase().includes(q)
        );
      })
    : items;

  // Group by category
  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        setOpen(false);
      }
    },
    [filtered, selectedIndex]
  );

  // Reset index when filtered changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-xl border bg-background shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, settings, actions…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[350px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No results for "{query}"</div>
          ) : (
            Object.entries(grouped).map(([category, catItems]) => (
              <div key={category}>
                <div className="px-2 py-1.5 text-[11px] font-semibold uppercase text-muted-foreground">{category}</div>
                {catItems.map((item) => {
                  flatIndex++;
                  const isSelected = flatIndex === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { item.action(); setOpen(false); }}
                      onMouseEnter={() => setSelectedIndex(flatIndex)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                        isSelected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent/50'
                      }`}
                    >
                      <span className="text-muted-foreground">{item.icon}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{item.label}</div>
                        {item.description && <div className="text-xs text-muted-foreground">{item.description}</div>}
                      </div>
                      {item.shortcut && (
                        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{item.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑↓ Navigate</span>
          <span>↵ Open</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}
