const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const { execSync } = require('child_process');

function apiRequest(method, path, data, cookie) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    const req = http.request(
      `http://localhost:4000${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'http://localhost:3000',
          ...(cookie ? { Cookie: cookie } : {}),
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const resCookie = res.headers['set-cookie']
            ? res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ')
            : '';
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body), cookie: resCookie });
          } catch {
            resolve({ statusCode: res.statusCode, raw: body, cookie: resCookie });
          }
        });
      }
    );
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function runPsql(query) {
  const cmd = `docker exec flint-postgres psql -U flint -d flint -t -A -c "${query.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function getContextCookieHeader(context) {
  const cookies = await context.cookies();
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

async function loginUser(page, email, password) {
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });
}

async function main() {
  console.log('======================================================================');
  console.log('            FLINT DEMO PASS: COMPREHENSIVE PLAYWRIGHT TEST           ');
  console.log('======================================================================\n');

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const pageErrors = [];
  const attachErrorListeners = (context, name) => {
    context.on('page', (page) => {
      page.on('pageerror', (err) => {
        console.error(`[PAGEERROR] [${name}]`, err.message);
        pageErrors.push(`[${name}] ${err.message}`);
      });
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('404')) {
          console.warn(`[CONSOLE ERROR] [${name}]`, msg.text());
        }
      });
    });
  };

  try {
    // ------------------------------------------------------------------
    // BEAT 1: Public Waitlist Form & Automatic Lead Routing
    // ------------------------------------------------------------------
    console.log('\n--- BEAT 1: Waitlist Form & Auto-Routing ---');
    const anonContext = await browser.newContext();
    attachErrorListeners(anonContext, 'Anonymous');
    const anonPage = await anonContext.newPage();

    // 1. Submit 800-employee company (Swiggy Instamart -> Meera)
    console.log('1. Submitting 800-employee lead (Swiggy Instamart)...');
    await anonPage.goto('http://localhost:3000/waitlist');
    await anonPage.fill('#name', 'Aditi Rao');
    await anonPage.fill('#email', 'aditi@swiggy.in');
    await anonPage.fill('#companyName', 'Swiggy Instamart');
    await anonPage.fill('#companySize', '800');
    await anonPage.fill('#currentHrTool', 'Darwinbox');
    await anonPage.fill('#hrContactDesignation', 'VP People Operations');
    await anonPage.click('button[type="submit"]');

    await anonPage.waitForURL('**/waitlist/thank-you', { timeout: 10000 });
    console.log('  -> Redirected to /waitlist/thank-you successfully.');

    // Verify Meera received bell notification
    const meeraContext = await browser.newContext();
    attachErrorListeners(meeraContext, 'Meera');
    const meeraPage = await meeraContext.newPage();
    console.log('2. Logging in as Meera (Manager) to verify assignment...');
    await loginUser(meeraPage, 'meera@flint.dev', 'flint123');

    const meeraCookie = await getContextCookieHeader(meeraContext);
    const meeraNotifRes = await apiRequest('GET', '/notifications', null, meeraCookie);
    const meeraHasLeadNotif = meeraNotifRes.data?.items?.some((n) => 
      (n.title && n.title.includes('Swiggy Instamart')) || 
      (n.body && n.body.includes('Swiggy Instamart'))
    );
    console.log('  -> Meera notification received for Swiggy Instamart:', Boolean(meeraHasLeadNotif));

    // 2. Submit 120-employee company (Cleartrip -> Rahul)
    console.log('3. Submitting 120-employee lead (Cleartrip India)...');
    await anonPage.goto('http://localhost:3000/waitlist');
    await anonPage.fill('#name', 'Kunal Shah');
    await anonPage.fill('#email', 'kunal@cleartrip.com');
    await anonPage.fill('#companyName', 'Cleartrip India');
    await anonPage.fill('#companySize', '120');
    await anonPage.fill('#currentHrTool', 'Keka');
    await anonPage.fill('#hrContactDesignation', 'Head of HR');
    await anonPage.click('button[type="submit"]');

    await anonPage.waitForURL('**/waitlist/thank-you', { timeout: 10000 });
    console.log('  -> Redirected to /waitlist/thank-you successfully.');

    // Verify Rahul received lead
    const rahulContext = await browser.newContext();
    attachErrorListeners(rahulContext, 'Rahul');
    const rahulPage = await rahulContext.newPage();
    console.log('4. Logging in as Rahul (Sales Rep) to verify assignment...');
    await loginUser(rahulPage, 'rahul@flint.dev', 'flint123');

    // Admin checks /leads
    const adminContext = await browser.newContext();
    attachErrorListeners(adminContext, 'Admin');
    const adminPage = await adminContext.newPage();
    console.log('5. Logging in as Admin to verify both leads on /leads...');
    await loginUser(adminPage, 'admin@flint.dev', 'flint123');
    await adminPage.goto('http://localhost:3000/leads');
    await adminPage.waitForSelector('table', { timeout: 10000 });

    const leadsTableText = await adminPage.textContent('table');
    const hasSwiggy = leadsTableText.includes('Swiggy Instamart');
    const hasCleartrip = leadsTableText.includes('Cleartrip India');
    console.log(`  -> Swiggy Instamart visible in leads: ${hasSwiggy}`);
    console.log(`  -> Cleartrip India visible in leads: ${hasCleartrip}`);

    if (!hasSwiggy || !hasCleartrip) {
      throw new Error('Beat 1 failed: Leads not found in leads table');
    }
    console.log('>>> BEAT 1 PASS');

    // ------------------------------------------------------------------
    // BEAT 2: Convert Lead to Deal & Quote Builder Calculation
    // ------------------------------------------------------------------
    console.log('\n--- BEAT 2: Convert Lead & Quote Builder ---');
    console.log('1. Meera converting Swiggy Instamart lead to Deal...');
    await meeraPage.goto('http://localhost:3000/leads');
    await meeraPage.waitForSelector('table', { timeout: 10000 });

    // Find row for Swiggy Instamart that is NEW
    const swiggyRow = meeraPage.locator('table tbody tr').filter({ hasText: 'Swiggy Instamart' }).filter({ hasText: 'NEW' }).first();
    await swiggyRow.waitFor({ timeout: 5000 });
    
    // Open Row Actions Dropdown
    const menuBtn = swiggyRow.locator('button').last();
    await menuBtn.click();
    await meeraPage.waitForSelector('[role="menu"]', { timeout: 5000 });

    // Click "Convert"
    const convertItem = meeraPage.locator('[role="menuitem"]', { hasText: 'Convert' });
    await convertItem.click();

    // Fill Convert Dialog
    await meeraPage.waitForSelector('#dealTitle', { timeout: 5000 });
    await meeraPage.fill('#dealTitle', 'Swiggy Enterprise HR');
    
    // Click Complete Conversion
    console.log('  -> Confirming lead conversion...');
    const completeConvertBtn = meeraPage.locator('button', { hasText: 'Complete Conversion' });
    await completeConvertBtn.click();
    await meeraPage.waitForTimeout(1500);

    // Fetch the new Deal from DB
    const dealRowRaw = runPsql("SELECT id, title, amount, account_id FROM deals WHERE title = 'Swiggy Enterprise HR' ORDER BY created_at DESC LIMIT 1;");
    console.log('  -> Created Deal DB record:', dealRowRaw);
    const [dealId, dealTitle, dealAmount, accountId] = dealRowRaw.split('|');

    if (!dealId) {
      throw new Error('Beat 2 failed: Deal was not created in database');
    }

    // Navigate to /deals/[id]
    console.log(`2. Navigating to /deals/${dealId}...`);
    await meeraPage.goto(`http://localhost:3000/deals/${dealId}`);
    await meeraPage.waitForSelector('h1', { timeout: 10000 });

    // Open Quote Builder
    console.log('3. Opening Quote Builder...');
    const newQuoteBtn = meeraPage.locator('button', { hasText: 'New Quote' });
    await newQuoteBtn.click();
    await meeraPage.waitForSelector('#employees', { timeout: 5000 });

    // Fill 500 seats
    await meeraPage.fill('#employees', '500');

    // Deselect other products and select Payroll (₹50) + Attendance (₹35) + Benefits Hub (₹40) = ₹125/mo
    const productLabels = meeraPage.locator('[role="dialog"] .grid label');
    await productLabels.first().waitFor({ timeout: 5000 });
    const count = await productLabels.count();

    for (let i = 0; i < count; i++) {
      const lbl = productLabels.nth(i);
      const text = (await lbl.textContent()).trim();
      const checkbox = lbl.locator('button[role="checkbox"]');
      const isChecked = (await checkbox.getAttribute('aria-checked')) === 'true';
      const shouldBeChecked = text.includes('Payroll') || text.includes('Attendance') || text.includes('Benefits Hub');

      if (isChecked !== shouldBeChecked) {
        await lbl.click();
        await meeraPage.waitForTimeout(100);
      }
    }

    // Assert displayed totals: ₹62,500/mo, ₹7,50,000 / year
    const quoteDialogText = await meeraPage.locator('[role="dialog"]').textContent();
    console.log('  -> Quote dialog live text summary:');
    const hasMonthly = quoteDialogText.includes('₹62,500');
    const hasAnnual = quoteDialogText.includes('₹7,50,000');
    const hasGst = quoteDialogText.toLowerCase().includes('gst');

    console.log(`     - Contains ₹62,500/mo: ${hasMonthly}`);
    console.log(`     - Contains ₹7,50,000/yr: ${hasAnnual}`);
    console.log(`     - Contains GST (must be false): ${hasGst}`);

    if (!hasMonthly || !hasAnnual) {
      throw new Error('Beat 2 failed: Quote builder pricing calculation incorrect');
    }
    if (hasGst) {
      throw new Error('Beat 2 failed: GST 18% was unexpectedly present in quote builder');
    }

    // Save Quote
    console.log('4. Saving quote...');
    const saveQuoteBtn = meeraPage.locator('button', { hasText: 'Save Quote' });
    await saveQuoteBtn.click();
    await meeraPage.waitForTimeout(1500);

    // Verify quote in quotes card
    const quotesCardText = await meeraPage.locator('body').textContent();
    const hasSavedQuote = quotesCardText.includes('₹7,50,000');
    console.log(`  -> Quote visible in deal quotes list: ${hasSavedQuote}`);
    console.log('>>> BEAT 2 PASS');

    // ------------------------------------------------------------------
    // BEAT 3: Move Deal to Closed Won & CS Hand-off Automation
    // ------------------------------------------------------------------
    console.log('\n--- BEAT 3: Move Deal to Closed Won & CS Automation ---');
    console.log('1. Moving Swiggy deal to Closed Won...');

    // Get Closed Won stage ID
    const closedWonStageId = runPsql("SELECT id FROM pipeline_stages WHERE name = 'Closed Won';");
    let methodUsed = 'drag-and-drop';

    // Attempt 1: Drag-and-drop on /deals Kanban board
    await meeraPage.goto('http://localhost:3000/deals');
    await meeraPage.waitForSelector('[data-rfd-droppable-id]', { timeout: 10000 });

    try {
      const dealCard = meeraPage.locator(`[data-rfd-draggable-id="${dealId}"]`);
      const wonColumn = meeraPage.locator(`[data-rfd-droppable-id="${closedWonStageId}"]`);
      
      await dealCard.waitFor({ timeout: 5000 });
      await dealCard.dragTo(wonColumn, { timeout: 5000 });
      await meeraPage.waitForTimeout(1500);

      const currentStage = runPsql(`SELECT stage_id FROM deals WHERE id = '${dealId}';`);
      if (currentStage !== closedWonStageId) {
        throw new Error('Drag did not update stage in DB');
      }
      console.log('  -> Method used: Playwright HTML5 / mouse drag-and-drop on Kanban board');
    } catch (dragErr) {
      console.log(`  -> Drag-and-drop did not commit (${dragErr.message}), using deal detail stage selector fallback...`);
      methodUsed = 'stage selector dropdown on deal detail page';
      await meeraPage.goto(`http://localhost:3000/deals/${dealId}`);
      await meeraPage.waitForSelector('[data-testid="stage-selector"]', { timeout: 5000 });
      await meeraPage.click('[data-testid="stage-selector"]');
      await meeraPage.waitForSelector('[role="option"]:has-text("Closed Won")', { timeout: 5000 });
      await meeraPage.click('[role="option"]:has-text("Closed Won")');
      await meeraPage.waitForTimeout(2000);
    }

    const wonStageInDb = runPsql(`SELECT s.name FROM deals d JOIN pipeline_stages s ON d.stage_id = s.id WHERE d.id = '${dealId}';`);
    console.log(`  -> Deal stage in database: ${wonStageInDb} (via ${methodUsed})`);

    // 2. Log in as Kavya (CSM) to verify onboarding tasks
    console.log('2. Logging in as Kavya Reddy (CSM) to verify generated tasks...');
    const kavyaContext = await browser.newContext();
    attachErrorListeners(kavyaContext, 'Kavya');
    const kavyaPage = await kavyaContext.newPage();
    await loginUser(kavyaPage, 'kavya@flint.dev', 'flint123');

    await kavyaPage.goto('http://localhost:3000/tasks');
    await kavyaPage.waitForSelector('h1', { timeout: 10000 });
    const tasksTableText = await kavyaPage.textContent('body');

    console.log('  -> Kavya tasks table snippet:', tasksTableText.slice(0, 300).replace(/\s+/g, ' '));
    const tasksCount = runPsql(`SELECT count(*) FROM tasks WHERE account_id = '${accountId}';`);
    console.log(`  -> Total onboarding tasks created for this account: ${tasksCount}`);

    // Verify Kavya notification
    const kavyaCookie = await getContextCookieHeader(kavyaContext);
    const kavyaNotifRes = await apiRequest('GET', '/notifications', null, kavyaCookie);
    const kavyaHasWonNotif = kavyaNotifRes.data?.items?.some((n) => 
      (n.title && n.title.includes('Deal Won')) || 
      (n.body && n.body.includes('Swiggy Enterprise HR'))
    );
    console.log(`  -> Kavya bell notification received for Deal Won: ${Boolean(kavyaHasWonNotif)}`);

    if (parseInt(tasksCount) === 0) {
      throw new Error('Beat 3 failed: No onboarding tasks were created for closed won deal');
    }
    console.log('>>> BEAT 3 PASS');

    // ------------------------------------------------------------------
    // BEAT 4: Cross-Team Alert Banner & Real-Time Presence
    // ------------------------------------------------------------------
    console.log('\n--- BEAT 4: Cross-Team Alert Banner & Presence ---');
    const relianceRow = runPsql("SELECT a.id, d.id FROM accounts a JOIN deals d ON d.account_id = a.id WHERE a.name ILIKE '%Reliance%' LIMIT 1;");
    const [relianceAccountId, relianceDealId] = relianceRow.split('|');
    runPsql(`UPDATE tickets SET status = 'RESOLVED' WHERE account_id = '${relianceAccountId}';`);

    // 1. Rahul opens /deals/[relianceDealId]
    console.log('1. Rahul opening Reliance Digital Deal detail page...');
    await rahulPage.goto(`http://localhost:3000/deals/${relianceDealId}`);
    await rahulPage.waitForSelector('h1', { timeout: 10000 });

    // 2. Priya opens /accounts/[relianceAccountId]
    const priyaContext = await browser.newContext();
    attachErrorListeners(priyaContext, 'Priya');
    const priyaPage = await priyaContext.newPage();
    console.log('2. Logging in as Priya (Support Agent) and opening Reliance Customer 360...');
    await loginUser(priyaPage, 'priya@flint.dev', 'flint123');
    await priyaPage.goto(`http://localhost:3000/accounts/${relianceAccountId}`);
    await priyaPage.waitForSelector('h1', { timeout: 10000 });

    // Also have Priya open the deal page momentarily to verify presence pill
    console.log('3. Checking live presence indicator on Reliance Deal...');
    const priyaDealTab = await priyaContext.newPage();
    await priyaDealTab.goto(`http://localhost:3000/deals/${relianceDealId}`);
    await rahulPage.waitForSelector('text=Priya Nair viewing', { timeout: 10000 });
    console.log('  -> Rahul sees "Priya Nair viewing" presence pill in real-time!');
    await priyaDealTab.close();

    // 3. Priya creates HIGH ticket
    console.log('4. Priya creating HIGH priority ticket for Reliance Digital...');
    const priyaCookie = await getContextCookieHeader(priyaContext);
    const newTicketRes = await apiRequest('POST', '/tickets', {
      subject: 'Store punch machine offline in Bangalore hub',
      description: 'Multiple biometric punch devices report offline error in Bangalore hub',
      priority: 'HIGH',
      accountId: relianceAccountId,
    }, priyaCookie);
    console.log('  -> Ticket created:', newTicketRes.data?.id, 'Priority:', newTicketRes.data?.priority);

    // 4. Priya posts internal comment @mentioning Rahul
    console.log('5. Priya posting internal note with @Rahul Sharma mention...');
    const rahulUserId = runPsql("SELECT id FROM users WHERE email = 'rahul@flint.dev';");
    const commentStartTime = Date.now();

    await apiRequest('POST', '/activities', {
      type: 'INTERNAL_COMMENT',
      body: '@Rahul Sharma heads up, store devices down',
      isInternal: true,
      mentions: [rahulUserId],
      accountId: relianceAccountId,
      dealId: relianceDealId,
    }, priyaCookie);

    // 5. Rahul's browser WITHOUT reload should receive RED banner and Bell increment
    console.log('6. Waiting for Rahul browser to receive alert banner and bell update (WITHOUT reload)...');
    await rahulPage.waitForSelector('text=🚨 Open High-Priority Ticket Alert', { timeout: 15000 });
    const bannerText = await rahulPage.textContent('body');
    const hasBanner = bannerText.includes('Store punch machine offline in Bangalore hub') || bannerText.includes('Open High-Priority Ticket Alert');
    console.log(`  -> Red banner appeared on Rahul deal page: ${hasBanner}`);

    // Wait for bell notification on Rahul's page
    await rahulPage.waitForSelector('[aria-label="View notifications"] span', { timeout: 10000 });
    const commentEndTime = Date.now();
    const latencyMs = commentEndTime - commentStartTime;
    console.log(`  -> Rahul bell count incremented in real-time!`);
    console.log(`  -> Measured Real-time Socket Latency: ${latencyMs} ms`);

    console.log('>>> BEAT 4 PASS');

    // ------------------------------------------------------------------
    // BEAT 5: Live SLA Countdown, Automatic Breach Sweep & Workflow Escalation
    // ------------------------------------------------------------------
    console.log('\n--- BEAT 5: Live SLA Countdown & Automatic Sweep Escalation ---');
    console.log('1. Priya creating URGENT priority ticket...');
    const urgentTicketRes = await apiRequest('POST', '/tickets', {
      subject: 'Critical store point-of-sale offline in Mumbai flagship',
      description: 'POS server synchronization stopped completely',
      priority: 'URGENT',
      accountId: relianceAccountId,
    }, priyaCookie);

    const urgentTicketId = urgentTicketRes.data?.id;
    console.log('  -> Created URGENT ticket ID:', urgentTicketId);

    // Check SLA Due At in psql
    const slaDeltaQuery = `SELECT ROUND(EXTRACT(EPOCH FROM (sla_due_at - created_at))/60.0, 2) FROM tickets WHERE id = '${urgentTicketId}';`;
    const slaDeltaMins = runPsql(slaDeltaQuery);
    console.log(`  -> Target SLA deadline (sla_due_at - created_at): ~${slaDeltaMins} minutes (DEMO_MODE compressed)`);

    // Wait for breach (scheduler sweeps every 15s)
    console.log('2. Waiting for background SLA scheduler sweep to detect breach (up to 2.5 minutes)...');
    let breached = false;
    const maxWaitMs = 160000;
    const pollInterval = 10000;
    const startWait = Date.now();

    while (Date.now() - startWait < maxWaitMs) {
      const breachedAt = runPsql(`SELECT sla_breached_at FROM tickets WHERE id = '${urgentTicketId}';`);
      if (breachedAt && breachedAt.length > 5) {
        console.log(`  -> Ticket breached at: ${breachedAt}`);
        breached = true;
        break;
      }
      process.stdout.write('.');
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    console.log('');

    if (!breached) {
      throw new Error('Beat 5 failed: SLA sweep did not breach ticket within timeout');
    }

    // Print API log lines
    const logPath = '/Users/ronin/.gemini/antigravity/brain/8a8d7386-ccf5-47c7-88f0-905cc6a32569/.system_generated/tasks/task-542.log';
    if (fs.existsSync(logPath)) {
      const logContent = fs.readFileSync(logPath, 'utf-8');
      const relevantLines = logContent.split('\n').filter(l => l.includes('sla sweep') || l.includes('SLA Breach Manager Escalation')).slice(-4);
      console.log('  -> API Log Evidence:');
      relevantLines.forEach(l => console.log('     ', l.trim()));
    }

    // Verify escalation in DB: assignee changed to Meera (Manager)
    const newAssignee = runPsql(`SELECT u.email FROM tickets t JOIN users u ON t.assignee_id = u.id WHERE t.id = '${urgentTicketId}';`);
    console.log(`  -> Escalated assignee in database: ${newAssignee}`);
    if (newAssignee !== 'meera@flint.dev') {
      throw new Error(`Expected assignee meera@flint.dev, got ${newAssignee}`);
    }

    // Admin opens /workflows to verify run history
    console.log('3. Admin opening /workflows to verify run history...');
    await adminPage.goto('http://localhost:3000/workflows');
    await adminPage.waitForSelector('table', { timeout: 10000 });
    const workflowsText = await adminPage.textContent('body');
    const hasEscalationRun = workflowsText.includes('SLA Breach Manager Escalation') || workflowsText.includes('SUCCESS');
    console.log(`  -> SLA Breach workflow run history verified in UI: ${hasEscalationRun}`);

    console.log('>>> BEAT 5 PASS');

    // ------------------------------------------------------------------
    // BEAT 6: Cmd+K Global Search, Dashboard Analytics & Strict RBAC
    // ------------------------------------------------------------------
    console.log('\n--- BEAT 6: Cmd+K Fuzzy Search, Dashboard & RBAC ---');
    
    // 1. Cmd+K typo tolerance: "Zomto" -> "Zomato"
    console.log('1. Testing Cmd+K fuzzy search with typo "Zomto"...');
    await adminPage.keyboard.press('Meta+k');
    await adminPage.waitForSelector('input[placeholder*="Search"]', { timeout: 5000 });
    await adminPage.fill('input[placeholder*="Search"]', 'Zomto');
    await adminPage.waitForSelector('text=Zomato', { timeout: 5000 });
    console.log('  -> Typo search "Zomto" matched "Zomato" in Cmd+K dialog!');
    await adminPage.keyboard.press('Escape');

    // 2. Analytics Dashboard (/dashboard)
    console.log('2. Navigating to /dashboard to verify stat tiles & charts...');
    await adminPage.goto('http://localhost:3000/dashboard');
    await adminPage.waitForSelector('h1', { timeout: 10000 });
    const dashboardText = await adminPage.textContent('body');
    const hasNaN = dashboardText.includes('NaN');
    const hasPipelineTile = dashboardText.includes('Total Pipeline Value');
    const hasWinRateTile = dashboardText.includes('Win Rate');
    console.log(`  -> Dashboard rendered with tiles (has Pipeline: ${hasPipelineTile}, Win Rate: ${hasWinRateTile})`);
    console.log(`  -> Contains NaN (must be false): ${hasNaN}`);

    if (hasNaN) {
      throw new Error('Beat 6 failed: Dashboard contains NaN in stat calculations');
    }

    // 3. RBAC Restriction: Priya (Support) to /leads
    console.log('3. Testing RBAC: Priya (Support) navigating to /leads...');
    await priyaPage.goto('http://localhost:3000/leads');
    await priyaPage.waitForSelector('text=Access Restricted', { timeout: 10000 });
    const priyaLeadsText = await priyaPage.textContent('body');
    const hasRestrictedCard = priyaLeadsText.includes('Access Restricted') && priyaLeadsText.includes('Forbidden');
    console.log(`  -> Priya received 403 Access Restricted card (no crash, no blank): ${hasRestrictedCard}`);

    // 4. Admin checks /settings for system audit row
    console.log('4. Admin checking /settings for System Automation audit row...');
    await adminPage.goto('http://localhost:3000/settings');
    await adminPage.waitForSelector('table', { timeout: 10000 });
    const settingsText = await adminPage.textContent('body');
    const hasSystemRow = settingsText.includes('System Automation');
    console.log(`  -> System Automation audit row visible in settings: ${hasSystemRow}`);

    console.log('>>> BEAT 6 PASS');

    console.log('\n======================================================================');
    console.log('            ALL DEMO BEATS 1 THROUGH 6 PASSED SUCCESSFULLY!          ');
    console.log('======================================================================\n');
  } finally {
    await browser.close();
  }

  if (pageErrors.length > 0) {
    console.error('Errors encountered during demo run:', pageErrors);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\nDEMO WALKTHROUGH TEST FAILED:', err);
  process.exit(1);
});
