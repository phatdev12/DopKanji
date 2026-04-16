import { createRequire } from 'node:module'
import type { KanjiDetail, KanjiIndexResponse, KanjiSummary, KanjiTreeNode, JlptLevel, RelatedWord } from '../../shared/types/kanji'

const require = createRequire(import.meta.url)
const kanjiToolkit = require('kanji') as {
  jlpt: Record<string, () => string[]>
  kanjiTree: (literal: string) => KanjiTreeNode
}
const kanjiLookup = require('kanji.js') as {
  getDetails: (literal: string) => {
    literal?: string
    meanings?: string[]
    onyomi?: string[]
    kunyomi?: string[]
    stroke_count?: number
    freq?: number
  } | null
}

const levelOrder: JlptLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const levelLoaders: Record<JlptLevel, () => string[]> = {
  N5: () => kanjiToolkit.jlpt.n5(),
  N4: () => kanjiToolkit.jlpt.n4(),
  N3: () => kanjiToolkit.jlpt.n3(),
  N2: () => kanjiToolkit.jlpt.n2(),
  N1: () => kanjiToolkit.jlpt.n1()
}

type KanjiApiWordEntry = {
  meanings?: Array<{
    glosses?: string[]
  }>
  variants?: Array<{
    written?: string
    pronounced?: string
    priorities?: string[]
  }>
}

let cachedIndex: KanjiIndexResponse | null = null
const detailCache = new Map<string, KanjiDetail>()
const detailCacheVersion = 'v3-stroke-svg'
const vietnameseMeaningCache = new Map<string, string>()
const translationSeparator = '\n[[DK_SEP]]\n'
const strokeDataCache = new Map<
  string,
  { viewBox: string | null; svg: string | null; paths: string[]; pathIds: string[]; source: string; error: string | null }
>()

function normalizeKanjiLiteral(raw: string): string {
  return Array.from(raw.trim())[0] ?? ''
}

function getDetailCacheKey(literal: string): string {
  return `${detailCacheVersion}:${literal}`
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getRawDetail(literal: string) {
  const detail = kanjiLookup.getDetails(literal)
  if (!detail || detail.literal !== literal) {
    return null
  }

  return detail
}

function buildSummary(literal: string, level: JlptLevel): KanjiSummary {
  const detail = getRawDetail(literal)

  return {
    literal,
    level,
    meanings: normalizeStringArray(detail?.meanings),
    onyomi: normalizeStringArray(detail?.onyomi),
    kunyomi: normalizeStringArray(detail?.kunyomi),
    strokeCount: normalizeOptionalNumber(detail?.stroke_count),
    frequency: normalizeOptionalNumber(detail?.freq)
  }
}

function sortByUsefulness(list: KanjiSummary[]): KanjiSummary[] {
  return [...list].sort((a, b) => {
    const freqA = a.frequency ?? Number.MAX_SAFE_INTEGER
    const freqB = b.frequency ?? Number.MAX_SAFE_INTEGER
    if (freqA !== freqB) {
      return freqA - freqB
    }

    const strokeA = a.strokeCount ?? Number.MAX_SAFE_INTEGER
    const strokeB = b.strokeCount ?? Number.MAX_SAFE_INTEGER
    if (strokeA !== strokeB) {
      return strokeA - strokeB
    }

    return a.literal.localeCompare(b.literal, 'ja')
  })
}

function findSummaryByLiteral(literal: string): KanjiSummary | null {
  const index = getKanjiIndex()
  for (const level of levelOrder) {
    const match = index.levels[level].find((item) => item.literal === literal)
    if (match) {
      return match
    }
  }

  return null
}

function getKanjiTree(literal: string): KanjiTreeNode | null {
  try {
    return kanjiToolkit.kanjiTree(literal)
  } catch {
    return null
  }
}

function getCodePointHex(literal: string): string | null {
  const codePoint = literal.codePointAt(0)
  if (typeof codePoint !== 'number') {
    return null
  }

  return codePoint.toString(16).padStart(5, '0')
}

function extractSvgViewBox(svgText: string): string | null {
  const match = svgText.match(/viewBox="([^"]+)"/i)
  return match?.[1] ?? null
}

function extractSvgAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}=(["'])(.*?)\\1`, 'i'))
  return match?.[2]?.trim() || null
}

function extractStrokePathsFromSvg(svgText: string): Array<{ id: string; order: number; d: string }> {
  const strokes: Array<{ id: string; order: number; d: string }> = []
  const pathTagRegex = /<path\b[^>]*>/gi
  let match: RegExpExecArray | null = pathTagRegex.exec(svgText)

  while (match) {
    const pathTag = match[0]
    const id = extractSvgAttribute(pathTag, 'id')
    const d = extractSvgAttribute(pathTag, 'd')

    if (!id || !d) {
      match = pathTagRegex.exec(svgText)
      continue
    }

    const orderMatch = id.match(/-s(\d+)\b/i)
    if (!orderMatch) {
      match = pathTagRegex.exec(svgText)
      continue
    }

    strokes.push({
      id,
      order: Number.parseInt(orderMatch[1], 10),
      d
    })

    match = pathTagRegex.exec(svgText)
  }

  return strokes
    .sort((left, right) => left.order - right.order)
    .map((stroke) => stroke)
}

async function fetchKanjiStrokeData(literal: string): Promise<{
  viewBox: string | null
  svg: string | null
  paths: string[]
  pathIds: string[]
  source: string
  error: string | null
}> {
  if (strokeDataCache.has(literal)) {
    return strokeDataCache.get(literal)!
  }

  const codePointHex = getCodePointHex(literal)
  if (!codePointHex) {
    const result = {
      viewBox: null,
      svg: null,
      paths: [],
      pathIds: [],
      source: 'KanjiVG (GitHub)',
      error: 'Không xác định được mã Unicode của chữ kanji.'
    }
    strokeDataCache.set(literal, result)
    return result
  }

  const source = `KanjiVG (GitHub raw): ${codePointHex}.svg`
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${codePointHex}.svg`

  try {
    const svgText = await $fetch<string>(url, {
      responseType: 'text',
      timeout: 8_000
    })
    const viewBox = extractSvgViewBox(svgText)
    const strokes = extractStrokePathsFromSvg(svgText)
    const paths = strokes.map((stroke) => stroke.d)
    const pathIds = strokes.map((stroke) => stroke.id)

    if (!viewBox || paths.length === 0) {
      const result = {
        viewBox: null,
        svg: null,
        paths: [],
        pathIds: [],
        source,
        error: 'Không đọc được dữ liệu nét viết từ KanjiVG.'
      }
      strokeDataCache.set(literal, result)
      return result
    }

    const result = {
      viewBox,
      svg: svgText,
      paths,
      pathIds,
      source,
      error: null
    }
    strokeDataCache.set(literal, result)
    return result
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error'
    const result = {
      viewBox: null,
      svg: null,
      paths: [],
      pathIds: [],
      source,
      error: `Không tải được animation nét viết: ${reason}`
    }
    strokeDataCache.set(literal, result)
    return result
  }
}

export async function getKanjiStrokeData(rawLiteral: string): Promise<{
  viewBox: string | null
  paths: string[]
} | null> {
  const literal = normalizeKanjiLiteral(rawLiteral)
  if (!literal) {
    return null
  }

  const strokeResult = await fetchKanjiStrokeData(literal)
  if (!strokeResult.viewBox || strokeResult.paths.length === 0) {
    return null
  }

  return {
    viewBox: strokeResult.viewBox,
    paths: strokeResult.paths
  }
}

function extractEnglishGlosses(entry: KanjiApiWordEntry): string[] {
  return (entry.meanings ?? [])
    .flatMap((meaning) => meaning.glosses ?? [])
    .filter((gloss): gloss is string => typeof gloss === 'string' && gloss.trim().length > 0)
    .slice(0, 3)
}

function parseGoogleTranslateResponse(payload: unknown): string | null {
  if (!Array.isArray(payload) || !Array.isArray(payload[0])) {
    return null
  }

  const translated = payload[0]
    .map((chunk) => (Array.isArray(chunk) && typeof chunk[0] === 'string' ? chunk[0] : ''))
    .join('')
    .trim()

  return translated.length > 0 ? translated : null
}

async function translateText(
  text: string,
  sourceLang: 'en' | 'ja',
  targetLang: 'vi'
): Promise<string | null> {
  const response = await $fetch<unknown>('https://translate.googleapis.com/translate_a/single', {
    query: {
      client: 'gtx',
      sl: sourceLang,
      tl: targetLang,
      dt: 't',
      q: text
    },
    timeout: 6_000
  })

  return parseGoogleTranslateResponse(response)
}

async function translateEnglishGlossesToVietnamese(glosses: string[]): Promise<{
  translations: Map<string, string>
  source: string
  error: string | null
}> {
  const source = 'translate.googleapis.com (en→vi)'
  const uniqueGlosses = Array.from(new Set(glosses.map((item) => item.trim()).filter(Boolean)))
  const translations = new Map<string, string>()
  const pendingGlosses: string[] = []

  for (const gloss of uniqueGlosses) {
    const cached = vietnameseMeaningCache.get(gloss)
    if (cached) {
      translations.set(gloss, cached)
      continue
    }

    pendingGlosses.push(gloss)
  }

  let failures: string[] = []

  if (pendingGlosses.length > 0) {
    try {
      const joined = pendingGlosses.join(translationSeparator)
      const batchTranslated = await translateText(joined, 'en', 'vi')
      const chunks = batchTranslated?.split(translationSeparator).map((chunk) => chunk.trim()) ?? []

      if (chunks.length === pendingGlosses.length) {
        for (let index = 0; index < pendingGlosses.length; index += 1) {
          const gloss = pendingGlosses[index]
          const translated = chunks[index] || gloss
          vietnameseMeaningCache.set(gloss, translated)
          translations.set(gloss, translated)
        }
      } else {
        throw new Error('Batch translate result size mismatch')
      }
    } catch {
      for (const gloss of pendingGlosses) {
        try {
          const translated = await translateText(gloss, 'en', 'vi')
          if (!translated) {
            failures.push(gloss)
            translations.set(gloss, gloss)
            continue
          }

          vietnameseMeaningCache.set(gloss, translated)
          translations.set(gloss, translated)
        } catch {
          failures.push(gloss)
          translations.set(gloss, gloss)
        }
      }
    }
  }

  if (failures.length === 0) {
    return { translations, source, error: null }
  }

  const sample = failures.slice(0, 4).join(', ')
  return {
    translations,
    source,
    error: `Không dịch được một số nghĩa sang tiếng Việt (${failures.length} mục): ${sample}`
  }
}

async function translateKanjiMeanings(meanings: string[]): Promise<string[]> {
  if (meanings.length === 0) {
    return []
  }

  const { translations } = await translateEnglishGlossesToVietnamese(meanings)
  const translated = meanings
    .map((meaning) => (translations.get(meaning) ?? meaning).trim())
    .filter((meaning) => meaning.length > 0)

  return Array.from(new Set(translated))
}

async function fetchRelatedWords(literal: string): Promise<{
  words: RelatedWord[]
  source: string
  error: string | null
}> {
  const source = 'kanjiapi.dev'

  try {
    const response = await $fetch<KanjiApiWordEntry[]>(
      `https://kanjiapi.dev/v1/words/${encodeURIComponent(literal)}`,
      { timeout: 8_000 }
    )

    const rankedEntries = response.filter((entry) =>
      (entry.variants ?? []).some((variant) => (variant.priorities?.length ?? 0) > 0)
    )
    const preferredEntries = rankedEntries.length > 0 ? rankedEntries : response
    const preparedEntries = preferredEntries
      .map((entry) => {
        const variants = entry.variants ?? []
        const preferredVariant =
          variants.find((variant) => (variant.written ?? '').includes(literal)) ?? variants[0]

        if (!preferredVariant) {
          return null
        }

        const written = preferredVariant.written ?? ''
        const reading = preferredVariant.pronounced ?? ''
        const priorities = preferredVariant.priorities ?? []
        const englishMeanings = extractEnglishGlosses(entry)
        const displayText = written || reading

        if (!displayText) {
          return null
        }

        return {
          entry,
          preferredVariant,
          englishMeanings,
          displayText,
          lengthScore: displayText.length || Number.MAX_SAFE_INTEGER,
          priorityScore: priorities.length
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .filter((item) => item.lengthScore <= 8)
      .sort((a, b) => {
        if (a.priorityScore !== b.priorityScore) {
          return b.priorityScore - a.priorityScore
        }

        if (a.lengthScore !== b.lengthScore) {
          return a.lengthScore - b.lengthScore
        }

        return a.displayText.localeCompare(b.displayText, 'ja')
      })
      .slice(0, 12)

    const glossesToTranslate = preparedEntries.flatMap((prepared) => prepared.englishMeanings)

    const { translations, source: translationSource, error: translationError } =
      await translateEnglishGlossesToVietnamese(glossesToTranslate)

    const words = preparedEntries.map((prepared) => {
      const preferredVariant = prepared.preferredVariant
      const englishMeanings = prepared.englishMeanings
      const meanings = Array.from(
        new Set(
          englishMeanings
            .slice(0, 2)
            .map((meaning) => (translations.get(meaning) ?? meaning).trim())
            .filter((meaning) => meaning.length > 0)
        )
      )

      if (meanings.length === 0) {
        meanings.push('Chưa có nghĩa')
      }

      return {
        written: preferredVariant?.written ?? literal,
        reading: preferredVariant?.pronounced ?? '',
        meanings,
        priorities: preferredVariant?.priorities ?? []
      }
    })

    return {
      words,
      source: `${source} + ${translationSource}`,
      error: translationError
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error'
    return {
      words: [],
      source,
      error: `Không tải được từ liên quan từ ${source}: ${reason}`
    }
  }
}

export function getKanjiIndex(): KanjiIndexResponse {
  if (cachedIndex) {
    return cachedIndex
  }

  const levels = levelOrder.reduce((acc, level) => {
    const kanjiChars = Array.from(new Set(levelLoaders[level]()))
    acc[level] = sortByUsefulness(kanjiChars.map((literal) => buildSummary(literal, level)))
    return acc
  }, {} as Record<JlptLevel, KanjiSummary[]>)

  const total = levelOrder.reduce((sum, level) => sum + levels[level].length, 0)

  cachedIndex = {
    appName: 'Đớp Kanji',
    levels,
    total,
    updatedAt: new Date().toISOString(),
    sources: [
      'kanji (JLPT list + kanji decomposition tree)',
      'kanji.js (KANJIDIC details)',
      'KanjiVG (stroke order SVG animation)',
      'kanjiapi.dev + translate.googleapis.com (related words + en→vi gloss meanings)'
    ]
  }

  return cachedIndex
}

export async function getKanjiDetail(rawLiteral: string): Promise<KanjiDetail | null> {
  const literal = normalizeKanjiLiteral(rawLiteral)
  if (!literal) {
    return null
  }

  const cacheKey = getDetailCacheKey(literal)
  if (detailCache.has(cacheKey)) {
    return detailCache.get(cacheKey) ?? null
  }

  const summary = findSummaryByLiteral(literal)
  if (!summary) {
    return null
  }

  const [relatedWordsResult, strokeResult, translatedMeanings] = await Promise.all([
    fetchRelatedWords(literal),
    fetchKanjiStrokeData(literal),
    translateKanjiMeanings(summary.meanings)
  ])

  const detail: KanjiDetail = {
    ...summary,
    meanings: translatedMeanings.length > 0 ? translatedMeanings : summary.meanings,
    tree: getKanjiTree(literal),
    strokeViewBox: strokeResult.viewBox,
    strokeSvg: strokeResult.svg,
    strokePaths: strokeResult.paths,
    strokePathIds: strokeResult.pathIds,
    strokeSource: strokeResult.source,
    strokeError: strokeResult.error,
    relatedWords: relatedWordsResult.words,
    relatedWordsSource: relatedWordsResult.source,
    relatedWordsError: relatedWordsResult.error
  }

  detailCache.set(cacheKey, detail)
  return detail
}
