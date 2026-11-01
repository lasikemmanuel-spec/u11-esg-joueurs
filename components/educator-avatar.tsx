'use client'

import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'

export function EducatorAvatar({ username, revision = 0, size = 'size-16' }: {
  username: string
  revision?: number
  size?: string
}) {
  const [loadedUsername, setLoadedUsername] = useState('')
  const [previewUsername, setPreviewUsername] = useState('')
  const normalizedUsername = username.trim()

  useEffect(() => {
    setLoadedUsername('')
  }, [normalizedUsername, revision])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setPreviewUsername(normalizedUsername),
      normalizedUsername ? 300 : 0,
    )
    return () => window.clearTimeout(timer)
  }, [normalizedUsername])

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full border border-accent/50 bg-muted ${size}`}>
      {previewUsername && (
        <img
          src={`/api/educators/profile-photo?username=${encodeURIComponent(previewUsername)}&v=${revision}`}
          alt=""
          aria-hidden="true"
          onLoad={() => setLoadedUsername(previewUsername)}
          onError={() => setLoadedUsername('')}
          className={`absolute inset-0 size-full object-cover ${loadedUsername === normalizedUsername ? '' : 'hidden'}`}
        />
      )}
      {(!normalizedUsername || loadedUsername !== normalizedUsername || previewUsername !== normalizedUsername) && (
        <UserRound aria-hidden="true" className="absolute inset-0 m-auto size-1/2 text-muted-foreground" />
      )}
    </div>
  )
}
