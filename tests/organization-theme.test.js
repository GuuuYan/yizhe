const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const css = fs.readFileSync(path.resolve(__dirname, '..', 'css', 'anime-style.css'), 'utf8');

function themeBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `未找到主题块：${selector}`);
  return match[1];
}

function hexVariable(block, name) {
  const match = block.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i'));
  assert.ok(match, `未找到颜色变量：--${name}`);
  return match[1];
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16) / 255);
  const linear = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastRatio(foreground, background) {
  const values = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('组织页表头在深浅主题下均使用高对比实色背景', () => {
  const dark = themeBlock('.archive-page');
  const light = themeBlock('.light-mode.archive-page');

  assert.ok(contrastRatio(hexVariable(dark, 'archive-text'), hexVariable(dark, 'archive-table-head')) >= 4.5);
  assert.ok(contrastRatio(hexVariable(light, 'archive-text'), hexVariable(light, 'archive-table-head')) >= 4.5);
  assert.match(css, /\.archive-page table th\s*\{[\s\S]*?background:\s*var\(--archive-table-head\)\s*!important;/);
});
