"use client"

import { useState, type FormEvent } from 'react'
import { Award, CalendarDays, Check, Mail, MapPin, Pencil, Phone, Plus, Save, ShieldCheck, Trophy, Users } from 'lucide-react'

type Section = 'educateurs' | 'joueurs' | 'matchs'
type Educator = { id: number; name: string; role: string; license: string; phone: string; email: string }
type Player = { id: number; firstName: string; lastName: string; position: string; license: string }
type Match = { id: number; date: string; team: string; opponent: string; venue: string; kind: string; for: number; against: number }

const sampleEducators: Educator[] = [
  { id: 1, name: 'Camille Exemple', role: 'Éducateur U11', license: '', phone: '', email: 'exemple@club.test' },
  { id: 2, name: 'Morgan Démo', role: 'Responsable équipe', license: '', phone: '', email: 'demo@club.test' },
]
const samplePlayers: Player[] = [
  { id: 1, firstName: 'Joueur', lastName: 'Démo', position: 'Milieu', license: '', },
  { id: 2, firstName: 'Alex', lastName: 'Exemple', position: 'Gardien', license: '', },
]
const sampleMatches: Match[] = [
  { id: 1, date: '2026-10-18', team: 'Équipe 1', opponent: 'Club Exemple', venue: 'Domicile', kind: 'Championnat', for: 2, against: 1 },
  { id: 2, date: '2026-10-25', team: 'Équipe 2', opponent: 'Club Démo', venue: 'Extérieur', kind: 'Amical', for: 1, against: 3 },
]

function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-semibold text-foreground">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="h-11 rounded-xl border border-accent/50 bg-background px-3 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </label>
  )
}

const inputCard = 'rounded-2xl border border-accent/50 bg-card p-4 shadow-sm'
const primaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm hover:opacity-90'
const secondaryButton = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-accent/60 bg-card px-3 text-sm font-semibold text-primary hover:bg-primary/5'

