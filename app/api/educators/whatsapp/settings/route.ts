import { NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getEducatorSession, hasEducatorAccess, isSameOriginRequest } from '@/lib/educator-auth'
import { getSavedWhatsAppSettings, isWhatsAppSettings, saveWhatsAppSettings } from '@/lib/whatsapp-settings-store'

export const runtime = 'nodejs'

function jsonResponse(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

async function authorize(request: Request) {
  try {
    const educator = await getEducatorSession(request)
    if (!educator) return jsonResponse({ error: 'Connexion éducateur requise.' }, 401)
    if (!hasEducatorAccess(educator)) return jsonResponse({ error: 'Accès réservé aux éducateurs.' }, 403)
    return null
  } catch (error) {
    console.error('Erreur de vérification de session pour WhatsApp:', error)
    return jsonResponse({ error: 'La connexion éducateur n’est pas disponible.' }, 503)
  }
}

export async function GET(request: Request) {
  const denied = await authorize(request)
  if (denied) return denied
  try {
    const settings = await getSavedWhatsAppSettings()
    return jsonResponse(settings)
  } catch (error) {
    console.error('Erreur de lecture de la configuration WhatsApp:', error)
    return jsonResponse({ error: 'Impossible de charger la configuration WhatsApp.' }, 500)
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonResponse({ error: 'Requête non autorisée.' }, 403)
  const denied = await authorize(request)
  if (denied) return denied
  if (Number(request.headers.get('content-length') ?? 0) > 20_000) {
    return jsonResponse({ error: 'La configuration WhatsApp est trop volumineuse.' }, 413)
  }

  let settings: unknown
  try {
    settings = await request.json()
  } catch {
    return jsonResponse({ error: 'Configuration WhatsApp invalide.' }, 400)
  }
  if (!isWhatsAppSettings(settings)) {
    return jsonResponse({ error: 'Configuration WhatsApp invalide.' }, 400)
  }

  try {
    await saveWhatsAppSettings(settings)
    revalidateTag('google-sheet', { expire: 0 })
    return jsonResponse({ ok: true })
  } catch (error) {
    console.error('Erreur d’enregistrement de la configuration WhatsApp:', error)
    return jsonResponse({
      error: error instanceof Error ? error.message : 'Impossible d’enregistrer la configuration WhatsApp.',
    }, 400)
  }
}
