import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, download } from '@/lib/api';
import type {
  AdminOrg, AdminOrgDetail, AdminOverview, AdminSystem, AiConversation, AiConversationDetail,
  BillingData, Contact, DashboardData, Integration, IntegrationCatalogItem, Invoice, Lead, LeadDetail,
  LeadListResponse, Notification, PipelineStage, PublicQrMeta, QrCode, QrDetail, Quotation,
  ReportData, Task, User,
} from '@/types';

/** All TanStack Query hooks for the app. */

// ── Dashboard ─────────────────────────────────────────────
export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/dashboard'),
    staleTime: 30_000,
  });
}

// ── Leads ─────────────────────────────────────────────────
export interface LeadFilters {
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  stageId?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: 'asc' | 'desc';
}

export function useLeads(filters: LeadFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.source && filters.source !== 'ALL') params.set('source', filters.source);
  if (filters.ownerId && filters.ownerId !== 'ALL') params.set('ownerId', filters.ownerId);
  if (filters.stageId && filters.stageId !== 'ALL') params.set('stageId', filters.stageId);
  params.set('page', String(filters.page || 1));
  params.set('pageSize', String(filters.pageSize || 20));
  params.set('sort', filters.sort || 'createdAt');
  params.set('dir', filters.dir || 'desc');
  const qs = params.toString();
  return useQuery({
    queryKey: ['leads', qs],
    queryFn: () => api<LeadListResponse>(`/leads?${qs}`),
    staleTime: 10_000,
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => api<{ lead: LeadDetail }>(`/leads/${id}`),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api<{ lead: Lead }>('/leads', { body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function useUpdateLead(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api<{ lead: Lead }>(id ? `/leads/${id}` : '/leads', {
        method: 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      if (id) qc.invalidateQueries({ queryKey: ['lead', id] });
    },
  });
}

export function useMoveLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; stageId: string; status: string }) =>
      api(`/leads/${input.id}`, { method: 'PATCH', body: { stageId: input.stageId, status: input.status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useBulkLeads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; action: string; ownerId?: string; status?: string; tag?: string }) =>
      api('/leads/bulk', { body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function useAddActivity(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; body: string }) => api(`/leads/${leadId}/activity`, { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead', leadId] }),
  });
}

export function useAddFollowUp(leadId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; kind?: string; dueAt: string; notes?: string }) =>
      api(`/leads/${leadId}/tasks`, { body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead', leadId] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

// ── Pipeline ──────────────────────────────────────────────
export function usePipeline() {
  return useQuery({
    queryKey: ['pipeline'],
    queryFn: () => api<{ stages: PipelineStage[]; pipeline: { id: string; name: string } | null }>('/pipeline'),
    staleTime: 10_000,
  });
}

// ── Tasks / follow-ups ────────────────────────────────────
export function useTasks(view: string) {
  return useQuery({
    queryKey: ['tasks', view],
    queryFn: () =>
      api<{ tasks: Task[]; counts: Record<string, number> }>(`/tasks?view=${view}`),
    staleTime: 10_000,
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api(`/tasks/${taskId}`, { method: 'PATCH', body: { status: 'DONE' } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ── Team ──────────────────────────────────────────────────
export function useTeam() {
  return useQuery({
    queryKey: ['team'],
    queryFn: () => api<{ users: User[] }>('/team'),
    staleTime: 30_000,
  });
}

// ── Notifications ─────────────────────────────────────────
export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ items: Notification[]; unread: number }>('/notifications'),
    refetchInterval: 60_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/notifications/read-all', { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ── AI ────────────────────────────────────────────────────
export function useAiFollowUp() {
  return useMutation({
    mutationFn: (input: { leadId: string; channel?: string; tone?: string; language?: string; objective?: string; productService?: string }) =>
      api<{ message: string; subject?: string }>('/ai/follow-up', { body: input }),
  });
}

// ── QR lead capture ───────────────────────────────────────
export function useQrCodes() {
  return useQuery({
    queryKey: ['qr-codes'],
    queryFn: () => api<{ qrCodes: QrCode[]; campaigns: Array<{ id: string; name: string }> }>('/qr-codes'),
    staleTime: 10_000,
  });
}

export function useQrCode(id: string) {
  return useQuery({
    queryKey: ['qr-code', id],
    queryFn: () => api<{ qrCode: QrDetail }>(`/qr-codes/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateQrCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; description?: string; campaignName?: string; campaignId?: string; fields: string[] }) =>
      api<{ qrCode: QrCode }>('/qr-codes', { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qr-codes'] }),
  });
}

export function useUpdateQrCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; title?: string; description?: string; fields?: string[]; enabled?: boolean; campaignId?: string; campaignName?: string }) =>
      api<{ qrCode: QrCode }>(`/qr-codes/${input.id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qr-codes'] });
      qc.invalidateQueries({ queryKey: ['qr-code'] });
    },
  });
}

export function useDeleteQrCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/qr-codes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['qr-codes'] }),
  });
}

/**
 * Public form meta — the GET also counts a scan, so it must only fire once
 * per page load (no refetch on window focus or it would inflate scan counts).
 */
export function usePublicQrMeta(slug: string) {
  return useQuery({
    queryKey: ['public-qr', slug],
    queryFn: () => api<PublicQrMeta>(`/public/qr/${slug}`),
    enabled: Boolean(slug),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });
}

export function useSubmitPublicLead() {
  return useMutation({
    mutationFn: (input: { slug: string; name?: string; phone?: string; email?: string; message?: string }) =>
      api<{ received: boolean; duplicate?: boolean; message: string }>(`/public/qr/${input.slug}/lead`, { body: input }),
  });
}

// ── Super-admin (website handler) ─────────────────────────
export function useAdminOverview() {
  return useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => api<AdminOverview>('/admin/overview'),
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminOrgs() {
  return useQuery({
    queryKey: ['admin-orgs'],
    queryFn: () => api<{ organizations: AdminOrg[] }>('/admin/orgs'),
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminOrg(id: string) {
  return useQuery({
    queryKey: ['admin-org', id],
    queryFn: () => api<AdminOrgDetail>(`/admin/orgs/${id}`),
    enabled: Boolean(id),
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api<{ users: Array<User & { org: { id: string; name: string; plan: string; status: string } }> }>('/admin/users'),
    staleTime: 15_000,
    retry: false,
  });
}

export function useAdminSystem() {
  return useQuery({
    queryKey: ['admin-system'],
    queryFn: () => api<AdminSystem>('/admin/system'),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAdminUpdateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status?: string; plan?: string }) =>
      api<{ org: AdminOrg }>(`/admin/orgs/${input.id}`, { method: 'PATCH', body: { status: input.status, plan: input.plan } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
      qc.invalidateQueries({ queryKey: ['admin-orgs'] });
      qc.invalidateQueries({ queryKey: ['admin-org'] });
    },
  });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; active?: boolean; role?: string }) =>
      api(`/admin/users/${input.id}`, { method: 'PATCH', body: { active: input.active, role: input.role } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-org'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

export function useAdminClearErrors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/admin/system/clear-errors', { body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-system'] });
      qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
  });
}

// ── Quotations ────────────────────────────────────────────
export function useQuotations(filters: { status?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['quotations', qs],
    queryFn: () => api<{ quotations: Quotation[]; counts: Record<string, number> }>(`/quotations?${qs}`),
    staleTime: 10_000,
  });
}

