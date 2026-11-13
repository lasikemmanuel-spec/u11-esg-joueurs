'use client'

import { Check, ChevronDown, Copy, Pencil } from 'lucide-react'
import { ParentAvatar } from '@/components/parent-avatar'
import { PhoneActionButtons } from '@/components/phone-action-buttons'
import type { Player, PublicPlayer } from '@/lib/players'

export type EducatorPlayer = PublicPlayer & Pick<Player, 'licenseNumber'>
export type PlayerPhones = { legacyPhone: string; fatherPhone: string; motherPhone: string }

export function EducatorPlayerCard({
  player,
  phone,
  isAdmin,
  requestPending,
  copied,
  expanded,
  onEditPhones,
  onCopyLicense,
  onExpandedChange,
}: {
  player: EducatorPlayer
  phone?: PlayerPhones
  isAdmin: boolean
  requestPending: boolean
  copied: boolean
  expanded: boolean
  onEditPhones: () => void
  onCopyLicense: (licenseNumber: string) => void
  onExpandedChange: (expanded: boolean) => void
}) {
  const licenseNumber = player.licenseNumber
  const position = player.position ?? 'Non renseigné'
  const hasParentContacts = Boolean(phone?.fatherPhone || phone?.motherPhone || phone?.legacyPhone)
  const parentContact = (parent: 'father' | 'mother', value: string) => {
    if (!value) return null
    const label = parent === 'father' ? 'Papa' : 'Maman'
    return (
      <div key={parent} className="grid w-full min-w-0 grid-cols-1 items-start gap-1.5 md:grid-cols-[4.5rem_minmax(0,1fr)] md:items-center md:gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ParentAvatar parent={parent} />
          {label}
        </span>
        <PhoneActionButtons
          phone={value}
          label={label}
          playerName={`${player.firstName} ${player.lastName}`}
        />
      </div>
    )
  }

  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border-2 border-[#172554]/15 bg-card shadow-sm transition hover:border-[#172554]/35 hover:shadow-md">
      <div className="flex items-center gap-2.5 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-3 py-3 text-white">
        <span
          title={`N°${player.number}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-[#172554] text-sm font-black text-amber-300 shadow-md"
        >
          {player.number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="whitespace-normal break-words text-sm font-black leading-tight sm:text-base">
            {player.firstName} <span className="uppercase tracking-wide">{player.lastName}</span>
          </h3>
          <span className="mt-1 inline-flex max-w-full truncate rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 ring-1 ring-white/15">
            {position}
          </span>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onEditPhones}
            disabled={requestPending}
            aria-label={`Modifier les téléphones de ${player.firstName} ${player.lastName}`}
            title="Modifier les numéros"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/20 text-blue-100 transition hover:bg-white/10 disabled:opacity-50"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>
      <div className="flex min-h-11 items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground">
        <span className="truncate">Licence FFF : <span className="font-mono font-semibold text-foreground">{licenseNumber ?? 'non renseignée'}</span></span>
        {licenseNumber && (
          <button
            type="button"
            onClick={() => onCopyLicense(licenseNumber)}
            className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition ${
              copied ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground'
            }`}
            title="Copier le numéro de licence"
            aria-label={`Copier le numéro de licence de ${player.firstName} ${player.lastName}`}
          >
            {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
          </button>
        )}
      </div>
      <details
        open={expanded}
        onToggle={(event) => onExpandedChange(event.currentTarget.open)}
        className="group border-t border-accent/35"
      >
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-bold text-primary outline-none transition hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <span>{expanded ? 'Masquer les contacts' : 'Voir les contacts'}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-2 border-t border-accent/20 bg-muted/30 p-3">
          {parentContact('father', phone?.fatherPhone ?? '')}
          {parentContact('mother', phone?.motherPhone ?? '')}
          {phone?.legacyPhone && (
            <div className="inline-flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Autre contact</span>
              <PhoneActionButtons
                phone={phone.legacyPhone}
                label="l’autre contact"
                playerName={`${player.firstName} ${player.lastName}`}
              />
            </div>
          )}
          {!hasParentContacts && <p className="text-xs text-muted-foreground">Aucun téléphone renseigné.</p>}
        </div>
      </details>
    </article>
  )
}
