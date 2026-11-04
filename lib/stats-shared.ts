export type PlayerStats = {
  number: number
  name: string
  trainingRate: number | null
  matchesCalled: number | null
  callUpRate: number | null
  starts: number | null
  subs: number | null
  minutes: number | null
  goals: number | null
  assists: number | null
  ire: number | null
}

export type IreStatus = 'fair' | 'under' | 'over' | 'none'

export type StatsData = {
  players: PlayerStats[]
  teamTrainingRate: number | null
}

export function ireStatus(stats: PlayerStats): IreStatus {
  if (stats.ire === null || stats.ire === 0 || !stats.matchesCalled) return 'none'
  if (stats.ire < 0.9) return 'under'
  if (stats.ire > 1.1) return 'over'
  return 'fair'
}

