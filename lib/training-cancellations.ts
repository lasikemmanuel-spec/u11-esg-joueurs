import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import type { TrainingCancellation } from '@/lib/training-cancellations-shared'
import { isTrainingCancellationDate, isTrainingCancellationReason } from '@/lib/training-cancellations-shared'

const TAB = '⛈️ Annulations entraînements'
const HEADERS = ['Date', 'Motif', 'Annulée par', 'Annulée le']

function isHeaders(row: string[] | undefined) {
  return HEADERS.every((header, index) => row?.[index]?.trim() === header)
}

function rowRange(sheetTitle: string, rowNumber: number) {
  return `'${sheetTitle.replace(/'/g, "''")}'!A${rowNumber}:D${rowNumber}`
}

export async function getTrainingCancellations(): Promise<TrainingCancellation[]> {
  let sheet: Awaited<ReturnType<typeof getAuthenticatedSheetRows>>
  try {
    sheet = await getAuthenticatedSheetRows(TAB)
  } catch (error) {
    if (error instanceof Error && error.message === 'Aucun onglet Google Sheets trouvé.') return []
    throw error
  }
  if (sheet.rows.length === 0) return []
  if (!isHeaders(sheet.rows[0])) throw new Error('L’onglet des annulations d’entraînement a un en-tête invalide.')

  return sheet.rows.slice(1).flatMap((row) => {
    const date = row[0]?.trim() ?? ''
    const reason = row[1]?.trim() ?? ''
    const cancelledBy = row[2]?.trim() ?? ''
    const cancelledAt = row[3]?.trim() ?? ''
    if (!date) return []
    if (!isTrainingCancellationDate(date) || !isTrainingCancellationReason(reason) || !cancelledBy || !cancelledAt) {
      throw new Error(`L’enregistrement d’annulation du ${date} est invalide.`)
    }
    return [{ date, reason, cancelledBy, cancelledAt }]
  })
}

async function getCancellationSheet() {
  await ensureAuthenticatedSheetTab(TAB)
  const sheet = await getAuthenticatedSheetRows(TAB)
  if (sheet.rows.length === 0) {
    await updateAuthenticatedSheetValues([{
      range: `'${sheet.sheetTitle.replace(/'/g, "''")}'!A1:D1`,
      values: [HEADERS],
    }])
    return { ...sheet, rows: [HEADERS] }
  }
  if (!isHeaders(sheet.rows[0])) throw new Error('L’onglet des annulations d’entraînement a un en-tête invalide.')
  return sheet
}

export async function saveTrainingCancellation(
  date: string,
  reason: string,
  cancelledBy: string,
  cancelledAt: string,
) {
  if (!isTrainingCancellationDate(date) || !isTrainingCancellationReason(reason)) {
    throw new Error('Les informations d’annulation sont invalides.')
  }
  const sheet = await getCancellationSheet()
  const existingIndex = sheet.rows.findIndex((row, index) => index > 0 && row[0]?.trim() === date)
  const rowNumber = existingIndex < 0 ? sheet.rows.length + 1 : existingIndex + 1
  await updateAuthenticatedSheetValues([{
    range: rowRange(sheet.sheetTitle, rowNumber),
    values: [[date, reason.trim(), cancelledBy, cancelledAt]],
  }])
}

export async function removeTrainingCancellation(date: string) {
  if (!isTrainingCancellationDate(date)) throw new Error('La date d’annulation est invalide.')
  const sheet = await getCancellationSheet()
  const existingIndex = sheet.rows.findIndex((row, index) => index > 0 && row[0]?.trim() === date)
  if (existingIndex < 0) return false
  await updateAuthenticatedSheetValues([{
    range: rowRange(sheet.sheetTitle, existingIndex + 1),
    values: [['', '', '', '']],
  }])
  return true
}
