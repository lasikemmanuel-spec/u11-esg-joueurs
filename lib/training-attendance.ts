import 'server-only'
import { getSheetRows } from '@/lib/google-sheets'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

const TAB = '📅 Présences Entraînement'

export type TrainingAttendanceSession = {
  date: string
  playerStatuses: Record<number, string>
}

function sessionDate(value: string) {
  const date = value.match(/\((\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\)/)
  if (!date) return ''

  const [, enteredDay, enteredMonth, enteredYear] = date
  const month = Number(enteredMonth)
  const year = enteredYear
    ? Number(enteredYear.length === 2 ? `20${enteredYear}` : enteredYear)
    : month >= 9
      ? Number(MATCH_SEASON_START.slice(0, 4))
      : Number(MATCH_SEASON_END.slice(0, 4))
  const day = Number(enteredDay)
  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(`${key}T12:00:00`)

  return parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
    ? key
    : ''
}

export async function getTrainingAttendance(): Promise<TrainingAttendanceSession[]> {
  const rows = await getSheetRows(TAB)
  const headerRowIndex = rows.findIndex((row) =>
    row.some((value) => /séance/i.test(value) && sessionDate(value)),
  )
  if (headerRowIndex < 0) {
    throw new Error('Ligne des séances introuvable dans l’onglet « ' + TAB + ' ».')
  }

  const sessionsByDate = new Map<string, TrainingAttendanceSession>()
  rows[headerRowIndex].forEach((header, column) => {
    const date = sessionDate(header)
    if (!date) return
    if (sessionsByDate.has(date)) {
      throw new Error('La date ' + date + ' apparaît plusieurs fois dans l’onglet « ' + TAB + ' ».')
    }
    sessionsByDate.set(date, { date, playerStatuses: {} })
  })

  if (sessionsByDate.size === 0) {
    throw new Error('Aucune séance datée dans l’onglet « ' + TAB + ' ».')
  }

  for (const row of rows.slice(headerRowIndex + 1)) {
    const number = Number.parseInt(row[1] ?? '', 10)
    if (!Number.isSafeInteger(number)) continue
    for (const [date, session] of sessionsByDate) {
      const column = rows[headerRowIndex].findIndex((header) => sessionDate(header) === date)
      session.playerStatuses[number] = row[column]?.trim() ?? ''
    }
  }

  return [...sessionsByDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
