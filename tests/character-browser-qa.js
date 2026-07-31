const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

(async () => {
  console.log('launching browser');
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  });
  console.log('browser launched');
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const issues = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.push(`${message.type()}: ${message.text()}`);
      console.error(`browser ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    issues.push(`pageerror: ${error.message}`);
    console.error(`browser pageerror: ${error.message}`);
  });

  await page.goto('http://127.0.0.1:8765/pages/characters.html', { waitUntil: 'domcontentloaded' });
  console.log('desktop loaded');
  assert.equal(await page.locator('body.archive-page.character-page').count(), 1);
  assert.equal(await page.locator('.page-header').count(), 1);
  assert.equal(await page.locator('.sidebar .nav-list').count(), 1);
  assert.equal(await page.locator('.content-area .character-directory-panel').count(), 1);
  assert.match(
    await page.locator('.section.character-archive-section').evaluate((node) => getComputedStyle(node).backgroundImage),
    /linear-gradient/,
  );
  assert.equal(await page.locator('.sidebar').evaluate((node) => getComputedStyle(node).position), 'sticky');
  assert.equal(await page.locator('.character-directory-item').count(), 54);
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '幻易');
  assert.equal((await page.locator('.page-title').textContent()).trim(), '异者启示录世界观设定');
  assert.equal((await page.locator('.content-area .section-title').textContent()).trim(), '角色档案');
  await page.locator('#openRelationshipMap').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#openRelationshipMap').isVisible(), true);
  assert.equal(await page.locator('#appendixButton').isVisible(), true);
  await page.screenshot({ path: path.join('tmp', 'character-dark-desktop.png') });
  console.log('dark captured');

  await page.locator('#openRelationshipMap').click();
  assert.equal(await page.locator('#relationshipMapModal').isVisible(), true);
  assert.equal((await page.locator('#relationshipMapNodeCount').textContent()).trim(), '55');
  assert.equal((await page.locator('#relationshipMapEdgeCount').textContent()).trim(), '53');
  const canvasSize = await page.locator('#relationshipMapCanvas').boundingBox();
  assert.ok(canvasSize.width > 500 && canvasSize.height > 300);
  await page.screenshot({ path: path.join('tmp', 'character-relation-map-dark-all.png') });
  await page.locator('#relationshipMapCharacterSelect').selectOption('huanyi');
  await page.waitForTimeout(1200);
  assert.equal((await page.locator('#relationshipMapFocusName').textContent()).trim(), '幻易');
  assert.equal(await page.locator('#relationshipMapViewCharacter').isEnabled(), true);
  assert.equal(
    await page.locator('#relationshipMapCanvas').getAttribute('data-visible-edge-labels'),
    '8',
  );
  await page.screenshot({ path: path.join('tmp', 'character-relation-map-dark.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#relationshipMapModal').isHidden(), true);
  assert.equal(await page.locator('#openRelationshipMap').evaluate((node) => document.activeElement === node), true);

  await page.locator('#openRelationshipMap').click();
  await page.locator('#relationshipMapCharacterSelect').selectOption('era');
  await page.locator('#relationshipMapViewCharacter').click();
  assert.equal(new URL(page.url()).hash, '#scholar');
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '博学/Era');

  await page.getByRole('button', { name: '02 天光', exact: true }).click();
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '天光');

  await page.locator('#modeToggle').click();
  assert.equal(await page.locator('body').evaluate((body) => body.classList.contains('light-mode')), true);
  assert.match(
    await page.locator('.section.character-archive-section').evaluate((node) => getComputedStyle(node).backgroundImage),
    /linear-gradient/,
  );
  await page.locator('#openRelationshipMap').click();
  await page.screenshot({ path: path.join('tmp', 'character-relation-map-light.png') });
  await page.locator('#closeRelationshipMap').click();
  await page.locator('.section-title').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join('tmp', 'character-light-desktop.png') });
  console.log('light captured');

  await page.locator('#characterSearch').fill('渡魂客');
  assert.ok(await page.locator('.character-directory-item').count() >= 2);
  await page.locator('#characterSearch').fill('');
  await page.locator('#appendixButton').click();
  assert.equal(await page.locator('.character-directory-item[aria-current="true"]').count(), 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8765/pages/characters.html#lingzhi', { waitUntil: 'domcontentloaded' });
  console.log('mobile loaded');
  assert.equal(await page.locator('.sidebar').evaluate((node) => getComputedStyle(node).position), 'static');
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '凌至');
  await page.locator('#openRelationshipMap').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#appendixButton').isVisible(), true);
  await page.locator('#openRelationshipMap').click();
  assert.equal(await page.locator('#relationshipMapDialog').evaluate((node) => getComputedStyle(node).borderRadius), '0px');
  await page.screenshot({ path: path.join('tmp', 'character-relation-map-mobile.png') });
  await page.locator('#closeRelationshipMap').click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile horizontal overflow: ${overflow}px`);
  await page.screenshot({ path: path.join('tmp', 'character-mobile.png') });
  console.log('mobile captured');

  await browser.close();
  assert.deepEqual(issues, []);
  console.log('browser QA passed: desktop dark/light, relation labels, directory switching, search, mobile layout');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
