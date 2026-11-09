export const TRAINING_ATTENDANCE_STATUSES = [
  { value: 'P', label: 'Présent', shortLabel: 'Présent' },
  { value: 'AJ', label: 'Absence justifiée', shortLabel: 'Justifié' },
  { value: 'AI', label: 'Absence injustifiée', shortLabel: 'Absent' },
  { value: 'B', label: 'Blessé', shortLabel: 'Blessé' },
  { value: 'E', label: 'Exempt', shortLabel: 'Exempt' },
] as const

export type TrainingAttendanceStatus = (typeof TRAINING_ATTENDANCE_STATUSES)[number]['value']

export type TrainingAttendanceSession = {
  date: string
  playerStatuses: Record<number, string>
}

export type TrainingAttendanceEntry = {
  number: number
  status: TrainingAttendanceStatus
}
