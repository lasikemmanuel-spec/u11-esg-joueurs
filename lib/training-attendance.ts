import 'server-only'
import {
  ensureAuthenticatedSheetColumnCount,
  getAuthenticatedSheetRows,
  getSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'
import { getTrainingCancellations } from '@/lib/training-cancellations'
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

  const cancellations = await getTrainingCancellations()
  if (sessionsByDate.size === 0 && cancellations.length === 0) {
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

  for (const cancellation of cancellations) {
    const session = sessionsByDate.get(cancellation.date) ?? {
      date: cancellation.date,
      playerStatuses: {},
    }
    session.cancellation = cancellation
    sessionsByDate.set(cancellation.date, session)
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

function numberedSession(header: string) {
  const normalizedHeader = header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr-FR')
    .trim()
  const match = normalizedHeader.match(/^seance\s+(\d+)(?:\s*\(|$)/)
  return match ? Number(match[1]) : undefined
}

function sessionNumberForColumn(headers: string[], column: number) {
  const currentNumber = numberedSession(headers[column] ?? '')
  if (currentNumber !== undefined) return currentNumber

  for (let index = column - 1; index >= 0; index -= 1) {
    const previousNumber = numberedSession(headers[index] ?? '')
    if (previousNumber !== undefined) return previousNumber + 1
  }
  for (let index = column + 1; index < headers.length; index += 1) {
    const nextNumber = numberedSession(headers[index] ?? '')
    if (nextNumber !== undefined) return Math.max(1, nextNumber - 1)
  }

  return Math.max(0, ...headers.map(numberedSession).filter((value): value is number => value !== undefined)) + 1
}

function trainingSessionHeader(date: string, sessionNumber: number) {
  const [year, month, day] = date.split('-')
  return `Séance ${sessionNumber} (${day}/${month}/${year})`
}

function findEmptyNumberedSessionColumn(
  rows: string[][],
  headerRowIndex: number,
  playerRows: Map<number, number>,
  datedColumns: Set<number>,
) {
  const playerRowIndexes = [...playerRows.values()]
  return rows[headerRowIndex].findIndex((header, column) => {
    const normalizedHeader = header
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr-FR')
      .trim()
    return /^seance\s+\d+$/.test(normalizedHeader) &&
      !datedColumns.has(column) &&
      playerRowIndexes.every((rowIndex) => !(rows[rowIndex][column] ?? '').trim())
  })
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
  const emptySessionColumn = findEmptyNumberedSessionColumn(
    rows,
    headerRowIndex,
    playerRows,
    new Set(dateColumns.values()),
  )
  const moveExistingColumn = existingColumn !== undefined &&
    emptySessionColumn >= 0 &&
    emptySessionColumn < existingColumn

  let targetColumn: number
  if (existingColumn !== undefined && !moveExistingColumn) {
    targetColumn = existingColumn
  } else if (emptySessionColumn >= 0) {
    targetColumn = emptySessionColumn
  } else {
    targetColumn = Math.max(-1, ...dateColumns.values()) + 1
    while (rows.some((row) => (row[targetColumn] ?? '').trim() !== '')) targetColumn += 1
  }

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  await ensureAuthenticatedSheetColumnCount(sheetTitle, targetColumn + 1)
  const column = columnName(targetColumn)
  const updates: Array<{ range: string; values: string[][] }> = []
  const targetHeader = trainingSessionHeader(
    date,
    sessionNumberForColumn(rows[headerRowIndex], targetColumn),
  )
  if (rows[headerRowIndex][targetColumn] !== targetHeader) {
    updates.push({
      range: `'${escapedTitle}'!${column}${headerRowIndex + 1}`,
      values: [[targetHeader]],
    })
  }
  if (moveExistingColumn && existingColumn !== undefined) {
    const oldColumn = columnName(existingColumn)
    for (const rowIndex of playerRows.values()) {
      const value = rows[rowIndex][existingColumn] ?? ''
      if (value.trim()) {
        updates.push({
          range: `'${escapedTitle}'!${column}${rowIndex + 1}`,
          values: [[value]],
        })
      }
      if (value.trim()) {
        updates.push({
          range: `'${escapedTitle}'!${oldColumn}${rowIndex + 1}`,
          values: [['']],
        })
      }
    }
    updates.push({
      range: `'${escapedTitle}'!${oldColumn}${headerRowIndex + 1}`,
      values: [['']],
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
