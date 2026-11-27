import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'

export const runtime = 'nodejs'

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)

  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session pour l’actualisation:', error)
    return response({ error: 'La connexion éducateur n’est pas disponible.' }, 503)
  }
  if (!educator) return response({ error: 'Connexion éducateur requise.' }, 401)
  if (!hasEducatorAccess(educator)) return response({ error: 'Accès réservé aux éducateurs.' }, 403)

  revalidateTag('google-sheet', { expire: 0 })
  return response({ ok: true })
}
