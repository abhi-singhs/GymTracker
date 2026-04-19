# GymTracker Copilot instructions

## Commands
- `npm run dev` starts the Vite dev server.
- `npm run build` runs the TypeScript build (`tsc -b`) and then creates the Vite production bundle.
- `npm run lint` runs ESLint across the TypeScript/React source.
- `npm run test` runs the Vitest suite.
- `npm run test -- src/lib/recommendations.test.ts` runs the current test file only.
- `npm run test -- src/lib/recommendations.test.ts -t "recognizes pressing sessions"` runs a single named test.

## High-level architecture
- This is a single-user, offline-first React 19 + TypeScript + Vite PWA. `src/main.tsx` wraps the app in `HashRouter`, loads the font stack, and only registers the manual service worker in production. In development it explicitly unregisters service workers to avoid stale cached shells.
- `src/App.tsx` is now the main orchestrator rather than the full UI surface. It owns persisted mutations, derived app state, and sync/conflict flows, then delegates rendering to `src/components/`, route-page components in `src/components/pages/`, and reusable hooks in `src/hooks/`.
- `src/lib/types.ts` is the schema contract. `PersistedAppState` is the local IndexedDB shape, and `RemoteSnapshot` is the GitHub export/import shape.
- `src/lib/defaults.ts` seeds the starter state and shared option lists. The initial plan is generated here via `generateWorkoutPlan`.
- `src/lib/storage.ts` owns IndexedDB access, persisted-state migration, remote snapshot creation/application, and fingerprint helpers. Local storage is the source of truth; sync imports and exports go through this layer.
- `src/lib/recommendations.ts` is the rule-based planner. It derives weekly plans from the profile and active goals, and stamps each plan with `generatedFromFingerprint` so the UI can tell when a plan is stale after profile/goal edits.
- `src/lib/github.ts` uses the GitHub Contents API to read and write one JSON snapshot file in the user’s private repo. `App.tsx` still compares local and remote fingerprints and forces an explicit local-vs-remote choice instead of silently merging.
- `public/sw.js` and `public/manifest.webmanifest` are a manual PWA setup. The service worker caches the shell and falls back to `/` for navigation requests.

## Key conventions
- Keep persisted and synced data centered on `PersistedAppState` and `RemoteSnapshot`. When adding a new field, update `src/lib/types.ts`, seed it in `createInitialState()`, and handle it in `migratePersistedState()`.
- Use the `updateState()` helper in `src/App.tsx` for persisted state changes. It centralizes `metadata.updatedAt`, clears sync errors, and marks `sync.pendingPush` when a change should require a future GitHub push.
- Sync credential edits intentionally use `updateState(..., { markDirty: false })`. Changing repo owner/repo/branch/path/token should not itself mark workout data as dirty.
- Do not compare remote snapshots with raw JSON or the `exportedAt` timestamp. Use `remoteSnapshotFingerprint()` / `snapshotFingerprint()` instead; fingerprint equality is intentionally stable across different export times.
- Keep `getPlanFingerprint()` and `generateWorkoutPlan()` aligned. The app uses `activePlan.generatedFromFingerprint !== getPlanFingerprint(profile, goals)` to decide whether the plan needs a refresh.
- IndexedDB initialization is lazy in `src/lib/storage.ts`. Do not move `openDB()` back to module scope; Vitest imports this code in Node where `indexedDB` is not available at evaluation time.
- The app’s navigation contract is hash-based routing plus the shared `NAV_TABS` array in `src/lib/app-navigation.ts`. Update `NAV_TABS` if you add or rename pages so desktop and mobile navigation stay in sync.
- UI changes should preserve the current design direction from `.impeccable.md`: calm, focused, warm, and editorial rather than loud, gamified, or neon-fitness styled.
- Playwright MCP is already configured in the local Copilot CLI environment (`~/.copilot/mcp-config.json`). For routed UI, responsive layout, or PWA-shell changes, prefer a real browser check with Playwright over static code inspection alone.
- Current automated coverage lives in `src/lib/recommendations.test.ts` and focuses on planner output, focus inference, and snapshot fingerprint stability. Changes to planner inputs or sync fingerprint behavior should usually update that file.
