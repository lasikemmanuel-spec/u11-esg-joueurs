'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

export function ScrollToTopButton() {
  const [hasScrolled, setHasScrolled] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(true)

  useEffect(() => {
    const updateScrollState = () => {
      // Afficher uniquement après avoir défilé d'au moins 150px
      setHasScrolled(window.scrollY > 150)
      const isBottom = window.innerHeight + window.scrollY >= (document.documentElement.scrollHeight - 60)
      setCanScrollDown(!isBottom)
    }
    updateScrollState()
    window.addEventListener('scroll', updateScrollState, { passive: true })
    window.addEventListener('resize', updateScrollState, { passive: true })
    return () => {
      window.removeEventListener('scroll', updateScrollState)
      window.removeEventListener('resize', updateScrollState)
    }
  }, [])

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const scrollByStepDown = () => {
    const step = Math.min(Math.round(window.innerHeight * 0.6), 400)
    window.scrollBy({
      top: step,
      behavior: 'smooth',
    })
  }

  return (
    <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 sm:right-6 sm:bottom-6">
      {/* Flèche du haut : affichée uniquement après défilement (jamais en haut de page) */}
      {hasScrolled && (
        <button
          type="button"
          aria-label="Remonter en haut de page"
          title="Remonter en haut"
          onClick={scrollToTop}
          className="inline-flex size-11 sm:size-12 items-center justify-center rounded-full border-2 border-accent bg-primary text-primary-foreground shadow-[0_6px_24px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
        >
          <ArrowUp aria-hidden="true" className="size-5 sm:size-6" />
        </button>
      )}

      {/* Flèche du bas : masquée sur téléphone, affichée uniquement sur PC tant qu'on n'est pas tout en bas */}
      {canScrollDown && (
        <button
          type="button"
          aria-label="Descendre d'une page"
          title="Descendre d'une page"
          onClick={scrollByStepDown}
          className="hidden sm:inline-flex size-12 items-center justify-center rounded-full border-2 border-accent bg-primary text-primary-foreground shadow-[0_6px_24px_rgba(0,0,0,0.28)] transition-all hover:translate-y-1 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
        >
          <ArrowDown aria-hidden="true" className="size-6" />
        </button>
      )}
    </div>
  )
}
