import { MATCH_RESULT_STATUSES, type MatchResultStatus } from '@/lib/match-result-options'
import { clampToMatchSeason, MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

export type MatchResultDraft = {
  team: 'E1' | 'E2'
  date: string
  opponent: string
  competition: string
  homeAway: string
  kickoffTime: string
  meetingTime: string
  venueAddress: string
  resultLabel: string
  goalsFor: string
  goalsAgainst: string
}

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

export function createMatchResultDraft(date = clampToMatchSeason(localToday())): MatchResultDraft {
  return {
    team: 'E1',
    date,
    opponent: '',
    competition: 'Championnat',
    homeAway: 'Domicile',
    kickoffTime: '',
    meetingTime: '',
    venueAddress: '',
    resultLabel: '',
    goalsFor: '',
    goalsAgainst: '',
  }
}

export function validateMatchResultDraft(draft: MatchResultDraft) {
  if (draft.date < MATCH_SEASON_START || draft.date > MATCH_SEASON_END) {
    return 'La date du match doit être comprise entre le 1er septembre 2026 et le 30 juin 2027.'
  }

  const oneScoreMissing = Boolean(draft.goalsFor) !== Boolean(draft.goalsAgainst)
  if (oneScoreMissing) {
    return 'Saisis les deux scores ou laisse les deux champs vides pour planifier le match.'
  }
  const hasScore = Boolean(draft.goalsFor && draft.goalsAgainst)
  if (hasScore && !draft.resultLabel) {
    return 'Choisis le résultat à inscrire dans le Sheet : Gagné, Nul ou Perdu.'
  }
  if (!hasScore && draft.resultLabel && draft.resultLabel !== 'Annulé') {
    return 'Un résultat Gagné, Nul ou Perdu nécessite les deux scores.'
  }
  return null
}

export async function saveMatchResultDraft(draft: MatchResultDraft, slotColumn: number | null = null) {
  const validationError = validateMatchResultDraft(draft)
  if (validationError) throw new Error(validationError)

  const response = await fetch('/api/match-results', {
    method: slotColumn === null ? 'POST' : 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...draft,
      slotColumn: slotColumn ?? undefined,
      goalsFor: draft.goalsFor ? Number(draft.goalsFor) : null,
      goalsAgainst: draft.goalsAgainst ? Number(draft.goalsAgainst) : null,
    }),
  })
  const result = await response.json() as { error?: string; sheetTitle?: string }
  if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer le match.')
  if (!result.sheetTitle) throw new Error('Le match a été enregistré, mais la feuille n’a pas été identifiée.')
  return { sheetTitle: result.sheetTitle }
}

export function getEditableMatchResultLabel(
  resultLabel: string,
  goalsFor: number | null,
  goalsAgainst: number | null,
) {
  if (MATCH_RESULT_STATUSES.includes(resultLabel as MatchResultStatus)) return resultLabel
  if (goalsFor === null || goalsAgainst === null) return ''
  if (goalsFor > goalsAgainst) return 'Gagné'
  if (goalsFor < goalsAgainst) return 'Perdu'
  return 'Nul'
}
