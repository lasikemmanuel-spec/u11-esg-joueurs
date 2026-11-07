'use client'

import { useEffect, useMemo, useState } from 'react'
import {
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
  const calledCount = plannedDate ? calledPlayerCount(convocations, plannedDate) : 0
  const hasCallups = plannedDate !== null && convocationDates.some(
    (date) => normalizeMatchDate(date) === plannedDate,
  )
  const matchCalendarId = 'match-calendar'

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
                      <MatchWeather
                        date={plannedDate}
                        homeAway={match.homeAway}
                        opponent={match.opponent}
                        today={today}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a
                  href={`#${matchCalendarId}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#d4af37] px-3 text-xs font-black text-[#172554] shadow-sm transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  {hasCallups ? <Check aria-hidden="true" className="size-4" /> : <UsersRound aria-hidden="true" className="size-4" />}
                  {hasCallups
                    ? `${calledCount} joueur${calledCount === 1 ? '' : 's'} convoqué${calledCount === 1 ? '' : 's'}`
                    : 'Convocations à saisir si besoin'}
                </a>
                <a
                  href={`#${matchCalendarId}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-bold text-white/85 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
                >
                  <CalendarDays aria-hidden="true" className="size-4 text-[#d4af37]" />
                  Voir le calendrier
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
                className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 text-xs font-bold text-white/85 transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
              >
                <CalendarDays aria-hidden="true" className="size-4 text-[#d4af37]" />
                Voir le calendrier
              </a>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
