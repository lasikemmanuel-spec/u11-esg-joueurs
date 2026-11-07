'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  CalendarDays,
  Check,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  MapPin,
  Sun,
  UsersRound,
} from 'lucide-react'
import { ClubCrest } from '@/components/club-crest'
import type { Convocation } from '@/lib/convocations'
import type { MatchSheetEntry } from '@/lib/match-results'
import { getNextPlannedMatchDate, normalizeMatchDate } from '@/lib/match-day-display'

type WeatherResult = {
  temperature: number
  weatherCode: number
  precipitationProbability: number | null
}

type WeatherState =
  | { status: 'loading' }
  | { status: 'ready'; weather: WeatherResult }
  | { status: 'unavailable' }
  | { status: 'tooEarly' }
  | { status: 'noDate' }

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

function useMatchWeather(date: string | null, today: string): WeatherState {
  const [weather, setWeather] = useState<WeatherState>({ status: 'noDate' })

  useEffect(() => {
    if (!date) {
      setWeather({ status: 'noDate' })
      return
    }

    if (daysFromToday(date, today) > 15) {
      setWeather({ status: 'tooEarly' })
      return
    }

    const controller = new AbortController()
    setWeather({ status: 'loading' })
    const params = new URLSearchParams({
      latitude: '50.53',
      longitude: '3.22',
      daily: 'weather_code,temperature_2m_max,precipitation_probability_max',
      timezone: 'Europe/Paris',
      start_date: date,
      end_date: date,
    })
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Prévisions météo indisponibles (${response.status}).`)
        const result = await response.json() as {
          daily?: {
            time?: string[]
            weather_code?: number[]
            temperature_2m_max?: number[]
            precipitation_probability_max?: Array<number | null>
          }
        }
        const index = result.daily?.time?.indexOf(date) ?? -1
        const temperature = result.daily?.temperature_2m_max?.[index]
        const weatherCode = result.daily?.weather_code?.[index]
        if (index < 0 || typeof temperature !== 'number' || typeof weatherCode !== 'number') {
          throw new Error('Prévisions météo incomplètes.')
        }
        setWeather({
          status: 'ready',
          weather: {
            temperature,
            weatherCode,
            precipitationProbability: result.daily?.precipitation_probability_max?.[index] ?? null,
          },
        })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Impossible de charger la météo du prochain match:', error)
        setWeather({ status: 'unavailable' })
      })

    return () => controller.abort()
  }, [date, today])

  return weather
}

function calledPlayerCount(convocations: Convocation[], date: string) {
  return convocations.filter((player) =>
    player.matches.some((match) =>
      normalizeMatchDate(match.date) === date &&
      (match.status === 'called' || match.status === 'calledAbsent' || match.status === 'present'),
    ),
  ).length
}

export function MatchDayHome({
  entries,
  convocations,
  convocationDates,
}: {
  entries: MatchSheetEntry[]
  convocations: Convocation[]
  convocationDates: string[]
}) {
  const today = localToday()
  const plannedDate = getNextPlannedMatchDate(entries, today)
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
  const weather = useMatchWeather(plannedDate, today)
  const calledCount = plannedDate ? calledPlayerCount(convocations, plannedDate) : 0
  const hasCallups = plannedDate !== null && convocationDates.some(
    (date) => normalizeMatchDate(date) === plannedDate,
  )
  const matchCalendarId = 'match-calendar'
  const displayDate = plannedDate ?? lastMatchDate

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
                {matchesOnPlannedDate.map((match) => (
                  <div
                    key={`${match.team}-${match.slotColumn}`}
                    className={[
                      'flex min-w-0 items-center gap-3 rounded-2xl border p-3 backdrop-blur-sm',
                      match.team === 'E1'
                        ? 'border-sky-300/40 bg-sky-400/15'
                        : 'border-amber-300/50 bg-amber-400/15',
                    ].join(' ')}
                  >
                    <ClubCrest className={[
                      'size-10 shrink-0 rounded-full ring-2',
                      match.team === 'E1' ? 'ring-sky-300' : 'ring-amber-300',
                    ].join(' ')} />
                    <div className="min-w-0">
                      <p className={[
                        'text-[9px] font-black uppercase tracking-widest',
                        match.team === 'E1' ? 'text-sky-200' : 'text-amber-200',
                      ].join(' ')}>
                        Équipe {match.team === 'E1' ? '1' : '2'}
                      </p>
                      <p className="break-words text-base font-black leading-tight">
                        {match.opponent || 'Adversaire à préciser'}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-white/75">
                        <span className="inline-flex items-center gap-1">
                          <MapPin aria-hidden="true" className="size-3" />
                          {match.homeAway || 'Lieu à préciser'}
                        </span>
                        {match.kickoffTime && <span>· {match.kickoffTime}</span>}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <a
                  href={`#${matchCalendarId}`}
                  className="group flex min-h-16 items-center gap-3 rounded-2xl bg-[#d4af37] px-4 py-3 text-[#172554] shadow-md transition hover:-translate-y-0.5 hover:bg-amber-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#172554]/10">
                    {hasCallups ? <Check aria-hidden="true" className="size-5" /> : <UsersRound aria-hidden="true" className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">
                      {hasCallups ? `${calledCount} joueur${calledCount === 1 ? '' : 's'} convoqué${calledCount === 1 ? '' : 's'}` : 'On prépare l’équipe ?'}
                    </span>
                    <span className="mt-0.5 block text-[11px] font-bold text-[#172554]/75">
                      {hasCallups ? 'Gérer les convocations' : 'Lancer les convocations'}
                    </span>
                  </span>
                  <ArrowDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-y-0.5" />
                </a>
                <a
                  href={`#${matchCalendarId}`}
                  className="group flex min-h-16 items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#d4af37]">
                    <CalendarDays aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">Le programme du match</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-white/70">Voir le calendrier</span>
                  </span>
                  <ArrowDown aria-hidden="true" className="size-4 shrink-0 text-white/70 transition-transform group-hover:translate-y-0.5" />
                </a>
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
              <a
                href={`#${matchCalendarId}`}
                className="group mt-4 inline-flex min-h-16 items-center gap-3 self-start rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/15 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#d4af37]">
                  <CalendarDays aria-hidden="true" className="size-5" />
                </span>
                <span>
                  <span className="block text-sm font-black">Le programme du match</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-white/70">Voir le calendrier</span>
                </span>
                <ArrowDown aria-hidden="true" className="size-4 transition-transform group-hover:translate-y-0.5" />
              </a>
            </>
          )}
          <div className="mt-3">
            {plannedDate && (
              <div
                aria-live="polite"
                className="relative min-w-0 overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-sky-300/20 via-white/10 to-indigo-300/20 p-3 shadow-inner backdrop-blur-sm sm:flex-1"
              >
                <div aria-hidden="true" className="pointer-events-none absolute -right-7 -top-9 size-28 rounded-full bg-sky-200/10 blur-2xl" />
                <div className="relative flex min-w-0 items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-inner">
                    {weather.status === 'ready' ? (
                      <WeatherIcon code={weather.weather.weatherCode} className="size-7 text-amber-300 drop-shadow-[0_0_8px_rgba(253,224,71,0.65)]" />
                    ) : (
                      <CloudSun aria-hidden="true" className={`size-7 text-amber-300 ${weather.status === 'loading' ? 'animate-pulse' : ''}`} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.18em] text-sky-100/80">
                      Météo du match · Genech
                    </p>
                    <p className="mt-0.5 truncate text-sm font-extrabold text-white">
                      {weather.status === 'ready'
                        ? weatherDescriptions[weather.weather.weatherCode] ?? 'Météo variable'
                        : weather.status === 'loading'
                          ? 'Le ciel se prépare…'
                          : weather.status === 'tooEarly'
                            ? 'Prévisions à venir'
                            : 'Prévisions indisponibles'}
                    </p>
                    {weather.status === 'ready' && weather.weather.precipitationProbability !== null && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-sky-950/25 px-2 py-0.5 text-[10px] font-bold text-sky-50/90">
                        <CloudRain aria-hidden="true" className="size-3" />
                        Pluie {weather.weather.precipitationProbability}%
                      </p>
                    )}
                  </div>
                  {weather.status === 'ready' && (
                    <div className="shrink-0 border-l border-white/20 pl-3 text-right">
                      <p className="text-3xl font-black leading-none tracking-tight text-white">
                        {Math.round(weather.weather.temperature)}°
                      </p>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-sky-100/70">max</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
