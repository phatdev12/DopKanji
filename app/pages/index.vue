<script setup lang="ts">
import type { KanjiDetail, KanjiIndexResponse, KanjiSummary, JlptLevel } from '../../shared/types/kanji'
import VueIcon from '@kalimahapps/vue-icons/VueIcon'
import { BsLightningChargeFill, BsXLg } from '@kalimahapps/vue-icons/bs'

const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

const activeLevel = ref<JlptLevel>('N5')
const searchQuery = ref('')
const strokeFilter = ref<number | null>(null)
const sortMode = ref<'relevance' | 'stroke-asc' | 'stroke-desc' | 'literal'>('relevance')
const handwritingCandidates = ref<string[]>([])
const handwritingPending = ref(false)
const handwritingError = ref<string | null>(null)
const selectedDetail = ref<KanjiDetail | null>(null)
const detailPending = ref(false)
const detailError = ref<string | null>(null)
const kanjiGridRef = ref<HTMLElement | null>(null)
const wordGridRef = ref<HTMLElement | null>(null)
const showKanjiTopFade = ref(false)
const showKanjiBottomFade = ref(false)
const showWordTopFade = ref(false)
const showWordBottomFade = ref(false)
const SCROLL_EDGE_THRESHOLD = 2

type FadeUpdater = () => void
type FadeCleanup = () => void

let kanjiFadeCleanup: FadeCleanup | null = null
let wordFadeCleanup: FadeCleanup | null = null
let kanjiFadeUpdate: FadeUpdater = () => {}
let wordFadeUpdate: FadeUpdater = () => {}
let boundKanjiElement: HTMLElement | null = null
let boundWordElement: HTMLElement | null = null

function bindScrollFade(
  element: HTMLElement,
  setTop: (value: boolean) => void,
  setBottom: (value: boolean) => void
): { update: FadeUpdater; cleanup: FadeCleanup } {
  const update = () => {
    const maxScrollTop = element.scrollHeight - element.clientHeight
    if (maxScrollTop <= SCROLL_EDGE_THRESHOLD) {
      setTop(false)
      setBottom(false)
      return
    }

    setTop(element.scrollTop > SCROLL_EDGE_THRESHOLD)
    setBottom(element.scrollTop < maxScrollTop - SCROLL_EDGE_THRESHOLD)
  }

  const handleResize = () => update()
  const resizeObserver = new ResizeObserver(() => {
    update()
  })

  element.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', handleResize, { passive: true })
  resizeObserver.observe(element)
  nextTick(() => update())

  const cleanup = () => {
    element.removeEventListener('scroll', update)
    window.removeEventListener('resize', handleResize)
    resizeObserver.disconnect()
    setTop(false)
    setBottom(false)
  }

  return { update, cleanup }
}

function syncListFadeBindings() {
  if (kanjiGridRef.value !== boundKanjiElement) {
    kanjiFadeCleanup?.()
    kanjiFadeCleanup = null
    kanjiFadeUpdate = () => {}
    boundKanjiElement = kanjiGridRef.value

    if (boundKanjiElement) {
      const binding = bindScrollFade(boundKanjiElement, (value) => {
        showKanjiTopFade.value = value
      }, (value) => {
        showKanjiBottomFade.value = value
      })
      kanjiFadeUpdate = binding.update
      kanjiFadeCleanup = binding.cleanup
    }
  }

  if (wordGridRef.value !== boundWordElement) {
    wordFadeCleanup?.()
    wordFadeCleanup = null
    wordFadeUpdate = () => {}
    boundWordElement = wordGridRef.value

    if (boundWordElement) {
      const binding = bindScrollFade(boundWordElement, (value) => {
        showWordTopFade.value = value
      }, (value) => {
        showWordBottomFade.value = value
      })
      wordFadeUpdate = binding.update
      wordFadeCleanup = binding.cleanup
    }
  }
}

const { data: indexData, pending: indexPending, error: indexError } = await useFetch<KanjiIndexResponse>(
  '/api/kanji'
)

const activeKanji = computed<KanjiSummary[]>(() => indexData.value?.levels[activeLevel.value] ?? [])
const allKanji = computed<KanjiSummary[]>(() => {
  if (!indexData.value) {
    return []
  }

  const seen = new Set<string>()
  return levels.flatMap((level) =>
    indexData.value!.levels[level].filter((item) => {
      if (seen.has(item.literal)) {
        return false
      }

      seen.add(item.literal)
      return true
    })
  )
})

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

