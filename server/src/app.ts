import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
