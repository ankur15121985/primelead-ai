/* Funnel smoke test: signup → onboarding(+sample data) → dashboard → leads. */
const BASE = 'http://localhost:4000/api';
const jar = new Map(); // cookies

function getCookieSet(res) {
  return (res.headers.getSetCookie ? res.headers.getSetCookie() : [])
    .concat(res.headers.get('set-cookie') ? res.headers.get('set-cookie').split('\n') : []);
}
function readCookies(res) {
  for (const c of getCookieSet(res)) {
    const pair = c.split(';')[0];
    const i = pair.indexOf('=');
    if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
}
function cookieHeader() {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}
function csrf() {
  return jar.get('pl_csrf') || '';
}

async function req(method, path, body, form) {
  const headers = { cookie: cookieHeader() };
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  if (csrf()) headers['x-csrf-token'] = csrf();
  const res = await fetch(BASE + path, { method, headers, body: payload });
  readCookies(res);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json };
}

function assert(cond, label, extra) {
  if (!cond) {
    console.log(`✗ FAIL: ${label}${extra ? ' — ' + JSON.stringify(extra).slice(0, 200) : ''}`);
    process.exitCode = 1;
  } else {
    console.log(`✓ ${label}`);
  }
}

(async () => {
  const email = `funnel${Date.now()}@test.com`;
  console.log('== 0) prime CSRF cookie (page load) ==');
  const prime = await req('GET', '/auth/me'); // 401 is fine — the middleware still issues pl_csrf
  assert(Boolean(csrf()), 'csrf cookie issued on page load');

  console.log('== 1) signup ==');
  const signup = await req('POST', '/auth/signup', {
    name: 'Funnel Tester', email, password: 'StrongPass123', orgName: 'Funnel Traders', businessType: 'RETAIL',
  });
  assert(signup.status === 201 && signup.json.data.org.name === 'Funnel Traders', 'signup creates org + owner', signup.json);

  console.log('== 2) me ==');
  const me = await req('GET', '/auth/me');
  assert(me.status === 200 && me.json.data.user.role === 'OWNER', 'me returns owner session');

  console.log('== 3) onboarding with sample data ==');
  const onboard = await req('POST', '/auth/onboarding', { businessType: 'RETAIL', addSampleData: true });
  assert(onboard.status === 200 && onboard.json.data.sampleCount > 0, `sample data seeded (${onboard.json?.data?.sampleCount} leads)`);

  console.log('== 4) dashboard ==');
  const dash = await req('GET', '/dashboard');
  assert(dash.status === 200 && dash.json.data.cards.totalLeads > 0, `dashboard totalLeads = ${dash.json?.data?.cards?.totalLeads}`);
  assert(dash.json.data.cards.pipelineValue > 0, 'pipeline value > 0');
  assert(dash.json.data.lists.recentLeads.length > 0, 'recent leads list populated');

  console.log('== 5) leads list + pipeline ==');
  const leads = await req('GET', '/leads?page=1&pageSize=10');
  assert(leads.status === 200 && leads.json.data.pagination.total > 0, `leads list total = ${leads.json?.data?.pagination?.total}`);
  const pipe = await req('GET', '/pipeline');
  assert(pipe.status === 200 && pipe.json.data.stages.length === 7, 'pipeline has 7 default stages');

  console.log('== 6) create lead (dedupe + auto-assign) ==');
  const create = await req('POST', '/leads', { name: 'Walk-in Customer', phone: '9955667788', source: 'MANUAL' });
  assert(create.status === 201, 'lead created');
  const dup = await req('POST', '/leads', { name: 'Walk-in Again', phone: '9955667788' });
  assert(dup.status === 409, 'duplicate phone rejected');

  console.log('== 7) follow-up + overdue sync ==');
  const due = new Date(Date.now() + 3600e3).toISOString();
  const leadId = create.json.data.lead.id;
  const fu = await req('POST', `/leads/${leadId}/tasks`, { title: 'Call customer', kind: 'CALL', dueAt: due });
  assert(fu.status === 201, 'follow-up scheduled');
  const tasks = await req('GET', '/tasks?view=today');
  assert(tasks.json.data.tasks.some((t) => t.leadId === leadId), 'follow-up visible in today (due +1h)');

  console.log('== 8) team invite + RBAC ==');
  const invite = await req('POST', '/team', { name: 'Sales Rep', email: 'rep@test.com', role: 'SALES' });
  assert(invite.status === 201, 'team member added');

  console.log('\nFunnel verification complete.', process.exitCode ? '(with failures)' : 'ALL PASSED ✅');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
