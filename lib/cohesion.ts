import { getSheetRows } from '@/lib/google-sheets'

const TAB = '🎗️ Journée Cohesion'

export type CohesionDay = {
  date: string
  presentCount: number
}

function isDate(value: string) {
  return /^\d{1,2}[/. -]\d{1,2}(?:[/. -]\d{4})?$/.test(value) ||
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(value)
}

export async function getCohesionDays(): Promise<CohesionDay[]> {
  const rows = await getSheetRows(TAB)
  const days: CohesionDay[] = []

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const hasDateLabel = rows[rowIndex].some(
      (value) => value.trim().toLocaleLowerCase('fr-FR') === 'date',
    )
    if (!hasDateLabel) continue

    for (let column = 0; column < rows[rowIndex].length; column += 1) {
      const date = rows[rowIndex][column].trim()
      if (!isDate(date)) continue

      let presentCount = 0
      for (let attendanceRow = rowIndex + 1; attendanceRow < rows.length; attendanceRow += 1) {
        if (!/^\d+$/.test(rows[attendanceRow][0]?.trim() ?? '')) continue
        const status = rows[attendanceRow][column]?.trim().toLocaleLowerCase('fr-FR') ?? ''
        if (status.includes('présent') || status.includes('present')) presentCount += 1
      }

      days.push({ date, presentCount })
    }
  }

  return days
}
