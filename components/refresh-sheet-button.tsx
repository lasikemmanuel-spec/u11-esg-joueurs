'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { refreshSheetData } from '@/app/actions'

export function RefreshSheetButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [canRefresh, setCanRefresh] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const refreshPermission = useCallback(async () => {
    try {
      const response = await fetch('/api/educators/session', { cache: 'no-store' })
      setCanRefresh(response.ok)
    } catch (cause) {
      console.error('Impossible de vérifier les droits d’actualisation:', cause)
      setCanRefresh(false)
    }
  }, [])

  useEffect(() => {
    void refreshPermission()
    window.addEventListener('educator-session-changed', refreshPermission)
    return () => window.removeEventListener('educator-session-changed', refreshPermission)
  }, [refreshPermission])

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

  if (!canRefresh) return null

  return (
    <div className="flex flex-row items-center gap-1 md:items-end">
      <button
        type="button"
        onClick={refresh}
        disabled={isPending}
        aria-busy={isPending}
        className="inline-flex min-h-10 w-fit items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-2.5 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 disabled:cursor-wait disabled:opacity-70 sm:gap-2 sm:px-4 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
      >
        <RefreshCw aria-hidden="true" className={`size-4 text-amber-300 ${isPending ? 'animate-spin' : ''}`} />
        <span className={compact ? 'sm:hidden' : 'hidden'}>{isPending ? 'Actualisation…' : 'Actualiser'}</span>
        <span className={compact ? 'hidden sm:inline' : ''}>
          {isPending ? 'Actualisation…' : 'Actualiser les données'}
        </span>
      </button>
      {error && <p role="alert" className="max-w-xs text-right text-xs text-red-200">{error}</p>}
    </div>
  )
}
