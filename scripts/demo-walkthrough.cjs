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

async function runDemoWalkthrough() {
  console.log('====================================================');
  console.log('       FLINT PROGRAMMATIC DEMO WALKTHROUGH          ');
  console.log('====================================================\n');

  // Authenticate demo actors
  const admin = await loginDemo('ADMIN');
  const sales = await loginDemo('SALES_REP');
  const support = await loginDemo('SUPPORT_AGENT');

  console.log(`Authenticated demo actors:`);
  console.log(`  • Admin:   ${admin.user.name} (${admin.user.role})`);
  console.log(`  • Sales:   ${sales.user.name} (${sales.user.role})`);
  console.log(`  • Support: ${support.user.name} (${support.user.role})\n`);

  let passedBeats = 0;

  // -------------------------------------------------------------
  // BEAT 1: Public Waitlist Lead Gen & Automated Lead Routing
  // -------------------------------------------------------------
  console.log('▶ [BEAT 1] Public Waitlist Lead Generation & Automated Routing');
  const waitlistPayload = {
    name: 'Rohan Verma',
    email: `rohan_${Date.now()}@razorpay.com`,
    companyName: 'Razorpay Payments',
    companySize: 250,
    phone: '+91 98765 43210',
    currentHrTool: 'Excel & Manual Slips',
    interestedModules: ['Payroll', 'Attendance', 'Employee Benefits Hub'],
    hrContactDesignation: 'VP People Operations',
    consent: true,
    website: '',
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
    waitlistPayload
  );

  if (waitlistRes.statusCode !== 201) {
    throw new Error(`Beat 1 Failed: /public/waitlist returned ${waitlistRes.statusCode}: ${waitlistRes.body}`);
  }

  // Allow async workflow event to trigger lead assignment
  await new Promise((r) => setTimeout(r, 1000));

  const leadDb = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT id, company_name, owner_id FROM leads WHERE email = '${waitlistPayload.email}';"`
  ).toString().trim();

  if (!leadDb) {
    throw new Error(`Beat 1 Failed: Lead with email ${waitlistPayload.email} not found in database!`);
  }

  const [leadId, company, ownerId] = leadDb.split('|');
  console.log(`  ✓ Public waitlist submission successful (Lead ID: ${leadId})`);
  if (!ownerId || ownerId === '') {
    throw new Error(`Beat 1 Failed: Lead was not auto-assigned by Workflow 1!`);
  }

  const ownerInfo = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT name, role FROM users WHERE id = '${ownerId}';"`
  ).toString().trim();

  console.log(`  ✓ Workflow 1 auto-assigned lead "${company}" to Sales Rep (${ownerInfo})`);
  console.log('  ✅ [PASS] Beat 1 Verified.\n');
  passedBeats++;

  // -------------------------------------------------------------
  // BEAT 2: Lead Conversion & Accurate ACV Quote Calculation
  // -------------------------------------------------------------
  console.log('▶ [BEAT 2] Lead Conversion to Account/Contact/Deal & ACV Quote Builder');
  const convertRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/leads/${leadId}/convert`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
    },
    {
      dealTitle: 'Razorpay - Enterprise Empulz Suite',
      dealAmount: 750000,
      employees: 500,
      selectedModules: ['Payroll', 'Attendance', 'Employee Benefits Hub'],
    }
  );

  if (convertRes.statusCode !== 200) {
    throw new Error(`Beat 2 Failed: Lead conversion returned ${convertRes.statusCode}: ${convertRes.body}`);
  }

  const conversionData = JSON.parse(convertRes.body);
  const accountId = conversionData.account?.id || conversionData.accountId;
  const contactId = conversionData.contact?.id || conversionData.contactId;
  const dealId = conversionData.deal?.id || conversionData.dealId;

  console.log(`  ✓ Lead converted successfully:`);
  console.log(`    • Account: ${accountId}`);
  console.log(`    • Contact: ${contactId}`);
  console.log(`    • Deal:    ${dealId}`);

  // Fetch products to build quote
  const productsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/products',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const allProducts = JSON.parse(productsRes.body).items || [];
  const payrollProd = allProducts.find((p) => p.name === 'Payroll');
  const attendanceProd = allProducts.find((p) => p.name === 'Attendance');
  const benefitsProd = allProducts.find((p) => p.name === 'Employee Benefits Hub');

  if (!payrollProd || !attendanceProd || !benefitsProd) {
    throw new Error(`Beat 2 Failed: Could not locate products for quote builder.`);
  }

  // Create Quote: 500 employees x (₹50 + ₹40 + ₹35 = ₹125/mo) = ₹62,500/mo -> ₹7,50,000/yr
  const quoteRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${dealId}/quotes`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
    },
    {
      employees: 500,
      productIds: [payrollProd.id, attendanceProd.id, benefitsProd.id],
      updateDealAmount: true,
    }
  );

  if (quoteRes.statusCode !== 200 && quoteRes.statusCode !== 201) {
    throw new Error(`Beat 2 Failed: Quote generation returned ${quoteRes.statusCode}: ${quoteRes.body}`);
  }

  const quoteDoc = JSON.parse(quoteRes.body);
  console.log(`  ✓ Generated Quote #${quoteDoc.number}:`);
  console.log(`    • Monthly Total: ₹${quoteDoc.monthly_total.toLocaleString('en-IN')} (500 seats × ₹125)`);
  console.log(`    • Annual Total (ACV): ₹${quoteDoc.annual_total.toLocaleString('en-IN')} (₹62,500 × 12)`);

  if (quoteDoc.monthly_total !== 62500 || quoteDoc.annual_total !== 750000) {
    throw new Error(`Beat 2 Failed: Quote totals mismatch (expected ₹62,500/mo and ₹7,50,000/yr).`);
  }

  console.log('  ✅ [PASS] Beat 2 Verified.\n');
  passedBeats++;

  // -------------------------------------------------------------
  // BEAT 3: Kanban Drag-and-Drop & CS Onboarding Tasks Automation
  // -------------------------------------------------------------
  console.log('▶ [BEAT 3] Sales Pipeline Closed Won & CS Automated Task Creation');
  const closedWonStageId = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT id FROM pipeline_stages WHERE name = 'Closed Won';"`
  ).toString().trim();

  const moveWonRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/deals/${dealId}/stage`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
    },
    { stageId: closedWonStageId }
  );

  if (moveWonRes.statusCode !== 200) {
    throw new Error(`Beat 3 Failed: Stage change to Closed Won returned ${moveWonRes.statusCode}: ${moveWonRes.body}`);
  }
  console.log(`  ✓ Deal transitioned to Closed Won.`);

  // Allow async workflow engine to fire deal.won and create CS tasks
  await new Promise((r) => setTimeout(r, 1200));

  const tasksPsql = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT title, status FROM tasks WHERE deal_id = '${dealId}';"`
  ).toString().trim();

  console.log(`  ✓ Created CS Onboarding Tasks for Deal:`);
  tasksPsql.split('\n').forEach((line) => {
    const [title, status] = line.split('|');
    console.log(`    • [${status}] ${title}`);
  });

  if (!tasksPsql.includes('Payroll') || !tasksPsql.includes('Attendance') || !tasksPsql.includes('Benefits')) {
    throw new Error(`Beat 3 Failed: Expected onboarding tasks for all purchased modules!`);
  }

  console.log('  ✅ [PASS] Beat 3 Verified.\n');
  passedBeats++;

  // -------------------------------------------------------------
  // BEAT 4: Customer 360, High-Priority Alert Banner, & @Mentions
  // -------------------------------------------------------------
  console.log('▶ [BEAT 4] Cross-Team Alert Banner & Real-Time @Mentions');
  // 4a. Create high priority ticket on this account
  const ticketRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/tickets',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: support.cookie,
      },
    },
    {
      subject: 'Critical API Webhook Failure on Production',
      priority: 'HIGH',
      accountId: accountId,
      dealId: dealId,
    }
  );

  if (ticketRes.statusCode !== 201) {
    throw new Error(`Beat 4 Failed: Ticket creation returned ${ticketRes.statusCode}: ${ticketRes.body}`);
  }
  const createdTicket = JSON.parse(ticketRes.body);
  console.log(`  ✓ High-Priority Ticket created: #${createdTicket.id.slice(-6).toUpperCase()} ("${createdTicket.subject}")`);

  // 4b. Verify Deal page alert endpoint detects the open high ticket
  const dealAlertRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/deals/${dealId}/alerts`,
    method: 'GET',
    headers: { Cookie: sales.cookie },
  });

  const dealAlert = JSON.parse(dealAlertRes.body);
  if (!dealAlert.hasHighPriorityTicket || !dealAlert.ticket) {
    throw new Error(`Beat 4 Failed: Deal alert banner did not detect high-priority ticket on account!`);
  }
  console.log(`  ✓ Cross-Team Deal Alert triggered:`);
  console.log(`    • Banner Active: ${dealAlert.hasHighPriorityTicket}`);
  console.log(`    • Flagged Ticket: [${dealAlert.ticket.priority}] ${dealAlert.ticket.subject}`);

  // 4c. Internal comment with @mention generating live notification
  const countNotifsBefore = parseInt(
    execSync(`docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT count(*) FROM notifications WHERE user_id = '${sales.user.id}';"`).toString().trim()
  );

  const commentRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/activities',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: support.cookie,
      },
    },
    {
      type: 'INTERNAL_COMMENT',
      body: `Hey @${sales.user.name}, please check this open ticket before your renewal call.`,
      mentions: [sales.user.id],
      accountId: accountId,
      dealId: dealId,
      ticketId: createdTicket.id,
      is_internal: true,
    }
  );

  if (commentRes.statusCode !== 201) {
    throw new Error(`Beat 4 Failed: Internal comment returned ${commentRes.statusCode}: ${commentRes.body}`);
  }

  await new Promise((r) => setTimeout(r, 400));

  const countNotifsAfter = parseInt(
    execSync(`docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT count(*) FROM notifications WHERE user_id = '${sales.user.id}';"`).toString().trim()
  );

  if (countNotifsAfter <= countNotifsBefore) {
    throw new Error(`Beat 4 Failed: @mention did not generate notification for user ${sales.user.name}!`);
  }
  console.log(`  ✓ Internal comment posted and notification dispatched to @${sales.user.name}`);
  console.log('  ✅ [PASS] Beat 4 Verified.\n');
  passedBeats++;

  // -------------------------------------------------------------
  // BEAT 5: SLA Breach Sweep & Automatic Escalation Workflow
  // -------------------------------------------------------------
  console.log('▶ [BEAT 5] SLA Breach Sweep Scheduler & Escalation Workflow');
  const urgentTicketDb = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT id, subject, priority, sla_due_at FROM tickets WHERE subject LIKE '%Attendance geo-fence%' LIMIT 1;"`
  ).toString().trim();

  if (!urgentTicketDb) {
    throw new Error(`Beat 5 Failed: Could not locate seeded urgent attendance ticket.`);
  }

  const [urgentId, urgentSubject, urgentPriority, slaDueStr] = urgentTicketDb.split('|');

  // Fetch via API to test real client-facing serialization and ensure UTC parsing
  const ticketsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/tickets',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const allTickets = JSON.parse(ticketsRes.body).items || JSON.parse(ticketsRes.body).tickets || [];
  const urgentTicket = allTickets.find((t) => t.id === urgentId);
  const slaDueUtc = urgentTicket?.slaDueAt || urgentTicket?.sla_due_at || (slaDueStr.includes('T') ? slaDueStr : slaDueStr.replace(' ', 'T') + 'Z');
  const slaDueDate = new Date(slaDueUtc);
  const diffMinutes = (slaDueDate.getTime() - Date.now()) / (60 * 1000);

  console.log(`  ✓ Seeded Urgent Ticket: "${urgentSubject}"`);
  console.log(`    • Priority:   ${urgentPriority}`);
  console.log(`    • SLA Due At: ${slaDueDate.toISOString()} (~+${diffMinutes.toFixed(1)} mins from now)`);

  if (diffMinutes <= 0 || diffMinutes > 5) {
    throw new Error(`Beat 5 Failed: Seeded urgent ticket slaDueAt is not within (0, 5) minutes in the future! Delta: ${diffMinutes.toFixed(2)} mins`);
  }

  const slaWorkflowDb = execSync(
    `docker exec flint-postgres psql -U flint -d flint -t -A -c "SELECT id, name, is_active FROM workflows WHERE name LIKE '%SLA Breach%' LIMIT 1;"`
  ).toString().trim();

  const [, wfName, isActive] = slaWorkflowDb.split('|');
  if (isActive !== 't' && isActive !== 'true') {
    throw new Error(`Beat 5 Failed: Workflow "${wfName}" is not active!`);
  }
  console.log(`  ✓ SLA Escalation Workflow "${wfName}" is ACTIVE`);
  console.log('  ✅ [PASS] Beat 5 Verified.\n');
  passedBeats++;

  // -------------------------------------------------------------
  // BEAT 6: Typo Search, Executive Dashboard, & Audit Log RBAC
  // -------------------------------------------------------------
  console.log('▶ [BEAT 6] pg_trgm Typo Search, Dashboard 4-Tiles, & Audit RBAC');

  // 6a. Fuzzy Search with pg_trgm
  const typoSearchRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/search?q=Zomto',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const typoResults = JSON.parse(typoSearchRes.body);
  const foundZomato = typoResults.leads?.some((l) => l.companyName.toLowerCase().includes('zomato'));
  if (!foundZomato) {
    throw new Error(`Beat 6 Failed: Typo search "Zomto" did not match Zomato!`);
  }
  console.log(`  ✓ pg_trgm typo search: "Zomto" accurately matched "Zomato"`);

  // 6b. Analytics Overview 4 Tiles
  const analyticsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/analytics/overview',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const analyticsData = JSON.parse(analyticsRes.body);
  if (
    analyticsData.revenueThisMonth === undefined ||
    analyticsData.conversionRate === undefined ||
    analyticsData.avgDealSize === undefined ||
    analyticsData.openTickets === undefined
  ) {
    throw new Error(`Beat 6 Failed: /analytics/overview missing required metric tiles!`);
  }
  console.log(`  ✓ Analytics Overview Stat Tiles:`);
  console.log(`    • Revenue This Month:  ₹${analyticsData.revenueThisMonth.toLocaleString('en-IN')}`);
  console.log(`    • Conversion Rate:     ${analyticsData.conversionRate}%`);
  console.log(`    • Avg Deal Size:       ₹${analyticsData.avgDealSize.toLocaleString('en-IN')}`);
  console.log(`    • Open Tickets:        ${analyticsData.openTickets} (${analyticsData.slaBreaches} SLA breaches)`);

  // 6c. Audit Log RBAC
  const adminAuditRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/audit-logs?page=1&limit=5',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  if (adminAuditRes.statusCode !== 200) {
    throw new Error(`Beat 6 Failed: Admin GET /audit-logs returned ${adminAuditRes.statusCode}`);
  }
  const adminAuditData = JSON.parse(adminAuditRes.body);
  console.log(`  ✓ Admin Audit Log Access: 200 OK (${adminAuditData.total} total logged mutations)`);

  const supportAuditRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/audit-logs',
    method: 'GET',
    headers: { Cookie: support.cookie },
  });
  if (supportAuditRes.statusCode !== 403) {
    throw new Error(`Beat 6 Failed: Support Agent GET /audit-logs should return 403, got ${supportAuditRes.statusCode}`);
  }
  console.log(`  ✓ Support Agent Audit Log Access: 403 Forbidden (RBAC Protected)`);

  console.log('  ✅ [PASS] Beat 6 Verified.\n');
  passedBeats++;

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log('====================================================');
  console.log(`=== ALL ${passedBeats} DEMO BEATS VERIFIED ===`);
  console.log('STATUS: DEMO READY');
  console.log('====================================================');
}

runDemoWalkthrough().catch((err) => {
  console.error('\n❌ DEMO WALKTHROUGH ERROR:', err);
  process.exit(1);
});
