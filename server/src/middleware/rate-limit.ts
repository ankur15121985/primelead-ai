import rateLimit from 'express-rate-limit';
import { tooMany } from '../lib/http';

/**
 * Login throttling — 5 attempts per 10 minutes per IP by default.
 * Overridable via LOGIN_RATE_LIMIT (tests raise it to avoid cross-test noise).
 */
export const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.LOGIN_RATE_LIMIT || 5),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res) => {
    throw tooMany('Too many sign-in attempts. Please wait a few minutes and try again.');
  },
});

/** Global API limiter per IP. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res) => {
    throw tooMany();
  },
});

/** Inbound webhook limiter — 120 calls per 10 minutes per IP (leads are precious). */
export const webhookLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res) => {
    throw tooMany('Too many webhook calls. Check your source configuration.');
  },
});

/** Public QR lead-form limiter — 15 submissions per hour per IP. */
export const publicLeadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, _res) => {
    throw tooMany('Too many submissions from this device. Please try again later.');
  },
});
