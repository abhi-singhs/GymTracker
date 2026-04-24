# GymTracker

GymTracker is a single-user, offline-first gym app built as a Progressive Web App. It helps you:

- log workouts with sets, reps, load, energy, and notes
- track goals for strength, consistency, endurance, or body composition
- generate editable rule-based weekly workout plans
- store everything locally on-device in IndexedDB
- sync a JSON snapshot to your own Google Sheet

## Stack

- React 19 + TypeScript + Vite
- IndexedDB via `idb`
- Manual service worker + manifest for PWA installability
- Google Sheets API for sheet-based sync
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

### Google OAuth in production builds

To bake the Google OAuth credentials into the deployed build so they work on all devices without manual entry, add the following **repository secrets** in GitHub (**Settings → Secrets and variables → Actions**):

| Secret name               | Value                                             |
| ------------------------- | ------------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID`     | Your Google OAuth Web client ID                   |
| `VITE_GOOGLE_CLIENT_SECRET` | Your Google OAuth Web client secret (if required) |

The deploy workflow reads these secrets at build time. Without them the production build ships without OAuth credentials and every device must enter them manually in the Advanced setup panel.

## Google Sheets sync setup

GymTracker sync is intentionally simple: it writes a JSON snapshot into a dedicated Google Sheets tab that **you own**.

1. Create a Google Sheet that you control.
2. Enable the Google Sheets API for your Google Cloud project.
3. Create an OAuth 2.0 **Web application** client in Google Cloud.
4. Configure the OAuth client and either set `VITE_GOOGLE_CLIENT_ID` for the app build and, if Google requires it during token exchange, `VITE_GOOGLE_CLIENT_SECRET`, or keep those values handy for the in-app Advanced setup panel:
    - Add your app origin as an **Authorized JavaScript origin**, for example `http://127.0.0.1:4173` in local development.
    - Add your full app URL without the hash fragment as an **Authorized redirect URI**, for example `http://127.0.0.1:4173/` locally or `https://<owner>.github.io/<repo>/` on GitHub Pages.
    - Preferred: expose the OAuth client ID to the frontend as `VITE_GOOGLE_CLIENT_ID`.
    - Optional when needed: expose the OAuth client secret as `VITE_GOOGLE_CLIENT_SECRET`.
    - Fallback: paste the OAuth client ID and, if Google reports `client_secret` is missing, the OAuth client secret into the Settings page Advanced setup panel when the build does not already provide them.
5. Open the app and paste the full **Google Sheets URL** for the spreadsheet you want GymTracker to use.
6. Click **Login with Google**. GymTracker starts a browser OAuth authorization code flow, requests the `https://www.googleapis.com/auth/spreadsheets` scope, exchanges the returned code for an access token, includes the configured client secret when one is available, and stores that token locally on the device.
7. Use **Push to Google Sheets** to create or update the `GymTracker` tab inside that spreadsheet.
8. Use **Pull from Google Sheets** to bring the latest remote snapshot back to the device.

Google OAuth access tokens are short-lived. Run **Login with Google** again whenever the token expires or Google rejects a sync request.

If you prefer, you can still paste a fresh short-lived access token into the Settings field manually.

If both the local device and the remote sheet change after the last sync, GymTracker surfaces a conflict and lets you keep the local or remote version explicitly.

## PWA behavior

- Installable from supported browsers
- Works offline after the shell is cached
- Keeps the active data model local-first, with sync as a separate action

## Project structure

- `src/App.tsx` — main app shell and product flows
- `src/lib/defaults.ts` — option lists and starter state
- `src/lib/googleOAuth.ts` — browser OAuth authorization-code helpers
- `src/lib/recommendations.ts` — rule-based workout planning
- `src/lib/storage.ts` — IndexedDB persistence and remote snapshot transforms
- `src/lib/googleSheets.ts` — Google Sheets sync helpers
- `public/manifest.webmanifest` + `public/sw.js` — manual PWA assets
