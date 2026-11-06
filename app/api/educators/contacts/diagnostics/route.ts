import { NextResponse } from 'next/server'
import { getEducatorSession } from '@/lib/educator-auth'
import { diagnoseEducatorPhoneEncryption } from '@/lib/educator-phones'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return NextResponse.json({ error: 'La connexion éducateur n’est pas disponible.' }, { status: 503 })
  }
  if (!educator) return NextResponse.json({ error: 'Connexion requise.' }, { status: 401 })
  if (educator.role !== 'admin') return NextResponse.json({ error: 'Droits insuffisants.' }, { status: 403 })

  try {
    const diagnostics = await diagnoseEducatorPhoneEncryption()
    return NextResponse.json(diagnostics, {
      headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
    })
  } catch (error) {
    console.error('Erreur de diagnostic du chiffrement des téléphones:', error)
    return NextResponse.json(
      { error: 'Impossible de vérifier le chiffrement des téléphones. Vérifiez l’accès au classeur.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }
}
