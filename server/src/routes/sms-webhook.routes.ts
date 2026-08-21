/**
 * SMS Webhook Routes — receive delivery status callbacks from SMS providers.
 *
 * Twilio sends status callbacks to:
 *   POST /webhooks/sms/status?provider=twilio
 *
 * Statuses: queued, sent, delivered, undelivered, failed
 */
import { Router } from 'express';
import { asyncHandler, ok } from '../lib/http';
import { prisma } from '../lib/prisma';

const router = Router();

/**
 * POST /webhooks/sms/status — Twilio delivery status callback
 */
router.post(
  '/sms/status',
  asyncHandler(async (req, res) => {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage, To, From } = req.body;

    if (!MessageSid) {
      res.status(200).send('');
      return;
    }

    // Find the outbound SMS by provider message ID
    const sms = await prisma.smsOutbound.findFirst({
      where: { providerMessageId: MessageSid },
    });

    if (sms) {
      // Map Twilio status to our status
      const statusMap: Record<string, string> = {
        queued: 'QUEUED',
        sent: 'SENT',
        delivered: 'DELIVERED',
        undelivered: 'UNDELIVERABLE',
        failed: 'FAILED',
        sending: 'SENT',
        accepted: 'QUEUED',
      };

      const status = statusMap[MessageStatus] || MessageStatus;
      const updateData: Record<string, unknown> = { status };

      if (MessageStatus === 'delivered') {
        updateData.deliveredAt = new Date();
        updateData.sentAt = sms.sentAt || new Date();
      }
      if (MessageStatus === 'sent') {
        updateData.sentAt = new Date();
      }
      if (ErrorCode) {
        updateData.error = `Code ${ErrorCode}: ${ErrorMessage || 'Unknown error'}`;
      }

      await prisma.smsOutbound.update({
        where: { id: sms.id },
        data: updateData,
      });

      console.log(`[SMS Status] ${MessageSid}: ${MessageStatus} → ${status}`);
    }

    // Twilio expects empty 200 response
    res.status(200).type('text/plain').send('');
  })
);

/**
 * POST /webhooks/sms/delivery — generic delivery receipt
 */
router.post(
  '/sms/delivery',
  asyncHandler(async (req, res) => {
    const { messageId, status, timestamp } = req.body;

    if (!messageId) {
      res.status(200).json({ ok: true });
      return;
    }

    const sms = await prisma.smsOutbound.findFirst({
      where: { providerMessageId: messageId },
    });

    if (sms) {
      const updateData: Record<string, unknown> = {};
      if (status === 'delivered') {
        updateData.status = 'DELIVERED';
        updateData.deliveredAt = timestamp ? new Date(timestamp) : new Date();
      } else if (status === 'failed') {
        updateData.status = 'FAILED';
        updateData.error = req.body.error || 'Delivery failed';
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.smsOutbound.update({
          where: { id: sms.id },
          data: updateData,
        });
      }
    }

    res.status(200).json({ ok: true });
  })
);

export default router;
