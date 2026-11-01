import { NextResponse } from 'next/server'
import {
  getEducatorSession,
  hashEducatorPassword,
  isSameOriginRequest,
} from '@/lib/educator-auth'
import { getEducatorAccounts, saveEducatorAccounts } from '@/lib/educator-account-store'

export const runtime = 'nodejs'

type AccountRole = 'educator' | 'admin'

function response(body: object, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, private', Vary: 'Cookie' },
  })
}

async function requireAdmin(request: Request) {
  const educator = await getEducatorSession(request)
  if (!educator) return { response: response({ error: 'Connexion requise.' }, 401) }
  if (educator.role !== 'admin') return { response: response({ error: 'Droits administrateur requis.' }, 403) }
  return { educator }
}

function validRole(role: unknown): role is AccountRole {
  return role === 'educator' || role === 'admin'
}

function publicAccounts(accounts: Awaited<ReturnType<typeof getEducatorAccounts>>) {
  return accounts.map(({ username, displayName, role }) => ({ username, displayName, role }))
}

export async function GET(request: Request) {
  try {
    const access = await requireAdmin(request)
    if ('response' in access) return access.response
    return response({ accounts: publicAccounts(await getEducatorAccounts()) })
  } catch (error) {
    console.error('Erreur de lecture des comptes éducateurs:', error)
    return response({ error: 'Impossible de charger les comptes éducateurs.' }, 503)
  }
}

async function authorizeMutation(request: Request) {
  if (process.env.VERCEL_ENV !== 'production') {
    return response({ error: 'La gestion des comptes est désactivée dans cet aperçu.' }, 403)
  }
  if (!isSameOriginRequest(request)) return response({ error: 'Requête non autorisée.' }, 403)
  try {
    const access = await requireAdmin(request)
    return 'response' in access ? access.response : null
  } catch (error) {
    console.error('Erreur de vérification des droits administrateur:', error)
    return response({ error: 'La gestion des comptes éducateurs n’est pas disponible.' }, 503)
  }
}

async function readInput(request: Request) {
  try {
    const body = await request.text()
    if (Buffer.byteLength(body, 'utf8') > 4096) {
      return { error: response({ error: 'Requête trop volumineuse.' }, 413) }
    }
    const input: unknown = JSON.parse(body)
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { error: response({ error: 'Données de compte invalides.' }, 400) }
    }
    return { input: input as Record<string, unknown> }
  } catch {
    return { error: response({ error: 'Données de compte invalides.' }, 400) }
  }
}

export async function POST(request: Request) {
  const authorizationError = await authorizeMutation(request)
  if (authorizationError) return authorizationError
  const parsed = await readInput(request)
  if (parsed.error) return parsed.error

  const { username, displayName, password, role = 'educator' } = parsed.input
  if (
    typeof username !== 'string' ||
    !/^[\p{L}\p{N}._@+-]{1,120}$/u.test(username.trim()) ||
    typeof displayName !== 'string' ||
    displayName.trim().length < 2 ||
    displayName.trim().length > 80 ||
    typeof password !== 'string' ||
    password.length < 12 ||
    password.length > 256 ||
    !validRole(role)
  ) {
    return response({ error: 'Vérifiez l’identifiant, le nom, le rôle et le mot de passe (12 à 256 caractères).' }, 400)
  }

  try {
    const accounts = await getEducatorAccounts()
    const normalizedUsername = username.trim().toLocaleLowerCase('fr-FR')
    if (accounts.some((account) => account.username.toLocaleLowerCase('fr-FR') === normalizedUsername)) {
      return response({ error: 'Cet identifiant existe déjà.' }, 409)
    }
    const account = {
      username: username.trim(),
      displayName: displayName.trim(),
      passwordHash: hashEducatorPassword(password),
      role,
    }
    await saveEducatorAccounts([...accounts, account])
    return response({ ok: true, account: { username: account.username, displayName: account.displayName, role: account.role } }, 201)
  } catch (error) {
    console.error('Erreur de création d’un compte éducateur:', error)
    return response({ error: 'Impossible de créer ce compte éducateur.' }, 500)
  }
}

export async function PATCH(request: Request) {
  const authorizationError = await authorizeMutation(request)
  if (authorizationError) return authorizationError
  const parsed = await readInput(request)
  if (parsed.error) return parsed.error

  const { username, role, password } = parsed.input
  if (
    typeof username !== 'string' ||
    username.trim().length === 0 ||
    (role !== undefined && !validRole(role)) ||
    (password !== undefined && (typeof password !== 'string' || password.length < 12 || password.length > 256)) ||
    (role === undefined && password === undefined)
  ) {
    return response({ error: 'Modification du compte invalide.' }, 400)
  }

  try {
    const access = await requireAdmin(request)
    if ('response' in access) return access.response
    const accounts = await getEducatorAccounts()
    const targetIndex = accounts.findIndex(
      (account) => account.username.toLocaleLowerCase('fr-FR') === username.trim().toLocaleLowerCase('fr-FR'),
    )
    if (targetIndex < 0) return response({ error: 'Ce compte éducateur n’existe plus.' }, 404)

    const target = accounts[targetIndex]
    if (
      role === 'educator' &&
      target.role === 'admin' &&
      accounts.filter((account) => account.role === 'admin').length <= 1
    ) {
      return response({ error: 'Impossible de retirer le dernier administrateur.' }, 409)
    }
    if (target.username.toLocaleLowerCase('fr-FR') === access.educator.username.toLocaleLowerCase('fr-FR') && role === 'educator') {
      return response({ error: 'Vous ne pouvez pas retirer vos propres droits administrateur.' }, 409)
    }

    const updated = {
      ...target,
      ...(role === undefined ? {} : { role }),
      ...(password === undefined ? {} : { passwordHash: hashEducatorPassword(password) }),
    }
    const nextAccounts = [...accounts]
    nextAccounts[targetIndex] = updated
    await saveEducatorAccounts(nextAccounts)
    return response({ ok: true, account: { username: updated.username, displayName: updated.displayName, role: updated.role } })
  } catch (error) {
    console.error('Erreur de modification d’un compte éducateur:', error)
    return response({ error: 'Impossible de modifier ce compte éducateur.' }, 500)
  }
}

export async function DELETE(request: Request) {
  const authorizationError = await authorizeMutation(request)
  if (authorizationError) return authorizationError
  const parsed = await readInput(request)
  if (parsed.error) return parsed.error

  const username = parsed.input.username
  if (typeof username !== 'string' || !username.trim()) {
    return response({ error: 'Identifiant de compte invalide.' }, 400)
  }

  try {
    const access = await requireAdmin(request)
    if ('response' in access) return access.response
    if (username.trim().toLocaleLowerCase('fr-FR') === access.educator.username.toLocaleLowerCase('fr-FR')) {
      return response({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, 409)
    }
    const accounts = await getEducatorAccounts()
    const target = accounts.find((account) => account.username.toLocaleLowerCase('fr-FR') === username.trim().toLocaleLowerCase('fr-FR'))
    if (!target) return response({ error: 'Ce compte éducateur n’existe plus.' }, 404)
    if (target.role === 'admin' && accounts.filter((account) => account.role === 'admin').length <= 1) {
      return response({ error: 'Impossible de supprimer le dernier administrateur.' }, 409)
    }
    await saveEducatorAccounts(accounts.filter((account) => account !== target))
    return response({ ok: true })
  } catch (error) {
    console.error('Erreur de suppression d’un compte éducateur:', error)
    return response({ error: 'Impossible de supprimer ce compte éducateur.' }, 500)
  }
}
