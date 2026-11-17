# Sécurité et configuration de production

## Limitation des tentatives de connexion

La connexion utilise Upstash Redis REST pour compter les échecs par compte et par adresse IP sur une fenêtre de 15 minutes. Les identifiants stockés comme clés sont protégés par HMAC. Si le service est indisponible, la connexion échoue temporairement (HTTP 503) plutôt que de désactiver la limitation.

Configurer les deux variables suivantes dans les environnements Vercel **Production** et, si nécessaire, Preview :

- `UPSTASH_REDIS_REST_URL` : URL HTTPS de la base Redis REST Upstash.
- `UPSTASH_REDIS_REST_TOKEN` : jeton REST avec les permissions minimales permettant `EVAL`.

Ne pas committer ces valeurs et ne pas les exposer dans des variables `NEXT_PUBLIC_*`. Après configuration, redéployer puis vérifier une connexion normale et le blocage après cinq échecs pour un compte ou quinze pour une adresse IP.

En développement local sans Upstash, le compteur reste en mémoire et ne convient pas à la production.
La valeur IP provient des en-têtes de proxy ; n’accepter cette configuration qu’avec l’hébergement Vercel prévu et vérifier que le proxy remplace ces en-têtes avant qu’une requête atteigne l’application.

## Google Sheets et secrets

- Restreindre le classeur aux comptes et au compte de service strictement nécessaires ; ne pas le rendre public.
- Vérifier les permissions de partage du classeur, les accès OAuth et les journaux de partage directement dans Google Workspace.
- Conserver les secrets de session, Google et Upstash uniquement dans le gestionnaire de variables d’environnement de l’hébergeur.
- Le callback OAuth Google ne renvoie ni n’enregistre le jeton reçu. Utiliser le compte de service configuré côté serveur ; une valeur `GOOGLE_REFRESH_TOKEN` déjà configurée reste utilisable comme solution de repli.
- Faire tourner tout secret qui aurait été exposé et vérifier les journaux de production après rotation.

Les permissions effectives du projet Vercel, de Google Sheets et la configuration active des variables ne sont pas vérifiables depuis ce dépôt ; un administrateur doit les contrôler dans leurs consoles respectives.

## Checklist des variables de production

Configurer au minimum les variables suivantes dans l’environnement Vercel Production :

- `EDUCATOR_SESSION_SECRET` : secret aléatoire d’au moins 32 octets.
- `EDUCATOR_ACCOUNT_ENCRYPTION_KEY` : clé AES-GCM base64url de exactement 32 octets, utilisée pour les comptes éducateurs et les paramètres WhatsApp.
- `EDUCATOR_PHONE_ENCRYPTION_KEY` : clé AES-GCM base64url de exactement 32 octets, distincte de la clé précédente, utilisée pour les téléphones.
- `EDUCATOR_ACCOUNTS` : tableau JSON bootstrap contenant au moins un compte administrateur.
- `GOOGLE_SHEET_ID` : identifiant du classeur privé.
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` et `GOOGLE_PRIVATE_KEY` : compte de service autorisé à lire et écrire le classeur.
- `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` : limitation distribuée des tentatives de connexion.

`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` et `GOOGLE_REFRESH_TOKEN` constituent une alternative OAuth au compte de service. Ne pas stocker ces valeurs dans le dépôt.

Avant le premier déploiement, vérifier que :

1. les trois onglets protégés sont accessibles au compte de service ;
2. le classeur n’est pas publiquement accessible ;
3. les clés restent inchangées entre les déploiements ;
4. `pnpm test` passe intégralement ;
5. `pnpm build` produit une sortie Next.js sans avertissement de sécurité ;
6. une connexion, une déconnexion, une modification WhatsApp et une modification de présence sont vérifiées sur l’URL de production ;
7. les headers `HSTS`, CSP, `X-Frame-Options` et `Clear-Site-Data` sont présents.

## En-têtes et tests

La configuration Next.js applique CSP, HSTS, anti-clickjacking, `nosniff`, `Referrer-Policy`, `Permissions-Policy` et des restrictions d’isolation du navigateur. Les règles sont vérifiées par `pnpm test`. Lancer `pnpm test` et `pnpm build` avant chaque déploiement.