const isGlobalSearch = computed(
  () => normalizeQuery(searchQuery.value).length > 0 || strokeFilter.value !== null || handwritingCandidates.value.length > 0
)
const searchBaseKanji = computed(() => (isGlobalSearch.value ? allKanji.value : activeKanji.value))

const filteredKanji = computed(() => {
  const query = normalizeQuery(searchQuery.value)
  const candidateOrder = new Map(handwritingCandidates.value.map((literal, index) => [literal, index]))

  const filtered = searchBaseKanji.value.filter((item) => {
    const matchedStroke = strokeFilter.value === null || (item.strokeCount !== null && Math.abs(item.strokeCount - strokeFilter.value) <= 1)
    const matchedHandwriting = candidateOrder.size === 0 || candidateOrder.has(item.literal)

    if (!matchedStroke || !matchedHandwriting) {
      return false
    }

    if (!query) {
      return true
    }

    return (
      item.literal.includes(searchQuery.value.trim()) ||
      item.meanings.join(' ').toLowerCase().includes(query) ||
      item.onyomi.join(' ').toLowerCase().includes(query) ||
      item.kunyomi.join(' ').toLowerCase().includes(query)
    )
  })

  const sorted = [...filtered]
  if (sortMode.value === 'stroke-asc') {
    return sorted.sort((left, right) => {
      const leftStroke = left.strokeCount ?? Number.MAX_SAFE_INTEGER
      const rightStroke = right.strokeCount ?? Number.MAX_SAFE_INTEGER
      if (leftStroke !== rightStroke) {
        return leftStroke - rightStroke
      }

      return left.literal.localeCompare(right.literal, 'ja')
    })
  }

  if (sortMode.value === 'stroke-desc') {
    return sorted.sort((left, right) => {
      const leftStroke = left.strokeCount ?? Number.MIN_SAFE_INTEGER
      const rightStroke = right.strokeCount ?? Number.MIN_SAFE_INTEGER
      if (leftStroke !== rightStroke) {
        return rightStroke - leftStroke
      }

      return left.literal.localeCompare(right.literal, 'ja')
    })
  }

  if (sortMode.value === 'literal') {
    return sorted.sort((left, right) => left.literal.localeCompare(right.literal, 'ja'))
  }

  if (candidateOrder.size === 0) {
    return sorted
  }

  return sorted.sort((left, right) => {
    const leftOrder = candidateOrder.get(left.literal) ?? Number.MAX_SAFE_INTEGER
    const rightOrder = candidateOrder.get(right.literal) ?? Number.MAX_SAFE_INTEGER
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder
    }

    return left.literal.localeCompare(right.literal, 'ja')
  })
})

const selectedTree = computed(() => selectedDetail.value?.tree ?? null)
const selectedLiteral = computed(() => selectedDetail.value?.literal ?? null)

const resultMeta = computed(() => {
  const scope = isGlobalSearch.value ? ' (toàn bộ kanji chung)' : ''
  const suffix = strokeFilter.value !== null ? ` • lọc khoảng ${strokeFilter.value} nét` : ''
  return `${filteredKanji.value.length} / ${searchBaseKanji.value.length} kanji${scope}${suffix}`
})

function clearSearch() {
  searchQuery.value = ''
  handwritingCandidates.value = []
  handwritingError.value = null
}

async function applyStrokeFilter(payload: {
  strokeCount: number
  strokes: Array<Array<{ x: number; y: number }>>
  canvasWidth: number
  canvasHeight: number
}) {
  handwritingPending.value = true
  handwritingError.value = null
  handwritingCandidates.value = []

  try {
    const result = await $fetch<{ candidates: string[]; fallbackStrokeFilter: number | null }>('/api/handwriting', {
      method: 'POST',
      body: payload
    })

    handwritingCandidates.value = result.candidates
    strokeFilter.value = result.candidates.length === 0 ? result.fallbackStrokeFilter : null

    if (result.candidates.length > 0) {
      searchQuery.value = ''
    }
  } catch (error) {
    strokeFilter.value = payload.strokeCount
    handwritingCandidates.value = []
    handwritingError.value = error instanceof Error ? error.message : 'Không nhận diện được chữ vẽ tay.'
  } finally {
    handwritingPending.value = false
  }
}

