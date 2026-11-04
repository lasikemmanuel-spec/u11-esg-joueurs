import Image from 'next/image'
import { cn } from '@/lib/utils'

export function ClubCrest({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Blason de l'Entente Sportive de Genech"
      className={cn('relative shrink-0 aspect-square overflow-hidden rounded-full ring-2 ring-accent/60', className)}
    >
      <Image
        src="/images/logo-esg.png"
        alt="Blason de l'Entente Sportive de Genech"
        fill
        sizes="(max-width: 640px) 96px, (max-width: 1024px) 160px, 450px"
        className="object-contain"
        priority
      />
    </div>
  )
}
