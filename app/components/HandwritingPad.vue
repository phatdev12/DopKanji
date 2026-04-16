<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    compact?: boolean
  }>(),
  {
    compact: false
  }
)

const emit = defineEmits<{
  detect: [
    payload: {
      strokeCount: number
      strokes: Array<Array<{ x: number; y: number }>>
      canvasWidth: number
      canvasHeight: number
    }
  ]
  clear: []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const strokeCount = ref(0)
const hasInk = ref(false)
const isDrawing = ref(false)
const strokes = ref<Array<Array<{ x: number; y: number }>>>([])
let activeStroke: Array<{ x: number; y: number }> = []
let resizeObserver: ResizeObserver | null = null

function getPointerPosition(event: PointerEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) {
    return null
  }

  const rect = canvas.getBoundingClientRect()
  const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
  const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)

  return {
    x,
    y
  }
}

function prepareCanvas() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#0f172a'
  ctx.clearRect(0, 0, rect.width, rect.height)
}

function startDrawing(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const ctx = canvas.getContext('2d')
  const point = getPointerPosition(event)
  if (!ctx || !point) {
    return
  }

  isDrawing.value = true
  hasInk.value = true
  canvas.setPointerCapture(event.pointerId)
  activeStroke = [point]

  ctx.beginPath()
  ctx.moveTo(point.x, point.y)
}

function continueDrawing(event: PointerEvent) {
  if (!isDrawing.value) {
    return
  }

  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const ctx = canvas.getContext('2d')
  const point = getPointerPosition(event)
  if (!ctx || !point) {
    return
  }

  const lastPoint = activeStroke[activeStroke.length - 1]
  const deltaX = point.x - lastPoint.x
  const deltaY = point.y - lastPoint.y
  if (Math.hypot(deltaX, deltaY) >= 2) {
    activeStroke.push(point)
  }

  ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

function stopDrawing(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId)
  }

  isDrawing.value = false
  if (activeStroke.length >= 2) {
    strokes.value.push([...activeStroke])
    strokeCount.value = strokes.value.length
  }
  activeStroke = []
}

function clearCanvas() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const rect = canvas.getBoundingClientRect()
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }

  ctx.clearRect(0, 0, rect.width, rect.height)
  strokeCount.value = 0
  hasInk.value = false
  strokes.value = []
  activeStroke = []
  emit('clear')
}

function detectKanjiByStroke() {
  const canvas = canvasRef.value
  if (!canvas || !hasInk.value || strokes.value.length <= 0) {
    return
  }

  const rect = canvas.getBoundingClientRect()
  emit('detect', {
    strokeCount: strokes.value.length,
    strokes: strokes.value.map((stroke) => stroke.map((point) => ({ x: point.x, y: point.y }))),
    canvasWidth: rect.width,
    canvasHeight: rect.height
  })
}

onMounted(() => {
  nextTick(() => {
    prepareCanvas()
  })
  window.addEventListener('resize', prepareCanvas)

  if (typeof window !== 'undefined' && window.ResizeObserver && canvasRef.value) {
    resizeObserver = new window.ResizeObserver(() => {
      prepareCanvas()
    })
    resizeObserver.observe(canvasRef.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', prepareCanvas)
  resizeObserver?.disconnect()
  resizeObserver = null
})

watch(
  () => props.compact,
  () => {
    nextTick(() => {
      prepareCanvas()
    })
  }
)
</script>

<template>
  <section :class="['panel-card', 'handwriting-panel', { compact: props.compact }]">
    <div class="panel-header">
      <div>
        <h3>Viết tay để tìm kiếm</h3>
        <p class="muted">Vẽ chữ vào ô bên dưới, hệ thống sẽ lọc theo số nét.</p>
      </div>
      <span class="stroke-pill">{{ strokeCount }} nét</span>
    </div>

    <canvas
      ref="canvasRef"
      class="handwriting-canvas"
      @pointerdown="startDrawing"
      @pointermove="continueDrawing"
      @pointerup="stopDrawing"
      @pointerleave="stopDrawing"
      @pointercancel="stopDrawing"
    />

    <div class="toolbar">
      <button class="btn btn-secondary" type="button" @click="clearCanvas">Xóa nét</button>
      <button class="btn" type="button" @click="detectKanjiByStroke">Tìm theo nét</button>
    </div>
  </section>
</template>
