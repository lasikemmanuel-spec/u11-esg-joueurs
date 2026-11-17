'use client'

import { useEffect, useMemo, useState } from 'react'
import { Copy, MessageCircle, MessageSquareText, Settings, Users } from 'lucide-react'
import { WhatsAppGroupManager } from '@/components/whatsapp-group-manager'
import {
  buildWhatsAppLink,
  DEFAULT_WHATSAPP_GROUPS,
  DEFAULT_WHATSAPP_TEMPLATES,
  getStoredWhatsAppGroups,
  getStoredWhatsAppTemplates,
  replaceMessageVariables,
  type WhatsAppGroup,
  type WhatsAppTemplate,
} from '@/lib/whatsapp-messages'

function todayLabel() {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  }).format(new Date())
}

export function WhatsAppMessageCenter() {
  const [groups, setGroups] = useState<WhatsAppGroup[]>(DEFAULT_WHATSAPP_GROUPS)
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(DEFAULT_WHATSAPP_TEMPLATES)
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('tpl-entrainement')
  const [message, setMessage] = useState('')
  const [showManager, setShowManager] = useState(false)
  const [notice, setNotice] = useState('')
  const [dateLabel] = useState(todayLabel)

  useEffect(() => {
    const storedGroups = getStoredWhatsAppGroups()
    const storedTemplates = getStoredWhatsAppTemplates()
    setGroups(storedGroups)
    setTemplates(storedTemplates)
    setSelectedGroupId(storedGroups[0]?.id ?? '')
    if (!storedTemplates.some((template) => template.id === 'tpl-entrainement')) {
      setSelectedTemplateId(storedTemplates[0]?.id ?? '')
    }
  }, [])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0],
    [selectedTemplateId, templates],
  )
  const selectedGroup = useMemo(
    () => groups.find((group) => group.id === selectedGroupId) ?? groups[0],
    [groups, selectedGroupId],
  )

  useEffect(() => {
    if (!selectedTemplate) {
      setMessage('')
      return
    }
    setMessage(replaceMessageVariables(selectedTemplate.content, {
      teamName: 'ES Genech U11',
      dateLabel,
      competition: 'Rencontre U11',
      homeAway: 'Lieu à préciser',
      calledPlayerNames: [],
    }))
  }, [dateLabel, selectedTemplate])

  const whatsappHref = useMemo(
    () => buildWhatsAppLink(message, selectedGroup?.chatLink),
    [message, selectedGroup?.chatLink],
  )

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setNotice('Message copié. Tu peux le coller dans WhatsApp.')
    } catch {
      setNotice('Copie impossible dans ce navigateur. Sélectionne le texte pour le copier.')
    }
  }

  return (
    <section aria-labelledby="whatsapp-message-center-title" className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <header className="overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-[#10224a] via-[#172b59] to-[#103d3b] text-white shadow-xl">
        <div className="flex items-center justify-between gap-3 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#25D366] text-white shadow-lg">
              <MessageCircle aria-hidden="true" className="size-7" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">ES Genech · U11</p>
              <h2 id="whatsapp-message-center-title" className="text-lg font-black sm:text-xl">Messages WhatsApp</h2>
              <p className="mt-0.5 text-xs text-white/65">Choisis un modèle, adapte-le et partage-le.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowManager(true)}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-xs font-bold transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            <Settings aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Gérer</span>
          </button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-foreground">
            <Users aria-hidden="true" className="size-4 text-emerald-600 dark:text-emerald-400" />
            Destinataires
          </span>
          <select
            value={selectedGroup?.id ?? ''}
            onChange={(event) => setSelectedGroupId(event.target.value)}
            disabled={groups.length === 0}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {groups.length === 0 && <option value="">Aucun groupe enregistré</option>}
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        </label>

        <label className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="mb-1.5 flex items-center gap-2 text-xs font-bold text-foreground">
            <MessageSquareText aria-hidden="true" className="size-4 text-amber-500" />
            Modèle de message
          </span>
          <select
            value={selectedTemplate?.id ?? ''}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            disabled={templates.length === 0}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {templates.length === 0 && <option value="">Aucun modèle enregistré</option>}
            {templates.map((template) => <option key={template.id} value={template.id}>{template.icon || '📝'} {template.title}</option>)}
          </select>
        </label>
      </div>

      <section className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="whatsapp-message-center-text" className="text-sm font-black text-foreground">Ton message</label>
          {selectedGroup && (
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              Pour : {selectedGroup.name}
            </span>
          )}
        </div>
        <textarea
          id="whatsapp-message-center-text"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={12}
          placeholder="Écris ton message ici…"
          className="w-full resize-y rounded-2xl border border-border bg-background p-4 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-2 text-xs text-muted-foreground">Le texte reste modifiable avant l’envoi. Tu peux aussi créer tes propres modèles avec « Gérer ».</p>

        {notice && (
          <p role="status" className="mt-3 rounded-xl bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            {notice}
          </p>
        )}

        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={() => void copyMessage()}
            disabled={!message}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-muted disabled:opacity-50"
          >
            <Copy aria-hidden="true" className="size-4" />
            Copier
          </button>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!message}
            onClick={(event) => {
              if (!message) event.preventDefault()
            }}
            className={[
              'inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#25D366] px-4 text-sm font-black text-white shadow transition hover:brightness-105',
              !message ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            Ouvrir WhatsApp
          </a>
        </div>
      </section>

      {showManager && (
        <WhatsAppGroupManager
          onClose={() => {
            setShowManager(false)
            const updatedGroups = getStoredWhatsAppGroups()
            const updatedTemplates = getStoredWhatsAppTemplates()
            setGroups(updatedGroups)
            setTemplates(updatedTemplates)
            if (!updatedGroups.some((group) => group.id === selectedGroupId)) {
              setSelectedGroupId(updatedGroups[0]?.id ?? '')
            }
            if (!updatedTemplates.some((template) => template.id === selectedTemplateId)) {
              setSelectedTemplateId(updatedTemplates[0]?.id ?? '')
            }
          }}
          onGroupsUpdated={setGroups}
        />
      )}
    </section>
  )
}
