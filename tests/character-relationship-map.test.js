const test = require('node:test');
const assert = require('node:assert/strict');

const { CHARACTER_ARCHIVE } = require('../js/characters-data.js');
const {
  RELATIONSHIP_PHYSICS,
  buildRelationshipGraph,
  createInitialPosition,
  formatRelationshipLabel,
  getBundleVisualSemantics,
  getDirectRelationIds,
  getEdgeVisualSemantics,
  getNodeVisualKind,
  stepRelationshipSimulation,
} = require('../js/character-relationship-map.js');

function findEdges(graph, left, right) {
  return graph.edges.filter((edge) => (
    (edge.source === left && edge.target === right)
    || (edge.source === right && edge.target === left)
  ));
}

function findDirectedEdge(graph, source, target, relation) {
  return graph.edges.find((edge) => (
    edge.source === source && edge.target === target && edge.relation === relation
  ));
}

test('最新关系资料生成 66 个节点、107 条关系与 102 个连接束', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);

  assert.equal(CHARACTER_ARCHIVE.characters.length, 66);
  assert.equal(graph.nodes.length, 66);
  assert.equal(new Set(graph.nodes.map((node) => node.id)).size, 66);
  assert.equal(graph.edges.length, 107);
  assert.equal(graph.bundles.length, 102);
});

test('Era 合并到博学档案，使者与八使者合并到现有档案', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const envoyNodes = graph.nodes.filter((node) => ['envoys', 'eight-envoys'].includes(node.id));

  assert.equal(graph.nodes.some((node) => node.id === 'era'), false);
  assert.equal(graph.nodes.filter((node) => node.profileId === 'scholar').length, 1);
  assert.deepEqual(envoyNodes.map((node) => node.id), ['envoys']);
  assert.equal(envoyNodes[0].name, '使者');
  assert.equal(envoyNodes[0].profileId, 'envoys');
});

test('元素使对幻易保留单向吸附关系', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const absorption = findDirectedEdge(graph, 'elementalist', 'huanyi', '吸附');

  assert.ok(absorption);
  assert.equal(absorption.direction, 'directed');
  assert.equal(absorption.displayLabel, '元素使 → 吸附 → 幻易');
});

test('已确认的别名全部连接到正确档案节点', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);

  assert.ok(findDirectedEdge(graph, 'summoner', 'huanhai', '杀'));
  assert.equal(findDirectedEdge(graph, 'summoner', 'huanhai', '杀').displayLabel, '唤物 → 杀 → 幻海');
  assert.equal(findDirectedEdge(graph, 'ailinuo', 'chuyu', '祖宗').displayLabel, '艾莉诺 → 祖宗 → 初雨');
  assert.equal(findDirectedEdge(graph, 'truth-god', 'keliwusi', '师父').displayLabel, '真理神领 → 师父 → 克里乌斯');
  assert.equal(findDirectedEdge(graph, 'even', 'niying', '师傅').displayLabel, '伊文（Even） → 师傅 → 匿影');
  assert.equal(findDirectedEdge(graph, 'scholar', 'leader', '手下').displayLabel, '博学/Era → 手下 → 领袖');
  assert.equal(findDirectedEdge(graph, 'lian', 'xihaisha', '夫妻').direction, 'mutual');
  assert.equal(graph.nodes.filter((node) => node.id === 'xihaisha').length, 1);
  assert.equal(graph.nodes.filter((node) => node.id === 'summoner').length, 1);
  assert.equal(graph.nodes.filter((node) => node.id === 'truth-god').length, 1);
});

test('方向和多重关系不因人物对连接束去重而丢失', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const expectedPairs = [
    ['zhengxian', 'abode'],
    ['third-principal', 'dilake'],
    ['kongshi-ancient', 'eternal-god'],
    ['kongqingming', 'tianguang'],
    ['lingzhi', 'tianguang'],
  ];

  for (const [left, right] of expectedPairs) {
    assert.equal(findEdges(graph, left, right).length, 2, `${left} 与 ${right} 应保留两条关系`);
  }

  const timoAndDilake = findEdges(graph, 'third-principal', 'dilake');
  assert.deepEqual(
    new Set(timoAndDilake.map((edge) => edge.direction)),
    new Set(['directed', 'mutual']),
  );
  const tianguangAndLingzhi = findEdges(graph, 'tianguang', 'lingzhi');
  assert.equal(tianguangAndLingzhi.every((edge) => edge.direction === 'directed'), true);
  assert.deepEqual(
    new Set(tianguangAndLingzhi.map((edge) => edge.source)),
    new Set(['tianguang', 'lingzhi']),
  );
});

