'use server'

import { updateTag } from 'next/cache'
import { headers } from 'next/headers'
import { getEducatorSession } from '@/lib/educator-auth'

export async function refreshSheetData() {
  const request = new Request('http://localhost', { headers: await headers() })
  if (!getEducatorSession(request)) {
    throw new Error('Connexion éducateur requise pour actualiser les données.')
  }
  updateTag('google-sheet')
}
