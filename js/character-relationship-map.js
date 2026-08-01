(function initModule(root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.CharacterRelationshipMap = Object.freeze(api);
    if (root.document) {
      root.CharacterRelationshipMapInstance = api.initRelationshipMap(root.document, root.CHARACTER_ARCHIVE);
    }
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, (root) => {
  'use strict';

  const RELATIONSHIP_PHYSICS = Object.freeze({
    radius: 310,
    boundaryPadding: 13,
    repulsion: 880,
    linkDistance: 118,
    springStrength: 0.0017,
    collisionDistance: 32,
    velocityRetention: 0.91,
    driftStrength: 0.011,
    orbitStrength: 0.000018,
    pickRadius: 20,
  });

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function createInitialPosition(id, index, total, radius = 1) {
    const hash = hashString(id);
    const u = ((hash % 1000) + 0.5) / 1000;
    const v = (((hash >>> 10) % 1000) + 0.5) / 1000;
    const rawDistance = radius * (0.18 + 0.78 * Math.cbrt((index + 0.65) / Math.max(total, 1)));
    const maximumDistance = radius > RELATIONSHIP_PHYSICS.boundaryPadding
      ? radius - RELATIONSHIP_PHYSICS.boundaryPadding
      : radius;
    const distance = Math.min(rawDistance, maximumDistance);
    const theta = Math.PI * 2 * u;
    const phi = Math.acos(2 * v - 1);
    return {
      x: distance * Math.sin(phi) * Math.cos(theta),
      y: distance * Math.cos(phi),
      z: distance * Math.sin(phi) * Math.sin(theta),
    };
  }

  function edgesFromCharacterRelations(characters) {
    const edges = [];
    characters.forEach((character) => {
      character.relations.forEach((relation) => {
        if (!relation.targetId) return;
        edges.push({
          source: character.id,
          target: relation.targetId,
          direction: 'directed',
          relation: relation.label,
          labels: [relation.label],
          displayLabel: relation.displayLabel || '',
          relationType: relation.relationType || '',
        });
      });
    });
    return edges;
  }

  function buildRelationshipGraph(archive) {
    const categories = new Map(archive.categories.map((category) => [category.id, category]));
    const relationshipNodes = Array.isArray(archive.relationshipNodes) ? archive.relationshipNodes : [];
    const nodeLabels = archive.relationshipNodeLabels || {};
    const nodes = archive.characters.map((character, index) => ({
      id: character.id,
      name: nodeLabels[character.id] || character.name,
      category: character.category,
      categoryName: categories.get(character.category)?.name || character.category,
      profileId: character.id,
      nodeType: 'character',
      index,
    })).concat(relationshipNodes.map((node, offset) => ({
      ...node,
      name: nodeLabels[node.id] || node.name,
      categoryName: node.categoryName || categories.get(node.category)?.name || node.category,
      profileId: Object.hasOwn(node, 'profileId') ? node.profileId : node.id,
      nodeType: node.nodeType || 'relationship',
      index: archive.characters.length + offset,
    })));
    const validIds = new Set(nodes.map((node) => node.id));
    const sourceEdges = Array.isArray(archive.relationshipEdges) && archive.relationshipEdges.length
      ? archive.relationshipEdges
      : edgesFromCharacterRelations(archive.characters);
    const edges = sourceEdges
      .filter((edge) => validIds.has(edge.source) && validIds.has(edge.target) && edge.source !== edge.target)
      .map((edge, index) => ({
        ...edge,
        key: `${edge.source}:${edge.target}:${index}`,
        direction: edge.direction || 'directed',
        labels: edge.labels || (edge.relation ? [edge.relation] : []),
      }));
    const bundleByPair = new Map();
    edges.forEach((edge) => {
      const pairKey = [edge.source, edge.target].sort().join('::');
      if (!bundleByPair.has(pairKey)) bundleByPair.set(pairKey, { key: pairKey, edges: [] });
      bundleByPair.get(pairKey).edges.push(edge);
    });
    return { nodes, edges, bundles: [...bundleByPair.values()] };
  }

  function getDirectRelationIds(graph, characterId) {
    const ids = new Set();
    graph.edges.forEach((edge) => {
      if (edge.source === characterId) ids.add(edge.target);
      if (edge.target === characterId) ids.add(edge.source);
    });
    return [...ids];
  }

  function formatRelationshipLabel(edge) {
    if (edge.displayLabel) return edge.displayLabel;
    return [...new Set((edge.labels || []).filter(Boolean))].join(' ↔ ');
  }

  function getEdgeVisualSemantics(edge) {
    const mutual = edge.direction === 'mutual';
    return {
      colorKind: mutual ? 'mutual' : 'directed',
      arrowAtSource: mutual,
      arrowAtTarget: true,
    };
  }

  function getBundleVisualSemantics(bundle, sourceId, targetId) {
    const mutual = bundle.edges.some((edge) => edge.direction === 'mutual');
    if (mutual) {
      return { colorKind: 'mutual', arrowAtSource: true, arrowAtTarget: true };
    }
    return {
      colorKind: 'directed',
      arrowAtSource: bundle.edges.some((edge) => edge.source === targetId && edge.target === sourceId),
      arrowAtTarget: bundle.edges.some((edge) => edge.source === sourceId && edge.target === targetId),
    };
  }

  function getNodeVisualKind({ focused = false } = {}) {
    return focused ? 'focus' : 'normal';
  }

  function stepRelationshipSimulation(nodes, edges, options = {}) {
    const settings = { ...RELATIONSHIP_PHYSICS, ...options };
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const time = options.time || 0;

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        const dx = right.x - left.x;
        const dy = right.y - left.y;
        const dz = right.z - left.z;
        const distanceSquared = Math.max(dx * dx + dy * dy + dz * dz, 160);
        const distance = Math.sqrt(distanceSquared);
        const collision = distance < settings.collisionDistance
          ? (settings.collisionDistance - distance) * 0.025
          : 0;
        const force = settings.repulsion / distanceSquared + collision;
        left.vx -= (dx / distance) * force;
        left.vy -= (dy / distance) * force;
        left.vz -= (dz / distance) * force;
        right.vx += (dx / distance) * force;
        right.vy += (dy / distance) * force;
        right.vz += (dz / distance) * force;
      }
    }

    edges.forEach((edge) => {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);
      if (!source || !target) return;
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dz = target.z - source.z;
      const distance = Math.max(Math.hypot(dx, dy, dz), 1);
      const force = (distance - settings.linkDistance) * settings.springStrength;
      source.vx += (dx / distance) * force;
      source.vy += (dy / distance) * force;
      source.vz += (dz / distance) * force;
      target.vx -= (dx / distance) * force;
      target.vy -= (dy / distance) * force;
      target.vz -= (dz / distance) * force;
    });

    const limit = settings.radius - settings.boundaryPadding;
    nodes.forEach((node) => {
      const phase = node.phase || 0;
      node.vx += Math.sin(time * 0.72 + phase) * settings.driftStrength
        - node.z * settings.orbitStrength;
      node.vy += Math.cos(time * 0.61 + phase * 1.7) * settings.driftStrength * 0.82;
      node.vz += Math.sin(time * 0.53 + phase * 2.3) * settings.driftStrength
        + node.x * settings.orbitStrength;
      node.vx *= settings.velocityRetention;
      node.vy *= settings.velocityRetention;
      node.vz *= settings.velocityRetention;
      node.x += node.vx;
      node.y += node.vy;
      node.z += node.vz;

      const distance = Math.hypot(node.x, node.y, node.z);
      if (distance <= limit) return;
      const nx = node.x / distance;
      const ny = node.y / distance;
      const nz = node.z / distance;
      const outwardSpeed = node.vx * nx + node.vy * ny + node.vz * nz;
      const scale = limit / distance;
      node.x *= scale;
      node.y *= scale;
      node.z *= scale;
      if (outwardSpeed > 0) {
        node.vx -= nx * outwardSpeed;
        node.vy -= ny * outwardSpeed;
        node.vz -= nz * outwardSpeed;
      }
    });
  }

  function initRelationshipMap(documentRef, archive) {
    if (!documentRef || !archive) return null;
    const modal = documentRef.getElementById('relationshipMapModal');
    const canvas = documentRef.getElementById('relationshipMapCanvas');
    const openButton = documentRef.getElementById('openRelationshipMap');
    if (!modal || !canvas || !openButton || canvas.dataset.relationshipMapReady) return null;
    const context = canvas.getContext('2d');
    canvas.dataset.relationshipMapReady = 'true';
    canvas.hidden = !context;

    const graph = buildRelationshipGraph(archive);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set()]));
    graph.edges.forEach((edge) => {
      adjacency.get(edge.source).add(edge.target);
      adjacency.get(edge.target).add(edge.source);
    });
    const simulationLinks = graph.bundles.map((bundle) => bundle.edges[0]);
    const simulationNodes = graph.nodes.map((node) => {
      const initial = createInitialPosition(
        node.id,
        node.index,
        graph.nodes.length,
        RELATIONSHIP_PHYSICS.radius,
      );
      return {
        ...node,
        ...initial,
        vx: 0,
        vy: 0,
        vz: 0,
        phase: (hashString(node.id) % 628) / 100,
      };
    });
    const simulationNodeById = new Map(simulationNodes.map((node) => [node.id, node]));
    const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const camera = 900;
    const stars = Array.from({ length: 120 }, (_, index) => ({
      x: (hashString(`star-x-${index}`) % 1000) / 1000,
      y: (hashString(`star-y-${index}`) % 1000) / 1000,
      alpha: 0.16 + (hashString(`star-a-${index}`) % 58) / 100,
    }));
    const elements = {
      dialog: documentRef.getElementById('relationshipMapDialog'),
      close: documentRef.getElementById('closeRelationshipMap'),
      select: documentRef.getElementById('relationshipMapCharacterSelect'),
      view: documentRef.getElementById('relationshipMapViewCharacter'),
      focusName: documentRef.getElementById('relationshipMapFocusName'),
      focusMeta: documentRef.getElementById('relationshipMapFocusMeta'),
      nodeCount: documentRef.getElementById('relationshipMapNodeCount'),
      edgeCount: documentRef.getElementById('relationshipMapEdgeCount'),
      pause: documentRef.getElementById('relationshipMapPause'),
      reset: documentRef.getElementById('relationshipMapReset'),
      runState: documentRef.getElementById('relationshipMapRunState'),
      runtime: documentRef.querySelector('.relationship-map-runtime'),
      liveSummary: documentRef.getElementById('relationshipMapLiveSummary'),
    };

    let width = 0;
    let height = 0;
    let dpr = 1;
    let yaw = -0.35;
    let pitch = 0.18;
    let zoom = 1;
    let paused = reducedMotion;
    let elapsed = 0;
    let frameAccumulator = 0;
    let lastFrameTime = 0;
    let frameId = 0;
    let focusedId = null;
    let hoveredId = null;
    let pointer = null;
    let lastFocusedElement = null;

    elements.nodeCount.textContent = String(graph.nodes.length);
    elements.edgeCount.textContent = String(graph.edges.length);
    elements.select.replaceChildren(
      new Option('全部角色', ''),
      ...graph.nodes
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
        .map((node) => new Option(`${node.name} · ${node.categoryName}`, node.id)),
    );

    function palette() {
      const light = documentRef.body.classList.contains('light-mode');
      return light ? {
        backgroundInner: '#f7fbfd',
        backgroundMiddle: '#e9f3f8',
        backgroundOuter: '#dce9f1',
        star: '#4c7f98',
        sphereFillInner: 'rgba(36, 138, 178, 0.035)',
        sphereFillOuter: 'rgba(102, 79, 190, 0.08)',
        sphereStroke: 'rgba(8, 127, 158, 0.28)',
        sphereGrid: 'rgba(8, 127, 158, 0.10)',
        directed: '#087f9e',
        directedBright: '#036983',
        mutual: '#7354cf',
        mutualBright: '#5f3fbf',
        edgeDim: 'rgba(63, 91, 108, 0.10)',
        normalFill: '#f7feff',
        normalStroke: '#087f9e',
        normalGlow: 'rgba(8, 127, 158, 0.34)',
        hubFill: '#f4efff',
        hubStroke: '#7354cf',
        hubGlow: 'rgba(115, 84, 207, 0.35)',
        collectiveFill: '#fff7dc',
        collectiveStroke: '#9a741f',
        collectiveGlow: 'rgba(154, 116, 31, 0.32)',
        focusFill: '#ffffff',
        focusStroke: '#087f9e',
        focusGlow: 'rgba(8, 127, 158, 0.62)',
        label: '#193746',
        labelDim: '#718693',
        labelPlate: 'rgba(249, 252, 254, 0.90)',
        leader: 'rgba(8, 127, 158, 0.34)',
        edgeLabelText: '#213d4b',
        edgeLabelPlate: 'rgba(250, 253, 255, 0.95)',
        edgeLabelBorder: 'rgba(8, 127, 158, 0.38)',
      } : {
        backgroundInner: '#0b1c33',
        backgroundMiddle: '#071021',
        backgroundOuter: '#030610',
        star: '#ccefff',
        sphereFillInner: 'rgba(65, 155, 218, 0.045)',
        sphereFillOuter: 'rgba(104, 93, 224, 0.09)',
        sphereStroke: 'rgba(92, 228, 255, 0.18)',
        sphereGrid: 'rgba(92, 228, 255, 0.06)',
        directed: '#4ccfe9',
        directedBright: '#78efff',
        mutual: '#9d8cff',
        mutualBright: '#c4b3ff',
        edgeDim: 'rgba(126, 188, 230, 0.055)',
        normalFill: '#dffaff',
        normalStroke: '#5ce4ff',
        normalGlow: 'rgba(92, 228, 255, 0.62)',
        hubFill: '#e7dfff',
        hubStroke: '#a38aff',
        hubGlow: 'rgba(163, 138, 255, 0.68)',
        collectiveFill: '#fff1bd',
        collectiveStroke: '#d9b85f',
        collectiveGlow: 'rgba(217, 184, 95, 0.55)',
        focusFill: '#ffffff',
        focusStroke: '#a38aff',
        focusGlow: 'rgba(183, 162, 255, 0.95)',
        label: '#edfaff',
        labelDim: '#64788c',
        labelPlate: 'rgba(3, 8, 19, 0.80)',
        leader: 'rgba(90, 191, 232, 0.30)',
        edgeLabelText: '#f1ebff',
        edgeLabelPlate: 'rgba(6, 11, 26, 0.94)',
        edgeLabelBorder: 'rgba(172, 149, 255, 0.48)',
      };
    }

    function apparentSphereRadius() {
      const radius = RELATIONSHIP_PHYSICS.radius;
      return radius * camera / Math.sqrt(camera * camera - radius * radius);
    }

    function fitScale() {
      if (!width || !height) return 1;
      return Math.min(1, Math.max(0.35, (Math.min(width, height) - 46) / (apparentSphereRadius() * 2)));
    }

    function rotatePoint(node) {
      const cosYaw = Math.cos(yaw);
      const sinYaw = Math.sin(yaw);
      const cosPitch = Math.cos(pitch);
      const sinPitch = Math.sin(pitch);
      const x = node.x * cosYaw - node.z * sinYaw;
      const z = node.x * sinYaw + node.z * cosYaw;
      return {
        x,
        y: node.y * cosPitch - z * sinPitch,
        z: node.y * sinPitch + z * cosPitch,
      };
    }

    function projectPoint(node) {
      const rotated = rotatePoint(node);
      const depth = camera / (camera - rotated.z);
      const scale = fitScale() * zoom;
      return {
        x: width / 2 + rotated.x * depth * scale,
        y: height / 2 + rotated.y * depth * scale,
        z: rotated.z,
        depth,
      };
    }

    function resizeCanvas() {
      if (!context) return;
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(320, rect.width);
      const nextHeight = Math.max(360, rect.height);
      dpr = Math.min(root.devicePixelRatio || 1, 2);
      canvas.width = Math.round(nextWidth * dpr);
      canvas.height = Math.round(nextHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = nextWidth;
      height = nextHeight;
      requestDraw();
    }

    function resetSphere() {
      simulationNodes.forEach((node, index) => {
        const initial = createInitialPosition(
          node.id,
          index,
          simulationNodes.length,
          RELATIONSHIP_PHYSICS.radius,
        );
        node.x = initial.x;
        node.y = initial.y;
        node.z = initial.z;
        node.vx = 0;
        node.vy = 0;
        node.vz = 0;
      });
      yaw = -0.35;
      pitch = 0.18;
      zoom = 1;
      elapsed = 0;
      setFocus('');
      requestDraw();
    }

    function drawBackground(colors) {
      const radius = Math.max(width, height) * 0.72;
      const gradient = context.createRadialGradient(width / 2, height * 0.48, 0, width / 2, height * 0.48, radius);
      gradient.addColorStop(0, colors.backgroundInner);
      gradient.addColorStop(0.62, colors.backgroundMiddle);
      gradient.addColorStop(1, colors.backgroundOuter);
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.fillStyle = colors.star;
      stars.forEach((star) => {
        context.globalAlpha = star.alpha;
        context.fillRect(star.x * width, star.y * height, 1, 1);
      });
      context.globalAlpha = 1;
    }

    function drawSphere(colors) {
      const radius = apparentSphereRadius() * fitScale() * zoom;
      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        radius * 0.08,
        width / 2,
        height / 2,
        radius,
      );
      gradient.addColorStop(0, colors.sphereFillInner);
      gradient.addColorStop(0.72, colors.sphereFillInner);
      gradient.addColorStop(1, colors.sphereFillOuter);
      context.save();
      context.fillStyle = gradient;
      context.strokeStyle = colors.sphereStroke;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(width / 2, height / 2, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.strokeStyle = colors.sphereGrid;
      [-0.58, -0.28, 0.28, 0.58].forEach((ratio) => {
        context.beginPath();
        context.ellipse(
          width / 2,
          height / 2,
          radius * Math.sqrt(1 - ratio * ratio),
          radius * 0.17,
          0,
          0,
          Math.PI * 2,
        );
        context.stroke();
      });
      context.restore();
    }

    function nodeRadius(node, point) {
      const related = focusedId ? adjacency.get(focusedId) : null;
      const focus = node.id === focusedId;
      const direct = Boolean(related?.has(node.id));
      const hub = adjacency.get(node.id).size >= 7;
      const base = focus ? 10 : direct ? 7.8 : node.nodeType === 'collective' ? 7.2 : hub ? 7 : 5.3;
      return base * clamp(point.depth, 0.72, 1.34);
    }

    function drawArrow(from, to, color, alpha, offset) {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const distance = Math.max(Math.hypot(dx, dy), 1);
      const ux = dx / distance;
      const uy = dy / distance;
      const x = to.x - ux * offset;
      const y = to.y - uy * offset;
      const size = 7;
      context.save();
      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x - ux * size - uy * size * 0.68, y - uy * size + ux * size * 0.68);
      context.lineTo(x - ux * size + uy * size * 0.68, y - uy * size - ux * size * 0.68);
      context.closePath();
      context.fill();
      context.restore();
    }

    function drawBundles(projected, colors) {
      const sorted = graph.bundles.slice().sort((left, right) => {
        const leftEdge = left.edges[0];
        const rightEdge = right.edges[0];
        return projected.get(leftEdge.source).z + projected.get(leftEdge.target).z
          - projected.get(rightEdge.source).z - projected.get(rightEdge.target).z;
      });
      sorted.forEach((bundle) => {
        const first = bundle.edges[0];
        const source = projected.get(first.source);
        const target = projected.get(first.target);
        const visual = getBundleVisualSemantics(bundle, first.source, first.target);
        const active = !focusedId || bundle.edges.some((edge) => (
          edge.source === focusedId || edge.target === focusedId
        ));
        const color = visual.colorKind === 'mutual'
          ? active && focusedId ? colors.mutualBright : colors.mutual
          : active && focusedId ? colors.directedBright : colors.directed;
        const alpha = focusedId
          ? active ? 0.86 : 0.07
          : clamp((source.depth + target.depth) * 0.23, 0.14, 0.54);
        context.save();
        context.globalAlpha = alpha;
        context.strokeStyle = active ? color : colors.edgeDim;
        context.lineWidth = active && focusedId ? 1.8 : visual.colorKind === 'mutual' ? 1.05 : 0.9;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.stroke();
        context.restore();
        if (!active && focusedId) return;
        const sourceRadius = nodeRadius(simulationNodeById.get(first.source), source) + 5;
        const targetRadius = nodeRadius(simulationNodeById.get(first.target), target) + 5;
        if (visual.arrowAtTarget) drawArrow(source, target, color, alpha, targetRadius);
        if (visual.arrowAtSource) drawArrow(target, source, color, alpha, sourceRadius);
      });
    }

    function quadraticPoint(source, control, target, ratio) {
      const inverse = 1 - ratio;
      return {
        x: inverse * inverse * source.x + 2 * inverse * ratio * control.x + ratio * ratio * target.x,
        y: inverse * inverse * source.y + 2 * inverse * ratio * control.y + ratio * ratio * target.y,
      };
    }

    function drawEdgeLabel(text, point, colors, placedRects) {
      context.save();
      context.font = '600 10px "Microsoft YaHei", sans-serif';
      const widthLimit = Math.min(190, Math.max(54, context.measureText(text).width + 14));
      const plateHeight = 20;
      let y = point.y;
      let rect = null;
      for (const offset of [0, -22, 22, -44, 44]) {
        const candidate = {
          left: point.x - widthLimit / 2,
          right: point.x + widthLimit / 2,
          top: point.y + offset - plateHeight / 2,
          bottom: point.y + offset + plateHeight / 2,
        };
        const inside = candidate.left >= 3 && candidate.right <= width - 3
          && candidate.top >= 3 && candidate.bottom <= height - 3;
        const overlap = placedRects.some((placed) => !(
          candidate.right < placed.left || candidate.left > placed.right
          || candidate.bottom < placed.top || candidate.top > placed.bottom
        ));
        if (inside && !overlap) {
          rect = candidate;
          y = point.y + offset;
          break;
        }
      }
      if (!rect) {
        y = clamp(point.y, plateHeight / 2 + 3, height - plateHeight / 2 - 3);
        const centerX = clamp(point.x, widthLimit / 2 + 3, width - widthLimit / 2 - 3);
        rect = {
          left: centerX - widthLimit / 2,
          right: centerX + widthLimit / 2,
          top: y - plateHeight / 2,
          bottom: y + plateHeight / 2,
        };
        point = { ...point, x: centerX };
      }
      placedRects.push(rect);
      context.fillStyle = colors.edgeLabelPlate;
      context.strokeStyle = colors.edgeLabelBorder;
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, 6);
      context.fill();
      context.stroke();
      context.fillStyle = colors.edgeLabelText;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, point.x, y, widthLimit - 10);
      context.restore();
    }

    function drawFocusedRelationships(projected, colors) {
      if (!focusedId) return [];
      const focusedEdges = graph.edges.filter((edge) => (
        edge.source === focusedId || edge.target === focusedId
      ));
      const placedRects = [];
      focusedEdges.forEach((edge) => {
        const bundle = graph.bundles.find((item) => item.edges.includes(edge));
        const laneIndex = bundle.edges.indexOf(edge);
        const laneOffset = (laneIndex - (bundle.edges.length - 1) / 2) * 16;
        const source = projected.get(edge.source);
        const target = projected.get(edge.target);
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const length = Math.max(Math.hypot(dx, dy), 1);
        const normalX = -dy / length;
        const normalY = dx / length;
        const control = {
          x: (source.x + target.x) / 2 + normalX * laneOffset,
          y: (source.y + target.y) / 2 + normalY * laneOffset,
        };
        const visual = getEdgeVisualSemantics(edge);
        const color = visual.colorKind === 'mutual' ? colors.mutualBright : colors.directedBright;
        context.save();
        context.globalAlpha = 0.96;
        context.strokeStyle = color;
        context.lineWidth = 1.9;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.quadraticCurveTo(control.x, control.y, target.x, target.y);
        context.stroke();
        context.restore();
        const nearTarget = quadraticPoint(source, control, target, 0.86);
        const nearSource = quadraticPoint(source, control, target, 0.14);
        if (visual.arrowAtTarget) {
          drawArrow(
            nearTarget,
            target,
            color,
            0.98,
            nodeRadius(simulationNodeById.get(edge.target), target) + 5,
          );
        }
        if (visual.arrowAtSource) {
          drawArrow(
            nearSource,
            source,
            color,
            0.98,
            nodeRadius(simulationNodeById.get(edge.source), source) + 5,
          );
        }
        const labelPoint = quadraticPoint(source, control, target, 0.52);
        drawEdgeLabel(edge.relation || formatRelationshipLabel(edge), labelPoint, colors, placedRects);
      });
      return focusedEdges;
    }

    function drawNodes(projected, colors) {
      const related = focusedId ? adjacency.get(focusedId) : null;
      const entries = [];
      simulationNodes.slice().sort((left, right) => (
        projected.get(left.id).z - projected.get(right.id).z
      )).forEach((node) => {
        const point = projected.get(node.id);
        const focus = node.id === focusedId;
        const direct = Boolean(related?.has(node.id));
        const active = !focusedId || focus || direct;
        const hub = adjacency.get(node.id).size >= 7;
        const collective = node.nodeType === 'collective';
        const radius = nodeRadius(node, point);
        const visualKind = getNodeVisualKind({ focused: focus, hub, collective });
        const fill = visualKind === 'focus' ? colors.focusFill : colors.normalFill;
        const stroke = visualKind === 'focus' ? colors.focusStroke : colors.normalStroke;
        const glow = visualKind === 'focus' ? colors.focusGlow : colors.normalGlow;
        context.save();
        context.globalAlpha = focusedId ? active ? 1 : 0.13 : clamp(point.depth * 0.82, 0.46, 1);
        context.shadowBlur = focus ? 25 : collective || hub ? 17 : 10;
        context.shadowColor = glow;
        context.fillStyle = fill;
        context.strokeStyle = stroke;
        context.lineWidth = focus ? 3 : collective || direct ? 2.3 : 1.6;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        if (collective) {
          context.shadowBlur = 0;
          context.lineWidth = 1;
          context.beginPath();
          context.arc(point.x, point.y, radius + 4, 0, Math.PI * 2);
          context.stroke();
        }
        context.restore();
        entries.push({ node, point, active, radius });
      });
      return entries;
    }

    function drawNodeLabels(entries, colors) {
      const occupied = [];
      entries.sort((left, right) => (
        Number(right.node.id === focusedId) - Number(left.node.id === focusedId)
        || right.point.depth - left.point.depth
      )).forEach(({ node, point, active, radius }) => {
        const fontSize = clamp(10.3 * point.depth, 9, 12);
        const font = `600 ${fontSize}px "Microsoft YaHei", sans-serif`;
        context.font = font;
        const textWidth = context.measureText(node.name).width;
        const candidates = [];
        [8, 18, 30, 44, 60].forEach((distance) => {
          [[1, -0.55], [-1, -0.55], [1, 0.72], [-1, 0.72], [0, -1.25], [0, 1.25]]
            .forEach(([dx, dy]) => candidates.push({ dx, dy, distance }));
        });
        let placement = null;
        for (const candidate of candidates) {
          const x = point.x + candidate.dx * (radius + candidate.distance);
          const y = point.y + candidate.dy * (radius + candidate.distance);
          const align = candidate.dx < 0 ? 'right' : candidate.dx > 0 ? 'left' : 'center';
          const left = align === 'right' ? x - textWidth - 3 : align === 'left' ? x - 3 : x - textWidth / 2 - 3;
          const rect = { left, right: left + textWidth + 6, top: y - 11, bottom: y + 5 };
          const inside = rect.left > 3 && rect.right < width - 3 && rect.top > 3 && rect.bottom < height - 3;
          const overlap = occupied.some((item) => !(
            rect.right < item.left || rect.left > item.right || rect.bottom < item.top || rect.top > item.bottom
          ));
          if (inside && !overlap) {
            placement = { x, y, align, rect };
            break;
          }
        }
        if (!placement) {
          const x = clamp(point.x + radius + 4, 4, width - textWidth - 7);
          const y = clamp(point.y - 4, 14, height - 6);
          placement = {
            x,
            y,
            align: 'left',
            rect: { left: x - 3, right: x + textWidth + 3, top: y - 11, bottom: y + 5 },
          };
        }
        occupied.push(placement.rect);
        const labelCenterX = (placement.rect.left + placement.rect.right) / 2;
        const labelCenterY = (placement.rect.top + placement.rect.bottom) / 2;
        if (Math.hypot(labelCenterX - point.x, labelCenterY - point.y) > radius + 15) {
          context.save();
          context.globalAlpha = focusedId ? active ? 0.68 : 0.06 : 0.28;
          context.strokeStyle = colors.leader;
          context.lineWidth = 0.65;
          context.beginPath();
          context.moveTo(point.x, point.y);
          context.lineTo(labelCenterX, labelCenterY);
          context.stroke();
          context.restore();
        }
        context.save();
        context.globalAlpha = focusedId ? active ? 1 : 0.15 : clamp(point.depth * 0.88, 0.62, 1);
        context.fillStyle = colors.labelPlate;
        context.fillRect(
          placement.rect.left,
          placement.rect.top,
          placement.rect.right - placement.rect.left,
          placement.rect.bottom - placement.rect.top,
        );
        context.fillStyle = active ? colors.label : colors.labelDim;
        context.textAlign = placement.align;
        context.font = font;
        context.fillText(node.name, placement.x, placement.y);
        context.restore();
      });
    }

    function draw() {
      if (!context || !width || !height) return;
      const colors = palette();
      context.clearRect(0, 0, width, height);
      drawBackground(colors);
      drawSphere(colors);
      const projected = new Map(simulationNodes.map((node) => [node.id, projectPoint(node)]));
      drawBundles(projected, colors);
      const focusedEdges = drawFocusedRelationships(projected, colors);
      const entries = drawNodes(projected, colors);
      drawNodeLabels(entries, colors);
      canvas.dataset.visibleNodeLabels = String(graph.nodes.length);
      canvas.dataset.visibleEdgeLabels = String(focusedEdges.length);
      canvas.dataset.physicsState = paused ? 'paused' : 'running';
      canvas.dataset.nodeColorMode = 'uniform-cyan';
      canvas.dataset.directedColor = colors.directed;
      canvas.dataset.mutualColor = colors.mutual;
      canvas.dataset.reciprocalBundles = String(graph.bundles.filter((bundle) => {
        const first = bundle.edges[0];
        const visual = getBundleVisualSemantics(bundle, first.source, first.target);
        return visual.colorKind === 'directed' && visual.arrowAtSource && visual.arrowAtTarget;
      }).length);
      canvas.dataset.maximumRadius = String(Math.max(
        ...simulationNodes.map((node) => Math.hypot(node.x, node.y, node.z)),
      ));
    }

    function runFrame(timestamp = 0) {
      frameId = 0;
      if (modal.hidden || documentRef.hidden || !context) {
        lastFrameTime = 0;
        return;
      }
      if (!paused) {
        const frameDelta = lastFrameTime
          ? Math.min(Math.max((timestamp - lastFrameTime) / 1000, 0), 5 / 60)
          : 1 / 60;
        lastFrameTime = timestamp;
        frameAccumulator += frameDelta;
        let stepCount = 0;
        while (frameAccumulator >= 1 / 60 && stepCount < 5) {
          elapsed += 1 / 60;
          stepRelationshipSimulation(simulationNodes, simulationLinks, { time: elapsed });
          frameAccumulator -= 1 / 60;
          stepCount += 1;
        }
      }
      draw();
      if (!paused) frameId = root.requestAnimationFrame(runFrame);
    }

    function requestDraw() {
      if (context && !frameId && !modal.hidden) frameId = root.requestAnimationFrame(runFrame);
    }

    function setPaused(nextPaused) {
      paused = nextPaused;
      lastFrameTime = 0;
      frameAccumulator = 0;
      elements.pause.textContent = paused ? '继续物理' : '暂停物理';
      elements.runState.textContent = paused
        ? reducedMotion ? '物理已暂停（减少动态效果）' : '物理已暂停'
        : '微重力演算中';
      elements.runtime.classList.toggle('is-paused', paused);
      canvas.dataset.physicsState = paused ? 'paused' : 'running';
      requestDraw();
    }

    function setFocus(characterId) {
      focusedId = nodeById.has(characterId) ? characterId : null;
      elements.select.value = focusedId || '';
      if (!focusedId) {
        elements.focusName.textContent = '全部角色';
        elements.focusMeta.textContent = '选择角色后显示其直接关系文字';
        elements.liveSummary.textContent = '已显示全部角色关系';
        elements.view.disabled = true;
      } else {
        const node = nodeById.get(focusedId);
        const count = adjacency.get(focusedId).size;
        const collective = node.nodeType === 'collective' || !node.profileId;
        const relationshipTexts = graph.edges
          .filter((edge) => edge.source === focusedId || edge.target === focusedId)
          .map((edge) => edge.displayLabel || formatRelationshipLabel(edge));
        elements.focusName.textContent = node.name;
        elements.focusMeta.textContent = !context
          ? relationshipTexts.join('；') || '暂无直接关系资料'
          : collective
          ? `${node.categoryName} · ${count} 位直接关系角色 · 集合节点，无独立档案`
          : `${node.categoryName} · ${count} 位直接关系角色`;
        elements.liveSummary.textContent = `${node.name}，${count} 位直接关系角色。${relationshipTexts.join('；')}${collective ? '；集合节点，无独立档案' : ''}`;
        elements.view.disabled = collective;
      }
      requestDraw();
    }

    function pickNode(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let nearest = null;
      let nearestDistance = RELATIONSHIP_PHYSICS.pickRadius;
      simulationNodes.forEach((node) => {
        const point = projectPoint(node);
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < nearestDistance) {
          nearest = node;
          nearestDistance = distance;
        }
      });
      return nearest;
    }

    function openModal() {
      lastFocusedElement = documentRef.activeElement;
      modal.hidden = false;
      documentRef.body.classList.add('relationship-map-open');
      root.requestAnimationFrame(() => {
        resizeCanvas();
        elements.close.focus();
        setPaused(paused);
      });
    }

    function closeModal() {
      modal.hidden = true;
      documentRef.body.classList.remove('relationship-map-open');
      if (frameId) root.cancelAnimationFrame(frameId);
      frameId = 0;
      lastFrameTime = 0;
      frameAccumulator = 0;
      lastFocusedElement?.focus();
    }

    function focusableElements() {
      return [...elements.dialog.querySelectorAll('button:not([disabled]), select, [tabindex]:not([tabindex="-1"])')];
    }

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      pointer = {
        x: event.clientX,
        y: event.clientY,
        yaw,
        pitch,
        moved: false,
      };
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!pointer) {
        hoveredId = pickNode(event.clientX, event.clientY)?.id || null;
        canvas.style.cursor = hoveredId ? 'pointer' : 'grab';
        return;
      }
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.moved ||= Math.hypot(dx, dy) > 4;
      yaw = pointer.yaw + dx * 0.006;
      pitch = clamp(pointer.pitch + dy * 0.006, -1.08, 1.08);
      requestDraw();
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!pointer?.moved) setFocus(pickNode(event.clientX, event.clientY)?.id || '');
      pointer = null;
      canvas.releasePointerCapture(event.pointerId);
      requestDraw();
    });
    canvas.addEventListener('pointercancel', () => {
      pointer = null;
      requestDraw();
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      zoom = clamp(zoom * Math.exp(-event.deltaY * 0.001), 0.58, 2.15);
      requestDraw();
    }, { passive: false });

    openButton.addEventListener('click', openModal);
    elements.close.addEventListener('click', closeModal);
    elements.select.addEventListener('change', () => setFocus(elements.select.value));
    elements.pause.addEventListener('click', () => setPaused(!paused));
    elements.reset.addEventListener('click', resetSphere);
    elements.view.addEventListener('click', () => {
      if (!focusedId) return;
      const profileId = nodeById.get(focusedId)?.profileId;
      if (!profileId) return;
      closeModal();
      if (root.location.hash.slice(1) === profileId) {
        root.dispatchEvent(new Event('hashchange'));
      } else {
        root.location.hash = profileId;
      }
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    documentRef.addEventListener('keydown', (event) => {
      if (modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = focusableElements();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && documentRef.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && documentRef.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
    root.addEventListener('resize', () => {
      if (!modal.hidden) resizeCanvas();
    });
    documentRef.addEventListener('visibilitychange', () => {
      if (documentRef.hidden) {
        if (frameId) root.cancelAnimationFrame(frameId);
        frameId = 0;
        lastFrameTime = 0;
        frameAccumulator = 0;
      } else {
        requestDraw();
      }
    });
    new MutationObserver(() => requestDraw()).observe(documentRef.body, {
      attributes: true,
      attributeFilter: ['class'],
    });

    setPaused(paused);
    setFocus('');

    return {
      graph,
      openModal,
      closeModal,
      setFocus,
      getDiagnostics() {
        return simulationNodes.map(({ id, x, y, z }) => ({ id, x, y, z }));
      },
      getViewState() {
        return { yaw, pitch, zoom, paused, frameActive: Boolean(frameId) };
      },
    };
  }

  return {
    RELATIONSHIP_PHYSICS,
    buildRelationshipGraph,
    createInitialPosition,
    formatRelationshipLabel,
    getBundleVisualSemantics,
    getDirectRelationIds,
    getEdgeVisualSemantics,
    getNodeVisualKind,
    initRelationshipMap,
    stepRelationshipSimulation,
  };
}));
