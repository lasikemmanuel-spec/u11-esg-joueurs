'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, RefreshCw, WifiOff } from 'lucide-react'
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
                ? `${pendingCount} saisie(s) sauvegardée(s) sur cet appareil`
                : 'Saisie possible sur le terrain sans réseau'}
            </p>
            {pendingCount > 0 && <p className="mt-1 text-amber-100/70">Elles seront conservées jusqu’à leur envoi.</p>}
          </div>
        </div>
      )}

      {isOnline && pendingCount > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl border border-sky-400/40 bg-[#0f1b3b]/95 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
              <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sky-200">
                {syncing ? 'Synchronisation en cours…' : syncResult?.failed ? 'Synchronisation incomplète' : 'Connexion rétablie'}
              </p>
              <p className="text-white/80">
                {pendingCount} saisie(s) en attente d’envoi. Elles restent enregistrées sur cet appareil.
              </p>
            </div>
            {!syncing && (
              <button
                type="button"
                onClick={() => { void triggerSync() }}
                aria-label="Réessayer l’envoi des saisies en attente"
                className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#e0bd43] px-2.5 py-1.5 font-bold text-[#101b40] shadow hover:bg-amber-300 active:scale-95 transition"
              >
                <RefreshCw className="size-3" />
                {syncResult?.failed ? 'Réessayer' : 'Envoyer'}
              </button>
            )}
          </div>
          {Boolean(syncResult?.failed) && (
            <div role="alert" className="flex gap-2 rounded-xl border border-rose-300/30 bg-rose-950/40 p-2 text-rose-100">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p>{syncResult?.failed} envoi(s) ont échoué. Vérifie ta connexion et ta session éducateur, puis réessaie.</p>
                {syncResult?.errors.slice(0, 2).map((error, index) => (
                  <p key={`${index}-${error}`} className="mt-1 break-words text-rose-100/75">{error}</p>
                ))}
              </div>
            </div>
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
