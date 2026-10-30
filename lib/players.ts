import { getSheetRows, SHEET_ID } from '@/lib/google-sheets'
export { parseCsv } from '@/lib/csv'

export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`

export type Player = {
  number: number
  lastName: string
  firstName: string
  birthDate: string | null
  birthYear: number | null
  position: string | null
  transferStatus: string | null
  licenseNumber: string | null
}

export type Roster = {
  club: string
  title: string
  players: Player[]
  fetchedAt: string
}

const clean = (value: string | undefined) => {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

export async function getRoster(): Promise<Roster> {
  const rows = await getSheetRows()
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
    license: header.findIndex((h) => h.includes('licence') || h.includes('license')),
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
      licenseNumber: clean(r[idx.license]),
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
