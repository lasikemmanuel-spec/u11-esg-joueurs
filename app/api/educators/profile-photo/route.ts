import { NextResponse } from 'next/server'
import { findEducator, getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { getEducatorProfilePhoto, saveEducatorProfilePhoto } from '@/lib/educator-profile-photo'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 45 * 1024

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

async function readJsonBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Données de photo invalides.')
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      throw new RangeError('La photo dépasse la taille maximale autorisée.')
    }
    chunks.push(value)
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown
  } catch {
    throw new Error('Données de photo invalides.')
  }
}

async function requireEducator(request: Request) {
  try {
    const educator = await getEducatorSession(request)
    if (!educator) return { error: jsonResponse({ error: 'Connexion requise.' }, 401) }
    return { educator }
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return { error: jsonResponse({ error: 'La connexion éducateur n’est pas disponible.' }, 503) }
  }
}

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get('username')?.trim()
  if (!username || username.length > 120 || !/^[\p{L}\p{N}._@+-]+$/u.test(username)) {
    return jsonResponse({ error: 'Identifiant invalide.' }, 400)
  }

  try {
    const account = await findEducator(username)
    if (!account) return jsonResponse({ error: 'Photo indisponible.' }, 404)
    const photo = await getEducatorProfilePhoto(account.username)
    if (!photo) return jsonResponse({ error: 'Photo indisponible.' }, 404)
    return new Response(new Uint8Array(photo), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Erreur de lecture de la photo de profil éducateur:', error)
    return jsonResponse({ error: 'Impossible de charger cette photo.' }, 500)
  }
}

export async function PUT(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') return jsonResponse({ error: 'La saisie est désactivée dans cet aperçu.' }, 403)
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const access = await requireEducator(request)
  if (access.error) return access.error
  if (!hasEducatorAccess(access.educator)) return jsonResponse({ error: 'Accès réservé aux éducateurs.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'La photo dépasse la taille maximale autorisée.' }, 413)
  }

  let input: unknown
  try {
    input = await readJsonBody(request)
  } catch (error) {
    const tooLarge = error instanceof RangeError
    return jsonResponse({ error: tooLarge && error instanceof Error ? error.message : 'Données de photo invalides.' }, tooLarge ? 413 : 400)
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    !('photo' in input) ||
    typeof input.photo !== 'string'
  ) return jsonResponse({ error: 'Données de photo invalides.' }, 400)

  try {
    await saveEducatorProfilePhoto(access.educator.username, input.photo)
    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('Erreur d’enregistrement de la photo de profil éducateur:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Impossible d’enregistrer cette photo.' }, 400)
  }
}

export async function DELETE(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') return jsonResponse({ error: 'La saisie est désactivée dans cet aperçu.' }, 403)
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const access = await requireEducator(request)
  if (access.error) return access.error
  if (!hasEducatorAccess(access.educator)) return jsonResponse({ error: 'Accès réservé aux éducateurs.' }, 403)
  try {
    await saveEducatorProfilePhoto(access.educator.username, null)
    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('Erreur de suppression de la photo de profil éducateur:', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Impossible de supprimer cette photo.' }, 400)
  }
}
