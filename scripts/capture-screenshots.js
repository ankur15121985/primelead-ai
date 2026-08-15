const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'http://localhost:5173';

const pages = [
  // Marketing & Auth
  { name: '01-homepage', url: '/', wait: 2000 },
  { name: '02-login-page', url: '/login', wait: 1500 },
  
  // After login - CRM pages
  { name: '13-team', url: '/app/team', wait: 2000, needsLogin: true },
  { name: '14-billing', url: '/app/billing', wait: 2000, needsLogin: true },
  { name: '15-calendar', url: '/app/calendar', wait: 2000, needsLogin: true },
  { name: '16-contacts', url: '/app/contacts', wait: 2000, needsLogin: true },
  { name: '17-integrations', url: '/app/integrations', wait: 2000, needsLogin: true },
  { name: '18-lead-detail', url: '/app/leads', wait: 2000, needsLogin: true, clickLead: true },
  { name: '19-admin', url: '/admin', wait: 2000, needsLogin: true },
  { name: '20-onboarding', url: '/app/onboarding', wait: 2000, needsLogin: true },
];

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForTimeout(1000);
  
  // Fill in login form
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  const passwordInput = await page.$('input[type="password"], input[name="password"]');
  
  if (emailInput && passwordInput) {
    await emailInput.fill('owner@primelead.demo');
    await passwordInput.fill('Demo@1234');
    
    // Click login button
    const loginButton = await page.$('button[type="submit"], button:has-text("Log in"), button:has-text("Login")');
    if (loginButton) {
      await loginButton.click();
      await page.waitForTimeout(3000);
      console.log('✓ Logged in successfully');
    }
  }
}

async function captureScreenshots() {
  console.log('🚀 Starting screenshot capture...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  
  const page = await context.newPage();
  
  let isLoggedIn = false;
  
  for (const pageInfo of pages) {
    try {
      console.log(`📸 Capturing: ${pageInfo.name}`);
      
      // Login if needed and not yet logged in
      if (pageInfo.needsLogin && !isLoggedIn) {
        await login(page);
        isLoggedIn = true;
      }
      
      // Navigate to page
      await page.goto(`${BASE_URL}${pageInfo.url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(pageInfo.wait || 2000);
      
      // Click on first lead if needed
      if (pageInfo.clickLead) {
        const firstLead = await page.$('table tbody tr:first-child a, [data-testid="lead-row"]:first-child, .lead-row:first-child');
        if (firstLead) {
          await firstLead.click();
          await page.waitForTimeout(2000);
        }
      }
      
      // Take screenshot
      const screenshotPath = path.join(SCREENSHOTS_DIR, `${pageInfo.name}.png`);
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: false,
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      
      console.log(`  ✓ Saved: ${pageInfo.name}.png`);
      
    } catch (error) {
      console.log(`  ❌ Error capturing ${pageInfo.name}: ${error.message}`);
    }
  }
  
  await browser.close();
  console.log('\n✅ Screenshot capture complete!');
  
  // List all captured files
  const files = fs.readdirSync(SCREENSHOTS_DIR);
  console.log(`\n📁 Total screenshots: ${files.length}`);
  files.forEach(f => console.log(`  - ${f}`));
}

captureScreenshots().catch(console.error);