export function SaisiePreview() {
  const [section, setSection] = useState<Section>('educateurs')
  const [educators, setEducators] = useState(sampleEducators)
  const [players, setPlayers] = useState(samplePlayers)
  const [matches, setMatches] = useState(sampleMatches)
  const [educatorForm, setEducatorForm] = useState<Educator | null>(null)
  const [playerForm, setPlayerForm] = useState<Player | null>(null)
  const [matchFormOpen, setMatchFormOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const startEducator = (value?: Educator) => {
    setNotice('')
    setEducatorForm(value ?? { id: Date.now(), name: '', role: '', license: '', phone: '', email: '' })
  }
  const saveEducator = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!educatorForm) return
    setEducators((current) => current.some((item) => item.id === educatorForm.id)
      ? current.map((item) => item.id === educatorForm.id ? educatorForm : item)
      : [...current, educatorForm])
    setEducatorForm(null)
    setNotice('Modifications conservées dans cet aperçu uniquement.')
  }

  const startPlayer = (value?: Player) => {
    setNotice('')
    setPlayerForm(value ?? { id: Date.now(), firstName: '', lastName: '', position: '', license: '' })
  }
  const savePlayer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!playerForm) return
    setPlayers((current) => current.some((item) => item.id === playerForm.id)
      ? current.map((item) => item.id === playerForm.id ? playerForm : item)
      : [...current, playerForm])
    setPlayerForm(null)
    setNotice('Modifications conservées dans cet aperçu uniquement.')
  }

  const [matchDraft, setMatchDraft] = useState({
    date: new Date().toISOString().slice(0, 10),
    team: 'Équipe 1',
    opponent: '',
    venue: 'Domicile',
    kind: 'Championnat',
    for: '',
    against: '',
  })
  const saveMatch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setMatches((current) => [{
      id: Date.now(),
      ...matchDraft,
      for: Number(matchDraft.for),
      against: Number(matchDraft.against),
    }, ...current])
    setMatchFormOpen(false)
    setMatchDraft((current) => ({ ...current, opponent: '', for: '', against: '' }))
    setNotice('Résultat ajouté dans cet aperçu uniquement.')
  }

  const sectionLabels: Record<Section, string> = {
    educateurs: 'Éducateurs',
    joueurs: 'Joueurs',
    matchs: 'Résultats des matchs',
  }

  return (
    <main className="min-h-dvh bg-muted/40 px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <header className="rounded-2xl border border-accent/60 bg-gradient-to-br from-primary via-primary to-[#263d70] p-5 text-primary-foreground shadow-lg sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">ES Genech · U11</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Saisies dans l’application</h1>
          <p className="mt-2 max-w-2xl text-sm text-primary-foreground/80 sm:text-base">
            Prototype pour gérer les éducateurs, l’effectif et les résultats sans saisir directement dans Google Sheets.
          </p>
        </header>

        <aside role="note" className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <p><strong>Aperçu sans connexion au Sheet.</strong> Les exemples sont fictifs. Les ajouts et modifications sont temporaires et disparaissent au rechargement.</p>
        </aside>

        <nav aria-label="Rubriques de saisie" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
          {(['educateurs', 'joueurs', 'matchs'] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={section === key}
              onClick={() => { setSection(key); setNotice('') }}
              className={section === key
                ? 'min-h-11 rounded-lg bg-primary px-2 text-xs font-bold text-primary-foreground shadow-sm sm:text-sm'
                : 'min-h-11 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-background sm:text-sm'}
            >
              {sectionLabels[key]}
            </button>
          ))}
        </nav>

        {notice && (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
            <Check aria-hidden="true" className="size-4" /> {notice}
          </p>
        )}

        {section === 'educateurs' && (
          <section className="flex flex-col gap-4" aria-labelledby="educators-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="educators-title" className="text-xl font-black text-primary">Annuaire des éducateurs</h2>
                <p className="mt-1 text-sm text-muted-foreground">Coordonnées et licences séparées des fiches joueurs et des numéros Papa/Maman.</p>
              </div>
              {!educatorForm && <button className={primaryButton} onClick={() => startEducator()}><Plus className="size-4" /> Ajouter un éducateur</button>}
            </div>
            {educatorForm && (
              <form onSubmit={saveEducator} className={inputCard + ' grid gap-3 sm:grid-cols-2'}>
                <h3 className="text-lg font-bold text-primary sm:col-span-2">{educators.some((item) => item.id === educatorForm.id) ? 'Modifier un éducateur' : 'Nouvel éducateur'}</h3>
                <Field label="Nom et prénom" value={educatorForm.name} onChange={(name) => setEducatorForm({ ...educatorForm, name })} required />
                <Field label="Fonction dans l’équipe" value={educatorForm.role} onChange={(role) => setEducatorForm({ ...educatorForm, role })} required />
                <Field label="N° de licence FFF" value={educatorForm.license} onChange={(license) => setEducatorForm({ ...educatorForm, license })} />
                <Field label="Téléphone" value={educatorForm.phone} onChange={(phone) => setEducatorForm({ ...educatorForm, phone })} type="tel" />
                <Field label="Adresse e-mail" value={educatorForm.email} onChange={(email) => setEducatorForm({ ...educatorForm, email })} type="email" />
                <div className="flex gap-2 sm:col-span-2">
                  <button className={primaryButton} type="submit"><Save className="size-4" /> Enregistrer</button>
                  <button className={secondaryButton} type="button" onClick={() => setEducatorForm(null)}>Annuler</button>
                </div>
              </form>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {educators.map((item) => (
                <article key={item.id} className={inputCard}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-foreground">{item.name}</h3>
                      <p className="text-sm text-muted-foreground">{item.role || 'Fonction à préciser'}</p>
                    </div>
                    <button type="button" className={secondaryButton} onClick={() => startEducator(item)} aria-label={'Modifier ' + item.name}><Pencil className="size-4" /> Modifier</button>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2"><Award className="size-4 shrink-0 text-accent-foreground" /> Licence FFF : {item.license || 'À renseigner'}</p>
                    <p className="flex items-center gap-2"><Phone className="size-4 shrink-0" /> {item.phone || 'Téléphone à renseigner'}</p>
                    <p className="flex items-center gap-2"><Mail className="size-4 shrink-0" /> {item.email || 'E-mail à renseigner'}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {section === 'joueurs' && (
          <section className="flex flex-col gap-4" aria-labelledby="players-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="players-title" className="text-xl font-black text-primary">Effectif joueurs</h2>
                <p className="mt-1 text-sm text-muted-foreground">Une seule fiche par joueur, avec poste et licence FFF.</p>
              </div>
              {!playerForm && <button className={primaryButton} onClick={() => startPlayer()}><Plus className="size-4" /> Ajouter un joueur</button>}
            </div>
            {playerForm && (
              <form onSubmit={savePlayer} className={inputCard + ' grid gap-3 sm:grid-cols-2'}>
                <h3 className="text-lg font-bold text-primary sm:col-span-2">{players.some((item) => item.id === playerForm.id) ? 'Modifier un joueur' : 'Nouveau joueur'}</h3>
                <Field label="Prénom" value={playerForm.firstName} onChange={(firstName) => setPlayerForm({ ...playerForm, firstName })} required />
                <Field label="Nom" value={playerForm.lastName} onChange={(lastName) => setPlayerForm({ ...playerForm, lastName })} required />
                <Field label="Poste" value={playerForm.position} onChange={(position) => setPlayerForm({ ...playerForm, position })} />
                <Field label="N° de licence FFF" value={playerForm.license} onChange={(license) => setPlayerForm({ ...playerForm, license })} />
                <div className="flex gap-2 sm:col-span-2">
                  <button className={primaryButton} type="submit"><Save className="size-4" /> Enregistrer</button>
                  <button className={secondaryButton} type="button" onClick={() => setPlayerForm(null)}>Annuler</button>
                </div>
              </form>
            )}
            <div className="grid gap-2">
              {players.map((item) => (
                <article key={item.id} className={inputCard + ' flex items-center justify-between gap-3'}>
                  <div>
                    <h3 className="font-bold">{item.firstName} {item.lastName}</h3>
                    <p className="text-sm text-muted-foreground">{item.position || 'Poste à préciser'} · Licence FFF : {item.license || 'À renseigner'}</p>
                  </div>
                  <button type="button" className={secondaryButton} onClick={() => startPlayer(item)} aria-label={'Modifier ' + item.firstName + ' ' + item.lastName}><Pencil className="size-4" /><span className="hidden sm:inline">Modifier</span></button>
                </article>
              ))}
            </div>
          </section>
        )}

        {section === 'matchs' && (
          <section className="flex flex-col gap-4" aria-labelledby="matches-title">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="matches-title" className="text-xl font-black text-primary">Résultats des matchs</h2>
                <p className="mt-1 text-sm text-muted-foreground">Dans la vraie version, ce formulaire alimentera « ⚽ Feuille de Match Equipe 1 » ou « ⚽ Feuille de Match Equipe 2 » selon l’équipe choisie.</p>
              </div>
              {!matchFormOpen && <button className={primaryButton} onClick={() => { setMatchFormOpen(true); setNotice('') }}><Plus className="size-4" /> Saisir un résultat</button>}
            </div>
            {matchFormOpen && (
              <form onSubmit={saveMatch} className={inputCard + ' grid gap-3 sm:grid-cols-2'}>
                <h3 className="text-lg font-bold text-primary sm:col-span-2">Nouveau résultat</h3>
                <Field label="Date du match" type="date" value={matchDraft.date} onChange={(date) => setMatchDraft({ ...matchDraft, date })} required />
                <label className="flex flex-col gap-1.5 text-sm font-semibold">Équipe
                  <select value={matchDraft.team} onChange={(event) => setMatchDraft({ ...matchDraft, team: event.target.value })} className="h-11 rounded-xl border border-accent/50 bg-background px-3 font-normal">
                    <option>Équipe 1</option><option>Équipe 2</option>
                  </select>
                </label>
                <Field label="Adversaire" value={matchDraft.opponent} onChange={(opponent) => setMatchDraft({ ...matchDraft, opponent })} required />
                <label className="flex flex-col gap-1.5 text-sm font-semibold">Lieu
                  <select value={matchDraft.venue} onChange={(event) => setMatchDraft({ ...matchDraft, venue: event.target.value })} className="h-11 rounded-xl border border-accent/50 bg-background px-3 font-normal">
                    <option>Domicile</option><option>Extérieur</option><option>Terrain neutre</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-semibold">Type de rencontre
                  <select value={matchDraft.kind} onChange={(event) => setMatchDraft({ ...matchDraft, kind: event.target.value })} className="h-11 rounded-xl border border-accent/50 bg-background px-3 font-normal">
                    <option>Championnat</option><option>Amical</option><option>Tournoi</option><option>Plateau</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Buts ESG" type="number" value={matchDraft.for} onChange={(value) => setMatchDraft({ ...matchDraft, for: value })} required />
                  <Field label="Buts adversaire" type="number" value={matchDraft.against} onChange={(value) => setMatchDraft({ ...matchDraft, against: value })} required />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <button className={primaryButton} type="submit"><Save className="size-4" /> Enregistrer le résultat</button>
                  <button className={secondaryButton} type="button" onClick={() => setMatchFormOpen(false)}>Annuler</button>
                </div>
              </form>
            )}
            <div className="grid gap-2">
              {matches.map((item) => (
                <article key={item.id} className={inputCard + ' flex flex-wrap items-center justify-between gap-3'}>
                  <div>
                    <p className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><CalendarDays className="size-4" /> {new Intl.DateTimeFormat('fr-FR').format(new Date(item.date + 'T12:00:00'))} · {item.team} · {item.kind}</p>
                    <h3 className="mt-1 flex items-center gap-2 font-bold"><MapPin className="size-4 text-primary" /> {item.opponent} ({item.venue.toLowerCase()})</h3>
                  </div>
                  <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 font-mono text-lg font-black text-primary"><Trophy className="size-4" /> {item.for} – {item.against}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          Après validation du prototype, la vraie version écrira côté serveur dans le Sheet et relira les résultats pour actualiser le tableau. Les saisies des parents resteront distinctes.
        </footer>
      </div>
    </main>
  )
}
