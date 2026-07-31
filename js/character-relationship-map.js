(function initModule(root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.CharacterRelationshipMap = Object.freeze(api);
    if (root.document) api.initRelationshipMap(root.document, root.CHARACTER_ARCHIVE);
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, (root) => {
  'use strict';

  const RELATIONSHIP_PHYSICS = Object.freeze({
    repulsion: 820,
    linkDistance: 138,
    springStrength: 0.014,
    centerStrength: 0.0015,
    velocityRetention: 0.72,
    alphaDecay: 0.96,
    minimumAlpha: 0.012,
    dragReheat: 0.12,
    pickRadius: 18,
  });

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createInitialPosition(id, index, total) {
    const hash = hashString(id);
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const angle = index * goldenAngle + ((hash % 997) / 997) * 0.55;
    const radius = 0.2 + 0.72 * Math.sqrt((index + 1) / Math.max(total, 1));
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  }

  function buildRelationshipGraph(archive) {
    const categories = new Map(archive.categories.map((category) => [category.id, category]));
    const relationshipNodes = Array.isArray(archive.relationshipNodes) ? archive.relationshipNodes : [];
    const nodes = archive.characters.map((character, index) => ({
      id: character.id,
      name: character.name,
      category: character.category,
      categoryName: categories.get(character.category)?.name || character.category,
      profileId: character.id,
      index,
    })).concat(relationshipNodes.map((node, offset) => ({
      ...node,
      categoryName: categories.get(node.category)?.name || node.category,
      profileId: node.profileId || node.id,
      index: archive.characters.length + offset,
    })));
    const validIds = new Set(nodes.map((node) => node.id));
    const edgeByKey = new Map();

    function addEdge(sourceId, targetId, relation = {}) {
      if (!validIds.has(sourceId) || !validIds.has(targetId) || sourceId === targetId) return;
      const [source, target] = [sourceId, targetId].sort();
      const key = `${source}::${target}`;
      if (!edgeByKey.has(key)) {
        edgeByKey.set(key, {
          key,
          source,
          target,
          labels: [],
          displayLabels: [],
          relationTypes: [],
        });
      }
      const edge = edgeByKey.get(key);
      if (relation.label && !edge.labels.includes(relation.label)) edge.labels.push(relation.label);
      if (relation.displayLabel && !edge.displayLabels.includes(relation.displayLabel)) {
        edge.displayLabels.push(relation.displayLabel);
      }
      if (relation.relationType && !edge.relationTypes.includes(relation.relationType)) {
        edge.relationTypes.push(relation.relationType);
      }
    }

    archive.characters.forEach((character) => {
      character.relations.forEach((relation) => {
        if (!relation.targetId) return;
        addEdge(character.id, relation.targetId, relation);
      });
    });

    (archive.relationshipEdges || []).forEach((edge) => {
      addEdge(edge.source, edge.target, edge);
    });

    const edges = [...edgeByKey.values()].map((edge) => ({
      ...edge,
      displayLabel: edge.displayLabels[0] || '',
      relationType: edge.relationTypes[0] || '',
    }));
    return { nodes, edges };
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
    return [...new Set(edge.labels.filter(Boolean))].join(' ↔ ');
  }

  function initRelationshipMap(documentRef, archive) {
    if (!documentRef || !archive) return null;
    const modal = documentRef.getElementById('relationshipMapModal');
    const canvas = documentRef.getElementById('relationshipMapCanvas');
    const openButton = documentRef.getElementById('openRelationshipMap');
    if (!modal || !canvas || !openButton || canvas.dataset.relationshipMapReady) return null;
    canvas.dataset.relationshipMapReady = 'true';

    const graph = buildRelationshipGraph(archive);
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const adjacency = new Map(graph.nodes.map((node) => [node.id, new Set()]));
    graph.edges.forEach((edge) => {
      adjacency.get(edge.source).add(edge.target);
      adjacency.get(edge.target).add(edge.source);
    });

    const elements = {
      dialog: documentRef.getElementById('relationshipMapDialog'),
      close: documentRef.getElementById('closeRelationshipMap'),
      select: documentRef.getElementById('relationshipMapCharacterSelect'),
      view: documentRef.getElementById('relationshipMapViewCharacter'),
      focusName: documentRef.getElementById('relationshipMapFocusName'),
      focusMeta: documentRef.getElementById('relationshipMapFocusMeta'),
      nodeCount: documentRef.getElementById('relationshipMapNodeCount'),
      edgeCount: documentRef.getElementById('relationshipMapEdgeCount'),
    };
    const context = canvas.getContext('2d');
    const reducedMotion = root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let focusedId = null;
    let hoveredId = null;
    let frameId = 0;
    let alpha = 1;
    let lastFocusedElement = null;
    let pointer = null;
    let draggedNode = null;
    let didMove = false;

    const simulationNodes = graph.nodes.map((node) => {
      const initial = createInitialPosition(node.id, node.index, graph.nodes.length);
      return { ...node, x: initial.x, y: initial.y, vx: 0, vy: 0 };
    });
    const simulationNodeById = new Map(simulationNodes.map((node) => [node.id, node]));

    elements.nodeCount.textContent = String(graph.nodes.length);
    elements.edgeCount.textContent = String(graph.edges.length);
    elements.select.replaceChildren(
      new Option('全部角色', ''),
      ...graph.nodes.map((node) => new Option(`${node.name} · ${node.categoryName}`, node.id)),
    );

    function palette() {
      const light = documentRef.body.classList.contains('light-mode');
      return light ? {
        backdrop: '#f4f8fb',
        grid: 'rgba(28, 91, 122, 0.10)',
        edge: 'rgba(36, 87, 122, 0.32)',
        edgeDim: 'rgba(36, 87, 122, 0.16)',
        edgeLabelText: '#214553',
        edgeLabelPlate: 'rgba(244, 248, 251, 0.94)',
        edgeLabelBorder: 'rgba(8, 127, 158, 0.42)',
        normalFill: '#eafcff',
        normalStroke: '#087f9e',
        normalGlow: 'rgba(8, 127, 158, 0.38)',
        directFill: '#efe9ff',
        directStroke: '#7857d8',
        directGlow: 'rgba(120, 87, 216, 0.48)',
        focusFill: '#ffffff',
        focusStroke: '#087f9e',
        focusGlow: 'rgba(8, 127, 158, 0.65)',
        label: '#1a3440',
        labelPlate: 'rgba(244, 248, 251, 0.88)',
      } : {
        backdrop: '#070b16',
        grid: 'rgba(107, 217, 255, 0.065)',
        edge: 'rgba(126, 188, 230, 0.30)',
        edgeDim: 'rgba(126, 188, 230, 0.16)',
        edgeLabelText: '#eafaff',
        edgeLabelPlate: 'rgba(8, 14, 28, 0.94)',
        edgeLabelBorder: 'rgba(85, 229, 255, 0.48)',
        normalFill: '#dffaff',
        normalStroke: '#38d8ff',
        normalGlow: 'rgba(56, 216, 255, 0.48)',
        directFill: '#ede7ff',
        directStroke: '#a88bff',
        directGlow: 'rgba(154, 118, 255, 0.66)',
        focusFill: '#f5ffff',
        focusStroke: '#55e5ff',
        focusGlow: 'rgba(66, 222, 255, 0.92)',
        label: '#f1fbff',
        labelPlate: 'rgba(7, 11, 22, 0.84)',
      };
    }

    function graphToScreen(node) {
      return {
        x: width / 2 + offsetX + node.x * scale,
        y: height / 2 + offsetY + node.y * scale,
      };
    }

    function screenToGraph(x, y) {
      return {
        x: (x - width / 2 - offsetX) / scale,
        y: (y - height / 2 - offsetY) / scale,
      };
    }

    function resizeCanvas(resetPositions = false) {
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(320, rect.width);
      const nextHeight = Math.max(360, rect.height);
      const dpr = Math.min(root.devicePixelRatio || 1, 2);
      canvas.width = Math.round(nextWidth * dpr);
      canvas.height = Math.round(nextHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = nextWidth;
      height = nextHeight;
      if (resetPositions || scale === 1) {
        const base = Math.min(width, height) * 0.42;
        simulationNodes.forEach((node) => {
          const initial = createInitialPosition(node.id, node.index, simulationNodes.length);
          node.x = initial.x * base;
          node.y = initial.y * base;
          node.vx = 0;
          node.vy = 0;
        });
        scale = 1;
        offsetX = 0;
        offsetY = 0;
        alpha = 1;
      }
      requestDraw();
    }

    function drawGrid(colors) {
      context.fillStyle = colors.backdrop;
      context.fillRect(0, 0, width, height);
      context.strokeStyle = colors.grid;
      context.lineWidth = 1;
      const gap = 48 * scale;
      if (gap < 18) return;
      const startX = ((width / 2 + offsetX) % gap + gap) % gap;
      const startY = ((height / 2 + offsetY) % gap + gap) % gap;
      context.beginPath();
      for (let x = startX; x < width; x += gap) {
        context.moveTo(x, 0);
        context.lineTo(x, height);
      }
      for (let y = startY; y < height; y += gap) {
        context.moveTo(0, y);
        context.lineTo(width, y);
      }
      context.stroke();
    }

    function drawLabel(node, point, colors, anchorPoint = null) {
      context.save();
      context.font = '600 12px "Microsoft YaHei", sans-serif';
      const textWidth = context.measureText(node.name).width;
      let labelX = point.x + 13;
      let labelY = point.y - 8;
      let align = 'left';
      if (anchorPoint) {
        const dx = point.x - anchorPoint.x;
        const dy = point.y - anchorPoint.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const directionX = dx / distance;
        const directionY = dy / distance;
        align = directionX < 0 ? 'right' : 'left';
        labelX = point.x + directionX * 17;
        labelY = point.y + directionY * 13;
      }
      const plateX = align === 'right' ? labelX - textWidth - 4 : labelX - 4;
      context.textAlign = align;
      context.fillStyle = colors.labelPlate;
      context.fillRect(plateX, labelY - 12, textWidth + 8, 18);
      context.fillStyle = colors.label;
      context.fillText(node.name, labelX, labelY + 1);
      context.restore();
    }

    function drawEdgeLabel(edge, source, target, colors, placedRects) {
      const text = formatRelationshipLabel(edge);
      if (!text) return;
      context.save();
      context.font = '600 11px "Microsoft YaHei", sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const plateWidth = Math.min(Math.max(width - 12, 120), 260, context.measureText(text).width + 18);
      const plateHeight = 24;
      const focusAtSource = edge.source === focusedId;
      const focusPoint = focusAtSource ? source : target;
      const relationPoint = focusAtSource ? target : source;
      const dx = relationPoint.x - focusPoint.x;
      const dy = relationPoint.y - focusPoint.y;
      const length = Math.max(Math.hypot(dx, dy), 1);
      const normalX = -dy / length;
      const normalY = dx / length;
      const candidates = [];
      [0.82, 0.72, 0.9, 0.64].forEach((ratio) => {
        [0, 14, -14, 28, -28, 42, -42].forEach((offset) => {
          candidates.push([ratio, offset]);
        });
      });
      let x = (source.x + target.x) / 2;
      let y = (source.y + target.y) / 2;
      let labelRect = null;
      for (const [ratio, offset] of candidates) {
        const candidateX = focusPoint.x + dx * ratio + normalX * offset;
        const candidateY = focusPoint.y + dy * ratio + normalY * offset;
        const candidateRect = {
          left: candidateX - plateWidth / 2 - 3,
          right: candidateX + plateWidth / 2 + 3,
          top: candidateY - plateHeight / 2 - 3,
          bottom: candidateY + plateHeight / 2 + 3,
        };
        const inside = candidateRect.left >= 4 && candidateRect.right <= width - 4
          && candidateRect.top >= 4 && candidateRect.bottom <= height - 4;
        const overlaps = placedRects.some((rect) => !(
          candidateRect.right < rect.left
          || candidateRect.left > rect.right
          || candidateRect.bottom < rect.top
          || candidateRect.top > rect.bottom
        ));
        if (inside && !overlaps) {
          x = candidateX;
          y = candidateY;
          labelRect = candidateRect;
          break;
        }
      }
      if (!labelRect) {
        x = Math.min(width - plateWidth / 2 - 4, Math.max(plateWidth / 2 + 4, x));
        y = Math.min(height - plateHeight / 2 - 4, Math.max(plateHeight / 2 + 4, y));
      }
      placedRects.push(labelRect || {
        left: x - plateWidth / 2,
        right: x + plateWidth / 2,
        top: y - plateHeight / 2,
        bottom: y + plateHeight / 2,
      });
      const plateX = x - plateWidth / 2;
      const plateY = y - plateHeight / 2;
      context.shadowBlur = 9;
      context.shadowColor = colors.edgeLabelBorder;
      context.fillStyle = colors.edgeLabelPlate;
      context.strokeStyle = colors.edgeLabelBorder;
      context.lineWidth = 1;
      context.beginPath();
      context.roundRect(plateX, plateY, plateWidth, plateHeight, 6);
      context.fill();
      context.shadowBlur = 0;
      context.stroke();
      context.fillStyle = colors.edgeLabelText;
      context.fillText(text, x, y + 0.5, plateWidth - 10);
      context.restore();
    }

    function draw() {
      frameId = 0;
      if (modal.hidden || !width || !height) return;
      const colors = palette();
      const related = focusedId ? adjacency.get(focusedId) : null;
      drawGrid(colors);

      const focusedEdges = [];
      graph.edges.forEach((edge) => {
        const source = graphToScreen(simulationNodeById.get(edge.source));
        const target = graphToScreen(simulationNodeById.get(edge.target));
        const isFocusedEdge = !focusedId || edge.source === focusedId || edge.target === focusedId;
        context.strokeStyle = focusedId && !isFocusedEdge ? colors.edgeDim : colors.edge;
        context.globalAlpha = focusedId && !isFocusedEdge ? 1 : 1;
        context.lineWidth = isFocusedEdge && focusedId ? 2 : 1.2;
        context.beginPath();
        context.moveTo(source.x, source.y);
        context.lineTo(target.x, target.y);
        context.stroke();
        if (focusedId && isFocusedEdge) focusedEdges.push({ edge, source, target });
      });
      context.globalAlpha = 1;
      canvas.dataset.visibleEdgeLabels = String(focusedEdges.length);
      const placedLabelRects = [];
      focusedEdges.forEach(({ edge, source, target }) => {
        drawEdgeLabel(edge, source, target, colors, placedLabelRects);
      });

      const focusedPoint = focusedId ? graphToScreen(simulationNodeById.get(focusedId)) : null;
      simulationNodes.forEach((node) => {
        const point = graphToScreen(node);
        const isFocus = node.id === focusedId;
        const isDirect = Boolean(related?.has(node.id));
        const dimmed = focusedId && !isFocus && !isDirect;
        const radius = isFocus ? 13 : isDirect ? 10 : 7;
        context.save();
        context.globalAlpha = dimmed ? 0.32 : 1;
        context.shadowBlur = isFocus ? 24 : isDirect ? 17 : 11;
        context.shadowColor = isFocus ? colors.focusGlow : isDirect ? colors.directGlow : colors.normalGlow;
        context.fillStyle = isFocus ? colors.focusFill : isDirect ? colors.directFill : colors.normalFill;
        context.strokeStyle = isFocus ? colors.focusStroke : isDirect ? colors.directStroke : colors.normalStroke;
        context.lineWidth = isFocus ? 3 : isDirect ? 2.4 : 2;
        context.beginPath();
        context.arc(point.x, point.y, radius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        if (isFocus) {
          context.shadowBlur = 0;
          context.lineWidth = 1.5;
          context.beginPath();
          context.arc(point.x, point.y, radius + 6, 0, Math.PI * 2);
          context.stroke();
        }
        context.restore();
        if (!dimmed && (isFocus || isDirect || node.id === hoveredId)) {
          drawLabel(node, point, colors, isDirect ? focusedPoint : null);
        }
      });
    }

    function simulate() {
      if (modal.hidden || documentRef.hidden) {
        frameId = 0;
        return;
      }
      if (!reducedMotion && alpha > RELATIONSHIP_PHYSICS.minimumAlpha) {
        const repulsion = RELATIONSHIP_PHYSICS.repulsion * alpha;
        for (let i = 0; i < simulationNodes.length; i += 1) {
          for (let j = i + 1; j < simulationNodes.length; j += 1) {
            const a = simulationNodes[i];
            const b = simulationNodes[j];
            let dx = b.x - a.x;
            let dy = b.y - a.y;
            const distanceSquared = Math.max(dx * dx + dy * dy, 100);
            const force = repulsion / distanceSquared;
            const distance = Math.sqrt(distanceSquared);
            dx /= distance;
            dy /= distance;
            a.vx -= dx * force;
            a.vy -= dy * force;
            b.vx += dx * force;
            b.vy += dy * force;
          }
        }
        graph.edges.forEach((edge) => {
          const source = simulationNodeById.get(edge.source);
          const target = simulationNodeById.get(edge.target);
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
          const force = (distance - RELATIONSHIP_PHYSICS.linkDistance)
            * RELATIONSHIP_PHYSICS.springStrength
            * alpha;
          source.vx += (dx / distance) * force;
          source.vy += (dy / distance) * force;
          target.vx -= (dx / distance) * force;
          target.vy -= (dy / distance) * force;
        });
        simulationNodes.forEach((node) => {
          if (node !== draggedNode) {
            node.vx += -node.x * RELATIONSHIP_PHYSICS.centerStrength * alpha;
            node.vy += -node.y * RELATIONSHIP_PHYSICS.centerStrength * alpha;
            node.vx *= RELATIONSHIP_PHYSICS.velocityRetention;
            node.vy *= RELATIONSHIP_PHYSICS.velocityRetention;
            node.x += node.vx;
            node.y += node.vy;
          }
        });
        alpha *= RELATIONSHIP_PHYSICS.alphaDecay;
      }
      draw();
      if ((!reducedMotion && alpha > RELATIONSHIP_PHYSICS.minimumAlpha) || draggedNode) {
        frameId = root.requestAnimationFrame(simulate);
      }
    }

    function requestDraw(reheat = false) {
      if (reheat) alpha = Math.max(alpha, RELATIONSHIP_PHYSICS.dragReheat);
      if (!frameId && !modal.hidden) frameId = root.requestAnimationFrame(simulate);
    }

    function pickNode(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      let nearest = null;
      let nearestDistance = RELATIONSHIP_PHYSICS.pickRadius;
      simulationNodes.forEach((node) => {
        const point = graphToScreen(node);
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance < nearestDistance) {
          nearest = node;
          nearestDistance = distance;
        }
      });
      return nearest;
    }

    function setFocus(characterId) {
      focusedId = nodeById.has(characterId) ? characterId : null;
      elements.select.value = focusedId || '';
      elements.view.disabled = !focusedId;
      if (!focusedId) {
        elements.focusName.textContent = '全部角色';
        elements.focusMeta.textContent = '点击任一节点，仅显示其直接关系';
      } else {
        const node = nodeById.get(focusedId);
        const count = adjacency.get(focusedId).size;
        elements.focusName.textContent = node.name;
        elements.focusMeta.textContent = `${node.categoryName} · ${count} 位直接关系角色`;
      }
      requestDraw();
    }

    function openModal() {
      lastFocusedElement = documentRef.activeElement;
      modal.hidden = false;
      documentRef.body.classList.add('relationship-map-open');
      root.requestAnimationFrame(() => {
        resizeCanvas(true);
        elements.close.focus();
      });
    }

    function closeModal() {
      modal.hidden = true;
      documentRef.body.classList.remove('relationship-map-open');
      if (frameId) root.cancelAnimationFrame(frameId);
      frameId = 0;
      lastFocusedElement?.focus();
    }

    function focusableElements() {
      return [...elements.dialog.querySelectorAll('button:not([disabled]), select, [tabindex]:not([tabindex="-1"])')];
    }

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      pointer = { x: event.clientX, y: event.clientY, offsetX, offsetY };
      draggedNode = pickNode(event.clientX, event.clientY);
      didMove = false;
      if (draggedNode) {
        draggedNode.vx = 0;
        draggedNode.vy = 0;
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!pointer) {
        hoveredId = pickNode(event.clientX, event.clientY)?.id || null;
        canvas.style.cursor = hoveredId ? 'pointer' : 'grab';
        requestDraw();
        return;
      }
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      didMove ||= Math.hypot(dx, dy) > 4;
      if (draggedNode) {
        const rect = canvas.getBoundingClientRect();
        const graphPoint = screenToGraph(event.clientX - rect.left, event.clientY - rect.top);
        draggedNode.x = graphPoint.x;
        draggedNode.y = graphPoint.y;
        requestDraw();
      } else {
        offsetX = pointer.offsetX + dx;
        offsetY = pointer.offsetY + dy;
        requestDraw();
      }
    });
    canvas.addEventListener('pointerup', (event) => {
      if (!didMove && draggedNode) setFocus(draggedNode.id);
      pointer = null;
      draggedNode = null;
      canvas.releasePointerCapture(event.pointerId);
      requestDraw(true);
    });
    canvas.addEventListener('pointercancel', () => {
      pointer = null;
      draggedNode = null;
      requestDraw(true);
    });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const before = screenToGraph(mouseX, mouseY);
      scale = Math.min(2.5, Math.max(0.55, scale * Math.exp(-event.deltaY * 0.001)));
      offsetX = mouseX - width / 2 - before.x * scale;
      offsetY = mouseY - height / 2 - before.y * scale;
      requestDraw();
    }, { passive: false });

    openButton.addEventListener('click', openModal);
    elements.close.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
    elements.select.addEventListener('change', () => setFocus(elements.select.value));
    elements.view.addEventListener('click', () => {
      if (!focusedId) return;
      const targetId = nodeById.get(focusedId)?.profileId || focusedId;
      closeModal();
      if (root.location.hash.slice(1) === targetId) {
        root.dispatchEvent(new Event('hashchange'));
      } else {
        root.location.hash = targetId;
      }
    });
    documentRef.addEventListener('keydown', (event) => {
      if (modal.hidden) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
      if (event.key === 'Tab') {
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
      }
    });
    root.addEventListener('resize', () => {
      if (!modal.hidden) resizeCanvas();
    });
    documentRef.addEventListener('visibilitychange', () => {
      if (!documentRef.hidden) requestDraw();
    });
    new MutationObserver(() => requestDraw()).observe(documentRef.body, { attributes: true, attributeFilter: ['class'] });

    return { graph, openModal, closeModal, setFocus };
  }

  return {
    RELATIONSHIP_PHYSICS,
    buildRelationshipGraph,
    createInitialPosition,
    formatRelationshipLabel,
    getDirectRelationIds,
    initRelationshipMap,
  };
}));
