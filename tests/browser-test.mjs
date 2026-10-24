import { chromium } from 'file:///C:/Users/Kurui/AppData/Roaming/npm/node_modules/@playwright/cli/node_modules/playwright-core/index.mjs';
import fs from 'node:fs';

fs.mkdirSync('tests/screenshots', { recursive: true });

async function run() {
  console.log('Launching chromium...');
  const browser = await chromium.launch({ headless: true });
  // Set colorScheme to dark
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark'
  });
  const page = await context.newPage();
  
  console.log('Navigating to http://localhost:4173...');
  await page.goto('http://localhost:4173/');
  await page.waitForLoadState('networkidle');

  console.log('Page title:', await page.title());

  // Capture overview screenshot in DARK
  await page.screenshot({ path: 'tests/screenshots/01-overview-dark.png' });
  console.log('Saved 01-overview-dark.png');

  // Click Speed Test
  await page.click('button:has-text("Speed Test")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/02-speedtest-dark.png' });
  console.log('Saved 02-speedtest-dark.png');

  // Click Diagnostics
  await page.click('button:has-text("Diagnostics")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/03-diagnostics-dark.png' });
  console.log('Saved 03-diagnostics-dark.png');

  // Click Connection Details
  await page.click('button:has-text("Connection Details")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/04-connection-details-dark.png' });
  console.log('Saved 04-connection-details-dark.png');

  // Click Data Usage
  await page.click('button:has-text("Data Usage")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/05-data-usage-dark.png' });
  console.log('Saved 05-data-usage-dark.png');

  // Click Reports & History
  await page.click('button:has-text("Reports & History")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/06-reports-history-dark.png' });
  console.log('Saved 06-reports-history-dark.png');

  // Click AI Troubleshooter
  await page.click('button:has-text("AI Troubleshooter")');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/screenshots/07-ai-troubleshooter-dark.png' });
  console.log('Saved 07-ai-troubleshooter-dark.png');

  // Switch to light mode via button
  const themeBtn = page.locator('button[title*="Appearance"], button[aria-label*="Appearance"]');
  if (await themeBtn.count() > 0) {
    await themeBtn.first().click();
    await page.waitForTimeout(400);
    // Cycle until light if it was system or dark
    const htmlTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (htmlTheme !== 'light') {
      await themeBtn.first().click();
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: 'tests/screenshots/08-ai-troubleshooter-light.png' });
    console.log('Saved 08-ai-troubleshooter-light.png');
    
    // Overview in light mode
    await page.click('button:has-text("Overview")');
    await page.waitForTimeout(400);
    await page.screenshot({ path: 'tests/screenshots/09-overview-light.png' });
    console.log('Saved 09-overview-light.png');
  }

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Error during browser run:', err);
  process.exit(1);
});
