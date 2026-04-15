<script setup lang="ts">
import type { KanjiTreeNode } from '../../shared/types/kanji'

const props = defineProps<{
  literal: string | null
  tree: KanjiTreeNode | null
}>()

type GraphNode = {
  id: string
  label: string
  depth: number
  x: number
  y: number
}

type GraphEdge = {
  id: string
  source: string
  target: string
}

const viewportWidth = 560
const viewportHeight = 340
const nodeRingRadius = 28
const nodeCoreRadius = 22
const nodePadding = nodeRingRadius + 14

const minNodeX = nodePadding
const maxNodeX = viewportWidth - minNodeX
const minNodeY = nodePadding
const maxNodeY = viewportHeight - minNodeY

const svgRef = ref<SVGSVGElement | null>(null)
const nodes = ref<GraphNode[]>([])
const edges = ref<GraphEdge[]>([])
const dragState = ref<{ nodeId: string; pointerId: number } | null>(null)
const hoveredNodeId = ref<string | null>(null)

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getSvgPoint(event: PointerEvent): { x: number; y: number } | null {
  const svg = svgRef.value
  if (!svg) {
    return null
  }

  const rect = svg.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) {
    return null
  }

  const x = ((event.clientX - rect.left) / rect.width) * viewportWidth
  const y = ((event.clientY - rect.top) / rect.height) * viewportHeight
  return {
    x: clamp(x, minNodeX, maxNodeX),
    y: clamp(y, minNodeY, maxNodeY)
  }
}

function buildGraph(tree: KanjiTreeNode): { nextNodes: GraphNode[]; nextEdges: GraphEdge[] } {
  const levelBuckets = new Map<number, GraphNode[]>()
  const nextNodes: GraphNode[] = []
  const nextEdges: GraphEdge[] = []
  let nodeCounter = 0

  const walk = (node: KanjiTreeNode, depth: number, parentId: string | null) => {
    const id = `node-${nodeCounter}`
    nodeCounter += 1

    const graphNode: GraphNode = {
      id,
      label: node.element,
      depth,
      x: viewportWidth / 2,
      y: viewportHeight / 2
    }

    nextNodes.push(graphNode)
    const bucket = levelBuckets.get(depth) ?? []
    bucket.push(graphNode)
    levelBuckets.set(depth, bucket)

    if (parentId) {
      nextEdges.push({
        id: `edge-${parentId}-${id}`,
        source: parentId,
        target: id
      })
    }

    for (const child of node.g ?? []) {
      walk(child, depth + 1, id)
    }
  }

  walk(tree, 0, null)

  const maxDepth = Math.max(...levelBuckets.keys())
  for (const [depth, levelNodes] of levelBuckets.entries()) {
    const y =
      maxDepth <= 0
        ? viewportHeight / 2
        : minNodeY + ((maxNodeY - minNodeY) * depth) / maxDepth

    for (let index = 0; index < levelNodes.length; index += 1) {
      const node = levelNodes[index]
      const x =
        levelNodes.length === 1
          ? viewportWidth / 2
          : minNodeX + ((maxNodeX - minNodeX) * index) / (levelNodes.length - 1)

      node.x = x
      node.y = y
    }
  }

  return { nextNodes, nextEdges }
}

function resetGraph() {
  if (!props.tree) {
    nodes.value = []
    edges.value = []
    return
  }

  const { nextNodes, nextEdges } = buildGraph(props.tree)
  nodes.value = nextNodes
  edges.value = nextEdges
}

function onNodePointerDown(nodeId: string, event: PointerEvent) {
  event.preventDefault()
  const svg = svgRef.value
  if (!svg) {
    return
  }

  svg.setPointerCapture(event.pointerId)
  dragState.value = { nodeId, pointerId: event.pointerId }
}

function onSvgPointerMove(event: PointerEvent) {
  const state = dragState.value
  if (!state || state.pointerId !== event.pointerId) {
    return
  }

  const point = getSvgPoint(event)
  if (!point) {
    return
  }

  const node = nodes.value.find((item) => item.id === state.nodeId)
  if (!node) {
    return
  }

  node.x = point.x
  node.y = point.y
}

function releaseDrag(event: PointerEvent) {
  const state = dragState.value
  if (!state || state.pointerId !== event.pointerId) {
    return
  }

  const svg = svgRef.value
  if (svg?.hasPointerCapture(event.pointerId)) {
    svg.releasePointerCapture(event.pointerId)
  }

  dragState.value = null
}

const nodeMap = computed(() => {
  return new Map(nodes.value.map((node) => [node.id, node]))
})

