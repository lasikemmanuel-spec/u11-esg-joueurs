'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, RefreshCw, Save } from 'lucide-react'
import type { PublicPlayer } from '@/lib/players'
import {
  TRAINING_ATTENDANCE_STATUSES,
  type TrainingAttendanceSession,
  type TrainingAttendanceStatus,
} from '@/lib/training-attendance-shared'
import { MATCH_SEASON_END, MATCH_SEASON_START } from '@/lib/match-season'

function nextTrainingDate() {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  while (date.getDay() !== 2 && date.getDay() !== 5) date.setDate(date.getDate() + 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export function TrainingAttendanceManager({
  players,
  sessions,
  loadError,
}: {
  players: PublicPlayer[]
  sessions: TrainingAttendanceSession[]
  loadError: boolean
}) {
  const router = useRouter()
  const [date, setDate] = useState('')
  const [statuses, setStatuses] = useState<Record<number, TrainingAttendanceStatus | ''>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!date) setDate(nextTrainingDate())
  }, [date])

  const savedSession = useMemo(() => sessions.find((session) => session.date === date), [sessions, date])
  useEffect(() => {
    const next: Record<number, TrainingAttendanceStatus | ''> = {}
    for (const player of players) {
      const value = savedSession?.playerStatuses[player.number] ?? ''
      next[player.number] = TRAINING_ATTENDANCE_STATUSES.some((status) => status.value === value)
        ? value as TrainingAttendanceStatus
        : ''
    }
    setStatuses(next)
    setMessage('')
    setError('')
  }, [date, savedSession, players])

  const counts = useMemo(() => {
    let filled = 0
    let present = 0
    for (const value of Object.values(statuses)) {
      if (!value) continue
      filled += 1
      if (value === 'P') present += 1
    }
    return { filled, present, missing: players.length - filled }
  }, [players.length, statuses])

  const setAllPresent = () => {
    setStatuses(Object.fromEntries(players.map((player) => [player.number, 'P'])))
    setMessage('')
    setError('')
  }

  const save = async () => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/educators/training-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          entries: players.map((player) => ({ number: player.number, status: statuses[player.number] })),
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Enregistrement impossible.')
      setMessage('Présences enregistrées dans le classeur Google.')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Enregistrement impossible.')
    } finally {
      setSaving(false)
    }
  }

  const canSave = Boolean(date) && !loadError && players.length > 0 && counts.missing === 0 && !saving

  return (
    <section className="flex flex-col gap-5" aria-labelledby="training-attendance-title">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-amber-700">Espace éducateur</p>
          <h2 id="training-attendance-title" className="text-2xl font-black text-primary">Présences aux entraînements</h2>
          <p className="mt-1 text-sm text-muted-foreground">Séances habituelles le mardi et le vendredi. Tu peux modifier la date si besoin.</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <CalendarDays aria-hidden="true" className="size-4" />
          {sessions.length} séance{sessions.length === 1 ? '' : 's'} dans l’historique
        </div>
      </header>

      <div className="grid gap-4 rounded-2xl border border-accent/40 bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1.5 text-sm font-bold">
          Date de la séance
          <input
            type="date"
            min={MATCH_SEASON_START}
            max={MATCH_SEASON_END}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="h-11 rounded-xl border border-accent/50 bg-background px-3 font-medium"
          />
        </label>
        <button type="button" onClick={setAllPresent} disabled={!players.length || loadError} className="min-h-11 rounded-xl border border-emerald-700/30 bg-emerald-50 px-4 text-sm font-bold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50">
          <Check aria-hidden="true" className="mr-2 inline size-4" />Tous présents
        </button>
      </div>

      {loadError && (
        <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">L’historique du classeur n’a pas pu être chargé.</p>
          <p className="mt-1">Actualise la page avant de saisir une séance pour éviter d’écraser des données.</p>
          <button type="button" onClick={() => router.refresh()} className="mt-3 font-bold underline"><RefreshCw aria-hidden="true" className="mr-1 inline size-4" />Réessayer</button>
        </div>
      )}

      {players.length === 0 ? (
        <p role="status" className="rounded-xl bg-muted p-4 text-sm">Aucun joueur dans l’effectif.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/70 px-4 py-3 text-sm">
            <span><strong>{counts.filled}/{players.length}</strong> renseignés · <strong>{counts.present}</strong> présents</span>
            {counts.missing > 0 && <span className="font-semibold text-amber-800">{counts.missing} à compléter</span>}
            {savedSession && <span className="font-semibold text-primary">Séance déjà saisie · la sauvegarde remplacera ses valeurs.</span>}
          </div>

          <ul className="grid gap-2 md:grid-cols-2">
            {players.map((player) => (
              <li key={player.number} className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="min-w-8 rounded-md bg-primary/10 px-1.5 py-0.5 text-center text-sm font-black text-primary">{player.number}</span>
                  <span className="truncate font-bold">{player.firstName} {player.lastName}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {TRAINING_ATTENDANCE_STATUSES.map((status) => {
                    const selected = statuses[player.number] === status.value
                    return (
                      <button
                        key={status.value}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${player.firstName} ${player.lastName} : ${status.label}`}
                        title={status.label}
                        onClick={() => {
                          setStatuses((current) => ({ ...current, [player.number]: status.value }))
                          setMessage('')
                          setError('')
                        }}
                        className={`min-h-10 rounded-lg border px-1 text-[11px] font-bold leading-tight transition ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:border-primary/50'}`}
                      >
                        {status.shortLabel}
                      </button>
                    )
                  })}
                </div>
              </li>
            ))}
          </ul>

          <footer className="sticky bottom-20 z-10 flex flex-col gap-2 rounded-2xl border border-accent/40 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between xl:bottom-3">
            <span className="text-sm text-muted-foreground">{date ? formatDate(date) : 'Choisis une date'}</span>
            <button type="button" onClick={() => void save()} disabled={!canSave} className="min-h-12 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-6 font-black text-blue-950 shadow hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50">
              <Save aria-hidden="true" className="mr-2 inline size-4" />{saving ? 'Enregistrement…' : savedSession ? 'Mettre à jour la séance' : 'Enregistrer les présences'}
            </button>
          </footer>
          {message && <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{message}</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{error}</p>}
        </>
      )}
    </section>
  )
}
