export function DataQualityPanel({
  missingBirthDates,
  suspiciousBirthDates,
  noPosition,
  noTransfer,
}: {
  missingBirthDates: number
  suspiciousBirthDates: number
  noPosition: number
  noTransfer: number
}) {
  return (
    <section
      aria-label="Données à compléter"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground"
    >
      <span className="font-medium text-foreground">Données à compléter</span>
      <span>Dates manquantes : <span className="font-mono text-foreground">{missingBirthDates}</span></span>
      <span>Dates à vérifier : <span className="font-mono text-foreground">{suspiciousBirthDates}</span></span>
      <span>Sans poste : <span className="font-mono text-foreground">{noPosition}</span></span>
      <span>Statut muté vide : <span className="font-mono text-foreground">{noTransfer}</span></span>
    </section>
  )
}
