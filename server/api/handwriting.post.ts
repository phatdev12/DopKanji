import type { KanjiSummary } from '../../shared/types/kanji'
import { getKanjiIndex, getKanjiStrokeData } from '../utils/kanji-data'

type DrawPoint = { x: number; y: number }

type DrawRequestBody = {
  strokeCount?: number
  strokes?: DrawPoint[][]
  canvasWidth?: number
  canvasHeight?: number
}

type StrokeSignature = {
  startX: number
  startY: number
  endX: number
  endY: number
  angle: number
  length: number
}

function parseViewBox(viewBox: string): { minX: number; minY: number; width: number; height: number } | null {
  const values = viewBox
    .trim()
    .split(/\s+/)
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value))

  if (values.length !== 4 || values[2] <= 0 || values[3] <= 0) {
    return null
  }

  return {
    minX: values[0],
    minY: values[1],
    width: values[2],
    height: values[3]
  }
}

function circularAngleDifference(left: number, right: number): number {
  const diff = Math.abs(left - right) % (Math.PI * 2)
  return diff > Math.PI ? Math.PI * 2 - diff : diff
}

function createStrokeSignature(start: DrawPoint, end: DrawPoint): StrokeSignature {
  const deltaX = end.x - start.x
  const deltaY = end.y - start.y

  return {
    startX: start.x,
    startY: start.y,
    endX: end.x,
    endY: end.y,
    angle: Math.atan2(deltaY, deltaX),
    length: Math.hypot(deltaX, deltaY)
  }
}

function buildUserStrokeSignatures(strokes: DrawPoint[][], width: number, height: number): StrokeSignature[] {
  return strokes
    .map((stroke) => {
      const start = stroke[0]
      const end = stroke[stroke.length - 1]

      const normalizedStart = {
        x: start.x / width,
        y: start.y / height
      }
      const normalizedEnd = {
        x: end.x / width,
        y: end.y / height
      }

      return createStrokeSignature(normalizedStart, normalizedEnd)
    })
    .filter((signature) => signature.length > 0.02)
}

function getPathEndpoints(pathData: string): { start: DrawPoint; end: DrawPoint } | null {
  const values = pathData.match(/-?\d*\.?\d+/g)?.map((value) => Number.parseFloat(value)) ?? []
  if (values.length < 4) {
    return null
  }

  return {
    start: { x: values[0], y: values[1] },
    end: { x: values[values.length - 2], y: values[values.length - 1] }
  }
}

function buildSvgStrokeSignatures(paths: string[], viewBox: string): StrokeSignature[] {
  const box = parseViewBox(viewBox)
  if (!box) {
    return []
  }

  return paths
    .map((pathData) => {
      const endpoints = getPathEndpoints(pathData)
      if (!endpoints) {
        return null
      }

      const normalizedStart = {
        x: (endpoints.start.x - box.minX) / box.width,
        y: (endpoints.start.y - box.minY) / box.height
      }
      const normalizedEnd = {
        x: (endpoints.end.x - box.minX) / box.width,
        y: (endpoints.end.y - box.minY) / box.height
      }

      return createStrokeSignature(normalizedStart, normalizedEnd)
    })
    .filter((signature): signature is StrokeSignature => signature !== null && signature.length > 0.01)
}

function compareStrokeSignatures(userStrokes: StrokeSignature[], kanjiStrokes: StrokeSignature[]): number {
  const commonLength = Math.min(userStrokes.length, kanjiStrokes.length)
  if (commonLength === 0) {
    return Number.POSITIVE_INFINITY
  }

  let score = Math.abs(userStrokes.length - kanjiStrokes.length) * 2.4

  for (let index = 0; index < commonLength; index += 1) {
    const userStroke = userStrokes[index]
    const kanjiStroke = kanjiStrokes[index]
    const forwardStartDistance = Math.hypot(userStroke.startX - kanjiStroke.startX, userStroke.startY - kanjiStroke.startY)
    const forwardEndDistance = Math.hypot(userStroke.endX - kanjiStroke.endX, userStroke.endY - kanjiStroke.endY)
    const forwardAngleDistance = circularAngleDifference(userStroke.angle, kanjiStroke.angle) / Math.PI

    const reversedStartDistance = Math.hypot(userStroke.startX - kanjiStroke.endX, userStroke.startY - kanjiStroke.endY)
    const reversedEndDistance = Math.hypot(userStroke.endX - kanjiStroke.startX, userStroke.endY - kanjiStroke.startY)
    const reversedAngleDistance = circularAngleDifference(userStroke.angle, kanjiStroke.angle + Math.PI) / Math.PI

    const startDistance = Math.min(forwardStartDistance, reversedStartDistance)
    const endDistance = Math.min(forwardEndDistance, reversedEndDistance)
    const angleDistance = Math.min(forwardAngleDistance, reversedAngleDistance)
    const lengthDistance = Math.abs(userStroke.length - kanjiStroke.length)

    score += startDistance * 1.6 + endDistance * 1.6 + angleDistance * 2.2 + lengthDistance * 0.8
  }

  return score
}

