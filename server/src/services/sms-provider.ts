/**
 * SMS Provider Abstraction — send outbound SMS replies to leads.
 *
 * Providers:
 *   - Twilio (real, requires credentials)
 *   - Textbelt (real, free tier available)
 *   - Demo (simulated, logs to console)
 *
 * Flow:
 *   1. Inbound SMS creates a lead (sms-leads.ts)
 *   2. Agent reviews and clicks "Reply" in the UI
 *   3. This service sends the outbound SMS
 *   4. Delivery status tracked via webhook
 */
import { prisma } from '../lib/prisma';
import { badRequest } from '../lib/http';

// ── Types ─────────────────────────────────────────────────

export interface SmsProvider {
  readonly name: string;
  sendSms(to: string, body: string, from?: string): Promise<SmsSendResult>;
}

export interface SmsSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  cost?: number;
}

export interface SendSmsInput {
  orgId: string;
  userId: string;
  leadId?: string;
  to: string;
  body: string;
  /** Override sender number (uses org default if not set) */
  fromNumber?: string;
}

// ── Provider Resolution ───────────────────────────────────

/**
 * Resolve the SMS provider for an org.
 */
export async function resolveProvider(orgId: string): Promise<SmsProvider> {
  const settings = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key: 'sms' } },
  });

  const cfg = (settings?.value as {
    provider?: string;
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    apiKey?: string;
    apiUrl?: string;
  } | null) || null;

  const providerName = cfg?.provider || 'demo';

  if (providerName === 'twilio' && cfg?.accountSid && cfg?.authToken) {
    return new TwilioProvider(cfg.accountSid, cfg.authToken, cfg.fromNumber || '+18005550000');
  }

  if (providerName === 'textbelt' && cfg?.apiKey) {
    return new TextbeltProvider(cfg.apiKey, cfg.fromNumber || '+18005550000');
  }

  // Default to demo provider
  return new DemoProvider(cfg?.fromNumber || '+18005550000');
}

// ── Send SMS ──────────────────────────────────────────────

/**
 * Send an outbound SMS reply.
 */
export async function sendSms(input: SendSmsInput): Promise<{
  result: SmsSendResult;
  logId: string;
}> {
  if (!input.to) throw badRequest('Recipient phone number is required');
  if (!input.body?.trim()) throw badRequest('SMS body is required');
  if (input.body.length > 1600) throw badRequest('SMS body must be 1600 characters or fewer');

  const provider = await resolveProvider(input.orgId);
  const result = await provider.sendSms(input.to, input.body.trim(), input.fromNumber);

  // Log the outbound SMS
  const log = await prisma.smsOutbound.create({
    data: {
      orgId: input.orgId,
      userId: input.userId,
      leadId: input.leadId || null,
      toNumber: input.to,
      fromNumber: input.fromNumber || '+18005550000',
      body: input.body.trim(),
      status: result.success ? 'SENT' : 'FAILED',
      providerMessageId: result.messageId || null,
      error: result.error || null,
      cost: result.cost || null,
    },
  });

  // Update lead's last contacted time
  if (input.leadId) {
    await prisma.lead.update({
      where: { id: input.leadId },
      data: { lastContactedAt: new Date() },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        orgId: input.orgId,
        leadId: input.leadId,
        userId: input.userId,
        type: 'SMS',
        title: `SMS sent to ${input.to}`,
        body: input.body.slice(0, 500),
      },
    });
  }

  return { result, logId: log.id };
}

/**
 * Get SMS send history.
 */
export async function getSmsHistory(orgId: string, opts?: { leadId?: string; days?: number }) {
  const where: Record<string, unknown> = { orgId };
  if (opts?.leadId) where.leadId = opts.leadId;
  if (opts?.days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - opts.days);
    where.createdAt = { gte: cutoff };
  }

  return prisma.smsOutbound.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/**
 * Get SMS provider status.
 */
export async function getProviderStatus(orgId: string) {
  const settings = await prisma.orgSetting.findUnique({
    where: { orgId_key: { orgId, key: 'sms' } },
  });
  const cfg = (settings?.value as { provider?: string } | null) || null;

  const provider = await resolveProvider(orgId);
  return {
    provider: provider.name,
    configured: cfg?.provider !== undefined,
    providerName: cfg?.provider || 'demo',
  };
}

// ── Twilio Provider ───────────────────────────────────────

class TwilioProvider implements SmsProvider {
  readonly name = 'twilio';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async sendSms(to: string, body: string, from?: string): Promise<SmsSendResult> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const credentials = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      const formData = new URLSearchParams();
      formData.append('To', to);
      formData.append('From', from || this.fromNumber);
      formData.append('Body', body);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const data = await response.json() as any;

      if (!response.ok) {
        return { success: false, error: data.message || `HTTP ${response.status}` };
      }

      return {
        success: true,
        messageId: data.sid,
        cost: parseFloat(data.price || '0'),
      };
    } catch (err: any) {
      return { success: false, error: err.message?.slice(0, 200) || 'Twilio API error' };
    }
  }
}

// ── Textbelt Provider ─────────────────────────────────────

class TextbeltProvider implements SmsProvider {
  readonly name = 'textbelt';
  private apiKey: string;
  private fromNumber: string;

  constructor(apiKey: string, fromNumber: string) {
    this.apiKey = apiKey;
    this.fromNumber = fromNumber;
  }

  async sendSms(to: string, body: string, from?: string): Promise<SmsSendResult> {
    try {
      const response = await fetch('https://textbelt.com/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: to,
          message: body,
          key: this.apiKey,
          from: from || this.fromNumber,
        }),
      });

      const data = await response.json() as any;

      return {
        success: data.success === true,
        messageId: data.id,
        error: data.error,
      };
    } catch (err: any) {
      return { success: false, error: err.message?.slice(0, 200) || 'Textbelt API error' };
    }
  }
}

// ── Demo Provider ─────────────────────────────────────────

class DemoProvider implements SmsProvider {
  readonly name = 'demo';
  private fromNumber: string;

  constructor(fromNumber: string) {
    this.fromNumber = fromNumber;
  }

  async sendSms(to: string, body: string, from?: string): Promise<SmsSendResult> {
    console.log(`[DEMO SMS] To: ${to} | From: ${from || this.fromNumber} | Body: ${body.slice(0, 100)}...`);

    // Simulate network delay
    await new Promise(r => setTimeout(r, 50));

    return {
      success: true,
      messageId: `demo_sms_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      cost: 0,
    };
  }
}
