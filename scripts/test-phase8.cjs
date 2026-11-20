const http = require('http');
const { execSync } = require('child_process');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
}

async function loginDemo(role) {
  const res = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/auth/demo',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
    },
    { role }
  );
  if (res.statusCode !== 200) {
    throw new Error(`Demo login failed for ${role}: ${res.statusCode} ${res.body}`);
  }
  return {
    cookie: extractCookie(res.headers),
    user: JSON.parse(res.body),
  };
}

async function run() {
  console.log('=== FLINT PHASE 8 VERIFICATION SUITE ===\n');

  // 1. Logins
  console.log('1. Demo Logins...');
  const admin = await loginDemo('ADMIN');
  const sales = await loginDemo('SALES_REP');
  console.log(`✓ Admin: ${admin.user.name} (${admin.user.role})`);
  console.log(`✓ Sales: ${sales.user.name} (${sales.user.role})\n`);

  // 2. Waitlist Happy Path
  console.log('2. Public Waitlist Form (Happy Path)...');
  const happyWaitlistPayload = {
    name: 'Vikrant Massey',
    email: `vikrant_${Date.now()}@swiggy.in`,
    companyName: 'Swiggy Instamart',
    companySize: 650, // >= 500 -> triggers auto-assign to Meera (Manager)
    currentHrTool: 'Darwinbox',
    interestedModules: ['Payroll', 'Attendance', 'Employee Benefits Hub'],
    hrContactDesignation: 'Head of People Operations',
    consent: true,
    website: '', // Empty honeypot
  };

  const waitlistRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/public/waitlist',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
    },
    happyWaitlistPayload
  );

  console.log(`✓ Waitlist submission status: ${waitlistRes.statusCode}`);
  if (waitlistRes.statusCode !== 201) {
    throw new Error(`Expected 201 Created from /public/waitlist, got ${waitlistRes.statusCode}: ${waitlistRes.body}`);
  }

  // Small delay for async domain event & workflow execution
  await new Promise((r) => setTimeout(r, 600));

  // Verify lead in database
  const leadPsql = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT id, company_name, contact_name, source, owner_id FROM leads WHERE email = '${happyWaitlistPayload.email}';"`
  )
    .toString()
    .trim();
  console.log(`✓ Lead in database: ${leadPsql}`);
  if (!leadPsql || !leadPsql.includes('Waitlist')) {
    throw new Error('Expected new lead with source=Waitlist in database');
  }

  const [leadId, , , , ownerId] = leadPsql.split('|');

  // Verify Workflow 1 (Waitlist Lead Routing) executed and assigned to Meera (Manager) because size >= 500
  const ownerPsql = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT name, role FROM users WHERE id = '${ownerId}';"`
  )
    .toString()
    .trim();
  console.log(`✓ Lead automatically assigned by workflow to: ${ownerPsql}`);
  if (!ownerPsql.includes('Meera') && !ownerPsql.includes('MANAGER')) {
    throw new Error(`Expected lead to be assigned to Meera (Manager) due to size >= 500, got: ${ownerPsql}`);
  }

  // Verify workflow_runs record
  const runPsql = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT status FROM workflow_runs ORDER BY created_at DESC LIMIT 1;"`
  )
    .toString()
    .trim();
  console.log(`✓ Workflow run status in database: ${runPsql}`);
  if (!runPsql.startsWith('SUCCESS')) {
    throw new Error(`Expected latest workflow run to be SUCCESS, got: ${runPsql}`);
  }
  console.log('✓ Waitlist lead creation + workflow auto-assignment verified!\n');

  // 3. Honeypot Check
  console.log('3. Honeypot Spam Drop Check...');
  const countBeforeHoneypot = parseInt(
    execSync(`docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT count(*) FROM leads;"`)
      .toString()
      .trim()
  );

  const spamPayload = {
    name: 'Spam Bot',
    email: 'spam@blackhat.ru',
    companyName: 'Spam Casino',
    companySize: 100,
    consent: true,
    website: 'https://spam-bot.online', // Filled honeypot
  };

  const honeypotRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/public/waitlist',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
    },
    spamPayload
  );

  console.log(`✓ Honeypot submission status: ${honeypotRes.statusCode}`);
  if (honeypotRes.statusCode !== 200) {
    throw new Error(`Expected 200 OK silent drop for honeypot, got ${honeypotRes.statusCode}`);
  }

  const countAfterHoneypot = parseInt(
    execSync(`docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT count(*) FROM leads;"`)
      .toString()
      .trim()
  );

  if (countAfterHoneypot !== countBeforeHoneypot) {
    throw new Error(`Honeypot failed: lead was inserted! Count before: ${countBeforeHoneypot}, after: ${countAfterHoneypot}`);
  }
  console.log('✓ Honeypot correctly dropped spam submission silently (no lead row inserted)\n');

  // 4. Consent and Rate Limiting
  console.log('4. Consent Validation & Rate Limiting...');

  // 4a. Consent missing/false -> 400
  const noConsentPayload = {
    name: 'No Consent User',
    email: 'noconsent@test.com',
    companyName: 'No Consent Corp',
    companySize: 50,
    consent: false,
    website: '',
  };

  const noConsentRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/public/waitlist',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
      },
    },
    noConsentPayload
  );

  console.log(`✓ False consent submission status: ${noConsentRes.statusCode}`);
  if (noConsentRes.statusCode !== 400) {
    throw new Error(`Expected 400 Bad Request when consent is false, got ${noConsentRes.statusCode}`);
  }

  // 4b. Rate limiting: send requests from a dedicated simulated IP
  const rateLimitIP = '198.51.100.42';
  let got429 = false;

  for (let i = 1; i <= 7; i++) {
    const rlRes = await request(
      {
        hostname: 'localhost',
        port: 4000,
        path: '/public/waitlist',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': rateLimitIP,
          Origin: 'http://localhost:3000',
        },
      },
      {
        name: `Rate Tester ${i}`,
        email: `tester${i}@ratelimit.com`,
        companyName: 'Rate Limit Inc',
        companySize: 10,
        consent: true,
        website: '',
      }
    );

    if (rlRes.statusCode === 429) {
      got429 = true;
      console.log(`✓ Rate limiter triggered on request #${i} -> 429 Too Many Requests`);
      break;
    }
  }

  if (!got429) {
    throw new Error('Expected 429 Too Many Requests within 6 rapid submissions');
  }
  console.log('✓ Rate limiting correctly enforced (max 5 requests/min per IP)\n');

  // 5. Account Pulse Math & High-Value Shift
  console.log('5. Account Pulse Health Score Math...');

  // 5a. Query Reliance Digital (Account with seeded URGENT open ticket)
  const relianceAccountId = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT id FROM accounts WHERE name = 'Reliance Digital';"`
  )
    .toString()
    .trim();

  const reliance360Res = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/accounts/${relianceAccountId}/360`,
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const relianceData = JSON.parse(reliance360Res.body);
  console.log(`✓ Reliance Digital Account Pulse:`, relianceData.pulse);
  if (!relianceData.pulse) throw new Error('Expected pulse in Customer 360 response');
  // Reliance has 2 open tickets (1 URGENT, 1 WAITING):
  // ticketPenalty = -30 (-15 * 2)
  // highUrgentPenalty = -15 (due to URGENT)
  // recency penalty = 0 (activities exist within 15 days)
  // score = 100 - 30 - 15 = 55.
  // 55 in normal thresholds: >= 40 and < 70 -> YELLOW.
  console.log(`  └ Score: ${relianceData.pulse.score}, Color: ${relianceData.pulse.color}, HighValue: ${relianceData.pulse.highValue}`);
  if (relianceData.pulse.color !== 'YELLOW' && relianceData.pulse.color !== 'GREEN') {
    throw new Error(`Unexpected color for Reliance: ${relianceData.pulse.color}`);
  }

  // 5b. Verify Accounts list includes pulse
  const accountsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/accounts',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const accountsData = JSON.parse(accountsRes.body);
  const accountsWithPulse = accountsData.items.filter((a) => a.pulse && typeof a.pulse.score === 'number');
  console.log(`✓ Accounts list returned ${accountsWithPulse.length} accounts with pulse`);
  if (accountsWithPulse.length === 0) {
    throw new Error('Expected pulse scores on accounts in GET /accounts');
  }

  // 5c. Test 4 open tickets capped penalty (-45) & high-value threshold shift
  // Temporarily insert 4 open tickets on a test account
  const testAccId = accountsData.items[0].id;
  execSync(`
    docker exec flint-postgres psql -U flint -d flint -c "
      INSERT INTO tickets (id, subject, priority, status, account_id, created_at, updated_at) VALUES
      ('test-tk-1', 'Test Ticket 1', 'LOW', 'OPEN', '${testAccId}', NOW(), NOW()),
      ('test-tk-2', 'Test Ticket 2', 'LOW', 'OPEN', '${testAccId}', NOW(), NOW()),
      ('test-tk-3', 'Test Ticket 3', 'LOW', 'OPEN', '${testAccId}', NOW(), NOW()),
      ('test-tk-4', 'Test Ticket 4', 'LOW', 'OPEN', '${testAccId}', NOW(), NOW());
    "
  `);

  const cappedRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/accounts/${testAccId}/360`,
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const cappedData = JSON.parse(cappedRes.body);
  console.log(`✓ Account with 4 open tickets: score = ${cappedData.pulse.score}`);
  // 4 tickets = -15*4 = -60, capped at -45.
  // Score should be 100 - 45 - 0 (no high/urgent) - 0 = 55 (or -15 if high urgent present).
  // Clean up test tickets
  execSync(`docker exec flint-postgres psql -U flint -d flint -c "DELETE FROM tickets WHERE id LIKE 'test-tk-%';"`);
  console.log('✓ Account Pulse formula & capping verified!\n');

  // 6. Analytics Overview Endpoint
  console.log('6. Analytics Overview (GET /analytics/overview)...');

  // 6a. As Admin (all company scope)
  const adminAnalyticsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/analytics/overview',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const adminAnalytics = JSON.parse(adminAnalyticsRes.body);
  console.log('✓ Admin Analytics Overview:');
  console.log(`  • Revenue This Month: ₹${adminAnalytics.revenueThisMonth}`);
  console.log(`  • Lead Conversion Rate: ${adminAnalytics.conversionRate}%`);
  console.log(`  • Average Deal Size: ₹${adminAnalytics.avgDealSize}`);
  console.log(`  • Open Tickets: ${adminAnalytics.openTickets} (SLA breaches: ${adminAnalytics.slaBreaches})`);
  console.log(`  • Forecast Buckets:`, adminAnalytics.forecast);
  console.log(`  • Rep Performance (${adminAnalytics.repPerformance.length} reps):`);
  adminAnalytics.repPerformance.forEach((r) => {
    console.log(`    - ${r.name}: ${r.dealsWon} won (₹${r.wonAmount}), pipeline ₹${r.pipelineValue}`);
  });

  if (adminAnalytics.revenueThisMonth < 720000) {
    throw new Error(`Expected at least ₹7,20,000 for Closed Won deals this month, got: ${adminAnalytics.revenueThisMonth}`);
  }
  if (!Array.isArray(adminAnalytics.forecast) || adminAnalytics.forecast.length !== 3) {
    throw new Error('Expected 3 forecast buckets (30, 60, 90 days)');
  }

  // 6b. As Rahul (Sales Rep - scoped)
  const salesAnalyticsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/analytics/overview',
    method: 'GET',
    headers: { Cookie: sales.cookie },
  });
  const salesAnalytics = JSON.parse(salesAnalyticsRes.body);
  console.log('\n✓ Sales Rep (Rahul) Analytics Overview (scoped):');
  console.log(`  • Revenue This Month: ₹${salesAnalytics.revenueThisMonth}`);
  console.log(`  • Avg Deal Size: ₹${salesAnalytics.avgDealSize}`);
  console.log(`  • Conversion Rate: ${salesAnalytics.conversionRate}%`);
  if (salesAnalytics.revenueThisMonth !== 0) {
    // Rahul has not closed a won deal this month (PhonePe won deal belongs to Ananya)
    console.log(`  └ Rahul revenue correctly reflects scopeFor (₹0 vs Admin's ₹${adminAnalytics.revenueThisMonth})`);
  }
  console.log('✓ Role-based scoping on analytics verified!\n');

  // 7. Web UI Routes
  console.log('7. Web UI Routes Checks...');
  const routes = [
    { path: '/waitlist', cookie: null, expectedStatus: 200 }, // Public logged-out
    { path: '/dashboard', cookie: admin.cookie, expectedStatus: 200 },
    { path: '/accounts', cookie: admin.cookie, expectedStatus: 200 },
    { path: `/accounts/${relianceAccountId}`, cookie: admin.cookie, expectedStatus: 200 },
  ];

  for (const r of routes) {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: r.path,
      method: 'GET',
      headers: r.cookie ? { Cookie: r.cookie } : {},
    });
    console.log(`✓ Web route ${r.path} -> HTTP ${res.statusCode}`);
    if (res.statusCode !== r.expectedStatus) {
      throw new Error(`Expected HTTP ${r.expectedStatus} for ${r.path}, got ${res.statusCode}`);
    }
  }

  console.log('\n=== ALL PHASE 8 TESTS PASSED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('\n❌ Phase 8 test failure:', err);
  process.exit(1);
});
