<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import LatexInline from "@/components/common/LatexInline.vue";
import { toPointGroupLatex } from "@/utils/pointGroupDetails";

const props = defineProps({
  nodes: {
    type: Array,
    required: true
  },
  edges: {
    type: Array,
    required: true
  },
  specialFamilies: {
    type: Array,
    default: () => []
  },
  selectedFamily: {
    type: String,
    default: ""
  },
  availableFamilies: {
    type: Object,
    default: () => new Set()
  },
  interactive: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(["select-family"]);

const HORIZONTAL_PADDING = 8;
const VERTICAL_PADDING = 80;
const DECISION_SIDE = 60;
const TERMINAL_WIDTH = 50;
const TERMINAL_HEIGHT = 40;
const START_WIDTH = 118;
const START_HEIGHT = 42;
const SPECIAL_WIDTH = 268;
const SPECIAL_HEIGHT = 150;
const wrapRef = ref(null);
const availableWidth = ref(0);
let resizeObserver = null;

const SPECIAL_GEOMETRY_ROWS = [
  { id: "linear", label: "Linear", families: ["C\u221ev", "D\u221eh"] },
  { id: "tetra", label: "Tetrahedral", families: ["Td"] },
  { id: "octa-cube", label: "Octahedral/Cubic", families: ["Oh"] },
  { id: "icosa-dodeca", label: "Icosahedral/Dodecahedral", families: ["Ih"] }
];

const layoutMetrics = computed(() => {
  if (!props.nodes.length) {
    return {
      width: 820,
      height: 660,
      minX: 0,
      minY: 0,
      offsetX: 0,
      offsetY: 0
    };
  }

  const xs = props.nodes.map((node) => node.x);
  const ys = props.nodes.map((node) => node.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const contentWidth = maxX - minX + HORIZONTAL_PADDING * 2;
  const contentHeight = maxY - minY + VERTICAL_PADDING * 2;
  const width = Math.max(620, contentWidth);
  const height = Math.max(620, contentHeight);

  return {
    width,
    height,
    minX,
    minY,
    offsetX: (width - contentWidth) / 2,
    offsetY: (height - contentHeight) / 2
  };
});

const layoutNodes = computed(() =>
  props.nodes.map((node) => ({
    ...node,
    renderX: node.x - layoutMetrics.value.minX + HORIZONTAL_PADDING + layoutMetrics.value.offsetX,
    renderY: node.y - layoutMetrics.value.minY + VERTICAL_PADDING + layoutMetrics.value.offsetY
  }))
);

const nodeMetaById = computed(() => new Map(props.nodes.map((node) => [node.id, node])));
const nodeById = computed(() => new Map(layoutNodes.value.map((node) => [node.id, node])));

const startNodeId = computed(() => props.nodes.find((node) => node.kind === "start")?.id ?? props.nodes[0]?.id ?? "");
const specialNodeId = computed(() => props.nodes.find((node) => node.kind === "special")?.id ?? "");

const selectedTargetNodeId = computed(() => {
  const family = String(props.selectedFamily ?? "");
  if (!family) {
    return "";
  }

  const terminal = props.nodes.find((node) => node.kind === "terminal" && node.family === family);
  if (terminal?.id) {
    return terminal.id;
  }

  if (props.specialFamilies.includes(family)) {
    return specialNodeId.value;
  }

  return "";
});

function toEdgeKey(from, to) {
  return `${String(from)}->${String(to)}`;
}

const routeHighlight = computed(() => {
  const start = startNodeId.value;
  const target = selectedTargetNodeId.value;
  if (!start || !target) {
    return {
      hasRoute: false,
      edgeKeys: new Set(),
      decisionStateByNodeId: new Map()
    };
  }

  const adjacency = new Map();
  props.edges.forEach((edge) => {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge);
    adjacency.set(edge.from, list);
  });

  const queue = [start];
  const visited = new Set([start]);
  const previousNode = new Map();
  const previousEdge = new Map();

  while (queue.length) {
    const current = queue.shift();
    if (current === target) {
      break;
    }

    const outgoing = adjacency.get(current) ?? [];
    outgoing.forEach((edge) => {
      if (visited.has(edge.to)) {
        return;
      }
      visited.add(edge.to);
      previousNode.set(edge.to, current);
      previousEdge.set(edge.to, edge);
      queue.push(edge.to);
    });
  }

  if (!visited.has(target)) {
    return {
      hasRoute: false,
      edgeKeys: new Set(),
      decisionStateByNodeId: new Map()
    };
  }

  const pathNodeIds = [];
  let cursor = target;
  while (cursor) {
    pathNodeIds.push(cursor);
    if (cursor === start) {
      break;
    }
    cursor = previousNode.get(cursor) ?? "";
  }
  pathNodeIds.reverse();

  const edgeKeys = new Set();
  const decisionStateByNodeId = new Map();

  for (let index = 0; index < pathNodeIds.length - 1; index += 1) {
    const fromId = pathNodeIds[index];
    const toId = pathNodeIds[index + 1];
    edgeKeys.add(toEdgeKey(fromId, toId));

    const edge = previousEdge.get(toId);
    const fromNode = nodeMetaById.value.get(fromId);
    if (fromNode?.kind !== "decision" || !edge?.label) {
      continue;
    }

    const label = String(edge.label).trim().toLowerCase();
    if (label === "yes" || label === "no") {
      decisionStateByNodeId.set(fromId, label);
    }
  }

  return {
    hasRoute: edgeKeys.size > 0,
    edgeKeys,
    decisionStateByNodeId
  };
});

const edgeGeometries = computed(() =>
  props.edges
    .map((edge) => {
      const from = nodeById.value.get(edge.from);
      const to = nodeById.value.get(edge.to);
      if (!from || !to) {
        return null;
      }

      const dx = to.renderX - from.renderX;
      const dy = to.renderY - from.renderY;
      const length = Math.hypot(dx, dy) || 1;
      const ux = dx / length;
      const uy = dy / length;

      const start = getNodeAnchor(from, ux, uy);
      const end = getNodeAnchor(to, -ux, -uy, { toNode: true });
      const mx = (start.x + end.x) / 2;
      const my = (start.y + end.y) / 2;
      const nx = -uy;
      const ny = ux;
      const routeKey = toEdgeKey(edge.from, edge.to);
      const isRouteActive = routeHighlight.value.edgeKeys.has(routeKey);
      const edgeLabel = String(edge.label ?? "").trim().toLowerCase();
      const routeType = isRouteActive
        ? edgeLabel === "yes"
          ? "yes"
          : edgeLabel === "no"
            ? "no"
            : "neutral"
        : "";

      const markerId = routeType === "yes"
        ? "arrow-end-yes"
        : routeType === "no"
          ? "arrow-end-no"
          : routeType === "neutral"
            ? "arrow-end-active"
            : "arrow-end";

      return {
        ...edge,
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y,
        lx: mx + nx * 12,
        ly: my + ny * 12,
        routeType,
        markerId,
        dimmed: routeHighlight.value.hasRoute && !isRouteActive
      };
    })
    .filter(Boolean)
);

const fitScale = computed(() => {
  if (!availableWidth.value || !layoutMetrics.value.width) {
    return 1;
  }
  return Math.min(1, availableWidth.value / layoutMetrics.value.width);
});

const wrapHeight = computed(() =>
  Math.max(420, Math.ceil(layoutMetrics.value.height * fitScale.value))
);

function getNodeAnchor(node, ux, uy, options = {}) {
  if (node.kind === "decision") {
    return getDecisionVertex(node, ux, uy);
  }

  if (options.toNode) {
    return getRectSideMidpoint(node, ux, uy);
  }

  const { width, height } = getNodeSize(node);
  const halfW = width / 2;
  const halfH = height / 2;
  const scale = 1 / Math.max(Math.abs(ux) / halfW, Math.abs(uy) / halfH, 1e-6);

  return {
    x: node.renderX + ux * scale,
    y: node.renderY + uy * scale
  };
}

function updateAvailableWidth() {
  if (!wrapRef.value) {
    return;
  }
  availableWidth.value = wrapRef.value.clientWidth;
}

onMounted(() => {
  updateAvailableWidth();
  if (typeof ResizeObserver === "function") {
    resizeObserver = new ResizeObserver(() => updateAvailableWidth());
    if (wrapRef.value) {
      resizeObserver.observe(wrapRef.value);
    }
  } else {
    window.addEventListener("resize", updateAvailableWidth);
  }
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
    return;
  }
  window.removeEventListener("resize", updateAvailableWidth);
});

function getDecisionVertex(node, ux, uy) {
  const offset = DECISION_SIDE / Math.sqrt(2);
  if (Math.abs(ux) >= Math.abs(uy)) {
    return {
      x: node.renderX + (ux >= 0 ? offset : -offset),
      y: node.renderY
    };
  }

  return {
    x: node.renderX,
    y: node.renderY + (uy >= 0 ? offset : -offset)
  };
}

function getRectSideMidpoint(node, ux, uy) {
  const { width, height } = getNodeSize(node);
  const halfW = width / 2;
  const halfH = height / 2;

  if (Math.abs(ux) >= Math.abs(uy)) {
    return {
      x: node.renderX + (ux >= 0 ? halfW : -halfW),
      y: node.renderY
    };
  }

  return {
    x: node.renderX,
    y: node.renderY + (uy >= 0 ? halfH : -halfH)
  };
}

function getNodeSize(node) {
  if (node.kind === "start") {
    return { width: START_WIDTH, height: START_HEIGHT };
  }
  if (node.kind === "special") {
    return { width: SPECIAL_WIDTH, height: SPECIAL_HEIGHT };
  }
  if (node.kind === "terminal") {
    return { width: TERMINAL_WIDTH, height: TERMINAL_HEIGHT };
  }
  return { width: DECISION_SIDE, height: DECISION_SIDE };
}

function isFamilyAvailable(family) {
  return props.availableFamilies instanceof Set
    ? props.availableFamilies.has(family)
    : Array.isArray(props.availableFamilies)
      ? props.availableFamilies.includes(family)
      : Boolean(props.availableFamilies?.[family]);
}

function handleSelectFamily(family) {
  if (!props.interactive) {
    return;
  }
  emit("select-family", family);
}

function getFamilyTex(family) {
  const normalized = String(family ?? "");
  const latex = toPointGroupLatex(normalized);
  return latex || normalized;
}
</script>

<template>
  <div
    ref="wrapRef"
    class="flowchart-wrap panel"
    :class="{ 'is-readonly': !props.interactive }"
    :style="{ height: `${wrapHeight}px` }"
  >
    <div
      class="flowchart-canvas"
      :style="{
        width: `${layoutMetrics.width}px`,
        minHeight: `${layoutMetrics.height}px`,
        transform: `scale(${fitScale})`
      }"
    >
      <svg
        class="flowchart-lines"
        :viewBox="`0 0 ${layoutMetrics.width} ${layoutMetrics.height}`"
        :style="{ width: `${layoutMetrics.width}px`, height: `${layoutMetrics.height}px` }"
        role="presentation"
      >
        <defs>
          <marker
            id="arrow-end"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"></path>
          </marker>
          <marker
            id="arrow-end-active"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb"></path>
          </marker>
          <marker
            id="arrow-end-yes"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#16a34a"></path>
          </marker>
          <marker
            id="arrow-end-no"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626"></path>
          </marker>
        </defs>

        <template v-for="edge in edgeGeometries" :key="`${edge.from}-${edge.to}`">
          <line
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            class="flowchart-line"
            :class="{
              'flowchart-line--active-neutral': edge.routeType === 'neutral',
              'flowchart-line--active-yes': edge.routeType === 'yes',
              'flowchart-line--active-no': edge.routeType === 'no',
              'flowchart-line--dimmed': edge.dimmed
            }"
            :marker-end="`url(#${edge.markerId})`"
          />
          <text
            v-if="edge.label"
            :x="edge.lx"
            :y="edge.ly"
            class="flowchart-edge-label"
            :class="{
              'flowchart-edge-label--yes': edge.label === 'Yes',
              'flowchart-edge-label--no': edge.label === 'No',
              'flowchart-edge-label--active-yes': edge.routeType === 'yes',
              'flowchart-edge-label--active-no': edge.routeType === 'no',
              'flowchart-edge-label--dimmed': edge.dimmed
            }"
          >
            {{ edge.label }}
          </text>
        </template>
      </svg>

      <div
        v-for="node in layoutNodes"
        :key="node.id"
        class="flow-node"
        :class="[
          `flow-node--${node.kind}`,
          {
            'is-terminal-selected': node.family && selectedFamily === node.family,
            'is-disabled': node.family && !isFamilyAvailable(node.family),
            'is-decision-yes': node.kind === 'decision' && routeHighlight.decisionStateByNodeId.get(node.id) === 'yes',
            'is-decision-no': node.kind === 'decision' && routeHighlight.decisionStateByNodeId.get(node.id) === 'no'
          }
        ]"
        :style="{ left: `${node.renderX}px`, top: `${node.renderY}px` }"
      >
        <button
          v-if="node.kind === 'terminal'"
          type="button"
          class="flow-node-button flow-node-button--terminal"
          :class="{
            'is-active': node.family && selectedFamily === node.family,
            'is-readonly': !props.interactive
          }"
          :disabled="!isFamilyAvailable(node.family)"
          @click="node.family && handleSelectFamily(node.family)"
        >
          <LatexInline :expr="node.tex || getFamilyTex(node.family || node.label)" />
        </button>

        <div v-else-if="node.kind === 'start'" class="flow-node-button flow-node-button--start">
          <LatexInline :expr="node.tex || node.label" />
        </div>

        <div v-else-if="node.kind === 'special'" class="flow-special">
          <div class="flow-special-list">
            <div
              v-for="row in SPECIAL_GEOMETRY_ROWS"
              :key="row.id"
              class="flow-special-row"
            >
              <span class="flow-special-label">{{ row.label }}</span>
              <div class="flow-special-groups">
                <button
                  v-for="family in row.families"
                  :key="`${row.id}-${family}`"
                  type="button"
                  class="flow-node-button flow-node-button--special"
                  :class="{
                    'is-active': selectedFamily === family,
                    'is-readonly': !props.interactive
                  }"
                  :disabled="!isFamilyAvailable(family)"
                  @click="handleSelectFamily(family)"
                >
                  <LatexInline :expr="getFamilyTex(family)" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="flow-node-button flow-node-button--decision">
          <span class="decision-content">
            <LatexInline :expr="node.tex || node.label" />
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flowchart-wrap {
  width: 100%;
  min-height: 420px;
  overflow-x: hidden;
  overflow-y: hidden;
  border-radius: 1.2rem;
}

