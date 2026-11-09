'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Check, ChevronDown, Copy, Eye, EyeOff, KeyRound, Mail, Pencil, RefreshCw, Shield, Trash2, UserRound, X } from 'lucide-react'
import { EducatorAvatar } from '@/components/educator-avatar'

type AccountRole = 'educator' | 'admin' | 'reader'

type Account = {
  username: string
  displayName: string
  firstName: string
  lastName: string
  role: AccountRole
}

type AccountDraft = {
  username: string
  firstName: string
  lastName: string
  password: string
  role: AccountRole
}

const emptyDraft: AccountDraft = { username: '', firstName: '', lastName: '', password: '', role: 'educator' }
const passwordCharacters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_'

function generateSecurePassword() {
  const passwordLength = 20
  const maxValidByte = 256 - (256 % passwordCharacters.length)
  let password = ''
  while (password.length < passwordLength) {
    const bytes = new Uint8Array(passwordLength - password.length)
    window.crypto.getRandomValues(bytes)
    for (const byte of bytes) {
      if (byte < maxValidByte) password += passwordCharacters[byte % passwordCharacters.length]
      if (password.length === passwordLength) break
    }
  }
  return password
}

export function EducatorAccountManagement({
  currentUsername,
  photoRevision = 0,
  addRequest = 0,
  onAddRequestHandled,
}: {
  currentUsername: string
  photoRevision?: number
  addRequest?: number
  onAddRequestHandled?: () => void
}) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [draft, setDraft] = useState<AccountDraft>(emptyDraft)
  const [passwordDraft, setPasswordDraft] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<Account | null>(null)
  const [editTarget, setEditTarget] = useState<Account | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [pendingUsername, setPendingUsername] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [passwordCopied, setPasswordCopied] = useState(false)
  const currentPassword = createOpen ? draft.password : passwordDraft

  const load = useCallback(async () => {
    const response = await fetch('/api/educators/accounts', { cache: 'no-store' })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error ?? 'Impossible de charger les comptes.')
    setAccounts(result.accounts as Account[])
  }, [])

  useEffect(() => {
    void load()
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Impossible de charger les comptes.'))
      .finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    if (addRequest > 0) {
      setError('')
      setDraft(emptyDraft)
      setCreateOpen(true)
      setPasswordVisible(false)
      setPasswordCopied(false)
      onAddRequestHandled?.()
    }
  }, [addRequest, onAddRequestHandled])

  const generatePassword = () => {
    try {
      const generatedPassword = generateSecurePassword()
      if (createOpen) setDraft((current) => ({ ...current, password: generatedPassword }))
      else setPasswordDraft(generatedPassword)
      setPasswordVisible(true)
      setPasswordCopied(false)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error
        ? `Impossible de générer un mot de passe sécurisé : ${cause.message}`
        : 'Impossible de générer un mot de passe sécurisé.')
    }
  }

  const closeModal = () => {
    setCreateOpen(false)
    setPasswordTarget(null)
    setEditTarget(null)
    setPasswordDraft('')
    setDraft((current) => ({ ...current, password: '' }))
    setPasswordVisible(false)
    setPasswordCopied(false)
    setError('')
    onAddRequestHandled?.()
  }

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(currentPassword)
      setPasswordCopied(true)
    } catch (cause) {
      setError(cause instanceof Error
        ? `Impossible de copier le mot de passe : ${cause.message}`
        : 'Impossible de copier le mot de passe.')
    }
  }

  const retryLoad = async () => {
    setLoading(true)
    setError('')
    try {
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les comptes.')
    } finally {
      setLoading(false)
    }
  }

  const saveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPendingUsername('new')
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de créer le compte.')
      await load()
      setCreateOpen(false)
      setDraft(emptyDraft)
      setNotice('Compte utilisateur créé.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de créer le compte.')
    } finally {
      setPendingUsername(null)
    }
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editTarget) return
    setPendingUsername(editTarget.username)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: editTarget.username,
          email: draft.username,
          firstName: draft.firstName,
          lastName: draft.lastName,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de modifier les informations du compte.')
      if (editTarget.username.toLocaleLowerCase('fr-FR') === currentUsername.toLocaleLowerCase('fr-FR')) {
        window.location.reload()
        return
      }
      await load()
      setEditTarget(null)
      setNotice(`Informations mises à jour pour ${draft.firstName} ${draft.lastName}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de modifier les informations du compte.')
    } finally {
      setPendingUsername(null)
    }
  }

  const updateRole = async (account: Account, role: AccountRole) => {
    setPendingUsername(account.username)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: account.username,
          role,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de modifier les droits.')
      await load()
      setNotice(`Droits mis à jour pour ${account.displayName}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de modifier les droits.')
    } finally {
      setPendingUsername(null)
    }
  }

  const resetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!passwordTarget) return
    setPendingUsername(passwordTarget.username)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: passwordTarget.username, password: passwordDraft }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de modifier le mot de passe.')
      setPasswordTarget(null)
      setPasswordDraft('')
      setNotice(`Mot de passe modifié pour ${passwordTarget.displayName}.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de modifier le mot de passe.')
    } finally {
      setPendingUsername(null)
    }
  }

  const deleteAccount = async (account: Account) => {
    if (!window.confirm(`Supprimer le compte éducateur de ${account.displayName} (${account.username}) ?`)) return
    setPendingUsername(account.username)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/accounts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: account.username }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de supprimer le compte.')
      await load()
      setNotice(`Compte de ${account.displayName} supprimé.`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de supprimer le compte.')
    } finally {
      setPendingUsername(null)
    }
  }

  return (
    <section aria-labelledby="educator-accounts-title" className="rounded-2xl border border-accent/50 bg-card p-2.5 shadow-sm sm:p-4">
      <header className="flex flex-wrap items-center justify-end gap-2 sm:justify-between sm:gap-3">
        <div className="hidden sm:block">
          <h2 id="educator-accounts-title" className="text-base font-bold text-primary sm:text-lg">Comptes (Admin/Éducateur/Lecteur)</h2>
          <p className="mt-1 text-xs text-muted-foreground">Gérer les accès, les mots de passe et les rôles administrateur, éducateur ou lecteur.</p>
        </div>
      </header>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement des comptes…</p>
      ) : error && accounts.length === 0 ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/25 bg-destructive/5 p-3">
          <p className="text-sm text-muted-foreground">Les comptes n’ont pas pu être chargés.</p>
          <button
            type="button"
            onClick={() => void retryLoad()}
            className="min-h-9 rounded-lg border border-accent/50 px-3 text-sm font-semibold text-primary"
          >
            Réessayer
          </button>
        </div>
      ) : accounts.length === 0 ? (
        <p className="mt-4 rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">Aucun compte utilisateur.</p>
      ) : (
        <ul className="mt-3 grid items-start gap-2 sm:mt-4 sm:grid-cols-2">
          {accounts.map((account) => {
            const isSelf = account.username.toLocaleLowerCase('fr-FR') === currentUsername.toLocaleLowerCase('fr-FR')
            const initials = account.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('fr-FR')
            return (
              <li key={account.username} className="overflow-hidden rounded-2xl border-2 border-[#172554]/15 bg-background shadow-sm transition hover:border-[#172554]/35">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 bg-gradient-to-r from-[#172554] to-[#1e3a8a] px-3 py-3 text-white outline-none transition hover:from-[#1e3a8a] hover:to-[#274493] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 sm:px-4">
                    <EducatorAvatar
                      username={account.username}
                      revision={photoRevision}
                      size="size-10 ring-2 ring-amber-400"
                      fallback={
                        <span className="absolute inset-0 flex items-center justify-center bg-[#172554] text-sm font-black text-amber-300">
                          {initials || <UserRound aria-hidden="true" className="size-5" />}
                        </span>
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-black sm:text-base">{account.displayName}{isSelf ? ' (vous)' : ''}</h3>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-1.5 py-1 text-[10px] font-bold text-amber-200 ring-1 ring-amber-300/50 sm:px-2 sm:text-[11px]">
                      {account.role === 'admin' ? <Shield aria-hidden="true" className="size-3" /> : <UserRound aria-hidden="true" className="size-3" />}
                      {account.role === 'admin' ? 'Admin' : account.role === 'reader' ? 'Lecteur' : 'Éducateur'}
                    </span>
                    <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-amber-300 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="grid gap-3 border-t border-amber-400/40 bg-gradient-to-br from-[#eef2ff] via-[#f8faff] to-[#fffaf0] p-3 dark:from-[#1c294b] dark:via-[#202b4b] dark:to-[#302b40] sm:gap-4 sm:p-4">
                    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-[#1e3a8a]/10 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-amber-300 shadow-sm">
                        <Mail aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Adresse e-mail</p>
                        <p className="break-all text-sm font-semibold text-foreground">{account.username}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            username: account.username,
                            firstName: account.firstName,
                            lastName: account.lastName,
                            password: '',
                            role: account.role,
                          })
                          setEditTarget(account)
                          setError('')
                        }}
                        disabled={pendingUsername !== null}
                        className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-[#1e3a8a]/15 bg-white/85 px-2 text-xs font-bold text-[#172554] shadow-sm transition hover:border-[#1e3a8a]/40 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e3a8a] disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-blue-100 dark:hover:bg-white/10"
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                        Identité
                      </button>
                      <label className="grid min-w-0 content-center gap-1 rounded-xl border border-[#1e3a8a]/15 bg-white/85 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/5">
                        <span>Rôle du compte</span>
                        <select
                          value={account.role}
                          onChange={(event) => void updateRole(account, event.target.value as AccountRole)}
                          disabled={pendingUsername !== null || (isSelf && account.role === 'admin')}
                          aria-label={`Rôle de ${account.displayName}`}
                          className="h-8 w-full min-w-0 rounded-lg border border-accent/40 bg-background px-2 text-xs font-bold normal-case tracking-normal text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                        >
                          <option value="admin">Administrateur</option>
                          <option value="educator">Éducateur</option>
                          <option value="reader">Lecteur</option>
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setPasswordDraft('')
                          setPasswordTarget(account)
                          setPasswordVisible(false)
                          setPasswordCopied(false)
                          setError('')
                        }}
                        disabled={pendingUsername !== null}
                        className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-50/80 px-2 text-xs font-bold text-[#172554] shadow-sm transition hover:border-amber-500/60 hover:bg-amber-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 dark:bg-amber-400/10 dark:text-amber-100 dark:hover:bg-amber-400/20"
                      >
                        <KeyRound aria-hidden="true" className="size-3.5" />
                        Mot de passe
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAccount(account)}
                        disabled={pendingUsername !== null || isSelf}
                        className="inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-xl border border-rose-300/70 bg-rose-50/80 px-2 text-xs font-bold text-rose-700 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-200 dark:hover:bg-rose-400/20"
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        Supprimer
                      </button>
                    </div>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}

      {(createOpen || passwordTarget || editTarget) && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-[#172554]/60 p-4">
          <form
            onSubmit={createOpen ? saveAccount : editTarget ? saveProfile : resetPassword}
            className="w-full max-w-md rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administration</p>
                <h3 className="mt-1 text-lg font-black text-primary">
                  {createOpen
                    ? 'Créer un compte utilisateur'
                    : editTarget
                      ? `Modifier le compte de ${editTarget.displayName}`
                      : `Modifier le mot de passe de ${passwordTarget?.displayName}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Fermer"
                className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </header>
            {createOpen && (
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Adresse e-mail / identifiant<input required type="email" maxLength={120} autoComplete="username" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Prénom<input required maxLength={80} autoComplete="given-name" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Nom<input required maxLength={80} autoComplete="family-name" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Rôle
                  <select value={draft.role} onChange={(event) => setDraft({ ...draft, role: event.target.value as AccountRole })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal">
                    <option value="admin">Administrateur</option>
                    <option value="educator">Éducateur</option>
                    <option value="reader">Lecteur</option>
                  </select>
                </label>
              </div>
            )}
            {editTarget && (
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-semibold">Adresse e-mail / identifiant<input required type="email" maxLength={120} autoComplete="email" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Prénom<input required maxLength={80} autoComplete="given-name" value={draft.firstName} onChange={(event) => setDraft({ ...draft, firstName: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
                <label className="grid gap-1 text-sm font-semibold">Nom<input required maxLength={80} autoComplete="family-name" value={draft.lastName} onChange={(event) => setDraft({ ...draft, lastName: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
              </div>
            )}
            {!editTarget && (createOpen || passwordTarget) && (
              <div className="mt-4 grid gap-2">
                <label htmlFor="account-password" className="text-sm font-semibold">
                  {createOpen ? 'Mot de passe initial' : 'Nouveau mot de passe'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="account-password"
                    required
                    minLength={12}
                    maxLength={256}
                    type={passwordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={currentPassword}
                    onChange={(event) => {
                      if (createOpen) setDraft({ ...draft, password: event.target.value })
                      else setPasswordDraft(event.target.value)
                      setPasswordCopied(false)
                    }}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-accent/50 bg-background px-3 font-normal"
                  />
                  <button
                    type="button"
                    onClick={() => { setPasswordVisible((visible) => !visible); setPasswordCopied(false) }}
                    aria-label={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    title={passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-accent/50 text-primary"
                  >
                    {passwordVisible
                      ? <EyeOff aria-hidden="true" className="size-4" />
                      : <Eye aria-hidden="true" className="size-4" />}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent/50 px-3 text-xs font-semibold text-primary"
                  >
                    <RefreshCw aria-hidden="true" className="size-3.5" />
                    Générer un mot de passe
                  </button>
                  {currentPassword && (
                    <button
                      type="button"
                      onClick={() => void copyPassword()}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent/50 px-3 text-xs font-semibold text-primary"
                    >
                      {passwordCopied
                        ? <Check aria-hidden="true" className="size-3.5" />
                        : <Copy aria-hidden="true" className="size-3.5" />}
                      {passwordCopied ? 'Copié' : 'Copier'}
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">12 caractères minimum. Vous pouvez l’afficher et le copier pour le transmettre à l’éducateur.</p>
              </div>
            )}
            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeModal} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-muted-foreground">Annuler</button>
              <button type="submit" disabled={pendingUsername !== null} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50">
                {pendingUsername !== null ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
