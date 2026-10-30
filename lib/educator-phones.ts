import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import { decryptPhone, encryptPhone, isEncryptedPhone } from '@/lib/phone-crypto'

const PHONE_TAB = 'Téléphones éducateurs'
const PHONE_TAB_HEADERS = ['Numéro joueur', 'Téléphone existant', 'Téléphone père', 'Téléphone mère']
const LEGACY_PHONE_TAB_HEADERS = ['Numéro joueur', 'Téléphone']

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

function phoneCellRange(sheetTitle: string, rowIndex: number, columnIndex: number) {
  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const sheetRow = rowIndex + 1
  let column = ''
  for (let value = columnIndex + 1; value > 0; value = Math.floor((value - 1) / 26)) {
    column = String.fromCharCode(65 + ((value - 1) % 26)) + column
  }
  return `'${escapedTitle}'!${column}${sheetRow}`
}

async function getPhoneTabRows() {
  try {
    const sheet = await getAuthenticatedSheetRows(PHONE_TAB)
    const header = sheet.rows[0] ?? []
    const validHeader =
      header[0] === PHONE_TAB_HEADERS[0] &&
      ((header[1] === PHONE_TAB_HEADERS[1] && header[2] === PHONE_TAB_HEADERS[2] && header[3] === PHONE_TAB_HEADERS[3]) ||
        header[1] === LEGACY_PHONE_TAB_HEADERS[1])
    if (sheet.rows.length > 0 && !validHeader) {
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
  const phones: Array<{ number: number; legacyPhone: string; fatherPhone: string; motherPhone: string }> = []

  for (const row of rows.slice(1)) {
    const number = Number.parseInt(row[0] ?? '', 10)
    const legacyPhone = decryptPhone(row[1]?.trim() ?? '').trim()
    const fatherPhone = decryptPhone(row[2]?.trim() ?? '').trim()
    const motherPhone = decryptPhone(row[3]?.trim() ?? '').trim()
    if (Number.isNaN(number)) continue
    phones.push({ number, legacyPhone, fatherPhone, motherPhone })
  }

  return phones
}

export async function migrateEducatorPhones() {
  const source = await getAuthenticatedSheetRows('Joueurs')
  const { rows: sourceRows, sheetTitle: sourceSheetTitle } = source
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
  if (destination.rows.length === 0 || destination.rows[0]?.[1] === LEGACY_PHONE_TAB_HEADERS[1]) {
    updates.push({
      range: "'" + destination.sheetTitle.replace(/'/g, "''") + "'!A1:D1",
      values: [PHONE_TAB_HEADERS],
    })
  }

  const destinationRows = destination.rows
  const destinationByNumber = new Map<number, { rowIndex: number; phone: string; storedPhone: string }>()
  let nextRowIndex = Math.max(destinationRows.length, 1)
  destinationRows.slice(1).forEach((row, offset) => {
    const number = Number.parseInt(row[0] ?? '', 10)
    const storedPhone = row[1]?.trim() ?? ''
    const phone = decryptPhone(storedPhone).trim()
    if (Number.isNaN(number)) {
      if (storedPhone && !isEncryptedPhone(storedPhone)) {
        updates.push({
          range: phoneCellRange(destination.sheetTitle, offset + 1, 1),
          values: [[encryptPhone(phone)]],
        })
      }
      return
    }
    if (destinationByNumber.has(number)) {
      throw new Error(`Le numéro de joueur ${number} apparaît plusieurs fois dans l’onglet protégé.`)
    }
    destinationByNumber.set(number, { rowIndex: offset + 1, phone, storedPhone })
  })

  let migratedCount = 0
  const sourceNumbers = new Set<number>()
  sourceRows.slice(headerIndex + 1).forEach((row, offset) => {
    const number = Number.parseInt(row[numberIndex] ?? '', 10)
    const storedSourcePhone = row[phoneIndex]?.trim() ?? ''
    const sourcePhone = decryptPhone(storedSourcePhone).trim()
    if (!sourcePhone) return
    if (Number.isNaN(number)) {
      if (!isEncryptedPhone(storedSourcePhone)) {
        updates.push({
          range: phoneCellRange(sourceSheetTitle, headerIndex + offset + 1, phoneIndex),
          values: [[encryptPhone(sourcePhone)]],
        })
      }
      return
    }
    if (sourceNumbers.has(number)) {
      throw new Error(`Le numéro de joueur ${number} apparaît plusieurs fois dans l’effectif.`)
    }
    sourceNumbers.add(number)

    const existing = destinationByNumber.get(number)
    const phone = existing?.phone || sourcePhone
    let destinationRowIndex = existing?.rowIndex
    if (!existing) {
      destinationRowIndex = nextRowIndex
      nextRowIndex += 1
      migratedCount += 1
      destinationByNumber.set(number, {
        rowIndex: destinationRowIndex,
        phone,
        storedPhone: '',
      })
    }
    if (destinationRowIndex === undefined) throw new Error('Ligne du téléphone protégé introuvable.')

    const destinationRecord = destinationByNumber.get(number)
    if (!destinationRecord) throw new Error('Ligne du téléphone protégé introuvable.')
    if (!isEncryptedPhone(destinationRecord.storedPhone)) {
      const encryptedDestinationPhone = encryptPhone(phone)
      updates.push({
        range: phoneCellRange(destination.sheetTitle, destinationRowIndex, 1),
        values: [[encryptedDestinationPhone]],
      })
      destinationRecord.storedPhone = encryptedDestinationPhone
    }
    if (!isEncryptedPhone(storedSourcePhone) || sourcePhone !== phone) {
      updates.push({
        range: phoneCellRange(sourceSheetTitle, headerIndex + offset + 1, phoneIndex),
        values: [[encryptPhone(phone)]],
      })
    }
  })

  for (const record of destinationByNumber.values()) {
    if (!record.phone || isEncryptedPhone(record.storedPhone)) continue
    const encryptedPhone = encryptPhone(record.phone)
    updates.push({
      range: phoneCellRange(destination.sheetTitle, record.rowIndex, 1),
      values: [[encryptedPhone]],
    })
    record.storedPhone = encryptedPhone
  }

  if (updates.length > 0) await updateAuthenticatedSheetValues(updates)
  return migratedCount
}

export async function updateEducatorParentPhones(number: number, fatherPhone: string, motherPhone: string) {
  if (!Number.isSafeInteger(number) || number < 0) throw new Error('Numéro de joueur invalide.')
  if (fatherPhone.length > 80 || motherPhone.length > 80) throw new Error('Le numéro de téléphone est trop long.')

  const { sheetTitle, rows } = await getPhoneTabRows()
  const destinationRow = rows.findIndex(
    (row, index) => index > 0 && Number.parseInt(row[0] ?? '', 10) === number,
  )
  const destinationRowIndex = destinationRow < 0 ? rows.length : destinationRow
  const legacyPhone = destinationRow < 0 ? '' : rows[destinationRow][1] ?? ''
  const normalizedFather = fatherPhone.trim()
  const normalizedMother = motherPhone.trim()
  await updateAuthenticatedSheetValues([
    {
      range: "'" + sheetTitle.replace(/'/g, "''") + "'!A" + (destinationRowIndex + 1) + ":D" + (destinationRowIndex + 1),
      values: [[String(number), legacyPhone, encryptPhone(normalizedFather), encryptPhone(normalizedMother)]],
    },
  ])
}
