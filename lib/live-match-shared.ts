export type LiveMatchTeam = 'E1' | 'E2'

export type LiveMatchFormat = {
  periods: 2 | 3
  minutesPerPeriod: number
}

export type LiveMatchEvent =
  | {
      id: string
      minute: number
      kind: 'goal'
      side: 'for' | 'against'
      scorerNumber?: number
      assistNumber?: number
    }
  | {
      id: string
      minute: number
      kind: 'substitution'
      playerOut: number
      playerIn: number
    }

export type LiveMatchSession = {
  date: string
  team: LiveMatchTeam
  slotColumn: number
  phase: 'ready' | 'firstHalf' | 'halftime' | 'secondHalf' | 'secondHalftime' | 'thirdPeriod' | 'finished'
  elapsedSeconds: number
  runningSince: string | null
  format?: LiveMatchFormat
  starters: number[]
  substitutes: number[]
  events: LiveMatchEvent[]
  completed: boolean
}

export type LivePlayerSummary = {
  number: number
  minutes: number
  goals: number
  assists: number
}

export type LiveMatchSummary = {
  goalsFor: number
  goalsAgainst: number
  players: LivePlayerSummary[]
  elapsedSeconds: number
}

export const DEFAULT_LIVE_MATCH_FORMAT: LiveMatchFormat = {
  periods: 2,
  minutesPerPeriod: 25,
}

export function isLiveMatchFormat(value: unknown): value is LiveMatchFormat {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const format = value as Record<string, unknown>
  return (format.periods === 2 || format.periods === 3) &&
    typeof format.minutesPerPeriod === 'number' &&
    Number.isSafeInteger(format.minutesPerPeriod) &&
    format.minutesPerPeriod >= 1 &&
    format.minutesPerPeriod <= 60
}

export function getLiveMatchFormat(session: Pick<LiveMatchSession, 'format'>): LiveMatchFormat {
  return session.format ?? DEFAULT_LIVE_MATCH_FORMAT
}

export function getLiveMatchMaximumSeconds(format: LiveMatchFormat) {
  return format.periods * format.minutesPerPeriod * 60
}

function periodForPhase(phase: LiveMatchSession['phase'], format: LiveMatchFormat, elapsedSeconds: number) {
  if (phase === 'secondHalf' || phase === 'secondHalftime') return 2
  if (phase === 'thirdPeriod') return 3
  if (phase === 'finished') {
    return Math.min(
      format.periods,
      Math.max(1, Math.ceil(elapsedSeconds / (format.minutesPerPeriod * 60))),
    )
  }
  return 1
}

export function getLiveElapsedSeconds(session: LiveMatchSession, now = Date.now()) {
  const maximumSeconds = getLiveMatchMaximumSeconds(getLiveMatchFormat(session))
  const runningSince = session.runningSince ? Date.parse(session.runningSince) : NaN
  const addedSeconds = Number.isFinite(runningSince)
    ? Math.max(0, Math.floor((now - runningSince) / 1000))
    : 0
  return Math.min(maximumSeconds, session.elapsedSeconds + addedSeconds)
}

export function getLiveMinute(session: LiveMatchSession, now = Date.now()) {
  const format = getLiveMatchFormat(session)
  const elapsedSeconds = getLiveElapsedSeconds(session, now)
  const period = periodForPhase(session.phase, format, elapsedSeconds)
  const periodStartSeconds = (period - 1) * format.minutesPerPeriod * 60
  const periodMinute = session.phase === 'halftime' || session.phase === 'secondHalftime' ||
    session.phase === 'finished' && elapsedSeconds === period * format.minutesPerPeriod * 60
    ? format.minutesPerPeriod
    : Math.min(
        format.minutesPerPeriod,
        Math.max(1, period === 1
          ? Math.ceil(elapsedSeconds / 60)
          : Math.floor((elapsedSeconds - periodStartSeconds) / 60) + 1),
      )
  return Math.min(
    format.periods * format.minutesPerPeriod,
    (period - 1) * format.minutesPerPeriod + periodMinute,
  )
}

export function formatLiveMinute(minute: number, format: LiveMatchFormat = DEFAULT_LIVE_MATCH_FORMAT) {
  const period = Math.floor((minute - 1) / format.minutesPerPeriod)
  const periodMinute = minute - period * format.minutesPerPeriod
  return period === 0 ? `${periodMinute}′` : `${periodMinute}+${period * format.minutesPerPeriod}′`
}

export function getLivePlayersOnPitch(session: LiveMatchSession) {
  const onPitch = new Set(session.starters)
  for (const event of session.events) {
    if (event.kind !== 'substitution') continue
    onPitch.delete(event.playerOut)
    onPitch.add(event.playerIn)
  }
  return onPitch
}

function elapsedSecondsAtMinute(minute: number, format: LiveMatchFormat) {
  if (minute <= 0) return 0
  const period = Math.floor((minute - 1) / format.minutesPerPeriod)
  const periodMinute = minute - period * format.minutesPerPeriod
  const elapsedMinutes = period === 0
    ? periodMinute
    : period * format.minutesPerPeriod + periodMinute - 1
  return elapsedMinutes * 60
}

