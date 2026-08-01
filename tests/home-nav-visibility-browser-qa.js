const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const baseUrl = 'http://127.0.0.1:8767';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });

  for (const width of [1280, 1440, 1920]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });

    const layout = await page.evaluate(() => {
      const nav = document.querySelector('.nav-pills');
      const lastLink = nav.lastElementChild;
      const controls = document.querySelector('.anime-header-controls');
      const navRect = nav.getBoundingClientRect();
      const linkRect = lastLink.getBoundingClientRect();
      const controlsRect = controls.getBoundingClientRect();

      return {
        navRight: navRect.right,
        linkRight: linkRect.right,
        controlsLeft: controlsRect.left,
        hiddenWidth: Math.max(0, linkRect.right - navRect.right),
        gapToControls: controlsRect.left - navRect.right,
      };
    });

    assert.ok(layout.hiddenWidth <= 1, `${width}px 下角色档案被导航容器遮挡 ${layout.hiddenWidth}px`);
    assert.ok(layout.gapToControls >= 8, `${width}px 下导航与控制按钮间距不足`);
    await page.close();
  }

  await browser.close();
  console.log('home nav visibility browser QA passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
