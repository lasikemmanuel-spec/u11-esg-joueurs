'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { KeyRound, Pencil, Plus, Shield, Trash2, UserRound, X } from 'lucide-react'

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

export function EducatorAccountManagement({ currentUsername }: { currentUsername: string }) {
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
      setNotice('Compte éducateur créé.')
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
    <section aria-labelledby="educator-accounts-title" className="rounded-2xl border border-accent/50 bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="educator-accounts-title" className="font-bold text-primary">Comptes éducateurs</h2>
          <p className="mt-1 text-xs text-muted-foreground">Gérer les accès, les mots de passe et les rôles administrateur, éducateur ou lecteur.</p>
        </div>
        <button
          type="button"
          onClick={() => { setError(''); setDraft(emptyDraft); setCreateOpen(true) }}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"
        >
          <Plus aria-hidden="true" className="size-4" />
          Ajouter un compte
        </button>
      </header>

      {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">{notice}</p>}
      {loading ? (
        <p className="mt-4 text-sm text-muted-foreground">Chargement des comptes…</p>
      ) : accounts.length === 0 ? (
        <p className="mt-4 rounded-lg bg-muted p-4 text-center text-sm text-muted-foreground">Aucun compte éducateur.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {accounts.map((account) => {
            const isSelf = account.username.toLocaleLowerCase('fr-FR') === currentUsername.toLocaleLowerCase('fr-FR')
            return (
              <li key={account.username} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-foreground">{account.displayName}{isSelf ? ' (vous)' : ''}</h3>
                    <p className="mt-1 truncate text-sm text-muted-foreground">{account.username}</p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-semibold">
                      {account.role === 'admin' ? <Shield aria-hidden="true" className="size-3.5" /> : <UserRound aria-hidden="true" className="size-3.5" />}
                      {account.role === 'admin' ? 'Administrateur' : account.role === 'reader' ? 'Lecteur' : 'Éducateur'}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
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
                      className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-accent/50 px-2 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      <Pencil aria-hidden="true" className="size-3.5" />
                      Identité
                    </button>
                    <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground">
                      Rôle
                      <select
                        value={account.role}
                        onChange={(event) => void updateRole(account, event.target.value as AccountRole)}
                        disabled={pendingUsername !== null || (isSelf && account.role === 'admin')}
                        aria-label={`Rôle de ${account.displayName}`}
                        className="h-8 rounded-lg border border-accent/50 bg-background px-2 text-xs font-semibold text-primary disabled:opacity-50"
                      >
                        <option value="admin">Administrateur</option>
                        <option value="educator">Éducateur</option>
                        <option value="reader">Lecteur</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setPasswordDraft(''); setPasswordTarget(account); setError('') }}
                      disabled={pendingUsername !== null}
                      className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-accent/50 px-2 text-xs font-semibold text-primary disabled:opacity-50"
                    >
                      <KeyRound aria-hidden="true" className="size-3.5" />
                      Mot de passe
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteAccount(account)}
                      disabled={pendingUsername !== null || isSelf}
                      className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-destructive/40 px-2 text-xs font-semibold text-destructive disabled:opacity-50"
                    >
                      <Trash2 aria-hidden="true" className="size-3.5" />
                      Supprimer
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {(createOpen || passwordTarget || editTarget) && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4">
          <form
            onSubmit={createOpen ? saveAccount : editTarget ? saveProfile : resetPassword}
            className="w-full max-w-md rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Administration</p>
                <h3 className="mt-1 text-lg font-black text-primary">
                  {createOpen
                    ? 'Ajouter un compte éducateur'
                    : editTarget
                      ? `Modifier le compte de ${editTarget.displayName}`
                      : `Modifier le mot de passe de ${passwordTarget?.displayName}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => { setCreateOpen(false); setPasswordTarget(null); setEditTarget(null); setError('') }}
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
            <label className="mt-4 grid gap-1 text-sm font-semibold">
              {createOpen ? 'Mot de passe initial' : 'Nouveau mot de passe'}
              <input
                required
                minLength={12}
                maxLength={256}
                type="password"
                autoComplete="new-password"
                value={createOpen ? draft.password : passwordDraft}
                onChange={(event) => createOpen
                  ? setDraft({ ...draft, password: event.target.value })
                  : setPasswordDraft(event.target.value)}
                className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal"
              />
            </label>
            )}
            {(createOpen || !editTarget) && <p className="mt-2 text-xs text-muted-foreground">12 caractères minimum. Le mot de passe n’est jamais affiché ni enregistré en clair.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => { setCreateOpen(false); setPasswordTarget(null); setEditTarget(null) }} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-muted-foreground">Annuler</button>
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
