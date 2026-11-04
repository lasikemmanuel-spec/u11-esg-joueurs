'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

export function ScrollToTopButton() {
  const [hasScrolled, setHasScrolled] = useState(false)
  const [canScrollDown, setCanScrollDown] = useState(true)

  useEffect(() => {
    const updateScrollState = () => {
      setHasScrolled(window.scrollY > 80)
      const isBottom = window.innerHeight + window.scrollY >= (document.documentElement.scrollHeight - 50)
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

  const scrollByStep = (direction: 'up' | 'down') => {
    // Défilement progressif et doux (~400px, soit 6 à 7 joueurs) pour ne pas sauter tout en bas
    const step = Math.min(Math.round(window.innerHeight * 0.6), 400)
    window.scrollBy({
      top: direction === 'down' ? step : -step,
      behavior: 'smooth',
    })
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  return (
    <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 sm:right-6 sm:bottom-6">
      <button
        type="button"
        aria-label="Remonter d'un écran"
        title="Remonter (double-clic pour tout en haut)"
        onClick={() => scrollByStep('up')}
        onDoubleClick={scrollToTop}
        className={`${hasScrolled ? 'inline-flex' : 'hidden'} size-12 items-center justify-center rounded-full border-2 border-accent bg-primary text-primary-foreground shadow-[0_6px_24px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-1 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:inline-flex`}
      >
        <ArrowUp aria-hidden="true" className="size-6" />
      </button>
      <button
        type="button"
        aria-label="Descendre d'un écran"
        title="Descendre d'une page"
        onClick={() => scrollByStep('down')}
        className={`${canScrollDown ? 'inline-flex' : 'hidden'} size-12 items-center justify-center rounded-full border-2 border-accent bg-primary text-primary-foreground shadow-[0_6px_24px_rgba(0,0,0,0.28)] transition-transform hover:translate-y-1 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:inline-flex`}
      >
        <ArrowDown aria-hidden="true" className="size-6" />
      </button>
    </div>
  )
}
