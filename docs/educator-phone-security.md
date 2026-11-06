# Accès éducateurs et coordonnées

L’onglet Éducateurs ne montre les téléphones qu’après une connexion individuelle. Les numéros sont chiffrés avec AES-256-GCM dans les onglets `Joueurs` et `Téléphones éducateurs`, puis déchiffrés côté serveur pour les éducateurs connectés. La clé `EDUCATOR_PHONE_ENCRYPTION_KEY` est conservée comme variable secrète dans Vercel, jamais dans le dépôt ni dans le classeur. Les mots de passe restent stockés sous forme de hachages scrypt.

Les dates de naissance et numéros de licence des joueurs ne sont pas inclus dans le rendu public. Les licences nécessaires à l’annuaire des joueurs sont chargées depuis une API réservée aux éducateurs connectés. L’action d’actualisation du classeur est également réservée aux éducateurs.

Dans l’espace Éducateurs, un administrateur peut lancer **Vérifier le chiffrement des téléphones**. Le contrôle vérifie le format de la clé active et tente de déchiffrer les valeurs des onglets concernés. Il affiche uniquement des compteurs et les noms d’onglets absents, jamais les numéros ni la clé. Si aucune valeur chiffrée n’existe, le contrôle du format ne prouve pas qu’une ancienne clé a servi à chiffrer des données.

Avant la migration des téléphones, l’administrateur doit créer manuellement une copie du classeur dans Google Sheets et confirmer cette sauvegarde dans l’application. La migration est refusée par l’API sans cette confirmation. Cette confirmation ne remplace pas la vérification que la copie existe réellement.

## Configuration du serveur

La connexion Google Sheets réutilise le compte de service GCP et les variables déjà configurées dans Vercel. Ne remplacez pas les identifiants GCP, la clé privée ni les autres variables Google. Le compte de service doit pouvoir modifier le classeur. Ajoutez `EDUCATOR_PHONE_ENCRYPTION_KEY` comme variable secrète de production dans Vercel. Générez une clé avec `node -p "require('node:crypto').randomBytes(32).toString('base64url')"`, puis collez-la dans Vercel sans la mettre dans le dépôt ou dans le Sheet. Conservez cette clé : la perdre ou la remplacer sans rechiffrer les cellules rendrait les téléphones illisibles.

Pour l’authentification individuelle des éducateurs, configurer `EDUCATOR_SESSION_SECRET` et `EDUCATOR_ACCOUNTS`. Créer les comptes dans un terminal local :

```sh
node scripts/create-educator-account.mjs
```

Le mot de passe est saisi sans être affiché. Ajouter chaque objet JSON produit dans le tableau de la variable secrète `EDUCATOR_ACCOUNTS`. Créer au moins un compte avec le rôle `admin` pour créer l’onglet et gérer les numéros. Ne pas mettre les mots de passe dans le dépôt, la feuille Google Sheets ou un message.

Limiter aussi le débit des tentatives de connexion au niveau du fournisseur d’hébergement : la protection locale de l’application ne remplace pas une limite distribuée entre instances.

### Gestion des comptes éducateurs

La gestion des comptes nécessite aussi la variable secrète Vercel `EDUCATOR_ACCOUNT_ENCRYPTION_KEY`, distincte de la clé de chiffrement des téléphones. Générer une clé de 32 octets avec :

```sh
node -p "require('node:crypto').randomBytes(32).toString('base64url')"
```

La configurer en production avant le prochain accès éducateur. Au premier accès, si l’onglet `Comptes éducateurs` n’existe pas, l’application le crée puis initialise ses comptes à partir de `EDUCATOR_ACCOUNTS`. La première ligne contient l’en-tête et la suivante le contenu chiffré AES-256-GCM. Vérifier qu’un administrateur peut se connecter et que l’onglet est initialisé avant de retirer `EDUCATOR_ACCOUNTS`, qui ne sert alors plus qu’à une initialisation d’un onglet vide. Ne pas supprimer ni remplacer la clé de chiffrement après initialisation : sans elle, les comptes ne peuvent plus être lus.

Dans **Éducateurs > Comptes**, un administrateur peut créer un compte avec un mot de passe d’au moins 12 caractères, réinitialiser un mot de passe, accorder ou retirer les droits administrateur et supprimer un autre compte. Ces modifications sont disponibles uniquement sur le déploiement de production. Les mots de passe sont hachés avec scrypt avant d’être inclus dans le contenu chiffré. Une modification de mot de passe invalide les sessions existantes du compte ; une suppression ou un changement de rôle s’applique à ses prochaines requêtes. Le dernier administrateur ne peut pas être supprimé ou rétrogradé, et un administrateur ne peut pas supprimer son propre compte ni retirer ses propres droits.

## Créer l’onglet dédié dans le classeur actuel

Le classeur actuel est conservé. Lors de l’initialisation, l’application crée l’onglet `Téléphones éducateurs` s’il n’existe pas. La structure des onglets reste en place, mais les cellules téléphoniques en clair des onglets `Joueurs` et `Téléphones éducateurs` sont remplacées par leurs valeurs chiffrées.

1. Configurer `GOOGLE_SHEET_ID` avec l’identifiant du classeur actuel.
2. Vérifier que le compte de service GCP déjà configuré dans `.env` a les droits de modification sur le classeur.
3. Configurer les comptes éducateurs, `EDUCATOR_SESSION_SECRET` et `EDUCATOR_PHONE_ENCRYPTION_KEY`, puis se connecter avec le compte `admin`.
4. Dans l’espace Éducateurs, choisir **Créer l’onglet et chiffrer les numéros** lors de la première création ou migration du téléphone historique.
5. Pour un numéro de parent, l’administrateur choisit Papa ou Maman dans la fiche du joueur, puis saisit ou modifie le numéro. La validation chiffre et synchronise immédiatement le numéro dans les colonnes correspondantes de l’onglet Joueurs et dans l’onglet Téléphones éducateurs.
6. Les téléphones sont déchiffrés côté serveur pour les éducateurs connectés. Dans la fiche, le numéro reste caché jusqu’à ce que l’éducateur ouvre le contact correspondant. Les numéros absents n’affichent aucun bouton d’appel.

Les cellules contiennent le texte chiffré, pas le numéro lisible ; les personnes ayant seulement accès au classeur ne peuvent pas le déchiffrer sans la clé Vercel. Google Sheets peut toutefois conserver des valeurs en clair dans l’historique des versions antérieures. Le chiffrement applicatif ne remplace pas les contrôles d’accès au classeur. Les appels utilisent HTTPS et les réponses de l’API de coordonnées ne sont pas mises en cache. Les tentatives de connexion doivent aussi être limitées au niveau de l’hébergement, car le compteur local ne couvre pas plusieurs instances.
