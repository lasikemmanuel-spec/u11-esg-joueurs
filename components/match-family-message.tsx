'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, MessageCircle, Share2, X } from 'lucide-react'
import type { MatchSheetEntry } from '@/lib/match-results'

function buildMessage(match: MatchSheetEntry, date: string, calledPlayerNames: string[]) {
  const teamName = `ES Genech ${match.team === 'E1' ? '1' : '2'}`
  const opponent = match.opponent || 'adversaire à préciser'
  const playerList = calledPlayerNames.length > 0
    ? calledPlayerNames.map((name) => `• ${name}`).join('\n')
    : 'Liste à compléter'
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return [
    `📣 Match de ${teamName} contre ${opponent}`,
    `📅 ${dateLabel}`,
    `🏆 ${match.competition || 'Rencontre'}`,
    `📍 ${match.homeAway || 'Lieu à préciser'}`,
    match.kickoffTime ? `🕒 ${match.kickoffTime}` : '',
    `👥 Joueurs convoqués :\n${playerList}`,
    'À bientôt, allez l’ESG !',
  ].filter(Boolean).join('\n')
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
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const whatsappHref = useMemo(
    () => `https://wa.me/?text=${encodeURIComponent(message)}`,
    [message],
  )

  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal()
    if (!open && dialogRef.current?.open) dialogRef.current.close()
  }, [open])

  const openComposer = () => {
    setMessage(buildMessage(match, date, calledPlayerNames))
    setNotice('')
    setOpen(true)
  }

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setNotice('Message copié. Tu peux le coller dans le groupe des familles.')
    } catch {
      setNotice('Copie impossible dans ce navigateur. Sélectionne le texte pour le copier.')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openComposer}
        className="inline-flex min-h-10 w-full min-w-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-300/50 bg-emerald-500/15 px-2 py-2 text-[11px] font-black text-white shadow-sm transition hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:gap-2 sm:px-3 sm:text-xs"
      >
        <Share2 aria-hidden="true" className="size-4 text-emerald-200" />
        Message familles
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setOpen(false)
        }}
        className="m-auto max-h-[90dvh] w-[min(34rem,calc(100vw-1rem))] overflow-y-auto rounded-2xl border-2 border-[#d4af37] bg-[#eef2ff] p-0 text-[#172554] shadow-2xl backdrop:bg-[#07102a]/70 dark:bg-[#111b3b] dark:text-white"
      >
        <header className="flex items-center justify-between gap-3 border-b border-[#d4af37]/60 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-white">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300">ES Genech · U11</p>
            <h2 id={titleId} className="text-lg font-black">Message aux familles</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fermer le message"
            className="inline-flex size-9 items-center justify-center rounded-full border border-white/20 bg-white/10"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </header>

        <div className="space-y-3 p-4">
          <label className="block text-xs font-bold" htmlFor={messageId}>
            Texte à partager
          </label>
          <textarea
            id={messageId}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
            className="w-full resize-y rounded-xl border border-[#172554]/20 bg-white p-3 text-sm leading-relaxed text-[#172554] outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] dark:bg-slate-900 dark:text-white"
          />
          {notice && <p role="status" className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void copyMessage()}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#172554]/20 px-3 text-xs font-bold"
            >
              <Copy aria-hidden="true" className="size-4" /> Copier
            </button>
            <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#25D366] px-3 text-xs font-black text-white"
              >
                <MessageCircle aria-hidden="true" className="size-4" /> Ouvrir WhatsApp
            </a>
          </div>
        </div>
      </dialog>
    </>
  )
}
