'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Save } from 'lucide-react'

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
  goalsFor: string
  goalsAgainst: string
}

const initialDraft = (): Draft => ({
  team: 'E1',
  date: new Date().toISOString().slice(0, 10),
  opponent: '',
  competition: 'Championnat',
  homeAway: 'Domicile',
  goalsFor: '',
  goalsAgainst: '',
})

export function MatchResultEntry({ onOpenEducators }: { onOpenEducators: () => void }) {
  const router = useRouter()
  const [status, setStatus] = useState<MatchEntryStatus | null>(null)
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    fetch('/api/match-results', { cache: 'no-store' })
      .then(async (response) => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error ?? 'Impossible de vérifier les droits.')
        if (active) setStatus(result as MatchEntryStatus)
      })
      .catch(() => {
        if (active) setStatus({ enabled: false, role: null, displayName: null })
      })
    return () => { active = false }
  }, [])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/match-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          goalsFor: Number(draft.goalsFor),
          goalsAgainst: Number(draft.goalsAgainst),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer le résultat.')
      setNotice('Résultat enregistré dans « ' + result.sheetTitle + ' ».')
      setDraft(initialDraft())
      setOpen(false)
      router.refresh()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer le résultat.')
    } finally {
      setPending(false)
    }
  }

  if (!status) return null

  return (
    <section aria-labelledby="match-entry-title" className="rounded-xl border border-accent/50 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="match-entry-title" className="font-bold text-primary">Saisir un résultat</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Le score sera ajouté à la feuille de l’équipe choisie.
          </p>
        </div>
        {status.enabled && status.role === 'admin' && (
          <button
            type="button"
            onClick={() => { setOpen((current) => !current); setError('') }}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
          >
            <CalendarDays aria-hidden="true" className="size-4" />
            {open ? 'Fermer' : 'Nouveau résultat'}
          </button>
        )}
      </div>

      {!status.enabled ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          L’enregistrement vers E1/E2 est désactivé dans cette prévisualisation.
        </p>
      ) : status.role === null ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
          <p className="text-sm text-muted-foreground">Connecte-toi comme administrateur pour saisir un score.</p>
          <button type="button" onClick={onOpenEducators} className="text-sm font-semibold text-primary underline">
            Ouvrir Éducateurs
          </button>
        </div>
      ) : status.role !== 'admin' ? (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          La saisie des résultats est réservée à l’administrateur.
        </p>
      ) : null}

      {notice && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-destructive">{error}</p>}

      {open && status.enabled && status.role === 'admin' && (
        <form onSubmit={save} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Équipe
            <select value={draft.team} onChange={(event) => setDraft({ ...draft, team: event.target.value as Draft['team'] })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal">
              <option value="E1">Équipe 1</option>
              <option value="E2">Équipe 2</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Date du match
            <input type="date" required value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Adversaire
            <input required maxLength={80} value={draft.opponent} onChange={(event) => setDraft({ ...draft, opponent: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Type de match
            <select value={draft.competition} onChange={(event) => setDraft({ ...draft, competition: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal">
              <option>Championnat</option><option>Amical</option><option>Tournoi</option><option>Plateau</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Lieu
            <select value={draft.homeAway} onChange={(event) => setDraft({ ...draft, homeAway: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal">
              <option value="Domicile">Domicile</option><option value="Extérieur">Extérieur</option><option value="Terrain neutre">Terrain neutre</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Buts ESG
              <input type="number" min="0" max="50" step="1" required value={draft.goalsFor} onChange={(event) => setDraft({ ...draft, goalsFor: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold">
              Buts adversaire
              <input type="number" min="0" max="50" step="1" required value={draft.goalsAgainst} onChange={(event) => setDraft({ ...draft, goalsAgainst: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <button type="submit" disabled={pending} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-60">
              <Save aria-hidden="true" className="size-4" />
              {pending ? 'Enregistrement…' : 'Enregistrer le résultat'}
            </button>
            <button type="button" disabled={pending} onClick={() => setOpen(false)} className="min-h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground">Annuler</button>
          </div>
        </form>
      )}
    </section>
  )
}
