const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const issues = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') issues.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));

  async function assertOrganizationLayout() {
    const layout = await page.evaluate(() => {
      const title = document.querySelector('.section-title').getBoundingClientRect();
      const list = document.querySelector('.organization-list').getBoundingClientRect();
      const card = document.querySelector('.org-box').getBoundingClientRect();
      const cardStyle = getComputedStyle(document.querySelector('.org-box'));
      return {
        titleX: title.x,
        listX: list.x,
        cardX: card.x,
        backgroundImage: cardStyle.backgroundImage,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    assert.ok(Math.abs(layout.titleX - layout.listX) <= 1);
    assert.ok(Math.abs(layout.titleX - layout.cardX) <= 1);
    assert.match(layout.backgroundImage, /linear-gradient/);
    assert.ok(layout.overflow <= 1, `horizontal overflow: ${layout.overflow}px`);
  }

  await page.goto('http://127.0.0.1:8765/pages/organizations.html', { waitUntil: 'domcontentloaded' });
  await assertOrganizationLayout();
  await page.screenshot({ path: path.join('tmp', 'organizations-dark-desktop.png'), fullPage: true });

  await page.locator('#modeToggle').click();
  assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('light-mode')), true);
  await assertOrganizationLayout();
  await page.screenshot({ path: path.join('tmp', 'organizations-light-desktop.png'), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await assertOrganizationLayout();
  await page.screenshot({ path: path.join('tmp', 'organizations-light-mobile.png'), fullPage: true });

  await browser.close();
  assert.deepEqual(issues, []);
  console.log('archive visual QA passed: organization alignment, gradients, dark/light/mobile');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
