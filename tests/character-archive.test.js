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
const PLACEHOLDER_NAMES = [
  '幻海', '蓝枫', '李兆', '凌霜', '白辉', '正月',
  '阿波德', '西海沙', '蒂拉克', '史蒂夫', '艾莉亚', '莲',
];

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

test('保留 54 份原始档案，并增加 12 份资料待补档案', () => {
  const archive = loadArchive();
  const originals = archive.characters.filter((character) => !character.placeholder);
  const placeholders = archive.characters.filter((character) => character.placeholder);

  assert.equal(originals.length, 54);
  assert.equal(placeholders.length, 12);
  assert.equal(new Set(archive.characters.map((item) => item.id)).size, 66);
  assert.deepEqual(placeholders.map((character) => character.name), PLACEHOLDER_NAMES);
  for (const character of placeholders) {
    assert.equal(character.category, 'pending');
    assert.equal(character.sourceRange, null);
    assert.deepEqual(character.paragraphs, [{ index: null, text: '档案资料待补充' }]);
    assert.deepEqual(character.relations, []);
  }
});

test('DOCX 中的 54 份角色档案正文逐段进入页面数据', () => {
  const archive = loadArchive();
  const separator = /^—+$/;

  for (const character of archive.characters.filter((item) => !item.placeholder)) {
    const [start, end] = character.sourceRange;
    const expected = source.paragraphs.filter((paragraph) => (
      paragraph.index >= start
      && paragraph.index <= end
      && !separator.test(paragraph.text.trim())
    ));
    assert.deepEqual(character.paragraphs, expected, `${character.name} 正文与 DOCX 基线不一致`);
  }
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

test('第一季战力排行界面、逻辑、数据与样式已彻底移除', () => {
  const archive = loadArchive();
  const html = fs.readFileSync(pagePath, 'utf8');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const css = fs.readFileSync(stylePath, 'utf8');

  assert.equal(Object.hasOwn(archive, 'appendices'), false);
  assert.doesNotMatch(html, /appendix|combat-ranking|第一季战力排行/i);
  assert.doesNotMatch(script, /appendix|combat-ranking|showAppendix/i);
  assert.doesNotMatch(css, /\.appendix/i);
  assert.match(html, /id="openRelationshipMap"/);
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
    'relationshipMapRunState',
    'relationshipMapPause',
    'relationshipMapReset',
    'relationshipMapLegend',
    'relationshipMapLiveSummary',
  ]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /单向关系/);
  assert.match(html, /双向关系/);
  assert.doesNotMatch(html, /id="relationshipMapNodeCount">\d+/);
  assert.doesNotMatch(html, /id="relationshipMapEdgeCount">\d+/);
  assert.match(css, /\.relationship-map-legend/);
  assert.match(css, /\.light-mode\.character-page[\s\S]*\.relationship-map-dialog/);

  const dataIndex = html.indexOf('../js/characters-data.js');
  const mapIndex = html.indexOf('../js/character-relationship-map.js');
  const characterIndex = html.indexOf('../js/characters.js');
  assert.ok(dataIndex < mapIndex);
  assert.ok(mapIndex < characterIndex);
  assert.doesNotMatch(css, /\.archive-page \.character-directory-panel\s*\{[^}]*height:\s*410px/s);
  assert.doesNotMatch(css, /\.archive-page \.character-directory-panel\s*\{[^}]*height:\s*430px/s);
});
