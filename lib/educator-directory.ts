import 'server-only'
import { randomUUID } from 'node:crypto'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import { decryptPhone, encryptPhone } from '@/lib/phone-crypto'

const TAB = 'Annuaire éducateurs'
const HEADERS = ['ID', 'Nom', 'Licence FFF', 'Téléphone']

export type DirectoryEducator = {
  id: string
  name: string
  licenseNumber: string
  phone: string
}

function cellRange(title: string, row: number) {
  return `'${title.replace(/'/g, "''")}'!A${row}:D${row}`
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
  if (sheet.rows.length > 0 && HEADERS.some((header, index) => sheet.rows[0][index] !== header)) {
    throw new Error(`Les en-têtes de l’onglet « ${TAB} » sont inattendus.`)
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

export async function saveOwnEducatorDirectoryEntry(input: {
  name: string
  licenseNumber: string
  phone: string
}) {
  const name = input.name.trim()
  const licenseNumber = input.licenseNumber.trim()
  const phone = input.phone.trim()
  if (name.length < 2 || name.length > 80) throw new Error('Le nom du compte est invalide.')
  if (licenseNumber.length > 40) throw new Error('Le numéro de licence est trop long.')
  if (phone.length > 80) throw new Error('Le numéro de téléphone est trop long.')

  const sheet = await readSheet(true)
  const normalizedName = name.toLocaleLowerCase('fr-FR')
  const matches = sheet.rows.flatMap((row, index) =>
    index > 0 && row[1]?.trim().toLocaleLowerCase('fr-FR') === normalizedName ? [index] : [],
  )
  if (matches.length > 1) {
    throw new Error('Plusieurs fiches portent votre nom. Contactez un administrateur pour les rapprocher.')
  }

  const existingIndex = matches[0] ?? -1
  const id = existingIndex < 1 ? randomUUID() : sheet.rows[existingIndex][0]?.trim()
  if (!id) throw new Error('La fiche éducateur ne possède pas d’identifiant valide.')
  const row = existingIndex < 1 ? sheet.rows.length + 1 : existingIndex + 1
  const savedName = existingIndex < 1 ? name : sheet.rows[existingIndex][1].trim()
  await updateAuthenticatedSheetValues([{
    range: cellRange(sheet.sheetTitle, row),
    values: [[id, savedName, licenseNumber, encryptPhone(phone)]],
  }])
  return { id }
}
