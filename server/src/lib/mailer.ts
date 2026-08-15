import nodemailer from 'nodemailer';
import { config } from '../config';

/**
 * Mailer abstraction. When SMTP is configured it sends real email;
 * otherwise messages are printed to the server console so the whole
 * flow (verification, password reset) works in local development.
 */
type MailInput = { to: string; subject: string; html: string; text?: string };

function makeTransport() {
  if (!config.smtp.host) return null;
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

const transport = makeTransport();

export async function sendMail({ to, subject, html, text }: MailInput): Promise<void> {
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log('\n────────────────────────────────────────────');
    console.log(`📧 [DEV EMAIL] To: ${to}`);
    console.log(`   Subject: ${subject}`);
    console.log('   Body:');
    console.log(`   ${(html || text || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    console.log('────────────────────────────────────────────\n');
    return;
  }
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]+>/g, ' '),
  });
}

export function layoutMail(title: string, contentHtml: string): string {
  return `
  <div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <div style="font-size:20px;font-weight:800;color:#0f172a">PRIMELEAD <span style="color:#6366f1">AI</span></div>
    <h1 style="font-size:18px;color:#0f172a;margin:20px 0 8px">${title}</h1>
    <div style="color:#475569;line-height:1.6;font-size:14px">${contentHtml}</div>
    <p style="color:#94a3b8;font-size:12px;margin-top:28px">You received this because you use PRIMELEAD AI. If this wasn't you, you can safely ignore this email.</p>
  </div>`;
}
