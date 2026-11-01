'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Pencil, Phone, Plus, Save, Trash2, X } from 'lucide-react'
import { EducatorAvatar } from '@/components/educator-avatar'
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
  const [visiblePhones, setVisiblePhones] = useState<Record<string, boolean>>({})
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
  const visibleEducators = !isSearching && ownDirectoryEntry
    ? filteredEducators.filter((educator) => educator.id !== ownDirectoryEntry.id)
    : filteredEducators
  const ownPhoneKey = 'own-educator-profile'
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="educator-directory-title" className="font-bold text-primary">Annuaire des éducateurs</h2>
          <p className="mt-1 text-xs text-muted-foreground">Coordonnées séparées des fiches joueurs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && showAddButton && <button type="button" onClick={() => { setDraft(blank); setEditingOwn(false); setError(''); setOpen(true) }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-bold text-primary-foreground"><Plus className="size-4" /> Ajouter un éducateur</button>}
        </div>
      </div>
      )}
      {!isSearching && currentEducator && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/50 bg-background p-3">
          <EducatorAvatar username={currentEducator.username} revision={photoRevision} size="size-16" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ma fiche éducateur</p>
            <p className="truncate font-bold text-foreground">{ownDirectoryEntry?.name ?? currentEducator.displayName}</p>
            <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {currentEducator.role === 'admin' ? 'Administrateur' : currentEducator.role === 'educator' ? 'Éducateur' : 'Lecteur'}
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span>Licence FFF : <strong className="text-primary">{ownDirectoryEntry?.licenseNumber || 'non renseignée'}</strong></span>
              {ownDirectoryEntry?.phone && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVisiblePhones((current) => ({ ...current, [ownPhoneKey]: !current[ownPhoneKey] }))}
                    aria-expanded={Boolean(visiblePhones[ownPhoneKey])}
                    aria-label={`${visiblePhones[ownPhoneKey] ? 'Masquer' : 'Afficher'} votre téléphone`}
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-accent/50 bg-card px-2.5 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5 hover:shadow-md"
                  >
                    <Phone aria-hidden="true" className="size-4" />
                    <span>Téléphone</span>
                  </button>
                  {visiblePhones[ownPhoneKey] && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-primary">{ownDirectoryEntry.phone}</span>
                      {isPhoneDevice && (
                        <a
                          href={`tel:${ownDirectoryEntry.phone.replace(/[^+\d]/g, '')}`}
                          aria-label={`Appeler ${ownDirectoryEntry.name}`}
                          title={`Appeler ${ownDirectoryEntry.name}`}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground"
                        >
                          <Phone aria-hidden="true" className="size-3.5" />
                          Appeler
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-accent/50 bg-card px-3 text-sm font-bold text-primary"
          >
            <Pencil aria-hidden="true" className="size-4" /> Modifier ma fiche
          </button>
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
      ) : visibleEducators.length === 0 ? (
        null
      ) : (
        <>
          {isSearching && searchTitle && <h2 className="font-bold text-primary">{searchTitle}</h2>}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEducators.map((educator) => (
            <li key={educator.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h3 className="truncate font-bold text-foreground">{educator.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Licence FFF : {educator.licenseNumber || 'non renseignée'}</p>
                    {educator.phone && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setVisiblePhones((current) => ({ ...current, [educator.id]: !current[educator.id] }))}
                          aria-expanded={Boolean(visiblePhones[educator.id])}
                          aria-label={`${visiblePhones[educator.id] ? 'Masquer' : 'Afficher'} le téléphone de ${educator.name}`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-accent/50 bg-card px-2.5 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5 hover:shadow-md"
                        >
                          <Phone aria-hidden="true" className="size-4" />
                          <span>Téléphone</span>
                        </button>
                        {visiblePhones[educator.id] && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-primary">{educator.phone}</span>
                            {isPhoneDevice && (
                              <a
                                href={`tel:${educator.phone.replace(/[^+\d]/g, '')}`}
                                aria-label={`Appeler ${educator.name}`}
                                title={`Appeler ${educator.name}`}
                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground"
                              >
                                <Phone aria-hidden="true" className="size-3.5" />
                                Appeler
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => edit(educator)} aria-label={`Modifier ${educator.name}`} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-accent/50 px-2 text-xs font-semibold text-primary">
                      <Pencil aria-hidden="true" className="size-3.5" /> Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeEducator(educator)}
                      disabled={deletingId !== null}
                      aria-label={`Supprimer la fiche de ${educator.name}`}
                      className="inline-flex min-h-8 items-center justify-center rounded-lg border border-destructive/40 px-2 text-destructive disabled:opacity-50"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </li>
            ))}
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
