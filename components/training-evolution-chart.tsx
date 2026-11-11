'use client'

import { useId, useMemo, useState } from 'react'
import { TrendingUp, Award, Calendar, CheckCircle2, AlertCircle, XCircle } from 'lucide-react'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

const STATUS_CONFIG: Record<string, { label: string; short: string; color: string; bg: string }> = {
  P: { label: 'Présent', short: 'P', color: '#10b981', bg: 'bg-emerald-500' },
  AJ: { label: 'Absence justifiée', short: 'AJ', color: '#f59e0b', bg: 'bg-amber-500' },
  AI: { label: 'Absence injustifiée', short: 'AI', color: '#ef4444', bg: 'bg-rose-500' },
  B: { label: 'Blessé', short: 'B', color: '#8b5cf6', bg: 'bg-purple-500' },
  E: { label: 'Exempt', short: 'E', color: '#38bdf8', bg: 'bg-sky-500' },
}

function formatDateFR(isoDate: string) {
  const [year, month, day] = isoDate.split('-')
  if (!year || !month || !day) return isoDate
  return `${day}/${month}`
}

export function TrainingEvolutionChart({
  sessions,
  playerNumber,
}: {
  sessions: TrainingAttendanceSession[]
  playerNumber: number
}) {
  const gradientId = useId()
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  // 1. Filtrer et ordonner chronologiquement les séances
  const chronologicalData = useMemo(() => {
    if (!sessions || sessions.length === 0) return []

    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    let cumulatedPresents = 0
    let cumulatedEvaluated = 0

    return sorted.map((session, index) => {
      const rawStatus = session.playerStatuses[playerNumber]?.trim() ?? ''
      const isPresent = rawStatus === 'P'
      const isEvaluated = Boolean(rawStatus && ['P', 'AJ', 'AI', 'B', 'E'].includes(rawStatus))

      if (isEvaluated) {
        cumulatedEvaluated += 1
        if (isPresent) cumulatedPresents += 1
      }

      const rate = cumulatedEvaluated > 0
        ? Math.round((cumulatedPresents / cumulatedEvaluated) * 100)
        : null

      return {
        index,
        date: session.date,
        formattedDate: formatDateFR(session.date),
        status: rawStatus,
        statusMeta: STATUS_CONFIG[rawStatus] ?? { label: 'Non renseigné', short: '—', color: '#94a3b8', bg: 'bg-slate-400' },
        isPresent,
        isEvaluated,
        rate,
        cumulatedPresents,
        cumulatedEvaluated,
      }
    })
  }, [sessions, playerNumber])

  // Séances qui ont un taux calculable
  const validPoints = useMemo(() => {
    return chronologicalData.filter((point) => point.rate !== null)
  }, [chronologicalData])

  if (chronologicalData.length === 0 || validPoints.length === 0) {
    return null
  }

  // Statistiques globales
  const totalEvaluated = validPoints[validPoints.length - 1]?.cumulatedEvaluated ?? 0
  const totalPresents = validPoints[validPoints.length - 1]?.cumulatedPresents ?? 0
  const currentRate = validPoints[validPoints.length - 1]?.rate ?? 0

  // Dimensions SVG
  const width = 360
  const height = 140
  const padLeft = 32
  const padRight = 20
  const padTop = 16
  const padBottom = 26

  const usableWidth = width - padLeft - padRight
  const usableHeight = height - padTop - padBottom

  // Coordonnées (x, y) pour chaque point valide
  const pointsWithCoords = validPoints.map((point, i) => {
    const x = validPoints.length === 1
      ? padLeft + usableWidth / 2
      : padLeft + (i / (validPoints.length - 1)) * usableWidth
    // y inversé : 100% en haut (padTop), 0% en bas (padTop + usableHeight)
    const y = padTop + (1 - (point.rate ?? 0) / 100) * usableHeight
    return { ...point, x, y }
  })

  // Tracé de la ligne SVG
  const pathD = pointsWithCoords.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    // Courbe douce avec Bézier
    const prev = pointsWithCoords[i - 1]
    const cpX = (prev.x + p.x) / 2
    return `${acc} C ${cpX.toFixed(1)} ${prev.y.toFixed(1)}, ${cpX.toFixed(1)} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }, '')

  // Tracé de la surface sous la courbe (dégradé)
  const firstP = pointsWithCoords[0]
  const lastP = pointsWithCoords[pointsWithCoords.length - 1]
  const bottomY = padTop + usableHeight
  const areaD = `${pathD} L ${lastP.x.toFixed(1)} ${bottomY.toFixed(1)} L ${firstP.x.toFixed(1)} ${bottomY.toFixed(1)} Z`

  // Y de la ligne des 75%
  const y75 = padTop + (1 - 0.75) * usableHeight
  const y50 = padTop + (1 - 0.50) * usableHeight

  // Point actif pour infobulle
  const activePoint = selectedIndex !== null ? pointsWithCoords[selectedIndex] : pointsWithCoords[pointsWithCoords.length - 1]

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-amber-400/30 bg-secondary/30 p-3 shadow-sm dark:bg-card/60">
      {/* En-tête du graphique */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp aria-hidden="true" className="size-4 text-[#d4af37]" />
          <h4 className="text-xs font-black uppercase tracking-wider text-foreground">
            Évolution assiduité
          </h4>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {totalPresents}/{totalEvaluated} séances
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-black ${
              currentRate >= 75
                ? 'border border-emerald-400/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'border border-amber-400/40 bg-amber-500/15 text-amber-700 dark:text-amber-300'
            }`}
          >
            {currentRate >= 75 ? (
              <CheckCircle2 aria-hidden="true" className="size-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle aria-hidden="true" className="size-3 text-amber-600 dark:text-amber-400" />
            )}
            {currentRate}%
          </span>
        </div>
      </div>

      {/* Rendu SVG du graphique */}
      <div className="relative overflow-hidden rounded-lg bg-background/50 p-1 border border-border/40">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-36 select-none overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4af37" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#172554" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Lignes repères horizontales (50% et 75%) */}
          <line
            x1={padLeft}
            y1={y50}
            x2={width - padRight}
            y2={y50}
            stroke="currentColor"
            strokeOpacity="0.15"
            strokeDasharray="2,3"
          />
          <text
            x={padLeft - 4}
            y={y50 + 3}
            textAnchor="end"
            fontSize="8"
            className="fill-muted-foreground font-mono"
          >
            50%
          </text>

          <line
            x1={padLeft}
            y1={y75}
            x2={width - padRight}
            y2={y75}
            stroke="#d4af37"
            strokeOpacity="0.45"
            strokeDasharray="3,3"
          />
          <text
            x={padLeft - 4}
            y={y75 + 3}
            textAnchor="end"
            fontSize="8"
            fill="#d4af37"
            className="font-mono font-bold"
          >
            75%
          </text>

          {/* Repère 100% */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={width - padRight}
            y2={padTop}
            stroke="currentColor"
            strokeOpacity="0.1"
          />
          <text
            x={padLeft - 4}
            y={padTop + 3}
            textAnchor="end"
            fontSize="8"
            className="fill-muted-foreground font-mono"
          >
            100%
          </text>

          {/* Remplissage dégradé sous la courbe */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Ligne principale du taux d'assiduité */}
          <path
            d={pathD}
            fill="none"
            stroke="#d4af37"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points interactifs de chaque séance */}
          {pointsWithCoords.map((point, i) => {
            const isSelected = selectedIndex === i
            return (
              <g
                key={point.date}
                className="cursor-pointer transition-transform"
                onClick={() => setSelectedIndex(isSelected ? null : i)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                {/* Zone de clic élargie */}
                <circle cx={point.x} cy={point.y} r="10" fill="transparent" />

                {/* Anneau de sélection si cliqué */}
                {isSelected && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="6.5"
                    fill="none"
                    stroke="#d4af37"
                    strokeWidth="1.5"
                    className="motion-safe:animate-ping opacity-60"
                  />
                )}

                {/* Point de la séance */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 4.5 : 3.2}
                  fill={point.statusMeta.color}
                  stroke="#ffffff"
                  strokeWidth="1.2"
                  className="transition-all"
                />

                {/* Dates au bas du graphique (première, dernière et sélectionnée) */}
                {(i === 0 || i === pointsWithCoords.length - 1 || isSelected) && (
                  <text
                    x={point.x}
                    y={height - 8}
                    textAnchor={i === 0 ? 'start' : i === pointsWithCoords.length - 1 ? 'end' : 'middle'}
                    fontSize="8"
                    className={`font-mono ${isSelected ? 'fill-[#d4af37] font-bold' : 'fill-muted-foreground'}`}
                  >
                    {point.formattedDate}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Bandeau d'information dynamique sur la séance pointée */}
      {activePoint && (
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/80 px-2.5 py-1.5 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-foreground">
              Séance du {activePoint.formattedDate}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: activePoint.statusMeta.color }}
            >
              {activePoint.statusMeta.label}
            </span>
          </div>
          <span className="font-mono text-xs font-black text-[#d4af37]">
            Taux cumulé : {activePoint.rate}%
          </span>
        </div>
      )}

      {/* Légende rapide et discrète */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-muted-foreground pt-0.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500" /> Présent
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-amber-500" /> Abs. justifiée
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full bg-rose-500" /> Abs. injustifiée
          </span>
        </div>
        <span className="text-[9px] italic opacity-80">
          Objectif assiduité : 75%
        </span>
      </div>
    </div>
  )
}
