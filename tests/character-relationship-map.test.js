const test = require('node:test');
const assert = require('node:assert/strict');

const { CHARACTER_ARCHIVE } = require('../js/characters-data.js');
const {
  RELATIONSHIP_PHYSICS,
  buildRelationshipGraph,
  createInitialPosition,
  formatRelationshipLabel,
  getDirectRelationIds,
} = require('../js/character-relationship-map.js');

function findEdge(graph, left, right) {
  return graph.edges.find((edge) => (
    (edge.source === left && edge.target === right)
    || (edge.source === right && edge.target === left)
  ));
}

test('关系星图保留 54 份人物档案，并把 Era 作为共享档案的独立人格节点', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const era = graph.nodes.find((node) => node.id === 'era');

  assert.equal(CHARACTER_ARCHIVE.characters.length, 54);
  assert.equal(graph.nodes.length, 55);
  assert.equal(new Set(graph.nodes.map((node) => node.id)).size, 55);
  assert.equal(era.profileId, 'scholar');
  assert.equal(era.name, 'Era');
  assert.equal(findEdge(graph, 'scholar', 'era').displayLabel, '同一身体｜主人格／副人格');
});

test('星图加入正文中明确记载的直接人物关系', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const expectedPairs = [
    ['miluan', 'kongshi'],
    ['dead-candle', 'kongshi'],
    ['zhengxian', 'miluan'],
    ['even', 'blade-spirit'],
    ['niying', 'blade-spirit'],
    ['blade-spirit', 'elementalist'],
    ['elementalist', 'niying'],
    ['alex', 'keliwusi'],
    ['lingqingshi', 'kuilasier'],
    ['lingqingshi', 'haizikui'],
    ['lingqingshi', 'guining'],
    ['eternal-god', 'zhuhan'],
    ['eternal-god', 'huoladekesi'],
    ['eternal-god', 'playwright'],
    ['eternal-god', 'kongshi-ancient'],
  ];

  for (const [left, right] of expectedPairs) {
    assert.ok(findEdge(graph, left, right), `缺少 ${left} 与 ${right} 的直接关系`);
  }
  assert.ok(graph.edges.length >= 52);
});

test('永生剥夺真理神领身躯的关系主体正确', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);

  assert.equal(findEdge(graph, 'truth-revived', 'truth-god'), undefined);
  assert.equal(
    findEdge(graph, 'eternal-god', 'truth-god').displayLabel,
    '永生 → 真理神领｜剥夺身躯',
  );
  assert.equal(
    findEdge(graph, 'truth-revived', 'kongshi').displayLabel,
    '“真理” → 空视｜借用身躯复活，空视灵魂留存',
  );
});

test('已确认的关系文案不把幻易和天光标为室友', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const edge = findEdge(graph, 'huanyi', 'tianguang');

  assert.equal(edge.displayLabel, '幻易 — 天光｜朋友／搭档');
  assert.doesNotMatch(formatRelationshipLabel(edge), /室友/);
  assert.equal(findEdge(graph, 'huanyi', 'lingzhi').displayLabel, '幻易 — 凌至｜好友／借用相机');
  assert.equal(findEdge(graph, 'huanyi', 'zhengxian').displayLabel, '幻易 — 正闲｜室友／情报往来');
});

test('关系边优先显示明确事件文案，旧数据仍可回退到双向称谓', () => {
  assert.equal(
    formatRelationshipLabel({ displayLabel: 'Even → 匿影｜收为徒弟、交付指路石', labels: ['师父', '徒弟'] }),
    'Even → 匿影｜收为徒弟、交付指路石',
  );
  assert.equal(formatRelationshipLabel({ labels: ['师父', '徒弟', '师父'] }), '师父 ↔ 徒弟');
  assert.equal(formatRelationshipLabel({ labels: ['朋友'] }), '朋友');
});

test('直接关系查询只返回当前人物的一层相邻节点', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const expected = new Set(
    CHARACTER_ARCHIVE.characters
      .find((character) => character.id === 'huanyi')
      .relations
      .filter((relation) => relation.targetId)
      .map((relation) => relation.targetId),
  );

  assert.deepEqual(new Set(getDirectRelationIds(graph, 'huanyi')), expected);
  assert.equal(getDirectRelationIds(graph, 'huanyi').includes('huanyi'), false);
});

test('角色初始坐标稳定且为有限数值', () => {
  const first = createInitialPosition('huanyi', 0, 55);
  const repeated = createInitialPosition('huanyi', 0, 55);

  assert.deepEqual(first, repeated);
  assert.equal(Number.isFinite(first.x), true);
  assert.equal(Number.isFinite(first.y), true);
});

test('星图使用轻量物理参数，拖动时不会大范围推开周围节点', () => {
  assert.ok(RELATIONSHIP_PHYSICS.repulsion <= 900);
  assert.ok(RELATIONSHIP_PHYSICS.linkDistance <= 145);
  assert.ok(RELATIONSHIP_PHYSICS.dragReheat <= 0.16);
  assert.ok(RELATIONSHIP_PHYSICS.velocityRetention <= 0.75);
  assert.equal(RELATIONSHIP_PHYSICS.pickRadius, 18);
});