function clearStrokeFilter() {
  strokeFilter.value = null
  handwritingCandidates.value = []
  handwritingError.value = null
  handwritingPending.value = false
}

async function openKanjiDetail(literal: string) {
  detailPending.value = true
  detailError.value = null

  try {
    selectedDetail.value = await $fetch<KanjiDetail>(`/api/kanji/${encodeURIComponent(literal)}`)
  } catch (error) {
    selectedDetail.value = null
    detailError.value = error instanceof Error ? error.message : 'Không tải được dữ liệu chữ kanji.'
  } finally {
    detailPending.value = false
  }
}

function openTopResult() {
  const top = filteredKanji.value[0]
  if (top) {
    openKanjiDetail(top.literal)
  }
}

function backToGrid() {
  selectedDetail.value = null
  detailError.value = null
}

watch(activeLevel, () => {
  backToGrid()
})

watch([kanjiGridRef, wordGridRef], () => {
  nextTick(() => syncListFadeBindings())
}, { flush: 'post' })

watch(() => filteredKanji.value.length, () => {
  nextTick(() => kanjiFadeUpdate())
})

watch(() => selectedDetail.value?.relatedWords.length ?? 0, () => {
  nextTick(() => wordFadeUpdate())
})

onMounted(() => {
  nextTick(() => syncListFadeBindings())
})

onBeforeUnmount(() => {
  kanjiFadeCleanup?.()
  wordFadeCleanup?.()
  kanjiFadeCleanup = null
  wordFadeCleanup = null
  kanjiFadeUpdate = () => {}
  wordFadeUpdate = () => {}
  boundKanjiElement = null
  boundWordElement = null
})
</script>

