import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import type { LiveMatchSession, LiveMatchSummary } from '@/lib/live-match-shared'
import { MATCH_TABS, type MatchSheetEntry } from '@/lib/match-results'

const LIVE_MATCH_TAB = '⚽ Matchs en direct'
const LIVE_MATCH_HEADERS = ['Clé du match', 'Date', 'Équipe', 'Colonne', 'Données live']

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

function sessionKey(session: Pick<LiveMatchSession, 'date' | 'team' | 'slotColumn'>) {
  return `${dateKey(session.date)}-${session.team}-${session.slotColumn}`
}

async function getLiveRows(options: { cacheForSeconds?: number } = {}) {
  await ensureAuthenticatedSheetTab(LIVE_MATCH_TAB)
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(LIVE_MATCH_TAB, options)
  if (rows.length === 0 || !rows[0].some(Boolean)) {
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:E1`,
      values: [LIVE_MATCH_HEADERS],
    }])
    return { sheetTitle, rows: [LIVE_MATCH_HEADERS, ...rows.slice(1)] }
  }
  return { sheetTitle, rows }
}

export async function getSavedLiveMatch(
  match: Pick<MatchSheetEntry, 'date' | 'team' | 'slotColumn'>,
  options: { cacheForSeconds?: number } = {},
) {
  const { rows } = await getLiveRows(options)
  const key = sessionKey({ ...match, date: match.date })
  const row = rows.find((item, index) => index > 0 && item[0] === key)
  if (!row?.[4]) return null
  try {
    return JSON.parse(row[4]) as LiveMatchSession
  } catch (error) {
    console.error('Les données sauvegardées du match en direct sont illisibles:', error)
    throw new Error('Les données sauvegardées de ce match sont illisibles.')
  }
}

export async function getSavedLiveMatches(options: { cacheForSeconds?: number } = {}) {
  const { rows } = await getLiveRows(options)
  return rows.flatMap((row, index) => {
    if (index === 0 || !row[4]) return []
    try {
      return [JSON.parse(row[4]) as LiveMatchSession]
    } catch (error) {
      console.error('Les données sauvegardées du match en direct sont illisibles:', error)
      throw new Error('Les données sauvegardées d’un match en direct sont illisibles.')
    }
  })
}

export async function saveLiveMatchSession(session: LiveMatchSession) {
  const { sheetTitle, rows } = await getLiveRows()
  const key = sessionKey(session)
  const existingIndex = rows.findIndex((row, index) => index > 0 && row[0] === key)
  const rowIndex = existingIndex >= 0 ? existingIndex : rows.length
  const escapedTitle = sheetTitle.replace(/'/g, "''")
  await updateAuthenticatedSheetValues([{
    range: `'${escapedTitle}'!A${rowIndex + 1}:E${rowIndex + 1}`,
    values: [[key, session.date, session.team, String(session.slotColumn), JSON.stringify(session)]],
  }])
}

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR').replace(/[^a-z]/g, '')
}

function dateKey(value: string) {
  const iso = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const french = value.trim().match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (french) return `${french[3]}-${french[2].padStart(2, '0')}-${french[1].padStart(2, '0')}`
  return ''
}

function findMatchRows(rows: string[][], match: LiveMatchSession) {
  const dateRowIndex = rows.findIndex((row) =>
    row.some((value, column) => column >= 2 && dateKey(value) !== ''),
  )
  if (dateRowIndex < 1 || dateKey(rows[dateRowIndex]?.[match.slotColumn] ?? '') !== match.date) {
    throw new Error('La date du match ne correspond plus à la colonne de sa feuille.')
  }
  const roleHeaderRowIndex = rows.findIndex((row) =>
    normalizeHeader(row[match.slotColumn] ?? '') === 'titrem',
  )
  if (roleHeaderRowIndex < 0) throw new Error('Les colonnes de la feuille de match sont introuvables.')
  const headers = rows[roleHeaderRowIndex]
  if (
    normalizeHeader(headers[match.slotColumn + 1] ?? '') !== 'mn' ||
    normalizeHeader(headers[match.slotColumn + 2] ?? '') !== 'but' ||
    normalizeHeader(headers[match.slotColumn + 3] ?? '') !== 'passe'
  ) {
    throw new Error('Les colonnes Tit/Rem, MN, BUT et PASSE ne sont pas dans l’ordre attendu. Aucune donnée n’a été modifiée.')
  }
  const playerRows = new Map<number, number>()
  for (let rowIndex = roleHeaderRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const number = Number.parseInt(rows[rowIndex][0] ?? '', 10)
    if (!Number.isSafeInteger(number) || !rows[rowIndex][1]?.trim()) continue
    if (playerRows.has(number)) throw new Error(`Le joueur n°${number} apparaît plusieurs fois dans la feuille.`)
    playerRows.set(number, rowIndex)
  }
  return { dateRowIndex, playerRows }
}

export async function finalizeLiveMatch(session: LiveMatchSession, summary: LiveMatchSummary) {
  const tab = MATCH_TABS[session.team]
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(tab)
  const { dateRowIndex, playerRows } = findMatchRows(rows, session)
  const resultRow = dateRowIndex + 3
  const goalsForRow = dateRowIndex + 4
  const goalsAgainstRow = dateRowIndex + 5
  const existingScore = [
    rows[resultRow]?.[session.slotColumn] ?? '',
    rows[goalsForRow]?.[session.slotColumn] ?? '',
    rows[goalsAgainstRow]?.[session.slotColumn] ?? '',
  ]
  const outcome = summary.goalsFor > summary.goalsAgainst
    ? 'Gagné'
    : summary.goalsFor < summary.goalsAgainst
      ? 'Perdu'
      : 'Nul'
  const expectedScore = [outcome, String(summary.goalsFor), String(summary.goalsAgainst)]
  const scoreAlreadySaved = existingScore.every((value, index) => value === expectedScore[index])
  if (existingScore.some(Boolean) && !scoreAlreadySaved) {
    throw new Error('Un résultat existe déjà dans cette feuille. Vérifie-le avant de remplacer les données.')
  }

  const escapedTitle = sheetTitle.replace(/'/g, "''")
  const updates: Array<{ range: string; values: string[][] }> = []
  const cellRange = (column: number, rowIndex: number) =>
    `'${escapedTitle}'!${columnName(column)}${rowIndex + 1}`
  if (!scoreAlreadySaved) {
    updates.push(
      { range: cellRange(session.slotColumn, resultRow), values: [[outcome]] },
      { range: cellRange(session.slotColumn, goalsForRow), values: [[String(summary.goalsFor)]] },
      { range: cellRange(session.slotColumn, goalsAgainstRow), values: [[String(summary.goalsAgainst)]] },
    )
  }

  for (const player of summary.players) {
    const rowIndex = playerRows.get(player.number)
    if (rowIndex === undefined) {
      throw new Error(`Le joueur n°${player.number} est introuvable dans la feuille ${session.team}.`)
    }
    const values = [String(player.minutes), String(player.goals), String(player.assists)]
    const currentValues = [1, 2, 3].map((offset) => rows[rowIndex][session.slotColumn + offset] ?? '')
    if (currentValues.some(Boolean) && !currentValues.every((value, index) => value === values[index])) {
      throw new Error(`Des statistiques existent déjà pour le joueur n°${player.number}. Aucune statistique n’a été remplacée.`)
    }
    if (currentValues.every((value, index) => value === values[index])) continue
    values.forEach((value, index) => {
      updates.push({
        range: cellRange(session.slotColumn + index + 1, rowIndex),
        values: [[value]],
      })
    })
  }

  if (updates.length > 0) await updateAuthenticatedSheetValues(updates)
}
