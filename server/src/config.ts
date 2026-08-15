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
