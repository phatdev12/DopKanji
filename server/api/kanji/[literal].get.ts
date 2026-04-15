import { createError, getRouterParam } from 'h3'
import { getKanjiDetail } from '../../utils/kanji-data'

export default defineEventHandler(async (event) => {
  const literalParam = getRouterParam(event, 'literal') ?? ''
  const literal = decodeURIComponent(literalParam)
  const detail = await getKanjiDetail(literal)

  if (!detail) {
    throw createError({
      statusCode: 404,
      statusMessage: `Không tìm thấy kanji "${literal}"`
    })
  }

  return detail
})
