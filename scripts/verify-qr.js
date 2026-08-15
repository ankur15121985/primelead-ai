/* End-to-end QR lead capture verification: login → create QR → public form → lead in CRM. */
const BASE = 'http://localhost:4000/api';

function makeClient() {
  const jar = new Map();
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
    return jar.get('lf_csrf') || '';
  }
  return {
    async req(method, path, body) {
      const headers = { cookie: cookieHeader() };
      let payload;
      if (body !== undefined) {
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
    },
    csrf,
  };
}

function check(name, cond, extra = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  console.log('QR lead capture — end-to-end verification\n');

  // ── Owner session ─────────────────────────────────────────────
  const owner = makeClient();
  console.log('1) Login as demo owner');
  await owner.req('GET', '/auth/me'); // prime CSRF cookie like a page load
  const login = await owner.req('POST', '/auth/login', { email: 'owner@leadflow.demo', password: 'Demo@1234' });
  check('login works', login.status === 200, `status ${login.status}`);

  console.log('\n2) Create a QR code');
  const created = await owner.req('POST', '/qr-codes', {
    title: 'Verify Counter',
    campaignName: 'Verify Campaign',
    fields: ['name', 'phone', 'email', 'message'],
  });
  check('QR created', created.status === 201, `status ${created.status}`);
  const qr = created.json?.data?.qrCode;
  check('has slug', Boolean(qr?.slug));
  check('has QR image (png data url)', (qr?.image || '').startsWith('data:image/png'));
  check('URL points at public form', (qr?.url || '').includes('/r/'));
  check('campaign created', qr?.campaign?.name === 'Verify Campaign');

  console.log('\n3) Public form meta (counts a scan)');
  const anon = makeClient();
  const meta = await anon.req('GET', `/public/qr/${qr.slug}`);
  check('meta fetch works', meta.status === 200, `status ${meta.status}`);
  check('title matches', meta.json?.data?.title === 'Verify Counter');
  check('org name shown', meta.json?.data?.orgName === 'Sharma Enterprises');
  check('fields listed', Array.isArray(meta.json?.data?.fields) && meta.json.data.fields.length >= 3);

  console.log('\n4) Public lead submission (fresh phone browser)');
  const phone = makeClient();
  await phone.req('GET', `/public/qr/${qr.slug}`); // page load primes CSRF on the phone
  // Unique per run so re-running the script never collides with earlier runs.
  const stamp = Date.now() % 1000000;
  const unique = `97${String(stamp).padStart(6, '0')}${Math.floor(10 + Math.random() * 89)}`;
  const submit = await phone.req('POST', `/public/qr/${qr.slug}/lead`, {
    name: 'Qr Flow Tester',
    phone: unique,
    email: `qrflow${stamp}@example.com`,
    message: 'Interested in your services.',
  });
  check('lead accepted', submit.status === 201, `status ${submit.status}`);
  check('received: true', submit.json?.data?.received === true);

  console.log('\n5) Verify in CRM');
  const search = await owner.req('GET', `/leads?search=${encodeURIComponent('Qr Flow Tester')}`);
  const lead = search.json?.data?.rows?.[0];
  check('lead exists in CRM', Boolean(lead));
  check('source = QR', lead?.source === 'QR');
  check('auto-assigned to a salesperson', Boolean(lead?.ownerId));

  console.log('\n6) Counts updated');
  const list = await owner.req('GET', '/qr-codes');
  const updated = list.json?.data?.qrCodes?.find((q) => q.slug === qr.slug);
  // Repeat page views from the same IP within 30 min are deduped (anti-inflation),
  // so scanCount may be 1 when the script runs twice in quick succession.
  check('scanCount tracked', (updated?.scanCount || 0) >= 1, `scans=${updated?.scanCount}`);
  check('leadCount incremented', (updated?.leadCount || 0) >= 1, `leads=${updated?.leadCount}`);

  console.log('\n7) Duplicate phone acknowledged (not a hard error)');
  const phone2 = makeClient();
  await phone2.req('GET', `/public/qr/${qr.slug}`);
  const dup = await phone2.req('POST', `/public/qr/${qr.slug}/lead`, { name: 'Dup', phone: unique });
  check('duplicate returns 200 + duplicate flag', dup.status === 200 && dup.json?.data?.duplicate === true, `status ${dup.status}`);

  console.log(`\n${process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED ✅'}`);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
