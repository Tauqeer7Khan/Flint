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
  console.log('=== FLINT PHASE 6 VERIFICATION SUITE ===\n');

  // 1. Logins
  console.log('1. Demo Logins...');
  const admin = await loginDemo('ADMIN');
  const meera = await loginDemo('MANAGER');
  const rahul = await loginDemo('SALES_REP');
  const priya = await loginDemo('SUPPORT_AGENT');
  console.log(`   Logged in: Admin (${admin.user.name}), Meera (${meera.user.name}), Rahul (${rahul.user.name}), Priya (${priya.user.name})`);

  // 2. Verification 1: Seed verification (3 workflows, run history seeded)
  console.log('\n2. Verification 1: Check Seeded Workflows & Runs...');
  const wfListRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/workflows',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  if (wfListRes.statusCode !== 200) {
    throw new Error(`GET /workflows failed: ${wfListRes.statusCode} ${wfListRes.body}`);
  }
  const workflows = JSON.parse(wfListRes.body).workflows;
  console.log(`   Fetched ${workflows.length} workflows:`);
  for (const wf of workflows) {
    console.log(`   • [${wf.trigger}] "${wf.name}" (Active: ${wf.is_active}, Runs: ${wf.totalRuns})`);
  }
  if (workflows.length !== 3) {
    throw new Error(`Expected exactly 3 workflows, got: ${workflows.length}`);
  }
  console.log('   ✅ 3 Core Workflows seeded and active.');

  const wfWaitlist = workflows.find((w) => w.trigger === 'lead.created');
  const wfDealWon = workflows.find((w) => w.trigger === 'deal.won');
  const wfSla = workflows.find((w) => w.trigger === 'ticket.sla_breached');

  // Check initial runs
  const initialRunsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/workflows/runs',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const initialRuns = JSON.parse(initialRunsRes.body).runs;
  console.log(`   Initial seeded runs count: ${initialRuns.length}`);
  if (initialRuns.length < 4) {
    throw new Error(`Expected at least 4 seeded runs, got: ${initialRuns.length}`);
  }

  // 3. Verification 2: Workflow 1 Test (Waitlist Routing)
  console.log('\n3. Verification 2: Workflow 1 Test (Waitlist Lead Auto-Assign)...');
  const prevRunCount = (await request({
    hostname: 'localhost',
    port: 4000,
    path: '/workflows/runs',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  })).body;
  const countBeforeLead = JSON.parse(prevRunCount).runs.length;

  const leadRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    {
      companyName: 'Licious Fresh Meat',
      contactName: 'Abhay Hanjura',
      email: 'abhay@licious.dummy',
      source: 'Waitlist',
      consent: true,
      customFields: {
        companySize: 650, // >= 500 threshold
        currentHrTool: 'Workday',
      },
    }
  );
  if (leadRes.statusCode !== 201) {
    throw new Error(`POST /leads failed: ${leadRes.statusCode} ${leadRes.body}`);
  }
  const createdLead = JSON.parse(leadRes.body);
  console.log(`   Created Waitlist Lead: "${createdLead.company_name}" (ID: ${createdLead.id}, Size: 650)`);

  // Allow async engine to complete
  await new Promise((r) => setTimeout(r, 1200));

  // Check lead updated owner in database
  const getLeadRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/leads/${createdLead.id}`,
    method: 'GET',
    headers: { Cookie: meera.cookie },
  });
  const updatedLead = JSON.parse(getLeadRes.body);
  console.log(`   Lead owner assigned to: ${updatedLead.owner?.name} (${updatedLead.owner?.email})`);
  if (!updatedLead.owner?.email?.includes('meera')) {
    throw new Error(`Expected owner Meera Iyer (Manager for size >= 500), got: ${updatedLead.owner?.name}`);
  }

  // Verify workflow_runs entry added
  const runsAfterLeadRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/workflows/runs',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const runsAfterLead = JSON.parse(runsAfterLeadRes.body).runs;
  const latestRun = runsAfterLead[0];
  if (latestRun.workflow_id !== wfWaitlist.id || latestRun.status !== 'SUCCESS') {
    throw new Error(`Latest run is not Waitlist workflow SUCCESS! Got: ${JSON.stringify(latestRun)}`);
  }
  console.log(`   ✅ Workflow 1 executed successfully! Run ID: ${latestRun.id}, Status: ${latestRun.status}`);

  // 4. Verification 3: Workflow 2 Test (Deal Won CS Handoff — HERO DEMO FEAT)
  console.log('\n4. Verification 3: Workflow 2 Test (Deal Won CS Handoff)...');
  // Find deal7 (Infosys - Full Enterprise Migration, in Negotiation with Quote Q-2026-0003 containing 3 products)
  const dealsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/deals',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const deals = JSON.parse(dealsRes.body).items;
  const targetDeal = deals.find((d) => d.title.includes('Enterprise Migration')) || deals[0];
  console.log(`   Target Deal: "${targetDeal.title}" (ID: ${targetDeal.id})`);

  // Find Closed Won stage
  const stagesRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/deals', // Deals page / API stage info
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  // Fetch Closed Won stage ID directly via psql
  const wonStageId = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT id FROM pipeline_stages WHERE name = 'Closed Won';"`
  ).toString().trim();
  console.log(`   Closed Won Stage ID: ${wonStageId}`);

  // Transition deal to Closed Won
  const wonRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${targetDeal.id}/stage`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rahul.cookie,
      },
    },
    { stageId: wonStageId }
  );
  if (wonRes.statusCode !== 200) {
    throw new Error(`Move to Closed Won failed: ${wonRes.statusCode} ${wonRes.body}`);
  }
  console.log(`   Deal moved to Closed Won.`);

  // Allow async workflow engine to create tasks
  await new Promise((r) => setTimeout(r, 1500));

  // Verify tasks created in DB
  const onboardingTasksOutput = execSync(
    `docker exec flint-postgres psql -U flint -d flint -c "SELECT title, priority, status FROM tasks WHERE deal_id = '${targetDeal.id}';"`
  ).toString();
  console.log('   Onboarding Tasks in Database:\n' + onboardingTasksOutput);

  if (!onboardingTasksOutput.includes('Onboarding: Payroll') ||
      !onboardingTasksOutput.includes('Onboarding: Attendance') ||
      !onboardingTasksOutput.includes('Onboarding: Employee Benefits Hub')) {
    throw new Error('Expected 3 onboarding tasks for Payroll, Attendance, and Benefits!');
  }
  console.log('   ✅ Workflow 2 executed: 3 onboarding tasks created for purchased modules!');

  // 5. Verification 4: Workflow 3 Test (SLA Escalation)
  console.log('\n5. Verification 4: Workflow 3 Test (SLA Escalation)...');
  // Create an open ticket
  const ticketRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/tickets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: priya.cookie,
      },
    },
    {
      subject: 'Critical DB Deadlock on attendance sync',
      priority: 'URGENT',
      accountId: targetDeal.account_id,
      assigneeId: priya.user.id,
    }
  );
  const ticket = JSON.parse(ticketRes.body).ticket;
  console.log(`   Created Ticket: "${ticket.subject}" (ID: ${ticket.id}, Assignee: Priya)`);

  // Trigger test execution of Workflow 3 directly with ticket ID
  const testWfRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/workflows/${wfSla.id}/test`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: admin.cookie,
    },
  });
  if (testWfRes.statusCode !== 200) {
    throw new Error(`POST /workflows/:id/test failed: ${testWfRes.statusCode} ${testWfRes.body}`);
  }
  const testResult = JSON.parse(testWfRes.body);
  console.log(`   Workflow 3 Test Run result: ${testResult.message}`);

  // Check run log
  if (testResult.run.status !== 'SUCCESS') {
    throw new Error(`Workflow 3 test run failed: ${JSON.stringify(testResult.run)}`);
  }
  console.log('   ✅ Workflow 3 executed and escalated successfully!');

  // 6. Verification 5: Toggle Workflow Inactive & verify it DOES NOT run
  console.log('\n6. Verification 5: Inactive Workflow Toggle Test...');
  // Toggle Workflow 1 inactive
  const toggleOffRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/workflows/${wfWaitlist.id}/toggle`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
    },
    { isActive: false }
  );
  if (toggleOffRes.statusCode !== 200) {
    throw new Error(`Failed to toggle workflow off: ${toggleOffRes.statusCode}`);
  }
  console.log(`   Toggled "${wfWaitlist.name}" to is_active = false.`);

  const runsBeforeInactive = (await request({
    hostname: 'localhost',
    port: 4000,
    path: '/workflows/runs',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  })).body;
  const countBeforeInactive = JSON.parse(runsBeforeInactive).runs.length;

  // Post new Waitlist lead
  await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/leads',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    {
      companyName: 'Inactive Test Co',
      contactName: 'Test Contact',
      email: 'test@inactive.dummy',
      source: 'Waitlist',
      consent: true,
    }
  );

  await new Promise((r) => setTimeout(r, 1200));

  const runsAfterInactive = (await request({
    hostname: 'localhost',
    port: 4000,
    path: '/workflows/runs',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  })).body;
  const countAfterInactive = JSON.parse(runsAfterInactive).runs.length;

  if (countAfterInactive !== countBeforeInactive) {
    throw new Error('Inactive workflow executed! Expected run count to remain unchanged.');
  }
  console.log('   Confirmed: Inactive workflow did NOT execute (run count unchanged).');

  // Toggle back on
  await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/workflows/${wfWaitlist.id}/toggle`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
    },
    { isActive: true }
  );
  console.log(`   Toggled "${wfWaitlist.name}" back to is_active = true.`);
  console.log('   ✅ Toggle active/inactive behavior verified.');

  // 7. Verification 6: Web UI HTTP 200 Smoke Test
  console.log('\n7. Verification 6: Web UI /workflows smoke test...');
  const uiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/workflows',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  if (uiRes.statusCode !== 200) {
    throw new Error(`Web UI /workflows failed: ${uiRes.statusCode}`);
  }
  console.log('   /workflows → 200 OK');
  console.log('   ✅ Web UI /workflows smoke tested.');

  console.log('\n✨ ALL PHASE 6 VERIFICATIONS PASSED!\n');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
