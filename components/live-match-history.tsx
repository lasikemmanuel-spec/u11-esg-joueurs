'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { History, X } from 'lucide-react'
import type {
  LiveMatchEvent,
  LiveMatchHistoryEntry,
  LiveMatchSummary,
  LiveMatchTeam,
} from '@/lib/live-match-shared'
import { formatLiveMinute, getLiveMatchFormat } from '@/lib/live-match-shared'
import type { PublicPlayer } from '@/lib/players'

type HistoryItem = LiveMatchHistoryEntry & { summary: LiveMatchSummary }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHistoryItem(value: unknown): value is HistoryItem {
  if (!isRecord(value) || typeof value.id !== 'string' ||
    typeof value.archivedAt !== 'string' || !isRecord(value.match) ||
    !isRecord(value.session) || !isRecord(value.summary)) return false
  const { match, session, summary } = value
  return typeof match.opponent === 'string' &&
    typeof match.competition === 'string' &&
    typeof match.homeAway === 'string' &&
    typeof match.kickoffTime === 'string' &&
    typeof session.date === 'string' &&
    (session.team === 'E1' || session.team === 'E2') &&
    typeof session.slotColumn === 'number' &&
    Array.isArray(session.starters) &&
    Array.isArray(session.substitutes) &&
    Array.isArray(session.events) &&
    session.completed === true &&
    typeof summary.goalsFor === 'number' &&
    typeof summary.goalsAgainst === 'number' &&
    Array.isArray(summary.players) &&
    summary.players.every((player) =>
      isRecord(player) &&
      typeof player.number === 'number' &&
      typeof player.minutes === 'number' &&
      typeof player.goals === 'number' &&
      typeof player.assists === 'number',
    )
}

function playerName(players: PublicPlayer[], number: number) {
  const player = players.find((item) => item.number === number)
  return player ? `${player.firstName} ${player.lastName}` : `N° ${number}`
}

function teamName(team: LiveMatchTeam) {
  return `ES Genech ${team === 'E1' ? '1' : '2'}`
}

function describeEvent(event: LiveMatchEvent, item: HistoryItem, players: PublicPlayer[]) {
  if (event.kind === 'goal') {
    if (event.side === 'against') return `But adverse · ${item.match.opponent || 'Adversaire'}`
    const scorer = event.scorerNumber ? playerName(players, event.scorerNumber) : 'ES Genech'
    const assist = event.assistNumber ? ` · passe de ${playerName(players, event.assistNumber)}` : ''
    return `But de ${scorer}${assist}`
  }
  return `${playerName(players, event.playerOut)} sort · ${playerName(players, event.playerIn)} entre`
}

