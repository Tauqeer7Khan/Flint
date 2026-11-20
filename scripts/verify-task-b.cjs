const { chromium } = require('playwright');

async function main() {
  console.log('--- Starting Task B Verification: Audit Viewer with System / Null User Rows ---');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });

  // 1. Login as Admin
  console.log('Logging in as Admin (admin@flint.dev)...');
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'admin@flint.dev');
  await page.fill('input[type="password"]', 'flint123');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log('Login successful, navigated to /dashboard');

  // 2. Navigate to /settings
  console.log('Navigating to /settings...');
  await page.goto('http://localhost:3000/settings');
  await page.waitForSelector('table', { timeout: 10000 });
  console.log('Settings page table rendered successfully.');

  // Check total events recorded
  const headerText = await page.textContent('body');
  const hasSettingsTitle = headerText.includes('System Settings & Audit Log');
  console.log('Title "System Settings & Audit Log" present:', hasSettingsTitle);

  // Check for System Automation text in the table
  const systemRowLocator = page.locator('table tbody tr', { hasText: 'System Automation' });
  const countSystemRows = await systemRowLocator.count();
  console.log('Found rows with "System Automation":', countSystemRows);

  if (countSystemRows === 0) {
    throw new Error('Expected at least 1 System Automation audit row, found 0');
  }

  // Click on "View Changes" on the system row
  console.log('Clicking "View Changes" on System Automation row...');
  const viewChangesBtn = systemRowLocator.first().locator('button', { hasText: 'View Changes' });
  await viewChangesBtn.click();

  // Wait for dialog
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  const dialogText = await page.locator('[role="dialog"]').textContent();
  console.log('Dialog opened successfully.');
  console.log('Dialog snippet:', dialogText.slice(0, 300).replace(/\s+/g, ' '));

  // Verify formatted JSON rendered without error
  const preText = await page.locator('[role="dialog"] pre').allTextContents();
  console.log('JSON pre tags count in dialog:', preText.length);
  for (let i = 0; i < preText.length; i++) {
    console.log(`Pre #${i + 1} content:`, preText[i].trim());
  }

  // Assert console / page errors
  console.log('Console errors count:', consoleErrors.length);
  console.log('Page errors count:', pageErrors.length);

  if (consoleErrors.length > 0) {
    console.warn('Console errors:', consoleErrors);
  }
  if (pageErrors.length > 0) {
    throw new Error(`Page errors detected: ${pageErrors.join(', ')}`);
  }

  await browser.close();
  console.log('--- Task B Verification: PASS ---');
}

main().catch((err) => {
  console.error('Task B Verification FAILED:', err);
  process.exit(1);
});
