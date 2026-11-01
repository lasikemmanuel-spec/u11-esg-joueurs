import { NextResponse } from 'next/server'
import { getEducatorSession } from '@/lib/educator-auth'
import { getRoster } from '@/lib/players'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  let educator
  try {
    educator = await getEducatorSession(request)
  } catch (error) {
    console.error('Erreur de vérification de session éducateur:', error)
    return NextResponse.json(
      { error: 'La connexion éducateur n’est pas disponible.' },
      { status: 503, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }
  if (!educator) {
    return NextResponse.json(
      { error: 'Connexion éducateur requise.' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }

  try {
    const roster = await getRoster()
    return NextResponse.json(
      {
        players: roster.players.map(
          ({ number, lastName, firstName, position, transferStatus, licenseNumber }) => ({
            number,
            lastName,
            firstName,
            position,
            transferStatus,
            licenseNumber,
          }),
        ),
      },
      { headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  } catch (error) {
    console.error('Erreur de lecture des données privées des joueurs:', error)
    return NextResponse.json(
      { error: 'Impossible de charger les données des joueurs.' },
      { status: 500, headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' } },
    )
  }
}
