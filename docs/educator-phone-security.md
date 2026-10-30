# Accès éducateurs et coordonnées

L’onglet Éducateurs ne montre les téléphones qu’après une connexion individuelle. Les numéros sont stockés dans l’onglet `Téléphones éducateurs` du classeur, et transmis à l’application après authentification. La protection des données au repos et en transit repose sur Google Cloud et Google Sheets ; il n’y a pas de chiffrement applicatif des cellules. Les mots de passe sont stockés sous forme de hachages scrypt.

## Configuration du serveur

La connexion Google Sheets réutilise le compte de service GCP et les variables `.env` déjà configurés dans l’application. Ne remplacez pas vos identifiants GCP, votre clé privée ni les autres variables Google existantes. Vérifiez seulement que le compte de service dispose du droit de modification sur le classeur actuel. Aucun secret de chiffrement téléphonique ni commande OpenSSL n’est requis.

Pour l’authentification individuelle des éducateurs, configurer `EDUCATOR_SESSION_SECRET` et `EDUCATOR_ACCOUNTS`. Créer les comptes dans un terminal local :

```sh
node scripts/create-educator-account.mjs
```

Le mot de passe est saisi sans être affiché. Ajouter chaque objet JSON produit dans le tableau de la variable secrète `EDUCATOR_ACCOUNTS`. Créer au moins un compte avec le rôle `admin` pour créer l’onglet et gérer les numéros. Ne pas mettre les mots de passe dans le dépôt, la feuille Google Sheets ou un message.

Limiter aussi le débit des tentatives de connexion au niveau du fournisseur d’hébergement : la protection locale de l’application ne remplace pas une limite distribuée entre instances.

## Créer l’onglet dédié dans le classeur actuel

Le classeur actuel est conservé. Lors de l’initialisation, l’application crée uniquement un nouvel onglet `Téléphones éducateurs` dans ce même classeur. L’onglet `Joueurs` n’est ni modifié ni supprimé.

1. Configurer `GOOGLE_SHEET_ID` avec l’identifiant du classeur actuel.
2. Vérifier que le compte de service GCP déjà configuré dans `.env` a les droits de modification sur le classeur.
3. Configurer les comptes éducateurs et `EDUCATOR_SESSION_SECRET`, puis se connecter avec le compte éducateur `admin` et choisir **Créer l’onglet et copier les numéros**.
4. Les numéros sont copiés dans `Téléphones éducateurs`. Les modifications ultérieures dans l’application écrivent dans cet onglet ; la colonne d’origine de `Joueurs` reste inchangée.

Les numéros du nouvel onglet ne sont pas chiffrés individuellement. Les personnes ayant accès au classeur peuvent les lire. Cette méthode ne supprime pas non plus les numéros en clair présents dans `Joueurs` ni leur historique. Les appels applicatifs utilisent HTTPS et les réponses de l’API de coordonnées ne sont pas mises en cache. Les tentatives de connexion doivent aussi être limitées au niveau du fournisseur d’hébergement, car le compteur local ne couvre pas plusieurs instances.
