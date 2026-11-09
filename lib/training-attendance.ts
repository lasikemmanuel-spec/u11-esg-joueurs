import 'server-only'
import {
  ensureAuthenticatedSheetColumnCount,
  getAuthenticatedSheetRows,
  getSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'
import type { TrainingAttendanceEntry, TrainingAttendanceSession } from '@/lib/training-attendance-shared'

export type { TrainingAttendanceEntry, TrainingAttendanceSession } from '@/lib/training-attendance-shared'

const TAB = '📅 Présences Entraînement'

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

function columnName(columnIndex: number) {
  let value = columnIndex + 1
  let column = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    column = String.fromCharCode(65 + remainder) + column
    value = Math.floor((value - 1) / 26)
  }
  return column
}

function trainingSessionHeader(date: string) {
  const [year, month, day] = date.split('-')
  return `Séance (${day}/${month}/${year})`
}

export async function saveTrainingAttendance(
  date: string,
  entries: TrainingAttendanceEntry[],
) {
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(TAB)
  const headerRowIndex = rows.findIndex((row) => row.some((value) => /séance/i.test(value) && sessionDate(value)))
  if (headerRowIndex < 0) {
    throw new Error(`Ligne des séances introuvable dans l’onglet « ${TAB} ».`)
  }

  const dateColumns = new Map<string, number>()
  rows[headerRowIndex].forEach((header, column) => {
    const currentDate = sessionDate(header)
    if (!currentDate) return
    if (dateColumns.has(currentDate)) {
      throw new Error(`La date ${currentDate} apparaît plusieurs fois dans l’onglet « ${TAB} ».`)
    }
    dateColumns.set(currentDate, column)
  })

  const playerRows = new Map<number, number>()
  rows.forEach((row, rowIndex) => {
    if (rowIndex <= headerRowIndex) return
    const number = Number.parseInt(row[1] ?? '', 10)
    if (!Number.isSafeInteger(number)) return
    if (playerRows.has(number)) throw new Error(`Le joueur n°${number} apparaît plusieurs fois dans l’onglet « ${TAB} ».`)
    playerRows.set(number, rowIndex)
  })

  const existingColumn = dateColumns.get(date)
  let targetColumn = existingColumn
  if (targetColumn === undefined) {
    targetColumn = Math.max(-1, ...dateColumns.values()) + 1
    while (rows.some((row) => (row[targetColumn!] ?? '').trim() !== '')) targetColumn += 1
  }

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  await ensureAuthenticatedSheetColumnCount(sheetTitle, targetColumn + 1)
  const column = columnName(targetColumn)
  const updates: Array<{ range: string; values: string[][] }> = []
  if (existingColumn === undefined) {
    updates.push({
      range: `'${escapedTitle}'!${column}${headerRowIndex + 1}`,
      values: [[trainingSessionHeader(date)]],
    })
  }
  for (const entry of entries) {
    const rowIndex = playerRows.get(entry.number)
    if (rowIndex === undefined) throw new Error(`Le joueur n°${entry.number} est introuvable dans l’onglet « ${TAB} ».`)
    updates.push({
      range: `'${escapedTitle}'!${column}${rowIndex + 1}`,
      values: [[entry.status]],
    })
  }

  await updateAuthenticatedSheetValues(updates)
  return { date, playersSaved: entries.length, created: existingColumn === undefined }
}
