// usage: node scripts/measure-routes.cjs <label>
// Doubles as a warm-up script: run it once after starting the server.
const BASE = process.env.WEB_URL || 'http://localhost:3000';
const label = process.argv[2] || 'run';

async function hit(path, cookie) {
  const t0 = performance.now();
  const res = await fetch(BASE + path, { redirect: 'manual', headers: cookie ? { cookie } : {} });
  const body = await res.arrayBuffer();
  return {
    status: res.status,
    bytes: body.byteLength,
    ms: Math.round(performance.now() - t0),
    loc: res.headers.get('location') || '',
  };
}

(async () => {
  const login = await fetch(BASE + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: 'admin@flint.dev', password: 'flint123' }),
  });
  if (!login.ok) { console.error('LOGIN FAILED', login.status, await login.text()); process.exit(1); }
  const cookie = login.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');

  const list = async (p) => {
    const r = await fetch(BASE + p, { headers: { cookie } });
    const j = await r.json();
    return Array.isArray(j) ? j : j.data || j.items || [];
  };
  const deals = await list('/api/deals');
  const accounts = await list('/api/accounts');

  const routes = ['/login', '/dashboard', '/leads', '/deals', '/accounts', '/contacts', '/tickets', '/tasks', '/workflows', '/settings'];
  if (deals[0]) routes.push('/deals/' + deals[0].id);
  if (accounts[0]) routes.push('/accounts/' + accounts[0].id);

  console.log(`\n== ${label} @ ${BASE} ==`);
  console.log('route'.padEnd(34), 'cold ms'.padStart(8), 'warm ms'.padStart(8), 'status'.padStart(7), 'bytes'.padStart(8), ' valid');
  let invalid = 0;
  for (const r of routes) {
    const ck = r === '/login' ? '' : cookie;
    const cold = await hit(r, ck);
    const warm = await hit(r, ck);
    const ok = cold.status === 200 && cold.bytes > 2000;
    if (!ok) invalid++;
    console.log(r.padEnd(34), String(cold.ms).padStart(8), String(warm.ms).padStart(8), String(cold.status).padStart(7),
      String(cold.bytes).padStart(8), ok ? ' ok' : ' INVALID ' + cold.loc);
  }
  process.exit(invalid ? 2 : 0);
})();
