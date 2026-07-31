const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const expectedArchivePages = [
  'map.html',
  'objects.html',
  'events.html',
  'terms.html',
  'organizations.html',
  'countries.html',
  'other.html',
  'mythology.html',
  'timeline.html',
  'characters.html',
];

function extractPageHrefs(fragment) {
  return [...fragment.matchAll(/href="\.\/pages\/([^"]+)"/g)].map((match) => match[1]);
}

test('主页导航与世界观档案目录包含相同的十个入口', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const nav = html.match(/<nav class="nav-pills"[\s\S]*?<\/nav>/);
  const archive = html.match(/<div class="archive-grid">[\s\S]*?<\/div>\s*<\/section>/);

  assert.ok(nav, '未找到主页世界观导航');
  assert.ok(archive, '未找到主页世界观档案目录');
  assert.deepEqual(extractPageHrefs(nav[0]), expectedArchivePages);
  assert.deepEqual(extractPageHrefs(archive[0]), expectedArchivePages);
});
