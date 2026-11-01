'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Pencil, Plus, Save } from 'lucide-react'
import type { MatchSheetEntry } from '@/lib/match-results'
import { MATCH_RESULT_STATUSES } from '@/lib/match-result-options'

type MatchEntryStatus = {
  enabled: boolean
  role: 'educator' | 'admin' | null
  displayName: string | null
}

type Draft = {
  team: 'E1' | 'E2'
  date: string
  opponent: string
  competition: string
  homeAway: string
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
    date: localToday(),
    opponent: '',
    competition: 'Championnat',
    homeAway: 'Domicile',
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

const inputClass = 'h-10 w-full rounded-lg border border-accent/50 bg-background px-3 text-sm font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function MatchResultEntry({
  entries,
  onConnect,
}: {
  entries: MatchSheetEntry[]
  onConnect: () => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<MatchEntryStatus | null>(null)
  const [draft, setDraft] = useState<Draft>(createDraft)
  const [month, setMonth] = useState(localToday().slice(0, 7))
  const [editingSlot, setEditingSlot] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
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
  const canManage = Boolean(status?.enabled && status.role)

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

  if (!status) return null

  return (
    <section aria-labelledby="match-entry-title" className="rounded-xl border border-accent/50 bg-card p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="match-entry-title" className="font-bold text-primary">Calendrier et résultats des matchs</h2>
          <p className="mt-1 text-xs text-muted-foreground">Choisis un mois pour voir les rencontres E1 et E2.</p>
        </div>
        <div className="flex shrink-0 items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Mois
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="h-10 w-32 rounded-lg border border-accent/50 bg-background px-2 text-sm font-normal text-foreground sm:w-40"
            />
          </label>
          {canManage && (
            <button
              type="button"
              onClick={startNew}
              className="inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-primary px-2 text-xs font-bold text-primary-foreground sm:gap-1.5 sm:px-3 sm:text-sm"
            >
              <Plus aria-hidden="true" className="size-4" />
              Ajouter un match
            </button>
          )}
        </div>
      </div>

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
      ) : (
        <p role="status" className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
          {status.displayName?.trim().split(/\s+/)[0] ?? 'Éducateur'} : connecté
        </p>
      )}

      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>}

      {open && canManage && (
        <form onSubmit={save} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <h3 className="text-base font-bold text-primary sm:col-span-2">
            {editingSlot === null ? 'Planifier un match' : 'Modifier ce match'}
          </h3>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Équipe
            <select disabled={editingSlot !== null} value={draft.team} onChange={(event) => setDraft({ ...draft, team: event.target.value as Draft['team'] })} className={inputClass}>
              <option value="E1">Équipe 1</option>
              <option value="E2">Équipe 2</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Date
            <input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Adversaire
            <input required maxLength={80} value={draft.opponent} onChange={(event) => setDraft({ ...draft, opponent: event.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Type de match
            <select value={draft.competition} onChange={(event) => setDraft({ ...draft, competition: event.target.value })} className={inputClass}>
              <option>Championnat</option><option>Amical</option><option>Tournoi</option><option>Plateau</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Lieu
            <select value={draft.homeAway} onChange={(event) => setDraft({ ...draft, homeAway: event.target.value })} className={inputClass}>
              <option value="Domicile">Domicile</option><option value="Extérieur">Extérieur</option><option value="Terrain neutre">Terrain neutre</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Buts ESG
              <input type="number" min="0" max="50" step="1" value={draft.goalsFor} onChange={(event) => setDraft({ ...draft, goalsFor: event.target.value })} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Buts adversaire
              <input type="number" min="0" max="50" step="1" value={draft.goalsAgainst} onChange={(event) => setDraft({ ...draft, goalsAgainst: event.target.value })} className={inputClass} />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Résultat à inscrire dans le Sheet
            <select value={draft.resultLabel} onChange={(event) => setDraft({ ...draft, resultLabel: event.target.value })} className={inputClass}>
              <option value="">À jouer / aucun résultat</option>
              {MATCH_RESULT_STATUSES.map((label) => <option key={label} value={label}>{label}</option>)}
            </select>
          </label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Saisis les deux scores et choisis Gagné, Nul ou Perdu. Pour un match à venir, laisse score et résultat vides.
          </p>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
              <Save aria-hidden="true" className="size-4" />
              {pending ? 'Enregistrement…' : editingSlot === null ? 'Ajouter au calendrier' : 'Enregistrer les modifications'}
            </button>
            <button type="button" disabled={pending} onClick={() => { setOpen(false); setEditingSlot(null) }} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground">Annuler</button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {monthEntries.length === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
            Aucun match enregistré pour ce mois.
          </p>
        ) : monthEntries.map((entry) => (
          <article key={entry.team + '-' + entry.slotColumn} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">
                {entry.date} · Équipe {entry.team === 'E1' ? '1' : '2'} · {entry.competition || 'Type à préciser'}
              </p>
              <h3 className="mt-1 truncate font-bold text-foreground">{entry.opponent || 'Adversaire à préciser'}</h3>
              <p className="text-xs text-muted-foreground">{entry.homeAway || 'Lieu à préciser'}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-muted px-3 py-2 font-mono text-sm font-bold text-primary">
                {entry.resultLabel === 'Annulé'
                  ? 'Annulé'
                  : entry.goalsFor === null || entry.goalsAgainst === null
                    ? 'À jouer'
                    : (getEditableResult(entry) ? getEditableResult(entry) + ' · ' : '') + entry.goalsFor + ' – ' + entry.goalsAgainst}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => startEdit(entry)}
                  aria-label={'Modifier le match contre ' + (entry.opponent || 'cet adversaire')}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-accent/50 px-3 text-xs font-semibold text-primary"
                >
                  <Pencil aria-hidden="true" className="size-3.5" />
                  Modifier
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays aria-hidden="true" className="size-3.5" />
        Le match reste sur sa ligne E1/E2 quand tu modifies sa date, son adversaire ou son score.
      </p>
    </section>
  )
}
