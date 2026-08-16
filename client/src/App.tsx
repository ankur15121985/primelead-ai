import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { Skeleton } from '@/components/ui/skeleton';

// Route-level code splitting: pages are lazy chunks, the shell stays eager.
// `lazyPage` maps a module's named export to the default shape React.lazy wants.
function lazyPage<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M & string) {
  return lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })));
}

// Public / marketing
const Home = lazyPage(() => import('@/pages/public/Home'), 'Home');
const Features = lazyPage(() => import('@/pages/public/Features'), 'Features');
const LeadSources = lazyPage(() => import('@/pages/public/LeadSources'), 'LeadSources');
const Pricing = lazyPage(() => import('@/pages/public/Pricing'), 'Pricing');
const FAQ = lazyPage(() => import('@/pages/public/FAQ'), 'FAQ');
const Contact = lazyPage(() => import('@/pages/public/Contact'), 'Contact');
const Login = lazyPage(() => import('@/pages/public/Login'), 'Login');
const Signup = lazyPage(() => import('@/pages/public/Signup'), 'Signup');
const ForgotPassword = lazyPage(() => import('@/pages/public/ForgotPassword'), 'ForgotPassword');
const ResetPassword = lazyPage(() => import('@/pages/public/ResetPassword'), 'ResetPassword');
const PublicLeadForm = lazyPage(() => import('@/pages/public/PublicLeadForm'), 'PublicLeadForm');
const QRGenerator = lazyPage(() => import('@/pages/public/QRGenerator'), 'QRGenerator');
const GSTInvoiceGenerator = lazyPage(() => import('@/pages/public/GSTInvoiceGenerator'), 'GSTInvoiceGenerator');

// Super-admin console
const AdminOverview = lazyPage(() => import('@/pages/admin/AdminOverview'), 'AdminOverview');
const AdminOrganizations = lazyPage(() => import('@/pages/admin/AdminOrganizations'), 'AdminOrganizations');
const AdminOrgDetail = lazyPage(() => import('@/pages/admin/AdminOrgDetail'), 'AdminOrgDetail');
const AdminUsers = lazyPage(() => import('@/pages/admin/AdminUsers'), 'AdminUsers');
const AdminSystem = lazyPage(() => import('@/pages/admin/AdminSystem'), 'AdminSystem');

// App pages
const Dashboard = lazyPage(() => import('@/pages/app/Dashboard'), 'Dashboard');
const Leads = lazyPage(() => import('@/pages/app/Leads'), 'Leads');
const LeadDetail = lazyPage(() => import('@/pages/app/LeadDetail'), 'LeadDetail');
const Pipeline = lazyPage(() => import('@/pages/app/Pipeline'), 'Pipeline');
const Tasks = lazyPage(() => import('@/pages/app/Tasks'), 'Tasks');
const Inbox = lazyPage(() => import('@/pages/app/Inbox'), 'Inbox');
const Calendar = lazyPage(() => import('@/pages/app/Calendar'), 'Calendar');
const Contacts = lazyPage(() => import('@/pages/app/Contacts'), 'Contacts');
const Quotations = lazyPage(() => import('@/pages/app/Quotations'), 'Quotations');
const QuotationDetail = lazyPage(() => import('@/pages/app/QuotationDetail'), 'QuotationDetail');
const Invoices = lazyPage(() => import('@/pages/app/Invoices'), 'Invoices');
const InvoiceDetail = lazyPage(() => import('@/pages/app/InvoiceDetail'), 'InvoiceDetail');
const Reports = lazyPage(() => import('@/pages/app/Reports'), 'Reports');
const AiAssistant = lazyPage(() => import('@/pages/app/AiAssistant'), 'AiAssistant');
const Integrations = lazyPage(() => import('@/pages/app/Integrations'), 'Integrations');
const Billing = lazyPage(() => import('@/pages/app/Billing'), 'Billing');
const Team = lazyPage(() => import('@/pages/app/Team'), 'Team');
const Settings = lazyPage(() => import('@/pages/app/Settings'), 'Settings');
const QrCodes = lazyPage(() => import('@/pages/app/QrCodes'), 'QrCodes');
const Automations = lazyPage(() => import('@/pages/app/Automations'), 'Automations');
const Onboarding = lazyPage(() => import('@/pages/app/Onboarding'), 'Onboarding');

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-md space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  );
}
