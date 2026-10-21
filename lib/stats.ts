import { parseCsv } from '@/lib/players'

const SHEET_ID = '1zDC6a-hTSKFV2E5JHvj382q6eW9-xURii-5r5O_L4n4'
const STATS_TAB = '📊 Stats Générales'
const STATS_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(STATS_TAB)}`

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
  if (stats.ire < 1) return 'under'
  if (stats.ire > 1.1) return 'over'
  return 'fair'
}

export async function getStats(): Promise<StatsData> {
  const res = await fetch(STATS_URL, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Impossible de lire l'onglet Stats (${res.status})`)

  const rows = parseCsv(await res.text())
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
