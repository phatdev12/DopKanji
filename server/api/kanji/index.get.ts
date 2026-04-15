import { getKanjiIndex } from '../../utils/kanji-data'

export default defineEventHandler(() => {
  return getKanjiIndex()
})
