'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Clock3,
  MapPin,
  Sun,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
import type { MatchDayPlayer } from '@/lib/players'
import { getLatestPlayedMatches, getNextPlannedMatchDate, normalizeMatchDate } from '@/lib/match-day-display'

type WeatherResult = {
  temperature: number
  weatherCode: number
  location: string
}

type WeatherState =
  | { status: 'loading' }
  | { status: 'ready'; weather: WeatherResult }
  | { status: 'unavailable' }
  | { status: 'tooEarly' }

function callupPositionRank(position: string | null) {
  const lower = position?.toLocaleLowerCase('fr-FR') ?? ''
  if (lower.startsWith('gard')) return 0
  if (lower.startsWith('déf') || lower.startsWith('def') || lower.startsWith('lat') || lower.startsWith('cent')) return 1
  if (lower.startsWith('mil') || lower.startsWith('ail')) return 2
  if (lower.startsWith('att') || lower.startsWith('av')) return 3
  return 4
}

function ConvocationOverlay({
  teamName,
  players,
  canShowLicenseNumbers,
  hasCallups,
  canEdit,
  onEdit,
}: {
  teamName: string
  players: { name: string; absent: boolean; position: string | null; licenseNumber: string | null }[]
  canShowLicenseNumbers: boolean
  hasCallups: boolean
  canEdit: boolean
  onEdit: () => void
}) {
  const [open, setOpen] = useState(false)
  const [showLicenseNumbers, setShowLicenseNumbers] = useState(false)
  const orderedPlayers = players
    .map((player, index) => ({ player, index }))
    .sort((a, b) => callupPositionRank(a.player.position) - callupPositionRank(b.player.position) || a.index - b.index)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="absolute bottom-2 right-2 z-10 inline-flex min-h-8 min-w-9 items-center justify-center gap-1 rounded-full border border-white/20 bg-[#172554]/65 px-2 text-[10px] font-black text-white shadow-sm backdrop-blur transition hover:border-amber-200/70 hover:bg-[#172554]/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
        aria-haspopup="dialog"
        aria-label={`Voir les ${players.length} convoqués de ${teamName}`}
      >
        <UsersRound aria-hidden="true" className="size-3.5 text-amber-200" />
        <span>{players.length}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#07102a]/75 p-1 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Convocations ${teamName}`}
            className="flex max-h-[calc(100dvh-0.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-[1.75rem] border border-amber-200/70 bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#101a3d] text-white shadow-2xl animate-in slide-in-from-bottom-4 duration-200"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 p-3 sm:p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200">Jour de match · U11</p>
                <h3 className="mt-1 text-xl font-black">Les convoqués</h3>
                <p className="mt-1 text-xs font-bold text-white/70">{teamName} · {players.length} joueur{players.length === 1 ? '' : 's'}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 text-xl">×</button>
            </header>
            <div className="p-3 sm:p-4">
              {hasCallups && players.length > 0 && canShowLicenseNumbers && (
                <label className="mb-2 inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 text-[10px] font-semibold text-white/75 transition hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={showLicenseNumbers}
                    onChange={(event) => setShowLicenseNumbers(event.target.checked)}
                    className="size-3.5 accent-[#d4af37]"
                  />
                  Afficher les n° de licence
                </label>
              )}
              {!hasCallups ? (
                <div className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-6 text-center">
                  <span className="text-3xl" aria-hidden="true">⚽</span>
                  <p className="mt-2 font-black">Pas encore de convocation</p>
                  <p className="mt-1 text-xs text-white/65">La liste apparaîtra ici dès qu’elle sera préparée.</p>
                </div>
              ) : players.length === 0 ? (
                <p className="rounded-2xl bg-white/10 p-4 text-center text-sm font-semibold">Aucun joueur convoqué pour cette équipe.</p>
              ) : (
                <ul className="grid grid-cols-2 gap-1.5">
                  {orderedPlayers.map(({ player, index }) => (
                    <li key={`${player.name}-${index}`} className="flex min-w-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.08] p-2 text-[11px] font-bold leading-tight">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-amber-300 text-[#172554]">{player.absent ? '!' : '✓'}</span>
                      <span className="min-w-0 break-words">
                        <span className="block">{player.name}{player.absent ? ' · absent' : ''}</span>
                        {player.position && (
                          <span className="mt-0.5 block text-[9px] font-medium text-white/55">Poste · {player.position}</span>
                        )}
                        {showLicenseNumbers && (
                          <span className="mt-0.5 block whitespace-nowrap text-[10px] font-medium text-white/70">
                            N° licence · <span className="font-bold tabular-nums text-white/90">{player.licenseNumber || 'Non renseigné'}</span>
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {canEdit && (
              <footer className="shrink-0 border-t border-white/10 p-3 sm:p-4">
                <button type="button" onClick={() => { setOpen(false); onEdit() }} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-200 px-4 text-sm font-black text-[#172554] shadow-lg transition hover:brightness-105">
                  <UsersRound aria-hidden="true" className="size-4" /> {hasCallups ? 'Modifier la convocation' : 'Préparer la convocation'} <ArrowRight aria-hidden="true" className="size-4" />
                </button>
              </footer>
            )}
          </section>
        </div>
      )}
    </>
  )
}

const weatherDescriptions: Record<number, string> = {
  0: 'Ensoleillé',
  1: 'Peu nuageux',
  2: 'Éclaircies',
  3: 'Nuageux',
  45: 'Brouillard',
  48: 'Brouillard givrant',
  51: 'Bruine légère',
  53: 'Bruine',
  55: 'Bruine forte',
  56: 'Bruine verglaçante',
  57: 'Bruine verglaçante forte',
  61: 'Pluie légère',
  63: 'Pluie',
  65: 'Pluie forte',
  66: 'Pluie verglaçante',
  67: 'Pluie verglaçante forte',
  71: 'Neige légère',
  73: 'Neige',
  75: 'Neige forte',
  77: 'Grains de neige',
  80: 'Averses légères',
  81: 'Averses',
  82: 'Averses fortes',
  85: 'Averses de neige',
  86: 'Averses de neige fortes',
  95: 'Orage',
  96: 'Orage et grêle',
  99: 'Orage et forte grêle',
}

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
}

function daysFromToday(date: string, today: string) {
  const dateTime = Date.parse(`${date}T00:00:00Z`)
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  return Math.round((dateTime - todayTime) / 86_400_000)
}

export function WeatherIcon({ code, className }: { code: number; className?: string }) {
  if (code === 0) return <Sun aria-hidden="true" className={className} />
  if (code <= 3) return <CloudSun aria-hidden="true" className={className} />
  if (code === 45 || code === 48) return <CloudFog aria-hidden="true" className={className} />
  if (code >= 71 && code <= 86) return <CloudSnow aria-hidden="true" className={className} />
  if (code >= 95) return <CloudLightning aria-hidden="true" className={className} />
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return <CloudRain aria-hidden="true" className={className} />
  }
  return <Cloud aria-hidden="true" className={className} />
}

export function useMatchWeather(date: string, homeAway: string, opponent: string, today: string): WeatherState {
  const [weather, setWeather] = useState<WeatherState>({ status: 'loading' })

  useEffect(() => {
    if (daysFromToday(date, today) > 15) {
      setWeather({ status: 'tooEarly' })
      return
    }

    const controller = new AbortController()
    setWeather({ status: 'loading' })
    const loadWeather = async () => {
      try {
        let latitude = 50.53
        let longitude = 3.22
        let location = 'Genech'

        if (homeAway === 'Extérieur') {
          if (!opponent.trim()) throw new Error('Adversaire non renseigné pour la recherche météo.')
          const ignoredClubWords = new Set(['as', 'es', 'us', 'fc', 'sc', 'rc', 'ol', 'ac', 'sa', 'football', 'club', 'sporting', 'olympique'])
          const locationQueries = [
            opponent.trim(),
            ...opponent.trim().split(/\s+/).filter((word) =>
              word.length >= 3 && !ignoredClubWords.has(word.toLocaleLowerCase('fr-FR')),
            ),
          ].slice(0, 5)
          let place: { name: string; latitude: number; longitude: number } | undefined

          for (const name of locationQueries) {
            const geocodingParams = new URLSearchParams({
              name,
              count: '1',
              language: 'fr',
              countryCode: 'FR',
              format: 'json',
            })
            const geocodingResponse = await fetch(
              `https://geocoding-api.open-meteo.com/v1/search?${geocodingParams}`,
              { signal: controller.signal },
            )
            if (!geocodingResponse.ok) {
              throw new Error(`Recherche de la ville adverse indisponible (${geocodingResponse.status}).`)
            }
            const geocodingResult = await geocodingResponse.json() as {
              results?: Array<{ name: string; latitude: number; longitude: number }>
            }
            place = geocodingResult.results?.[0]
            if (place) break
          }
          if (!place) throw new Error(`Ville introuvable pour l’adversaire « ${opponent} ».`)
          latitude = place.latitude
          longitude = place.longitude
          location = place.name
        } else if (homeAway !== 'Domicile') {
          throw new Error('Lieu du match non précisé pour la recherche météo.')
        }

        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          daily: 'weather_code,temperature_2m_max',
          timezone: 'Europe/Paris',
          start_date: date,
          end_date: date,
        })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Prévisions météo indisponibles (${response.status}).`)
        const result = await response.json() as {
          daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[] }
        }
        const index = result.daily?.time?.indexOf(date) ?? -1
        const temperature = result.daily?.temperature_2m_max?.[index]
        const weatherCode = result.daily?.weather_code?.[index]
        if (index < 0 || typeof temperature !== 'number' || typeof weatherCode !== 'number') {
          throw new Error('Prévisions météo incomplètes.')
        }
        setWeather({
          status: 'ready',
          weather: { temperature, weatherCode, location },
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Impossible de charger la météo de la rencontre:', error)
        setWeather({ status: 'unavailable' })
      }
    }

    void loadWeather()

    return () => controller.abort()
  }, [date, homeAway, opponent, today])

  return weather
}

export function MatchWeather({
  date,
  homeAway,
  opponent,
  today,
  tone = 'dark',
}: {
  date: string
  homeAway: string
  opponent: string
  today: string
  tone?: 'dark' | 'light'
}) {
  const weather = useMatchWeather(date, homeAway, opponent, today)
  const toneClass = tone === 'dark'
    ? 'border-white/15 bg-white/10 text-white/85'
    : 'border-[#172554]/20 bg-[#172554]/10 text-[#172554]'
  const iconClass = tone === 'dark' ? 'text-amber-300' : 'text-[#8a6400]'

  return (
    <div aria-live="polite" className={`inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${toneClass}`}>
      {weather.status === 'ready' ? (
        <>
          <WeatherIcon code={weather.weather.weatherCode} className={`size-4 shrink-0 ${iconClass}`} />
          <span className="truncate">Météo · {weather.weather.location}</span>
          <span className={`shrink-0 text-xs font-black ${tone === 'dark' ? 'text-white' : 'text-[#172554]'}`}>{Math.round(weather.weather.temperature)}°</span>
        </>
      ) : weather.status === 'loading' ? (
        <><CloudSun aria-hidden="true" className={`size-4 shrink-0 animate-pulse ${iconClass}`} />Météo…</>
      ) : weather.status === 'tooEarly' ? (
        <><CloudSun aria-hidden="true" className={`size-4 shrink-0 ${iconClass}`} />Prévisions à venir</>
      ) : (
        <><CloudSun aria-hidden="true" className={`size-4 shrink-0 ${iconClass}`} />Météo indisponible</>
      )}
    </div>
  )
}

export function MatchDayHome({
  entries,
  convocations,
  rosterPlayers,
  convocationDates,
  canManageMatches,
  onSelectMatch,
  onOpenCallups,
}: {
  entries: MatchSheetEntry[]
  convocations: Convocation[]
  rosterPlayers: MatchDayPlayer[]
  convocationDates: string[]
  canManageMatches: boolean
  onSelectMatch: (entry: MatchSheetEntry) => void
  onOpenCallups: (date: string) => void
}) {
  const today = localToday()
  const plannedDate = getNextPlannedMatchDate(entries, today)
  const latestResults = getLatestPlayedMatches(entries, today)
  const matchesOnPlannedDate = useMemo(
    () => plannedDate
      ? entries.filter((entry) =>
          normalizeMatchDate(entry.date) === plannedDate &&
          !entry.resultLabel &&
          entry.goalsFor === null &&
          entry.goalsAgainst === null,
        )
      : [],
    [entries, plannedDate],
  )
  const lastMatchDate = useMemo(
    () => entries
      .map((entry) => normalizeMatchDate(entry.date))
      .filter((date) => date && date < today)
      .sort()
      .at(-1) ?? null,
    [entries, today],
  )
  const canEditCallups = Boolean(
    canManageMatches && plannedDate && new Date(`${plannedDate}T12:00:00`).getDay() === 6,
  )
  const hasCallups = plannedDate !== null && convocationDates.some(
    (date) => normalizeMatchDate(date) === plannedDate,
  )
  return (
    <section
      aria-labelledby="match-day-home-title"
      className="overflow-hidden rounded-3xl border border-[#d4af37]/50 bg-gradient-to-br from-[#172554] via-[#1e3a8a] to-[#172554] text-white shadow-xl"
    >
      <div className="relative overflow-hidden p-4 sm:p-6">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 opacity-10">
          <ClubCrest className="size-56" />
        </div>
        <div className="relative">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4af37] sm:text-xs">
            ES Genech · Jour de match
          </p>
          <h2 id="match-day-home-title" className="mt-1 text-2xl font-black sm:text-3xl">
            {plannedDate ? 'Prochain rendez-vous' : 'Le calendrier des matchs'}
          </h2>
          {plannedDate ? (
            <>
              <p className="mt-2 text-sm font-bold capitalize text-white/85 sm:text-base">
                {new Date(`${plannedDate}T12:00:00`).toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <div className="mt-3 grid items-stretch gap-1.5 sm:grid-cols-2">
                {matchesOnPlannedDate.map((match) => {
                  const calledPlayers = convocations.flatMap((player) => {
                    const callup = player.matches.find((item) =>
                      normalizeMatchDate(item.date) === plannedDate &&
                      (item.team === match.team || item.team === 'E1+E2') &&
                      (item.status === 'called' || item.status === 'calledAbsent' || item.status === 'present'),
                    )
                    if (!callup) return []
                    const rosterPlayer = rosterPlayers.find((item) => item.number === player.number)
                    return [{
                      name: player.name,
                      absent: callup.status === 'calledAbsent',
                      position: rosterPlayer?.position ?? null,
                      licenseNumber: rosterPlayer?.licenseNumber ?? null,
                    }]
                  })

                  return (
                    <div key={`${match.team}-${match.slotColumn}`} className="relative flex min-w-0 flex-col sm:h-full">
                      <button
                        type="button"
                        onClick={() => onSelectMatch(match)}
                        aria-label={`Ouvrir la feuille de match, ES Genech ${match.team === 'E1' ? '1' : '2'} contre ${match.opponent || 'adversaire à préciser'}`}
                        className={[
                          'group flex w-full min-w-0 items-center gap-2.5 rounded-2xl border p-2.5 pb-10 text-left shadow-md backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:flex-1',
                          match.team === 'E1'
                            ? 'border-sky-300/50 bg-gradient-to-br from-sky-400/20 to-blue-950/20 hover:border-sky-200'
                            : 'border-amber-300/60 bg-gradient-to-br from-amber-400/20 to-blue-950/20 hover:border-amber-200',
                        ].join(' ')}
                      >
                        <ClubCrest className={[
                          'size-11 shrink-0 rounded-full ring-2 shadow-md transition-transform group-hover:scale-105',
                          match.team === 'E1' ? 'ring-sky-300' : 'ring-amber-300',
                        ].join(' ')} />
                        <div className="min-w-0 flex-1">
                          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-base font-black leading-tight sm:text-lg">
                            <span className="break-words">ES Genech {match.team === 'E1' ? '1' : '2'}</span>
                            <span aria-hidden="true" className="text-xs font-bold text-white/60">vs</span>
                            <span className="break-words">{match.opponent || 'Adversaire à préciser'}</span>
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] font-semibold text-white/90">
                            <span className="inline-flex max-w-full rounded-full border border-white/15 bg-white/10 px-2 py-0.5 font-bold">
                              {match.competition || 'Type non renseigné'}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5">
                              <MapPin aria-hidden="true" className="size-3" />
                              {match.homeAway || 'Lieu à préciser'}
                            </span>
                            {match.kickoffTime && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5">
                                <Clock3 aria-hidden="true" className="size-3" />
                                {match.kickoffTime}
                              </span>
                            )}
                          </div>
                          <MatchWeather date={plannedDate} homeAway={match.homeAway} opponent={match.opponent} today={today} />
                        </div>
                      </button>
                      <ConvocationOverlay
                        teamName={`ES Genech ${match.team === 'E1' ? '1' : '2'}`}
                        players={calledPlayers}
                        canShowLicenseNumbers={rosterPlayers.length > 0}
                        hasCallups={hasCallups}
                        canEdit={canEditCallups}
                        onEdit={() => onOpenCallups(plannedDate)}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 max-w-xl text-sm text-white/80">
                Aucun match à venir n’est planifié.
                {lastMatchDate && (
                  <> Dernière journée : {new Date(`${lastMatchDate}T12:00:00`).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}.</>
                )}
              </p>
            </>
          )}
          {(latestResults.E1 || latestResults.E2) && (
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/65">
                Derniers résultats
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(['E1', 'E2'] as const).map((team) => {
                  const result = latestResults[team]
                  if (!result) return null
                  const isWin = result.goalsFor > result.goalsAgainst
                  const isDraw = result.goalsFor === result.goalsAgainst
                  const teamName = `ES Genech ${team === 'E1' ? '1' : '2'}`
                  const scoreStyle = isWin
                    ? 'bg-emerald-300 text-emerald-950'
                    : isDraw
                      ? 'bg-amber-200 text-amber-950'
                      : 'bg-rose-300 text-rose-950'

                  return (
                    <div
                      key={team}
                      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 shadow-sm ${isWin ? 'border-emerald-300/40 bg-gradient-to-r from-emerald-400/15 to-white/[0.06]' : isDraw ? 'border-amber-200/40 bg-gradient-to-r from-amber-300/15 to-white/[0.06]' : 'border-rose-300/35 bg-gradient-to-r from-rose-400/15 to-white/[0.06]'}`}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10">
                        {isWin
                          ? <Trophy aria-hidden="true" className="size-4 text-amber-300" />
                          : <ClubCrest className="size-8 rounded-full" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/70">
                          {teamName} · {new Date(`${result.normalizedDate}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                        <p className={`mt-0.5 text-sm font-black ${isWin ? 'text-emerald-200' : isDraw ? 'text-amber-200' : 'text-rose-200'}`}>
                          {isWin ? `🏆 Victoire de ${teamName} !` : isDraw ? '🤝 Match nul' : `💪 Défaite de ${teamName}`}
                        </p>
                        <p className="break-words text-sm font-semibold leading-snug text-white">
                          Contre {result.opponent || 'adversaire non renseigné'}
                        </p>
                      </div>
                      <span aria-label={`Score de ES Genech ${team === 'E1' ? '1' : '2'} : ${result.goalsFor} à ${result.goalsAgainst}`} className={`shrink-0 rounded-xl px-2.5 py-1 text-base font-black tabular-nums ${scoreStyle}`}>
                        {result.goalsFor}–{result.goalsAgainst}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
