import { CalendarDays, ClipboardList, TriangleAlert, Users } from 'lucide-react'
import { ageOn, isDateSuspicious, type Player } from '@/lib/players'

export function StatCards({ players }: { players: Player[] }) {
  const ages = players
    .filter((p) => !isDateSuspicious(p))
    .map((p) => ageOn(p.birthDate))
    .filter((a): a is number => a !== null)
  const averageAge = ages.length ? ages.reduce((s, a) => s + a, 0) / ages.length : null
  const missingDates = players.filter((p) => !p.birthDate).length
  const suspicious = players.filter((p) => isDateSuspicious(p)).length
  const withPosition = players.filter((p) => p.position).length

  const stats = [
    { label: 'Joueurs inscrits', value: String(players.length), hint: 'dans l’effectif', icon: Users },
    {
      label: 'Âge moyen',
      value: averageAge !== null ? `${averageAge.toFixed(1).replace('.', ',')} ans` : '—',
      hint: `sur ${ages.length} dates valides`,
      icon: CalendarDays,
    },
    {
      label: 'Postes renseignés',
      value: `${withPosition}/${players.length}`,
      hint: withPosition === 0 ? 'colonne à compléter' : 'joueurs avec un poste',
      icon: ClipboardList,
    },
    {
      label: 'Dates à vérifier',
      value: String(missingDates + suspicious),
      hint: `${missingDates} manquante${missingDates > 1 ? 's' : ''}, ${suspicious} incohérente${suspicious > 1 ? 's' : ''}`,
      icon: TriangleAlert,
      warn: missingDates + suspicious > 0,
    },
  ]

  return (
    <section aria-label="Indicateurs clés" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(({ label, value, hint, icon: Icon, warn }) => (
        <div key={label} className="flex flex-col gap-3 rounded-xl border bg-card p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{label}</span>
            <Icon
              aria-hidden="true"
              className={warn ? 'size-4 text-accent-foreground' : 'size-4 text-primary'}
            />
          </div>
          <p className="font-mono text-2xl font-semibold tracking-tight md:text-3xl">{value}</p>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      ))}
    </section>
  )
}
