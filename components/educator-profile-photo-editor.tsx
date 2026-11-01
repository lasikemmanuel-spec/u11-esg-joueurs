'use client'

import { useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { EducatorAvatar } from '@/components/educator-avatar'
import { prepareEducatorPhoto } from '@/lib/prepare-educator-photo'

export function EducatorProfilePhotoEditor({
  username,
  revision,
  onPhotoChange,
}: {
  username: string
  revision: number
  onPhotoChange: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const updatePhoto = async (file?: File) => {
    if (!file) return
    setPending(true)
    setError('')
    setNotice('')
    try {
      const photo = await prepareEducatorPhoto(file)
      const response = await fetch('/api/educators/profile-photo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photo }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer la photo.')
      onPhotoChange()
      setNotice('Photo enregistrée. Elle remplacera le blason sur l’écran de connexion.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer la photo.')
    } finally {
      setPending(false)
    }
  }

  const removePhoto = async () => {
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/profile-photo', { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de supprimer la photo.')
      onPhotoChange()
      setNotice('Photo retirée. Le logo de personne sera affiché à la connexion.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de supprimer la photo.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section aria-label="Photo de profil éducateur" className="grid gap-3 rounded-xl border border-accent/50 bg-background p-3">
      <div className="flex items-center gap-3">
        <EducatorAvatar username={username} revision={revision} size="size-14" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-primary">Photo de profil</h4>
          <p className="text-xs text-muted-foreground">Visible à l’écran de connexion pour votre identifiant.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground">
          <Camera aria-hidden="true" className="size-4" />
          {pending ? 'Traitement…' : 'Choisir une photo'}
          <input
            type="file"
            accept="image/*"
            disabled={pending}
            onChange={(event) => {
              void updatePhoto(event.currentTarget.files?.[0])
              event.currentTarget.value = ''
            }}
            className="sr-only"
          />
        </label>
        <button
          type="button"
          onClick={() => void removePhoto()}
          disabled={pending}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-accent/50 px-3 text-sm font-semibold text-primary disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Retirer la photo
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Photo compressée automatiquement, 30 Ko maximum. Seul votre compte connecté peut la modifier.</p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
    </section>
  )
}
