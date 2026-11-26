'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import dynamic from 'next/dynamic'
import {
  createMatchResultDraft,
  saveMatchResultDraft,
  validateMatchResultDraft,
  type MatchResultDraft,
} from '@/lib/match-result-draft'

const MatchResultForm = dynamic(
  () => import('@/components/match-result-form').then((module) => module.MatchResultForm),
  { loading: () => <p role="status" className="fixed inset-x-4 bottom-4 z-[110] rounded-xl bg-card p-4 text-sm text-muted-foreground shadow-xl">Chargement du formulaire…</p> },
)

export function MatchResultPlannerDialog({
  initialDate,
  initialTeam,
  onClose,
  onSaved,
}: {
  initialDate: string
  initialTeam: 'E1' | 'E2'
  onClose: () => void
  onSaved: (sheetTitle: string, date: string) => void
}) {
  const [draft, setDraft] = useState<MatchResultDraft>(() => ({
    ...createMatchResultDraft(initialDate),
    team: initialTeam,
  }))
  const [formMinimized, setFormMinimized] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const closeForm = useCallback(() => {
    setFormMinimized(false)
    onClose()
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) closeForm()
    }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [closeForm, pending])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validationError = validateMatchResultDraft(draft)
    if (validationError) {
      setError(validationError)
      return
    }

    setPending(true)
    setError('')
    try {
      const result = await saveMatchResultDraft(draft)
      onSaved(result.sheetTitle, draft.date)
      closeForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Impossible d’enregistrer le match.')
    } finally {
      setPending(false)
    }
  }

  return (
    <MatchResultForm
      draft={draft}
      editingSlot={null}
      formMinimized={formMinimized}
      pending={pending}
      pendingDeletion={false}
      error={error}
      onSubmit={submit}
      onDraftChange={setDraft}
      onClose={closeForm}
      onMinimize={() => setFormMinimized(true)}
      onRestore={() => setFormMinimized(false)}
    />
  )
}
