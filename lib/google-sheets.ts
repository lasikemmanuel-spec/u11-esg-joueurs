import crypto from 'node:crypto'
import { parseCsv } from '@/lib/csv'

export const SHEET_ID =
  process.env.GOOGLE_SHEET_ID || '1zDC6a-hTSKFV2E5JHvj382q6eW9-xURii-5r5O_L4n4'

let cachedAccessToken: { token: string; expiresAt: number } | null = null

/**
 * Nettoie et formate la clé privée PEM :
 * - Retire les guillemets superflus au début et à la fin (", ')
 * - Remplace les séquences littérales \n par de véritables sauts de ligne
 * - Supprime les retours chariot Windows (\r)
 */
function formatPrivateKey(key: string): string {
  let cleaned = key.trim()
  while (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim()
  }
  return cleaned.replace(/\\n/g, '\n').replace(/\r/g, '').trim()
}

/**
 * Crée un token JWT signé RS256 pour l'authentification avec un Compte de Service Google.
 */
function getServiceAccountJwt(clientEmail: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
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

  const cleanKey = formatPrivateKey(privateKey)
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
 * 2. Sans token, essaie l'export CSV public. Une erreur API authentifiée est remontée telle quelle.
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
        if (!metaRes.ok) {
          throw new Error(`Google Sheets a refusé l’accès au classeur (${metaRes.status}).`)
        }
        const meta = (await metaRes.json()) as {
          sheets?: Array<{ properties?: { title?: string } }>
        }
        const firstTitle = meta.sheets?.[0]?.properties?.title
        if (firstTitle) {
          range = `'${firstTitle.replace(/'/g, "''")}'`
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
        throw new Error(`Google Sheets a refusé la lecture de ${tabName ? `l’onglet « ${tabName} »` : 'la feuille'} (${res.status}).`)
      }
    } catch (err) {
      if (err instanceof Error) throw err
      throw new Error(`Impossible de lire ${tabName ? `l’onglet « ${tabName} »` : 'le Google Sheet'} via l’API Google Sheets.`)
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
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `Google Sheets refuse l’accès à ${tabName ? `l’onglet « ${tabName} »` : 'la feuille'} (${res.status}). Vérifiez que GOOGLE_SERVICE_ACCOUNT_EMAIL et GOOGLE_PRIVATE_KEY sont configurés dans l’environnement de déploiement et que le classeur est partagé avec ce compte de service.`,
      )
    }
    throw new Error(
      `Impossible de lire ${tabName ? `l'onglet "${tabName}"` : 'le Google Sheet'} (${res.status})`
    )
  }

  const text = await res.text()
  return parseCsv(text)
}

export async function getAuthenticatedSheetRows(tabName?: string) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) throw new Error('Authentification Google indisponible pour les coordonnées éducateurs.')

  const metadataResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  if (!metadataResponse.ok) {
    throw new Error(`Impossible de lire les onglets Google Sheets (${metadataResponse.status}).`)
  }

  const metadata = (await metadataResponse.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>
  }
  const normalizeTitle = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr-FR')
  const sheetTitle = tabName
    ? metadata.sheets?.find((sheet) =>
        normalizeTitle(sheet.properties?.title ?? '').includes(normalizeTitle(tabName)),
      )?.properties?.title
    : metadata.sheets?.[0]?.properties?.title
  if (!sheetTitle) throw new Error('Aucun onglet Google Sheets trouvé.')

  const range = `'${sheetTitle.replace(/'/g, "''")}'`
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  if (!response.ok) {
    throw new Error(`Impossible de lire l’onglet protégé (${response.status}).`)
  }

  const data = (await response.json()) as { values?: unknown[][] }
  const rows = data.values ?? []
  const maxColumns = Math.max(...rows.map((row) => row.length), 40)
  return {
    sheetTitle,
    rows: rows.map((row) => {
      const cells = row.map((cell) => cell === null || cell === undefined ? '' : String(cell))
      while (cells.length < maxColumns) cells.push('')
      return cells
    }),
  }
}

export async function ensureAuthenticatedSheetTab(title: string) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) throw new Error('Authentification Google indisponible pour créer l’onglet protégé.')

  const metadataResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    },
  )
  if (!metadataResponse.ok) {
    throw new Error(`Impossible de vérifier les onglets Google Sheets (${metadataResponse.status}).`)
  }

  const metadata = (await metadataResponse.json()) as {
    sheets?: Array<{ properties?: { title?: string } }>
  }
  if (metadata.sheets?.some((sheet) => sheet.properties?.title === title)) return

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
      cache: 'no-store',
    },
  )
  if (!response.ok) {
    throw new Error(`Impossible de créer l’onglet protégé (${response.status}).`)
  }
}

export async function updateAuthenticatedSheetValues(
  updates: Array<{ range: string; values: string[][] }>,
) {
  const accessToken = await getGoogleAccessToken()
  if (!accessToken) throw new Error('Authentification Google indisponible pour modifier les coordonnées.')

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values:batchUpdate?valueInputOption=RAW`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
      cache: 'no-store',
    },
  )
  if (!response.ok) {
    throw new Error(`Impossible de mettre à jour l’onglet protégé (${response.status}).`)
  }
}
