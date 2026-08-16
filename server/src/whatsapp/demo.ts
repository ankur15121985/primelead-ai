/**
 * Demo WhatsApp provider — active when no real Meta credentials exist.
 *
 * Honest simulation: outbound sends succeed immediately with a generated
 * message id, and inbound messages are driven by the demo simulator through
 * the exact same message service the real webhook uses. Nothing pretends to
 * call the WhatsApp Business Platform.
 */
import type { SendResult, WaInboundEvent, WhatsAppProvider } from './provider';

function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export const demoProvider: WhatsAppProvider = {
  name: 'demo',
  configured: false,

  async sendText(): Promise<SendResult> {
    return { waMessageId: genId('wamid') };
  },

  async sendTemplate(): Promise<SendResult> {
    return { waMessageId: genId('wamid') };
  },

  parseWebhook(): { valid: boolean; events?: WaInboundEvent[]; error?: string } {
    // The demo provider has no webhook — the authenticated simulator calls the
    // service directly. Parsing a raw webhook here would fake Meta behavior.
    return { valid: false, error: 'demo provider has no webhook; use POST /api/whatsapp/demo/inbound to simulate' };
  },

  verifyWebhook(): { valid: boolean; challenge?: string } {
    return { valid: false };
  },
};
