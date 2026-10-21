import { isDateSuspicious, type Player } from '@/lib/players'

export function DataQualityPanel({ players }: { players: Player[] }) {
  const issues = players.flatMap((p) => {
    const name = `${p.firstName} ${p.lastName}`
    if (!p.birthDate) return [{ key: p.number, name, label: 'Date de naissance manquante' }]
    if (isDateSuspicious(p)) return [{ key: p.number, name, label: `Date improbable (${p.birthDate})` }]
    return []
  })
  const noPosition = players.filter((p) => !p.position).length
  const noTransfer = players.filter((p) => !p.transferStatus).length

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div>
        <h2 className="font-semibold">Données à compléter</h2>
        <p className="text-sm text-muted-foreground">À corriger directement dans le Google Sheet</p>
      </div>

      {issues.length > 0 ? (
        <ul className="flex flex-col divide-y">
          {issues.map((issue) => (
            <li key={issue.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="font-medium">{issue.name}</span>
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                {issue.label}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Toutes les dates de naissance sont valides.</p>
      )}

      <dl className="mt-auto grid grid-cols-2 gap-3 border-t pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Sans poste</dt>
          <dd className="font-mono text-lg font-semibold">{noPosition}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Statut muté vide</dt>
          <dd className="font-mono text-lg font-semibold">{noTransfer}</dd>
        </div>
      </dl>
    </section>
  )
}
