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

## En-têtes et tests

La configuration Next.js applique CSP, HSTS, anti-clickjacking, `nosniff`, `Referrer-Policy`, `Permissions-Policy` et des restrictions d’isolation du navigateur. Les règles sont vérifiées par `pnpm test`. Lancer `pnpm test` et `pnpm build` avant chaque déploiement.
