import fs from 'fs';
import path from 'path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { apiLimiter } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { ensureCsrfCookie, csrfProtection } from './middleware/csrf';
import { errorHandler, notFoundHandler } from './middleware/error';
import authRoutes from './routes/auth.routes';
import leadsRoutes from './routes/leads.routes';
import pipelineRoutes from './routes/pipeline.routes';
import tasksRoutes from './routes/tasks.routes';
import dashboardRoutes from './routes/dashboard.routes';
import notificationsRoutes from './routes/notifications.routes';
import teamRoutes from './routes/team.routes';
import settingsRoutes from './routes/settings.routes';
import aiRoutes from './routes/ai.routes';
import miscRoutes from './routes/misc.routes';
import publicRoutes from './routes/public.routes';
import qrRoutes from './routes/qr.routes';
import quotationsRoutes from './routes/quotations.routes';
import invoicesRoutes from './routes/invoices.routes';
import { creditNotesRouter, debitNotesRouter } from './routes/note-documents.routes';
import reportsRoutes from './routes/reports.routes';
import integrationsRoutes from './routes/integrations.routes';
import webhooksRoutes from './routes/webhooks.routes';
import paymentWebhooksRoutes from './routes/payment-webhooks.routes';
import whatsappWebhookRoutes from './routes/whatsapp-webhook.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import billingRoutes from './routes/billing.routes';
import contactsRoutes from './routes/contacts.routes';
import adminRoutes from './routes/admin.routes';
import referralRoutes from './routes/referral.routes';
import rolesRoutes from './routes/roles.routes';
import teamsRoutes from './routes/teams.routes';
import automationRoutes from './routes/automation.routes';
import accountRoutes from './routes/account.routes';
import companiesRoutes from './routes/companies.routes';
import companyContactsRoutes from './routes/company-contacts.routes';
import searchRoutes from './routes/search.routes';
import savedSearchesRoutes from './routes/saved-searches.routes';
import listsRoutes from './routes/lists.routes';
import icpRoutes from './routes/icp.routes';
import personaRoutes from './routes/persona.routes';
import verificationRoutes from './routes/verification.routes';
import dataQualityRoutes from './routes/data-quality.routes';
import dataProvidersRoutes from './routes/data-providers.routes';
import scoringRoutes from './routes/scoring.routes';
import signalsRoutes from './routes/signals.routes';
import sequencesRoutes from './routes/sequences.routes';
import deliverabilityRoutes from './routes/deliverability.routes';
import callsRoutes from './routes/calls.routes';
import meetingsRoutes from './routes/meetings.routes';
import intelligenceRoutes from './routes/intelligence.routes';
import workflowsRoutes from './routes/workflows.routes';
import aiResearchRoutes from './routes/ai-research.routes';
import formsRoutes, { publicFormRouter } from './routes/forms.routes';
import inboundRoutes from './routes/inbound.routes';
import meetingIntelRoutes from './routes/meeting-intel.routes';
import analyticsRoutes from './routes/analytics.routes';
import complianceRoutes from './routes/compliance.routes';
import apiKeysRoutes from './routes/api-keys.routes';
import webhooksPlatformRoutes from './routes/webhooks-platform.routes';
import dataImportRoutes from './routes/data-import.routes';
import reportsV2Routes from './routes/reports-v2.routes';
import territoriesRoutes from './routes/territories.routes';
import coachingRoutes from './routes/coaching.routes';
import forecastRoutes from './routes/forecast.routes';
import duplicatesRoutes from './routes/duplicates.routes';
import securityRoutes from './routes/security.routes';
import pushRoutes from './routes/push.routes';
import scheduledMessagesRoutes from './routes/scheduled-messages.routes';
import gstEInvoiceRoutes from './routes/gst-einvoice.routes';
import emailTemplatesRoutes from './routes/email-templates.routes';
import reportSchedulerRoutes from './routes/report-scheduler.routes';
import smsRoutes from './routes/sms.routes';
import recordingsRoutes from './routes/recordings.routes';
import meetingNotesRoutes from './routes/meeting-notes.routes';
import bulkCallsRoutes from './routes/bulk-calls.routes';
import videoCallRoutes from './routes/video-call.routes';
import smsOutboundRoutes from './routes/sms-outbound.routes';
import smsWebhookRoutes from './routes/sms-webhook.routes';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: config.isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    cors({
      origin: config.isProd ? config.clientOrigin.split(',') : true,
      credentials: true,
    })
  );

  app.use(requestId);

  // gzip/deflate JSON API responses (biggest win for lead/dashboard payloads).
  // Mounted before routes but after requestId so compressed bodies still carry it.
  app.use(compression());

  // Webhooks that need the RAW body for HMAC signature verification are
  // mounted BEFORE express.json() parses (and consumes) the stream.
  app.use('/api/webhooks/payments', express.raw({ type: '*/*', limit: '1mb' }), paymentWebhooksRoutes);
  app.use('/api/webhooks/whatsapp', express.raw({ type: '*/*', limit: '1mb' }), whatsappWebhookRoutes);

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  app.use('/api', apiLimiter);
  app.use('/api', ensureCsrfCookie);

  // Inbound lead webhooks authenticate via their own secret header (no browser
  // cookies exist), so they are mounted before the double-submit CSRF gate.
  app.use('/api/webhooks', webhooksRoutes);

  app.use('/api', csrfProtection);

  // Public-ish endpoints (health, contact, QR capture forms are unauthenticated)
  app.use('/api', miscRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  // Everything below requires an authenticated session
  app.use('/api/qr-codes', qrRoutes);
  app.use('/api/leads', leadsRoutes);
  app.use('/api/pipeline', pipelineRoutes);
  app.use('/api/tasks', tasksRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/notifications', notificationsRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/quotations', quotationsRoutes);
  app.use('/api/invoices', invoicesRoutes);
  app.use('/api/credit-notes', creditNotesRouter);
  app.use('/api/debit-notes', debitNotesRouter);
  app.use('/api/reports', reportsRoutes);
  app.use('/api/integrations', integrationsRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/contacts', contactsRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/roles', rolesRoutes);
  app.use('/api/teams', teamsRoutes);
  app.use('/api/automations', automationRoutes);
  app.use('/api/account', accountRoutes);
  app.use('/api/companies', companiesRoutes);
  app.use('/api/company-contacts', companyContactsRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/saved-searches', savedSearchesRoutes);
  app.use('/api/lists', listsRoutes);
  app.use('/api/icps', icpRoutes);
  app.use('/api/personas', personaRoutes);
  app.use('/api/verification', verificationRoutes);
  app.use('/api/data-quality', dataQualityRoutes);
  app.use('/api/data-providers', dataProvidersRoutes);
  app.use('/api/scoring', scoringRoutes);
  app.use('/api/signals', signalsRoutes);
  app.use('/api/sequences', sequencesRoutes);
  app.use('/api/deliverability', deliverabilityRoutes);
  app.use('/api/calls', callsRoutes);
  app.use('/api/meetings', meetingsRoutes);
  app.use('/api/intelligence', intelligenceRoutes);
  app.use('/api/workflows', workflowsRoutes);
  app.use('/api/ai-research', aiResearchRoutes);
  app.use('/api/ai-recommendations', aiResearchRoutes);
  app.use('/api/forms', formsRoutes);
  app.use('/api/public/forms', publicFormRouter);
  app.use('/api/inbound', inboundRoutes);
  app.use('/api/meeting-intel', meetingIntelRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/compliance', complianceRoutes);
  app.use('/api/api-keys', apiKeysRoutes);
  app.use('/api/webhooks-platform', webhooksPlatformRoutes);
  app.use('/api/import', dataImportRoutes);
  app.use('/api/reports', reportsV2Routes);
  app.use('/api/territories', territoriesRoutes);
  app.use('/api/coaching', coachingRoutes);
  app.use('/api/forecast', forecastRoutes);
  app.use('/api/duplicates', duplicatesRoutes);
  app.use('/api/security', securityRoutes);
  app.use('/api/push', pushRoutes);
  app.use('/api/scheduled-messages', scheduledMessagesRoutes);
  app.use('/api/gst', gstEInvoiceRoutes);
  app.use('/api/email-templates', emailTemplatesRoutes);
  app.use('/api/report-scheduler', reportSchedulerRoutes);

  // Phase 24: SMS lead generation, recordings, AI meeting notes
  app.use('/api/sms', smsRoutes);
  app.use('/webhooks', smsRoutes);
  app.use('/api/recordings', recordingsRoutes);
  app.use('/api/meeting-notes', meetingNotesRoutes);

  // Phase 25: bulk calls, video rooms, SMS outbound
  app.use('/api/bulk-calls', bulkCallsRoutes);
  app.use('/api/video', videoCallRoutes);
  app.use('/api/sms-outbound', smsOutboundRoutes);
  app.use('/webhooks', smsWebhookRoutes);

  // Production single-container mode: when the client has been built, serve its
  // static assets from the API and fall back to index.html for client routes.
  // In dev the Vite dev server serves the client, so this stays inert.
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(path.join(clientDist, 'index.html'))) {
    app.use(express.static(clientDist, { index: false, maxAge: '7d', immutable: false }));
    // SPA fallback — only for non-/api GETs (HTML navigation deep links).
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
