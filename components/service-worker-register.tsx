'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('[PWA] Nouvelle version prête.')
                }
              })
            }
          })
        })
        .catch((error) => {
          console.warn('[PWA] Échec enregistrement Service Worker:', error)
        })
    }
  }, [])

  return null
}
