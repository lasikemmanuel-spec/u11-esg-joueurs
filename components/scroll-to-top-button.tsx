'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > 240)

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  if (!isVisible) return null

  const scrollTo = (position: 'top' | 'bottom') => {
    window.scrollTo({
      top: position === 'top' ? 0 : document.documentElement.scrollHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    })
  }

  return (
    <div className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex flex-col gap-2 sm:right-6 sm:bottom-6">
      <button
        type="button"
        aria-label="Remonter en haut de la page"
        title="Remonter en haut"
        onClick={() => scrollTo('top')}
        className="inline-flex size-12 items-center justify-center rounded-full border-2 border-accent bg-primary text-primary-foreground shadow-[0_6px_24px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-1 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <ArrowUp aria-hidden="true" className="size-6" />
      </button>
      <button
        type="button"
        aria-label="Descendre en bas de la page"
        title="Descendre en bas"
        onClick={() => scrollTo('bottom')}
        className="inline-flex size-12 items-center justify-center rounded-full border-2 border-accent bg-primary text-primary-foreground shadow-[0_6px_24px_rgba(0,0,0,0.28)] transition-transform hover:translate-y-1 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
      >
        <ArrowDown aria-hidden="true" className="size-6" />
      </button>
    </div>
  )
}