async function scoreCandidate(summary: KanjiSummary, userSignatures: StrokeSignature[]): Promise<{ literal: string; score: number } | null> {
  const strokeData = await getKanjiStrokeData(summary.literal)
  if (!strokeData?.viewBox || strokeData.paths.length === 0) {
    return null
  }

  const candidateSignatures = buildSvgStrokeSignatures(strokeData.paths, strokeData.viewBox)
  if (candidateSignatures.length === 0) {
    return null
  }

  return {
    literal: summary.literal,
    score: compareStrokeSignatures(userSignatures, candidateSignatures)
  }
}

async function scoreCandidatesWithConcurrency(
  candidates: KanjiSummary[],
  userSignatures: StrokeSignature[],
  concurrency: number
): Promise<Array<{ literal: string; score: number }>> {
  const scores: Array<{ literal: string; score: number }> = []
  let index = 0

  async function worker() {
    while (index < candidates.length) {
      const currentIndex = index
      index += 1
      const scored = await scoreCandidate(candidates[currentIndex], userSignatures)
      if (scored) {
        scores.push(scored)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()))
  return scores
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DrawRequestBody>(event)
  const width = body.canvasWidth ?? 0
  const height = body.canvasHeight ?? 0
  const strokes = body.strokes ?? []

  if (width <= 0 || height <= 0 || !Array.isArray(strokes) || strokes.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Dữ liệu vẽ tay không hợp lệ.'
    })
  }

  const normalizedStrokes = strokes
    .filter((stroke) => Array.isArray(stroke) && stroke.length >= 2)
    .map((stroke) =>
      stroke
        .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y))
        .map((point) => ({ x: point.x, y: point.y }))
    )
    .filter((stroke) => stroke.length >= 2)

  const fallbackStrokeFilter = normalizedStrokes.length > 0 ? normalizedStrokes.length : null
  if (normalizedStrokes.length === 0) {
    return {
      candidates: [],
      fallbackStrokeFilter
    }
  }

  const userSignatures = buildUserStrokeSignatures(normalizedStrokes, width, height)
  if (userSignatures.length === 0) {
    return {
      candidates: [],
      fallbackStrokeFilter
    }
  }

  const indexData = getKanjiIndex()
  const allSummaries = Object.values(indexData.levels).flat()
  const seen = new Set<string>()
  const uniqueSummaries = allSummaries.filter((item) => {
    if (seen.has(item.literal)) {
      return false
    }
    seen.add(item.literal)
    return true
  })

  const strokeTarget = userSignatures.length
  const narrowedCandidates = uniqueSummaries
    .filter((item) => item.strokeCount !== null && Math.abs(item.strokeCount - strokeTarget) <= 2)
    .sort((left, right) => {
      const leftDiff = Math.abs((left.strokeCount ?? strokeTarget) - strokeTarget)
      const rightDiff = Math.abs((right.strokeCount ?? strokeTarget) - strokeTarget)
      if (leftDiff !== rightDiff) {
        return leftDiff - rightDiff
      }

      const leftFreq = left.frequency ?? Number.MAX_SAFE_INTEGER
      const rightFreq = right.frequency ?? Number.MAX_SAFE_INTEGER
      if (leftFreq !== rightFreq) {
        return leftFreq - rightFreq
      }

      return left.literal.localeCompare(right.literal, 'ja')
    })
    .slice(0, 180)

  const scored = await scoreCandidatesWithConcurrency(narrowedCandidates, userSignatures, 12)
  const candidates = scored
    .filter((item) => Number.isFinite(item.score))
    .sort((left, right) => left.score - right.score)
    .slice(0, 20)
    .map((item) => item.literal)

  return {
    candidates,
    fallbackStrokeFilter
  }
})
