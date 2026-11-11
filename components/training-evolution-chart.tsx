'use client'

import { useId, useMemo, useState } from 'react'
import { TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react'
import type { TrainingAttendanceSession } from '@/lib/training-attendance-shared'

const STATUS_CONFIG: Record<string, { label: string; short: string; color: string }> = {
  P: { label: 'Présent', short: 'P', color: '#059669' },
  AJ: { label: 'Absence justifiée', short: 'AJ', color: '#d97706' },
  AI: { label: 'Absence injustifiée', short: 'AI', color: '#dc2626' },
  B: { label: 'Blessé', short: 'B', color: '#7c3aed' },
  E: { label: 'Exempt', short: 'E', color: '#0284c7' },
}

function localToday() {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 10)
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
  const today = localToday()

  // 1. Filtrer UNIQUEMENT les séances passées (pas d'entraînements futurs)
  // et ne retenir pour la courbe que les séances où le joueur a été évalué
  const chronologicalData = useMemo(() => {
    if (!sessions || sessions.length === 0) return []

    // Exclure les séances futures
    const pastSessions = sessions
      .filter((session) => session.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date))

    let cumulatedPresents = 0
    let cumulatedEvaluated = 0

    return pastSessions
      .map((session, index) => {
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
          statusMeta: STATUS_CONFIG[rawStatus] ?? null,
          isPresent,
          isEvaluated,
          rate,
          cumulatedPresents,
          cumulatedEvaluated,
        }
      })
      // Ne garder que les séances évaluées pour tracer une vraie courbe d'assiduité
      .filter((item) => item.isEvaluated && item.rate !== null && item.statusMeta !== null)
  }, [sessions, playerNumber, today])

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  if (chronologicalData.length === 0) {
    return null
  }

  // Statistiques globales
  const lastPoint = chronologicalData[chronologicalData.length - 1]
  const totalEvaluated = lastPoint?.cumulatedEvaluated ?? 0
  const totalPresents = lastPoint?.cumulatedPresents ?? 0
  const currentRate = lastPoint?.rate ?? 0

  // Dimensions SVG
  const width = 360
  const height = 145
  const padLeft = 36
  const padRight = 20
  const padTop = 16
  const padBottom = 26

  const usableWidth = width - padLeft - padRight
  const usableHeight = height - padTop - padBottom

  // Coordonnées (x, y) pour chaque séance évaluée
  const pointsWithCoords = chronologicalData.map((point, i) => {
    const x = chronologicalData.length === 1
      ? padLeft + usableWidth / 2
      : padLeft + (i / (chronologicalData.length - 1)) * usableWidth
    // y inversé : 100% en haut (padTop), 0% en bas (padTop + usableHeight)
    const y = padTop + (1 - (point.rate ?? 0) / 100) * usableHeight
    return { ...point, x, y }
  })

  // Tracé de la ligne SVG
  const pathD = pointsWithCoords.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    const prev = pointsWithCoords[i - 1]
    const cpX = (prev.x + p.x) / 2
    return `${acc} C ${cpX.toFixed(1)} ${prev.y.toFixed(1)}, ${cpX.toFixed(1)} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }, '')

  // Tracé de la surface sous la courbe
  const firstP = pointsWithCoords[0]
  const lastP = pointsWithCoords[pointsWithCoords.length - 1]
  const bottomY = padTop + usableHeight
  const areaD = `${pathD} L ${lastP.x.toFixed(1)} ${bottomY.toFixed(1)} L ${firstP.x.toFixed(1)} ${bottomY.toFixed(1)} Z`

  // Y des repères
  const y75 = padTop + (1 - 0.75) * usableHeight
  const y50 = padTop + (1 - 0.50) * usableHeight

  // Point actif pour le bandeau sous le graphe (dernier par défaut)
  const activePoint = selectedIndex !== null && pointsWithCoords[selectedIndex]
    ? pointsWithCoords[selectedIndex]
    : pointsWithCoords[pointsWithCoords.length - 1]

  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-[#172554]/20 bg-white p-3.5 shadow-md dark:border-amber-400/40 dark:bg-[#0b1730]">
      {/* En-tête du graphique */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5 dark:border-amber-400/20">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#172554] text-amber-300 dark:bg-amber-400 dark:text-blue-950 shadow-sm">
            <TrendingUp aria-hidden="true" className="size-4" />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-[#172554] dark:text-amber-200">
              Évolution assiduité
            </h4>
            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              {totalPresents} présence{totalPresents > 1 ? 's' : ''} sur {totalEvaluated} séance{totalEvaluated > 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black shadow-sm ${
              currentRate >= 75
                ? 'border border-emerald-600 bg-emerald-100 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950 dark:text-emerald-200'
                : 'border border-amber-600 bg-amber-100 text-amber-950 dark:border-amber-400 dark:bg-amber-950 dark:text-amber-200'
            }`}
          >
            {currentRate >= 75 ? (
              <CheckCircle2 aria-hidden="true" className="size-3.5 text-emerald-700 dark:text-emerald-300" />
            ) : (
              <AlertCircle aria-hidden="true" className="size-3.5 text-amber-700 dark:text-amber-300" />
            )}
            <span>{currentRate}%</span>
          </span>
        </div>
      </div>

      {/* Rendu SVG du graphique dans un conteneur au contraste renforcé */}
      <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-50/90 p-2 shadow-inner dark:border-slate-800 dark:bg-[#071126]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-36 select-none overflow-visible"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e3a8a" stopOpacity="0.30" className="dark:stop-color-[#d4af37]" />
              <stop offset="100%" stopColor="#172554" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Repère 100% */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={width - padRight}
            y2={padTop}
            stroke="#94a3b8"
            strokeOpacity="0.4"
            strokeDasharray="2,3"
          />
          <text
            x={padLeft - 5}
            y={padTop + 3}
            textAnchor="end"
            fontSize="9"
            fontWeight="bold"
            className="fill-slate-700 dark:fill-slate-300 font-mono"
          >
            100%
          </text>

          {/* Ligne repère 75% (objectif ESG) */}
          <line
            x1={padLeft}
            y1={y75}
            x2={width - padRight}
            y2={y75}
            stroke="#d97706"
            strokeWidth="1.2"
            strokeDasharray="3,3"
          />
          <text
            x={padLeft - 5}
            y={y75 + 3}
            textAnchor="end"
            fontSize="9"
            fontWeight="900"
            fill="#d97706"
            className="font-mono"
          >
            75%
          </text>

          {/* Ligne repère 50% */}
          <line
            x1={padLeft}
            y1={y50}
            x2={width - padRight}
            y2={y50}
            stroke="#94a3b8"
            strokeOpacity="0.4"
            strokeDasharray="2,3"
          />
          <text
            x={padLeft - 5}
            y={y50 + 3}
            textAnchor="end"
            fontSize="9"
            fontWeight="bold"
            className="fill-slate-700 dark:fill-slate-300 font-mono"
          >
            50%
          </text>

          {/* Remplissage dégradé sous la courbe */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Ligne principale du taux d'assiduité (bleu roi en clair / or en sombre) */}
          <path
            d={pathD}
            fill="none"
            className="stroke-[#1e3a8a] dark:stroke-[#fbbf24]"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points interactifs de chaque séance */}
          {pointsWithCoords.map((point, i) => {
            const isSelected = (selectedIndex === null && i === pointsWithCoords.length - 1) || selectedIndex === i
            return (
              <g
                key={point.date}
                className="cursor-pointer"
                onClick={() => setSelectedIndex(i)}
              >
                {/* Zone de clic élargie */}
                <circle cx={point.x} cy={point.y} r="12" fill="transparent" />

                {/* Anneau de sélection autour du point sélectionné */}
                {isSelected && (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r="7"
                    fill="none"
                    stroke="#172554"
                    className="dark:stroke-amber-300"
                    strokeWidth="2"
                  />
                )}

                {/* Point de la séance */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isSelected ? 5 : 3.8}
                  fill={point.statusMeta?.color ?? '#64748b'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />

                {/* Dates au bas du graphique */}
                {(i === 0 || i === pointsWithCoords.length - 1 || isSelected) && (
                  <text
                    x={point.x}
                    y={height - 7}
                    textAnchor={i === 0 ? 'start' : i === pointsWithCoords.length - 1 ? 'end' : 'middle'}
                    fontSize="9"
                    fontWeight="800"
                    className={`font-mono ${
                      isSelected
                        ? 'fill-[#172554] dark:fill-amber-300 font-black'
                        : 'fill-slate-600 dark:fill-slate-400'
                    }`}
                  >
                    {point.formattedDate}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {/* Bandeau d'information sur la séance cliquée ou la dernière séance */}
      {activePoint && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs shadow-sm dark:border-amber-400/30 dark:bg-[#132347]">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
              Séance du {activePoint.formattedDate} :
            </span>
            <span
              className="inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-black text-white shadow-sm"
              style={{ backgroundColor: activePoint.statusMeta?.color ?? '#64748b' }}
            >
              {activePoint.statusMeta?.label}
            </span>
          </div>
          <div className="flex items-center gap-1 font-mono text-xs font-black">
            <span className="text-slate-600 dark:text-slate-300">Taux cumulé :</span>
            <span className="text-[#172554] dark:text-amber-300 text-sm">{activePoint.rate}%</span>
          </div>
        </div>
      )}

      {/* Légende bien lisible */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1 text-[11px] font-bold text-slate-700 dark:text-slate-200">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-600 shadow-sm" /> Présent
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-amber-600 shadow-sm" /> Abs. justifiée
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-red-600 shadow-sm" /> Abs. injustifiée
          </span>
        </div>
        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
          Objectif club : 75%
        </span>
      </div>
    </div>
  )
}
