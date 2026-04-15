export type JlptLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1'

export interface KanjiSummary {
  literal: string
  level: JlptLevel
  meanings: string[]
  onyomi: string[]
  kunyomi: string[]
  strokeCount: number | null
  frequency: number | null
}

export interface KanjiTreeNode {
  element: string
  g?: KanjiTreeNode[]
}

export interface RelatedWord {
  written: string
  reading: string
  meanings: string[]
  priorities: string[]
}

export interface KanjiDetail extends KanjiSummary {
  tree: KanjiTreeNode | null
  strokeViewBox: string | null
  strokePaths: string[]
  strokeSource: string
  strokeError: string | null
  relatedWords: RelatedWord[]
  relatedWordsSource: string
  relatedWordsError: string | null
}

export type KanjiLevelMap = Record<JlptLevel, KanjiSummary[]>

export interface KanjiIndexResponse {
  appName: string
  levels: KanjiLevelMap
  total: number
  updatedAt: string
  sources: string[]
}
