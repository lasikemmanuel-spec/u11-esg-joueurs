export type WhatsAppGroup = {
  id: string
  name: string
  teamFilter: 'E1' | 'E2' | 'both' | 'none'
  description?: string
  chatLink?: string
  isDefault?: boolean
}

export type WhatsAppTemplate = {
  id: string
  title: string
  category: 'match' | 'training' | 'info' | 'custom'
  icon?: string
  defaultGroupId?: string
  content: string
}

export type MessageVariablesContext = {
  teamName?: string
  opponent?: string
  dateLabel?: string
  competition?: string
  homeAway?: string
  kickoffTime?: string
  meetingTime?: string
  venueAddress?: string
  calledPlayerNames?: string[]
  temperature?: number | null
  scoreFor?: number
  scoreAgainst?: number
}

export const DEFAULT_WHATSAPP_GROUPS: WhatsAppGroup[] = [
  {
    id: 'grp-e1',
    name: '🔵 U11 - Équipe 1',
    teamFilter: 'E1',
    description: 'Parents et joueurs de l’Équipe 1',
    isDefault: true,
  },
  {
    id: 'grp-e2',
    name: '🟡 U11 - Équipe 2',
    teamFilter: 'E2',
    description: 'Parents et joueurs de l’Équipe 2',
    isDefault: true,
  },
  {
    id: 'grp-parents',
    name: '👨‍👩‍👧‍👦 U11 - Parents (Général)',
    teamFilter: 'both',
    description: 'Toutes les familles de la catégorie U11',
    isDefault: true,
  },
  {
    id: 'grp-staff',
    name: '⚽ Staff Éducateurs U11',
    teamFilter: 'none',
    description: 'Éducateurs et dirigeants U11',
    isDefault: true,
  },
]

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-convocation',
    title: 'Convocation de match',
    category: 'match',
    icon: '📣',
    defaultGroupId: 'auto',
    content: [
      'Bonjour à tous,',
      '📣 Match de {equipe} contre {adversaire}',
      '📅 {date}',
      '🏆 {competition}',
      '📍 {lieu}',
      '{heure_match}',
      '{heure_rdv}',
      '{adresse}',
      '👥 Joueurs convoqués :\n{convoques}',
      '🎒 Merci de ne pas oublier :\n{sac}',
      'La Team U11',
    ].join('\n'),
  },
  {
    id: 'tpl-resultat',
    title: 'Résultat & Bilan du match',
    category: 'match',
    icon: '🎉',
    defaultGroupId: 'auto',
    content: [
      'Bonjour à tous,',
      '⚽ Fin du match pour {equipe} contre {adversaire} !',
      '📊 Score final : {score}',
      '👏 Bravo à tous les joueurs pour l’engagement, le respect des consignes et le bel état d’esprit sur le terrain.',
      'Merci aux parents pour les encouragements au bord de la touche ! 🔴⚪',
      'Bon week-end à tous,',
      'La Team U11',
    ].join('\n'),
  },
  {
    id: 'tpl-entrainement',
    title: 'Rappel entraînement',
    category: 'training',
    icon: '⚽',
    defaultGroupId: 'grp-parents',
    content: [
      'Bonjour à tous,',
      '⚽ Rappel séance d’entraînement ce {date} à Genech.',
      '🕒 Rendez-vous aux vestiaires à 17h45 (début sur le terrain à 18h00).',
      '🎒 Pensez à la gourde d’eau, aux protège-tibias et à une tenue adaptée à la météo.',
      'En cas d’absence, merci de prévenir un éducateur dès que possible.',
      'À tout à l’heure !',
      'La Team U11',
    ].join('\n'),
  },
  {
    id: 'tpl-annulation',
    title: 'Annulation / Intempéries',
    category: 'info',
    icon: '🌧️',
    defaultGroupId: 'grp-parents',
    content: [
      '⚠️ INFORMATION IMPORTANTE U11 ⚠️',
      'Bonjour à tous,',
      'En raison des conditions météo défavorables et de l’état du terrain (arrêté municipal), la séance / le match prévu le {date} est ANNULÉ(E).',
      'Nous vous tiendrons informés pour la suite du programme.',
      'Merci de votre compréhension,',
      'La Team U11',
    ].join('\n'),
  },
  {
    id: 'tpl-tournoi',
    title: 'Journée de tournoi / Plateau',
    category: 'match',
    icon: '🏆',
    defaultGroupId: 'grp-parents',
    content: [
      'Bonjour à tous,',
      '🏆 Ce week-end nos U11 participent au {competition} !',
      '📅 {date}',
      '📍 Lieu : {lieu}',
      '{heure_rdv}',
      '👥 Joueurs convoqués :\n{convoques}',
      '🥪 Prévoir le pique-nique pour le midi ainsi que la tenue de rechange et une gourde.',
      'On compte sur votre soutien au bord des terrains ! 🔥',
      'La Team U11',
    ].join('\n'),
  },
]