.flowchart-canvas {
  position: relative;
  transform-origin: left top;
}

.flowchart-lines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.flowchart-line {
  stroke: #64748b;
  stroke-width: 1.5;
  stroke-linecap: round;
}

.flowchart-line--active-neutral {
  stroke: #2563eb;
  stroke-width: 2.2;
}

.flowchart-line--active-yes {
  stroke: #16a34a;
  stroke-width: 2.3;
}

.flowchart-line--active-no {
  stroke: #dc2626;
  stroke-width: 2.3;
}

.flowchart-line--dimmed {
  opacity: 0.24;
}

.flowchart-edge-label {
  font-size: 12px;
  font-weight: 700;
  fill: #0f172a;
  text-anchor: middle;
  dominant-baseline: middle;
  paint-order: stroke;
  stroke: rgba(255, 255, 255, 0.95);
  stroke-width: 4px;
  stroke-linejoin: round;
}

.flowchart-edge-label--yes {
  fill: #15803d;
}

.flowchart-edge-label--no {
  fill: #dc2626;
}

.flowchart-edge-label--active-yes {
  fill: #15803d;
}

.flowchart-edge-label--active-no {
  fill: #dc2626;
}

.flowchart-edge-label--dimmed {
  opacity: 0.3;
}

.flow-node {
  position: absolute;
  transform: translate(-50%, -50%);
}

