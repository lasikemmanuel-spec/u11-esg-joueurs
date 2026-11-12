'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Clock3,
  ChevronDown,
  MapPin,
  Sun,
  Trophy,
  UsersRound,
} from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import { MatchFamilyMessage } from '@/components/match-family-message'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
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

function WeatherIcon({ code, className }: { code: number; className?: string }) {
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

function useMatchWeather(date: string, homeAway: string, opponent: string, today: string): WeatherState {
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

function MatchWeather({
  date,
  homeAway,
  opponent,
  today,
}: {
  date: string
  homeAway: string
  opponent: string
  today: string
}) {
  const weather = useMatchWeather(date, homeAway, opponent, today)

  return (
    <div aria-live="polite" className="mt-2 inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-bold text-white/85">
      {weather.status === 'ready' ? (
        <>
          <WeatherIcon code={weather.weather.weatherCode} className="size-4 shrink-0 text-amber-300" />
          <span className="truncate">Météo · {weather.weather.location}</span>
          <span className="shrink-0 text-xs font-black text-white">{Math.round(weather.weather.temperature)}°</span>
        </>
      ) : weather.status === 'loading' ? (
        <><CloudSun aria-hidden="true" className="size-4 shrink-0 animate-pulse text-amber-300" />Météo…</>
      ) : weather.status === 'tooEarly' ? (
        <><CloudSun aria-hidden="true" className="size-4 shrink-0 text-amber-300" />Prévisions à venir</>
      ) : (
        <><CloudSun aria-hidden="true" className="size-4 shrink-0 text-amber-300" />Météo indisponible</>
      )}
    </div>
  )
}

export function MatchDayHome({
  entries,
  convocations,
  convocationDates,
  canManageMatches,
  onSelectMatch,
  onOpenCallups,
}: {
  entries: MatchSheetEntry[]
  convocations: Convocation[]
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
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {matchesOnPlannedDate.map((match) => {
                  const calledPlayers = convocations.flatMap((player) => {
                    const callup = player.matches.find((item) =>
                      normalizeMatchDate(item.date) === plannedDate &&
                      (item.team === match.team || item.team === 'E1+E2') &&
                      (item.status === 'called' || item.status === 'calledAbsent' || item.status === 'present'),
                    )
                    return callup ? [{ name: player.name, absent: callup.status === 'calledAbsent' }] : []
                  })

                  return (
                    <div key={`${match.team}-${match.slotColumn}`} className="flex min-w-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectMatch(match)}
                        aria-label={`Ouvrir la feuille de match, ES Genech ${match.team === 'E1' ? '1' : '2'} contre ${match.opponent || 'adversaire à préciser'}`}
                        className={[
                          'group flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left shadow-md backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                          match.team === 'E1'
                            ? 'border-sky-300/50 bg-gradient-to-br from-sky-400/20 to-blue-950/20 hover:border-sky-200'
                            : 'border-amber-300/60 bg-gradient-to-br from-amber-400/20 to-blue-950/20 hover:border-amber-200',
                        ].join(' ')}
                      >
                        <ClubCrest className={[
                          'size-12 shrink-0 rounded-full ring-2 shadow-md transition-transform group-hover:scale-105',
                          match.team === 'E1' ? 'ring-sky-300' : 'ring-amber-300',
                        ].join(' ')} />
                        <div className="min-w-0 flex-1">
                          <span className={[
                            'inline-flex rounded-full border px-3 py-1 text-xs font-black tracking-wide shadow-sm sm:text-sm',
                            match.team === 'E1'
                              ? 'border-sky-200/60 bg-sky-200/20 text-white'
                              : 'border-amber-200/70 bg-amber-200/20 text-amber-100',
                          ].join(' ')}>
                            ES Genech {match.team === 'E1' ? '1' : '2'}
                          </span>
                          <p className="mt-1 break-words text-lg font-black leading-tight sm:text-xl">
                            {match.opponent || 'Adversaire à préciser'}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white/90">
                            <span className="inline-flex max-w-full rounded-full border border-white/15 bg-white/10 px-2 py-1 font-bold">
                              {match.competition || 'Type non renseigné'}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-1">
                              <MapPin aria-hidden="true" className="size-3" />
                              {match.homeAway || 'Lieu à préciser'}
                            </span>
                            {match.kickoffTime && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-1">
                                <Clock3 aria-hidden="true" className="size-3" />
                                {match.kickoffTime}
                              </span>
                            )}
                          </div>
                          <MatchWeather date={plannedDate} homeAway={match.homeAway} opponent={match.opponent} today={today} />
                          <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-black text-white/75">
                            Voir la feuille de match <ArrowUpRight aria-hidden="true" className="size-3.5" />
                          </span>
                        </div>
                      </button>
                      <div className="flex flex-wrap items-start gap-2 pl-1">
                        <details className="group min-w-0 flex-1 rounded-xl border border-white/15 bg-white/[0.08] text-xs">
                          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 font-black text-white marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                            <span>{hasCallups ? 'Voir les convocations' : 'Convocations non renseignées'}</span>
                            <ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" />
                          </summary>
                          <div className="border-t border-white/10 px-3 py-2">
                            {!hasCallups ? (
                              <p className="text-white/75">Aucune convocation n’est enregistrée pour ce match.</p>
                            ) : calledPlayers.length === 0 ? (
                              <p className="text-white/75">Aucun joueur convoqué pour cette équipe.</p>
                            ) : (
                              <ul className="grid gap-1 sm:grid-cols-2">
                                {calledPlayers.map((player, index) => (
                                  <li key={`${player.name}-${index}`} className="break-words rounded-md bg-white/10 px-2 py-1 text-white/90">
                                    {player.name}{player.absent ? ' · absent' : ''}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </details>
                        {canManageMatches && <MatchFamilyMessage match={match} date={plannedDate} />}
                      </div>
                    </div>
                  )
                })}
              </div>
              {canEditCallups && plannedDate && (
                <button
                  type="button"
                  onClick={() => onOpenCallups(plannedDate)}
                  className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#f4d35e]/50 bg-white/10 px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <UsersRound aria-hidden="true" className="size-4 text-[#f4d35e]" />
                  {hasCallups ? 'Modifier les convocations' : 'Préparer les convocations'}
                </button>
              )}
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
