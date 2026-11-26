import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createMatchResultDraft,
  saveMatchResultDraft,
  validateMatchResultDraft,
} from '@/lib/match-result-draft'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('match result draft', () => {
  it('creates a scoreless draft that can be used to plan a match', () => {
    const draft = createMatchResultDraft('2026-11-26')

    expect(draft).toMatchObject({
      team: 'E1',
      date: '2026-11-26',
      competition: 'Championnat',
      homeAway: 'Domicile',
      goalsFor: '',
      goalsAgainst: '',
      resultLabel: '',
    })
    expect(validateMatchResultDraft(draft)).toBeNull()
  })

  it('requires both scores and a result when recording a played match', () => {
    const draft = createMatchResultDraft('2026-11-26')

    expect(validateMatchResultDraft({ ...draft, goalsFor: '2' })).toContain('les deux scores')
    expect(validateMatchResultDraft({
      ...draft,
      goalsFor: '2',
      goalsAgainst: '1',
    })).toContain('Choisis le résultat')
    expect(validateMatchResultDraft({
      ...draft,
      resultLabel: 'Gagné',
    })).toContain('nécessite les deux scores')
  })

  it('posts new matches without score values when planning', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ sheetTitle: 'Feuille de match E1' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const draft = { ...createMatchResultDraft('2026-11-26'), opponent: 'ES Genech' }
    await expect(saveMatchResultDraft(draft)).resolves.toEqual({
      sheetTitle: 'Feuille de match E1',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/match-results', expect.objectContaining({
      method: 'POST',
    }))
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(requestBody).toMatchObject({
      date: '2026-11-26',
      opponent: 'ES Genech',
      goalsFor: null,
      goalsAgainst: null,
    })
  })
})
