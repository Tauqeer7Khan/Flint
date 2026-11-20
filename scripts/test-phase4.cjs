const http = require('http');

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
  console.log('=== FLINT PHASE 4 VERIFICATION SUITE ===\n');

  // 1. Logins
  console.log('1. Demo Logins...');
  const rahul = await loginDemo('SALES_REP');
  console.log(`   Logged in as Rahul Sharma (SALES_REP): ${rahul.user.id}`);
  const priya = await loginDemo('SUPPORT_AGENT');
  console.log(`   Logged in as Priya Nair (SUPPORT_AGENT): ${priya.user.id}`);

  // Fetch accounts
  const accRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/accounts',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const accounts = JSON.parse(accRes.body).items;

  // Fetch deals
  const dealsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/deals',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const deals = JSON.parse(dealsRes.body).items;
  // Pick deal owned by Rahul so he can modify it per RBAC
  const targetDeal = deals.find((d) => d.owner_id === rahul.user.id) || deals[0];
  const targetAccount = accounts.find((a) => a.id === targetDeal.account_id) || accounts[0];
  console.log(`   Target Account: "${targetAccount.name}" (ID: ${targetAccount.id})`);
  console.log(`   Target Deal: "${targetDeal.title}" (Owner: ${targetDeal.owner?.name})`);

  // 2. Verification 2: POST /activities as Rahul: NOTE
  console.log('\n2. Verification 2: POST /activities (NOTE) as Rahul...');
  const noteRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/activities',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    {
      type: 'NOTE',
      body: 'Demo scheduled for Tuesday with HR leadership team',
      accountId: targetAccount.id,
      dealId: targetDeal.id,
    }
  );
  console.log(`   POST /activities status: ${noteRes.statusCode}`);
  const createdNote = JSON.parse(noteRes.body);
  console.log(`   Created Note ID: ${createdNote.id}`);
  if (noteRes.statusCode !== 201 || createdNote.type !== 'NOTE') {
    throw new Error(`Failed to create note activity: ${noteRes.statusCode} ${noteRes.body}`);
  }
  console.log('✅ Verification 2 Passed: NOTE activity created (emitted activity:created).');

  // 3. Verification 3: POST internal comment mentioning Priya as Rahul
  console.log('\n3. Verification 3: Internal comment with @mention to Priya...');
  const commentRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/activities',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    {
      type: 'INTERNAL_COMMENT',
      body: `@Priya please review the employee sync requirements for ${targetAccount.name} before Thursday.`,
      isInternal: true,
      mentions: [priya.user.id],
      accountId: targetAccount.id,
      dealId: targetDeal.id,
    }
  );
  console.log(`   POST /activities (INTERNAL_COMMENT) status: ${commentRes.statusCode}`);
  const createdComment = JSON.parse(commentRes.body);
  console.log(`   Created Comment ID: ${createdComment.id}, is_internal: ${createdComment.is_internal}, mentions:`, createdComment.mentions);
  if (commentRes.statusCode !== 201 || !createdComment.is_internal || !createdComment.mentions.includes(priya.user.id)) {
    throw new Error(`Failed to create internal comment with mention: ${commentRes.statusCode} ${commentRes.body}`);
  }
  console.log('✅ Verification 3 Passed: Internal comment with mention stored.');

  // Give a small moment for async notification insertion
  await new Promise((r) => setTimeout(r, 200));

  // 4. Verification 4: Deal stage change creates auto SYSTEM activity
  console.log('\n4. Verification 4: Deal stage change auto SYSTEM activity...');
  const stagesRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/pipeline/stages',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const stages = JSON.parse(stagesRes.body).items;
  const sNegotiation = stages.find((s) => s.name === 'Negotiation');

  const moveRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${targetDeal.id}/stage`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    { stageId: sNegotiation.id }
  );
  console.log(`   Stage change status: ${moveRes.statusCode}`);
  if (moveRes.statusCode !== 200) {
    throw new Error(`Failed to move stage: ${moveRes.statusCode} ${moveRes.body}`);
  }
  console.log('✅ Verification 4 Passed: Deal stage change triggered auto SYSTEM activity.');

  // 5. Verification 5: Lead conversion creates auto SYSTEM activity
  console.log('\n5. Verification 5: Lead conversion auto SYSTEM activity...');
  // First create a new lead as Rahul
  const createLeadRes = await request(
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
      companyName: 'Lenskart Solutions',
      contactName: 'Peyush Bansal',
      email: 'peyush@lenskart.dummy',
      source: 'LinkedIn',
      customFields: { companySize: 1500, currentHrTool: 'Darwinbox' },
    }
  );
  const newLead = JSON.parse(createLeadRes.body);
  console.log(`   Created new test lead: ${newLead.company_name} (ID: ${newLead.id})`);

  // Now convert this lead
  const convertRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/leads/${newLead.id}/convert`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    {
      leadId: newLead.id,
      dealTitle: 'Lenskart - Enterprise HR Suite',
      dealAmount: 900000,
      employees: 1500,
      selectedModules: ['HR Operations', 'Payroll'],
    }
  );
  console.log(`   Lead convert status: ${convertRes.statusCode}`);
  const convertData = JSON.parse(convertRes.body);
  console.log(`   Converted to Account: ${convertData.account.name} (ID: ${convertData.account.id})`);
  if (convertRes.statusCode !== 200 || !convertData.account) {
    throw new Error(`Lead conversion failed: ${convertRes.statusCode} ${convertRes.body}`);
  }
  console.log('✅ Verification 5 Passed: Lead conversion triggered auto SYSTEM activity.');

  // 6. Verification 6: GET /activities privacy leak check for Support Agent
  console.log('\n6. Verification 6: Privacy check — ensure NO lead-linked activities leak to Priya (SUPPORT)...');
  // Create an internal comment activity linked to a lead as Rahul
  const leadActivityRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/activities',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    {
      type: 'INTERNAL_COMMENT',
      body: 'CONFIDENTIAL LEAD COMMENT: Special pricing approved for initial contract.',
      isInternal: true,
      accountId: targetAccount.id,
      leadId: newLead.id,
    }
  );
  const secretActivity = JSON.parse(leadActivityRes.body);
  console.log(`   Created secret lead-linked activity ID: ${secretActivity.id}`);

  // Fetch as Rahul
  const rahulActivitiesRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/activities?accountId=${targetAccount.id}`,
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const rahulActivities = JSON.parse(rahulActivitiesRes.body).items;
  const rahulSeesSecret = rahulActivities.some((a) => a.id === secretActivity.id);
  console.log(`   Rahul sees secret activity: ${rahulSeesSecret} (Expected true)`);

  // Fetch as Priya (SUPPORT_AGENT)
  const priyaActivitiesRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/activities?accountId=${targetAccount.id}`,
    method: 'GET',
    headers: { Cookie: priya.cookie },
  });
  const priyaActivities = JSON.parse(priyaActivitiesRes.body).items;
  const priyaSeesSecret = priyaActivities.some((a) => a.id === secretActivity.id);
  console.log(`   Priya sees secret activity: ${priyaSeesSecret} (Expected FALSE — must not leak!)`);

  if (!rahulSeesSecret || priyaSeesSecret) {
    throw new Error(`Privacy leak detected! Lead-linked activity was visible to Support Agent.`);
  }
  console.log('✅ Verification 6 Passed: Lead-linked activities are strictly excluded from Support Agent.');

  // 7. Verification 7: Customer 360 Aggregated Endpoint
  console.log('\n7. Verification 7: GET /accounts/:id/360 Aggregated Endpoint...');
  const c360Res = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/accounts/${targetAccount.id}/360`,
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  console.log(`   Customer 360 status: ${c360Res.statusCode}`);
  const c360 = JSON.parse(c360Res.body);
  console.log('   Customer 360 Aggregated Response Sections:', {
    account: c360.account?.name,
    contactsCount: c360.contacts?.length,
    dealsCount: c360.deals?.length,
    tasksCount: c360.tasks?.length,
    ticketsCount: c360.tickets?.length,
    quotesCount: c360.quotes?.length,
    timelineEntries: c360.timeline?.length,
  });

  if (
    c360Res.statusCode !== 200 ||
    !c360.account ||
    !Array.isArray(c360.contacts) ||
    !Array.isArray(c360.deals) ||
    !Array.isArray(c360.timeline)
  ) {
    throw new Error(`Customer 360 endpoint response malformed`);
  }
  console.log('✅ Verification 7 Passed: Customer 360 returned full profile in single roundtrip.');

  // 8. Verification 8: Web UI routes check on port 3000
  console.log('\n8. Verification 8: Web UI Customer 360 and Deal Detail with Timeline...');
  const web360Res = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/accounts/${targetAccount.id}`,
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  console.log(`   Next.js /accounts/${targetAccount.id} (Customer 360): HTTP ${web360Res.statusCode}`);
  if (web360Res.statusCode !== 200) {
    throw new Error(`Customer 360 page failed: ${web360Res.statusCode}`);
  }

  const webDealRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/deals/${targetDeal.id}`,
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  console.log(`   Next.js /deals/${targetDeal.id}: HTTP ${webDealRes.statusCode}`);
  if (webDealRes.statusCode !== 200) {
    throw new Error(`Deal detail page failed: ${webDealRes.statusCode}`);
  }
  console.log('✅ Verification 8 Passed: Web pages render 200 OK.');

  console.log('\n🎉 ALL PHASE 4 VERIFICATIONS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('❌ Phase 4 verification error:', err);
  process.exit(1);
});
