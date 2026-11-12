import 'server-only'
import { getAuthenticatedSheetRows, updateAuthenticatedSheetValues } from '@/lib/google-sheets'
import type { CallupSelection } from '@/lib/convocation-management'
import { MATCH_TABS, type MatchSheetEntry } from '@/lib/match-results'

export type MatchLineup = {
  date: string
  team: 'E1' | 'E2'
  slotColumn: number
  starters: number[]
  substitutes: number[]
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('fr-FR')
}

function dateKey(value: string) {
  const iso = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const dayFirst = value.trim().match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
  return ''
}

function isMatchDate(value: string) {
  return Boolean(dateKey(value))
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

function isRoleHeader(value: string) {
  return normalize(value).replace(/\s/g, '') === 'tit/rem'
}

function locateMatch(rows: string[][], match: Pick<MatchSheetEntry, 'date' | 'slotColumn'>) {
  const dateRowIndex = rows.findIndex((row) =>
    row.some((value, column) => column >= 2 && isMatchDate(value)),
  )
  if (dateRowIndex < 0 || dateKey(rows[dateRowIndex]?.[match.slotColumn] ?? '') !== dateKey(match.date)) {
    throw new Error('La date du match ne correspond plus à la colonne de sa feuille.')
  }

  const roleHeaderRowIndex = rows.findIndex((row) => isRoleHeader(row[match.slotColumn] ?? ''))
  if (roleHeaderRowIndex < 0) {
    throw new Error('La colonne « Tit / Rem » est introuvable pour ce match.')
  }
  return roleHeaderRowIndex
}

function playerRows(rows: string[][]) {
  const byNumber = new Map<number, number>()
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const number = Number.parseInt(rows[rowIndex][0] ?? '', 10)
    if (!Number.isSafeInteger(number) || !rows[rowIndex][1]?.trim()) continue
    if (byNumber.has(number)) {
      throw new Error(`Le joueur n°${number} apparaît plusieurs fois dans la feuille de match.`)
    }
    byNumber.set(number, rowIndex)
  }
  return byNumber
}

function matchKey(match: Pick<MatchLineup, 'date' | 'team' | 'slotColumn'>) {
  return `${match.date}-${match.team}-${match.slotColumn}`
}

export async function getMatchLineups(
  matches: MatchSheetEntry[],
  options: { cacheForSeconds?: number } = {},
): Promise<MatchLineup[]> {
  const rowsByTeam = new Map<'E1' | 'E2', string[][]>()
  for (const team of ['E1', 'E2'] as const) {
    if (!matches.some((match) => match.team === team)) continue
    const { rows } = await getAuthenticatedSheetRows(MATCH_TABS[team], options)
    rowsByTeam.set(team, rows)
  }

  return matches
    .filter((match) => match.date && match.resultLabel !== 'Annulé')
    .map((match) => {
      const rows = rowsByTeam.get(match.team)
      if (!rows) throw new Error(`Feuille de match ${match.team} indisponible.`)
      locateMatch(rows, match)
      const players = playerRows(rows)
      const starters: number[] = []
      const substitutes: number[] = []
      for (const [number, rowIndex] of players) {
        const role = normalize(rows[rowIndex][match.slotColumn] ?? '')
        if (role === 'titulaire') starters.push(number)
        if (role === 'remplacant') substitutes.push(number)
      }
      return {
        date: dateKey(match.date),
        team: match.team,
        slotColumn: match.slotColumn,
        starters,
        substitutes,
      }
    })
    .filter((lineup, index, lineups) =>
      lineups.findIndex((candidate) => matchKey(candidate) === matchKey(lineup)) === index,
    )
}

async function writeMatchRoles(
  match: Pick<MatchLineup, 'date' | 'team' | 'slotColumn'>,
  valuesByPlayer: Map<number, string>,
) {
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(MATCH_TABS[match.team])
  locateMatch(rows, match)
  const rowByPlayer = playerRows(rows)
  const updates: Array<{ range: string; values: string[][] }> = []
  for (const [number, value] of valuesByPlayer) {
    const rowIndex = rowByPlayer.get(number)
    if (rowIndex === undefined) {
      throw new Error(`Le joueur n°${number} est introuvable dans la feuille de match ${match.team}.`)
    }
    updates.push({
      range: `'${sheetTitle.replace(/'/g, "''")}'!${columnName(match.slotColumn)}${rowIndex + 1}`,
      values: [[value]],
    })
  }
  if (updates.length > 0) await updateAuthenticatedSheetValues(updates)
}

export async function syncMatchLineupsWithCallups(
  date: string,
  matches: MatchSheetEntry[],
  selections: CallupSelection[],
) {
  for (const match of matches.filter((entry) => dateKey(entry.date) === date && entry.resultLabel !== 'Annulé')) {
    const { rows } = await getAuthenticatedSheetRows(MATCH_TABS[match.team])
    locateMatch(rows, match)
    const rowByPlayer = playerRows(rows)
    const updates = new Map<number, string>()
    for (const selection of selections) {
      if (!rowByPlayer.has(selection.number)) {
        throw new Error(`Le joueur n°${selection.number} est introuvable dans la feuille de match ${match.team}.`)
      }
      const currentRole = normalize(rows[rowByPlayer.get(selection.number)!][match.slotColumn] ?? '')
      const isCalledForTeam = selection.status === `✅ Convoqué ${match.team}` ||
        selection.status === '✅ Convoqué E1 + E2' ||
        selection.status === `✅ Confirmé ${match.team}` ||
        selection.status === '✅ Confirmé E1 + E2'
      updates.set(
        selection.number,
        !isCalledForTeam
          ? 'N/A'
          : currentRole === 'titulaire' || currentRole === 'remplacant'
            ? rows[rowByPlayer.get(selection.number)!][match.slotColumn]
            : '',
      )
    }
    await writeMatchRoles(match, updates)
  }
}

export async function saveMatchLineup(
  lineup: MatchLineup,
  calledPlayerNumbers: Set<number>,
  allPlayerNumbers: number[],
) {
  if (
    lineup.starters.length > 8 ||
    [...lineup.starters, ...lineup.substitutes].some((number) => !calledPlayerNumbers.has(number)) ||
    new Set([...lineup.starters, ...lineup.substitutes]).size !== lineup.starters.length + lineup.substitutes.length
  ) {
    throw new Error('Choisis uniquement des joueurs convoqués, sans doublon et avec 8 titulaires maximum.')
  }

  const roles = new Map<number, string>()
  for (const number of allPlayerNumbers) {
    roles.set(
      number,
      !calledPlayerNumbers.has(number)
        ? 'N/A'
        : lineup.starters.includes(number)
          ? 'Titulaire'
          : lineup.substitutes.includes(number)
            ? 'Remplaçant'
            : '',
    )
  }
  await writeMatchRoles(lineup, roles)
  return lineup
}
