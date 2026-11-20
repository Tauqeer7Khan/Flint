const { io } = require('socket.io-client');

async function run() {
  console.log('=== 1. Checking Login Page HTML ===');
  const loginRes = await fetch('http://localhost:3000/login');
  const loginHtml = await loginRes.text();
  console.log('Login Page Status:', loginRes.status);
  console.log('Contains "Sign in to FLINT":', loginHtml.includes('Sign in to FLINT'));
  console.log('Contains "ecg-path":', loginHtml.includes('ecg-path'));
  console.log('Contains "Demo as Support":', loginHtml.includes('Demo as Support'));
  console.log('Contains "Demo as Admin":', loginHtml.includes('Demo as Admin'));

  console.log('\n=== 2. Logging in as Demo Support Agent ===');
  const demoRes = await fetch('http://localhost:3000/api/auth/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'SUPPORT_AGENT' }),
  });
  const rawCookie = demoRes.headers.get('set-cookie');
  const cookieVal = rawCookie.split(';')[0];
  const user = await demoRes.json();
  console.log('Demo Login Status:', demoRes.status);
  console.log('Logged in user:', user);
  console.log('Cookie received:', !!cookieVal);

  console.log('\n=== 3. Checking Dashboard Page HTML with Session Cookie ===');
  const dashRes = await fetch('http://localhost:3000/dashboard', {
    headers: { Cookie: cookieVal },
  });
  const dashHtml = await dashRes.text();
  console.log('Dashboard Status:', dashRes.status);
  console.log('Contains user name "Priya Nair":', dashHtml.includes('Priya Nair'));
  console.log('Contains "Support Agent":', dashHtml.includes('Support Agent'));
  console.log('Contains "Leads" nav item:', dashHtml.includes('Leads'));
  console.log('Contains "Deals" nav item:', dashHtml.includes('Deals'));

  console.log('\n=== 4. Testing Socket Connection ===');
  const tokenRes = await fetch('http://localhost:3000/api/auth/socket-token', {
    headers: { Cookie: cookieVal },
  });
  const { token } = await tokenRes.json();
  console.log('Received socket token:', !!token);

  await new Promise((resolve, reject) => {
    const socket = io('http://localhost:4000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket client connected! Socket ID:', socket.id);
      setTimeout(() => {
        socket.disconnect();
        resolve();
      }, 500);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
      reject(err);
    });
  });

  console.log('\n=== 5. Navigating to Placeholder Page (/leads) ===');
  const leadsRes = await fetch('http://localhost:3000/leads', {
    headers: { Cookie: cookieVal },
  });
  const leadsHtml = await leadsRes.text();
  console.log('Leads Page Status:', leadsRes.status);
  console.log('Contains "Leads Hub":', leadsHtml.includes('Leads Hub'));
  console.log('Contains "Phase 2: Core Data Hub":', leadsHtml.includes('Phase 2: Core Data Hub'));

  console.log('\n=== 6. Logging out ===');
  const logoutRes = await fetch('http://localhost:3000/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookieVal },
  });
  console.log('Logout Status:', logoutRes.status);
  const clearedCookie = logoutRes.headers.get('set-cookie');
  console.log('Cleared cookie header:', clearedCookie);

  console.log('\n=== 7. Accessing Dashboard after Logout ===');
  const postLogoutRes = await fetch('http://localhost:3000/dashboard', {
    redirect: 'manual',
  });
  console.log('Dashboard Status without cookie:', postLogoutRes.status);
  console.log('Redirect location:', postLogoutRes.headers.get('location'));
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
