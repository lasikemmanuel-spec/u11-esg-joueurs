'use client'

import type { FormEvent } from 'react'
import { CalendarDays, ChevronDown, ChevronUp, Clock3, Save, Sparkles, X } from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { MATCH_RESULT_STATUSES } from '@/lib/match-result-options'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

export type MatchResultDraft = {
  team: 'E1' | 'E2'
  date: string
  opponent: string
  competition: string
  homeAway: string
  kickoffTime: string
  meetingTime: string
  venueAddress: string
  resultLabel: string
  goalsFor: string
  goalsAgainst: string
}

const inputClass = 'h-10 min-w-0 w-full max-w-full rounded-lg border border-accent/50 bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring'
const dateTimeInputClass = 'h-9 min-w-0 w-full max-w-full appearance-none rounded-lg border border-[#d4af37]/60 bg-white dark:bg-slate-900 px-2 text-sm font-bold text-[#172554] dark:text-amber-200 outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] [color-scheme:light] dark:[color-scheme:dark]'

export function MatchResultForm({
  draft,
  editingSlot,
  formMinimized,
  pending,
  pendingDeletion,
  error,
  onSubmit,
  onDraftChange,
  onClose,
  onMinimize,
  onRestore,
}: {
  draft: MatchResultDraft
  editingSlot: number | null
  formMinimized: boolean
  pending: boolean
  pendingDeletion: boolean
  error: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDraftChange: (draft: MatchResultDraft) => void
  onClose: () => void
  onMinimize: () => void
  onRestore: () => void
}) {
  const updateDraft = (updates: Partial<MatchResultDraft>) => onDraftChange({ ...draft, ...updates })

  return (
    <div
      className={[
        'fixed inset-0 z-[100] flex justify-center bg-[#08132f]/65 backdrop-blur-sm transition-all duration-300',
        formMinimized ? 'items-end pointer-events-none' : 'items-end sm:items-center p-0 sm:p-4',
      ].join(' ')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending && !formMinimized) onClose()
      }}
    >
      {formMinimized && (
        <button
          type="button"
          onClick={onRestore}
          className="pointer-events-auto mb-24 mr-4 ml-auto inline-flex items-center gap-2 rounded-2xl border-2 border-[#d4af37] bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-sm font-black text-[#d4af37] shadow-2xl ring-2 ring-[#d4af37]/30 transition hover:-translate-y-1 hover:shadow-[#d4af37]/30 sm:hidden"
          aria-label="Rouvrir le formulaire"
        >
          <ChevronUp aria-hidden="true" className="size-5 text-[#d4af37]" />
          <span>{editingSlot === null ? 'Planifier un match' : 'Modifier ce match'}</span>
          <Sparkles aria-hidden="true" className="size-4 opacity-70" />
        </button>
      )}

      <form
        onSubmit={onSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-form-title"
        className={[
          'flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden border border-[#d4af37]/60 bg-card shadow-2xl transition-all duration-300 sm:rounded-3xl',
          formMinimized ? 'hidden sm:flex rounded-t-3xl' : 'rounded-t-3xl',
        ].join(' ')}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 text-white">
          <div className="flex min-w-0 items-center gap-2.5">
            <ClubCrest className="size-9 shrink-0 ring-2 ring-[#d4af37]" />
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#d4af37]">ES Genech · U11</p>
              <h3 id="match-form-title" className="truncate text-sm font-black sm:text-base">
                {editingSlot === null ? 'Planifier un match' : 'Modifier ce match'}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={onMinimize}
              aria-label="Réduire le formulaire"
              title="Réduire"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:opacity-50 sm:hidden"
            >
              <ChevronDown aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              aria-label="Fermer la fenêtre"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:bg-white/20 disabled:opacity-50"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto p-4">
          <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            Équipe
            <select disabled={editingSlot !== null} value={draft.team} onChange={(event) => updateDraft({ team: event.target.value as MatchResultDraft['team'] })} className={inputClass}>
              <option value="E1">ES Genech 1</option>
              <option value="E2">ES Genech 2</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            <span className="flex items-center gap-1"><CalendarDays aria-hidden="true" className="size-3.5 text-[#b58b00] dark:text-amber-400" /> Date</span>
            <input type="date" required min={MATCH_SEASON_START} max={MATCH_SEASON_END} value={draft.date} onChange={(event) => updateDraft({ date: event.target.value })} className={dateTimeInputClass} />
          </label>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            Adversaire
            <input required maxLength={80} value={draft.opponent} onChange={(event) => updateDraft({ opponent: event.target.value })} className={inputClass} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            Type de match
            <select value={draft.competition} onChange={(event) => updateDraft({ competition: event.target.value })} className={inputClass}>
              <option>Championnat</option><option>Amical</option><option>Tournoi</option><option>Futsal</option><option>Plateau</option><option>Autre</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            Lieu
            <select value={draft.homeAway} onChange={(event) => updateDraft({ homeAway: event.target.value })} className={inputClass}>
              <option value="Domicile">Domicile</option><option value="Extérieur">Extérieur</option><option value="Terrain neutre">Terrain neutre</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            <span className="flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5 text-[#b58b00] dark:text-amber-400" /> Heure</span>
            <input type="time" value={draft.kickoffTime} onChange={(event) => updateDraft({ kickoffTime: event.target.value })} className={dateTimeInputClass} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            <span className="flex items-center gap-1"><Clock3 aria-hidden="true" className="size-3.5 text-[#b58b00] dark:text-amber-400" /> Rendez-vous au stade</span>
            <input type="time" value={draft.meetingTime} onChange={(event) => updateDraft({ meetingTime: event.target.value })} className={dateTimeInputClass} />
          </label>
          {draft.homeAway === 'Extérieur' && (
            <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
              Adresse du stade extérieur
              <input maxLength={180} value={draft.venueAddress} onChange={(event) => updateDraft({ venueAddress: event.target.value })} placeholder="Rue, code postal, ville" className={inputClass} />
            </label>
          )}
          <fieldset className="col-span-2 flex min-w-0 items-end gap-3">
            <legend className="mb-1 text-xs font-bold text-[#172554] dark:text-amber-200">Score</legend>
            <label className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-xl border border-[#172554]/15 dark:border-amber-400/30 bg-[#172554]/5 dark:bg-[#172554]/40 px-3 py-2 text-xs font-semibold text-[#172554] dark:text-amber-200">
              ESG
              <input type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} value={draft.goalsFor} onChange={(event) => updateDraft({ goalsFor: event.target.value.replace(/\D/g, '').slice(0, 2) })} aria-label="Buts ESG" className="h-10 w-14 rounded-lg border border-[#d4af37]/60 bg-white dark:bg-slate-900 text-center font-mono text-lg font-black text-[#172554] dark:text-amber-200 outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]" />
            </label>
            <span className="pb-3 font-black text-[#d4af37]">–</span>
            <label className="flex min-w-0 flex-1 items-center justify-between gap-1.5 rounded-xl border border-amber-400/30 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-2 text-[11px] font-semibold text-[#172554] dark:text-amber-200 sm:gap-2 sm:px-3 sm:text-xs">
              Adversaire
              <input type="text" inputMode="numeric" pattern="[0-9]{1,2}" maxLength={2} value={draft.goalsAgainst} onChange={(event) => updateDraft({ goalsAgainst: event.target.value.replace(/\D/g, '').slice(0, 2) })} aria-label="Buts adversaire" className="h-10 w-14 rounded-lg border border-[#d4af37]/60 bg-white dark:bg-slate-900 text-center font-mono text-lg font-black text-[#172554] dark:text-amber-200 outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]" />
            </label>
          </fieldset>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 text-xs font-bold text-[#172554] dark:text-amber-200">
            Résultat
            <select value={draft.resultLabel} onChange={(event) => updateDraft({ resultLabel: event.target.value })} className={inputClass}>
              <option value="">À jouer / aucun résultat</option>
              {MATCH_RESULT_STATUSES.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
          <div className="col-span-2 space-y-2">
            {error && <p role="alert" className="text-xs font-semibold text-destructive">{error}</p>}
            <p className="text-[11px] text-muted-foreground">Pour planifier : laisse le score et le résultat vides.</p>
          </div>
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-[#172554]/10 dark:border-amber-400/20 bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button type="button" disabled={pending} onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-[#172554]/15 dark:border-amber-400/30 px-4 text-sm font-bold text-[#172554] dark:text-amber-200 disabled:opacity-50">
            Annuler
          </button>
          <button type="submit" disabled={pending || pendingDeletion} className="inline-flex min-h-11 flex-[1.5] items-center justify-center gap-2 rounded-xl bg-[#172554] px-4 text-sm font-black text-white shadow-md transition hover:bg-blue-900 disabled:opacity-50">
            <Save aria-hidden="true" className="size-4 text-[#d4af37]" />
            {pending ? 'Enregistrement…' : editingSlot === null ? 'Planifier' : 'Enregistrer'}
          </button>
        </footer>
      </form>
    </div>
  )
}
