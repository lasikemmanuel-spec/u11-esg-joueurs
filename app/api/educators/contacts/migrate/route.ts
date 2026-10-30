import { NextResponse } from 'next/server'
import { getEducatorSession, isSameOriginRequest } from '@/lib/educator-auth'
import { migrateEducatorPhones } from '@/lib/educator-phones'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 })
  }

  const educator = getEducatorSession(request)
  if (!educator) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (educator.role !== 'admin') {
    return NextResponse.json({ error: 'Droits insuffisants.' }, { status: 403 })
  }

  try {
    const migratedCount = await migrateEducatorPhones()
    return NextResponse.json(
      { ok: true, migratedCount },
      { headers: { 'Cache-Control': 'no-store, private' } },
    )
  } catch (error) {
    console.error('Erreur de création de l’onglet des téléphones éducateurs:', error)
    return NextResponse.json(
      { error: 'Impossible de créer l’onglet ou de copier les téléphones. Vérifiez les droits Google Sheets.' },
      { status: 500 },
    )
  }
}
