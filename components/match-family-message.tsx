'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, MessageCircle, Settings, Share2, Users, X } from 'lucide-react'
import type { MatchSheetEntry } from '@/lib/match-results'
import {
  buildWhatsAppLink,
  getStoredWhatsAppGroups,
  getStoredWhatsAppTemplates,
  replaceMessageVariables,
  type MessageVariablesContext,
  type WhatsAppGroup,
  type WhatsAppTemplate,
} from '@/lib/whatsapp-messages'
import { WhatsAppGroupManager } from '@/components/whatsapp-group-manager'

async function getMatchTemperature(match: MatchSheetEntry, date: string): Promise<number | null> {
  if ((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86_400_000 > 15) return null
  try {
    let latitude = 50.53
    let longitude = 3.22
    if (match.homeAway === 'Extérieur') {
      const ignoredClubWords = new Set(['as', 'es', 'us', 'fc', 'sc', 'rc', 'ol', 'ac', 'sa', 'football', 'club', 'sporting', 'olympique'])
      const opponentQueries = [
        match.opponent.trim(),
        ...match.opponent.trim().split(/\s+/).filter((word) =>
          word.length >= 3 && !ignoredClubWords.has(word.toLocaleLowerCase('fr-FR')),
        ),
      ].slice(0, 5)
      const queries = [...new Set([match.venueAddress?.trim(), ...opponentQueries].filter((name): name is string => Boolean(name)))]
      let place: { latitude: number; longitude: number } | undefined
      for (const name of queries) {
        const params = new URLSearchParams({ name, count: '1', language: 'fr', countryCode: 'FR', format: 'json' })
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
        if (!response.ok) continue
        const result = (await response.json()) as { results?: Array<{ latitude: number; longitude: number }> }
        place = result.results?.[0]
        if (place) break
      }
      if (!place) return null
      latitude = place.latitude
      longitude = place.longitude
    }
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: 'temperature_2m_max',
      timezone: 'Europe/Paris',
      start_date: date,
      end_date: date,
    })
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
    const result = (await response.json()) as { daily?: { time?: string[]; temperature_2m_max?: number[] } }
    const index = result.daily?.time?.indexOf(date) ?? -1
    const temperature = result.daily?.temperature_2m_max?.[index]
    return typeof temperature === 'number' ? temperature : null
  } catch {
    return null
  }
}

