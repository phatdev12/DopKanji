<script setup lang="ts">
import type { KanjiDetail, KanjiIndexResponse, KanjiSummary, JlptLevel } from '../../shared/types/kanji'

const levels: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

const activeLevel = ref<JlptLevel>('N5')
const searchQuery = ref('')
const strokeFilter = ref<number | null>(null)
const selectedDetail = ref<KanjiDetail | null>(null)
const detailPending = ref(false)
const detailError = ref<string | null>(null)

const { data: indexData, pending: indexPending, error: indexError } = await useFetch<KanjiIndexResponse>(
  '/api/kanji'
)

const activeKanji = computed<KanjiSummary[]>(() => indexData.value?.levels[activeLevel.value] ?? [])

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase()
}

const filteredKanji = computed(() => {
  const query = normalizeQuery(searchQuery.value)

  return activeKanji.value.filter((item) => {
    const matchedStroke =
      strokeFilter.value === null ||
      (item.strokeCount !== null && Math.abs(item.strokeCount - strokeFilter.value) <= 1)

    if (!matchedStroke) {
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
})

const selectedTree = computed(() => selectedDetail.value?.tree ?? null)
const selectedLiteral = computed(() => selectedDetail.value?.literal ?? null)

const resultMeta = computed(() => {
  const suffix = strokeFilter.value !== null ? ` • lọc khoảng ${strokeFilter.value} nét` : ''
  return `${filteredKanji.value.length} / ${activeKanji.value.length} kanji${suffix}`
})

function clearSearch() {
  searchQuery.value = ''
}

function applyStrokeFilter(strokes: number) {
  strokeFilter.value = strokes
}

function clearStrokeFilter() {
  strokeFilter.value = null
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
</script>

<template>
  <div class="workspace">
    <div class="left-column">
      <div class="lookup-row">
        <section class="panel-card">
          <div class="panel-header">
            <div>
              <h2>Tra cứu Kanji</h2>
              <p class="muted">Nhập chữ, âm đọc hoặc nghĩa tiếng Anh để lọc nhanh.</p>
            </div>
          </div>

          <div class="search-row">
            <input
              v-model="searchQuery"
              class="input"
              placeholder="Ví dụ: 水, mizu, water..."
              type="text"
            >
            <button class="btn btn-secondary" type="button" @click="clearSearch">Xóa</button>
            <button class="btn" type="button" @click="openTopResult">Mở nhanh</button>
          </div>

          <p class="muted">{{ resultMeta }}</p>
        </section>

        <HandwritingPad compact @detect="applyStrokeFilter" @clear="clearStrokeFilter" />
      </div>

      <KanjiGraph :literal="selectedLiteral" :tree="selectedTree" />
    </div>

    <div class="right-column">
      <section v-if="selectedDetail || detailPending || detailError" class="panel-card detail-card">
        <div class="detail-topbar">
          <button class="btn btn-secondary" type="button" @click="backToGrid">← Back</button>
          <p class="muted">Chi tiết kanji</p>
        </div>

        <div v-if="detailPending" class="empty-text">Đang tải thông tin kanji...</div>
        <div v-else-if="detailError" class="error-text">{{ detailError }}</div>

        <template v-else-if="selectedDetail">
          <div class="kanji-head">
            <div class="kanji-display">{{ selectedDetail.literal }}</div>
            <div class="kanji-meta">
              <span class="badge">JLPT {{ selectedDetail.level }}</span>
              <span class="badge">Nét: {{ selectedDetail.strokeCount ?? 'N/A' }}</span>
              <span class="badge">Tần suất: {{ selectedDetail.frequency ?? 'N/A' }}</span>
            </div>
          </div>

          <section class="stroke-section">
            <div class="section-title">
              <h3>Animation cách viết</h3>
              <p class="muted">Nguồn: {{ selectedDetail.strokeSource }}</p>
            </div>

            <p v-if="selectedDetail.strokeError" class="error-text">{{ selectedDetail.strokeError }}</p>

            <KanjiStrokeAnimator
              v-else-if="selectedDetail.strokeViewBox && selectedDetail.strokePaths.length"
              :literal="selectedDetail.literal"
              :view-box="selectedDetail.strokeViewBox"
              :paths="selectedDetail.strokePaths"
            />

            <p v-else class="empty-text">Chưa có dữ liệu animation nét viết cho chữ này.</p>
          </section>

          <div class="detail-grid">
            <article class="sub-card">
              <h3>Nghĩa</h3>
              <p>{{ selectedDetail.meanings.join(', ') || 'Chưa có dữ liệu nghĩa.' }}</p>
            </article>
            <article class="sub-card">
              <h3>Onyomi</h3>
              <p>{{ selectedDetail.onyomi.join(' ・ ') || 'Không có' }}</p>
            </article>
            <article class="sub-card">
              <h3>Kunyomi</h3>
              <p>{{ selectedDetail.kunyomi.join(' ・ ') || 'Không có' }}</p>
            </article>
          </div>

          <section class="word-section">
            <div class="section-title">
              <h3>Từ liên quan (nghĩa tiếng Việt)</h3>
              <p class="muted">Nguồn: {{ selectedDetail.relatedWordsSource }}</p>
            </div>

            <p v-if="selectedDetail.relatedWordsError" class="error-text">
              {{ selectedDetail.relatedWordsError }}
            </p>

            <div v-else-if="selectedDetail.relatedWords.length" class="word-grid">
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

            <p v-else class="empty-text">Chưa có dữ liệu từ liên quan.</p>
          </section>
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

        <div v-else class="kanji-grid">
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
      </section>
    </div>
  </div>
</template>
