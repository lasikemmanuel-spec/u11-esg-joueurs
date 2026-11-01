import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'
import { saveOwnEducatorDirectoryEntry } from '@/lib/educator-directory'

export const runtime = 'nodejs'

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

export async function PUT(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return response({ error: 'La saisie est désactivée dans cet aperçu.' }, 403)
  }
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)

  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return response({ error: 'La connexion éducateur n’est pas disponible.' }, 503)
  }
  if (!educator) return response({ error: 'Connexion requise.' }, 401)
  if (educator.role === 'reader') return response({ error: 'Accès réservé aux éducateurs.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 4096) {
    return response({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: Record<string, unknown>
  try {
    input = await request.json()
  } catch {
    return response({ error: 'Fiche invalide.' }, 400)
  }
  if (typeof input.licenseNumber !== 'string' || typeof input.phone !== 'string') {
    return response({ error: 'Fiche invalide.' }, 400)
  }

  try {
    const saved = await saveOwnEducatorDirectoryEntry({
      name: educator.displayName,
      licenseNumber: input.licenseNumber,
      phone: input.phone,
    })
    revalidateTag('google-sheet', 'max')
    return response({ ok: true, ...saved })
  } catch (error) {
    console.error('Erreur de mise à jour de la fiche éducateur:', error)
    return response({ error: error instanceof Error ? error.message : 'Impossible d’enregistrer cette fiche.' }, 400)
  }
}
