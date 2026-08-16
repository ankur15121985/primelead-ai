import { Navigate, Route, Routes } from 'react-router-dom';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Home } from '@/pages/public/Home';
import { Features } from '@/pages/public/Features';
import { LeadSources } from '@/pages/public/LeadSources';
import { Pricing } from '@/pages/public/Pricing';
import { FAQ } from '@/pages/public/FAQ';
import { Contact } from '@/pages/public/Contact';
import { Login } from '@/pages/public/Login';
import { Signup } from '@/pages/public/Signup';
import { ForgotPassword } from '@/pages/public/ForgotPassword';
import { ResetPassword } from '@/pages/public/ResetPassword';
import { PublicLeadForm } from '@/pages/public/PublicLeadForm';
import { QRGenerator } from '@/pages/public/QRGenerator';
import { GSTInvoiceGenerator } from '@/pages/public/GSTInvoiceGenerator';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AdminOverview } from '@/pages/admin/AdminOverview';
import { AdminOrganizations } from '@/pages/admin/AdminOrganizations';
import { AdminOrgDetail } from '@/pages/admin/AdminOrgDetail';
import { AdminUsers } from '@/pages/admin/AdminUsers';
import { AdminSystem } from '@/pages/admin/AdminSystem';
import { Dashboard } from '@/pages/app/Dashboard';
import { Leads } from '@/pages/app/Leads';
import { LeadDetail } from '@/pages/app/LeadDetail';
import { Pipeline } from '@/pages/app/Pipeline';
import { Tasks } from '@/pages/app/Tasks';
import { Inbox } from '@/pages/app/Inbox';
import { Calendar } from '@/pages/app/Calendar';
import { Contacts } from '@/pages/app/Contacts';
import { Quotations } from '@/pages/app/Quotations';
import { QuotationDetail } from '@/pages/app/QuotationDetail';
import { Invoices } from '@/pages/app/Invoices';
import { InvoiceDetail } from '@/pages/app/InvoiceDetail';
import { Reports } from '@/pages/app/Reports';
import { AiAssistant } from '@/pages/app/AiAssistant';
import { Integrations } from '@/pages/app/Integrations';
import { Billing } from '@/pages/app/Billing';
import { Team } from '@/pages/app/Team';
import { Settings } from '@/pages/app/Settings';
import { QrCodes } from '@/pages/app/QrCodes';
import { Automations } from '@/pages/app/Automations';
import { Onboarding } from '@/pages/app/Onboarding';

export default function App() {
  return (
    <Routes>
      <Route element={<MarketingLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/features" element={<Features />} />
        <Route path="/lead-sources" element={<LeadSources />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/tools/qr-generator" element={<QRGenerator />} />
        <Route path="/tools/gst-invoice-generator" element={<GSTInvoiceGenerator />} />
      </Route>

      {/* Public QR capture form — reachable by scanning a printed QR code */}
      <Route path="/r/:slug" element={<PublicLeadForm />} />

      <Route path="/app/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />

      {/* Super-admin console — only users listed in SUPER_ADMIN_EMAILS */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminOverview />} />
        <Route path="organizations" element={<AdminOrganizations />} />
        <Route path="organizations/:id" element={<AdminOrgDetail />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="system" element={<AdminSystem />} />
      </Route>

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:id" element={<LeadDetail />} />
        <Route path="pipeline" element={<Pipeline />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="quotations/:id" element={<QuotationDetail />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="ai" element={<AiAssistant />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="billing" element={<Billing />} />
        <Route path="qr-codes" element={<QrCodes />} />
        <Route path="automations" element={<Automations />} />
        <Route path="team" element={<Team />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
