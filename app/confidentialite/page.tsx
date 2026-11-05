import type { Metadata } from 'next'
import Link from 'next/link'
import { ClubCrest } from '@/components/club-crest'
import { ArrowLeft, Mail, Shield, Trash2, Eye, Lock, FileText } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Politique de confidentialité – ES Genech U11',
  description: 'Politique de confidentialité et protection des données personnelles de l\'application ES Genech U11.',
}

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0f4ff] to-white">
      {/* En-tête */}
      <header className="bg-gradient-to-r from-[#172554] via-[#1e3a8a] to-[#172554] px-4 py-5 shadow-lg">
        <div className="mx-auto max-w-2xl">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white"
          >
            <ArrowLeft className="size-4" />
            Retour à l&apos;application
          </Link>
          <div className="flex items-center gap-4">
            <ClubCrest className="size-12 ring-2 ring-[#d4af37]" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#d4af37]">ES Genech · U11</p>
              <h1 className="text-xl font-black text-white">Politique de confidentialité</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-4 py-8">

        {/* Résumé rapide */}
        <div className="rounded-2xl border border-[#d4af37]/30 bg-[#172554]/5 p-5">
          <div className="flex items-center gap-2 font-black text-[#172554]">
            <Shield className="size-5" />
            En résumé
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-700">
            <li>✅ Vos données sont utilisées <strong>uniquement</strong> pour gérer l&apos;équipe U11 de l&apos;ES Genech.</li>
            <li>✅ Elles ne sont <strong>jamais vendues ni partagées</strong> avec des tiers.</li>
            <li>✅ Seuls les éducateurs autorisés y ont accès.</li>
            <li>✅ Vous pouvez demander la suppression de vos données à tout moment.</li>
          </ul>
        </div>

        {/* Section 1 */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#172554]">
            <FileText className="size-5" />
            1. Responsable du traitement
          </h2>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p><strong>Entente Sportive de Genech</strong></p>
            <p>Section Football – Équipe U11</p>
            <p className="mt-2">
              Contact :{' '}
              <a href="mailto:lasik.emmanuel@gmail.com" className="font-semibold text-[#172554] underline">
                lasik.emmanuel@gmail.com
              </a>
            </p>
          </div>
        </section>

        {/* Section 2 */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#172554]">
            <Eye className="size-5" />
            2. Données collectées
          </h2>
          <div className="mt-3 space-y-3 text-sm text-gray-700">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-black text-gray-900">Données des joueurs</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Prénom et nom de famille</li>
                <li>Numéro de licence FFF</li>
                <li>Poste (gardien, défenseur, milieu, attaquant)</li>
              </ul>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-black text-gray-900">Données des parents / représentants légaux</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Lien de parenté uniquement (désignation « Papa » / « Maman » — <strong>aucun prénom ni nom de famille des parents n&apos;est enregistré</strong>)</li>
                <li>Numéro de téléphone mobile de contact</li>
              </ul>
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                ⚠️ Les coordonnées des parents et des éducateurs permettent de les joindre pour la gestion de l&apos;équipe. Elles sont chiffrées ; les numéros ne sont pas affichés dans les annuaires et seuls des boutons d&apos;appel, de SMS et de WhatsApp sont proposés aux utilisateurs connectés autorisés.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-black text-gray-900">Données des éducateurs</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Nom et prénom</li>
                <li>Numéro de licence FFF</li>
                <li>Numéro de téléphone</li>
                <li>Identifiant de connexion (pseudonyme)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#172554]">
            <Lock className="size-5" />
            3. Finalité et base légale
          </h2>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p>Les données sont collectées et traitées pour :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Gérer les effectifs et les convocations aux matchs</li>
              <li>Faciliter la communication entre éducateurs et familles</li>
              <li>Suivre les statistiques sportives de la saison</li>
              <li>Établir les feuilles de match officielles</li>
            </ul>
            <p className="mt-3 font-semibold">Base légale :</p>
            <p>Intérêt légitime de l&apos;association sportive (gestion d&apos;équipe) — Article 6.1.f du RGPD.</p>
          </div>
        </section>

        {/* Section 4 */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#172554]">
            <Shield className="size-5" />
            4. Accès aux données
          </h2>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p>Seules les personnes suivantes ont accès aux données :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><strong>Administrateur</strong> : accès complet</li>
              <li><strong>Éducateurs</strong> : accès aux données nécessaires à la gestion de l&apos;équipe</li>
              <li><strong>Lecteurs</strong> : accès en lecture seule, sans modification possible</li>
            </ul>
            <p className="mt-3">
              Les données sont hébergées sur les serveurs de <strong>Vercel</strong> (États-Unis — conformité RGPD via DPA) et de <strong>Google</strong> (Google Sheets — conformité RGPD via DPA).
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#172554]">
            <Trash2 className="size-5" />
            5. Vos droits
          </h2>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="mt-2 space-y-2 pl-2">
              <li>🔍 <strong>Droit d&apos;accès</strong> — connaître les données vous concernant</li>
              <li>✏️ <strong>Droit de rectification</strong> — corriger des données inexactes</li>
              <li>🗑️ <strong>Droit à l&apos;effacement</strong> — demander la suppression de vos données</li>
              <li>✋ <strong>Droit d&apos;opposition</strong> — vous opposer au traitement</li>
              <li>📦 <strong>Droit à la portabilité</strong> — recevoir vos données dans un format lisible</li>
            </ul>
            <div className="mt-4 rounded-lg bg-[#172554]/5 p-3">
              <p className="font-semibold text-[#172554]">Pour exercer vos droits, contactez :</p>
              <a
                href="mailto:lasik.emmanuel@gmail.com"
                className="mt-1 inline-flex items-center gap-2 font-black text-[#172554] underline"
              >
                <Mail className="size-4" />
                lasik.emmanuel@gmail.com
              </a>
              <p className="mt-2 text-xs text-gray-500">Réponse garantie sous 30 jours.</p>
            </div>
          </div>
        </section>

        {/* Section 6 */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#172554]">
            <Lock className="size-5" />
            6. Durée de conservation
          </h2>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <ul className="space-y-1 pl-2">
              <li>📅 Données joueurs : conservées <strong>le temps de la saison sportive en cours</strong>, puis archivées 1 an.</li>
              <li>📅 Données éducateurs : conservées <strong>tant que la personne est active dans le club</strong>.</li>
              <li>📅 Résultats de matchs : conservés <strong>à titre historique</strong> (archives sportives).</li>
            </ul>
          </div>
        </section>

        {/* Section 7 */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-black text-[#172554]">
            <Shield className="size-5" />
            7. Sécurité
          </h2>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
            <ul className="space-y-1 pl-2">
              <li>🔒 Connexion chiffrée <strong>HTTPS</strong> sur l&apos;ensemble du site</li>
              <li>🔑 Accès protégé par <strong>identifiant et mot de passe</strong></li>
              <li>🛡️ Clés d&apos;API stockées de façon sécurisée (variables d&apos;environnement Vercel, non exposées)</li>
              <li>👤 Système de <strong>rôles</strong> limitant l&apos;accès selon le profil</li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400">
          <p>Dernière mise à jour : Novembre 2026</p>
          <p className="mt-1">ES Genech U11 · Application interne de gestion d&apos;effectif</p>
        </div>
      </main>
    </div>
  )
}
