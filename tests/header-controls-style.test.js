const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'css', 'anime-style.css'), 'utf8');
const shared = fs.readFileSync(path.join(root, 'js', 'shared.js'), 'utf8');

test('模式与音乐按钮使用共享胶囊控制槽', () => {
  assert.match(css, /\.header-controls\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(css, /\.header-controls \.mode-toggle/);
  assert.match(css, /\.header-controls \.music-toggle/);
  assert.match(css, /\.header-controls \.mode-toggle\[aria-pressed="true"\][\s\S]*linear-gradient/);
});

test('四种线性图标由 aria-pressed 状态驱动', () => {
  assert.match(css, /\.header-controls \.mode-icon[\s\S]*font-size:\s*0/);
  assert.match(css, /\.mode-toggle\[aria-pressed="true"\] \.mode-icon::before/);
  assert.match(css, /\.mode-toggle\[aria-pressed="false"\] \.mode-icon::before/);
  assert.match(css, /\.music-toggle\[aria-pressed="true"\] \.music-icon::before/);
  assert.match(css, /\.music-toggle\[aria-pressed="false"\] \.music-icon::before/);
  assert.ok((css.match(/url\("data:image\/svg\+xml/g) || []).length >= 4);
  assert.match(css, /-webkit-mask:\s*var\(--control-icon\)/);
  assert.match(css, /mask:\s*var\(--control-icon\)/);

  assert.match(shared, /musicToggle\.setAttribute\('aria-pressed',\s*'true'\)/);
  assert.match(shared, /modeToggle\.setAttribute\('aria-pressed',\s*'true'\)/);
});

test('胶囊控制键覆盖浅色主题与窄屏', () => {
  assert.match(css, /body\.light-mode \.header-controls\s*\{/);
  assert.match(css, /body\.light-mode \.header-controls \.mode-toggle/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]+\.header-controls \.mode-toggle/);
  assert.match(css, /@media \(max-width:\s*640px\)[\s\S]+min-height:\s*42px/);
});
