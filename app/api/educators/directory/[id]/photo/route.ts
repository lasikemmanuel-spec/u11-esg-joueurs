import { NextResponse } from 'next/server'
import { getEducatorPhoto, saveEducatorPhoto } from '@/lib/educator-directory'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = 45 * 1024

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

async function readJsonBody(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new Error('Photo invalide.')
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
    throw new Error('Photo invalide.')
  }
}

async function authorize(request: Request, adminOnly = false) {
  try {
    const educator = await getEducatorSession(request)
    if (!educator) return { error: response({ error: 'Connexion requise.' }, 401) }
    if (adminOnly && educator.role !== 'admin') {
      return { error: response({ error: 'Seul l’administrateur peut modifier les photos.' }, 403) }
    }
    return { educator }
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return { error: response({ error: 'La connexion éducateur n’est pas disponible.' }, 503) }
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await authorize(request)
  if (access.error) return access.error
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response({ error: 'Fiche invalide.' }, 400)

  try {
    const photo = await getEducatorPhoto(id)
    if (!photo) return response({ error: 'Aucune photo pour cet éducateur.' }, 404)
    return new Response(new Uint8Array(photo), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store, private',
        Vary: 'Cookie',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Erreur de lecture de la photo d’éducateur:', error)
    return response({ error: 'Impossible de charger cette photo.' }, 500)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.VERCEL_ENV !== 'production') return response({ error: 'La saisie est désactivée dans cet aperçu.' }, 403)
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)
  const access = await authorize(request, true)
  if (access.error) return access.error

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response({ error: 'Fiche invalide.' }, 400)
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return response({ error: 'La photo dépasse la taille maximale autorisée.' }, 413)
  }

  let input: unknown
  try {
    input = await readJsonBody(request)
  } catch (error) {
    const tooLarge = error instanceof RangeError
    return response({ error: tooLarge ? error.message : 'Photo invalide.' }, tooLarge ? 413 : 400)
  }
  if (
    typeof input !== 'object' ||
    input === null ||
    !('photo' in input) ||
    typeof input.photo !== 'string'
  ) return response({ error: 'Photo invalide.' }, 400)

  try {
    await saveEducatorPhoto(id, input.photo)
    return response({ ok: true })
  } catch (error) {
    console.error('Erreur d’enregistrement de la photo d’éducateur:', error)
    return response({ error: error instanceof Error ? error.message : 'Impossible d’enregistrer cette photo.' }, 400)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (process.env.VERCEL_ENV !== 'production') return response({ error: 'La saisie est désactivée dans cet aperçu.' }, 403)
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)
  const access = await authorize(request, true)
  if (access.error) return access.error

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response({ error: 'Fiche invalide.' }, 400)
  try {
    await saveEducatorPhoto(id, null)
    return response({ ok: true })
  } catch (error) {
    console.error('Erreur de suppression de la photo d’éducateur:', error)
    return response({ error: error instanceof Error ? error.message : 'Impossible de supprimer cette photo.' }, 400)
  }
}
