import { getEducatorSession } from '@/lib/educator-auth'
import {
  getGoogleOAuthRedirectUri,
  googleOAuthStateCookieName,
  hasValidGoogleOAuthState,
} from '@/lib/google-oauth-state'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function htmlResponse(content: string, status = 200) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  return new Response(content, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, private',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      'Set-Cookie': `${googleOAuthStateCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
    },
  })
}

function errorPage(message: string, status: number) {
  return htmlResponse(
    `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Autorisation Google</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;background:#fef2f2;color:#991b1b;">
  <h2>Autorisation Google impossible</h2>
  <p>${escapeHtml(message)}</p>
  <a href="/" style="color:#b91c1c;">Retour à l'accueil</a>
</body>
</html>`,
    status,
  )
}

export async function GET(request: Request) {
  const educator = await getEducatorSession(request).catch(() => null)
  if (!educator || educator.role !== 'admin') {
    return errorPage('Accès réservé aux administrateurs du club.', 403)
  }

  const url = new URL(request.url)
  if (!hasValidGoogleOAuthState(request, url.searchParams.get('state'))) {
    return errorPage('La requête a expiré ou n’est pas valide. Recommencez l’autorisation.', 400)
  }

  if (url.searchParams.has('error')) {
    return errorPage('Google a refusé ou annulé l’autorisation.', 400)
  }

  const code = url.searchParams.get('code')
  if (!code) return errorPage('Aucun code d’autorisation reçu.', 400)

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return errorPage('La configuration OAuth Google est incomplète.', 503)
  }

  let redirectUri: string
  try {
    redirectUri = getGoogleOAuthRedirectUri(request)
  } catch {
    return errorPage('Impossible de déterminer l’adresse de retour OAuth Google.', 400)
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })

    if (!tokenResponse.ok) {
      console.error(`Échec de l’échange OAuth Google (${tokenResponse.status}).`)
      return errorPage('Google n’a pas pu terminer l’autorisation. Vérifiez la configuration OAuth.', 502)
    }

    const tokenData = await tokenResponse.json() as { refresh_token?: unknown }
    const refreshToken =
      typeof tokenData.refresh_token === 'string' && tokenData.refresh_token.length <= 4096
        ? tokenData.refresh_token
        : null
    const tokenMessage = refreshToken
      ? `<div class="token-box">${escapeHtml(refreshToken)}</div><p>Copiez ce jeton dans la variable secrète <code>GOOGLE_REFRESH_TOKEN</code> sur Vercel et dans votre environnement local.</p>`
      : `<p style="color:#b45309;">Aucun nouveau jeton n’a été retourné. Si nécessaire, révoquez l’accès de l’application Google puis recommencez l’autorisation.</p>`

    return htmlResponse(
      `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Autorisation Google réussie - ES Genech</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f0fdf4; color: #0f172a; min-height: 100vh; margin: 0; padding: 40px 20px; display: grid; place-items: center; }
    .card { background: white; border-radius: 20px; padding: 36px; max-width: 680px; width: 100%; box-sizing: border-box; box-shadow: 0 10px 30px -5px rgba(0,0,0,.08); }
    h1 { color: #047857; font-size: 22px; }
    p { color: #334155; font-size: 15px; line-height: 1.6; }
    .token-box { background: #f8fafc; border: 1.5px dashed #059669; border-radius: 12px; padding: 16px; font-family: ui-monospace, monospace; font-size: 13px; overflow-wrap: anywhere; margin: 18px 0; color: #0f766e; user-select: all; }
    .instruction { background: #f0fdf4; border-left: 4px solid #10b981; padding: 16px; border-radius: 0 12px 12px 0; margin-top: 24px; font-size: 14px; line-height: 1.6; }
    code { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
  </style>
</head>
<body>
  <main class="card">
    <h1>Autorisation Google réussie</h1>
    <p>Votre application a été autorisée à accéder au Google Sheet.</p>
    ${tokenMessage}
    <div class="instruction">
      <strong>Étapes restantes :</strong>
      <ol>
        <li>Ajoutez <code>GOOGLE_REFRESH_TOKEN</code> comme variable secrète sur Vercel.</li>
        <li>Ajoutez la même variable dans votre fichier local <code>.env.local</code>.</li>
      </ol>
    </div>
    <p><a href="/">Retour à l'application ES Genech</a></p>
  </main>
</body>
</html>`,
    )
  } catch (error) {
    console.error('Erreur lors du callback OAuth Google:', error)
    return errorPage('Une erreur serveur est survenue pendant l’autorisation.', 500)
  }
}
