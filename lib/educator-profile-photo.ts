import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'

const TAB = 'Photos profils éducateurs'
const HEADERS = ['Identifiant', 'Photo JPEG']
const MAX_PHOTO_BYTES = 30 * 1024

function normalizeUsername(username: string) {
  return username.trim().toLocaleLowerCase('fr-FR')
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

async function readSheet(create = false) {
  let sheet: Awaited<ReturnType<typeof getAuthenticatedSheetRows>>
  try {
    sheet = await getAuthenticatedSheetRows(TAB)
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'Aucun onglet Google Sheets trouvé.' || !create) throw error
    await ensureAuthenticatedSheetTab(TAB)
    sheet = await getAuthenticatedSheetRows(TAB)
  }
  if (sheet.sheetTitle !== TAB) throw new Error(`Impossible de sélectionner l’onglet « ${TAB} » exact.`)
  if (sheet.rows.length === 0 && create) {
    await updateAuthenticatedSheetValues([{ range: `'${TAB}'!A1:B1`, values: [HEADERS] }])
    sheet.rows = [HEADERS]
  }
  if (sheet.rows.length > 0 && HEADERS.some((header, index) => sheet.rows[0][index] !== header)) {
    throw new Error(`Les en-têtes de l’onglet « ${TAB} » sont inattendus.`)
  }
  return sheet
}

export async function getEducatorProfilePhoto(username: string) {
  let sheet: Awaited<ReturnType<typeof readSheet>>
  try {
    sheet = await readSheet()
  } catch (error) {
    if (error instanceof Error && error.message === 'Aucun onglet Google Sheets trouvé.') return null
    throw error
  }
  const normalizedUsername = normalizeUsername(username)
  const row = sheet.rows.find((entry, index) => index > 0 && normalizeUsername(entry[0] ?? '') === normalizedUsername)
  const photo = row?.[1]?.trim()
  return photo ? parsePhotoDataUrl(photo) : null
}

export async function saveEducatorProfilePhoto(username: string, photoDataUrl: string | null) {
  const sheet = await readSheet(true)
  const normalizedUsername = normalizeUsername(username)
  const rowIndex = sheet.rows.findIndex(
    (entry, index) => index > 0 && normalizeUsername(entry[0] ?? '') === normalizedUsername,
  )
  const rowNumber = rowIndex < 1 ? sheet.rows.length + 1 : rowIndex + 1
  const photo = photoDataUrl === null
    ? ''
    : `data:image/jpeg;base64,${parsePhotoDataUrl(photoDataUrl).toString('base64')}`
  await updateAuthenticatedSheetValues([{
    range: `'${TAB.replace(/'/g, "''")}'!A${rowNumber}:B${rowNumber}`,
    values: [[username.trim(), photo]],
  }])
}
