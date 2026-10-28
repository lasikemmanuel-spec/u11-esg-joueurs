import { getSheetRows } from '@/lib/google-sheets'

const STATS_TAB = '📊 Stats Générales'

export type PlayerStats = {
  number: number
  name: string
  trainingRate: number | null
  matchesCalled: number | null
  callUpRate: number | null
  starts: number | null
  subs: number | null
  minutes: number | null
  goals: number | null
  assists: number | null
  ire: number | null
}

export type IreStatus = 'fair' | 'under' | 'over' | 'none'

export type StatsData = {
  players: PlayerStats[]
  teamTrainingRate: number | null
}

const toNumber = (value: string | undefined) => {
  const cleaned = value?.replace('%', '').replace(',', '.').trim() ?? ''
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function ireStatus(stats: PlayerStats): IreStatus {
  if (stats.ire === null || stats.ire === 0 || !stats.matchesCalled) return 'none'
  if (stats.ire < 0.9) return 'under'
  if (stats.ire > 1.1) return 'over'
  return 'fair'
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
    const number = Number.parseInt(r[0] ?? '', 10)
    if (Number.isNaN(number)) continue
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
