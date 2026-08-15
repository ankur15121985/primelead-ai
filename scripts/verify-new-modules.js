/**
 * End-to-end verification of the Phase 5-10 modules against the running server.
 * Uses the same cookie-jar + CSRF approach as verify-funnel.js / verify-qr.js.
 */
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:4000';
const JAR = path.join(require('os').tmpdir(), 'lf-newmods-cookies.txt');

function readCookies() {
  if (!fs.existsSync(JAR)) return '';
  return fs.readFileSync(JAR, 'utf8').trim();
}
function saveCookies(res) {
  const setc = res.headers.getSetCookie ? res.headers.getSetCookie() : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  if (!setc || !setc.length) return;
  const jar = (readCookies() ? readCookies() + '\n' : '') + setc.map((c) => c.split(';')[0]).join('\n');
  fs.writeFileSync(JAR, jar);
}
function cookieHeader() {
  const lines = readCookies().split('\n').filter(Boolean);
  const seen = new Map();
  for (const l of lines) {
    const [k, ...rest] = l.split('=');
    seen.set(k, [k, ...rest].join('='));
  }
  return [...seen.values()].join('; ');
}
function csrfToken() {
  // last value wins (same dedup as cookieHeader)
  let val = '';
  for (const l of readCookies().split('\n').filter(Boolean)) {
    if (l.startsWith('lf_csrf=')) val = l.replace('lf_csrf=', '');
  }
  return val;
}

async function api(method, p, body, headers = {}) {
  const opts = { method, headers: { cookie: cookieHeader(), ...headers } };
  if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + p, opts);
  saveCookies(res);
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json, headers: res.headers };
}

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`);
}

async function main() {
  // start with a clean jar so stale cookies can't mismatch the CSRF token
  if (fs.existsSync(JAR)) fs.rmSync(JAR, { force: true });
  // 1) login as owner
  let r = await api('GET', '/api/auth/me');
  r = await api('POST', '/api/auth/login', { email: 'owner@leadflow.demo', password: 'Demo@1234' }, { 'x-csrf-token': csrfToken() });
  check('login as owner@leadflow.demo', r.status === 200, `status ${r.status}`);

  // 2) quotations list (seeded demo)
  r = await api('GET', '/api/quotations');
  check('list quotations (demo seeded)', r.status === 200 && r.json?.data?.quotations?.length >= 1, `count ${r.json?.data?.quotations?.length}`);

  // 3) create a quotation with GST
  r = await api('POST', '/api/quotations', {
    customerName: 'Verify Buyer', company: 'Verify Co', gstin: '27ABCDE1234F1Z5',
    items: [
      { description: 'Service package', quantity: 2, rate: 5000, taxPct: 18 },
      { description: 'Addon', quantity: 1, rate: 1000, taxPct: 18 },
    ],
    discount: 500,
  }, { 'x-csrf-token': csrfToken() });
  const q = r.json?.data?.quotation;
  check('create quotation w/ GST calc', r.status === 201 && q?.number?.startsWith('QT-') && q?.gstSummary?.cgst > 0, `${q?.number} total ${q?.total}`);
  const qId = q?.id;

  // 4) download quotation PDF
  r = await api('GET', `/api/quotations/${qId}/pdf`);
  check('quotation PDF downloads', r.status === 200 && r.headers.get('content-type')?.includes('application/pdf'));

  // 5) mark accepted + convert to invoice
  r = await api('PATCH', `/api/quotations/${qId}`, { status: 'ACCEPTED' }, { 'x-csrf-token': csrfToken() });
  check('mark quotation accepted', r.status === 200 && r.json?.data?.quotation?.status === 'ACCEPTED');
  r = await api('POST', `/api/quotations/${qId}/convert`, {}, { 'x-csrf-token': csrfToken() });
  const invId = r.json?.data?.invoice?.id;
  check('convert to invoice', r.status === 200 && Boolean(invId), `invoice ${r.json?.data?.invoice?.number}`);

  // 6) invoices list + record payment
  r = await api('GET', '/api/invoices');
  check('list invoices', r.status === 200 && r.json?.data?.invoices?.length >= 1);
  r = await api('POST', `/api/invoices/${invId}/payment`, { paidAmount: 100 }, { 'x-csrf-token': csrfToken() });
  check('record partial payment', r.status === 200 && r.json?.data?.invoice?.paidAmount === 100, `status ${r.json?.data?.invoice?.status}`);
  r = await api('GET', `/api/invoices/${invId}/pdf`);
  check('invoice PDF downloads', r.status === 200 && r.headers.get('content-type')?.includes('application/pdf'));

  // 7) AI assistant: chat persists + not-configured fallback
  r = await api('POST', '/api/ai/chat', { message: 'How many leads this week?' }, { 'x-csrf-token': csrfToken() });
  const convId = r.json?.data?.conversationId;
  check('AI chat persists conversation', r.status === 200 && Boolean(convId) && r.json?.data?.notConfigured === true);
  r = await api('GET', `/api/ai/conversations/${convId}`);
  check('AI conversation history', r.status === 200 && r.json?.data?.conversation?.messages?.length === 2);

  // 8) integrations: connect whatsapp -> webhook -> lead
  r = await api('POST', '/api/integrations/WHATSAPP/connect', {}, { 'x-csrf-token': csrfToken() });
  const secret = r.json?.data?.integration?.webhookSecret;
  check('connect WhatsApp integration', r.status === 200 && Boolean(secret));
  const unique = `verify${Date.now().toString().slice(-5)}`;
  r = await api('POST', '/api/webhooks/whatsapp', { name: 'Webhook Verify', phone: `97555${unique}` }, { 'x-webhook-secret': secret, 'x-csrf-token': csrfToken() });
  check('webhook creates a lead', r.status === 201 && r.json?.data?.received === true);
  r = await api('POST', '/api/webhooks/whatsapp', { name: 'Bad Guy', phone: '9755500001' }, { 'x-webhook-secret': 'wrong-secret' });
  check('webhook rejects wrong secret', r.status === 401);

  // 9) reports
  r = await api('GET', '/api/reports');
  check('reports aggregate', r.status === 200 && r.json?.data?.cards?.leadsCreated >= 1 && r.json?.data?.charts?.trend?.length >= 1);
  r = await api('GET', '/api/reports/export');
  check('reports CSV export', r.status === 200 && r.headers.get('content-type')?.includes('text/csv'));

  // 10) billing
  r = await api('GET', '/api/billing');
  check('billing shows plans', r.status === 200 && r.json?.data?.plans?.length === 3 && Boolean(r.json?.data?.currentPlan));
  r = await api('POST', '/api/billing/upgrade', { planSlug: 'business', period: 'YEARLY' }, { 'x-csrf-token': csrfToken() });
  check('upgrade plan (demo mode)', r.status === 200 && r.json?.data?.applied === true && r.json?.data?.mode === 'demo');

  // 11) contacts
  r = await api('POST', '/api/contacts', { name: 'Verify Contact', phone: `97655${unique}`, company: 'Verify Co' }, { 'x-csrf-token': csrfToken() });
  check('create contact', r.status === 201 && Boolean(r.json?.data?.contact?.id));
  r = await api('GET', '/api/contacts?search=Verify');
  check('search contacts', r.status === 200 && r.json?.data?.contacts?.some((c) => c.name === 'Verify Contact'));

  // summary
  const passed = results.filter((x) => x.ok).length;
  console.log(`\n== ${passed}/${results.length} checks passed ==`);
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
