import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import { decryptPhone, encryptPhone } from '@/lib/phone-crypto'

const TAB = 'Annuaire éducateurs'
const HEADERS = ['ID', 'Nom', 'Licence FFF', 'Téléphone', 'Photo']
const DIRECTORY_HEADERS = HEADERS.slice(0, 4)
const MAX_PHOTO_BYTES = 30 * 1024

export type DirectoryEducator = {
  id: string
  name: string
  licenseNumber: string
  phone: string
  hasPhoto: boolean
}

function cellRange(title: string, row: number) {
  return `'${title.replace(/'/g, "''")}'!A${row}:D${row}`
}

function photoCellRange(title: string, row: number) {
  return `'${title.replace(/'/g, "''")}'!E${row}`
}

async function readSheet(create = false) {
  let sheet: Awaited<ReturnType<typeof getAuthenticatedSheetRows>>
  try {
    sheet = await getAuthenticatedSheetRows(TAB)
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Aucun onglet Google Sheets trouvé.' || !create) throw error
    await ensureAuthenticatedSheetTab(TAB)
    sheet = await getAuthenticatedSheetRows(TAB)
  }

  if (sheet.rows.length === 0 && create) {
    await updateAuthenticatedSheetValues([{ range: cellRange(sheet.sheetTitle, 1), values: [HEADERS] }])
    sheet.rows = [HEADERS]
  }
  if (sheet.rows.length > 0) {
    if (DIRECTORY_HEADERS.some((header, index) => sheet.rows[0][index] !== header)) {
      throw new Error(`Les en-têtes de l’onglet « ${TAB} » sont inattendus.`)
    }
    if (sheet.rows[0][4] && sheet.rows[0][4] !== HEADERS[4]) {
      throw new Error(`Les en-têtes de l’onglet « ${TAB} » sont inattendus.`)
    }
    if (sheet.rows[0][4] !== HEADERS[4]) {
      await updateAuthenticatedSheetValues([{
        range: `'${sheet.sheetTitle.replace(/'/g, "''")}'!A1:E1`,
        values: [HEADERS],
      }])
      sheet.rows[0][4] = HEADERS[4]
    }
  }
  return sheet
}

export async function getEducatorDirectory(): Promise<DirectoryEducator[]> {
  let sheet: Awaited<ReturnType<typeof readSheet>>
  try {
    sheet = await readSheet()
  } catch (error) {
    if (error instanceof Error && error.message === 'Aucun onglet Google Sheets trouvé.') return []
    throw error
  }
  return sheet.rows.slice(1).flatMap((row) => {
    const id = row[0]?.trim() ?? ''
    const name = row[1]?.trim() ?? ''
    if (!id || !name) return []
    return [{
      id,
      name,
      licenseNumber: row[2]?.trim() ?? '',
      phone: decryptPhone(row[3]?.trim() ?? '').trim(),
      hasPhoto: Boolean(row[4]?.trim()),
    }]
  }).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
}

export async function saveEducatorDirectoryEntry(input: {
  id?: string
  name: string
  licenseNumber: string
  phone: string
}) {
  const name = input.name.trim()
  const licenseNumber = input.licenseNumber.trim()
  const phone = input.phone.trim()
  if (name.length < 2 || name.length > 80) throw new Error('Le nom doit contenir entre 2 et 80 caractères.')
  if (licenseNumber.length > 40) throw new Error('Le numéro de licence est trop long.')
  if (phone.length > 80) throw new Error('Le numéro de téléphone est trop long.')

  const sheet = await readSheet(true)
  const existingIndex = input.id
    ? sheet.rows.findIndex((row, index) => index > 0 && row[0]?.trim() === input.id)
    : -1
  if (input.id && existingIndex < 1) throw new Error('Cet éducateur n’existe plus dans l’annuaire.')
  const id = input.id ?? randomUUID()
  const row = existingIndex < 1 ? sheet.rows.length + 1 : existingIndex + 1
  await updateAuthenticatedSheetValues([{
    range: cellRange(sheet.sheetTitle, row),
    values: [[id, name, licenseNumber, encryptPhone(phone)]],
  }])
  return { id }
}

function parsePhotoDataUrl(value: string) {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match) throw new Error('La photo doit être une image JPEG valide.')
  const bytes = Buffer.from(match[1], 'base64')
  if (
    bytes.length < 4 ||
    bytes.length > MAX_PHOTO_BYTES ||
    bytes.toString('base64') !== match[1] ||
    bytes[0] !== 0xff ||
    bytes[1] !== 0xd8 ||
    bytes[bytes.length - 2] !== 0xff ||
    bytes[bytes.length - 1] !== 0xd9
  ) {
    throw new Error('La photo est invalide ou dépasse 30 Ko.')
  }
  return bytes
}

export async function saveEducatorPhoto(id: string, photoDataUrl: string | null) {
  const sheet = await readSheet()
  const rowIndex = sheet.rows.findIndex((row, index) => index > 0 && row[0]?.trim() === id)
  if (rowIndex < 1) throw new Error('Cet éducateur n’existe plus dans l’annuaire.')
  const rowNumber = rowIndex + 1
  const photo = photoDataUrl === null
    ? ''
    : `data:image/jpeg;base64,${parsePhotoDataUrl(photoDataUrl).toString('base64')}`
  await updateAuthenticatedSheetValues([{
    range: photoCellRange(sheet.sheetTitle, rowNumber),
    values: [[photo]],
  }])
}

export async function getEducatorPhoto(id: string) {
  const sheet = await readSheet()
  const row = sheet.rows.find((entry, index) => index > 0 && entry[0]?.trim() === id)
  if (!row?.[4]) return null
  return parsePhotoDataUrl(row[4])
}
