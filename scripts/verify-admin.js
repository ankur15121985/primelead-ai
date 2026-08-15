/* End-to-end verification of the super-admin dashboard (website handler). */
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
    jar,
  };
}

function check(name, cond, extra = '') {
  console.log(`  ${cond ? '✅' : '❌'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!cond) process.exitCode = 1;
}

(async () => {
  console.log('Super-admin dashboard — end-to-end verification\n');

  const owner = makeClient();
  console.log('1) Login as demo owner (listed in SUPER_ADMIN_EMAILS)');
  await owner.req('GET', '/auth/me');
  const login = await owner.req('POST', '/auth/login', { email: 'owner@leadflow.demo', password: 'Demo@1234' });
  check('login works', login.status === 200, `status ${login.status}`);

  console.log('\n2) /auth/me exposes isSuperAdmin');
  const me = await owner.req('GET', '/auth/me');
  check('isSuperAdmin: true for the demo owner', me.json?.data?.user?.isSuperAdmin === true);

  console.log('\n3) Overview');
  const overview = await owner.req('GET', '/admin/overview');
  check('overview returns totals', overview.status === 200, `status ${overview.status}`);
  check('organizations counted', (overview.json?.data?.totals?.organizations || 0) >= 1);
  check('users counted', (overview.json?.data?.totals?.users || 0) >= 1);
  check('org list included', Array.isArray(overview.json?.data?.organizations));
  check('recent errors array included', Array.isArray(overview.json?.data?.recentErrors));

  console.log('\n4) Organizations list');
  const orgs = await owner.req('GET', '/admin/orgs');
  const demoOrg = orgs.json?.data?.organizations?.find((o) => o.name === 'Sharma Enterprises');
  check('demo org listed', Boolean(demoOrg));
  check('org has user/lead counts', demoOrg?.users >= 1 && demoOrg?.leads >= 1, `users=${demoOrg?.users} leads=${demoOrg?.leads}`);
  check('org has pipeline value', (demoOrg?.pipelineValue || 0) >= 0);

  console.log('\n5) Org detail');
  const detail = await owner.req('GET', `/admin/orgs/${demoOrg.id}`);
  check('detail returns org', detail.status === 200 && detail.json?.data?.org?.name === 'Sharma Enterprises');
  check('team listed', detail.json?.data?.users?.length >= 1);
  check('recent leads listed', Array.isArray(detail.json?.data?.recentLeads));

  console.log('\n6) Users list');
  const users = await owner.req('GET', '/admin/users');
  check('all users across orgs', (users.json?.data?.users || []).length >= 1);
  check('user has org info', Boolean(users.json?.data?.users?.[0]?.org));

  console.log('\n7) System diagnostics');
  const system = await owner.req('GET', '/admin/system');
  check('uptime reported', system.json?.data?.uptimeSeconds >= 0);
  check('database connected', system.json?.data?.database?.connected === true);
  check('node version present', Boolean(system.json?.data?.node));

  console.log('\n8) Suspend → block login → re-activate');
  const csrfSuspend = await owner.req('GET', '/auth/me');
  const token = owner.jar.get('lf_csrf') || '';
  const suspended = await owner.req('PATCH', `/admin/orgs/${demoOrg.id}`, { status: 'SUSPENDED' });
  check('suspend succeeds', suspended.status === 200 && suspended.json?.data?.org?.status === 'SUSPENDED');

  // A regular user of the suspended org is blocked…
  const stranger = makeClient();
  await stranger.req('GET', '/auth/me');
  const blocked = await stranger.req('POST', '/auth/login', { email: 'karan@leadflow.demo', password: 'Demo@1234' });
  check('regular user of suspended org cannot log in', blocked.status === 403, `status ${blocked.status}`);

  // …while the super-admin still can (never locked out of the admin panel)
  const stranger2 = makeClient();
  await stranger2.req('GET', '/auth/me');
  const adminStillIn = await stranger2.req('POST', '/auth/login', { email: 'owner@leadflow.demo', password: 'Demo@1234' });
  check('super-admin can still log in while org suspended', adminStillIn.status === 200, `status ${adminStillIn.status}`);

  await owner.req('GET', '/auth/me'); // fresh CSRF (rotated on every /me)
  const reactivated = await owner.req('PATCH', `/admin/orgs/${demoOrg.id}`, { status: 'ACTIVE' });
  check('re-activate succeeds (super-admin never locked out)', reactivated.status === 200 && reactivated.json?.data?.org?.status === 'ACTIVE');

  console.log('\n9) Access control — a normal user is blocked');
  const normal = makeClient();
  const stamp = Date.now() % 1000000;
  await normal.req('GET', '/auth/me');
  const signup = await normal.req('POST', '/auth/signup', {
    name: 'Normal Person', email: `normal${stamp}@test.com`, password: 'StrongPass123', orgName: `Normal Co ${stamp}`,
  });
  check('normal user signs up', signup.status === 201);
  const denied = await normal.req('GET', '/admin/overview');
  check('normal user gets 403', denied.status === 403, `status ${denied.status}`);
  check('error code is FORBIDDEN', denied.json?.error?.code === 'FORBIDDEN');

  console.log(`\n${process.exitCode ? 'SOME CHECKS FAILED' : 'ALL CHECKS PASSED ✅'}`);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