export function LiveMatchHistory({
  players,
  compact = false,
  tone = 'dark',
  match,
}: {
  players: PublicPlayer[]
  compact?: boolean
  tone?: 'dark' | 'light'
  match: {
    date: string
    team: LiveMatchTeam
    slotColumn: number
    opponent: string
    score: string
  }
}) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<HistoryItem[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const selected = history?.find((item) => item.id === selectedId) ?? history?.[0]

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const openHistory = async () => {
    setOpen(true)
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/educators/live-match?history=1', { cache: 'no-store' })
      const result = await response.json() as { error?: string; history?: unknown }
      if (!response.ok) throw new Error(result.error ?? 'Impossible de charger l’historique.')
      const historyItems = result.history
      if (!isHistoryItems(historyItems)) {
        throw new Error('L’historique reçu est invalide.')
      }
      const matchHistory = historyItems.filter((item) =>
        item.session.date === match.date &&
        item.session.team === match.team &&
        item.session.slotColumn === match.slotColumn,
      )
      setHistory(matchHistory)
      setSelectedId((current) =>
        matchHistory.some((item) => item.id === current)
          ? current
          : matchHistory[0]?.id ?? '',
      )
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Impossible de charger l’historique.')
    } finally {
      setLoading(false)
    }
  }

  function isHistoryItems(value: unknown): value is HistoryItem[] {
    return Array.isArray(value) && value.every(isHistoryItem)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void openHistory()}
        aria-label={`Voir la feuille du match contre ${match.opponent}, ${match.score}`}
        className={[
          'inline-flex min-h-10 shrink-0 items-center gap-2 text-xs font-black transition',
          compact
            ? tone === 'dark'
              ? 'rounded-xl border border-white/20 bg-white/10 px-3 text-white hover:bg-white/15'
              : 'rounded-xl border border-blue-950/15 bg-blue-950/10 px-3 text-blue-950 hover:bg-blue-950/20'
            : 'mt-4 rounded-full border border-white/20 bg-white/10 px-4 text-white hover:bg-white/15',
        ].join(' ')}
      >
        <History aria-hidden="true" className={`size-4 ${tone === 'dark' ? 'text-amber-200' : 'text-blue-950'}`} />
        {compact ? 'Feuille' : 'Historique des feuilles'}
      </button>
      {open && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-[#07102a]/80 p-2 backdrop-blur-sm sm:p-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="live-match-history-title"
            className="flex max-h-[96dvh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-amber-200/50 bg-[#172554] text-white shadow-2xl"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Archives du direct</p>
                <h2 id="live-match-history-title" className="mt-1 text-xl font-black">Feuille du match</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer l’historique"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10 hover:bg-white/20"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </header>
            <div className="min-h-0 overflow-y-auto p-4">
              {loading && <p role="status" className="py-8 text-center text-sm text-white/70">Chargement de l’historique…</p>}
              {error && <p role="alert" className="rounded-xl border border-rose-200/30 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p>}
              {history?.length === 0 && !loading && (
                <p className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-sm text-white/70">
                  Aucune feuille archivée pour ce match. Les feuilles des matchs terminés avant l’activation de l’historique ne sont pas disponibles.
                </p>
              )}
              {history && history.length > 0 && (
                <div className="space-y-4">
                  <label className="block text-xs font-bold text-white/70">
                    Feuille enregistrée
                    <select
                      value={selected?.id ?? ''}
                      onChange={(event) => setSelectedId(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/15 bg-[#101c41] px-3 text-sm text-white"
                    >
                      {history.map((item) => (
                        <option key={item.id} value={item.id}>
                          {new Date(`${item.session.date}T12:00:00`).toLocaleDateString('fr-FR')} · {teamName(item.session.team)} · {item.match.opponent} · {item.summary.goalsFor}–{item.summary.goalsAgainst}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected && (
                    <article className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-center">
                        <p className="text-xs font-bold text-white/60">
                          {new Date(`${selected.session.date}T12:00:00`).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                          })}
                          {selected.match.competition ? ` · ${selected.match.competition}` : ''}
                        </p>
                        <p className="mt-2 text-sm font-black sm:text-base">
                          {teamName(selected.session.team)} · {selected.match.homeAway || 'Lieu non renseigné'}
                        </p>
                        <p className="mt-1 text-lg font-black">
                          {selected.summary.goalsFor} – {selected.summary.goalsAgainst}
                        </p>
                        <p className="text-sm font-bold text-white/75">{selected.match.opponent || 'Adversaire non renseigné'}</p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        {([
                          ['Titulaires', selected.session.starters],
                          ['Remplaçants', selected.session.substitutes],
                        ] as const).map(([label, numbers]) => (
                          <section key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                            <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-amber-200">{label}</h3>
                            {numbers.length > 0 ? (
                              <ul className="space-y-1 text-sm">
                                {numbers.map((number) => (
                                  <li key={number}>{playerName(players, number)}</li>
                                ))}
                              </ul>
                            ) : <p className="text-sm text-white/55">Aucun joueur enregistré.</p>}
                          </section>
                        ))}
                      </div>

                      <section className="overflow-hidden rounded-xl border border-white/10">
                        <h3 className="bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-wide">Temps de jeu et statistiques</h3>
                        <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3rem_3.5rem] gap-2 px-3 py-2 text-[10px] font-black uppercase text-white/55">
                          <span>Joueur</span><span className="text-right">Min</span><span className="text-right">Buts</span><span className="text-right">Passes</span>
                        </div>
                        {selected.summary.players.map((player) => (
                          <div key={player.number} className="grid grid-cols-[minmax(0,1fr)_3.5rem_3rem_3.5rem] gap-2 border-t border-white/10 px-3 py-2 text-sm">
                            <span className="truncate">{playerName(players, player.number)}</span>
                            <span className="text-right font-bold tabular-nums">{player.minutes}</span>
                            <span className="text-right font-bold tabular-nums">{player.goals}</span>
                            <span className="text-right font-bold tabular-nums">{player.assists}</span>
                          </div>
                        ))}
                      </section>

                      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <h3 className="mb-2 text-xs font-black uppercase tracking-wide text-amber-200">Actions du match</h3>
                        {selected.session.events.length > 0 ? (
                          <ol className="space-y-2">
                            {selected.session.events
                              .map((event, index) => ({ event, index }))
                              .sort((left, right) => left.event.minute - right.event.minute || left.index - right.index)
                              .map(({ event }) => (
                                <li key={event.id} className="flex items-start gap-2 text-sm">
                                  <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-black text-amber-200">
                                    {formatLiveMinute(event.minute, getLiveMatchFormat(selected.session))}
                                  </span>
                                  <span>{describeEvent(event, selected, players)}</span>
                                </li>
                              ))}
                          </ol>
                        ) : <p className="text-sm text-white/55">Aucune action enregistrée.</p>}
                      </section>
                    </article>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
