import { isDateSuspicious, type Player } from '@/lib/players'

export function DataQualityPanel({ players }: { players: Player[] }) {
  const issues = players.flatMap((p) => {
    const name = `${p.firstName} ${p.lastName}`
    if (!p.birthDate) return [{ key: p.number, name, label: 'date manquante' }]
    if (isDateSuspicious(p)) return [{ key: p.number, name, label: `date improbable (${p.birthDate})` }]
    return []
  })
  const noPosition = players.filter((p) => !p.position).length
  const noTransfer = players.filter((p) => !p.transferStatus).length

  return (
    <section
      aria-label="Données à compléter"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
    >
      <span className="font-medium text-foreground">Données à compléter</span>
      {issues.length > 0 ? (
        issues.map((issue) => (
          <span key={issue.key}>
            <span className="font-medium text-foreground">{issue.name}</span> : {issue.label}
          </span>
        ))
      ) : (
        <span>Dates de naissance OK</span>
      )}
      <span>Sans poste : <span className="font-mono text-foreground">{noPosition}</span></span>
      <span>Statut muté vide : <span className="font-mono text-foreground">{noTransfer}</span></span>
    </section>
  )
}