.flow-node-button {
  border: 1px solid rgba(59, 130, 246, 0.45);
  background: rgba(255, 255, 255, 0.98);
  color: #2563eb;
  border-radius: 0.42rem;
  padding: 0.5rem 0.82rem;
  min-width: 4.1rem;
  min-height: 2.36rem;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

button.flow-node-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(37, 99, 235, 0.12);
}

.flow-node-button:disabled {
  cursor: not-allowed;
  opacity: 0.46;
}

.flow-node-button.is-readonly {
  pointer-events: none;
  cursor: default;
}

.flow-node-button.is-active {
  border-color: rgba(37, 99, 235, 0.85);
  background: linear-gradient(180deg, rgba(239, 246, 255, 0.96), rgba(219, 234, 254, 0.94));
  box-shadow: 0 10px 20px rgba(37, 99, 235, 0.16);
}

.flowchart-wrap.is-readonly .flow-node-button.is-readonly:not(:disabled) {
  opacity: 1;
}

.flow-node--decision .flow-node-button--decision {
  width: 60px;
  min-width: 60px;
  min-height: 60px;
  border-radius: 0;
  transform: rotate(45deg);
  color: #1f2937;
  border-color: rgba(100, 116, 139, 0.62);
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  cursor: default;
  pointer-events: none;
  display: grid;
  place-items: center;
  padding: 0;
}

