const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'js', 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'anime-style.css'), 'utf8');

test('主页地图与时间线声明轻量格式和原图回退', () => {
  assert.match(html, /data-map-webp="\.\/picture\/世界地图\.webp"/);
  assert.match(html, /data-map-webp="\.\/picture\/世界地图-古代\.webp"/);
  assert.match(html, /<source[^>]+srcset="\.\/picture\/世界地图\.webp"[^>]+type="image\/webp"/);
  assert.match(html, /<source[^>]+srcset="\.\/picture\/时间轴\.avif"[^>]+type="image\/avif"/);
  assert.match(html, /<img[^>]+src="\.\/picture\/世界地图\.png"/);
  assert.match(html, /<img[^>]+src="\.\/picture\/时间轴\.jpg"/);
});

test('时间线放大图不会在初始化时抢先请求大图', () => {
  const setup = script.match(/const zoomedImage = document\.createElement\('img'\);[\s\S]+?const openLightbox/);
  assert.ok(setup, '应能定位时间线查看器初始化代码');
  assert.doesNotMatch(setup[0], /zoomedImage\.src\s*=/);
  assert.match(script, /zoomedImage\.src = image\.currentSrc \|\| image\.src;/);
});

test('两个大图区域启用懒加载、异步解码与完整加载状态', () => {
  assert.equal((html.match(/data-deferred-media/g) || []).length, 2);
  assert.equal((html.match(/class="media-loading-layer"/g) || []).length, 2);
  assert.equal((html.match(/loading="lazy"/g) || []).length >= 4, true);
  assert.equal((html.match(/decoding="async"/g) || []).length, 2);
  assert.equal((html.match(/fetchpriority="low"/g) || []).length, 2);

  assert.match(script, /function initDeferredMedia\(/);
  assert.match(script, /function revealDeferredImage\(/);
  assert.match(script, /await image\.decode\(\)/);
  assert.match(script, /classList\.add\('is-loading'\)/);
  assert.match(script, /classList\.add\('is-ready'\)/);
  assert.match(script, /classList\.add\('has-error'\)/);

  assert.match(css, /\.deferred-media\.is-loading/);
  assert.match(css, /\.deferred-media\.is-loading img\s*\{[^}]*transition:\s*none/s);
  assert.match(css, /\.deferred-media\.is-loading \.media-loading-layer[^{]*\{[^}]*transition:\s*none/s);
  assert.match(css, /\.deferred-media\.is-ready/);
  assert.match(css, /\.deferred-media\.has-error/);
  assert.match(css, /body\.light-mode\s+\.media-loading-layer/);
});