<template>
  <div class="workspace">
    <div class="left-column">
      <div class="lookup-row" style="gap: 0; align-items: center;">
        <section class="panel-card" style="height: max-content; padding-bottom: 25px !important; padding-top: 25px !important; border-top-right-radius: 0; border-bottom-right-radius: 0;">
          <div class="panel-header">
            <div>
              <h2>Tra cứu Kanji</h2>
            </div>
          </div>

          <div class="search-row">
            <input
              v-model="searchQuery"
              class="input"
              placeholder="Ví dụ: 水, mizu, water..."
              type="text"
            >
            <button
              class="btn btn-secondary btn-icon"
              type="button"
              title="Xóa tìm kiếm"
              aria-label="Xóa tìm kiếm"
              @click="clearSearch"
            >
              <VueIcon :name="BsXLg" />
            </button>
            <button
              class="btn btn-icon"
              type="button"
              title="Mở nhanh kết quả đầu"
              aria-label="Mở nhanh kết quả đầu"
              @click="openTopResult"
            >
              <VueIcon :name="BsLightningChargeFill" />
            </button>
          </div>

          <div class="result-tools">
            <label class="sort-label" for="sort-mode">Sắp xếp</label>
            <select id="sort-mode" v-model="sortMode" class="sort-select">
              <option value="relevance">Theo liên quan</option>
              <option value="stroke-asc">Số nét tăng dần</option>
              <option value="stroke-desc">Số nét giảm dần</option>
              <option value="literal">Theo ký tự</option>
            </select>
          </div>
          <p v-if="handwritingPending" class="muted">Đang nhận diện chữ vẽ tay...</p>
          <p v-else-if="handwritingError" class="error-text">{{ handwritingError }}</p>
          <p v-else-if="handwritingCandidates.length" class="muted">
            Gợi ý vẽ tay: {{ handwritingCandidates.slice(0, 8).join(' ・ ') }}
          </p>
        </section>

        <HandwritingPad compact @detect="applyStrokeFilter" @clear="clearStrokeFilter" />
      </div>

      <KanjiGraph :literal="selectedLiteral" :tree="selectedTree" />
    </div>

    <div class="right-column">
      <section v-if="selectedDetail || detailPending || detailError" class="panel-card detail-card" style="max-height: 100vh; overflow-y: auto;">
        <div class="detail-topbar">
          <button class="btn btn-secondary" type="button" @click="backToGrid">← Back</button>
          <div class="kanji-meta" v-if="selectedDetail">
            <span class="badge">JLPT {{ selectedDetail.level }}</span>
            <span class="badge">Nét: {{ selectedDetail.strokeCount ?? 'N/A' }}</span>
            <span class="badge">Tần suất: {{ selectedDetail.frequency ?? 'N/A' }}</span>
          </div>
        </div>

        <div v-if="detailPending" class="empty-text">Đang tải thông tin kanji...</div>
        <div v-else-if="detailError" class="error-text">{{ detailError }}</div>

        <template v-else-if="selectedDetail">
          <div class="detail-layout">
            <div class="detail-summary">
              <div class="kanji-head">
                <div class="kanji-display">{{ selectedDetail.literal }}</div>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div class="kanji-meta">
                    <article class="sub-card">
                      <h3>Onyomi</h3>
                      <p>{{ selectedDetail.onyomi.join(' ・ ') || 'Không có' }}</p>
                    </article>
                    <article class="sub-card">
                      <h3>Kunyomi</h3>
                      <p>{{ selectedDetail.kunyomi.join(' ・ ') || 'Không có' }}</p>
                    </article>
                  </div>
                </div>
              </div>

              <div>
                <article class="sub-card">
                  <h3>Nghĩa</h3>
                  <p>{{ selectedDetail.meanings.join(', ') || 'Chưa có dữ liệu nghĩa.' }}</p>
                </article>
              </div>

              <section class="word-section">
                <div class="section-title" style="padding: 0px !important;">
                  <h3>Từ liên quan</h3>
                </div>

                <p v-if="selectedDetail.relatedWordsError" class="error-text">
                  {{ selectedDetail.relatedWordsError }}
                </p>

                <div
                  v-else-if="selectedDetail.relatedWords.length"
                  class="scroll-fade-wrap"
                >
                  <div class="scroll-fade scroll-fade-top" :class="{ visible: showWordTopFade }" aria-hidden="true" />
                  <div class="scroll-fade scroll-fade-bottom" :class="{ visible: showWordBottomFade }" aria-hidden="true" />
                  <div ref="wordGridRef" class="word-grid">
                    <article
                      v-for="word in selectedDetail.relatedWords"
                      :key="`${word.written}-${word.reading}`"
                      class="word-card"
                    >
                      <p class="word-main">{{ word.written }}</p>
                      <p class="word-reading">{{ word.reading }}</p>
                      <p class="word-meaning">{{ word.meanings.join('; ') }}</p>
                    </article>
                  </div>
                </div>

                <p v-else class="empty-text">Chưa có dữ liệu từ liên quan.</p>
              </section>
            </div>

            <section class="stroke-section detail-stroke-column">
              <div class="section-title">
                <h3>Cách viết</h3>
              </div>

              <p v-if="selectedDetail.strokeError" class="error-text">{{ selectedDetail.strokeError }}</p>

              <KanjiStrokeAnimator
                v-else-if="selectedDetail.strokeViewBox && selectedDetail.strokeSvg && selectedDetail.strokePaths.length"
                :literal="selectedDetail.literal"
                :view-box="selectedDetail.strokeViewBox"
                :svg-markup="selectedDetail.strokeSvg"
                :paths="selectedDetail.strokePaths"
                :stroke-path-ids="selectedDetail.strokePathIds"
              />

              <p v-else class="empty-text">Chưa có dữ liệu animation nét viết cho chữ này.</p>
            </section>
          </div>
        </template>
      </section>

      <section v-else class="panel-card">
        <div class="tabs">
          <button
            v-for="level in levels"
            :key="level"
            :class="['tab-btn', { active: level === activeLevel }]"
            type="button"
            @click="activeLevel = level"
          >
            Kanji {{ level }}
          </button>
        </div>

        <p v-if="indexPending" class="empty-text">Đang tải dữ liệu JLPT...</p>
        <p v-else-if="indexError" class="error-text">Không tải được dữ liệu JLPT.</p>

        <div v-else class="scroll-fade-wrap">
          <div class="scroll-fade scroll-fade-top" :class="{ visible: showKanjiTopFade }" aria-hidden="true" />
          <div class="scroll-fade scroll-fade-bottom" :class="{ visible: showKanjiBottomFade }" aria-hidden="true" />
          <div ref="kanjiGridRef" class="kanji-grid">
            <button
              v-for="item in filteredKanji"
              :key="item.literal"
              class="kanji-cell"
              type="button"
              @click="openKanjiDetail(item.literal)"
            >
              <span class="kanji-char">{{ item.literal }}</span>
              <span class="kanji-cell-meta">{{ item.strokeCount ?? '?' }} nét</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
