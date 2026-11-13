'use client'

import { CircleAlert, CircleCheck, CircleHelp, CircleX } from 'lucide-react'
import type { EditableCallupStatus } from '@/lib/convocation-management'
import type { Convocation } from '@/lib/convocations'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
import type { MatchSheetEntry } from '@/lib/match-results'

export type CallupSelection = EditableCallupStatus | ''

export const CALLUP_STATUS_OPTIONS: Array<{ value: EditableCallupStatus; label: string }> = [
  { value: '✅ Convoqué E1', label: '✅ Convoqué E1' },
  { value: '✅ Convoqué E1 + E2', label: '✅ Convoqué E1 + E2' },
  { value: '❌ Non convoqué', label: '❌ Non convoqué' },
  { value: '⚠️ Convoqué absent', label: '⚠️ Convoqué absent' },
  { value: '🗓️ Absent', label: '🗓️ Absent' },
  { value: '✅ Convoqué E2', label: '✅ Convoqué E2' },
  { value: '🩺 Blessé', label: '🩺 Blessé' },
  { value: 'Pas de licence', label: 'Pas de licence' },
]

type TrainingSummary = {
  targetDate: string
  date: string
  playerStatuses?: Record<number, string>
  sessionAvailable: boolean
  isPrevious: boolean
}

function attendanceLabel(status: string | undefined) {
  if (!status) return 'Non renseigné'
  if (status === 'P') return 'Présent'
  if (status === 'AJ') return 'Abs. justifiée'
  if (status === 'AI') return 'Abs. injustifiée'
  if (status === 'B') return 'Blessé'
  if (status === 'E') return 'Exempt'
  return status
}

