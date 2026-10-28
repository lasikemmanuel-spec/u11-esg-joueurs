import crypto from 'node:crypto'
import { parseCsv } from '@/lib/players'

export const SHEET_ID =
  process.env.GOOGLE_SHEET_ID || '1zDC6a-hTSKFV2E5JHvj382q6eW9-xURii-5r5O_L4n4'

let cachedAccessToken: { token: string; expiresAt: number } | null = null

/**
 * Crée un token JWT signé RS256 pour l'authentification avec un Compte de Service Google.
 */
function getServiceAccountJwt(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const base64Url = (input: string) =>
    Buffer.from(input)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`

  const cleanKey = privateKey.replace(/\\n/g, '\n')
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(unsignedToken)
  const signature = sign
    .sign(cleanKey, 'base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${unsignedToken}.${signature}`
}

/**
 * Récupère un token d'accès Google valide :
 * 1. D'abord via Compte de Service (GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY) - N'expire jamais !
 * 2. Sinon via OAuth2 classique (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).
 * Le token est mis en cache mémoire jusqu'à son expiration (~1h).
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const serviceAccountPrivateKey = process.env.GOOGLE_PRIVATE_KEY

  // Utilise le token en cache s'il est encore valide (avec 60s de marge de sécurité)
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token
  }

  // 1. Authentification par Compte de Service (Recommandé)
  if (serviceAccountEmail && serviceAccountPrivateKey) {
    try {
      const assertion = getServiceAccountJwt(serviceAccountEmail, serviceAccountPrivateKey)
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`Erreur token Compte de Service (${res.status}):`, errText)
        return null
      }

      const data = (await res.json()) as { access_token: string; expires_in: number }
      cachedAccessToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      }

      return cachedAccessToken.token
    } catch (err) {
      console.error('Erreur authentification Compte de Service Google:', err)
      return null
    }
  }

  // 2. Authentification par OAuth2 classique (Client ID + Secret + Refresh Token)
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (clientId && clientSecret && refreshToken) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        cache: 'no-store',
      })

      if (!res.ok) {
        const errText = await res.text()
        console.error(`Erreur renouvellement token Google OAuth (${res.status}):`, errText)
        return null
      }

      const data = (await res.json()) as { access_token: string; expires_in: number }
      cachedAccessToken = {
        token: data.access_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      }

      return cachedAccessToken.token
    } catch (err) {
      console.error('Erreur lors de la récupération du token Google OAuth:', err)
      return null
    }
  }

  return null
}

/**
 * Récupère les lignes d'un onglet de la feuille Google Sheet sous forme de tableau 2D (string[][]).
 * 1. Tente d'utiliser l'API officielle Google Sheets v4 avec le token d'accès authentifié.
 * 2. Si aucun token n'est disponible ou en cas d'erreur, bascule sur l'export public CSV.
 */
export async function getSheetRows(tabName?: string): Promise<string[][]> {
  const accessToken = await getGoogleAccessToken()

  // 1. Appel API Google Sheets v4 authentifié si un token d'accès est disponible
  if (accessToken) {
    try {
      let range = tabName ? `'${tabName.replace(/'/g, "''")}'` : ''

      // Si aucun onglet n'est spécifié (cas du roster), on recherche le premier onglet
      if (!range) {
        const metaRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            next: { revalidate: 300, tags: ['google-sheet'] },
          }
        )
        if (metaRes.ok) {
          const meta = (await metaRes.json()) as {
            sheets?: Array<{ properties?: { title?: string } }>
          }
          const firstTitle = meta.sheets?.[0]?.properties?.title
          if (firstTitle) {
            range = `'${firstTitle.replace(/'/g, "''")}'`
          }
        }
      }

      if (!range) {
        range = 'A1:Z500'
      }

      const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(
        range
      )}?valueRenderOption=FORMATTED_VALUE`

      const res = await fetch(apiUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        next: { revalidate: 300, tags: ['google-sheet'] },
      })

      if (res.ok) {
        const data = (await res.json()) as { values?: unknown[][] }
        if (data.values && Array.isArray(data.values)) {
          const maxCols = Math.max(
            ...data.values.map((r) => (Array.isArray(r) ? r.length : 0)),
            40
          )
          return data.values.map((row) => {
            const cells = (Array.isArray(row) ? row : []).map((c) =>
              c !== null && c !== undefined ? String(c) : ''
            )
            while (cells.length < maxCols) cells.push('')
            return cells
          })
        }
      } else {
        const errText = await res.text()
        console.warn(`Google Sheets API a retourné ${res.status}: ${errText}. Bascule sur la méthode CSV...`)
      }
    } catch (err) {
      console.warn('Erreur lors de l appel Google Sheets API, bascule sur la méthode CSV:', err)
    }
  }

  // 2. Méthode CSV de secours (fonctionne si la feuille est publique ou avec Bearer token)
  const fallbackUrl = tabName
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
        tabName
      )}`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`

  const headers: HeadersInit = {}
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`
  }

  const res = await fetch(fallbackUrl, {
    headers,
    next: { revalidate: 300, tags: ['google-sheet'] },
  })

  if (!res.ok) {
    throw new Error(
      `Impossible de lire ${tabName ? `l'onglet "${tabName}"` : 'le Google Sheet'} (${res.status})`
    )
  }

  const text = await res.text()
  return parseCsv(text)
}
