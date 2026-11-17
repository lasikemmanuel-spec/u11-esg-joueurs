import { NextResponse } from 'next/server'
import { getEducatorSession } from '@/lib/educator-auth'
import { getModificationEvents } from '@/lib/modification-audit'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  let educator
  try {
    educator = await getEducatorSession(request)
  } catch {
    return NextResponse.json(
      { error: 'La connexion éducateur n’est pas disponible.' },
      { status: 503, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }
  if (!educator) {
    return NextResponse.json(
      { error: 'Connexion requise.' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }
  if (educator.role !== 'admin') {
    return NextResponse.json(
      { error: 'Droits administrateur requis.' },
      { status: 403, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }

  try {
    const events = await getModificationEvents()
    return NextResponse.json(
      { events },
      { headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  } catch (error) {
    console.error('Impossible de charger le journal des modifications:', error)
    return NextResponse.json(
      { error: 'Impossible de charger le journal des modifications.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }
}
