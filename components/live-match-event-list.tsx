'use client'

import { Check, CircleHelp, Pencil, Trash2, X } from 'lucide-react'
import type { PublicPlayer } from '@/lib/players'
import { formatLiveMinute, getLiveMatchFormat, type LiveMatchSession } from '@/lib/live-match-shared'

function playerName(players: PublicPlayer[], number: number) {
  const player = players.find((item) => item.number === number)
  return player ? `${player.firstName} ${player.lastName}` : `N° ${number}`
}

export function LiveMatchEventList({
  session,
  players,
  opponent,
  currentMinute,
  saving,
  editingEventId,
  editingEventMinute,
  onEditingMinuteChange,
  onEdit,
  onCancelEdit,
  onSaveMinute,
  onRemove,
}: {
  session: LiveMatchSession
  players: PublicPlayer[]
  opponent: string
  currentMinute: number
  saving: boolean
  editingEventId: string | null
  editingEventMinute: string
  onEditingMinuteChange: (minute: string) => void
  onEdit: (eventId: string, minute: number) => void
  onCancelEdit: () => void
  onSaveMinute: (eventId: string) => void
  onRemove: (eventId: string) => void
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="font-black">Actions du match</h3>
        <span className="text-xs text-white/55">{session.events.length} action{session.events.length === 1 ? '' : 's'}</span>
      </div>
      {session.events.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-white/55"><CircleHelp aria-hidden="true" className="size-4" />Les buts et changements apparaîtront ici.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {[...session.events].reverse().map((event) => (
            <li key={event.id} className="flex items-center gap-3 rounded-xl bg-white/[0.06] px-3 py-2">
              {editingEventId === event.id ? (
                <label className="flex shrink-0 items-center gap-1 text-xs font-bold text-white/70">
                  Min
                  <input
                    type="number"
                    min={1}
                    max={currentMinute}
                    value={editingEventMinute}
                    onChange={(inputEvent) => onEditingMinuteChange(inputEvent.target.value)}
                    aria-label="Minute de l’action"
                    className="h-9 w-16 rounded-lg border border-white/15 bg-[#101c41] px-2 text-center text-sm text-white"
                  />
                </label>
              ) : (
                <span className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs font-black text-amber-200">{formatLiveMinute(event.minute, getLiveMatchFormat(session))}</span>
              )}
              <p className="min-w-0 flex-1 text-sm font-semibold">
                {event.kind === 'goal'
                  ? event.side === 'against'
                    ? `But adverse · ${opponent || 'Adversaire'}`
                    : `But ${event.scorerNumber ? playerName(players, event.scorerNumber) : 'ESG'}${event.assistNumber ? ` · passe ${playerName(players, event.assistNumber)}` : ''}`
                  : `${playerName(players, event.playerOut)} sort · ${playerName(players, event.playerIn)} entre`}
              </p>
              {!session.completed && (editingEventId === event.id ? (
                <>
                  <button type="button" disabled={saving} onClick={() => onSaveMinute(event.id)} aria-label="Enregistrer la minute" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-emerald-200 hover:bg-emerald-400/15 disabled:opacity-30">
                    <Check aria-hidden="true" className="size-4" />
                  </button>
                  <button type="button" disabled={saving} onClick={onCancelEdit} aria-label="Annuler la modification" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 disabled:opacity-30">
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </>
              ) : (
                <button type="button" disabled={saving || editingEventId !== null} onClick={() => onEdit(event.id, event.minute)} aria-label={`Modifier la minute ${formatLiveMinute(event.minute, getLiveMatchFormat(session))}`} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-white/10 disabled:opacity-30">
                  <Pencil aria-hidden="true" className="size-4" />
                </button>
              ))}
              <button type="button" disabled={saving || session.completed} onClick={() => onRemove(event.id)} aria-label="Annuler cette action" className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white/55 hover:bg-rose-400/15 hover:text-rose-200 disabled:opacity-30">
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
