'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { refreshSheetData } from '@/app/actions'

export function RefreshSheetButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function refresh() {
    setError(null)
    startTransition(async () => {
      try {
        await refreshSheetData()
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Impossible d’actualiser les données du Sheet.')
      }
    })
  }

  return (
    <div className="flex flex-col items-start gap-1 md:items-end">
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex w-fit items-center gap-2 rounded-xl border border-primary-foreground/25 bg-primary-foreground/10 px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-foreground/15 disabled:cursor-wait disabled:opacity-70"
      >
        <RefreshCw aria-hidden="true" className={`size-4 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? 'Actualisation…' : 'Actualiser les données'}
      </button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-red-200">{error}</p>}
    </div>
  )
}
