const { chromium } = require('playwright');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1512, height: 982 },
  { width: 1728, height: 1117 },
  { width: 1920, height: 1080 },
];

function runCmd(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function runPsqlRaw(query) {
  const cmd = `docker exec flint-postgres psql -U flint -d flint -t -A -c "${query.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function runPsql(query) {
  const cmd = `docker exec flint-postgres psql -U flint -d flint -c "${query.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function dragCard(page, cardLocator, targetColumnLocator) {
  const a = await cardLocator.boundingBox();
  const b = await targetColumnLocator.boundingBox();
  const sx = a.x + a.width / 2, sy = a.y + a.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + 12, sy + 12, { steps: 6 });
  await page.mouse.move(b.x + b.width / 2, b.y + 80, { steps: 30 });
  await page.waitForTimeout(400);
  await page.mouse.up();
  await page.waitForTimeout(800);
}

async function verifyViewport(browser, vp) {
  const vpStr = `${vp.width}x${vp.height}`;
  console.log(`\n==================================================`);
  console.log(`Testing Viewport: ${vpStr}`);
  console.log(`==================================================`);

  // a) pnpm db:reset
  runCmd('pnpm db:reset');

  const context = await browser.newContext({ viewport: vp });
  const page = await context.newPage();

  const capturedConsole = [];
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    capturedConsole.push(`[${type}] ${text}`);
    if (text.toLowerCase().includes('nested scroll') || text.toLowerCase().includes('unsupported')) {
      console.warn(`⚠️ [CONSOLE WARNING] ${text}`);
    }
  });

  page.on('pageerror', (err) => {
    capturedConsole.push(`[PAGEERROR] ${err.message}`);
    console.error(`❌ [PAGE ERROR] ${err.message}`);
  });

  // Login as Admin
  await page.goto('http://localhost:3000/login');
  await page.waitForLoadState('networkidle');
  await page.click('button:has-text("Demo as Admin")');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Open /deals
  await page.goto('http://localhost:3000/deals');
  await page.waitForSelector('[data-rfd-droppable-id]', { timeout: 10000 });

  // b) Locate card and Closed Won droppable
  const wonStageId = runPsqlRaw("SELECT id FROM pipeline_stages WHERE name = 'Closed Won';");
  const wonColumn = page.locator(`[data-rfd-droppable-id="${wonStageId}"]`);
  await wonColumn.waitFor({ timeout: 5000 });

  const card = page.locator('[data-rfd-draggable-id]').filter({ hasText: 'Infosys - Full Enterprise Migration' }).first();
  await card.waitFor({ timeout: 5000 });

  // c) Make both visible
  await wonColumn.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  let a = await card.boundingBox();
  let b = await wonColumn.boundingBox();

  // If one is cut off or Won column is pushed against the right screen boundary,
  // scroll the board container horizontally until both fit comfortably
  const board = page.locator('.overflow-x-auto').first();
  if (a.x < 280 || (b.x + b.width) > (vp.width - 150)) {
    await board.evaluate((el, { cardLeft }) => {
      // scroll so Negotiation column starts around x = 320 (clear of 256px sidebar + padding)
      el.scrollLeft = Math.max(0, el.scrollLeft + (cardLeft - 320));
    }, { cardLeft: a.x });
    await page.waitForTimeout(200);
    a = await card.boundingBox();
    b = await wonColumn.boundingBox();
  }

  const bothFit = a.x >= 260 && (b.x + b.width) <= vp.width;
  console.log(`  Card bounds: x=${a.x.toFixed(1)}, width=${a.width.toFixed(1)}`);
  console.log(`  Closed Won bounds: x=${b.x.toFixed(1)}, width=${b.width.toFixed(1)}`);
  console.log(`  Both Negotiation & Closed Won visible in viewport: ${bothFit}`);

  // d) Drag card
  console.log(`  Executing dragCard...`);
  await dragCard(page, card, wonColumn);
  await page.waitForTimeout(1000);

  // Capture screenshot after drop
  fs.mkdirSync('/tmp/10e', { recursive: true });
  await page.screenshot({ path: `/tmp/10e/drag_${vpStr}.png` });

  await context.close();

  // e) Assert in DB
  const dealStage = runPsqlRaw("SELECT s.name FROM deals d JOIN pipeline_stages s ON d.stage_id = s.id WHERE d.title = 'Infosys - Full Enterprise Migration';");
  const isWon = dealStage === 'Closed Won';

  const historyCount = runPsqlRaw("SELECT count(*) FROM deal_stage_history h JOIN pipeline_stages fs ON h.from_stage_id = fs.id JOIN pipeline_stages ts ON h.to_stage_id = ts.id WHERE h.deal_id = (SELECT id FROM deals WHERE title = 'Infosys - Full Enterprise Migration') AND fs.name = 'Negotiation' AND ts.name = 'Closed Won';");
  const hasHistory = parseInt(historyCount, 10) >= 1;

  const taskCount = runPsqlRaw("SELECT count(*) FROM tasks WHERE deal_id = (SELECT id FROM deals WHERE title = 'Infosys - Full Enterprise Migration') AND title LIKE 'Onboarding: %setup for Infosys Retail';");
  const tasksMatched = parseInt(taskCount, 10);

  const passed = isWon && hasHistory && tasksMatched === 3;
  const statusStr = passed ? 'PASS' : 'FAIL';

  // f) print one line per viewport: "WxH | DRAG: PASS/FAIL | stage | history | onboardingTasks"
  const line = `${vpStr.padEnd(10)} | DRAG: ${statusStr.padEnd(4)} | stage: ${(isWon ? 'Closed Won' : dealStage).padEnd(10)} | history: ${(hasHistory ? 'YES' : 'NO').padEnd(3)} | onboardingTasks: ${tasksMatched}/3`;
  console.log(`>>> RESULT: ${line}`);

  return {
    viewport: vpStr,
    passed,
    line,
    consoleLogs: capturedConsole,
  };
}

