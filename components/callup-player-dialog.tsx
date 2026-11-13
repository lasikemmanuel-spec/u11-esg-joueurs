'use client'

import { useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { countCancelledCallupsForPlayer } from '@/lib/cancelled-match-callups'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { PublicPlayer } from '@/lib/players'
import type { PlayerStats } from '@/lib/stats'
import type { TrainingAttendanceSession } from '@/lib/training-attendance'

const PlayerCard = dynamic(() => import('@/components/player-stats').then((module) => module.PlayerCard), {
  loading: () => <p role="status" className="rounded-xl bg-card p-6 text-sm text-muted-foreground">Chargement de la fiche joueur…</p>,
})

export function CallupPlayerDialog({
  player,
  playerStats,
  trainingAttendance,
  convocations,
  matchEntries,
  matchesPlayed,
  onClose,
}: {
  player: PublicPlayer | null
  playerStats: PlayerStats[]
  trainingAttendance: TrainingAttendanceSession[]
  convocations: Convocation[]
  matchEntries: MatchSheetEntry[]
  matchesPlayed: number
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const stats = player
    ? playerStats.find((entry) => entry.number === player.number) ?? {
        number: player.number,
        name: `${player.firstName} ${player.lastName}`.trim(),
        trainingRate: null,
        matchesCalled: null,
        callUpRate: null,
        starts: null,
        subs: null,
        minutes: null,
        goals: null,
        assists: null,
        ire: null,
      }
    : null
  const convocation = player
    ? convocations.find((entry) => entry.number === player.number)
    : undefined

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (player && !dialog.open) dialog.showModal()
    if (!player && dialog.open) dialog.close()
  }, [player])

  if (!player || !stats) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="selected-player-card-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-1.5rem)] w-[min(42rem,calc(100vw-1.5rem))] overflow-y-auto overscroll-contain rounded-2xl border-0 bg-transparent p-0 shadow-2xl backdrop:bg-[#07102a]/65"
    >
      <PlayerCard
        stats={stats}
        player={player}
        trainingAttendance={trainingAttendance}
        convocation={convocation}
        matchesPlayed={matchesPlayed}
        cancelledMatchesForPlayer={countCancelledCallupsForPlayer(player.number, convocations, matchEntries)}
        onClose={() => dialogRef.current?.close()}
      />
    </dialog>
  )
}
