# Accès éducateurs et coordonnées

L’onglet Éducateurs ne montre les téléphones qu’après une connexion individuelle. Les numéros sont chiffrés avec AES-256-GCM dans les onglets `Joueurs` et `Téléphones éducateurs`, puis déchiffrés côté serveur pour les éducateurs connectés. La clé `EDUCATOR_PHONE_ENCRYPTION_KEY` est conservée comme variable secrète dans Vercel, jamais dans le dépôt ni dans le classeur. Les mots de passe restent stockés sous forme de hachages scrypt.

## Configuration du serveur

La connexion Google Sheets réutilise le compte de service GCP et les variables déjà configurées dans Vercel. Ne remplacez pas les identifiants GCP, la clé privée ni les autres variables Google. Le compte de service doit pouvoir modifier le classeur. Ajoutez `EDUCATOR_PHONE_ENCRYPTION_KEY` comme variable secrète de production dans Vercel. Générez une clé avec `node -p "require('node:crypto').randomBytes(32).toString('base64url')"`, puis collez-la dans Vercel sans la mettre dans le dépôt ou dans le Sheet. Conservez cette clé : la perdre ou la remplacer sans rechiffrer les cellules rendrait les téléphones illisibles.

Pour l’authentification individuelle des éducateurs, configurer `EDUCATOR_SESSION_SECRET` et `EDUCATOR_ACCOUNTS`. Créer les comptes dans un terminal local :

```sh
node scripts/create-educator-account.mjs
```

Le mot de passe est saisi sans être affiché. Ajouter chaque objet JSON produit dans le tableau de la variable secrète `EDUCATOR_ACCOUNTS`. Créer au moins un compte avec le rôle `admin` pour créer l’onglet et gérer les numéros. Ne pas mettre les mots de passe dans le dépôt, la feuille Google Sheets ou un message.

Limiter aussi le débit des tentatives de connexion au niveau du fournisseur d’hébergement : la protection locale de l’application ne remplace pas une limite distribuée entre instances.

## Créer l’onglet dédié dans le classeur actuel

Le classeur actuel est conservé. Lors de l’initialisation, l’application crée l’onglet `Téléphones éducateurs` s’il n’existe pas. La structure des onglets reste en place, mais les cellules téléphoniques en clair des onglets `Joueurs` et `Téléphones éducateurs` sont remplacées par leurs valeurs chiffrées.

1. Configurer `GOOGLE_SHEET_ID` avec l’identifiant du classeur actuel.
2. Vérifier que le compte de service GCP déjà configuré dans `.env` a les droits de modification sur le classeur.
3. Configurer les comptes éducateurs, `EDUCATOR_SESSION_SECRET` et `EDUCATOR_PHONE_ENCRYPTION_KEY`, puis se connecter avec le compte `admin`.
4. Dans l’espace Éducateurs, choisir **Créer l’onglet et chiffrer les numéros** (première création) ou **Chiffrer et synchroniser** si l’onglet existe déjà. L’action chiffre les cellules des deux onglets et peut être relancée sans chiffrer une valeur deux fois.
5. Les téléphones sont déchiffrés côté serveur pour les éducateurs connectés. Les futures modifications de Manu sont enregistrées chiffrées dans les deux onglets.

Les cellules contiennent le texte chiffré, pas le numéro lisible ; les personnes ayant seulement accès au classeur ne peuvent pas le déchiffrer sans la clé Vercel. Google Sheets peut toutefois conserver des valeurs en clair dans l’historique des versions antérieures. Le chiffrement applicatif ne remplace pas les contrôles d’accès au classeur. Les appels utilisent HTTPS et les réponses de l’API de coordonnées ne sont pas mises en cache. Les tentatives de connexion doivent aussi être limitées au niveau de l’hébergement, car le compteur local ne couvre pas plusieurs instances.
