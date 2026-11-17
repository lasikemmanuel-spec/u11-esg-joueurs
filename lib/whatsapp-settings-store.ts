import 'server-only'
import {
  ensureAuthenticatedSheetTab,
  getAuthenticatedSheetRows,
  updateAuthenticatedSheetValues,
} from '@/lib/google-sheets'
import {
  DEFAULT_WHATSAPP_GROUPS,
  DEFAULT_WHATSAPP_TEMPLATES,
  type WhatsAppGroup,
  type WhatsAppTemplate,
} from '@/lib/whatsapp-messages'
import {
  decryptWhatsAppSettings,
  encryptWhatsAppSettings,
  isEncryptedWhatsAppSettings,
} from '@/lib/whatsapp-crypto'

export type WhatsAppSettings = {
  groups: WhatsAppGroup[]
  templates: WhatsAppTemplate[]
}

const SETTINGS_TAB = 'Configuration WhatsApp'
const SETTINGS_HEADERS = ['Paramètre', 'Valeur']

function isTeamFilter(value: unknown): value is WhatsAppGroup['teamFilter'] {
  return value === 'E1' || value === 'E2' || value === 'both' || value === 'none'
}

export function isWhatsAppSettings(value: unknown): value is WhatsAppSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const settings = value as Record<string, unknown>
  if (!Array.isArray(settings.groups) || !Array.isArray(settings.templates)) return false
  if (settings.groups.length > 100 || settings.templates.length > 100) return false

  const validGroups = settings.groups.every((group) => {
    if (typeof group !== 'object' || group === null || Array.isArray(group)) return false
    const item = group as Record<string, unknown>
    return typeof item.id === 'string' &&
      item.id.length > 0 && item.id.length <= 100 &&
      typeof item.name === 'string' &&
      item.name.trim().length > 0 && item.name.length <= 120 &&
      isTeamFilter(item.teamFilter) &&
      (item.description === undefined || (typeof item.description === 'string' && item.description.length <= 240)) &&
      (item.chatLink === undefined || (typeof item.chatLink === 'string' && item.chatLink.length <= 500)) &&
      (item.isDefault === undefined || typeof item.isDefault === 'boolean')
  })
  const validTemplates = settings.templates.every((template) => {
    if (typeof template !== 'object' || template === null || Array.isArray(template)) return false
    const item = template as Record<string, unknown>
    return typeof item.id === 'string' &&
      item.id.length > 0 && item.id.length <= 100 &&
      typeof item.title === 'string' &&
      item.title.trim().length > 0 && item.title.length <= 120 &&
      (item.category === 'match' || item.category === 'training' || item.category === 'info' || item.category === 'custom') &&
      (item.icon === undefined || (typeof item.icon === 'string' && item.icon.length <= 20)) &&
      (item.defaultGroupId === undefined || (typeof item.defaultGroupId === 'string' && item.defaultGroupId.length <= 100)) &&
      typeof item.content === 'string' &&
      item.content.trim().length > 0 && item.content.length <= 10_000
  })
  return validGroups && validTemplates
}

async function getSettingsRows() {
  await ensureAuthenticatedSheetTab(SETTINGS_TAB)
  const { sheetTitle, rows } = await getAuthenticatedSheetRows(SETTINGS_TAB)
  if (rows.length === 0 || !rows[0].some(Boolean)) {
    const defaults: WhatsAppSettings = {
      groups: DEFAULT_WHATSAPP_GROUPS,
      templates: DEFAULT_WHATSAPP_TEMPLATES,
    }
    const encryptedInitialRows = [SETTINGS_HEADERS, ['Configuration', encryptWhatsAppSettings(defaults)]]
    await updateAuthenticatedSheetValues([{
      range: `'${sheetTitle.replace(/'/g, "''")}'!A1:B2`,
      values: encryptedInitialRows,
    }])
    return { sheetTitle, rows: encryptedInitialRows }
  }
  return { sheetTitle, rows }
}

export async function getSavedWhatsAppSettings(): Promise<WhatsAppSettings> {
  const { sheetTitle, rows } = await getSettingsRows()
  const raw = rows.find((row, index) => index > 0 && row[0] === 'Configuration')?.[1]
  if (!raw) {
    return { groups: DEFAULT_WHATSAPP_GROUPS, templates: DEFAULT_WHATSAPP_TEMPLATES }
  }
  try {
    let settings: unknown
    if (isEncryptedWhatsAppSettings(raw)) {
      settings = decryptWhatsAppSettings(raw)
    } else {
      settings = JSON.parse(raw)
      await updateAuthenticatedSheetValues([{
        range: `'${sheetTitle.replace(/'/g, "''")}'!A1:B2`,
        values: [SETTINGS_HEADERS, ['Configuration', encryptWhatsAppSettings(settings)]],
      }])
    }
    if (!isWhatsAppSettings(settings)) throw new Error('Configuration WhatsApp invalide.')
    return settings
  } catch (error) {
    console.error('Configuration WhatsApp illisible:', error)
    throw new Error('Configuration WhatsApp illisible.')
  }
}

export async function saveWhatsAppSettings(settings: WhatsAppSettings) {
  if (!isWhatsAppSettings(settings)) throw new Error('Configuration WhatsApp invalide.')
  const { sheetTitle } = await getSettingsRows()
  await updateAuthenticatedSheetValues([{
    range: `'${sheetTitle.replace(/'/g, "''")}'!A1:B2`,
    values: [SETTINGS_HEADERS, ['Configuration', encryptWhatsAppSettings(settings)]],
  }])
}
