import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'
import { getEducatorDirectory, saveEducatorDirectoryEntry } from '@/lib/educator-directory'

export const runtime = 'nodejs'

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

export async function GET(request: Request) {
  const educator = getEducatorSession(request)
  if (!educator) return response({ error: 'Connexion requise.' }, 401)
  try {
    return response({ educators: await getEducatorDirectory() })
  } catch (error) {
    console.error('Erreur de lecture de l’annuaire des éducateurs:', error)
    return response({ error: 'Impossible de charger l’annuaire des éducateurs.' }, 500)
  }
}

async function save(request: Request, editing: boolean) {
  if (process.env.VERCEL_ENV !== 'production') return response({ error: 'La saisie est désactivée dans cet aperçu.' }, 403)
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)
  const educator = getEducatorSession(request)
  if (!educator) return response({ error: 'Connexion requise.' }, 401)
  if (educator.role !== 'admin') return response({ error: 'Seul l’administrateur peut modifier l’annuaire.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return response({ error: 'Requête trop volumineuse.' }, 413)

  let input: Record<string, unknown>
  try { input = await request.json() } catch { return response({ error: 'Fiche invalide.' }, 400) }
  const id = input.id
  const name = input.name
  const licenseNumber = input.licenseNumber
  const phone = input.phone
  if (
    (editing && (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) ||
    (!editing && id !== undefined) ||
    typeof name !== 'string' ||
    typeof licenseNumber !== 'string' ||
    typeof phone !== 'string'
  ) return response({ error: 'Fiche invalide.' }, 400)

  try {
    const saved = await saveEducatorDirectoryEntry({ id: editing ? id as string : undefined, name, licenseNumber, phone })
    revalidateTag('google-sheet', 'max')
    return response({ ok: true, ...saved })
  } catch (error) {
    console.error('Erreur d’enregistrement de l’annuaire des éducateurs:', error)
    return response({ error: error instanceof Error ? error.message : 'Impossible d’enregistrer cette fiche.' }, 400)
  }
}

export async function POST(request: Request) { return save(request, false) }
export async function PUT(request: Request) { return save(request, true) }
