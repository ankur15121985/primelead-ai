import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Workflow, Plus, Trash2, Play, Power, PowerOff, GitBranch, Clock,
  Zap, Mail, Brain, ChevronDown, ChevronRight, Copy, LayoutTemplate,
  ArrowRight, CircleDot, Square, Diamond, Hexagon
} from 'lucide-react';

const NODE_COLORS: Record<string, string> = {
  TRIGGER: 'bg-purple-100 border-purple-300 text-purple-800',
  CONDITION: 'bg-yellow-100 border-yellow-300 text-yellow-800',
  ACTION: 'bg-blue-100 border-blue-300 text-blue-800',
  DELAY: 'bg-gray-100 border-gray-300 text-gray-800',
  BRANCH: 'bg-orange-100 border-orange-300 text-orange-800',
  AI_ACTION: 'bg-green-100 border-green-300 text-green-800',
};

const NODE_ICONS: Record<string, React.ReactNode> = {
  TRIGGER: <Zap className="h-4 w-4" />,
  CONDITION: <Diamond className="h-4 w-4" />,
  ACTION: <Square className="h-4 w-4" />,
  DELAY: <Clock className="h-4 w-4" />,
  BRANCH: <GitBranch className="h-4 w-4" />,
  AI_ACTION: <Brain className="h-4 w-4" />,
};

interface WorkflowNode {
  id: string;
  ruleId: string | null;
  nodeType: string;
  label: string;
  config: Record<string, unknown>;
  positionX: number;
  positionY: number;
  connections: string[];
  branches: Array<{ label: string; connectionId: string }> | null;
  enabled: boolean;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string;
  templateData: Record<string, unknown>;
  isSystem: boolean;
  useCount: number;
}

