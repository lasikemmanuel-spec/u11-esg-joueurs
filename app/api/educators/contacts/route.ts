import { NextResponse } from 'next/server'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'
import {
  getEducatorPhones,
  PhoneMigrationRequiredError,
  updateEducatorParentPhone,
} from '@/lib/educator-phones'

export const runtime = 'nodejs'

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

export async function GET(request: Request) {
  const educator = getEducatorSession(request)
  if (!educator) return jsonResponse({ error: 'Connexion requise.' }, 401)

  try {
    const phones = await getEducatorPhones()
    return jsonResponse({
      phones,
      educator: { displayName: educator.displayName, role: educator.role },
    })
  } catch (error) {
    if (error instanceof PhoneMigrationRequiredError) {
      return jsonResponse({
        error: 'L’onglet des téléphones éducateurs doit être créé.',
        migrationRequired: true,
        educator: { displayName: educator.displayName, role: educator.role },
      }, 409)
    }
    console.error('Erreur de lecture des téléphones éducateurs:', error)
    return jsonResponse({ error: 'Impossible de charger les coordonnées.' }, 500)
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const educator = getEducatorSession(request)
  if (!educator) return jsonResponse({ error: 'Connexion requise.' }, 401)
  if (educator.role !== 'admin') return jsonResponse({ error: 'Droits insuffisants.' }, 403)
  if (Number(request.headers.get('content-length') ?? 0) > 2048) {
    return jsonResponse({ error: 'Requête trop volumineuse.' }, 413)
  }

  let input: { number?: unknown; parent?: unknown; phone?: unknown }
  try {
    input = await request.json()
  } catch {
    return jsonResponse({ error: 'Coordonnée invalide.' }, 400)
  }
  const parent = input.parent
  if (
    typeof input.number !== 'number' ||
    (parent !== 'father' && parent !== 'mother') ||
    typeof input.phone !== 'string'
  ) {
    return jsonResponse({ error: 'Coordonnée invalide.' }, 400)
  }

  try {
    await updateEducatorParentPhone(input.number, parent, input.phone)
    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('Erreur de mise à jour du téléphone éducateur:', error)
    return jsonResponse({ error: 'Impossible d’enregistrer ce numéro.' }, 500)
  }
}