const drawableEdges = computed(() => {
  return edges.value
    .map((edge) => {
      const source = nodeMap.value.get(edge.source)
      const target = nodeMap.value.get(edge.target)
      if (!source || !target) {
        return null
      }

      const direction = target.y >= source.y ? 1 : -1
      const curveAmount = Math.max(18, Math.abs(target.y - source.y) * 0.24) * direction
      const c1x = source.x
      const c1y = source.y + curveAmount
      const c2x = target.x
      const c2y = target.y - curveAmount

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        depth: target.depth,
        d: `M ${source.x} ${source.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${target.x} ${target.y}`
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)
})

const nodeNeighbors = computed(() => {
  const map = new Map<string, Set<string>>()
  for (const node of nodes.value) {
    map.set(node.id, new Set<string>())
  }

  for (const edge of edges.value) {
    map.get(edge.source)?.add(edge.target)
    map.get(edge.target)?.add(edge.source)
  }

  return map
})

function isNodeHighlighted(nodeId: string): boolean {
  const hovered = hoveredNodeId.value
  if (!hovered) {
    return true
  }

  if (hovered === nodeId) {
    return true
  }

  return nodeNeighbors.value.get(hovered)?.has(nodeId) ?? false
}

function isEdgeHighlighted(edge: { source: string; target: string }): boolean {
  const hovered = hoveredNodeId.value
  if (!hovered) {
    return true
  }

  return edge.source === hovered || edge.target === hovered
}

const radicals = computed(() => {
  if (!props.tree) {
    return []
  }

  const bag = new Set<string>()
  const visit = (node: KanjiTreeNode, isRoot: boolean) => {
    if (!isRoot) {
      bag.add(node.element)
    }

    for (const child of node.g ?? []) {
      visit(child, false)
    }
  }

  visit(props.tree, true)
  return [...bag]
})

watch(() => props.tree, resetGraph, { immediate: true })
</script>

<template>
  <section class="panel-card graph-card">
    <div class="panel-header">
      <div>
        <h3>Kanji Graph</h3>
        <p class="muted">Cấu trúc bộ thủ và thành phần tạo chữ.</p>
      </div>
    </div>

    <div v-if="tree && literal" class="graph-wrapper">
      <p class="graph-title">Cây thành phần của <strong>{{ literal }}</strong></p>

      <div class="graph-canvas">
        <svg
          ref="svgRef"
          class="graph-svg"
          :viewBox="`0 0 ${viewportWidth} ${viewportHeight}`"
          @pointermove="onSvgPointerMove"
          @pointerup="releaseDrag"
          @pointercancel="releaseDrag"
          @pointerleave="releaseDrag"
        >
          <defs>
            <linearGradient id="graphEdgeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stop-color="#93c5fd" />
              <stop offset="100%" stop-color="#6366f1" />
            </linearGradient>
            <linearGradient id="graphNodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#f8fbff" />
              <stop offset="100%" stop-color="#dbeafe" />
            </linearGradient>
            <linearGradient id="graphRootGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#2563eb" />
              <stop offset="100%" stop-color="#4f46e5" />
            </linearGradient>
            <marker
              id="graphArrowHead"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#6366f1" />
            </marker>
          </defs>

          <g class="graph-links">
            <path
              v-for="edge in drawableEdges"
              :key="edge.id"
              :class="['graph-link', `depth-${edge.depth}`, { dimmed: !isEdgeHighlighted(edge) }]"
              :d="edge.d"
              marker-end="url(#graphArrowHead)"
            />
            <path
              v-for="edge in drawableEdges"
              :key="`${edge.id}-flow`"
              :class="['graph-link-flow', { dimmed: !isEdgeHighlighted(edge) }]"
              :d="edge.d"
            />
          </g>

            <g
              v-for="node in nodes"
              :key="node.id"
              class="graph-node-item"
            :class="{
              root: node.depth === 0,
              dimmed: !isNodeHighlighted(node.id),
              dragging: dragState?.nodeId === node.id
            }"
            :transform="`translate(${node.x}, ${node.y})`"
              @pointerdown="onNodePointerDown(node.id, $event)"
              @pointerenter="hoveredNodeId = node.id"
              @pointerleave="hoveredNodeId = null"
            >
              <circle class="graph-node-ring" :r="nodeRingRadius" />
              <circle class="graph-node-core" :r="nodeCoreRadius" />
              <text class="graph-node-label" text-anchor="middle" dominant-baseline="central">
                {{ node.label }}
              </text>
            </g>
        </svg>
      </div>

      <p class="muted graph-hint">Kéo node để sắp xếp. Hover vào node để làm nổi bật nhánh liên quan.</p>

      <div class="radical-list">
        <span v-for="part in radicals" :key="part" class="radical-chip">{{ part }}</span>
      </div>
    </div>

    <p v-else class="empty-text">Chọn một chữ kanji để xem graph thành phần.</p>
  </section>
</template>
