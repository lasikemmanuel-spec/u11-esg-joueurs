const SHEET_ID = '1zDC6a-hTSKFV2E5JHvj382q6eW9-xURii-5r5O_L4n4'
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`

export type Player = {
  number: number
  lastName: string
  firstName: string
  birthDate: string | null
  birthYear: number | null
  position: string | null
  transferStatus: string | null
}

export type Roster = {
  club: string
  title: string
  players: Player[]
  fetchedAt: string
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

const clean = (value: string | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export async function getRoster(): Promise<Roster> {
  const res = await fetch(CSV_URL, { next: { revalidate: 300, tags: ['google-sheet'] } })
  if (!res.ok) throw new Error(`Impossible de lire le Google Sheet (${res.status})`)

  const rows = parseCsv(await res.text())
  const nonEmpty = rows.map((r) => r.map((c) => c.trim()).filter(Boolean))
  const club = nonEmpty.find((r) => r.length > 0)?.[0] ?? 'Équipe'
  const title = nonEmpty.filter((r) => r.length > 0)[1]?.[0] ?? 'Liste des joueurs'

  const headerIndex = rows.findIndex((r) => r.some((c) => c.trim() === 'Nom'))
  if (headerIndex === -1) return { club, title, players: [], fetchedAt: new Date().toISOString() }

  const header = rows[headerIndex].map((c) => c.trim().toLowerCase())
  const col = (name: string) => header.findIndex((h) => h.startsWith(name))
  const idx = {
    number: col('n°'),
    lastName: col('nom'),
    firstName: col('prénom'),
    birthDate: col('date'),
    position: col('poste'),
    transfer: col('muté'),
  }

  const players: Player[] = []
  for (const r of rows.slice(headerIndex + 1)) {
    const number = Number.parseInt(r[idx.number] ?? '', 10)
    const lastName = clean(r[idx.lastName])
    if (Number.isNaN(number) || !lastName) continue

    const birthDate = clean(r[idx.birthDate])
    const yearMatch = birthDate?.match(/(\d{4})$/)
    players.push({
      number,
      lastName,
      firstName: clean(r[idx.firstName]) ?? '',
      birthDate,
      birthYear: yearMatch ? Number(yearMatch[1]) : null,
      position: clean(r[idx.position]),
      transferStatus: clean(r[idx.transfer]),
    })
  }

  return { club, title, players, fetchedAt: new Date().toISOString() }
}

export function ageOn(birthDate: string | null, reference = new Date()): number | null {
  if (!birthDate) return null
  const [d, m, y] = birthDate.split('/').map(Number)
  if (!d || !m || !y) return null
  let age = reference.getFullYear() - y
  const beforeBirthday =
    reference.getMonth() + 1 < m || (reference.getMonth() + 1 === m && reference.getDate() < d)
  if (beforeBirthday) age--
  return age
}

export function isDateSuspicious(player: Player, reference = new Date()) {
  const age = ageOn(player.birthDate, reference)
  return age !== null && (age < 6 || age > 14)
}
