'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, CalendarPlus, Check, ChevronDown, Clock3, Pencil, Plus, Save, Sparkles, Trash2, UsersRound, X } from 'lucide-react'
import { CallupScheduleEntry } from '@/components/callup-schedule-entry'
import { MatchLineupEntry, useMatchLineups } from '@/components/match-lineup-planner'
import { ClubCrest } from '@/components/club-crest'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { Convocation } from '@/lib/convocations'
import { MATCH_RESULT_STATUSES } from '@/lib/match-result-options'
import { getDefaultExpandedMatchDate } from '@/lib/match-day-display'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
import type { TrainingAttendanceSession } from '@/lib/training-attendance'
import {
  clampToMatchSeason,
  MATCH_SEASON_END,
  MATCH_SEASON_MONTHS,
  MATCH_SEASON_START,
} from '@/lib/match-season'

type MatchEntryStatus = {
  enabled: boolean
  role: 'educator' | 'admin' | 'reader' | null
  displayName: string | null
}

type Draft = {
  team: 'E1' | 'E2'
  date: string
  opponent: string
  competition: string
  homeAway: string
  kickoffTime: string
  resultLabel: string
  goalsFor: string
  goalsAgainst: string
}

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function dateInputValue(value: string) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0')
  const dayFirst = value.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  if (dayFirst) return dayFirst[3] + '-' + dayFirst[2].padStart(2, '0') + '-' + dayFirst[1].padStart(2, '0')
  return ''
}

function createDraft(): Draft {
  return {
    team: 'E1',
    date: clampToMatchSeason(localToday()),
    opponent: '',
    competition: 'Championnat',
    homeAway: 'Domicile',
    kickoffTime: '',
    resultLabel: '',
    goalsFor: '',
    goalsAgainst: '',
  }
}

function getEditableResult(entry: MatchSheetEntry) {
  if (MATCH_RESULT_STATUSES.includes(entry.resultLabel as (typeof MATCH_RESULT_STATUSES)[number])) return entry.resultLabel
  if (entry.goalsFor === null || entry.goalsAgainst === null) return ''
  if (entry.goalsFor > entry.goalsAgainst) return 'Gagné'
  if (entry.goalsFor < entry.goalsAgainst) return 'Perdu'
  return 'Nul'
}

const inputClass = 'h-10 min-w-0 w-full max-w-full rounded-lg border border-accent/50 bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring'
const dateTimeInputClass = 'h-9 min-w-0 w-full max-w-full appearance-none rounded-lg border border-[#d4af37]/60 bg-white px-2 text-sm font-bold text-[#172554] outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37] [color-scheme:light]'

