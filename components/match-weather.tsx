'use client'

import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
} from 'lucide-react'

type WeatherResult = {
  temperature: number
  feelsLikeTemperature: number | null
  weatherCode: number
  location: string
}

type WeatherState =
  | { status: 'loading' }
  | { status: 'ready'; weather: WeatherResult }
  | { status: 'unavailable' }
  | { status: 'tooEarly' }

function daysFromToday(date: string, today: string) {
  const dateTime = Date.parse(`${date}T00:00:00Z`)
  const todayTime = Date.parse(`${today}T00:00:00Z`)
  return Math.round((dateTime - todayTime) / 86_400_000)
}

function getLocationQueries(location: string) {
  const ignoredWords = new Set([
    'as',
    'es',
    'us',
    'fc',
    'sc',
    'rc',
    'ol',
    'ac',
    'sa',
    'football',
    'club',
    'sporting',
    'olympique',
    'stade',
    'complexe',
    'terrain',
    'sportif',
    'municipal',
  ])
  return [
    location.trim(),
    ...location.trim().split(/[\s,]+/).filter((word) =>
      word.length >= 3 && !ignoredWords.has(word.toLocaleLowerCase('fr-FR')),
    ),
  ].slice(0, 5)
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

function useMatchWeather(
  date: string,
  homeAway: string,
  opponent: string,
  today: string,
  venue?: string,
): WeatherState {
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
        const venueName = venue?.trim()
        const geocodingQuery = venueName && venueName.toLocaleLowerCase('fr-FR') !== 'genech'
          ? venueName
          : homeAway === 'Extérieur'
            ? opponent.trim()
            : ''

        if (geocodingQuery) {
          const queries = getLocationQueries(geocodingQuery)
          let place: { name: string; latitude: number; longitude: number } | undefined

          for (const name of queries) {
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
              throw new Error(`Recherche du lieu indisponible (${geocodingResponse.status}).`)
            }
            const geocodingResult = await geocodingResponse.json() as {
              results?: Array<{ name: string; latitude: number; longitude: number }>
            }
            place = geocodingResult.results?.[0]
            if (place) break
          }
          if (!place) throw new Error(`Lieu introuvable pour « ${geocodingQuery} ».`)
          latitude = place.latitude
          longitude = place.longitude
          location = place.name
        } else if (homeAway !== 'Domicile') {
          throw new Error('Lieu non précisé pour la recherche météo.')
        }

        const params = new URLSearchParams({
          latitude: String(latitude),
          longitude: String(longitude),
          daily: 'weather_code,temperature_2m_max,apparent_temperature_max',
          timezone: 'Europe/Paris',
          start_date: date,
          end_date: date,
        })
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Prévisions météo indisponibles (${response.status}).`)
        const result = await response.json() as {
          daily?: {
            time?: string[]
            weather_code?: number[]
            temperature_2m_max?: number[]
            apparent_temperature_max?: number[]
          }
        }
        const index = result.daily?.time?.indexOf(date) ?? -1
        const temperature = result.daily?.temperature_2m_max?.[index]
        const feelsLikeTemperature = result.daily?.apparent_temperature_max?.[index]
        const weatherCode = result.daily?.weather_code?.[index]
        if (index < 0 || typeof temperature !== 'number' || typeof weatherCode !== 'number') {
          throw new Error('Prévisions météo incomplètes.')
        }
        setWeather({
          status: 'ready',
          weather: {
            temperature,
            feelsLikeTemperature: typeof feelsLikeTemperature === 'number' ? feelsLikeTemperature : null,
            weatherCode,
            location,
          },
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') return
        console.error('Impossible de charger la météo:', error)
        setWeather({ status: 'unavailable' })
      }
    }

    void loadWeather()
    return () => controller.abort()
  }, [date, homeAway, opponent, today, venue])

  return weather
}

export function MatchWeather({
  date,
  homeAway,
  opponent,
  today,
  venue,
  tone = 'dark',
}: {
  date: string
  homeAway: string
  opponent: string
  today: string
  venue?: string
  tone?: 'dark' | 'light'
}) {
  const weather = useMatchWeather(date, homeAway, opponent, today, venue)
  const toneClass = tone === 'dark'
    ? 'border-amber-300/30 bg-white/10 text-white/80'
    : 'border-[#172554]/15 bg-white/75 text-[#172554]'
  const iconClass = 'size-5 shrink-0 rounded-full bg-amber-300 p-1 text-[#172554]'
  const temperatureClass = tone === 'dark'
    ? 'bg-amber-300 text-[#172554]'
    : 'bg-[#172554] text-white'

  return (
    <span aria-live="polite" className={`inline-flex min-h-7 w-fit max-w-full self-start items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold sm:gap-1.5 sm:px-2 sm:text-[10px] md:text-xs ${toneClass}`}>
      {weather.status === 'ready' ? (
        <>
          <WeatherIcon code={weather.weather.weatherCode} className={iconClass} />
          <span className="max-w-32 truncate sm:max-w-40"><span className="sr-only">Météo à </span>{weather.weather.location}</span>
          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums sm:text-xs ${temperatureClass}`}>{Math.round(weather.weather.temperature)}°</span>
          <span className="shrink-0 rounded-full bg-[#d4af37]/20 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-[#725200] dark:text-amber-200 sm:text-[10px]">
            Ressenti {weather.weather.feelsLikeTemperature === null ? '—' : `${Math.round(weather.weather.feelsLikeTemperature)}°`}
          </span>
        </>
      ) : weather.status === 'loading' ? (
        <><CloudSun aria-hidden="true" className={`${iconClass} animate-pulse`} />Météo…</>
      ) : weather.status === 'tooEarly' ? (
        <><CloudSun aria-hidden="true" className={iconClass} />Prévisions à venir</>
      ) : (
        <><CloudSun aria-hidden="true" className={iconClass} />Météo indisponible</>
      )}
    </span>
  )
}
