import 'server-only'
import { getAuthenticatedSheetRows, updateAuthenticatedSheetValues } from '@/lib/google-sheets'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

const TAB = '📣 Convocations Matchs'
const FIRST_MATCH_COLUMN = 2
const MATCH_COLUMN_COUNT = 30

export type EditableCallupStatus =
  | '✅ Convoqué E1'
  | '❌ Non convoqué'
  | '⚠️ Convoqué absent'
  | '🗓️ Absent'
  | '✅ Convoqué E2'
  | '🩺 Blessé'
  | 'Pas de licence'

export type CallupSelection = {
  number: number
  status: EditableCallupStatus | ''
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

function dateKey(value: string) {
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = trimmed.match(/(?:^|\D)(\d{1,2})[/. -](\d{1,2})(?:[/. -](\d{4}))?(?:\D|$)/)
  if (dayFirst) {
    const [, day, month, enteredYear] = dayFirst
    const year = enteredYear ?? (Number(month) >= 9
      ? MATCH_SEASON_START.slice(0, 4)
      : MATCH_SEASON_END.slice(0, 4))
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return ''
}

export async function writeCallupSchedule(date: string, selections: CallupSelection[]) {
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(TAB)
  const dateRowIndex = rows.findIndex((row) =>
    row[1]?.trim().toLocaleLowerCase('fr-FR') === 'date',
  )
  if (dateRowIndex < 0) throw new Error('Ligne des dates introuvable dans l’onglet « Convocations Matchs ».')

  const playerRows = new Map<number, number>()
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const number = Number.parseInt(rows[rowIndex][0] ?? '', 10)
    if (!Number.isSafeInteger(number) || !rows[rowIndex][1]?.trim()) continue
    if (playerRows.has(number)) throw new Error(`Le numéro de joueur ${number} apparaît plusieurs fois dans les convocations.`)
    playerRows.set(number, rowIndex)
  }

  const duplicateNumbers = new Set<number>()
  for (const selection of selections) {
    if (duplicateNumbers.has(selection.number)) throw new Error('Un joueur apparaît plusieurs fois dans la liste.')
    duplicateNumbers.add(selection.number)
    if (!playerRows.has(selection.number)) {
      throw new Error(`Le joueur n°${selection.number} est introuvable dans l’onglet des convocations.`)
    }
  }

  let targetColumn: number | null = null
  let nextUndatedColumn: number | null = null
  for (let column = FIRST_MATCH_COLUMN; column < FIRST_MATCH_COLUMN + MATCH_COLUMN_COUNT; column += 1) {
    const existingDate = dateKey(rows[dateRowIndex][column] ?? '')
    if (existingDate === date) {
      if (targetColumn !== null) throw new Error('Cette date apparaît plusieurs fois dans les convocations.')
      targetColumn = column
    }
    if (!existingDate && nextUndatedColumn === null) nextUndatedColumn = column
  }

  targetColumn ??= nextUndatedColumn
  if (targetColumn === null) throw new Error('Les 30 colonnes de convocations sont utilisées. Libérez une colonne avant d’ajouter une date.')

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const cellRange = (rowIndex: number) =>
    `'${escapedTitle}'!${columnName(targetColumn)}${rowIndex + 1}`
  const [year, month, day] = date.split('-')
  const updates = [
    { range: cellRange(dateRowIndex), values: [[`${day}/${month}/${year}`]] },
    ...selections.map((selection) => ({
      range: cellRange(playerRows.get(selection.number)!),
      values: [[selection.status]],
    })),
  ]

  await updateAuthenticatedSheetValues(updates)
  return { sheetTitle, updatedExistingDate: rows[dateRowIndex][targetColumn]?.trim() !== '' }
}
