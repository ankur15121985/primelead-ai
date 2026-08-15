import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  sessionCookieName: process.env.SESSION_COOKIE_NAME || 'pl_session',
  sessionMaxAgeDays: Number(process.env.SESSION_MAX_AGE_DAYS || 7),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  // Account lock-out: after LOGIN_MAX_ATTEMPTS failed attempts the account is
  // locked for LOGIN_LOCK_MINUTES minutes. Rate limiting still applies on top.
  loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || 5),
  loginLockMinutes: Number(process.env.LOGIN_LOCK_MINUTES || 15),
  // MFA
  mfaIssuer: process.env.MFA_ISSUER || 'PRIMELEAD AI',
  mfaTokenTtlMinutes: Number(process.env.MFA_TOKEN_TTL_MINUTES || 10),
  // Billing / subscriptions
  trialDays: Number(process.env.TRIAL_DAYS || 14),
  payments: {
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    cashfreeAppId: process.env.CASHFREE_APP_ID || '',
    cashfreeSecretKey: process.env.CASHFREE_SECRET_KEY || '',
    cashfreeEnv: process.env.CASHFREE_ENV || 'sandbox',
    cashfreeWebhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || '',
    // Shared secret for the demo provider's simulated webhooks.
    webhookSecret: process.env.PAYMENT_WEBHOOK_SECRET || 'dev-payment-webhook-secret',
    successUrl: process.env.PAYMENT_SUCCESS_URL || `${process.env.APP_URL || 'http://localhost:5173'}/app/billing?status=success`,
    cancelUrl: process.env.PAYMENT_CANCEL_URL || `${process.env.APP_URL || 'http://localhost:5173'}/app/billing?status=cancelled`,
  },
  // Comma-separated emails allowed to access /api/admin (website handler / developer).
  superAdminEmails: (process.env.SUPER_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'PRIMELEAD AI <no-reply@primelead.local>',
  },
  ai: {
    provider: process.env.AI_PROVIDER || '',
    apiKey: process.env.AI_API_KEY || '',
    baseUrl: process.env.AI_BASE_URL || '',
    model: process.env.AI_MODEL || '',
  },
} as const;