export function useQuotation(id: string) {
  return useQuery({
    queryKey: ['quotation', id],
    queryFn: () => api<{ quotation: Quotation }>(`/quotations/${id}`),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useCreateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api<{ quotation: Quotation }>('/quotations', { body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & Record<string, unknown>) =>
      api<{ quotation: Quotation }>(`/quotations/${input.id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['quotation'] });
    },
  });
}

export function useDeleteQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/quotations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotations'] }),
  });
}

export function useConvertQuotation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ invoice: { id: string; number: string } }>(`/quotations/${id}/convert`, { body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quotations'] });
      qc.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
}

export function downloadQuotationPdf(id: string) {
  return download(`/quotations/${id}/pdf`, `quotation-${id}.pdf`);
}

// ── Invoices ───────────────────────────────────────────────
export function useInvoices(filters: { status?: string; search?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.search) params.set('search', filters.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['invoices', qs],
    queryFn: () => api<{ invoices: Invoice[]; counts: Record<string, number> }>(`/invoices?${qs}`),
    staleTime: 10_000,
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api<{ invoice: Invoice }>(`/invoices/${id}`),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api<{ invoice: Invoice }>('/invoices', { body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & Record<string, unknown>) =>
      api<{ invoice: Invoice }>(`/invoices/${input.id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice'] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/invoices/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
}

export function useRecordInvoicePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; paidAmount: number }) =>
      api<{ invoice: Invoice }>(`/invoices/${input.id}/payment`, { body: { paidAmount: input.paidAmount } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoice'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function downloadInvoicePdf(id: string) {
  return download(`/invoices/${id}/pdf`, `invoice-${id}.pdf`);
}

// ── AI assistant ───────────────────────────────────────────
export function useAiStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api<{ configured: boolean }>('/ai/status'),
    staleTime: 30_000,
  });
}

export function useAiConversations() {
  return useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api<{ conversations: AiConversation[] }>('/ai/conversations'),
    staleTime: 10_000,
  });
}

