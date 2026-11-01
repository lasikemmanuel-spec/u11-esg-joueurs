import { isDateSuspicious, type Player } from '@/lib/players'

export function DataQualityPanel({ players }: { players: Player[] }) {
  const missingBirthDates = players.filter((player) => !player.birthDate).length
  const suspiciousBirthDates = players.filter((player) => isDateSuspicious(player)).length
  const noPosition = players.filter((p) => !p.position).length
  const noTransfer = players.filter((p) => !p.transferStatus).length

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
