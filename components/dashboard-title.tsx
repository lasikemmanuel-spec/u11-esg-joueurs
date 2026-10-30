import { ClubCrest } from '@/components/club-crest'
import { Sparkles, Trophy } from 'lucide-react'

export function DashboardTitle({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-[#d4af37]/50 bg-gradient-to-r from-[#172554] via-[#1e3a70] to-[#172554] px-5 py-4 shadow-[0_8px_24px_rgba(23,37,84,0.16)]">
      <Sparkles aria-hidden="true" className="absolute -right-2 -top-4 size-24 rotate-12 text-[#d4af37]/15" />
      <div className="relative flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#f0cf68]">
          <Trophy aria-hidden="true" className="size-6" />
        </span>
        <ClubCrest className="size-11 shrink-0 ring-2 ring-[#d4af37]" />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#f0cf68]">ES Genech · Les stats du groupe</p>
          <h2 className="mt-0.5 text-xl font-black tracking-tight text-white sm:text-2xl">{title}</h2>
          <p className="mt-1 text-xs font-medium text-white/75">{subtitle}</p>
        </div>
      </div>
    </header>
  )
}
