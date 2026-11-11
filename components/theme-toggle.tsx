'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'light' | 'dark'

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.classList.toggle('light', theme === 'light')
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('esg-theme')
    const initialTheme =
      savedTheme === 'light' || savedTheme === 'dark'
        ? savedTheme
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'

    applyTheme(initialTheme)
    setTheme(initialTheme)
  }, [])

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(nextTheme)
    window.localStorage.setItem('esg-theme', nextTheme)
    setTheme(nextTheme)
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Activer le mode ${theme === 'dark' ? 'clair' : 'sombre'}`}
      title={`Activer le mode ${theme === 'dark' ? 'clair' : 'sombre'}`}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-3 text-sm font-bold text-white transition-all hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]"
    >
      {theme === 'dark' ? <Sun aria-hidden="true" className="size-4 text-amber-300" /> : <Moon aria-hidden="true" className="size-4 text-amber-200" />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
    </button>
  )
}