export function MatchFamilyMessage({
  match,
  date,
  calledPlayerNames,
}: {
  match: MatchSheetEntry
  date: string
  calledPlayerNames: string[]
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = `match-family-message-title-${match.team}-${match.slotColumn}`
  const messageId = `match-family-message-text-${match.team}-${match.slotColumn}`

  const [open, setOpen] = useState(false)
  const [showGroupManager, setShowGroupManager] = useState(false)
  const [groups, setGroups] = useState<WhatsAppGroup[]>([])
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-convocation')
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [temperature, setTemperature] = useState<number | null>(null)

  // Chargement des groupes et templates depuis le stockage
  useEffect(() => {
    const loadedGroups = getStoredWhatsAppGroups()
    const loadedTemplates = getStoredWhatsAppTemplates()
    setGroups(loadedGroups)
    setTemplates(loadedTemplates)

    // Pré-sélection intelligente du groupe correspondant à l'équipe
    const matchingGroup = loadedGroups.find((g) => g.teamFilter === match.team) ?? loadedGroups[0]
    if (matchingGroup) setSelectedGroupId(matchingGroup.id)
  }, [match.team])

  const dateLabel = useMemo(() => {
    return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
  }, [date])

  const messageContext: MessageVariablesContext = useMemo(() => ({
    teamName: `ES Genech ${match.team === 'E1' ? '1' : '2'}`,
    opponent: match.opponent || 'adversaire à préciser',
    dateLabel,
    competition: match.competition || 'Rencontre',
    homeAway: match.homeAway || 'Lieu à préciser',
    kickoffTime: match.kickoffTime,
    meetingTime: match.meetingTime,
    venueAddress: match.homeAway === 'Extérieur' ? match.venueAddress?.trim() : '',
    calledPlayerNames,
    temperature,
    scoreFor: match.goalsFor ?? undefined,
    scoreAgainst: match.goalsAgainst ?? undefined,
  }), [calledPlayerNames, dateLabel, match, temperature])

  // Générer ou regénérer le message lorsque le template ou le contexte change
  useEffect(() => {
    const currentTemplate = templates.find((t) => t.id === selectedTemplateId) ?? templates[0]
    if (currentTemplate) {
      setMessage(replaceMessageVariables(currentTemplate.content, messageContext))
    }
  }, [selectedTemplateId, templates, messageContext])

  const currentGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId],
  )

  const whatsappHref = useMemo(
    () => buildWhatsAppLink(message, currentGroup?.chatLink),
    [message, currentGroup?.chatLink],
  )

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal()
    if (!open && dialogRef.current?.open) dialogRef.current.close()
  }, [open])

  const openComposer = async () => {
    setPreparing(true)
    setNotice('')
    try {
      const temp = await getMatchTemperature(match, date)
      setTemperature(temp)
      setOpen(true)
    } finally {
      setPreparing(false)
    }
  }

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setNotice(`Message copié ! Vous pouvez le coller dans le groupe ${currentGroup?.name || 'WhatsApp'}.`)
      setTimeout(() => setNotice(''), 4000)
    } catch {
      setNotice('Copie impossible dans ce navigateur. Sélectionnez le texte pour le copier.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openComposer()}
        disabled={preparing}
        className="inline-flex min-h-9 w-auto min-w-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300/50 bg-emerald-500/15 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Share2 aria-hidden="true" className="size-4 text-emerald-200" />
        {preparing ? 'Préparation…' : 'Message familles'}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false)
        }}
        className="m-auto max-h-[92dvh] w-[min(38rem,calc(100vw-1rem))] overflow-y-auto rounded-3xl border-2 border-[#d4af37] bg-[#eef2ff] p-0 text-[#172554] shadow-2xl backdrop:bg-[#07102a]/70 dark:bg-[#0f1b3b] dark:text-white"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#d4af37]/60 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">ES Genech · U11</p>
            <h2 id={titleId} className="text-lg font-black">Message WhatsApp aux familles</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGroupManager(true)}
              aria-label="Configurer les groupes WhatsApp"
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white transition"
              title="Gérer les groupes et messages types"
            >
              <Settings className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le message"
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white transition"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </header>

        <div className="space-y-4 p-5">
          {/* Sélection Groupe et Modèle */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1">
                <Users className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                Groupe WhatsApp destinataire
              </label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full rounded-xl border border-[#172554]/20 bg-white px-3 py-2 text-xs font-bold text-[#172554] outline-none focus:ring-2 focus:ring-[#d4af37] dark:bg-slate-900 dark:text-white"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1">
                Modèle de message
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-xl border border-[#172554]/20 bg-white px-3 py-2 text-xs font-bold text-[#172554] outline-none focus:ring-2 focus:ring-[#d4af37] dark:bg-slate-900 dark:text-white"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.icon || '📝'} {tpl.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Zone d'édition du texte */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-foreground" htmlFor={messageId}>
                Texte prêt pour WhatsApp
              </label>
              <span className="text-[10px] text-muted-foreground">
                Destiné à : <strong className="text-emerald-600 dark:text-emerald-400">{currentGroup?.name}</strong>
              </span>
            </div>
            <textarea
              id={messageId}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={9}
              className="w-full resize-y rounded-2xl border border-[#172554]/20 bg-white p-3.5 text-sm leading-relaxed text-[#172554] outline-none focus:ring-2 focus:ring-[#d4af37] dark:bg-slate-900 dark:text-white font-sans"
            />
          </div>

          {notice && (
            <p role="status" className="rounded-xl bg-emerald-500/15 p-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 animate-in fade-in">
              {notice}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowGroupManager(true)}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-semibold"
            >
              <Settings className="size-3.5" /> Gérer les groupes &amp; modèles
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyMessage()}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#172554]/20 bg-card px-3.5 text-xs font-bold shadow-sm hover:bg-muted"
              >
                <Copy aria-hidden="true" className="size-4" /> Copier
              </button>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-xs font-black text-white shadow-md hover:bg-[#20ba59] transition"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Envoyer sur WhatsApp
              </a>
            </div>
          </div>
        </div>
      </dialog>

      {/* Modal de gestion des groupes et messages */}
      {showGroupManager && (
        <WhatsAppGroupManager
          onClose={() => setShowGroupManager(false)}
          onGroupsUpdated={(updatedGroups) => {
            setGroups(updatedGroups)
            const updatedTemplates = getStoredWhatsAppTemplates()
            setTemplates(updatedTemplates)
          }}
        />
      )}
    </>
  )
}
