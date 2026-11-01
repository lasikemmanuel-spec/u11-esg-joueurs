import { NextResponse } from 'next/server'
import {
  createGoogleOAuthState,
  getGoogleOAuthRedirectUri,
  GOOGLE_OAUTH_STATE_MAX_AGE,
  googleOAuthStateCookieName,
} from '@/lib/google-oauth-state'

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error:
          'La configuration OAuth Google est incomplète.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  let redirectUri: string
  try {
    redirectUri = getGoogleOAuthRedirectUri(request)
  } catch {
    return NextResponse.json(
      { error: 'Impossible de déterminer l’adresse de retour OAuth Google.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const state = createGoogleOAuthState()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  response.cookies.set(googleOAuthStateCookieName(), state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GOOGLE_OAUTH_STATE_MAX_AGE,
  })
  response.headers.set('Cache-Control', 'no-store')
  return response
}