async function main() {
  console.log('======================================================================');
  console.log('       VERIFY KANBAN VIEWPORTS: LAPTOP & DESKTOP DRAG AUDIT           ');
  console.log('======================================================================');

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });

  const results = [];
  const allConsoleWarnings = [];

  for (const vp of VIEWPORTS) {
    try {
      const res = await verifyViewport(browser, vp);
      results.push(res);
      const warnings = res.consoleLogs.filter((l) =>
        l.toLowerCase().includes('nested scroll') || l.toLowerCase().includes('unsupported') || l.toLowerCase().includes('[pageerror]')
      );
      if (warnings.length > 0) {
        allConsoleWarnings.push({ vp: res.viewport, warnings });
      }
    } catch (err) {
      console.error(`Error verifying ${vp.width}x${vp.height}:`, err.message);
      results.push({
        viewport: `${vp.width}x${vp.height}`,
        passed: false,
        line: `${(`${vp.width}x${vp.height}`).padEnd(10)} | DRAG: FAIL | stage: ERROR      | history: NO  | onboardingTasks: 0/3`,
        consoleLogs: [],
      });
    }
  }

  await browser.close();

  console.log('\n======================================================================');
  console.log('                  KANBAN VIEWPORTS VERIFICATION SUMMARY               ');
  console.log('======================================================================');
  for (const r of results) {
    console.log(r.line);
  }
  console.log('======================================================================');

  console.log('\nConsole Warnings / Errors Captured during audit:');
  if (allConsoleWarnings.length === 0) {
    console.log('none (zero nested scroll warnings, zero console errors)');
  } else {
    allConsoleWarnings.forEach((w) => {
      console.log(`[${w.vp}]:`, w.warnings);
    });
  }

  const allPassed = results.every((r) => r.passed);
  if (!allPassed) {
    console.error('\n❌ FAIL: One or more viewports failed Kanban drag-and-drop verification.');
    process.exit(1);
  }

  console.log('\n✅ PASS: All 5 viewports verified successfully with 0 errors.');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
