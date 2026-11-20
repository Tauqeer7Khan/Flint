const http = require('http');
const ioClient = require('../apps/web/node_modules/socket.io-client');

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
  console.log('=== FLINT PHASE 7 VERIFICATION SUITE ===\n');

  // 1. Logins
  console.log('1. Demo Logins...');
  const admin = await loginDemo('ADMIN');
  const sales = await loginDemo('SALES_REP');
  const support = await loginDemo('SUPPORT_AGENT');
  console.log(`✓ Admin: ${admin.user.name} (${admin.user.role})`);
  console.log(`✓ Sales: ${sales.user.name} (${sales.user.role})`);
  console.log(`✓ Support: ${support.user.name} (${support.user.role})\n`);

  // 2. Global Search with pg_trgm and Typo Tolerance
  console.log('2. Global Search with pg_trgm & Typo Tolerance...');

  // 2a. Query "Zom" (Zomato is a seeded Lead)
  const searchZom = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/search?q=Zom',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const zomResults = JSON.parse(searchZom.body);
  console.log(`✓ Search "Zom": found ${zomResults.leads?.length} leads, ${zomResults.accounts?.length} accounts`);
  const foundZomato = zomResults.leads?.some((l) => l.companyName.toLowerCase().includes('zomato'));
  if (!foundZomato) throw new Error('Expected Zomato in search results for "Zom"');

  // 2b. Query typo "Zomto" (Trigram fuzzy similarity on Leads)
  const searchTypo = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/search?q=Zomto',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const typoResults = JSON.parse(searchTypo.body);
  console.log(`✓ Search typo "Zomto": found ${typoResults.leads?.length} leads (pg_trgm typo match)`);
  const foundTypoZomato = typoResults.leads?.some((l) => l.companyName.toLowerCase().includes('zomato'));
  if (!foundTypoZomato) throw new Error('Expected Zomato matched via pg_trgm typo tolerance for "Zomto"');

  // 2c. Query "Info" and typo "Infosy" on Accounts
  const searchInfo = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/search?q=Infosy',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const infoResults = JSON.parse(searchInfo.body);
  console.log(`✓ Search typo "Infosy": found ${infoResults.accounts?.length} accounts (pg_trgm typo match for Infosys)`);
  const foundInfosys = infoResults.accounts?.some((a) => a.name.toLowerCase().includes('infosys'));
  if (!foundInfosys) throw new Error('Expected Infosys matched via pg_trgm typo tolerance for "Infosy"');

  // 2d. RBAC check: SUPPORT_AGENT should see leads: []
  const searchSupport = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/search?q=Swiggy',
    method: 'GET',
    headers: { Cookie: support.cookie },
  });
  const supportResults = JSON.parse(searchSupport.body);
  if (!Array.isArray(supportResults.leads) || supportResults.leads.length !== 0) {
    throw new Error(`Support Agent should have leads: [] in search, got ${JSON.stringify(supportResults.leads)}`);
  }
  console.log('✓ RBAC Search: Support Agent receives empty leads array [leads: []]');

  // 2e. Sales Rep should see leads
  const searchSales = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/search?q=Swiggy',
    method: 'GET',
    headers: { Cookie: sales.cookie },
  });
  const salesResults = JSON.parse(searchSales.body);
  if (!salesResults.leads || salesResults.leads.length === 0) {
    throw new Error('Sales Rep should be able to search leads');
  }
  console.log(`✓ RBAC Search: Sales Rep sees matching lead "${salesResults.leads[0].companyName}"\n`);

  // 3. Cross-Team Alerts Endpoints
  console.log('3. Cross-Team Alert Banners Endpoints...');

  // Fetch Reliance deal dynamically
  const dealsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/deals',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const allDeals = JSON.parse(dealsRes.body).items || [];
  const relianceDeal = allDeals.find((d) => d.account?.name?.includes('Reliance'));
  const relianceDealId = relianceDeal ? relianceDeal.id : 'cmwpb3rim0019deyacc8u4yhn';

  const dealAlertRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/deals/${relianceDealId}/alerts`,
    method: 'GET',
    headers: { Cookie: sales.cookie },
  });
  const dealAlert = JSON.parse(dealAlertRes.body);
  console.log(`✓ Deal Alert on Reliance (${relianceDealId}): hasHighPriorityTicket = ${dealAlert.hasHighPriorityTicket}`);
  if (!dealAlert.hasHighPriorityTicket || !dealAlert.ticket) {
    throw new Error('Expected Reliance deal to have open high-priority ticket alert');
  }
  console.log(`  └ Alert Ticket: [${dealAlert.ticket.priority}] "${dealAlert.ticket.subject}" (#${dealAlert.ticket.id.slice(-6).toUpperCase()})`);

  // Fetch Infosys ticket dynamically
  const ticketsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/tickets',
    method: 'GET',
    headers: { Cookie: admin.cookie },
  });
  const allTickets = JSON.parse(ticketsRes.body).items || [];
  const infosysTicket = allTickets.find((t) => t.account?.name?.includes('Infosys'));
  const infosysTicketId = infosysTicket ? infosysTicket.id : 'cmwpb3rkc002odeyahmhh74vy';

  const ticketAlertRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/tickets/${infosysTicketId}/alerts`,
    method: 'GET',
    headers: { Cookie: support.cookie },
  });
  const ticketAlert = JSON.parse(ticketAlertRes.body);
  console.log(`✓ Ticket Alert on Infosys (${infosysTicketId}): hasActiveDeal = ${ticketAlert.hasActiveDeal}`);
  if (!ticketAlert.hasActiveDeal || !ticketAlert.deal) {
    throw new Error('Expected Infosys ticket to have active deal alert');
  }
  console.log(`  └ Alert Deal: "${ticketAlert.deal.title}" (₹${ticketAlert.deal.amount} in ${ticketAlert.deal.stageName})\n`);

  // 4. In-App Notifications API
  console.log('4. In-App Notifications System...');

  // Create a notification for Rahul
  const createNotifRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/auth/me',
      method: 'GET',
      headers: { Cookie: sales.cookie },
    }
  );
  const meSales = JSON.parse(createNotifRes.body);

  const sampleAccountId = infoResults.accounts[0].id;

  // Post activity with @mention to generate a real notification
  const mentionActivityRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/activities',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: admin.cookie,
      },
    },
    {
      type: 'INTERNAL_COMMENT',
      body: `Hey @[${sales.user.name}](${sales.user.id}), please review the latest updates on Phase 7.`,
      isInternal: true,
      mentions: [sales.user.id],
      accountId: sampleAccountId,
    }
  );
  if (mentionActivityRes.statusCode !== 201) {
    throw new Error(`Failed to create mention activity: ${mentionActivityRes.body}`);
  }
  console.log('✓ Mention activity created: Ananya mentioned Rahul');

  // Fetch notifications for Rahul
  const getNotifsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/notifications',
    method: 'GET',
    headers: { Cookie: sales.cookie },
  });
  const notifsData = JSON.parse(getNotifsRes.body);
  console.log(`✓ Rahul notifications: ${notifsData.items.length} items, unreadCount = ${notifsData.unreadCount}`);
  if (notifsData.unreadCount < 1) {
    throw new Error('Expected at least 1 unread notification after mention');
  }

  const latestNotif = notifsData.items[0];
  console.log(`  └ Latest notification: "${latestNotif.title}" — "${latestNotif.body}"`);

  // Mark single as read
  const markReadRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/notifications/${latestNotif.id}/read`,
    method: 'PATCH',
    headers: { Cookie: sales.cookie },
  });
  if (markReadRes.statusCode !== 200) {
    throw new Error(`Failed to mark notification read: ${markReadRes.body}`);
  }
  console.log(`✓ Marked notification #${latestNotif.id} as read`);

  // Read-all endpoint
  const readAllRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/notifications/read-all',
    method: 'POST',
    headers: { Cookie: sales.cookie },
  });
  if (readAllRes.statusCode !== 200) {
    throw new Error(`Failed to mark all read: ${readAllRes.body}`);
  }

  const verifyNotifsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/notifications',
    method: 'GET',
    headers: { Cookie: sales.cookie },
  });
  const verifyData = JSON.parse(verifyNotifsRes.body);
  if (verifyData.unreadCount !== 0) {
    throw new Error(`Expected unreadCount to be 0 after read-all, got ${verifyData.unreadCount}`);
  }
  console.log('✓ Mark all read verified: unreadCount is now 0\n');

  // 5. Real-Time Room Presence
  console.log('5. Real-Time Room Presence (Socket.io)...');

  // Obtain socket tokens
  const salesTokenRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/auth/socket-token',
    method: 'GET',
    headers: { Cookie: sales.cookie },
  });
  const { token: salesToken } = JSON.parse(salesTokenRes.body);

  const supportTokenRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/auth/socket-token',
    method: 'GET',
    headers: { Cookie: support.cookie },
  });
  const { token: supportToken } = JSON.parse(supportTokenRes.body);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Presence test timed out after 8s'));
    }, 8000);

    const socketSales = ioClient('http://localhost:4000', {
      transports: ['websocket'],
      auth: { token: salesToken },
    });

    const socketSupport = ioClient('http://localhost:4000', {
      transports: ['websocket'],
      auth: { token: supportToken },
    });

    let salesJoined = false;
    let supportJoined = false;

    socketSales.on('connect', () => {
      socketSales.emit('presence:join', { pageType: 'deal', pageId: relianceDealId });
      salesJoined = true;
    });

    socketSupport.on('connect', () => {
      // Small delay so Sales joins first
      setTimeout(() => {
        socketSupport.emit('presence:join', { pageType: 'deal', pageId: relianceDealId });
        supportJoined = true;
      }, 500);
    });

    let verifiedTwoUsers = false;

    socketSales.on('presence:update', (data) => {
      if (data.room === `page:deal:${relianceDealId}`) {
        const userNames = data.users.map((u) => u.name);
        if (data.users.length === 2 && !verifiedTwoUsers) {
          verifiedTwoUsers = true;
          console.log(`✓ Both users active in room page:deal:${relianceDealId} -> [${userNames.join(', ')}]`);

          // Now Sales leaves the room
          socketSales.emit('presence:leave', { pageType: 'deal', pageId: relianceDealId });
        }
      }
    });

    socketSupport.on('presence:update', (data) => {
      if (data.room === `page:deal:${relianceDealId}`) {
        const userNames = data.users.map((u) => u.name);
        if (verifiedTwoUsers && data.users.length === 1) {
          console.log(`✓ After Rahul left: room has 1 active user -> [${userNames.join(', ')}]`);

          socketSales.disconnect();
          socketSupport.disconnect();
          clearTimeout(timeout);
          resolve();
        }
      }
    });
  });

  console.log('✓ Real-Time Presence verified successfully!\n');

  // 6. Web UI Routes 200 OK Checks
  console.log('6. Web UI Routes Checks...');
  const routesToCheck = [
    `/deals/${relianceDealId}`,
    `/tickets/${infosysTicketId}`,
    `/accounts/${sampleAccountId}`,
  ];

  for (const route of routesToCheck) {
    const pageRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: route,
      method: 'GET',
      headers: { Cookie: admin.cookie },
    });
    console.log(`✓ Web route ${route} -> status ${pageRes.statusCode}`);
    if (pageRes.statusCode !== 200) {
      throw new Error(`Route ${route} returned non-200: ${pageRes.statusCode}`);
    }
  }

  console.log('\n=== ALL PHASE 7 TESTS PASSED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('\n❌ Phase 7 test failure:', err);
  process.exit(1);
});
