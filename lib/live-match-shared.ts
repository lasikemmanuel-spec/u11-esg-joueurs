export type LiveMatchTeam = 'E1' | 'E2'

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
  phase: 'ready' | 'firstHalf' | 'halftime' | 'secondHalf' | 'finished'
  elapsedSeconds: number
  runningSince: string | null
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

export function getLiveElapsedSeconds(session: LiveMatchSession, now = Date.now()) {
  const runningSince = session.runningSince ? Date.parse(session.runningSince) : NaN
  const addedSeconds = Number.isFinite(runningSince)
    ? Math.max(0, Math.floor((now - runningSince) / 1000))
    : 0
  return Math.min(50 * 60, session.elapsedSeconds + addedSeconds)
}

export function getLiveMinute(session: LiveMatchSession, now = Date.now()) {
  const elapsedSeconds = getLiveElapsedSeconds(session, now)
  if (
    (session.phase === 'secondHalf' || session.phase === 'finished' && elapsedSeconds > 25 * 60) &&
    elapsedSeconds >= 25 * 60
  ) {
    return Math.max(26, Math.min(50, 26 + Math.floor((elapsedSeconds - 25 * 60) / 60)))
  }
  return Math.max(1, Math.min(50, Math.ceil(elapsedSeconds / 60)))
}

export function formatLiveMinute(minute: number) {
  return minute > 25 ? `${minute - 25}+25′` : `${minute}′`
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

function elapsedSecondsAtMinute(minute: number) {
  return minute <= 25 ? minute * 60 : (minute - 1) * 60
}

export function createLiveMatchSession(input: {
  date: string
  team: LiveMatchTeam
  slotColumn: number
  starters: number[]
  substitutes: number[]
}): LiveMatchSession {
  return {
    ...input,
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
  let goalsFor = 0
  let goalsAgainst = 0

  for (const event of session.events) {
    if (!Number.isSafeInteger(event.minute) || event.minute < 1 || event.minute > 50) {
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
        elapsedSecondsAtMinute(event.minute) - elapsedSecondsAtMinute(startMinute),
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
          Math.max(0, elapsedSeconds - elapsedSecondsAtMinute(startMinute)),
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
