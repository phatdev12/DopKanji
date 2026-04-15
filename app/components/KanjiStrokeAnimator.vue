<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'

const props = defineProps<{
  literal: string
  viewBox: string
  paths: string[]
}>()

const animationKey = ref(0)
const isPlaying = ref(true)
const speed = ref<'slow' | 'normal' | 'fast'>('normal')
const pathRefs = ref<SVGPathElement[]>([])
const strokeMetas = ref<Array<{ length: number; duration: number; delay: number }>>([])

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function speedMultiplier(value: 'slow' | 'normal' | 'fast'): number {
  if (value === 'slow') {
    return 1.35
  }

  if (value === 'fast') {
    return 0.75
  }

  return 1
}

function setPathRef(el: Element | ComponentPublicInstance | null, index: number) {
  if (el instanceof SVGPathElement) {
    pathRefs.value[index] = el
  }
}

function recalculateStrokeMeta() {
  const multiplier = speedMultiplier(speed.value)
  const nextMeta: Array<{ length: number; duration: number; delay: number }> = []
  let delay = 0

  for (const pathRef of pathRefs.value.filter((item): item is SVGPathElement => item instanceof SVGPathElement)) {
    const rawLength = pathRef.getTotalLength()
    const length = Number.isFinite(rawLength) ? clamp(rawLength, 1, 4000) : 1
    const duration = clamp(length / 105, 0.26, 1.25) * multiplier
    nextMeta.push({ length, duration, delay })
    delay += duration
  }

  strokeMetas.value = nextMeta
}

function restartAnimation() {
  animationKey.value += 1
  isPlaying.value = true
}

function togglePlay() {
  isPlaying.value = !isPlaying.value
}

function pathStyle(index: number) {
  const meta = strokeMetas.value[index]
  if (!meta) {
    return {
      opacity: 0
    }
  }

  const length = `${meta.length}`
  return {
    '--stroke-delay': `${meta.delay}s`,
    '--stroke-duration': `${meta.duration}s`,
    strokeDasharray: length,
    strokeDashoffset: length,
    opacity: 1
  }
}

const totalDuration = computed(() => {
  const last = strokeMetas.value[strokeMetas.value.length - 1]
  if (!last) {
    return 0
  }

  return Math.round((last.delay + last.duration) * 10) / 10
})

watch(
  () => [props.paths, animationKey.value, speed.value],
  () => {
    nextTick(() => {
      recalculateStrokeMeta()
    })
  },
  { immediate: true, flush: 'post' }
)

onBeforeUpdate(() => {
  pathRefs.value = []
})
</script>

<template>
  <div class="stroke-animator">
    <div class="stroke-toolbar">
      <p class="stroke-meta">
        {{ literal }} • {{ paths.length }} nét • ~{{ totalDuration }}s
      </p>
      <div class="stroke-actions">
        <button class="btn btn-secondary btn-xs" type="button" @click="togglePlay">
          {{ isPlaying ? 'Pause' : 'Play' }}
        </button>
        <button class="btn btn-secondary btn-xs" type="button" @click="restartAnimation">Replay</button>
      </div>
    </div>

    <div class="speed-tabs">
      <button
        :class="['speed-btn', { active: speed === 'slow' }]"
        type="button"
        @click="speed = 'slow'; restartAnimation()"
      >
        Chậm
      </button>
      <button
        :class="['speed-btn', { active: speed === 'normal' }]"
        type="button"
        @click="speed = 'normal'; restartAnimation()"
      >
        Vừa
      </button>
      <button
        :class="['speed-btn', { active: speed === 'fast' }]"
        type="button"
        @click="speed = 'fast'; restartAnimation()"
      >
        Nhanh
      </button>
    </div>

    <div class="stroke-stage">
      <svg
        :key="animationKey"
        :class="['stroke-svg', { 'is-paused': !isPlaying }]"
        :viewBox="viewBox"
        aria-label="Kanji stroke order animation"
      >
        <path
          v-for="(path, index) in paths"
          :key="`${animationKey}-${index}`"
          :ref="(el) => setPathRef(el, index)"
          class="stroke-path"
          :d="path"
          :style="pathStyle(index)"
        />
      </svg>
    </div>
  </div>
</template>
