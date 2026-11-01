export const MATCH_RESULT_STATUSES = ['Gagné', 'Nul', 'Perdu', 'Annulé'] as const

export type MatchResultStatus = (typeof MATCH_RESULT_STATUSES)[number]
