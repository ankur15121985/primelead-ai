import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Plus, Trash2, Eye, BarChart3, Code, Copy, ExternalLink } from 'lucide-react';

export function FormsBuilder() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ name: '', description: '' });

  const { data: formsData } = useQuery({
    queryKey: ['forms'],
    queryFn: async () => api('/api/forms') as any,
  });

  const { data: submissionsData } = useQuery({
    queryKey: ['form-submissions', selectedForm],
    queryFn: async () => api(`/api/forms/${selectedForm}/submissions`) as any,
    enabled: !!selectedForm,
  });

  const { data: statsData } = useQuery({
    queryKey: ['form-stats', selectedForm],
    queryFn: async () => api(`/api/forms/${selectedForm}/stats`) as any,
    enabled: !!selectedForm,
  });

  const { data: embedData } = useQuery({
    queryKey: ['form-embed', selectedForm],
    queryFn: async () => api(`/api/forms/${selectedForm}/embed`) as any,
    enabled: !!selectedForm,
  });

  const createMut = useMutation({
    mutationFn: async () => api('/api/forms', { method: 'POST', body: JSON.stringify({ ...newForm, fields: [{ name: 'name', label: 'Full Name', type: 'text', required: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone', type: 'tel' }, { name: 'company', label: 'Company', type: 'text' }] }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['forms'] }); setShowCreate(false); setNewForm({ name: '', description: '' }); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => api(`/api/forms/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['forms'] }); setSelectedForm(null); },
  });

  const forms: any[] = formsData?.forms || [];
  const submissions: any[] = submissionsData?.submissions || [];
  const stats = statsData?.stats;
  const embedCode = embedData?.embedCode || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
            <FileText className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Forms Builder</h1>
            <p className="text-sm text-gray-500">Create inbound lead capture forms</p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="h-4 w-4 mr-2" /> New Form
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create New Form</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm font-medium">Form Name</label>
                <input value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-md text-sm" placeholder="Contact Us" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <input value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} className="w-full mt-1 px-3 py-2 border rounded-md text-sm" placeholder="Optional description" />
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-4">Default fields: Name, Email, Phone, Company. More fields can be configured after creation.</div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => createMut.mutate()} disabled={!newForm.name.trim() || createMut.isPending}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forms list */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500">Forms ({forms.length})</h3>
          {forms.map((form: any) => (
            <Card key={form.id} className={`cursor-pointer transition-colors ${selectedForm === form.id ? 'border-blue-500 bg-blue-50/30' : 'hover:bg-gray-50'}`} onClick={() => setSelectedForm(form.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{form.name}</div>
                    <div className="text-xs text-gray-500">/{form.slug} · {form.totalSubmissions} submissions</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge tone={form.isActive ? 'success' : 'muted'}>{form.isActive ? 'Active' : 'Inactive'}</Badge>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteMut.mutate(form.id); }} className="text-red-500"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {forms.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No forms yet</p>}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {selectedForm ? (
            <div className="space-y-4">
              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-3 gap-4">
                  <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-gray-500">Total Submissions</div></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.byStatus?.find((s: any) => s.status === 'PROCESSED')?.count || 0}</div><div className="text-xs text-gray-500">Processed</div></CardContent></Card>
                  <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.byStatus?.find((s: any) => s.status === 'NEW')?.count || 0}</div><div className="text-xs text-gray-500">New</div></CardContent></Card>
                </div>
              )}

              {/* Submissions */}
              <Card>
                <CardHeader><CardTitle className="text-base">Recent Submissions</CardTitle></CardHeader>
                <CardContent>
                  {submissions.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No submissions yet</p>
                  ) : (
                    <div className="space-y-2">
                      {submissions.map((sub: any) => (
                        <div key={sub.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                          <div>
                            <span className="font-medium">{JSON.stringify(sub.data).slice(0, 80)}...</span>
                            <span className="text-xs text-gray-500 ml-2">{new Date(sub.createdAt).toLocaleDateString()}</span>
                          </div>
                          <Badge tone={sub.status === 'PROCESSED' ? 'success' : sub.status === 'NEW' ? 'warning' : 'muted'}>{sub.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Embed code */}
              {embedCode && (
                <Card>
                  <CardHeader><CardTitle className="text-base flex items-center gap-2"><Code className="h-4 w-4" /> Embed Code</CardTitle></CardHeader>
                  <CardContent>
                    <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">{embedCode}</pre>
                    <Button variant="outline" size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(embedCode)}>
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card><CardContent className="p-12 text-center text-gray-400"><FileText className="h-12 w-12 mx-auto mb-4 opacity-30" /><p>Select a form to view details</p></CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
