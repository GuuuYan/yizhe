const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

const baseUrl = 'http://127.0.0.1:8766';
const assets = {
  modern: '世界地图.webp',
  ancient: '世界地图-古代.webp',
  timeline: '时间轴.avif',
};

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const issues = [];
  const requestedAssets = [];
  const released = { modern: false, ancient: false, timeline: false };
  const waiters = { modern: [], ancient: [], timeline: [] };

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => issues.push(`pageerror: ${error.message}`));

  await context.route('**/*', async (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.startsWith('https://player.bilibili.com/')) {
      await route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>video placeholder</title>' });
      return;
    }
    const key = Object.keys(assets).find((name) => url.endsWith(assets[name]));
    if (!key) {
      await route.continue();
      return;
    }

    requestedAssets.push(key);
    if (!released[key]) {
      await new Promise((resolve) => waiters[key].push(resolve));
    }
    await route.continue();
  });

  const release = (key) => {
    released[key] = true;
    waiters[key].splice(0).forEach((resolve) => resolve());
  };

  const assertLoading = async (selector) => {
    await page.waitForFunction((target) => document.querySelector(target)?.classList.contains('is-loading'), selector);
    const state = await page.locator(selector).evaluate((container) => ({
      imageOpacity: getComputedStyle(container.querySelector('img')).opacity,
      layerOpacity: getComputedStyle(container.querySelector('.media-loading-layer')).opacity,
      busy: container.getAttribute('aria-busy'),
    }));
    assert.equal(state.imageOpacity, '0');
    assert.equal(state.layerOpacity, '1');
    assert.equal(state.busy, 'true');
  };

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

  if (await page.locator('body').evaluate((body) => body.classList.contains('light-mode'))) {
    await page.locator('#modeToggle').click();
  }

  const initialZoomSource = await page.locator('.timeline-lightbox-image').getAttribute('src');
  assert.equal(initialZoomSource, null, '隐藏的放大图不应抢先请求时间轴');

  await page.locator('#map').scrollIntoViewIfNeeded();
  await assertLoading('.map-showcase');
  await page.screenshot({ path: path.join('tmp', 'home-media-dark-loading.png') });
  release('modern');
  await page.locator('.map-showcase').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.querySelector('.map-showcase')?.classList.contains('is-ready'));

  await page.locator('.map-switch-btn').filter({ hasText: '古代地图' }).click();
  await assertLoading('.map-showcase');
  release('ancient');
  await page.waitForFunction(() => document.querySelector('.map-showcase')?.classList.contains('is-ready'));
  assert.match(decodeURIComponent(await page.locator('.home-map-image').evaluate((image) => image.currentSrc)), /世界地图-古代\.webp$/);

  await page.locator('#timeline').scrollIntoViewIfNeeded();
  await assertLoading('.timeline-image-viewer');
  release('timeline');
  await page.waitForFunction(() => document.querySelector('.timeline-image-viewer')?.classList.contains('is-ready'));

  const timeline = await page.locator('.timeline-image').evaluate((image) => ({
    currentSrc: decodeURIComponent(image.currentSrc),
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
  }));
  assert.match(timeline.currentSrc, /时间轴\.avif$/);
  assert.equal(timeline.naturalWidth, 17717);
  assert.equal(timeline.naturalHeight, 2362);

  await page.locator('.timeline-image-button').click();
  await page.waitForFunction(() => document.querySelector('.timeline-lightbox')?.classList.contains('open'));
  const lightboxSource = decodeURIComponent(await page.locator('.timeline-lightbox-image').getAttribute('src'));
  assert.match(lightboxSource, /时间轴\.avif$/);
  await page.locator('.timeline-lightbox-close').click();

  if (!(await page.locator('body').evaluate((body) => body.classList.contains('light-mode')))) {
    await page.locator('#modeToggle').click();
  }
  const lightLoaderBackground = await page.locator('.media-loading-layer').first().evaluate((layer) => getComputedStyle(layer).backgroundColor);
  assert.match(lightLoaderBackground, /239, 247, 255/);

  await page.screenshot({ path: path.join('tmp', 'home-media-light-desktop.png'), fullPage: true });

  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(baseUrl, { waitUntil: 'networkidle' });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile horizontal overflow: ${overflow}px`);
  await mobile.screenshot({ path: path.join('tmp', 'home-media-light-mobile.png'), fullPage: true });

  assert.deepEqual(issues, []);
  assert.ok(requestedAssets.includes('modern'));
  assert.ok(requestedAssets.includes('ancient'));
  assert.ok(requestedAssets.includes('timeline'));

  await browser.close();
  console.log('home media browser QA passed: loading states, AVIF zoom, map switch, light theme, mobile overflow');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
