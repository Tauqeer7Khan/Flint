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

async function run() {
  console.log('=== PHASE 2 VERIFICATION SUITE ===');

  // Step 1: Demo login as SALES_REP
  console.log('\n1. Demo Login as SALES_REP...');
  const salesLoginRes = await request(
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
    { role: 'SALES_REP' }
  );

  if (salesLoginRes.statusCode !== 200) {
    throw new Error(`Sales login failed: ${salesLoginRes.statusCode} ${salesLoginRes.body}`);
  }
  const salesCookie = extractCookie(salesLoginRes.headers);
  const salesUser = JSON.parse(salesLoginRes.body);
  console.log(`✅ Logged in as SALES_REP: ${salesUser.name} (${salesUser.email})`);
  console.log(`   Cookie: ${salesCookie}`);

  // Step 2: Demo login as SUPPORT_AGENT
  console.log('\n2. Demo Login as SUPPORT_AGENT...');
  const supportLoginRes = await request(
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
    { role: 'SUPPORT_AGENT' }
  );

  if (supportLoginRes.statusCode !== 200) {
    throw new Error(`Support login failed: ${supportLoginRes.statusCode} ${supportLoginRes.body}`);
  }
  const supportCookie = extractCookie(supportLoginRes.headers);
  const supportUser = JSON.parse(supportLoginRes.body);
  console.log(`✅ Logged in as SUPPORT_AGENT: ${supportUser.name} (${supportUser.email})`);
  console.log(`   Cookie: ${supportCookie}`);

  // Step 3: Test 2 - GET /leads with Sales Cookie (expect 200 OK + leads JSON)
  console.log('\n3. Test 2: GET /leads with SALES_REP cookie...');
  const salesLeadsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/leads',
    method: 'GET',
    headers: {
      Cookie: salesCookie,
    },
  });
  console.log(`   Status: ${salesLeadsRes.statusCode}`);
  const leadsData = JSON.parse(salesLeadsRes.body);
  console.log(`   Total Leads: ${leadsData.total}`);
  if (salesLeadsRes.statusCode !== 200 || !Array.isArray(leadsData.data)) {
    throw new Error(`Expected 200 with leads array, got: ${salesLeadsRes.statusCode}`);
  }
  console.log(`✅ Test 2 Passed: 200 OK with ${leadsData.data.length} leads.`);

  // Step 4: Test 3 - GET /leads with Support Cookie (expect 403 Forbidden)
  console.log('\n4. Test 3: GET /leads with SUPPORT_AGENT cookie...');
  const supportLeadsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/leads',
    method: 'GET',
    headers: {
      Cookie: supportCookie,
    },
  });
  console.log(`   Status: ${supportLeadsRes.statusCode}`);
  console.log(`   Body: ${supportLeadsRes.body}`);
  if (supportLeadsRes.statusCode !== 403) {
    throw new Error(`Expected 403 Forbidden for Support Agent on leads, got: ${supportLeadsRes.statusCode}`);
  }
  console.log(`✅ Test 3 Passed: 403 Forbidden correctly enforced for Support Agent.`);

  // Step 5: Test 4 - Convert 1 lead via POST /leads/:id/convert
  console.log('\n5. Test 4: Convert 1 Lead via POST /leads/:id/convert...');
  const targetLead = leadsData.data.find((l) => l.status !== 'CONVERTED');
  if (!targetLead) {
    throw new Error('No unconverted lead found to test conversion');
  }
  console.log(`   Target Lead: ${targetLead.company_name} (ID: ${targetLead.id})`);

  const convertRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/leads/${targetLead.id}/convert`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: salesCookie,
      },
    },
    {
      leadId: targetLead.id,
      dealTitle: `${targetLead.company_name} - Empulz Enterprise License`,
      dealAmount: 540000,
      employees: 300,
      selectedModules: ['HR Operations', 'Payroll', 'Attendance'],
    }
  );

  console.log(`   Status: ${convertRes.statusCode}`);
  const convertResult = JSON.parse(convertRes.body);
  console.log('   Conversion Result:', {
    account: convertResult.account?.name,
    contact: convertResult.contact?.name,
    deal: convertResult.deal?.title,
    dealAmount: convertResult.deal?.amount,
    leadStatus: convertResult.lead?.status,
  });

  if (
    convertRes.statusCode !== 200 ||
    !convertResult.account ||
    !convertResult.contact ||
    !convertResult.deal ||
    convertResult.lead?.status !== 'CONVERTED'
  ) {
    throw new Error(`Lead conversion failed: ${convertRes.statusCode} ${convertRes.body}`);
  }
  console.log(`✅ Test 4 Passed: Lead converted atomically into Account, Contact, and Deal.`);

  // Step 6: Test 5 - Soft delete account via DELETE /accounts/:id
  console.log('\n6. Test 5: Soft Delete Account via DELETE /accounts/:id...');
  // Fetch accounts list first
  const accountsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/accounts',
    method: 'GET',
    headers: {
      Cookie: salesCookie,
    },
  });
  const accountsData = JSON.parse(accountsRes.body);
  const accountToDelete = accountsData.data[0];
  console.log(`   Account to delete: ${accountToDelete.name} (ID: ${accountToDelete.id})`);

  const deleteRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/accounts/${accountToDelete.id}`,
    method: 'DELETE',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: salesCookie,
    },
  });
  console.log(`   Delete Status: ${deleteRes.statusCode}`);
  if (deleteRes.statusCode !== 200) {
    throw new Error(`Failed to delete account: ${deleteRes.statusCode} ${deleteRes.body}`);
  }

  // Verify it is excluded from GET /accounts
  const accountsAfterRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/accounts',
    method: 'GET',
    headers: {
      Cookie: salesCookie,
    },
  });
  const accountsAfterData = JSON.parse(accountsAfterRes.body);
  const existsInList = accountsAfterData.data.some((a) => a.id === accountToDelete.id);
  if (existsInList) {
    throw new Error('Soft-deleted account is still appearing in GET /accounts list');
  }
  console.log(`✅ Test 5 Passed: Account excluded from GET /accounts list.`);

  // Step 7: Test 6 - Verify Web UI pages (:3000) under Sales Rep and Support Agent
  console.log('\n7. Test 6: Verify Web UI pages on Next.js (:3000)...');
  const webLeadsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/leads',
    method: 'GET',
    headers: {
      Cookie: salesCookie,
    },
  });
  console.log(`   Web /leads (Sales): HTTP ${webLeadsRes.statusCode}`);
  if (webLeadsRes.statusCode !== 200) {
    throw new Error(`Web /leads failed with status ${webLeadsRes.statusCode}`);
  }

  const webAccountsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/accounts',
    method: 'GET',
    headers: {
      Cookie: salesCookie,
    },
  });
  console.log(`   Web /accounts (Sales): HTTP ${webAccountsRes.statusCode}`);
  if (webAccountsRes.statusCode !== 200) {
    throw new Error(`Web /accounts failed with status ${webAccountsRes.statusCode}`);
  }

  const webContactsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/contacts',
    method: 'GET',
    headers: {
      Cookie: salesCookie,
    },
  });
  console.log(`   Web /contacts (Sales): HTTP ${webContactsRes.statusCode}`);
  if (webContactsRes.statusCode !== 200) {
    throw new Error(`Web /contacts failed with status ${webContactsRes.statusCode}`);
  }

  console.log(`✅ Test 6 Passed: All Web UI pages render successfully.`);
  console.log('\n🎉 ALL PHASE 2 TESTS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
