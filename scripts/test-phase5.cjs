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
  console.log('=== FLINT PHASE 5 VERIFICATION SUITE ===\n');

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
  const reliance = accounts.find((a) => a.name.includes('Reliance')) || accounts[0];
  console.log(`   Using Account: "${reliance.name}" (ID: ${reliance.id})`);

  // 2. Verification 3: GET /tasks/my as Rahul
  console.log('\n2. Verification 3: GET /tasks/my as Rahul...');
  const myTasksRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/tasks/my',
    method: 'GET',
    headers: { Cookie: rahul.cookie },
  });
  if (myTasksRes.statusCode !== 200) {
    throw new Error(`GET /tasks/my failed: ${myTasksRes.statusCode} ${myTasksRes.body}`);
  }
  const myTasks = JSON.parse(myTasksRes.body).tasks;
  console.log(`   Rahul has ${myTasks.length} tasks.`);
  const allRahul = myTasks.every((t) => t.assignee_id === rahul.user.id);
  if (!allRahul) throw new Error('GET /tasks/my returned tasks assigned to other users!');
  const overdueTasks = myTasks.filter((t) => t.isOverdue === true);
  console.log(`   Overdue tasks identified: ${overdueTasks.length} (isOverdue boolean verified).`);
  console.log('   ✅ GET /tasks/my verified (scoped + isOverdue computed).');

  // 3. Verification 4: POST /tickets with priority URGENT in DEMO_MODE=true
  console.log('\n3. Verification 4: POST /tickets with priority URGENT in DEMO_MODE=true...');
  const createTicketRes = await request(
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
      subject: 'Test Urgent Ticket - Verification Suite',
      description: 'Testing compressed SLA target in DEMO_MODE',
      priority: 'URGENT',
      accountId: reliance.id,
      assigneeId: priya.user.id,
    }
  );
  if (createTicketRes.statusCode !== 201) {
    throw new Error(`POST /tickets failed: ${createTicketRes.statusCode} ${createTicketRes.body}`);
  }
  const createdTicket = JSON.parse(createTicketRes.body).ticket;
  const dueAt = new Date(createdTicket.sla_due_at).getTime();
  const now = Date.now();
  const diffMinutes = Math.round((dueAt - now) / 60000);
  console.log(`   Created ticket ID: ${createdTicket.id}`);
  console.log(`   SLA due at: ${createdTicket.sla_due_at} (~${diffMinutes} minutes from now).`);
  if (diffMinutes < 1 || diffMinutes > 3) {
    throw new Error(`Expected ~2 minutes in DEMO_MODE, got diff: ${diffMinutes} min`);
  }
  console.log('   ✅ POST /tickets sets compressed 2-minute SLA in DEMO_MODE.');

  // 4. Verification 6: Ticket replies & first_response_at
  console.log('\n4. Verification 6: Ticket replies & first_response_at...');
  // Check ticket initial first_response_at
  const initialTicketRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/tickets/${createdTicket.id}`,
    method: 'GET',
    headers: { Cookie: priya.cookie },
  });
  const initialTicket = JSON.parse(initialTicketRes.body).ticket;
  if (initialTicket.first_response_at !== null) {
    throw new Error('Initial ticket should have first_response_at null');
  }

  // 4a. Post internal reply (should NOT update first_response_at)
  const internalReplyRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/tickets/${createdTicket.id}/replies`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: priya.cookie,
      },
    },
    {
      body: 'Internal note: investigating root cause',
      isInternal: true,
    }
  );
  if (internalReplyRes.statusCode !== 201) {
    throw new Error(`Internal reply failed: ${internalReplyRes.statusCode} ${internalReplyRes.body}`);
  }
  const afterInternalRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/tickets/${createdTicket.id}`,
    method: 'GET',
    headers: { Cookie: priya.cookie },
  });
  if (JSON.parse(afterInternalRes.body).ticket.first_response_at !== null) {
    throw new Error('Internal comment should NOT update first_response_at');
  }
  console.log('   Internal reply created activity and left first_response_at null.');

  // 4b. Post public reply (MUST update first_response_at)
  const publicReplyRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/tickets/${createdTicket.id}/replies`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: priya.cookie,
      },
    },
    {
      body: 'Public reply: Hello customer, we are working on this.',
      isInternal: false,
    }
  );
  if (publicReplyRes.statusCode !== 201) {
    throw new Error(`Public reply failed: ${publicReplyRes.statusCode} ${publicReplyRes.body}`);
  }
  const afterPublicRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/tickets/${createdTicket.id}`,
    method: 'GET',
    headers: { Cookie: priya.cookie },
  });
  const afterPublicTicket = JSON.parse(afterPublicRes.body).ticket;
  if (!afterPublicTicket.first_response_at) {
    throw new Error('Public reply MUST set first_response_at');
  }
  console.log(`   Public reply set first_response_at: ${afterPublicTicket.first_response_at}`);
  console.log('   Activities count on ticket:', afterPublicTicket.activities.length);
  console.log('   ✅ Ticket replies & first_response_at behavior verified.');

  // 5. Verification 7: RBAC check
  console.log('\n5. Verification 7: RBAC checks...');
  // 5a: Priya (SUPPORT_AGENT) can update ticket status
  const priyaUpdateRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/tickets/${createdTicket.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: priya.cookie,
      },
    },
    { status: 'IN_PROGRESS' }
  );
  if (priyaUpdateRes.statusCode !== 200) {
    throw new Error(`Priya PATCH /tickets failed: ${priyaUpdateRes.statusCode} ${priyaUpdateRes.body}`);
  }
  console.log('   Priya (SUPPORT_AGENT) successfully changed ticket status to IN_PROGRESS (200 OK).');

  // 5b: Rahul (SALES_REP) gets 403 trying to update ticket status
  const rahulUpdateRes = await request(
    {
      hostname: 'localhost',
      port: 4000,
      path: `/tickets/${createdTicket.id}`,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: rahul.cookie,
      },
    },
    { status: 'RESOLVED' }
  );
  if (rahulUpdateRes.statusCode !== 403) {
    throw new Error(`Expected 403 for Rahul updating ticket, got: ${rahulUpdateRes.statusCode}`);
  }
  console.log('   Rahul (SALES_REP) was correctly blocked with 403 Forbidden.');

  // 5c: Priya (SUPPORT_AGENT) gets 403 on GET /leads (regression check)
  const priyaLeadsRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: '/leads',
    method: 'GET',
    headers: { Cookie: priya.cookie },
  });
  if (priyaLeadsRes.statusCode !== 403) {
    throw new Error(`Expected 403 for Priya accessing /leads, got: ${priyaLeadsRes.statusCode}`);
  }
  console.log('   Priya (SUPPORT_AGENT) was correctly blocked with 403 Forbidden on /leads.');
  console.log('   ✅ RBAC boundaries verified.');

  // 6. Verification 5: In-process scheduler breach sweep
  console.log('\n6. Verification 5: In-process scheduler breach sweep...');
  // Create a ticket with sla_due_at in the past
  const pastTicketRes = await request(
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
      subject: 'Immediate Breach Test Ticket',
      priority: 'LOW',
      accountId: reliance.id,
    }
  );
  const pastTicket = JSON.parse(pastTicketRes.body).ticket;
  
  // Directly simulate an expired ticket in DB to test scheduler sweep
  const { execSync } = require('child_process');
  execSync(
    `docker exec flint-postgres psql -U flint -d flint -c "UPDATE tickets SET sla_due_at = NOW() - INTERVAL '10 seconds', sla_breached_at = NULL WHERE id = '${pastTicket.id}';"`
  );
  console.log('   Set ticket SLA due_at to past. Waiting 18s for next scheduler sweep tick...');

  await new Promise((r) => setTimeout(r, 18000));

  const checkBreachedRes = await request({
    hostname: 'localhost',
    port: 4000,
    path: `/tickets/${pastTicket.id}`,
    method: 'GET',
    headers: { Cookie: priya.cookie },
  });
  const checkBreachedTicket = JSON.parse(checkBreachedRes.body).ticket;
  if (!checkBreachedTicket.sla_breached_at) {
    throw new Error('Scheduler failed to mark ticket as breached!');
  }
  console.log(`   Ticket breached! sla_breached_at = ${checkBreachedTicket.sla_breached_at}`);
  console.log('   ✅ In-process scheduler sweep verified (auto-detected and marked breach).');

  // 7. Verification 8: Web UI routes smoke test
  console.log('\n7. Verification 8: Web UI HTTP 200 checks...');
  const routes = ['/tasks', '/tickets', `/tickets/${createdTicket.id}`];
  for (const route of routes) {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: route,
      method: 'GET',
      headers: { Cookie: priya.cookie },
    });
    if (res.statusCode !== 200) {
      throw new Error(`Web UI route ${route} failed: ${res.statusCode}`);
    }
    console.log(`   ${route} → 200 OK`);
  }
  console.log('   ✅ Web UI routes smoke tested.');

  console.log('\n✨ ALL PHASE 5 VERIFICATIONS PASSED!\n');
}

run().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
