export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const error = url.searchParams.get('error')

  if (error) {
    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Erreur Google OAuth</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;background:#fef2f2;color:#991b1b;">
  <h2>⚠️ Erreur d'autorisation Google</h2>
  <p>${error}</p>
  <a href="/" style="color:#b91c1c;">Retour à l'accueil</a>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 }
    )
  }

  if (!code) {
    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Code manquant</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;background:#fef2f2;color:#991b1b;">
  <h2>⚠️ Aucun code d'autorisation reçu</h2>
  <a href="/" style="color:#b91c1c;">Retour à l'accueil</a>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 }
    )
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const forwardedHost = request.headers.get('x-forwarded-host')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const origin = forwardedHost ? `${proto}://${forwardedHost}` : url.origin
  const redirectUri = `${origin}/api/auth/google/callback`

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId!,
        client_secret: clientSecret!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json()

    if (!tokenRes.ok) {
      return new Response(
        `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Échec OAuth</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;background:#fef2f2;color:#991b1b;">
  <h2>⚠️ Échec de l'échange de token</h2>
  <pre style="background:#fff;padding:16px;border-radius:8px;">${JSON.stringify(tokenData, null, 2)}</pre>
  <p>Vérifiez que GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont corrects.</p>
</body>
</html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 }
      )
    }

    const refreshToken = tokenData.refresh_token as string | undefined

    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Autorisation Google réussie - ES Genech</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #ecfeff 100%);
      color: #0f172a;
      min-height: 100vh;
      margin: 0;
      padding: 40px 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: #ffffff;
      border-radius: 20px;
      padding: 36px;
      max-width: 680px;
      width: 100%;
      box-shadow: 0 10px 30px -5px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
    }
    h1 {
      color: #047857;
      font-size: 22px;
      margin-top: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    p {
      color: #334155;
      font-size: 15px;
      line-height: 1.6;
    }
    .token-box {
      background: #f8fafc;
      border: 1.5px dashed #059669;
      border-radius: 12px;
      padding: 16px;
      font-family: ui-monospace, Menlo, Monaco, monospace;
      font-size: 13px;
      word-break: break-all;
      margin: 18px 0;
      color: #0f766e;
      user-select: all;
    }
    .btn {
      background: #059669;
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #047857;
    }
    .instruction {
      background: #f0fdf4;
      border-left: 4px solid #10b981;
      padding: 16px;
      border-radius: 0 12px 12px 0;
      margin-top: 24px;
      font-size: 14px;
      line-height: 1.6;
    }
    code {
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>🎉 Autorisation Google Réussie !</h1>
    <p>
      Votre application a bien été autorisée à lire votre Google Sheet. Voici votre <strong>GOOGLE_REFRESH_TOKEN</strong> :
    </p>

    <div class="token-box" id="tokenBox">${refreshToken || '(Aucun nouveau refresh_token retourné car votre compte avait déjà autorisé l\'application)'}</div>

    ${
      refreshToken
        ? `<button class="btn" onclick="navigator.clipboard.writeText('${refreshToken}'); this.innerText='✅ Copié dans le presse-papier !'">Copier le GOOGLE_REFRESH_TOKEN</button>`
        : `<p style="color: #b45309; font-size: 13px;">💡 Note : Si aucun token n'apparaît, révoquez l'accès à l'application dans votre compte Google (myaccount.google.com/connections) puis recommencez.</p>`
    }

    <div class="instruction">
      <strong>👉 Deux dernières étapes :</strong>
      <ol style="margin: 8px 0 0 18px; padding: 0;">
        <li style="margin-bottom: 6px;">Sur <strong>Vercel</strong> (Settings &gt; Environment Variables) : ajoutez la variable <code>GOOGLE_REFRESH_TOKEN</code> avec cette valeur.</li>
        <li>Sur votre ordinateur : ajoutez également <code>GOOGLE_REFRESH_TOKEN=...</code> dans votre fichier <code>.env.local</code>.</li>
      </ol>
    </div>

    <div style="margin-top: 24px; text-align: center;">
      <a href="/" style="color: #059669; font-weight: 600; text-decoration: none; font-size: 14px;">← Retour à l'application ES Genech</a>
    </div>
  </div>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  } catch (err: any) {
    return new Response(
      `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Erreur serveur</title></head>
<body style="font-family:system-ui,sans-serif;padding:40px;background:#fef2f2;color:#991b1b;">
  <h2>⚠️ Erreur serveur</h2>
  <p>${err?.message}</p>
</body>
</html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 }
    )
  }
}

