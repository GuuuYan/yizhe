const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');

function collectPageIssues(page, issues, label) {
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.push(`${label} ${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    issues.push(`${label} pageerror: ${error.message}`);
  });
}

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
  assert.equal(await page.locator('.character-directory-item').count(), 66);
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '幻易');
  assert.equal((await page.locator('.page-title').textContent()).trim(), '异者启示录世界观设定');
  assert.equal((await page.locator('.content-area .section-title').textContent()).trim(), '角色档案');
  await page.locator('#openRelationshipMap').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#openRelationshipMap').isVisible(), true);
  assert.equal(await page.locator('#appendixButton').count(), 0);
  assert.equal(await page.locator('#appendixView').count(), 0);
  const actionWidth = await page.locator('.directory-actions').evaluate((node) => node.getBoundingClientRect().width);
  const mapButtonWidth = await page.locator('#openRelationshipMap').evaluate((node) => node.getBoundingClientRect().width);
  assert.ok(Math.abs(actionWidth - mapButtonWidth) <= 1);
  await page.screenshot({ path: path.join('tmp', 'character-dark-desktop.png') });
  console.log('dark captured');

  await page.locator('#openRelationshipMap').click();
  assert.equal(await page.locator('#relationshipMapModal').isVisible(), true);
  assert.equal((await page.locator('#relationshipMapNodeCount').textContent()).trim(), '66');
  assert.equal((await page.locator('#relationshipMapEdgeCount').textContent()).trim(), '107');
  const canvasSize = await page.locator('#relationshipMapCanvas').boundingBox();
  assert.ok(canvasSize.width > 500 && canvasSize.height > 300);
  await page.waitForTimeout(300);
  assert.equal(
    await page.locator('#relationshipMapCanvas').getAttribute('data-visible-node-labels'),
    '66',
  );
  assert.equal(
    await page.locator('#relationshipMapCanvas').getAttribute('data-node-color-mode'),
    'uniform-cyan',
  );
  assert.equal(
    await page.locator('#relationshipMapCanvas').getAttribute('data-physics-state'),
    'running',
  );
  assert.ok(Number(await page.locator('#relationshipMapCanvas').getAttribute('data-maximum-radius')) <= 297.01);
  assert.notEqual(
    await page.locator('#relationshipMapCanvas').getAttribute('data-directed-color'),
    await page.locator('#relationshipMapCanvas').getAttribute('data-mutual-color'),
  );
  assert.ok(Number(await page.locator('#relationshipMapCanvas').getAttribute('data-reciprocal-bundles')) >= 1);
  const movingStart = await page.evaluate(() => window.CharacterRelationshipMapInstance.getDiagnostics());
  await page.waitForTimeout(400);
  const movingEnd = await page.evaluate(() => window.CharacterRelationshipMapInstance.getDiagnostics());
  assert.ok(movingEnd.some((node, index) => (
    Math.hypot(
      node.x - movingStart[index].x,
      node.y - movingStart[index].y,
      node.z - movingStart[index].z,
    ) > 0.05
  )));
  await page.locator('#relationshipMapPause').click();
  assert.equal(
    await page.locator('#relationshipMapCanvas').getAttribute('data-physics-state'),
    'paused',
  );
  const pausedStart = await page.evaluate(() => window.CharacterRelationshipMapInstance.getDiagnostics());
  await page.waitForTimeout(250);
  const pausedEnd = await page.evaluate(() => window.CharacterRelationshipMapInstance.getDiagnostics());
  assert.deepEqual(pausedEnd, pausedStart);
  const viewBeforeGesture = await page.evaluate(() => window.CharacterRelationshipMapInstance.getViewState());
  await page.mouse.move(canvasSize.x + canvasSize.width / 2, canvasSize.y + canvasSize.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasSize.x + canvasSize.width / 2 + 80, canvasSize.y + canvasSize.height / 2 + 35);
  await page.mouse.up();
  await page.mouse.wheel(0, -180);
  const viewAfterGesture = await page.evaluate(() => window.CharacterRelationshipMapInstance.getViewState());
  assert.notEqual(viewAfterGesture.yaw, viewBeforeGesture.yaw);
  assert.notEqual(viewAfterGesture.pitch, viewBeforeGesture.pitch);
  assert.notEqual(viewAfterGesture.zoom, viewBeforeGesture.zoom);
  await page.locator('#relationshipMapReset').click();
  const resetView = await page.evaluate(() => window.CharacterRelationshipMapInstance.getViewState());
  assert.deepEqual(
    { yaw: resetView.yaw, pitch: resetView.pitch, zoom: resetView.zoom },
    { yaw: -0.35, pitch: 0.18, zoom: 1 },
  );
  await page.locator('#relationshipMapPause').click();
  await page.screenshot({ path: path.join('tmp', 'character-relation-map-dark-all.png') });
  await page.locator('#relationshipMapCharacterSelect').selectOption('huanyi');
  await page.waitForTimeout(350);
  assert.equal((await page.locator('#relationshipMapFocusName').textContent()).trim(), '幻易');
  assert.equal(await page.locator('#relationshipMapViewCharacter').isEnabled(), true);
  assert.match(await page.locator('#relationshipMapLiveSummary').textContent(), /幻易/);
  assert.match(await page.locator('#relationshipMapLiveSummary').textContent(), /好友/);
  assert.match(await page.locator('#relationshipMapLiveSummary').textContent(), /↔/);
  assert.match(await page.locator('#relationshipMapLiveSummary').textContent(), /指导/);
  assert.match(await page.locator('#relationshipMapLiveSummary').textContent(), /→/);
  assert.match(
    await page.locator('#relationshipMapLiveSummary').textContent(),
    /元素使 → 吸附 → 幻易/,
  );
  assert.equal(
    await page.locator('#relationshipMapCanvas').getAttribute('data-visible-edge-labels'),
    '8',
  );
  await page.screenshot({ path: path.join('tmp', 'character-relation-map-dark.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#relationshipMapModal').isHidden(), true);
  assert.equal(await page.locator('#openRelationshipMap').evaluate((node) => document.activeElement === node), true);
  const closedStart = await page.evaluate(() => window.CharacterRelationshipMapInstance.getDiagnostics());
  await page.waitForTimeout(250);
  const closedEnd = await page.evaluate(() => window.CharacterRelationshipMapInstance.getDiagnostics());
  assert.deepEqual(closedEnd, closedStart);

  await page.locator('#openRelationshipMap').click();
  await page.locator('#relationshipMapCharacterSelect').selectOption('envoys');
  assert.equal((await page.locator('#relationshipMapFocusName').textContent()).trim(), '使者');
  assert.equal(await page.locator('#relationshipMapViewCharacter').isEnabled(), true);
  await page.locator('#relationshipMapViewCharacter').click();
  assert.equal(new URL(page.url()).hash, '#envoys');
  await page.waitForFunction(
    () => document.querySelector('#activeCharacterName')?.textContent.includes('使者'),
  );
  await page.locator('#openRelationshipMap').click();
  await page.locator('#relationshipMapCharacterSelect').selectOption('dilake');
  await page.locator('#relationshipMapViewCharacter').click();
  assert.equal(new URL(page.url()).hash, '#dilake');
  await page.waitForFunction(
    () => document.querySelector('#activeCharacterName')?.textContent.trim() === '蒂拉克',
  );
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '蒂拉克');
  assert.equal((await page.locator('#characterContent').textContent()).trim(), '档案资料待补充');

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

  await page.goto('http://127.0.0.1:8765/pages/characters.html#combat-ranking', { waitUntil: 'domcontentloaded' });
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '幻易');
  assert.equal(await page.locator('#appendixButton').count(), 0);
  assert.equal(await page.locator('#appendixView').count(), 0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:8765/pages/characters.html#lingzhi', { waitUntil: 'domcontentloaded' });
  console.log('mobile loaded');
  assert.equal(await page.locator('.sidebar').evaluate((node) => getComputedStyle(node).position), 'static');
  assert.equal((await page.locator('#activeCharacterName').textContent()).trim(), '凌至');
  await page.locator('#openRelationshipMap').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#appendixButton').count(), 0);
  await page.locator('#openRelationshipMap').click();
  assert.equal(await page.locator('#relationshipMapDialog').evaluate((node) => getComputedStyle(node).borderRadius), '0px');
  await page.screenshot({ path: path.join('tmp', 'character-relation-map-mobile.png') });
  await page.locator('#closeRelationshipMap').click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 1, `mobile horizontal overflow: ${overflow}px`);
  await page.screenshot({ path: path.join('tmp', 'character-mobile.png') });
  console.log('mobile captured');

  const reducedPage = await browser.newPage({
    viewport: { width: 1000, height: 760 },
    reducedMotion: 'reduce',
  });
  collectPageIssues(reducedPage, issues, 'reduced-motion');
  await reducedPage.goto('http://127.0.0.1:8765/pages/characters.html', { waitUntil: 'domcontentloaded' });
  await reducedPage.locator('#openRelationshipMap').click();
  assert.equal(
    await reducedPage.locator('#relationshipMapCanvas').getAttribute('data-physics-state'),
    'paused',
  );
  assert.match(await reducedPage.locator('#relationshipMapRunState').textContent(), /减少动态效果/);
  assert.ok(Number(await reducedPage.locator('#relationshipMapCanvas').getAttribute('data-maximum-radius')) <= 297.01);
  await reducedPage.close();

  const fallbackPage = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  collectPageIssues(fallbackPage, issues, 'canvas-fallback');
  await fallbackPage.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await fallbackPage.goto('http://127.0.0.1:8765/pages/characters.html', { waitUntil: 'domcontentloaded' });
  await fallbackPage.locator('#openRelationshipMap').click();
  await fallbackPage.locator('#relationshipMapCharacterSelect').selectOption('huanyi');
  assert.match(await fallbackPage.locator('#relationshipMapFocusMeta').textContent(), /好友/);
  assert.match(await fallbackPage.locator('#relationshipMapFocusMeta').textContent(), /↔/);
  assert.equal((await fallbackPage.locator('#relationshipMapNodeCount').textContent()).trim(), '66');
  await fallbackPage.close();

  await browser.close();
  assert.deepEqual(issues, []);
  console.log('browser QA passed: desktop dark/light, relation labels, directory switching, search, mobile layout');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
