'use client'

import { ContactRound, KeyRound, Save, X } from 'lucide-react'
import { ParentAvatar } from '@/components/parent-avatar'

export type ParentKey = 'father' | 'mother'
export type PhoneEditor = { number: number; name: string; parent: ParentKey | null; value: string }

export function EducatorRosterDialogs({
  addProfileChooserOpen,
  onCloseAddProfileChooser,
  onChooseAddProfile,
  phoneEditor,
  onClosePhoneEditor,
  onSelectPhoneParent,
  onPhoneValueChange,
  onChangePhoneParent,
  onSavePhone,
  authError,
  requestPending,
}: {
  addProfileChooserOpen: boolean
  onCloseAddProfileChooser: () => void
  onChooseAddProfile: (type: 'educators' | 'accounts') => void
  phoneEditor: PhoneEditor | null
  onClosePhoneEditor: () => void
  onSelectPhoneParent: (parent: ParentKey) => void
  onPhoneValueChange: (value: string) => void
  onChangePhoneParent: () => void
  onSavePhone: () => void
  authError: string
  requestPending: boolean
}) {
  return (
    <>
      {addProfileChooserOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-profile-title"
          className="fixed inset-0 z-[60] grid place-items-center bg-[#172554]/60 p-4"
        >
          <section className="w-full max-w-sm rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl">
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nouvelle fiche</p>
                <h2 id="add-profile-title" className="mt-1 text-lg font-black text-primary">Que souhaitez-vous ajouter ?</h2>
              </div>
              <button
                type="button"
                onClick={onCloseAddProfileChooser}
                aria-label="Fermer"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </header>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={() => onChooseAddProfile('educators')}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-accent/50 bg-background px-3 text-left font-semibold text-primary transition hover:bg-accent/20"
              >
                <ContactRound aria-hidden="true" className="size-5 shrink-0" />
                Fiche éducateur
              </button>
              <button
                type="button"
                onClick={() => onChooseAddProfile('accounts')}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-accent/50 bg-background px-3 text-left font-semibold text-primary transition hover:bg-accent/20"
              >
                <KeyRound aria-hidden="true" className="size-5 shrink-0" />
                Comptes (Admin/Éducateur/Lecteur)
              </button>
            </div>
          </section>
        </div>
      )}

      {phoneEditor && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="parent-phone-dialog-title"
          className="fixed inset-0 z-50 grid place-items-center bg-[#172554]/60 p-4"
        >
          <section className="w-full max-w-sm rounded-2xl border border-accent/60 bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fiche de {phoneEditor.name}</p>
                <h3 id="parent-phone-dialog-title" className="mt-1 text-lg font-black text-primary">
                  {phoneEditor.parent ? `Téléphone de ${phoneEditor.parent === 'father' ? 'Papa' : 'Maman'}` : 'Quel parent ?'}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClosePhoneEditor}
                aria-label="Fermer"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent/40"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>

            {!phoneEditor.parent ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                {(['father', 'mother'] as const).map((parent) => (
                  <button
                    key={parent}
                    type="button"
                    onClick={() => onSelectPhoneParent(parent)}
                    className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-accent/50 bg-background px-3 py-3 text-sm font-bold text-primary hover:bg-primary/5"
                  >
                    <ParentAvatar parent={parent} />
                    {parent === 'father' ? 'Papa' : 'Maman'}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold">
                  Numéro de téléphone
                  <input
                    autoFocus
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={80}
                    value={phoneEditor.value}
                    onChange={(event) => onPhoneValueChange(event.target.value)}
                    placeholder="Ex. 06 12 34 56 78"
                    className="h-11 rounded-xl border border-accent/50 bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
                <p className="mt-2 text-xs text-muted-foreground">
                  Le numéro est chiffré et synchronisé dès que tu l’enregistres.
                </p>
                {authError && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{authError}</p>}
                <div className="mt-4 flex flex-wrap justify-between gap-2">
                  <button
                    type="button"
                    onClick={onChangePhoneParent}
                    disabled={requestPending}
                    className="min-h-10 rounded-xl border border-accent/50 px-3 text-sm font-semibold text-primary disabled:opacity-50"
                  >
                    Changer de parent
                  </button>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onClosePhoneEditor}
                      disabled={requestPending}
                      className="min-h-10 rounded-xl px-3 text-sm font-semibold text-muted-foreground"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={onSavePhone}
                      disabled={requestPending || !phoneEditor.value.trim()}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
                    >
                      <Save aria-hidden="true" className="size-4" />
                      {requestPending ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}
