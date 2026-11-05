'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { EducatorAvatar } from '@/components/educator-avatar'
import { ClubCrest } from '@/components/club-crest'
import { PhoneActionButtons } from '@/components/phone-action-buttons'
import type { DirectoryEducator } from '@/lib/educator-directory'
import { hasEducatorSurname, sameEducatorName } from '@/lib/educator-name'
import { matchesSearch } from '@/lib/search'

type Draft = { id?: string; name: string; licenseNumber: string; phone: string }
const blank: Draft = { name: '', licenseNumber: '', phone: '' }

export function EducatorDirectory({
  canEdit,
  searchQuery,
  searchTitle,
  showAddButton = true,
  currentEducator,
  photoRevision = 0,
}: {
  canEdit: boolean
  searchQuery?: string
  searchTitle?: string
  showAddButton?: boolean
  currentEducator?: { username: string; displayName: string; role: 'educator' | 'admin' | 'reader' }
  photoRevision?: number
}) {
  const [educators, setEducators] = useState<DirectoryEducator[]>([])
  const [isPhoneDevice, setIsPhoneDevice] = useState(false)
  const [draft, setDraft] = useState<Draft>(blank)
  const [open, setOpen] = useState(false)
  const [editingOwn, setEditingOwn] = useState(false)
  const [pending, setPending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const isSearching = Boolean(searchQuery?.trim())
  const filteredEducators = educators.filter((educator) =>
    matchesSearch(searchQuery ?? '', [educator.name, educator.licenseNumber, educator.phone]),
  )
  const ownDirectoryEntry = (() => {
    if (!currentEducator) return undefined
    const exactMatches = educators.filter((educator) => sameEducatorName(educator.name, currentEducator.displayName))
    if (currentEducator.displayName.trim().includes(' ')) return exactMatches.length === 1 ? exactMatches[0] : undefined
    const suffixMatches = educators.filter((educator) => hasEducatorSurname(educator.name, currentEducator.displayName))
    if (suffixMatches.length > 1) return undefined
    return suffixMatches[0] ?? (exactMatches.length === 1 ? exactMatches[0] : undefined)
  })()
  const allCards = useMemo(() => {
    if (isSearching) return filteredEducators
    if (!currentEducator) return filteredEducators
    if (ownDirectoryEntry) {
      const others = filteredEducators.filter((e) => e.id !== ownDirectoryEntry.id)
      return [ownDirectoryEntry, ...others]
    }
    const myEntry: DirectoryEducator = {
      id: 'me-auto-entry',
      name: currentEducator.displayName,
      licenseNumber: '',
      phone: '',
    }
    return [myEntry, ...filteredEducators]
  }, [currentEducator, filteredEducators, isSearching, ownDirectoryEntry])

  const load = useCallback(async () => {
    const response = await fetch('/api/educators/directory', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'Impossible de charger l’annuaire.')
    setEducators(data.educators as DirectoryEducator[])
  }, [])

  useEffect(() => { void load().catch((reason) => setError(reason instanceof Error ? reason.message : 'Impossible de charger l’annuaire.')) }, [load])

  useEffect(() => {
    setIsPhoneDevice(/iPhone|iPod|Android.*Mobile|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(navigator.userAgent))
  }, [])

  const edit = (educator: DirectoryEducator) => {
    setDraft({ id: educator.id, name: educator.name, licenseNumber: educator.licenseNumber, phone: educator.phone })
    setEditingOwn(false)
    setError('')
    setOpen(true)
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/directory', {
        method: draft.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(draft.id ? { id: draft.id } : {}),
          name: draft.name,
          licenseNumber: draft.licenseNumber,
          phone: draft.phone,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer cette fiche.')
      await load()
      setOpen(false)
      setDraft(blank)
      setNotice('Annuaire des éducateurs mis à jour. Le téléphone est chiffré dans le Sheet.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer cette fiche.')
    } finally { setPending(false) }
  }

  const saveOwnProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/directory/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseNumber: draft.licenseNumber, phone: draft.phone }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible d’enregistrer votre fiche.')
      await load()
      setOpen(false)
      setEditingOwn(false)
      setDraft(blank)
      setNotice('Votre fiche éducateur a été mise à jour.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible d’enregistrer votre fiche.')
    } finally { setPending(false) }
  }

  const removeEducator = async (educator: DirectoryEducator) => {
    if (!window.confirm(`Supprimer la fiche de ${educator.name} ? Son compte de connexion ne sera pas supprimé.`)) return
    setDeletingId(educator.id)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/educators/directory', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: educator.id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Impossible de supprimer cette fiche.')
      await load()
      setNotice(`Fiche de ${educator.name} supprimée. Son compte de connexion est conservé.`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de supprimer cette fiche.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section
      aria-labelledby={isSearching ? undefined : 'educator-directory-title'}
      className={isSearching ? '' : 'rounded-2xl border border-accent/50 bg-card p-4 shadow-sm'}
    >
      {!isSearching && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] p-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <ClubCrest className="size-10 shrink-0 ring-2 ring-amber-400/80 shadow-md" />
          <div>
            <h2 id="educator-directory-title" className="text-lg font-black tracking-wide text-white">Annuaire des éducateurs</h2>
            <p className="mt-0.5 text-xs text-blue-200">Coordonnées et licences de l’encadrement ESG</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && showAddButton && (
            <button
              type="button"
              onClick={() => { setDraft(blank); setEditingOwn(false); setError(''); setOpen(true) }}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-amber-400 px-3.5 text-xs font-black text-blue-950 shadow-sm transition hover:bg-amber-300"
            >
              <Plus className="size-4" /> Ajouter un éducateur
            </button>
          )}
        </div>
      </div>
      )}
      {notice && <p role="status" className="mt-3 text-sm font-medium text-emerald-700">{notice}</p>}
      {error && !open && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      {educators.length === 0 ? (
        isSearching ? null : (
          <p className="mt-3 rounded-lg bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
            L’annuaire est vide. {canEdit ? 'Ajoute la première fiche pour créer son onglet dédié dans le Sheet.' : 'Un administrateur pourra ajouter les fiches.'}
          </p>
        )
      ) : allCards.length === 0 ? (
        null
      ) : (
        <>
          {isSearching && searchTitle && <h2 className="font-bold text-primary">{searchTitle}</h2>}
          <ul className="mt-4 grid gap-4 sm:mt-3 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
            {allCards.map((educator: DirectoryEducator) => {
              const isOwn = currentEducator && (educator.id === ownDirectoryEntry?.id || educator.id === 'me-auto-entry')
              return (
                <li
                  key={educator.id}
                  className="rounded-2xl border-2 border-[#172554]/15 bg-card p-4 shadow-sm transition-all hover:border-[#172554]/40 hover:shadow-md sm:p-3.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isOwn ? (
                        <div className="size-9 shrink-0 overflow-hidden rounded-xl ring-2 ring-amber-400/60 shadow-sm flex items-center justify-center bg-[#172554]">
                          <EducatorAvatar username={currentEducator.username} revision={photoRevision} size="size-9" />
                        </div>
                      ) : (
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-xs font-black text-amber-300 ring-2 ring-amber-400/40 shadow-sm">
                          {educator.name.split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="truncate text-base font-bold text-foreground">
                            {educator.name}
                          </h3>
                          {isOwn && (
                            <span className="inline-flex rounded-full bg-[#172554] px-2 py-0.5 text-[10px] font-black text-amber-300 ring-1 ring-amber-400/40">
                              {currentEducator.role === 'admin' ? 'Admin' : 'Moi'}
                            </span>
                          )}
                          {isOwn ? (
                            <button
                              type="button"
                              onClick={() => {
                                setDraft({
                                  name: currentEducator.displayName,
                                  licenseNumber: ownDirectoryEntry?.licenseNumber ?? '',
                                  phone: ownDirectoryEntry?.phone ?? '',
                                })
                                setEditingOwn(true)
                                setError('')
                                setOpen(true)
                              }}
                              aria-label="Modifier ma fiche"
                              title="Modifier ma fiche"
                              className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-card text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
                            >
                              <Pencil aria-hidden="true" className="size-3" />
                            </button>
                          ) : (
                            canEdit && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => edit(educator)}
                                  aria-label={`Modifier ${educator.name}`}
                                  title="Modifier la fiche"
                                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-accent/40 bg-card text-muted-foreground transition hover:bg-accent/40 hover:text-foreground"
                                >
                                  <Pencil aria-hidden="true" className="size-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void removeEducator(educator)}
                                  disabled={deletingId !== null}
                                  aria-label={`Supprimer la fiche de ${educator.name}`}
                                  title="Supprimer la fiche"
                                  className="inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-destructive/30 bg-card text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                                >
                                  <Trash2 aria-hidden="true" className="size-3" />
                                </button>
                              </>
                            )
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Licence FFF : <span className="font-mono font-medium">{educator.licenseNumber || 'non renseignée'}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {educator.phone ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-muted/40 p-3 sm:mt-3 sm:p-2">
                      <PhoneActionButtons
                        phone={educator.phone}
                        label="le téléphone"
                        playerName={educator.name}
                      />
                    </div>
                  ) : isOwn ? (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-dashed border-accent/60 bg-muted/20 p-2 text-xs text-muted-foreground">
                      <span>Aucun téléphone</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            name: currentEducator.displayName,
                            licenseNumber: ownDirectoryEntry?.licenseNumber ?? '',
                            phone: '',
                          })
                          setEditingOwn(true)
                          setError('')
                          setOpen(true)
                        }}
                        className="font-bold text-primary hover:underline"
                      >
                        Ajouter
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {!canEdit && !currentEducator && <p className="mt-3 text-xs text-muted-foreground">La modification des fiches est réservée à l’administrateur.</p>}
      {open && (canEdit || editingOwn) && (
        <div role="dialog" aria-modal="true" aria-labelledby="directory-form-title" className="fixed inset-0 z-[60] grid place-items-center bg-[#172554]/60 p-4">
          <form onSubmit={editingOwn ? saveOwnProfile : save} className="w-full max-w-md rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Annuaire éducateurs</p><h3 id="directory-form-title" className="mt-1 text-lg font-black text-primary">{editingOwn ? 'Modifier ma fiche' : draft.id ? 'Modifier une fiche' : 'Ajouter un éducateur'}</h3></div>
              <button type="button" onClick={() => { setOpen(false); setEditingOwn(false) }} aria-label="Fermer" className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"><X className="size-4" /></button>
            </div>
            <div className="mt-4 grid gap-3">
              {!editingOwn && <label className="grid gap-1 text-sm font-semibold">Nom et prénom<input required minLength={2} maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>}
              <label className="grid gap-1 text-sm font-semibold">N° de licence FFF<input maxLength={40} value={draft.licenseNumber} onChange={(event) => setDraft({ ...draft, licenseNumber: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
              <label className="grid gap-1 text-sm font-semibold">Téléphone<input type="tel" inputMode="tel" maxLength={80} value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="h-10 rounded-lg border border-accent/50 bg-background px-3 font-normal" /></label>
              <p className="text-xs text-muted-foreground">Le téléphone sera chiffré avant son enregistrement dans le Google Sheet.</p>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex justify-end gap-2"><button type="button" onClick={() => { setOpen(false); setEditingOwn(false) }} className="min-h-10 rounded-lg px-3 text-sm font-semibold text-muted-foreground">Annuler</button><button type="submit" disabled={pending} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"><Save className="size-4" />{pending ? 'Enregistrement…' : 'Enregistrer'}</button></div>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
