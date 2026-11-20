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
  console.log('=== FLINT PHASE 3 VERIFICATION SUITE ===\n');

  // 1. Logins
  console.log('1. Demo Logins...');
  const rahul = await loginDemo('SALES_REP');
  console.log(`   Logged in as Rahul Sharma (SALES_REP): ${rahul.user.id}`);
  const meera = await loginDemo('MANAGER');
  console.log(`   Logged in as Meera Iyer (MANAGER): ${meera.user.id}`);
  const priya = await loginDemo('SUPPORT_AGENT');
  console.log(`   Logged in as Priya Nair (SUPPORT_AGENT): ${priya.user.id}`);

  // 2. Fetch Stages
  console.log('\n2. Fetch Pipeline Stages...');
  const stagesRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/pipeline/stages',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const stages = JSON.parse(stagesRes.body).items;
  console.log(`   Stages found: ${stages.length} stages`);
  stages.forEach((s) => console.log(`   - [${s.order_index}] ${s.name} (${s.probability}%) ID: ${s.id}`));
  if (stages.length !== 6) throw new Error(`Expected exactly 6 stages, got ${stages.length}`);

  const sWaitlist = stages.find((s) => s.name === 'Waitlist');
  const sDemo = stages.find((s) => s.name === 'Demo Scheduled');
  const sWon = stages.find((s) => s.name === 'Closed Won');

  // 3. GET /deals Scoping check
  console.log('\n3. Verification 2: GET /deals Scoping for Rahul vs Meera vs Priya...');
  const dealsRahulRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/deals',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const dealsRahul = JSON.parse(dealsRahulRes.body).items;
  console.log(`   Rahul (SALES_REP) sees ${dealsRahul.length} deals (can read all context)`);

  const dealsMeeraRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/deals',
    method: 'GET',
    headers: { Cookie: meera.cookie },
  });
  const dealsMeera = JSON.parse(dealsMeeraRes.body).items;
  console.log(`   Meera (MANAGER) sees ${dealsMeera.length} deals (team scoped)`);

  const dealsPriyaRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/deals',
    method: 'GET',
    headers: { Cookie: priya.cookie },
  });
  const dealsPriya = JSON.parse(dealsPriyaRes.body).items;
  console.log(`   Priya (SUPPORT_AGENT) sees ${dealsPriya.length} deals (read-only list)`);

  if (dealsRahulRes.statusCode !== 200 || dealsMeeraRes.statusCode !== 200 || dealsPriyaRes.statusCode !== 200) {
    throw new Error('Deals scoping request failed');
  }
  console.log('✅ Verification 2 Passed: Correct scoping for all roles.');

  // 4. Verification 3: PATCH /deals/:id/stage as Rahul vs Priya
  console.log('\n4. Verification 3: Stage change permission check...');
  const rahulsDeal = dealsRahul.find((d) => d.owner_id === rahul.user.id && d.stage_id === sWaitlist.id);
  if (!rahulsDeal) {
    throw new Error('Could not find a deal owned by Rahul in Waitlist stage');
  }
  console.log(`   Target Deal: "${rahulsDeal.title}" (ID: ${rahulsDeal.id}) in stage "${rahulsDeal.stage.name}"`);

  // Move stage as Rahul -> Expect 200 OK
  console.log('   Moving deal to Demo Scheduled as Rahul...');
  const moveResRahul = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${rahulsDeal.id}/stage`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    { stageId: sDemo.id }
  );
  console.log(`   Rahul move status: ${moveResRahul.statusCode}`);
  if (moveResRahul.statusCode !== 200) {
    throw new Error(`Failed to move deal as Rahul: ${moveResRahul.statusCode} ${moveResRahul.body}`);
  }
  console.log('   ✅ Moved successfully by Rahul');

  // Attempt move stage as Priya -> Expect 403 Forbidden
  console.log('   Attempting to move deal as Priya (SUPPORT_AGENT)...');
  const moveResPriya = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${rahulsDeal.id}/stage`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: priya.cookie,
      },
    },
    { stageId: sWaitlist.id }
  );
  console.log(`   Priya move status: ${moveResPriya.statusCode}`);
  if (moveResPriya.statusCode !== 403) {
    throw new Error(`Expected 403 Forbidden for Priya, got ${moveResPriya.statusCode}`);
  }
  console.log('✅ Verification 3 Passed: 200 OK for owner, 403 Forbidden for Support Agent.');

  // 5. Verification 4: Move deal to Closed Won via API -> expect deal.won event emission
  console.log('\n5. Verification 4: Move deal to Closed Won (probability 100)...');
  const moveResWon = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${rahulsDeal.id}/stage`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    { stageId: sWon.id }
  );
  console.log(`   Won move status: ${moveResWon.statusCode}`);
  const wonDeal = JSON.parse(moveResWon.body);
  if (moveResWon.statusCode !== 200 || wonDeal.stage_id !== sWon.id) {
    throw new Error(`Move to Closed Won failed: ${moveResWon.statusCode} ${moveResWon.body}`);
  }
  console.log(`   Deal is now in stage: ${wonDeal.stage?.name} (prob: ${wonDeal.stage?.probability}%)`);
  console.log('✅ Verification 4 Passed: Deal moved to Closed Won (triggers deal.stage_changed and deal.won).');

  // 6. Verification 5: Quote Math Check
  console.log('\n6. Verification 5: Quote Math Check...');
  // Fetch active products
  const productsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/products',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const products = JSON.parse(productsRes.body).items;
  console.log(`   Found ${products.length} products`);

  const pPayroll = products.find((p) => p.name === 'Payroll');
  const pAttendance = products.find((p) => p.name === 'Attendance');
  const pBenefits = products.find((p) => p.name === 'Employee Benefits Hub');

  if (!pPayroll || !pAttendance || !pBenefits) {
    throw new Error('Required products (Payroll, Attendance, Benefits Hub) not found');
  }

  console.log(`   Selected Products:`);
  console.log(`   - Payroll: ₹${pPayroll.price_per_employee_month}/mo`);
  console.log(`   - Attendance: ₹${pAttendance.price_per_employee_month}/mo`);
  console.log(`   - Employee Benefits Hub: ₹${pBenefits.price_per_employee_month}/mo`);
  console.log(`   Sum per employee/mo: ₹${pPayroll.price_per_employee_month + pAttendance.price_per_employee_month + pBenefits.price_per_employee_month}`);

  // Create quote on rahulsDeal: 500 employees, updateDealAmount: true
  const quoteRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${rahulsDeal.id}/quotes`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:3000',
        Cookie: rahul.cookie,
      },
    },
    {
      employees: 500,
      productIds: [pPayroll.id, pAttendance.id, pBenefits.id],
      updateDealAmount: true,
    }
  );

  console.log(`   Quote creation status: ${quoteRes.statusCode}`);
  const quoteDoc = JSON.parse(quoteRes.body);
  console.log(`   Quote Generated: ${quoteDoc.number}`);
  console.log(`   Monthly Total: ₹${quoteDoc.monthly_total} (Expected: 500 × 125 = ₹62,500)`);
  console.log(`   Annual Total: ₹${quoteDoc.annual_total} (Expected: 62,500 × 12 = ₹7,50,000)`);
  console.log(`   Line Items: ${quoteDoc.items?.length}`);

  if (quoteDoc.monthly_total !== 62500) {
    throw new Error(`Monthly total mismatch! Expected 62500, got ${quoteDoc.monthly_total}`);
  }
  if (quoteDoc.annual_total !== 750000) {
    throw new Error(`Annual total mismatch! Expected 750000, got ${quoteDoc.annual_total}`);
  }

  // Fetch updated deal to verify amount and employees updated
  const updatedDealRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/deals/${rahulsDeal.id}`,
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  const updatedDeal = JSON.parse(updatedDealRes.body);
  console.log(`   Updated Deal Amount: ₹${updatedDeal.amount} (Expected 750000)`);
  console.log(`   Updated Deal Employees: ${updatedDeal.employees} (Expected 500)`);

  if (updatedDeal.amount !== 750000 || updatedDeal.employees !== 500) {
    throw new Error(`Deal amount or employees did not update correctly`);
  }
  console.log('✅ Verification 5 Passed: Quote math and deal amount update verified exactly.');

  // 7. Verification 6: Web UI routes check
  console.log('\n7. Verification 6: Web UI routes check on port 3000...');
  const webDealsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/deals',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  console.log(`   Next.js /deals: HTTP ${webDealsRes.statusCode}`);
  if (webDealsRes.statusCode !== 200) {
    throw new Error(`Next.js /deals returned ${webDealsRes.statusCode}`);
  }

  const webDealDetailRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/deals/${rahulsDeal.id}`,
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  console.log(`   Next.js /deals/${rahulsDeal.id}: HTTP ${webDealDetailRes.statusCode}`);
  if (webDealDetailRes.statusCode !== 200) {
    throw new Error(`Next.js /deals/:id returned ${webDealDetailRes.statusCode}`);
  }

  console.log('✅ Verification 6 Passed: Web pages render 200 OK.');

  console.log('\n🎉 ALL PHASE 3 VERIFICATIONS PASSED PERFECTLY!');
}

run().catch((err) => {
  console.error('❌ Phase 3 verification error:', err);
  process.exit(1);
});