export function MatchResultEntry({
  entries,
  players,
  playerStats,
  convocations,
  convocationDates,
  trainingAttendance,
  trainingAttendanceError,
  onConnect,
}: {
  entries: MatchSheetEntry[]
  players: PublicPlayer[]
  playerStats: PlayerStats[]
  convocations: Convocation[]
  convocationDates: string[]
  trainingAttendance: TrainingAttendanceSession[]
  trainingAttendanceError: boolean
  onConnect: () => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<MatchEntryStatus | null>(null)
  const [draft, setDraft] = useState<Draft>(createDraft)
  const [month, setMonth] = useState(clampToMatchSeason(localToday()).slice(0, 7))
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [openCallupDate, setOpenCallupDate] = useState('')
  const [expandedDayDate, setExpandedDayDate] = useState<string | null>(null)
  const [collapsedMatchKeys, setCollapsedMatchKeys] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const refreshStatus = useCallback(() => {
    fetch('/api/match-results', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de vérifier les droits.')
        setStatus(result as MatchEntryStatus)
      })
      .catch(() => setStatus({ enabled: false, role: null, displayName: null }))
  }, [])

  useEffect(() => {
    refreshStatus()
    const onSessionChange = () => refreshStatus()
    window.addEventListener('educator-session-changed', onSessionChange)
    return () => window.removeEventListener('educator-session-changed', onSessionChange)
  }, [refreshStatus])

  const monthEntries = useMemo(
    () => entries.filter((entry) => dateInputValue(entry.date).slice(0, 7) === month),
    [entries, month],
  )
  const dayEntries = useMemo(() => {
    const grouped = new Map<string, MatchSheetEntry[]>()
    for (const entry of monthEntries) {
      const date = dateInputValue(entry.date)
      if (!date) continue
      grouped.set(date, [...(grouped.get(date) ?? []), entry])
    }
    return [...grouped.entries()]
      .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
      .map(([date, matches]) => ({ date, matches }))
  }, [monthEntries])
  const defaultExpandedDate = getDefaultExpandedMatchDate(
    dayEntries.map((day) => day.date),
    localToday(),
  )
  const completedConvocationDates = useMemo(() => new Set(
    convocationDates
      .map(dateInputValue)
      .filter(Boolean)
      .filter((date) => players.length > 0 && players.every((player) =>
        convocations
          .find((convocation) => convocation.number === player.number)
          ?.matches.some((match) => dateInputValue(match.date) === date && match.raw.trim().length > 0),
      )),
  ), [convocationDates, convocations, players])
  const canManage = Boolean(status?.enabled && (status.role === 'educator' || status.role === 'admin'))
  const matchLineups = useMatchLineups(canManage)

  const startNew = () => {
    setEditingSlot(null)
    setDraft(createDraft())
    setError('')
    setNotice('')
    setOpen(true)
  }

  const startEdit = (entry: MatchSheetEntry) => {
    setEditingSlot(entry.slotColumn)
    setDraft({
      team: entry.team,
      date: dateInputValue(entry.date),
      opponent: entry.opponent,
      competition: entry.competition || 'Championnat',
      homeAway: entry.homeAway || 'Domicile',
      kickoffTime: entry.kickoffTime,
      resultLabel: getEditableResult(entry),
      goalsFor: entry.goalsFor === null ? '' : String(entry.goalsFor),
      goalsAgainst: entry.goalsAgainst === null ? '' : String(entry.goalsAgainst),
    })
    setError('')
    setNotice('')
    setOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (draft.date < MATCH_SEASON_START || draft.date > MATCH_SEASON_END) {
      setError('La date du match doit être comprise entre le 1er septembre 2026 et le 30 juin 2027.')
      return
    }

    const oneScoreMissing = Boolean(draft.goalsFor) !== Boolean(draft.goalsAgainst)
    if (oneScoreMissing) {
      setError('Saisis les deux scores ou laisse les deux champs vides pour planifier le match.')
      return
    }
    const hasScore = Boolean(draft.goalsFor && draft.goalsAgainst)
    if (hasScore && !draft.resultLabel) {
      setError('Choisis le résultat à inscrire dans le Sheet : Gagné, Nul ou Perdu.')
      return
    }
    if (!hasScore && draft.resultLabel && draft.resultLabel !== 'Annulé') {
      setError('Un résultat Gagné, Nul ou Perdu nécessite les deux scores.')
      return
    }

    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/match-results', {
        method: editingSlot === null ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          slotColumn: editingSlot ?? undefined,
          goalsFor: draft.goalsFor ? Number(draft.goalsFor) : null,
          goalsAgainst: draft.goalsAgainst ? Number(draft.goalsAgainst) : null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer le match.')
      setNotice(editingSlot === null
        ? 'Match ajouté à « ' + result.sheetTitle + ' ».'
        : 'Match mis à jour dans « ' + result.sheetTitle + ' ».')
      setMonth(draft.date.slice(0, 7))
      setOpen(false)
      setEditingSlot(null)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer le match.')
    } finally {
      setPending(false)
    }
  }

  const removeMatch = async (date: string, entry?: MatchSheetEntry) => {
    const targetKey = entry ? `${entry.team}-${entry.slotColumn}` : `day-${date}`
    const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR')
    const confirmation = entry
      ? `Supprimer le match contre ${entry.opponent || 'cet adversaire'} du ${dateLabel} ? Son résultat et sa composition seront effacés. Les convocations de cette date seront conservées.`
      : `Supprimer les ${dayEntries.find((day) => day.date === date)?.matches.length ?? 0} matchs du ${dateLabel} ? Les résultats et compositions seront effacés. Les convocations de cette date seront conservées.`
    if (!window.confirm(confirmation)) return

    setPendingDeletion(targetKey)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/match-results', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry
          ? { scope: 'match', date, team: entry.team, slotColumn: entry.slotColumn }
          : { scope: 'day', date }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de supprimer le match.')
      setNotice(entry ? 'Match supprimé du calendrier.' : 'Journée supprimée du calendrier.')
      if (!entry && openCallupDate === date) setOpenCallupDate('')
      router.refresh()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Impossible de supprimer le match.')
    } finally {
      setPendingDeletion(null)
    }
  }

  if (!status) return null

  return (
    <section aria-labelledby="match-entry-title" className="overflow-hidden rounded-2xl border border-[#d4af37]/30 bg-card shadow-md">
      {/* Bandeau ESG */}
      <header className="relative overflow-hidden bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 sm:px-5 sm:py-4">
        <Sparkles aria-hidden="true" className="absolute -right-3 -top-5 size-24 rotate-12 text-[#d4af37]/15" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClubCrest className="size-9 shrink-0 ring-2 ring-[#d4af37] sm:size-11" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#d4af37]">ES Genech · U11</p>
              <h2 id="match-entry-title" className="text-sm font-black text-white sm:text-base">Calendrier &amp; résultats</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="relative flex min-h-11 items-center rounded-xl border-2 border-[#d4af37] bg-white/10 shadow-sm transition hover:bg-white/15 focus-within:ring-2 focus-within:ring-[#d4af37]/60">
              <CalendarDays aria-hidden="true" className="pointer-events-none absolute left-3 size-4 text-[#d4af37]" />
              <select
                aria-label="Mois"
                value={month}
                onChange={(event) => {
                  setMonth(event.target.value)
                  setExpandedDayDate(null)
                }}
                className="h-10 min-w-36 appearance-none bg-transparent py-1 pl-9 pr-9 text-sm font-black text-white outline-none sm:min-w-40"
              >
                {MATCH_SEASON_MONTHS.map(({ value, label }) => (
                  <option key={value} value={value} className="bg-[#172554] text-white">{label}</option>
                ))}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 size-4 text-[#d4af37]" />
            </label>
            {canManage && (
              <button
                type="button"
                disabled={pending || pendingDeletion !== null}
                onClick={startNew}
                className="group inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-amber-200/70 bg-gradient-to-r from-[#f4d45e] via-[#d4af37] to-[#f4d45e] px-3.5 text-xs font-black text-blue-950 shadow-md transition duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#172554] active:translate-y-0 sm:min-h-11 sm:px-5 sm:text-sm"
              >
                <CalendarPlus aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:rotate-[-8deg] sm:size-[18px]" />
                <span>Planifier un match</span>
                <Sparkles aria-hidden="true" className="size-3.5 text-blue-950/70 transition-transform duration-200 group-hover:scale-125 sm:size-4" />
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="p-3 sm:p-4">

      {!status.enabled ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          La saisie est désactivée dans cet aperçu. Elle sera disponible sur le site officiel après connexion.
        </p>
      ) : status.role === null ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
          <p className="text-sm text-muted-foreground">Connecte-toi dans l’espace éducateurs ci-dessous pour ajouter ou modifier les matchs.</p>
          <button
            type="button"
            onClick={onConnect}
            className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"
          >
            Connexion
          </button>
        </div>
      ) : null}

      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>}

      {open && canManage && (
        <form onSubmit={save} className="mt-4 grid min-w-0 grid-cols-2 gap-3 border-t border-border pt-4">
          <div className="col-span-2 flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[#d4af37]/40 bg-gradient-to-r from-[#172554]/5 to-amber-50/80 p-2">
            <h3 className="min-w-0 text-sm font-black text-[#172554] sm:text-base">
              {editingSlot === null ? 'Planifier un match' : 'Modifier ce match'}
            </h3>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => { setOpen(false); setEditingSlot(null) }}
                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg border border-[#172554]/15 bg-white px-2.5 text-xs font-bold text-[#172554] transition hover:bg-slate-50 disabled:opacity-50"
              >
                <X aria-hidden="true" className="size-3.5" />
                Fermer
              </button>
              <button
                type="submit"
                disabled={pending || pendingDeletion !== null}
                aria-label={pending ? 'Enregistrement en cours' : 'Enregistrer le match'}
                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-lg bg-[#172554] px-2.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-900 disabled:opacity-50"
              >
                <Save aria-hidden="true" className="size-3.5 text-[#d4af37]" />
                {pending ? '…' : 'Enregistrer'}
              </button>
            </div>
          </div>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
            Équipe
            <select disabled={editingSlot !== null} value={draft.team} onChange={(event) => setDraft({ ...draft, team: event.target.value as Draft['team'] })} className={inputClass}>
              <option value="E1">Équipe 1</option>
              <option value="E2">Équipe 2</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 rounded-xl border border-[#d4af37]/60 bg-gradient-to-br from-amber-50 to-white p-2 text-xs font-black uppercase tracking-wide text-[#172554]">
            <span className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-3.5 text-[#b58b00]" /> Date du match</span>
            <input
              type="date"
              required
              min={MATCH_SEASON_START}
              max={MATCH_SEASON_END}
              value={draft.date}
              onChange={(event) => setDraft({ ...draft, date: event.target.value })}
              className={dateTimeInputClass}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 rounded-xl border border-[#172554]/15 bg-[#172554]/5 p-2 text-xs font-black uppercase tracking-wide text-[#172554]">
            <span className="flex items-center gap-1.5"><Clock3 aria-hidden="true" className="size-3.5 text-[#b58b00]" /> Heure</span>
            <input
              type="time"
              value={draft.kickoffTime}
              onChange={(event) => setDraft({ ...draft, kickoffTime: event.target.value })}
              className={dateTimeInputClass}
            />
          </label>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 text-sm font-semibold">
            Adversaire
            <input required maxLength={80} value={draft.opponent} onChange={(event) => setDraft({ ...draft, opponent: event.target.value })} className={inputClass} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
            Type de match
            <select value={draft.competition} onChange={(event) => setDraft({ ...draft, competition: event.target.value })} className={inputClass}>
              <option>Championnat</option><option>Amical</option><option>Tournoi</option><option>Plateau</option>
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
            Lieu
            <select value={draft.homeAway} onChange={(event) => setDraft({ ...draft, homeAway: event.target.value })} className={inputClass}>
              <option value="Domicile">Domicile</option><option value="Extérieur">Extérieur</option><option value="Terrain neutre">Terrain neutre</option>
            </select>
          </label>
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <label className="flex min-w-0 flex-col gap-1 text-sm font-semibold">
              Buts ESG
              <input type="number" min="0" max="50" step="1" value={draft.goalsFor} onChange={(event) => setDraft({ ...draft, goalsFor: event.target.value })} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Buts adversaire
              <input type="number" min="0" max="50" step="1" value={draft.goalsAgainst} onChange={(event) => setDraft({ ...draft, goalsAgainst: event.target.value })} className={inputClass} />
            </label>
          </div>
          <label className="col-span-2 flex min-w-0 flex-col gap-1 text-sm font-semibold">
            Résultat à inscrire dans le Sheet
            <select value={draft.resultLabel} onChange={(event) => setDraft({ ...draft, resultLabel: event.target.value })} className={inputClass}>
              <option value="">À jouer / aucun résultat</option>
              {MATCH_RESULT_STATUSES.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
          <p className="col-span-2 text-xs text-muted-foreground">
            Saisis les deux scores et choisis Gagné, Nul ou Perdu. Pour un match à venir, laisse score et résultat vides.
          </p>
          <div className="col-span-2 flex flex-wrap gap-2">
            <button type="submit" disabled={pending || pendingDeletion !== null} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
              <Save aria-hidden="true" className="size-4" />
              {pending ? 'Enregistrement…' : editingSlot === null ? 'Ajouter au calendrier' : 'Enregistrer les modifications'}
            </button>
            <button type="button" disabled={pending} onClick={() => { setOpen(false); setEditingSlot(null) }} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground">Annuler</button>
          </div>
        </form>
      )}

      {canManage && matchLineups.error && (
        <p role="alert" className="mt-3 text-sm font-medium text-destructive">{matchLineups.error}</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        {dayEntries.length === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
            Aucun match enregistré pour ce mois.
          </p>
        ) : dayEntries.map(({ date, matches }) => {
          const isSaturday = new Date(`${date}T12:00:00`).getDay() === 6
          const canScheduleCallup = canManage && isSaturday && matches.some((entry) => entry.resultLabel !== 'Annulé')
          const hasConvocations = completedConvocationDates.has(date)
          const isExpanded = (expandedDayDate ?? defaultExpandedDate) === date
          const dayContentId = `match-day-${date}`
          return (
            <article key={date} className="overflow-visible rounded-2xl border border-[#172554]/15 bg-background shadow-sm">
              <header className={`flex flex-col gap-3 border-b border-[#d4af37]/50 bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${isExpanded ? 'rounded-t-2xl' : 'rounded-2xl'}`}>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={dayContentId}
                  onClick={() => setExpandedDayDate((current) => {
                    const currentExpandedDate = current ?? defaultExpandedDate
                    return currentExpandedDate === date ? '' : date
                  })}
                  className="flex w-full min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d4af37]"
                >
                  <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-[#d4af37] transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                  <ClubCrest className="size-8 shrink-0 rounded-full ring-2 ring-[#d4af37]/80 shadow-sm" />
                  <span className="min-w-0">
                    <span className="block text-sm font-black capitalize text-white sm:text-base">
                      {new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-white/75">
                      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#d4af37] px-1.5 py-0.5 text-[10px] font-black text-blue-950">{matches.length}</span>
                      rencontre{matches.length === 1 ? '' : 's'}
                    </span>
                  </span>
                </button>
                {(canScheduleCallup || canManage) && (
                  <div className="flex w-full shrink-0 flex-row flex-wrap justify-end gap-1.5 sm:w-auto sm:flex-nowrap sm:gap-2">
                    {canScheduleCallup && (
                      <button
                        type="button"
                        aria-expanded={openCallupDate === date}
                        onClick={() => setOpenCallupDate((current) => current === date ? '' : date)}
                        className={[
                          'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11px] font-black transition-colors sm:gap-2 sm:rounded-xl sm:px-3 sm:text-sm',
                          hasConvocations
                            ? 'border border-white/25 bg-white/10 text-white/85 shadow-none hover:bg-white/15'
                            : 'bg-[#d4af37] text-blue-950 shadow hover:bg-amber-300',
                        ].join(' ')}
                      >
                        {hasConvocations ? <Check aria-hidden="true" className="size-3.5 sm:size-4" /> : <UsersRound aria-hidden="true" className="size-3.5 sm:size-4" />}
                        <span className="sm:hidden">{hasConvocations ? 'Convocations' : 'À convoquer'}</span>
                        <span className="hidden sm:inline">{hasConvocations ? 'Voir les convocations' : 'Convocations à saisir'}</span>
                      </button>
                    )}
                    {canManage &&
                      date >= localToday() &&
                      matches.every((entry) =>
                        !entry.resultLabel && entry.goalsFor === null && entry.goalsAgainst === null,
                      ) && (
                      <button
                        type="button"
                        disabled={pending || pendingDeletion !== null}
                        onClick={() => removeMatch(date)}
                        className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-red-200/50 bg-red-500/10 px-2.5 text-[11px] font-bold text-white/90 transition hover:bg-red-500/25 disabled:opacity-50 sm:gap-2 sm:rounded-xl sm:px-3 sm:text-xs"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5 sm:size-4" />
                        <span className="sm:hidden">{pendingDeletion === `day-${date}` ? '…' : 'Supprimer'}</span>
                        <span className="hidden sm:inline">{pendingDeletion === `day-${date}` ? 'Suppression…' : 'Supprimer la journée'}</span>
                      </button>
                    )}
                  </div>
                )}
              </header>
              {isExpanded && <div id={dayContentId} className="grid gap-3 p-3 sm:grid-cols-2">
                {matches.map((entry) => {
                  const isE1 = entry.team === 'E1'
                  const isPlayed = entry.goalsFor !== null && entry.goalsAgainst !== null && entry.resultLabel !== 'Annulé'
                  const isCancelled = entry.resultLabel === 'Annulé'
                  const result = isPlayed ? getEditableResult(entry) : null
                  const scoreLabel = isCancelled
                    ? 'Annulé'
                    : !isPlayed
                      ? 'À jouer'
                      : entry.goalsFor + ' – ' + entry.goalsAgainst
                  const resultLabel = isPlayed && result ? result : null
                  const matchKey = entry.team + '-' + entry.slotColumn
                  const matchPanelId = `match-details-${date}-${entry.team}-${entry.slotColumn}`
                  const isMatchExpanded = !collapsedMatchKeys.has(matchKey)
                  const scoreBg = result === 'Gagné'
                    ? 'bg-emerald-500 text-white'
                    : result === 'Perdu'
                      ? 'bg-red-500 text-white'
                      : result === 'Nul'
                        ? 'bg-amber-400 text-blue-950'
                        : isCancelled
                          ? 'bg-muted text-muted-foreground'
                          : isE1
                            ? 'bg-[#172554] text-white'
                            : 'bg-amber-400 text-blue-950'
                  const homeAwayIcon = entry.homeAway === 'Domicile' ? '🏠' : entry.homeAway === 'Extérieur' ? '✈️' : '⚖️'
                  return (
                    <div
                      key={entry.team + '-' + entry.slotColumn}
                      className={[
                        'relative flex min-w-0 flex-col overflow-hidden rounded-2xl border shadow-sm',
                        isE1
                          ? 'border-[#172554]/25 bg-gradient-to-b from-[#172554]/8 to-[#172554]/3'
                          : 'border-amber-400/35 bg-gradient-to-b from-amber-400/8 to-amber-400/3',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'flex min-w-0 items-center justify-between gap-2 px-3 py-2',
                          isE1
                            ? 'bg-[#172554] text-white'
                            : 'bg-amber-400 text-blue-950',
                        ].join(' ')}
                      >
                        <button
                          type="button"
                          aria-expanded={isMatchExpanded}
                          aria-controls={matchPanelId}
                          onClick={() => setCollapsedMatchKeys((current) => {
                            const next = new Set(current)
                            if (next.has(matchKey)) next.delete(matchKey)
                            else next.add(matchKey)
                            return next
                          })}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#d4af37]"
                        >
                          <ChevronDown
                            aria-hidden="true"
                            className={`size-4 shrink-0 transition-transform ${isMatchExpanded ? '' : '-rotate-90'}`}
                          />
                          <ClubCrest className={['size-6 shrink-0 rounded-full ring-2', isE1 ? 'ring-white/40' : 'ring-blue-950/30'].join(' ')} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[9px] font-black uppercase tracking-widest opacity-80">
                              ESG – Équipe {isE1 ? '1' : '2'}
                            </span>
                            <span className="block truncate text-sm font-black">
                              {entry.opponent || 'Adversaire à préciser'}
                            </span>
                          </span>
                          <span className={['shrink-0 rounded-lg px-2 py-1 font-mono text-xs font-black', scoreBg].join(' ')}>
                            {scoreLabel}
                          </span>
                        </button>
                        {canManage && (
                          <div className="flex shrink-0 items-center gap-1">
                            {entry.resultLabel !== 'Annulé' && dateInputValue(entry.date) >= localToday() && (
                              <button
                                type="button"
                                disabled={pending || pendingDeletion !== null}
                                onClick={() => startEdit(entry)}
                                aria-label={'Modifier le match contre ' + (entry.opponent || 'cet adversaire')}
                                className={[
                                  'inline-flex size-7 items-center justify-center rounded-md opacity-80 hover:opacity-100 disabled:opacity-50',
                                  isE1 ? 'bg-white/15 hover:bg-white/25' : 'bg-blue-950/15 hover:bg-blue-950/25',
                                ].join(' ')}
                              >
                                <Pencil aria-hidden="true" className="size-3" />
                              </button>
                            )}
                            {dateInputValue(entry.date) >= localToday() &&
                              !entry.resultLabel &&
                              entry.goalsFor === null &&
                              entry.goalsAgainst === null && (
                              <button
                                type="button"
                                disabled={pending || pendingDeletion !== null}
                                onClick={() => removeMatch(date, entry)}
                                aria-label={'Supprimer le match contre ' + (entry.opponent || 'cet adversaire')}
                                className={[
                                  'inline-flex size-7 items-center justify-center rounded-md opacity-85 transition hover:bg-red-500/30 hover:text-red-100 disabled:opacity-50',
                                  isE1 ? 'bg-white/15' : 'bg-blue-950/15',
                                ].join(' ')}
                              >
                                <Trash2 aria-hidden="true" className="size-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      {isMatchExpanded && (
                        <div id={matchPanelId}>
                          <div className="px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-px text-[10px] font-semibold text-foreground">
                                  {entry.competition || 'Type ?'}
                                </span>
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-border bg-background px-2 py-px text-[10px] font-semibold text-foreground">
                                  <span>{homeAwayIcon}</span>
                                  <span>{entry.homeAway || 'Lieu ?'}</span>
                                </span>
                                {entry.kickoffTime && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[#d4af37]/50 bg-amber-50 px-2 py-px text-[10px] font-black text-[#172554]">
                                    <Clock3 aria-hidden="true" className="size-3" />
                                    {entry.kickoffTime}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {canManage && (
                            <div className="px-3 pb-3">
                              {matchLineups.loading ? (
                                <p className="py-2 text-xs text-muted-foreground">Chargement de la feuille…</p>
                              ) : (
                                <MatchLineupEntry
                                  match={entry}
                                  players={players}
                                  convocations={convocations}
                                  lineups={matchLineups.lineups}
                                  pendingKeys={matchLineups.pendingKeys}
                                  savedKey={matchLineups.savedKey}
                                  saveLineup={matchLineups.saveLineup}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>}
              {openCallupDate === date && canScheduleCallup && (
                <div className="p-2 pt-0 sm:p-3 sm:pt-0">
                  <CallupScheduleEntry
                    key={date}
                    players={players}
                    playerStats={playerStats}
                    convocations={convocations}
                    convocationDates={convocationDates}
                    scheduledMatchDates={entries.map((entry) => entry.date)}
                    initialDate={date}
                    trainingAttendance={trainingAttendance}
                    trainingAttendanceError={trainingAttendanceError}
                  />
                </div>
              )}
            </article>
          )
        })}
      </div>

      </div>
    </section>
  )
}
