const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const expectedHashes = require('./fixtures/archive-page-text-hashes.json');

function extractVisibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function createFakeDocument(pageId) {
  const classes = new Set();
  const contentArea = { dataset: {} };

  return {
    body: {
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        contains: (name) => classes.has(name),
      },
    },
    querySelector(selector) {
      if (selector === 'meta[name="page-id"]') return { content: pageId };
      if (selector === '.content-area') return contentArea;
      return null;
    },
    classes,
    contentArea,
  };
}

test('档案配置覆盖 9 个正文页且编号唯一', () => {
  const { ARCHIVE_PAGE_CONFIG } = require('../js/archive-page.js');
  const ids = [
    'map', 'objects', 'events', 'terms', 'organizations',
    'countries', 'other', 'mythology', 'timeline', 'characters',
  ];

  assert.deepEqual(Object.keys(ARCHIVE_PAGE_CONFIG), ids);
  assert.equal(new Set(Object.values(ARCHIVE_PAGE_CONFIG).map((item) => item.code)).size, 10);
  assert.deepEqual(ARCHIVE_PAGE_CONFIG.characters, { code: '10', label: 'CHARACTERS' });
});

test('档案增强只处理已配置的正文页', () => {
  const { enhanceArchivePage } = require('../js/archive-page.js');
  const document = createFakeDocument('countries');

  const config = enhanceArchivePage(document);

  assert.equal(config.code, '06');
  assert.equal(config.label, 'COUNTRIES');
  assert.equal(document.body.classList.contains('archive-page'), true);
  assert.equal(document.contentArea.dataset.archiveCode, '06');
  assert.equal(document.contentArea.dataset.archiveLabel, 'COUNTRIES');
  assert.equal(enhanceArchivePage(createFakeDocument('home')), null);
});

test('9 个正文页的可见文本与实现前基线一致', () => {
  for (const [filename, expectedHash] of Object.entries(expectedHashes)) {
    const html = fs.readFileSync(path.join(pagesDir, filename), 'utf8');
    const text = extractVisibleText(html);
    const actualHash = crypto.createHash('sha256').update(text).digest('hex');
    assert.equal(actualHash, expectedHash, `${filename} 的可见文本发生变化`);
  }
});

test('9 个正文页在 shared.js 之前加载 archive-page.js', () => {
  for (const filename of Object.keys(expectedHashes)) {
    const html = fs.readFileSync(path.join(pagesDir, filename), 'utf8');
    const archiveIndex = html.indexOf('../js/archive-page.js');
    const sharedIndex = html.indexOf('../js/shared.js');

    assert.notEqual(archiveIndex, -1, `${filename} 未加载 archive-page.js`);
    assert.ok(archiveIndex < sharedIndex, `${filename} 的 archive-page.js 必须先于 shared.js 加载`);
  }
});

test('档案样式包含深浅主题和三个响应式层级', () => {
  const css = fs.readFileSync(path.join(root, 'css', 'anime-style.css'), 'utf8');

  assert.match(css, /\.archive-page\s*\{/);
  assert.match(css, /\.light-mode\.archive-page/);
  assert.match(css, /\.archive-page\s+\.sidebar/);
  assert.match(css, /\.archive-page\s+\.content-area::before/);
  assert.match(css, /@media\s*\(max-width:\s*1024px\)/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('组织页使用统一档案卡片且内容左对齐', () => {
  const html = fs.readFileSync(path.join(pagesDir, 'organizations.html'), 'utf8');

  assert.match(html, /<div class="organization-list">/);
  assert.equal((html.match(/class="organization-heading"/g) || []).length, 4);
  assert.equal((html.match(/class="org-box"/g) || []).length, 4);
  assert.doesNotMatch(html, /margin-left:\s*2rem/);
  assert.doesNotMatch(html, /class="org-box"[^>]*style=/);
});
