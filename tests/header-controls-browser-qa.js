const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = 'http://127.0.0.1:8767';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    localStorage.setItem('darkMode', 'true');
    localStorage.setItem('musicPlaying', 'false');
    HTMLMediaElement.prototype.play = () => Promise.resolve();
    HTMLMediaElement.prototype.pause = () => {};
  });
  await context.route('https://player.bilibili.com/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: '<!doctype html><title>video placeholder</title>',
  }));

  const page = await context.newPage();
  const issues = [];
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  const mode = page.locator('#modeToggle');
  const music = page.locator('#musicToggle');
  const controls = page.locator('.header-controls');

  assert.equal(await mode.getAttribute('aria-pressed'), 'true');
  assert.equal(await music.getAttribute('aria-pressed'), 'false');

  const darkStyle = await controls.evaluate((element) => {
    const modeIcon = element.querySelector('.mode-icon');
    const musicIcon = element.querySelector('.music-icon');
    const style = getComputedStyle(element);
    return {
      radius: style.borderRadius,
      background: style.backgroundColor,
      modeMask: getComputedStyle(modeIcon, '::before').webkitMaskImage,
      musicMask: getComputedStyle(musicIcon, '::before').webkitMaskImage,
      modeFontSize: getComputedStyle(modeIcon).fontSize,
    };
  });
  assert.equal(darkStyle.radius, '999px');
  assert.match(darkStyle.modeMask, /data:image\/svg\+xml/);
  assert.match(darkStyle.musicMask, /data:image\/svg\+xml/);
  assert.equal(darkStyle.modeFontSize, '0px');

  await page.screenshot({ path: path.join('tmp', 'header-controls-home-dark.png') });

  await mode.click();
  assert.equal(await mode.getAttribute('aria-pressed'), 'false');
  assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('light-mode')), true);
  const lightBackground = await controls.evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.notEqual(lightBackground, darkStyle.background);

  await music.click();
  assert.equal(await music.getAttribute('aria-pressed'), 'true');
  assert.match(await music.evaluate((element) => getComputedStyle(element).backgroundImage), /linear-gradient/);
  await page.screenshot({ path: path.join('tmp', 'header-controls-home-light.png') });

  const archive = await context.newPage();
  await archive.setViewportSize({ width: 390, height: 844 });
  await archive.goto(`${baseUrl}/pages/organizations.html`, { waitUntil: 'domcontentloaded' });

  const archiveLayout = await archive.evaluate(() => {
    const controlsRect = document.querySelector('.header-controls').getBoundingClientRect();
    const titleRect = document.querySelector('.page-title').getBoundingClientRect();
    const icon = document.querySelector('.mode-icon');
    const button = document.querySelector('.mode-toggle');
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      controlsRight: controlsRect.right,
      controlsBottom: controlsRect.bottom,
      titleTop: titleRect.top,
      buttonHeight: button.getBoundingClientRect().height,
      mask: getComputedStyle(icon, '::before').webkitMaskImage,
    };
  });
  assert.ok(archiveLayout.overflow <= 1, `mobile horizontal overflow: ${archiveLayout.overflow}px`);
  assert.ok(archiveLayout.controlsRight <= 390);
  assert.ok(archiveLayout.controlsBottom < archiveLayout.titleTop);
  assert.ok(archiveLayout.buttonHeight >= 42);
  assert.match(archiveLayout.mask, /data:image\/svg\+xml/);
  await archive.screenshot({ path: path.join('tmp', 'header-controls-organizations-light-mobile.png') });

  assert.deepEqual(issues, []);
  await browser.close();
  console.log('header controls browser QA passed: home dark/light, BGM state, archive mobile layout');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