export function createLiveMatchSession(input: {
  date: string
  team: LiveMatchTeam
  slotColumn: number
  starters: number[]
  substitutes: number[]
  format?: LiveMatchFormat
}): LiveMatchSession {
  return {
    ...input,
    format: input.format ?? DEFAULT_LIVE_MATCH_FORMAT,
    phase: 'ready',
    elapsedSeconds: 0,
    runningSince: null,
    events: [],
    completed: false,
  }
}

export function calculateLiveMatchSummary(session: LiveMatchSession, now = Date.now()): LiveMatchSummary {
  const allPlayers = [...session.starters, ...session.substitutes]
  if (
    session.starters.length === 0 ||
    session.starters.length > 8 ||
    allPlayers.some((number) => !Number.isSafeInteger(number) || number <= 0) ||
    new Set(allPlayers).size !== allPlayers.length
  ) {
    throw new Error('La composition de départ est invalide.')
  }

  const availablePlayers = new Set(allPlayers)
  const onPitch = new Set(session.starters)
  const enteredAt = new Map<number, number>(session.starters.map((number) => [number, 0]))
  const secondsPlayed = new Map<number, number>(allPlayers.map((number) => [number, 0]))
  const goals = new Map<number, number>()
  const assists = new Map<number, number>()
  const format = getLiveMatchFormat(session)
  let goalsFor = 0
  let goalsAgainst = 0

  for (const event of session.events) {
    if (!Number.isSafeInteger(event.minute) || event.minute < 1 || event.minute > format.periods * format.minutesPerPeriod) {
      throw new Error('Une action contient une minute invalide.')
    }

    if (event.kind === 'goal') {
      if (event.side === 'against') {
        goalsAgainst += 1
        continue
      }
      goalsFor += 1
      if (event.scorerNumber !== undefined) {
        if (!availablePlayers.has(event.scorerNumber) || !onPitch.has(event.scorerNumber)) {
          throw new Error('Le buteur doit être un joueur présent sur le terrain à cette minute.')
        }
        goals.set(event.scorerNumber, (goals.get(event.scorerNumber) ?? 0) + 1)
      }
      if (event.assistNumber !== undefined) {
        if (!availablePlayers.has(event.assistNumber) || !onPitch.has(event.assistNumber)) {
          throw new Error('Le passeur doit être un joueur présent sur le terrain à cette minute.')
        }
        assists.set(event.assistNumber, (assists.get(event.assistNumber) ?? 0) + 1)
      }
      continue
    }

    const { playerOut, playerIn } = event
    if (
      !availablePlayers.has(playerOut) ||
      !availablePlayers.has(playerIn) ||
      playerOut === playerIn ||
      !onPitch.has(playerOut) ||
      onPitch.has(playerIn)
    ) {
      throw new Error('Remplacement invalide : vérifie les joueurs présents sur le terrain et sur le banc.')
    }
    const startMinute = enteredAt.get(playerOut)
    if (startMinute === undefined) throw new Error('Impossible de calculer le temps de jeu du joueur remplacé.')
    secondsPlayed.set(
      playerOut,
      (secondsPlayed.get(playerOut) ?? 0) +
        elapsedSecondsAtMinute(event.minute, format) - elapsedSecondsAtMinute(startMinute, format),
    )
    enteredAt.delete(playerOut)
    onPitch.delete(playerOut)
    onPitch.add(playerIn)
    enteredAt.set(playerIn, event.minute)
  }

  const elapsedSeconds = getLiveElapsedSeconds(session, now)
  for (const number of onPitch) {
    const startMinute = enteredAt.get(number)
    if (startMinute !== undefined) {
      secondsPlayed.set(
        number,
        (secondsPlayed.get(number) ?? 0) +
        Math.max(0, elapsedSeconds - elapsedSecondsAtMinute(startMinute, format)),
      )
    }
  }

  return {
    goalsFor,
    goalsAgainst,
    elapsedSeconds,
    players: allPlayers.map((number) => ({
      number,
      minutes: Math.round((secondsPlayed.get(number) ?? 0) / 60),
      goals: goals.get(number) ?? 0,
      assists: assists.get(number) ?? 0,
    })),
  }
}

export function areLiveSessionsEqual(
  left: LiveMatchSession | null,
  right: LiveMatchSession | null,
): boolean {
  if (left === right) return true
  if (!left || !right) return false

  if (
    left.date !== right.date ||
    left.team !== right.team ||
    left.slotColumn !== right.slotColumn ||
    left.phase !== right.phase ||
    getLiveMatchFormat(left).periods !== getLiveMatchFormat(right).periods ||
    getLiveMatchFormat(left).minutesPerPeriod !== getLiveMatchFormat(right).minutesPerPeriod ||
    left.completed !== right.completed ||
    left.runningSince !== right.runningSince ||
    left.elapsedSeconds !== right.elapsedSeconds ||
    left.events.length !== right.events.length
  ) {
    return false
  }

  for (let i = 0; i < left.events.length; i += 1) {
    const a = left.events[i]
    const b = right.events[i]
    if (a.id !== b.id || a.minute !== b.minute || a.kind !== b.kind) return false
    if (a.kind === 'goal' && b.kind === 'goal') {
      if (a.side !== b.side || a.scorerNumber !== b.scorerNumber || a.assistNumber !== b.assistNumber) {
        return false
      }
    } else if (a.kind === 'substitution' && b.kind === 'substitution') {
      if (a.playerOut !== b.playerOut || a.playerIn !== b.playerIn) return false
    }
  }

  return true
}
