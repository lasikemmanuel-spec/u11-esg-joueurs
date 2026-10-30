import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'

const PHONE_TAB = 'Téléphones éducateurs'
const PHONE_TAB_HEADERS = ['Numéro joueur', 'Téléphone']

export class PhoneMigrationRequiredError extends Error {
  constructor() {
    super('L’onglet des téléphones éducateurs doit être créé avant leur affichage.')
    this.name = 'PhoneMigrationRequiredError'
  }
}

function getPhoneSheetLayout(rows: string[][]) {
  const normalize = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').trim()
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell) === 'nom'))
  if (headerIndex < 0) throw new Error('La ligne des en-têtes de l’effectif est introuvable.')

  const header = rows[headerIndex].map(normalize)
  const phoneIndex = header.findIndex((cell) =>
    /(^|[^a-z])(?:tel(?:ephone)?|portable|mobile)([^a-z]|$)/.test(cell),
  )
  const numberIndex = header.findIndex((cell) => cell.startsWith('n°') || cell === 'numero' || cell === 'num')
  if (phoneIndex < 0) throw new Error('La colonne Téléphone est introuvable dans l’onglet Joueurs.')
  if (numberIndex < 0) throw new Error('La colonne du numéro de joueur est introuvable.')

  return { headerIndex, phoneIndex, numberIndex }
}

function phoneRowRange(sheetTitle: string, rowIndex: number) {
  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const sheetRow = rowIndex + 1
  return `'${escapedTitle}'!A${sheetRow}:B${sheetRow}`
}

async function getPhoneTabRows() {
  try {
    const sheet = await getAuthenticatedSheetRows(PHONE_TAB)
    if (
      sheet.rows.length > 0 &&
      (sheet.rows[0][0] !== PHONE_TAB_HEADERS[0] || sheet.rows[0][1] !== PHONE_TAB_HEADERS[1])
    ) {
      throw new Error(`L’onglet « ${PHONE_TAB} » existe mais ses en-têtes sont inattendus.`)
    }
    return sheet
  } catch (error) {
    if (error instanceof Error && error.message === 'Aucun onglet Google Sheets trouvé.') {
      throw new PhoneMigrationRequiredError()
    }
    throw error
  }
}

export async function getEducatorPhones() {
  const { rows } = await getPhoneTabRows()
  if (rows.length === 0) throw new PhoneMigrationRequiredError()
  const phones: Array<{ number: number; phone: string }> = []

  for (const row of rows.slice(1)) {
    const number = Number.parseInt(row[0] ?? '', 10)
    const phone = row[1]?.trim()
    if (Number.isNaN(number) || !phone) continue
    phones.push({ number, phone })
  }

  return phones
}

export async function migrateEducatorPhones() {
  const { rows: sourceRows } = await getAuthenticatedSheetRows('Joueurs')
  const { headerIndex, phoneIndex, numberIndex } = getPhoneSheetLayout(sourceRows)
  let destination: Awaited<ReturnType<typeof getAuthenticatedSheetRows>>
  try {
    destination = await getPhoneTabRows()
  } catch (error) {
    if (!(error instanceof PhoneMigrationRequiredError)) throw error
    await ensureAuthenticatedSheetTab(PHONE_TAB)
    destination = { sheetTitle: PHONE_TAB, rows: [] }
  }

  const updates: Array<{ range: string; values: string[][] }> = []
  if (destination.rows.length === 0) {
    updates.push({
      range: phoneRowRange(destination.sheetTitle, 0),
      values: [PHONE_TAB_HEADERS],
    })
  }

  const destinationRows = destination.rows
  const destinationByNumber = new Map<number, { rowIndex: number; phone: string }>()
  let nextRowIndex = Math.max(destinationRows.length, 1)
  destinationRows.slice(1).forEach((row, offset) => {
    const number = Number.parseInt(row[0] ?? '', 10)
    const phone = row[1]?.trim()
    if (!Number.isNaN(number) && phone) {
      if (destinationByNumber.has(number)) {
        throw new Error(`Le numéro de joueur ${number} apparaît plusieurs fois dans l’onglet protégé.`)
      }
      destinationByNumber.set(number, { rowIndex: offset + 1, phone })
    }
  })

  let migratedCount = 0
  sourceRows.slice(headerIndex + 1).forEach((row, offset) => {
    const number = Number.parseInt(row[numberIndex] ?? '', 10)
    const phone = row[phoneIndex]?.trim()
    if (Number.isNaN(number) || !phone) return

    const existing = destinationByNumber.get(number)
    let destinationPhone = existing?.phone
    let targetRowIndex = existing?.rowIndex
    if (!destinationPhone) {
      destinationPhone = phone
      targetRowIndex = nextRowIndex
      nextRowIndex += 1
      destinationByNumber.set(number, { rowIndex: targetRowIndex, phone: destinationPhone })
      migratedCount += 1
    }
    if (targetRowIndex === undefined) throw new Error('Ligne du téléphone protégé introuvable.')
    updates.push({
      range: phoneRowRange(destination.sheetTitle, targetRowIndex),
      values: [[String(number), destinationPhone]],
    })
  })

  if (updates.length > 0) await updateAuthenticatedSheetValues(updates)
  return migratedCount
}

export async function updateEducatorPhone(number: number, phone: string) {
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Numéro de joueur invalide.')
  if (phone.length > 80) throw new Error('Le numéro de téléphone est trop long.')

  const { sheetTitle, rows } = await getPhoneTabRows()
  const rowIndex = rows.findIndex((row, index) => index > 0 && Number.parseInt(row[0] ?? '', 10) === number)
  const destinationRow = rowIndex < 0 ? rows.length : rowIndex

  const value = phone.trim()
  await updateAuthenticatedSheetValues([{
    range: phoneRowRange(sheetTitle, destinationRow),
    values: [[String(number), value]],
  }])
}
