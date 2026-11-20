const { chromium } = require('playwright');
const { execSync } = require('child_process');

function runPsql(query) {
  const cmd = `docker exec flint-postgres psql -U flint -d flint -t -A -c "${query.replace(/"/g, '\\"')}"`;
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

async function main() {
  console.log('=== Step 1: Performing fresh db:reset ===');
  execSync('pnpm db:reset', { stdio: 'inherit' });

  // 1. Query database counts
  const dbLeadsCount = runPsql('SELECT count(*) FROM leads;');
  const dbAuditCount = runPsql('SELECT count(*) FROM audit_logs;');

  console.log(`\nDB Raw Counts:`);
  console.log(`- leads table: ${dbLeadsCount}`);
  console.log(`- audit_logs table: ${dbAuditCount}`);

  // 2. Open browser as Admin
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'admin@flint.dev');
  await page.fill('input[type="password"]', 'flint123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  // Open /leads
  await page.goto('http://localhost:3000/leads');
  await page.waitForSelector('table tbody tr', { timeout: 10000 });
  const browserLeadsRows = await page.locator('table tbody tr').count();
  console.log(`\nBrowser Counts:`);
  console.log(`- /leads table rendered rows: ${browserLeadsRows}`);

  // Open /settings
  await page.goto('http://localhost:3000/settings');
  await page.waitForSelector('table', { timeout: 10000 });
  // If 0 logs, it displays empty state row with text "No audit logs found"
  const emptyState = await page.locator('table tbody tr:has-text("No audit logs found")').count();
  const browserAuditRows = emptyState > 0 ? 0 : await page.locator('table tbody tr').count();
  console.log(`- /settings audit logs rendered rows: ${browserAuditRows} (empty state active: ${emptyState > 0})`);

  console.log(`\nComparison & Explanation:`);
  console.log(`- /leads: DB has ${dbLeadsCount}, browser renders ${browserLeadsRows}. (Match: ${parseInt(dbLeadsCount) === browserLeadsRows})`);
  console.log(`- /settings: DB has ${dbAuditCount}, browser renders ${browserAuditRows}. (Match: ${parseInt(dbAuditCount) === browserAuditRows})`);

  await browser.close();
}

main().catch(console.error);
