'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { useOnlineStatus } from '@/lib/offline-storage'

export function OfflineIndicator() {
  const { isOnline, pendingCount, syncing, syncResult, triggerSync } = useOnlineStatus()
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (syncResult && syncResult.synced > 0 && syncResult.failed === 0) {
      setShowSuccess(true)
      const timer = setTimeout(() => setShowSuccess(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [syncResult])

  // Ne rien afficher si tout va bien en ligne sans action en attente
  if (isOnline && pendingCount === 0 && !showSuccess) {
    return null
  }

  return (
    <aside
      aria-label="État de la connexion hors-ligne"
      className="fixed bottom-4 right-4 z-50 max-w-sm sm:max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {!isOnline && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-[#0f1b3b]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
            <WifiOff className="size-4 animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-amber-300">Mode hors-ligne actif</p>
            <p className="text-white/80">
              {pendingCount > 0
                ? `${pendingCount} saisie(s) sauvegardée(s) localement`
                : 'Saisie possible sur le terrain sans réseau'}
            </p>
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-sky-400/40 bg-[#0f1b3b]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sky-200">
              {syncing ? 'Synchronisation en cours…' : 'Connexion rétablie'}
            </p>
            <p className="text-white/80">
              {pendingCount} saisie(s) en attente d’envoi
            </p>
          </div>
          {!syncing && (
            <button
              type="button"
              onClick={() => { void triggerSync() }}
              className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#e0bd43] px-2.5 py-1.5 font-bold text-[#101b40] shadow hover:bg-amber-300 active:scale-95 transition"
            >
              <RefreshCw className="size-3" />
              Envoyer
            </button>
          )}
        </div>
      )}

      {isOnline && pendingCount === 0 && showSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/40 bg-[#0f1b3b]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <CheckCircle2 className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-emerald-300">Synchronisation réussie</p>
            <p className="text-white/80">Toutes vos saisies sont enregistrées.</p>
          </div>
        </div>
      )}
    </aside>
  )
}
