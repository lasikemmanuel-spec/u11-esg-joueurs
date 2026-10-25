'use client'

import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

export function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > 240)

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })
    return () => window.removeEventListener('scroll', updateVisibility)
  }, [])

  if (!isVisible) return null

  return (
    <button
      type="button"
      onClick={() => {
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        })
      }}
      className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-accent bg-primary px-4 text-sm font-bold text-primary-foreground shadow-[0_6px_24px_rgba(0,0,0,0.28)] transition-transform hover:-translate-y-1 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:right-6 sm:bottom-6"
    >
      <span className="flex size-7 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <ArrowUp aria-hidden="true" className="size-4" />
      </span>
      Remonter !
    </button>
  )
}
