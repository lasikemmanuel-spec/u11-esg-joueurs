import { parseCsv } from '@/lib/players'

const SHEET_ID = '1zDC6a-hTSKFV2E5JHvj382q6eW9-xURii-5r5O_L4n4'
const TAB = '📣 Convocations Matchs'
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}`

const FIRST_MATCH_COL = 2
const MATCH_COLS = 30
const TOTALS_COL = FIRST_MATCH_COL + MATCH_COLS

export type MatchStatus = 'called' | 'absent' | 'injured' | 'notCalled' | 'calledAbsent' | 'unknown'

export type MatchEntry = {
  date: string
  status: MatchStatus
  team: string | null
  raw: string
}

export type Convocation = {
  number: number
  name: string
  matches: MatchEntry[]
  calledCount: number | null
  callUpRate: number | null
  presentCount: number | null
  presentRate: number | null
  absentCount: number | null
  absentRate: number | null
  notCalledCount: number | null
  notCalledRate: number | null
  injuredCount: number | null
  injuredRate: number | null
}

export type ConvocationsData = {
  players: Convocation[]
  matchesPlayed: number
}

const toNumber = (value: string | undefined) => {
  const cleaned = value?.replace('%', '').replace(',', '.').trim() ?? ''
  if (cleaned === '') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

function parseStatus(raw: string): Pick<MatchEntry, 'status' | 'team'> {
  const text = raw.toLowerCase()
  const team = raw.match(/\bE(\d)\b/)?.[0] ?? null
  if (text.includes('bless')) return { status: 'injured', team: null }
  if (text.includes('non convoq')) return { status: 'notCalled', team: null }
  if (text.includes('convoqué absent') || text.includes('convoque absent')) return { status: 'calledAbsent', team }
  if (text.includes('absent')) return { status: 'absent', team: null }
  if (text.includes('convoq')) return { status: 'called', team }
  return { status: 'unknown', team: null }
}

export async function getConvocations(): Promise<ConvocationsData> {
  const res = await fetch(URL, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Impossible de lire l'onglet Convocations (${res.status})`)

  const rows = parseCsv(await res.text())
  let dates: string[] = []
  const players: Convocation[] = []

  for (const r of rows) {
    if (r[1]?.trim() === 'Date') {
      dates = r.slice(FIRST_MATCH_COL, TOTALS_COL).map((d) => d.trim())
      continue
    }
    const number = Number.parseInt(r[0] ?? '', 10)
    const name = r[1]?.trim()
    if (Number.isNaN(number) || !name) continue

    const matches: MatchEntry[] = []
    for (let i = 0; i < MATCH_COLS; i++) {
      const raw = r[FIRST_MATCH_COL + i]?.trim() ?? ''
      const date = dates[i] ?? ''
      if (!raw || !date) continue
      matches.push({ date, raw, ...parseStatus(raw) })
    }

    const t = TOTALS_COL
    players.push({
      number,
      name,
      matches,
      calledCount: toNumber(r[t]),
      callUpRate: toNumber(r[t + 1]),
      presentCount: toNumber(r[t + 2]),
      presentRate: toNumber(r[t + 3]),
      absentCount: toNumber(r[t + 4]),
      absentRate: toNumber(r[t + 5]),
      notCalledCount: toNumber(r[t + 6]),
      notCalledRate: toNumber(r[t + 7]),
      injuredCount: toNumber(r[t + 8]),
      injuredRate: toNumber(r[t + 9]),
    })
  }

  return { players, matchesPlayed: dates.filter(Boolean).length }
}