export function CallupPlayerList({
  players,
  playerStats,
  selections,
  trainingSessions,
  lastCompletedMatches,
  lastCompletedMatchDate,
  onSelectPlayer,
  onSelectionChange,
}: {
  players: PublicPlayer[]
  playerStats: PlayerStats[]
  selections: Record<number, CallupSelection>
  trainingSessions: TrainingSummary[]
  lastCompletedMatches: MatchSheetEntry[]
  lastCompletedMatchDate: string
  onSelectPlayer: (playerNumber: number) => void
  onSelectionChange: (playerNumber: number, value: CallupSelection) => void
}) {
  return (
    <ul className="divide-y divide-[#172554]/10 rounded-lg border border-[#172554]/15 bg-white/60">
      {players.map((player) => {
        const selection = selections[player.number] ?? ''
        const playerIre = playerStats.find((stats) => stats.number === player.number)?.ire
        const ireTone = playerIre === null || playerIre === undefined
          ? 'bg-slate-100 text-slate-700'
          : playerIre > 1.1
            ? 'bg-red-100 text-red-800'
            : playerIre < 0.9
              ? 'bg-orange-100 text-orange-800'
              : 'bg-emerald-100 text-emerald-800'
        const playerTrainingStatuses = trainingSessions.map((session) => ({
          ...session,
          status: session.playerStatuses?.[player.number],
        }))
        const teamsPlayedLastMatch = lastCompletedMatches
          .filter((match) => match.playedPlayerNumbers?.includes(player.number))
          .map((match) => match.team)
        const uniqueTeamsPlayed = [...new Set(teamsPlayedLastMatch)]
        const participationRecorded = lastCompletedMatches.length > 0 &&
          lastCompletedMatches.every((match) => match.hasParticipationData)
        const lastMatchIcon = uniqueTeamsPlayed.length > 0
          ? CircleCheck
          : participationRecorded
            ? CircleX
            : CircleHelp
        const lastMatchLabel = uniqueTeamsPlayed.length > 0
          ? `Joué · ${uniqueTeamsPlayed.join(' + ')}`
          : participationRecorded
            ? 'Pas joué'
            : 'Stats à saisir'
        const lastMatchTone = uniqueTeamsPlayed.length > 1
          ? 'bg-gradient-to-r from-sky-100 to-amber-100 text-[#172554] ring-1 ring-amber-300'
          : uniqueTeamsPlayed[0] === 'E1'
            ? 'bg-sky-100 text-[#172554] ring-1 ring-sky-300'
            : uniqueTeamsPlayed[0] === 'E2'
              ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'
              : participationRecorded
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-100 text-slate-700'
        const lastMatchDateLabel = lastCompletedMatchDate
          ? new Date(`${lastCompletedMatchDate}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
          : ''

        return (
          <li key={player.number} className="grid min-w-0 grid-cols-1 items-center gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] sm:py-2">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,auto)_auto]">
              <button
                type="button"
                onClick={() => onSelectPlayer(player.number)}
                aria-label={`Voir la fiche de ${player.firstName} ${player.lastName}`}
                className="col-start-1 row-start-1 min-w-0 truncate text-left text-sm font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
              >
                {player.firstName} <span className="font-black uppercase text-primary">{player.lastName}</span>
              </button>
              <div className="col-span-2 row-start-2 flex flex-wrap items-center gap-1.5 sm:col-start-2 sm:col-span-1 sm:row-start-1">
                {playerTrainingStatuses.map(({ targetDate, date: sessionDate, status, sessionAvailable, isPrevious }) => {
                  const sessionDateLabel = new Date(`${sessionDate}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                  const weekdayLabel = new Date(`${sessionDate}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })
                  const targetDateLabel = new Date(`${targetDate}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                  const targetWeekdayLabel = new Date(`${targetDate}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short' })
                  const label = sessionAvailable ? attendanceLabel(status) : 'Séance non trouvée'
                  const AttendanceIcon = !sessionAvailable || !status
                    ? CircleHelp
                    : status === 'P'
                      ? CircleCheck
                      : CircleAlert
                  const attendanceIconTone = !sessionAvailable || !status
                    ? 'border-slate-200 bg-slate-100 text-slate-600'
                    : status === 'P'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-700'
                      : 'border-orange-200 bg-orange-100 text-orange-700'
                  const dayInitial = weekdayLabel.toLocaleLowerCase('fr-FR').startsWith('ven') ? 'V' : 'M'
                  const attendanceDescription = isPrevious
                    ? `Séance avant ${targetWeekdayLabel} ${targetDateLabel}, tenue ${weekdayLabel} ${sessionDateLabel} : ${label}`
                    : `${weekdayLabel} ${sessionDateLabel} : ${label}`
                  return (
                    <span key={targetDate} role="img" aria-label={attendanceDescription} title={attendanceDescription} className={`relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border ${attendanceIconTone}`}>
                      <AttendanceIcon aria-hidden="true" className="size-4" />
                      <span aria-hidden="true" className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full border border-white bg-[#172554] text-[8px] font-black leading-none text-white">{dayInitial}</span>
                    </span>
                  )
                })}
                {lastCompletedMatches.length > 0 && (() => {
                  const LastMatchIcon = lastMatchIcon
                  return (
                    <span
                      title={`Dernier match (${lastMatchDateLabel}) : ${uniqueTeamsPlayed.length ? `a joué avec ${uniqueTeamsPlayed.join(' et ')}` : participationRecorded ? 'n’a pas joué' : 'temps de jeu non renseigné'}`}
                      aria-label={`Dernier match : ${lastMatchLabel}`}
                      className={`inline-flex min-h-7 items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black ${lastMatchTone}`}
                    >
                      <LastMatchIcon aria-hidden="true" className="size-3.5" />
                      {lastMatchLabel}
                    </span>
                  )
                })()}
              </div>
              <span className={`col-start-2 row-start-1 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${ireTone} sm:col-start-3`}>
                IRE {playerIre === null || playerIre === undefined ? '—' : playerIre.toFixed(2).replace('.', ',')}
              </span>
            </div>
            <label className="sr-only" htmlFor={`callup-status-${player.number}`}>
              Statut de {player.firstName} {player.lastName}
            </label>
            <select
              id={`callup-status-${player.number}`}
              value={selection}
              onChange={(event) => onSelectionChange(player.number, event.target.value as CallupSelection)}
              className="h-11 w-full min-w-0 rounded-lg border border-[#172554]/20 bg-white px-2 text-sm text-[#172554] sm:h-10 sm:w-56"
            >
              <option value="" disabled>Choisir un statut…</option>
              {CALLUP_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </li>
        )
      })}
    </ul>
  )
}