.flow-node--decision.is-decision-yes .flow-node-button--decision {
  border-color: rgba(22, 163, 74, 0.82);
  background: rgba(240, 253, 244, 0.98);
  box-shadow: 0 8px 16px rgba(22, 163, 74, 0.16);
}

.flow-node--decision.is-decision-no .flow-node-button--decision {
  border-color: rgba(220, 38, 38, 0.82);
  background: rgba(254, 242, 242, 0.98);
  box-shadow: 0 8px 16px rgba(220, 38, 38, 0.16);
}

.decision-content {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  transform: rotate(-45deg);
}

.flow-node--decision .flow-node-button--decision :deep(.latex-inline) {
  font-size: 1.1rem;
  line-height: 1.14;
  color: #1f2937;
  text-align: center;
  max-width: 52px;
}

.flow-node--decision.is-decision-yes .flow-node-button--decision :deep(.latex-inline) {
  color: #166534;
}

.flow-node--decision.is-decision-no .flow-node-button--decision :deep(.latex-inline) {
  color: #b91c1c;
}

.flow-node--decision .flow-node-button--decision :deep(.katex) {
  font-size: 1em;
}

.flow-node--terminal .flow-node-button--terminal {
  width: 50px;
  min-width: 50px;
  max-width: 50px;
  min-height: 40px;
  border-radius: 0.72rem;
  padding: 0;
  display: grid;
  place-items: center;
}