export function useAiConversation(id: string) {
  return useQuery({
    queryKey: ['ai-conversation', id],
    queryFn: () => api<{ conversation: AiConversationDetail }>(`/ai/conversations/${id}`),
    enabled: Boolean(id),
    staleTime: 10_000,
  });
}

export function useAiChat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { message: string; conversationId?: string }) =>
      api<{ conversationId: string; reply: string; notConfigured: boolean }>('/ai/chat', { body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-conversations'] });
      qc.invalidateQueries({ queryKey: ['ai-conversation'] });
    },
  });
}

// ── Integrations ───────────────────────────────────────────
export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => api<{ catalog: IntegrationCatalogItem[]; connections: Integration[] }>('/integrations'),
    staleTime: 10_000,
  });
}

export function useConnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: string) =>
      api<{ integration: Integration & { webhookSecret: string; webhookUrl: string } }>(`/integrations/${source}/connect`, { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useUpdateIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { source: string; enabled?: boolean; status?: string }) =>
      api(`/integrations/${input.source}`, { method: 'PATCH', body: { enabled: input.enabled, status: input.status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

export function useDisconnectIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (source: string) => api(`/integrations/${source}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
}

// ── Reports ────────────────────────────────────────────────
export function useReports(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return useQuery({
    queryKey: ['reports', qs],
    queryFn: () => api<ReportData>(`/reports?${qs}`),
    staleTime: 30_000,
  });
}

export function useExportReport(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  return () => download(`/reports/export?${params.toString()}`, `report-${new Date().toISOString().slice(0, 10)}.csv`);
}

// ── Billing ────────────────────────────────────────────────
export function useBilling() {
  return useQuery({
    queryKey: ['billing'],
    queryFn: () => api<BillingData>('/billing'),
    staleTime: 30_000,
  });
}

export function useUpgradePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { planSlug: string; period: string }) => api<{ applied: boolean; mode: string; plan: string }>('/billing/upgrade', { body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing'] });
      qc.invalidateQueries({ queryKey: ['auth'] });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/billing/cancel', { body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['billing'] }),
  });
}

// ── Contacts ───────────────────────────────────────────────
export function useContacts(search?: string) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['contacts', qs],
    queryFn: () => api<{ contacts: Contact[]; total: number }>(`/contacts?${qs}`),
    staleTime: 10_000,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => api<{ contact: Contact }>('/contacts', { body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & Record<string, unknown>) => api<{ contact: Contact }>(`/contacts/${input.id}`, { method: 'PATCH', body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts'] }),
  });
}

// ── Export ────────────────────────────────────────────────
export function useExportLeads(filters: LeadFilters) {
  const params = new URLSearchParams();
  if (filters.search) params.set('search', filters.search);
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.source && filters.source !== 'ALL') params.set('source', filters.source);
  return {
    exportCsv: () => download(`/leads/export?${params.toString()}`, `leads-${new Date().toISOString().slice(0, 10)}.csv`),
  };
}
