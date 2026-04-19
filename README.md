# GymTracker

GymTracker is a single-user, offline-first gym app built as a Progressive Web App. It helps you:

- log workouts with sets, reps, load, energy, and notes
- track goals for strength, consistency, endurance, or body composition
- generate editable rule-based weekly workout plans
- store everything locally on-device in IndexedDB
- sync a JSON snapshot to your own private GitHub repository

## Stack

- React 19 + TypeScript + Vite
- IndexedDB via `idb`
- Manual service worker + manifest for PWA installability
- GitHub Contents API for private-repo sync
- Vitest for focused logic tests

## Local development

```bash
npm install
npm run dev
```

## Quality checks

```bash
npm run build
npm run lint
npm run test
```

## GitHub Pages deployment

GymTracker includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that builds and publishes the app to GitHub Pages on every push to `main`, and also supports manual runs from the Actions tab.

1. In GitHub, open **Settings** -> **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Push to `main` or trigger **Deploy to GitHub Pages** manually.
4. The site will publish at `https://<owner>.github.io/<repo>/`.

The Vite base path is derived automatically during GitHub Actions builds so project Pages deployments load assets, the manifest, and the service worker from the correct repository subpath.

## GitHub sync setup

GymTracker sync is intentionally simple: it writes a JSON file to a private repository that **you own**.

1. Create a private GitHub repository.
2. Create a personal access token that can read and write repository contents.
3. Open the app and fill in:
   - **Owner**: your GitHub username or org
   - **Repository**: the private repo name
   - **Branch**: usually `main`
   - **Path**: where the JSON snapshot should live, for example `data/gymtracker.json`
   - **Personal access token**
4. Use **Push local snapshot** to create or update the remote file.
5. Use **Pull from GitHub** to bring the latest remote snapshot back to the device.

If both the local device and the remote repo change after the last sync, GymTracker surfaces a conflict and lets you keep the local or remote version explicitly.

## PWA behavior

- Installable from supported browsers
- Works offline after the shell is cached
- Keeps the active data model local-first, with sync as a separate action

## Project structure

- `src/App.tsx` — main app shell and product flows
- `src/lib/defaults.ts` — option lists and starter state
- `src/lib/recommendations.ts` — rule-based workout planning
- `src/lib/storage.ts` — IndexedDB persistence and remote snapshot transforms
- `src/lib/github.ts` — GitHub sync helpers
- `public/manifest.webmanifest` + `public/sw.js` — manual PWA assets
