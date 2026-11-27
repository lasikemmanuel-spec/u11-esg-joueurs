export type PlanningPeriodView = 'week' | 'month' | 'year'

export type PlanningDateRange = {
  startDate: string
  endDate: string
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T12:00:00`)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function getPlanningPeriodRange(
  view: PlanningPeriodView,
  anchorDate: string,
): PlanningDateRange {
  const anchor = new Date(`${anchorDate}T12:00:00`)

  if (view === 'week') {
    anchor.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7))
    const startDate = toDateKey(anchor)
    return {
      startDate,
      endDate: addDays(startDate, 6),
    }
  }

  if (view === 'month') {
    const startDate = toDateKey(new Date(anchor.getFullYear(), anchor.getMonth(), 1, 12))
    return {
      startDate,
      endDate: toDateKey(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 12)),
    }
  }

  const seasonStartYear = anchor.getMonth() >= 8 ? anchor.getFullYear() : anchor.getFullYear() - 1
  return {
    startDate: toDateKey(new Date(seasonStartYear, 8, 1, 12)),
    endDate: toDateKey(new Date(seasonStartYear + 1, 5, 30, 12)),
  }
}

export function shiftPlanningPeriod(
  view: PlanningPeriodView,
  anchorDate: string,
  direction: -1 | 1,
) {
  const { startDate } = getPlanningPeriodRange(view, anchorDate)

  if (view === 'week') {
    return addDays(startDate, 7 * direction)
  }

  const date = new Date(`${startDate}T12:00:00`)
  if (view === 'month') {
    date.setMonth(date.getMonth() + direction)
  } else {
    date.setFullYear(date.getFullYear() + direction)
  }
  return toDateKey(date)
}

export function getPlanningMonthCalendarDays(monthDate: string) {
  const month = new Date(`${monthDate}T12:00:00`)
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12)
  const startDate = addDays(toDateKey(firstDay), -((firstDay.getDay() + 6) % 7))
  const endDate = addDays(toDateKey(lastDay), 6 - ((lastDay.getDay() + 6) % 7))
  const days: string[] = []

  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    days.push(date)
  }

  return days
}

export function getPlanningMonthStarts(startDate: string, endDate: string) {
  const month = new Date(`${startDate}T12:00:00`)
  month.setDate(1)
  const months: string[] = []

  while (toDateKey(month) <= endDate) {
    months.push(toDateKey(month))
    month.setMonth(month.getMonth() + 1)
  }

  return months
}
