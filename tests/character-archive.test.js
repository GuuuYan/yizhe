const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const pagePath = path.join(root, 'pages', 'characters.html');
const dataPath = path.join(root, 'js', 'characters-data.js');
const scriptPath = path.join(root, 'js', 'characters.js');
const relationshipMapPath = path.join(root, 'js', 'character-relationship-map.js');
const stylePath = path.join(root, 'css', 'characters.css');
const source = require('./fixtures/character-source.json');

function loadArchive() {
  assert.ok(fs.existsSync(dataPath), '缺少角色档案数据模块');
  delete require.cache[require.resolve(dataPath)];
  return require(dataPath).CHARACTER_ARCHIVE;
}

test('角色档案页面与独立资源文件存在', () => {
  assert.ok(fs.existsSync(pagePath), '缺少 pages/characters.html');
  assert.ok(fs.existsSync(dataPath), '缺少 js/characters-data.js');
  assert.ok(fs.existsSync(scriptPath), '缺少 js/characters.js');
  assert.ok(fs.existsSync(relationshipMapPath), '缺少 js/character-relationship-map.js');
  assert.ok(fs.existsSync(stylePath), '缺少 css/characters.css');
});

test('角色档案覆盖资料中的 54 个独立角色条目', () => {
  const archive = loadArchive();
  assert.equal(archive.characters.length, 54);
  assert.equal(new Set(archive.characters.map((item) => item.id)).size, 54);
});

test('DOCX 中的全部有效原文逐段且不重复地进入页面数据', () => {
  const archive = loadArchive();
  const separator = /^—+$/;
  const structuralIndexes = new Set([
    ...archive.categories.flatMap((category) => category.sourceIndexes),
    ...archive.appendices.map((appendix) => appendix.titleIndex),
  ]);
  const expected = source.paragraphs.filter(
    (paragraph) => !separator.test(paragraph.text.trim()) && !structuralIndexes.has(paragraph.index),
  );
  const actual = [
    ...archive.characters.flatMap((character) => character.paragraphs),
    ...archive.appendices.flatMap((appendix) => appendix.paragraphs),
  ].sort((a, b) => a.index - b.index);

  assert.deepEqual(actual, expected);
});

test('文本基线对应当前 DOCX/PDF，且 PDF 覆盖全部 DOCX 有效段落', () => {
  const crypto = require('node:crypto');
  const docxHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '角色档案.docx'))).digest('hex');
  const pdfHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, '角色档案.pdf'))).digest('hex');

  assert.equal(source.docxSha256, docxHash);
  assert.equal(source.pdfSha256, pdfHash);
  assert.equal(source.pdfParagraphCoverage, 1);
  assert.ok(source.pdfPages > 0);
});

test('角色关系只保存当前角色的一层直接关系', () => {
  const archive = loadArchive();
  const ids = new Set(archive.characters.map((character) => character.id));

  for (const character of archive.characters) {
    assert.ok(Array.isArray(character.relations));
    for (const relation of character.relations) {
      assert.equal(typeof relation.label, 'string');
      assert.ok(relation.label.trim());
      assert.ok(
        (relation.targetId && ids.has(relation.targetId)) || relation.targetName,
        `${character.name} 存在无效的直接关系目标`,
      );
      assert.equal('relations' in relation, false, '关系节点不得嵌套二级关系');
      assert.ok(relation.evidence, `${character.name} 的关系缺少资料证据`);
      if (relation.evidence.type === 'paragraphs') {
        for (const index of relation.evidence.indexes) {
          assert.ok(source.paragraphs.some((paragraph) => paragraph.index === index));
        }
      } else {
        assert.equal(relation.evidence.type, 'embedded-relation-diagram');
        assert.ok(source.media[relation.evidence.asset]);
      }
    }
  }
});

test('页面接入深浅主题、搜索、阵营筛选与全角色关系星图', () => {
  assert.ok(fs.existsSync(pagePath), '缺少角色档案页面');
  const html = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const css = fs.readFileSync(stylePath, 'utf8');

  assert.match(html, /meta name="page-id" content="characters"/);
  assert.match(html, /id="characterSearch"/);
  assert.match(html, /id="characterDirectory"/);
  assert.doesNotMatch(html, /id="relationshipView"/);
  assert.doesNotMatch(html, /id="relationshipGraph"/);
  assert.doesNotMatch(html, />03<\/span>[\s\S]*?<h3>直接关系<\/h3>/);
  assert.match(html, /<header class="page-header">/);
  assert.match(html, /<div class="main-container">/);
  assert.match(html, /<aside class="sidebar">/);
  assert.match(html, /<main class="content-area">/);
  assert.match(
    html,
    /<section class="section character-archive-section"[^>]*>[\s\S]*?<h2[^>]*class="section-title"[^>]*>角色档案<\/h2>/,
  );
  assert.match(html, /<section class="character-directory-panel archive-record-card"/);
  assert.doesNotMatch(html, /class="character-topbar"/);
  assert.match(html, /characters-data\.js/);
  assert.match(html, /characters\.js/);
  const archiveIndex = html.indexOf('../js/archive-page.js');
  const sharedIndex = html.indexOf('../js/shared.js');
  assert.notEqual(archiveIndex, -1);
  assert.ok(archiveIndex < sharedIndex);
  assert.match(css, /\.light-mode\.character-page/);
  assert.match(css, /@media\s*\(max-width:\s*640px\)/);
  assert.doesNotMatch(script, /scrollIntoView/);
  assert.doesNotMatch(script, /renderRelations/);
});

test('共享导航提供角色档案入口', () => {
  const shared = fs.readFileSync(path.join(root, 'js', 'shared.js'), 'utf8');
  assert.match(shared, /characters\.html/);
});

test('角色页标题、正文标题与全角色关系图结构完整', () => {
  const html = fs.readFileSync(pagePath, 'utf8');
  const css = fs.readFileSync(stylePath, 'utf8');

  assert.match(html, /<h1[^>]*class="page-title"[^>]*>异者启示录世界观设定<\/h1>/);
  assert.match(html, /原创：<span[^>]*>零感庭<\/span>/);
  assert.match(html, /<main class="content-area">[\s\S]*?<h2[^>]*class="section-title"[^>]*>角色档案<\/h2>/);
  for (const id of [
    'openRelationshipMap',
    'relationshipMapModal',
    'relationshipMapCanvas',
    'relationshipMapCharacterSelect',
    'relationshipMapViewCharacter',
    'closeRelationshipMap',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }

  const dataIndex = html.indexOf('../js/characters-data.js');
  const mapIndex = html.indexOf('../js/character-relationship-map.js');
  const characterIndex = html.indexOf('../js/characters.js');
  assert.ok(dataIndex < mapIndex);
  assert.ok(mapIndex < characterIndex);
  assert.doesNotMatch(css, /\.archive-page \.character-directory-panel\s*\{[^}]*height:\s*410px/s);
  assert.doesNotMatch(css, /\.archive-page \.character-directory-panel\s*\{[^}]*height:\s*430px/s);
});
