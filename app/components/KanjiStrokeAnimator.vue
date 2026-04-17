<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps<{
  literal: string
  viewBox: string
  svgMarkup: string
  paths: string[]
  strokePathIds: string[]
}>()

const animationKey = ref(0)
const isPlaying = ref(true)
const speed = ref<'slow' | 'normal' | 'fast'>('normal')
const svgHostRef = ref<HTMLDivElement | null>(null)
const pathRefs = ref<SVGPathElement[]>([])
const numberRefs = ref<SVGTextElement[]>([])
const currentIndex = ref(0)
const timeoutRef = ref<number | null>(null)

function readCssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback
  }

  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function strokeDurationMs(value: 'slow' | 'normal' | 'fast'): number {
  if (value === 'slow') return 800
  if (value === 'fast') return 300
  return 500
}

const normalizedSvgMarkup = computed(() => {
  const raw = props.svgMarkup?.trim() ?? ''
  if (!raw) return ''
  const svgStartIndex = raw.indexOf('<svg')
  return svgStartIndex >= 0 ? raw.slice(svgStartIndex) : raw
})

function attachAndCollectPaths() {
  const host = svgHostRef.value
  if (!host) return
  const svg = host.querySelector('svg')
  if (!(svg instanceof SVGSVGElement)) return

  svg.setAttribute('viewBox', props.viewBox)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
  svg.setAttribute('aria-label', 'Kanji stroke order animation')
  
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.display = 'block'

  pathRefs.value = Array.from(svg.querySelectorAll<SVGPathElement>('g[id*="StrokePaths"] path'))
  numberRefs.value = Array.from(svg.querySelectorAll<SVGTextElement>('g[id*="StrokeNumbers"] text'))
}

function hideAll() {
  pathRefs.value.forEach((path) => {
    path.style.display = 'none'
    path.style.transition = 'none'
    path.style.strokeDasharray = 'none'
    path.style.strokeDashoffset = '0'
  })
  numberRefs.value.forEach((num) => (num.style.display = 'none'))
}

function stopAnimation() {
  if (timeoutRef.value) {
    clearTimeout(timeoutRef.value)
    timeoutRef.value = null
  }
}

function animateCurrentPath() {
  if (!isPlaying.value || currentIndex.value >= pathRefs.value.length) {
    if (currentIndex.value >= pathRefs.value.length) isPlaying.value = false
    return
  }

  const path = pathRefs.value[currentIndex.value]
  const number = numberRefs.value[currentIndex.value]
  if (!path) return

  const length = path.getTotalLength()
  const duration = strokeDurationMs(speed.value)
  const strokeColor = readCssVar('--primary', '#de8751')
  const numberColor = readCssVar('--muted', '#6f6a85')

  path.style.display = 'block'
  path.style.stroke = strokeColor
  path.style.strokeWidth = '4.5'
  path.style.strokeLinecap = 'round'
  path.style.strokeLinejoin = 'round'
  path.style.fill = 'none'
  path.style.transition = 'none'
  path.style.strokeDasharray = `${length} ${length}`
  path.style.strokeDashoffset = `${length}`

  path.getBoundingClientRect()

  path.style.transition = `stroke-dashoffset ${duration}ms linear`
  path.style.strokeDashoffset = '0'

  if (number) {
    number.style.display = 'block'
    number.style.fill = numberColor
    number.style.fontSize = '9px'
    number.style.opacity = '0.8'
  }

  timeoutRef.value = window.setTimeout(() => {
    currentIndex.value++
    animateCurrentPath()
  }, duration + 50)
}

function togglePlay() {
  if (isPlaying.value) {
    isPlaying.value = false
    stopAnimation()
  } else {
    isPlaying.value = true
    animateCurrentPath()
  }
}

function restartAnimation() {
  stopAnimation()
  currentIndex.value = 0
  animationKey.value += 1
  isPlaying.value = true
}

watch(
  () => [normalizedSvgMarkup.value, props.viewBox, animationKey.value, speed.value],
  () => {
    nextTick(() => {
      stopAnimation()
      attachAndCollectPaths()
      hideAll()
      if (isPlaying.value) animateCurrentPath()
    })
  },
  { immediate: true, flush: 'post' }
)

onBeforeUnmount(() => stopAnimation())
</script>

<template>
  <div class="stroke-animator">
    <div class="stroke-toolbar">
      <p class="stroke-meta">
        {{ literal }} • {{ paths.length }} nét
      </p>
      <div class="stroke-actions">
        <button class="btn-action" type="button" @click="togglePlay">
          {{ isPlaying ? 'Tạm dừng' : 'Tiếp tục' }}
        </button>
        <button class="btn-action" type="button" @click="restartAnimation">Vẽ lại</button>
      </div>
    </div>

    <div class="speed-tabs">
      <button
        v-for="s in (['slow', 'normal', 'fast'] as const)"
        :key="s"
        :class="['speed-btn', { active: speed === s }]"
        @click="speed = s; restartAnimation()"
      >
        {{ s === 'slow' ? 'Chậm' : s === 'normal' ? 'Vừa' : 'Nhanh' }}
      </button>
    </div>

    <div class="stroke-stage">
      <div
        ref="svgHostRef"
        class="stroke-svg-host"
        v-html="normalizedSvgMarkup"
      />
    </div>
  </div>
</template>

<style scoped>
.stroke-animator {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  border-radius: 12px;
  width: 100%;
  box-sizing: border-box;
}

.stroke-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stroke-meta {
  font-weight: 600;
  color: var(--foreground);
  margin: 0;
}

.stroke-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-action {
  padding: 6px 12px;
  font-size: 0.75rem;
  background: var(--surface-violet);
  color: #6a638c;
  border: 1px solid #c9bee6;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.btn-action:hover {
  border-color: #d79463;
  color: #8c5d3d;
}

.speed-tabs {
  display: flex;
  gap: 0.5rem;
}

.speed-btn {
  flex: 1;
  padding: 8px;
  font-size: 0.875rem;
  border: 1px solid #c9bee6;
  border-radius: 6px;
  cursor: pointer;
  background: var(--surface);
  color: #605981;
  transition: all 0.2s;
}

.speed-btn.active {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: #d79463;
}

.stroke-stage {
  aspect-ratio: 1 / 1;
  width: 100%;
  background: var(--surface-soft);
  background-image:
    linear-gradient(var(--line-warm) 1px, transparent 1px),
    linear-gradient(90deg, var(--line-warm) 1px, transparent 1px);
  background-size: 25% 25%;
  border: 2px solid #c9bee6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.stroke-svg-host {
  width: 95%;
  height: 95%;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(svg) {
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
