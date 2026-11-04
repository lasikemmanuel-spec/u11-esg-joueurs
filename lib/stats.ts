import { getSheetRows } from '@/lib/google-sheets'
export * from './stats-shared'
import type { PlayerStats, StatsData } from './stats-shared'

const STATS_TAB = '📊 Stats Générales'

const toNumber = (value: string | undefined) => {
  const cleaned = value?.replace('%', '').replace(',', '.').trim() ?? ''
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export async function getStats(): Promise<StatsData> {
  const rows = await getSheetRows(STATS_TAB)
  const players: PlayerStats[] = []
  let teamTrainingRate: number | null = null

  for (const r of rows) {
    const name = r[1]?.trim()
    if (!name) continue
    if (name.toUpperCase().startsWith('MOYENNE')) {
      teamTrainingRate = toNumber(r[2])
      continue
    }

    const number = Number(r[0])
    if (!Number.isFinite(number) || number <= 0) continue

    players.push({
      number,
      name,
      trainingRate: toNumber(r[2]),
      matchesCalled: toNumber(r[3]),
      callUpRate: toNumber(r[4]),
      starts: toNumber(r[5]),
      subs: toNumber(r[6]),
      minutes: toNumber(r[7]),
      goals: toNumber(r[8]),
      assists: toNumber(r[9]),
      ire: toNumber(r[10]),
    })
  }

  return { players, teamTrainingRate }
}