test('绘制层直接复用可验证的颜色与箭头语义', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const mutualBundle = graph.bundles.find((bundle) => (
    bundle.key === ['huanyi', 'tianguang'].sort().join('::')
  ));
  const reciprocalBundle = graph.bundles.find((bundle) => (
    bundle.key === ['lingzhi', 'tianguang'].sort().join('::')
  ));
  const reciprocalFirst = reciprocalBundle.edges[0];

  assert.deepEqual(getEdgeVisualSemantics({ direction: 'directed' }), {
    colorKind: 'directed',
    arrowAtSource: false,
    arrowAtTarget: true,
  });
  assert.deepEqual(getEdgeVisualSemantics({ direction: 'mutual' }), {
    colorKind: 'mutual',
    arrowAtSource: true,
    arrowAtTarget: true,
  });
  assert.deepEqual(
    getBundleVisualSemantics(mutualBundle, mutualBundle.edges[0].source, mutualBundle.edges[0].target),
    { colorKind: 'mutual', arrowAtSource: true, arrowAtTarget: true },
  );
  assert.deepEqual(
    getBundleVisualSemantics(reciprocalBundle, reciprocalFirst.source, reciprocalFirst.target),
    { colorKind: 'directed', arrowAtSource: true, arrowAtTarget: true },
  );
});

test('所有未选中节点共用统一青蓝视觉种类', () => {
  assert.equal(getNodeVisualKind({ focused: false, hub: false, collective: false }), 'normal');
  assert.equal(getNodeVisualKind({ focused: false, hub: true, collective: false }), 'normal');
  assert.equal(getNodeVisualKind({ focused: false, hub: false, collective: true }), 'normal');
  assert.equal(getNodeVisualKind({ focused: true, hub: true, collective: true }), 'focus');
});

test('已确认的关系文案不把幻易和天光标为室友', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);

  assert.equal(findDirectedEdge(graph, 'huanyi', 'tianguang', '好友').displayLabel, '幻易 ↔ 好友 ↔ 天光');
  assert.doesNotMatch(formatRelationshipLabel(findDirectedEdge(graph, 'huanyi', 'tianguang', '好友')), /室友/);
  assert.equal(findDirectedEdge(graph, 'huanyi', 'lingzhi', '好友').displayLabel, '幻易 ↔ 好友 ↔ 凌至');
  assert.equal(findDirectedEdge(graph, 'huanyi', 'zhengxian', '室友').displayLabel, '幻易 ↔ 室友 ↔ 正闲');
});

test('关系边优先显示最新文件文案，旧数据仍可回退到双向称谓', () => {
  assert.equal(
    formatRelationshipLabel({ displayLabel: '伊文（Even） → 师傅 → 匿影', labels: ['师父', '徒弟'] }),
    '伊文（Even） → 师傅 → 匿影',
  );
  assert.equal(formatRelationshipLabel({ labels: ['师父', '徒弟', '师父'] }), '师父 ↔ 徒弟');
  assert.equal(formatRelationshipLabel({ labels: ['朋友'] }), '朋友');
});

test('直接关系查询只返回最新关系边中的一层相邻节点', () => {
  const graph = buildRelationshipGraph(CHARACTER_ARCHIVE);
  const expected = new Set();
  graph.edges.forEach((edge) => {
    if (edge.source === 'huanyi') expected.add(edge.target);
    if (edge.target === 'huanyi') expected.add(edge.source);
  });

  assert.deepEqual(new Set(getDirectRelationIds(graph, 'huanyi')), expected);
  assert.equal(getDirectRelationIds(graph, 'huanyi').includes('huanyi'), false);
});

test('三维初始位置稳定、有限且位于球体体积内', () => {
  const first = createInitialPosition('huanyi', 0, 67, 310);
  const repeated = createInitialPosition('huanyi', 0, 67, 310);
  const allPositions = Array.from({ length: 67 }, (_, index) => (
    createInitialPosition(`node-${index}`, index, 67, 310)
  ));

  assert.deepEqual(first, repeated);
  assert.equal(['x', 'y', 'z'].every((axis) => Number.isFinite(first[axis])), true);
  assert.ok(allPositions.every((position) => Math.hypot(position.x, position.y, position.z) <= 297));
});

test('物理持续移动并把节点限制在硬球界内', () => {
  const nodes = [
    { id: 'a', x: 400, y: 0, z: 0, vx: 4, vy: 0, vz: 0, phase: 0 },
    { id: 'b', x: 20, y: 0, z: 0, vx: 0, vy: 0, vz: 0, phase: 1 },
  ];
  const before = nodes.map(({ x, y, z }) => [x, y, z]);

  stepRelationshipSimulation(nodes, [{ source: 'a', target: 'b' }], { time: 1, radius: 310 });

  assert.ok(nodes.every((node) => Math.hypot(node.x, node.y, node.z) <= 297.001));
  assert.ok(nodes.some((node, index) => (
    Math.hypot(node.x - before[index][0], node.y - before[index][1], node.z - before[index][2]) > 0.01
  )));
});

test('星图使用克制的三维物理参数', () => {
  assert.equal(RELATIONSHIP_PHYSICS.radius, 310);
  assert.ok(RELATIONSHIP_PHYSICS.repulsion <= 900);
  assert.ok(RELATIONSHIP_PHYSICS.linkDistance <= 145);
  assert.ok(RELATIONSHIP_PHYSICS.velocityRetention <= 0.92);
  assert.equal(RELATIONSHIP_PHYSICS.pickRadius, 20);
});
