# ScrapeBot Backend (Node + Playwright)

Backend Express qui pilote Playwright pour le dashboard ScrapeBot (frontend Lovable).

## Installation

```bash
cd backend
npm install
npm run install:browsers   # télécharge Chromium
```

## Lancer

```bash
npm run dev      # avec --watch
# ou
npm start
```

Par défaut : `http://localhost:4000`

Variables d'env :
- `PORT` (défaut 4000)
- `API_KEY` (optionnel, ajoute `Authorization: Bearer <key>` côté frontend)
- `DATA_DIR` (défaut `./data`) — dossier des JSON sauvegardés

## Endpoints

| Méthode | Path | Description |
|---|---|---|
| GET  | `/api/status` | Statut + nombre de tâches |
| GET  | `/api/tasks` | Liste toutes les tâches |
| POST | `/api/tasks` | Crée + lance une tâche (`TaskConfig`) |
| GET  | `/api/tasks/:id` | Détail d'une tâche |
| POST | `/api/tasks/:id/stop` | Arrête une tâche en cours |
| DEL  | `/api/tasks/:id` | Supprime |
| GET  | `/api/logs?since=ISO` | Logs récents (poll) |

## Sauvegarde

Chaque résultat est écrit dans `./data/<taskId>.json`.

## Frontend

Dans Lovable, ouvre **Paramètres** et règle :
- URL backend : `http://localhost:4000`
- Clé API si configurée

## CORS

Le serveur autorise `*` par défaut. En prod, restreins via la variable
`CORS_ORIGIN`.

## Étendre

- Proxys : passe `proxy` à `chromium.launch({ proxy: { server } })` dans `bot.js`.
- Login/session : ajoute un step `page.fill / page.click` avant le scraping et
  réutilise `context.storageState()` pour persister la session.
- Règles d'extraction : `TaskConfig.rules` est déjà supporté côté API,
  étends `extract()` dans `bot.js` selon ton besoin.
- Scheduler : ajoute `node-cron` et invoque `runTask()` périodiquement.

## Déploiement

Railway / Render / VPS / Fly.io fonctionnent. Évite les runtimes serverless
edge — Playwright nécessite Chromium et un système de fichiers.