.flow-node--terminal .flow-node-button--terminal :deep(.katex) {
  font-size: 1.06em;
}

.flow-node--start .flow-node-button--start {
  width: 118px;
  min-width: 118px;
  min-height: 42px;
  border-radius: 0.78rem;
  border-color: rgba(100, 116, 139, 0.62);
  color: #0f172a;
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 6px 14px rgba(15, 23, 42, 0.08);
  padding: 0;
  cursor: default;
  pointer-events: none;
  display: grid;
  place-items: center;
}

.flow-node--start .flow-node-button--start :deep(.katex) {
  font-size: 1.02em;
}

.flow-special {
  border-radius: 0.7rem;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: rgba(255, 255, 255, 0.97);
  padding: 0.58rem 0.64rem;
  width: 268px;
  height: 150px;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08);
  display: grid;
  align-content: start;
}

.flow-special-list {
  display: grid;
  gap: 0.28rem;
}

.flow-special-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.42rem;
}

.flow-special-label {
  font-size: 0.72rem;
  font-weight: 700;
  color: #334155;
  white-space: nowrap;
}

.flow-special-groups {
  display: inline-flex;
  align-items: center;
  gap: 0.26rem;
}

.flow-node-button--special {
  width: 56px;
  min-width: 56px;
  max-width: 56px;
  height: 28px;
  min-height: 28px;
  max-height: 28px;
  padding: 0;
  border-radius: 0.4rem;
  display: grid;
  place-items: center;
}

.flow-node-button--special :deep(.katex) {
  font-size: 0.92em;
}

.flow-node.is-disabled .flow-node-button--terminal {
  border-style: dashed;
}
</style>
