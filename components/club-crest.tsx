import { cn } from '@/lib/utils'

// The crest is cropped out of the club banner (1206x267, crest at x=32 y=76, 156px wide).
export function ClubCrest({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Blason de l'Entente Sportive de Genech"
      className={cn('shrink-0 rounded-full bg-no-repeat ring-2 ring-accent/60', className)}
      style={{
        backgroundImage: 'url(/images/banniere-esg.jpeg)',
        backgroundSize: '773% auto',
        backgroundPosition: '3.05% 68.5%',
      }}
    />
  )
}
