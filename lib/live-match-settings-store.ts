import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import {
  DEFAULT_LIVE_MATCH_SETTINGS,
  isLiveMatchSettings,
  type LiveMatchSettings,
} from '@/lib/live-match-settings'

const SETTINGS_TAB = '⚽ Réglages Match Direct'
const SETTINGS_HEADERS = ['Réglage', 'Valeur']

async function getSettingsRows() {
  await ensureAuthenticatedSheetTab(SETTINGS_TAB)
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(SETTINGS_TAB)
  if (rows.length === 0 || !rows[0].some(Boolean)) {
    const initialRows = [SETTINGS_HEADERS, ['Formats', JSON.stringify(DEFAULT_LIVE_MATCH_SETTINGS)]]
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:B2`,
      values: initialRows,
    }])
    return { sheetTitle, rows: initialRows }
  }
  return { sheetTitle, rows }
}

export async function getSavedLiveMatchSettings(): Promise<LiveMatchSettings> {
  const { rows } = await getSettingsRows()
  const rawSettings = rows.find((row, index) => index > 0 && row[0] === 'Formats')?.[1]
  if (!rawSettings) return DEFAULT_LIVE_MATCH_SETTINGS
  try {
    const settings: unknown = JSON.parse(rawSettings)
    if (!isLiveMatchSettings(settings)) throw new Error('Les réglages enregistrés ne sont pas valides.')
    return settings
  } catch (error) {
    console.error('Les réglages du match en direct sont illisibles:', error)
    throw new Error('Les réglages du match en direct sont illisibles.')
  }
}

export async function saveLiveMatchSettings(settings: LiveMatchSettings) {
  const { sheetTitle } = await getSettingsRows()
  await updateAuthenticatedSheetValues([{
    range: `'${sheetTitle.replace(/'/g, "''")}'!A1:B2`,
    values: [SETTINGS_HEADERS, ['Formats', JSON.stringify(settings)]],
  }])
}