const STORAGE_GROUPS_KEY = 'esg_whatsapp_groups_v1'
const STORAGE_TEMPLATES_KEY = 'esg_whatsapp_templates_v1'

export function getStoredWhatsAppGroups(): WhatsAppGroup[] {
  if (typeof window === 'undefined') return DEFAULT_WHATSAPP_GROUPS
  try {
    const raw = window.localStorage.getItem(STORAGE_GROUPS_KEY)
    if (!raw) return DEFAULT_WHATSAPP_GROUPS
    const parsed = JSON.parse(raw) as WhatsAppGroup[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WHATSAPP_GROUPS
  } catch {
    return DEFAULT_WHATSAPP_GROUPS
  }
}

export function saveStoredWhatsAppGroups(groups: WhatsAppGroup[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_GROUPS_KEY, JSON.stringify(groups))
  } catch {
    // quota ou erreur
  }
}

export function getStoredWhatsAppTemplates(): WhatsAppTemplate[] {
  if (typeof window === 'undefined') return DEFAULT_WHATSAPP_TEMPLATES
  try {
    const raw = window.localStorage.getItem(STORAGE_TEMPLATES_KEY)
    if (!raw) return DEFAULT_WHATSAPP_TEMPLATES
    const parsed = JSON.parse(raw) as WhatsAppTemplate[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WHATSAPP_TEMPLATES
  } catch {
    return DEFAULT_WHATSAPP_TEMPLATES
  }
}

export function saveStoredWhatsAppTemplates(templates: WhatsAppTemplate[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_TEMPLATES_KEY, JSON.stringify(templates))
  } catch {
    // quota ou erreur
  }
}

export function buildKitList(temperature: number | null): string {
  const items = [
    '• Short',
    '• Chaussettes',
    '• Tenue de Genech',
    '• Protège-tibias',
    '• Gourde',
  ]
  if (temperature !== null && temperature < 10) {
    items.push('• Gants / Sous-maillot chaud')
  }
  return items.join('\n')
}

export function replaceMessageVariables(
  templateContent: string,
  context: MessageVariablesContext,
): string {
  const teamName = context.teamName || 'ES Genech'
  const opponent = context.opponent || 'adversaire à préciser'
  const dateLabel = context.dateLabel || 'samedi'
  const competition = context.competition || 'Rencontre'
  const lieu = context.homeAway || 'Lieu à préciser'
  const kickoffTime = context.kickoffTime ? `🕒 Coup d'envoi : ${context.kickoffTime}` : ''
  const meetingTime = context.meetingTime ? `🤝 Rendez-vous au stade : ${context.meetingTime}` : ''
  const venueAddress = context.venueAddress ? `📍 Adresse du stade : ${context.venueAddress}` : ''
  const convoques = context.calledPlayerNames && context.calledPlayerNames.length > 0
    ? context.calledPlayerNames.map((n) => `• ${n}`).join('\n')
    : 'Liste à compléter'
  const sac = buildKitList(context.temperature ?? null)
  const score = context.scoreFor !== undefined && context.scoreAgainst !== undefined
    ? `${context.scoreFor} - ${context.scoreAgainst}`
    : 'Score à renseigner'

  let text = templateContent
    .replace(/\{equipe\}/g, teamName)
    .replace(/\{adversaire\}/g, opponent)
    .replace(/\{date\}/g, dateLabel)
    .replace(/\{competition\}/g, competition)
    .replace(/\{lieu\}/g, lieu)
    .replace(/\{heure_match\}/g, kickoffTime)
    .replace(/\{heure_rdv\}/g, meetingTime)
    .replace(/\{adresse\}/g, venueAddress)
    .replace(/\{convoques\}/g, convoques)
    .replace(/\{sac\}/g, sac)
    .replace(/\{score\}/g, score)

  // Nettoyer les lignes vides superflues résultant de variables non renseignées
  text = text.replace(/\n{3,}/g, '\n\n').trim()
  return text
}

export function buildWhatsAppLink(text: string, groupLink?: string): string {
  const isDesktop = typeof navigator !== 'undefined' && !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const baseUrl = isDesktop ? 'https://web.whatsapp.com/send?text=' : 'https://wa.me/?text='
  return `${baseUrl}${encodeURIComponent(text)}`
}