export function WorkflowBuilder() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'workflows' | 'templates' | 'triggers'>('workflows');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [showNewTemplate, setShowNewTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch automations (rules)
  const { data: automations } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await api('/api/automations');
      return res as any;
    },
  });

  // Fetch triggers and actions
  const { data: triggers } = useQuery({
    queryKey: ['workflow-triggers'],
    queryFn: async () => {
      const res = await api('/api/workflows/triggers');
      return res as any;
    },
  });

  const { data: actions } = useQuery({
    queryKey: ['workflow-actions'],
    queryFn: async () => {
      const res = await api('/api/workflows/actions');
      return res as any;
    },
  });

  // Fetch nodes
  const { data: nodesData } = useQuery({
    queryKey: ['workflow-nodes', selectedRuleId],
    queryFn: async () => {
      const url = selectedRuleId ? `/api/workflows/nodes?ruleId=${selectedRuleId}` : '/api/workflows/nodes';
      const res = await api(url);
      return res as any;
    },
    enabled: !!selectedRuleId,
  });

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['workflow-templates'],
    queryFn: async () => {
      const res = await api('/api/workflows/templates');
      return res as any;
    },
    enabled: tab === 'templates',
  });

  // Instantiate template mutation
  const instantiateMut = useMutation({
    mutationFn: async ({ templateId, name }: { templateId: string; name: string }) => {
      return api(`/api/workflows/templates/${templateId}/instantiate`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      setShowNewTemplate(false);
      setNewTemplateName('');
      setSelectedTemplate(null);
    },
  });

  // Toggle automation
  const toggleMut = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      return api(`/api/automations/${ruleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  // Delete automation
  const deleteMut = useMutation({
    mutationFn: async (ruleId: string) => {
      return api(`/api/automations/${ruleId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
    },
  });

  const rules: any[] = automations?.rules || [];
  const nodes: WorkflowNode[] = nodesData?.nodes || [];
  const templates: WorkflowTemplate[] = templatesData?.templates || [];
  const triggerList: string[] = triggers?.triggers || [];
  const actionList: string[] = actions?.actions || [];

  // Group nodes by rule
  const nodesByRule: Record<string, WorkflowNode[]> = {};
  for (const n of nodes) {
    if (n.ruleId) {
      if (!nodesByRule[n.ruleId]) nodesByRule[n.ruleId] = [];
      nodesByRule[n.ruleId].push(n);
    }
  }

  // Template categories
  const templateCategories = [...new Set(templates.map((t) => t.category))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
            <Workflow className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Workflow Builder</h1>
            <p className="text-sm text-gray-500">Design automated workflows with visual nodes</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {([
          { key: 'workflows', label: 'Active Workflows', icon: <Workflow className="h-4 w-4" /> },
          { key: 'templates', label: 'Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
          { key: 'triggers', label: 'Triggers & Actions', icon: <Zap className="h-4 w-4" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Workflows Tab */}
      {tab === 'workflows' && (
        <div className="space-y-4">
          {rules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Workflow className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows yet</h3>
                <p className="text-gray-500 mb-4">Create your first automation or start from a template.</p>
                <Button variant="primary" onClick={() => setTab('templates')}>
                  <LayoutTemplate className="h-4 w-4 mr-2" /> Browse Templates
                </Button>
              </CardContent>
            </Card>
          ) : (
            rules.map((rule: any) => {
              const ruleNodes = nodesByRule[rule.id] || [];
              const isExpanded = expandedRule === rule.id;

              return (
                <Card key={rule.id}>
                  <CardHeader
                    className="cursor-pointer py-3"
                    onClick={() => {
                      setExpandedRule(isExpanded ? null : rule.id);
                      setSelectedRuleId(rule.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
                        <div>
                          <CardTitle className="text-base">{rule.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge tone={rule.enabled ? 'success' : 'muted'}>
                              {rule.enabled ? 'Active' : 'Paused'}
                            </Badge>
                            <Badge tone="info">{rule.trigger}</Badge>
                            {rule.runCount > 0 && (
                              <span className="text-xs text-gray-500">Ran {rule.runCount}×</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleMut.mutate({ ruleId: rule.id, enabled: !rule.enabled })}
                        >
                          {rule.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteMut.mutate(rule.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      {/* Visual node flow */}
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-3">Workflow Flow</h4>
                        <div className="flex flex-col gap-2">
                          {/* Trigger node */}
                          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${NODE_COLORS.TRIGGER}`}>
                            <Zap className="h-4 w-4" />
                            <span className="font-medium">Trigger: {rule.trigger}</span>
                          </div>

                          {/* Custom nodes */}
                          {ruleNodes.filter((n: WorkflowNode) => n.nodeType !== 'TRIGGER').map((node: WorkflowNode, i: number) => (
                            <div key={node.id} className="flex items-center gap-2 pl-6">
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${NODE_COLORS[node.nodeType] || NODE_COLORS.ACTION}`}>
                                {NODE_ICONS[node.nodeType] || <Square className="h-4 w-4" />}
                                <span>{node.label}</span>
                                {!node.enabled && <span className="text-xs opacity-60">(disabled)</span>}
                              </div>
                            </div>
                          ))}

                          {/* Fallback: show rule actions */}
                          {ruleNodes.length === 0 && Array.isArray(rule.actions) && rule.actions.map((action: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 pl-6">
                              <ArrowRight className="h-3 w-3 text-gray-400" />
                              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm bg-blue-50 border-blue-200 text-blue-800">
                                <Square className="h-4 w-4" />
                                <span>{action.type?.replace(/_/g, ' ') || 'Action'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Rule actions summary */}
                      {Array.isArray(rule.actions) && rule.actions.length > 0 && (
                        <div className="mt-3">
                          <h4 className="text-xs font-medium text-gray-500 uppercase mb-2">Actions ({rule.actions.length})</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {rule.actions.map((action: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 p-2 bg-white rounded border text-sm">
                                <span className="font-mono text-xs text-gray-500">{i + 1}.</span>
                                <span className="font-medium">{action.type?.replace(/_/g, ' ')}</span>
                                {action.title && <span className="text-gray-500 truncate">— {action.title}</span>}
                                {action.tag && <Badge tone="info">{action.tag}</Badge>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Templates Tab */}
      {tab === 'templates' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowNewTemplate(!showNewTemplate)}>
                <Plus className="h-4 w-4 mr-2" /> Save Current as Template
              </Button>
            </div>
          </div>

          {templateCategories.map((cat) => (
            <div key={cat}>
              <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">{cat}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates
                  .filter((t) => t.category === cat)
                  .map((template) => (
                    <Card key={template.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <CardTitle className="text-sm">{template.name}</CardTitle>
                          {template.isSystem && <Badge tone="info">System</Badge>}
                        </div>
                        {template.description && (
                          <p className="text-xs text-gray-500 mt-1">{template.description}</p>
                        )}
                      </CardHeader>
                      <CardContent>
                        {/* Preview: trigger + action count */}
                        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                          <Zap className="h-3 w-3" />
                          <span>{(template.templateData as any)?.trigger || 'Custom'}</span>
                          <span>→</span>
                          <span>{Array.isArray((template.templateData as any)?.actions) ? (template.templateData as any).actions.length : 0} actions</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-400">Used {template.useCount}×</span>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              setSelectedTemplate(template.id);
                              setShowNewTemplate(true);
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1" /> Use Template
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <LayoutTemplate className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
                <p className="text-gray-500">Templates will appear here once the server seeds system templates.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Triggers & Actions Tab */}
      {tab === 'triggers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" /> Available Triggers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {triggerList.map((trigger) => (
                  <div key={trigger} className="flex items-center gap-2 p-2 bg-purple-50 rounded text-sm">
                    <CircleDot className="h-3 w-3 text-purple-500" />
                    <span className="font-mono">{trigger}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Square className="h-5 w-5 text-blue-500" /> Available Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actionList.map((action) => (
                  <div key={action} className="flex items-center gap-2 p-2 bg-blue-50 rounded text-sm">
                    <Square className="h-3 w-3 text-blue-500" />
                    <span className="font-mono">{action}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instantiate Template Dialog */}
      {showNewTemplate && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Create Workflow from Template</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Workflow Name</label>
                  <input
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="e.g. My Inbound Workflow"
                    className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setShowNewTemplate(false); setSelectedTemplate(null); }}>Cancel</Button>
                  <Button
                    variant="primary"
                    disabled={!newTemplateName.trim() || instantiateMut.isPending}
                    onClick={() => instantiateMut.mutate({ templateId: selectedTemplate, name: newTemplateName.trim() })}
                  >
                    {instantiateMut.isPending ? 'Creating...' : 'Create Workflow'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
