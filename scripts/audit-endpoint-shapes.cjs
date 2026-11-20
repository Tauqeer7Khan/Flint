const http = require('http');

async function login() {
  const postData = JSON.stringify({ email: 'admin@flint.dev', password: 'flint123' });
  return new Promise((resolve, reject) => {
    const req = http.request(
      'http://localhost:4000/auth/login',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          const rawCookie = res.headers['set-cookie'];
          let cookie = '';
          if (rawCookie) {
            cookie = rawCookie.map((c) => c.split(';')[0]).join('; ');
          }
          resolve({ cookie });
        });
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function getEndpoint(path, cookie) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `http://localhost:4000${path}`,
      {
        method: 'GET',
        headers: {
          'Cookie': cookie,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, raw: data.slice(0, 100) });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function describeShape(data) {
  if (Array.isArray(data)) {
    return 'Array (`[]`)';
  }
  if (data && typeof data === 'object') {
    const keys = Object.keys(data);
    if ('items' in data && Array.isArray(data.items)) {
      return `{ items: Array, total, page, limit }`;
    }
    if ('data' in data && Array.isArray(data.data)) {
      return `{ data: Array }`;
    }
    return `{ ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''} }`;
  }
  return typeof data;
}

async function main() {
  const { cookie } = await login();
  console.log('Logged in successfully. Cookie:', cookie ? 'PRESENT' : 'MISSING');

  const endpoints = [
    '/users',
    '/accounts',
    '/contacts',
    '/leads',
    '/deals',
    '/tickets',
    '/tasks',
    '/products',
    '/pipeline/stages',
    '/workflows',
    '/workflows/runs',
    '/notifications',
    '/activities',
    '/search?q=test',
    '/audit-logs',
  ];

  console.log('| Endpoint | Status | Top-level Shape | Keys / Notes |');
  console.log('|---|---|---|---|');

  for (const ep of endpoints) {
    const res = await getEndpoint(ep, cookie);
    const shape = describeShape(res.data);
    const keys = res.data && typeof res.data === 'object' && !Array.isArray(res.data) 
      ? Object.keys(res.data).join(', ')
      : `length: ${Array.isArray(res.data) ? res.data.length : 'N/A'}`;
    console.log(`| \`${ep}\` | ${res.status} | \`${shape}\` | ${keys} |`);
  }
}

main().catch(console.error);
