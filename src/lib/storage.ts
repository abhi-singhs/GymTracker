import { openDB } from 'idb'
import { createInitialState } from './defaults'
import { buildGoogleSheetUrl, parseGoogleSheetUrl } from './googleSheetsSetup'
import { generateWorkoutPlan, getPlanFingerprint } from './recommendations'
import type {
  Goal,
  PersistedAppState,
  Profile,
  RemoteSnapshot,
  SyncConflict,
  SyncSettings,
  ThemePreference,
  WorkoutPlan,
  WorkoutSession,
} from './types'
import { APP_VERSION } from './types'
import { snapshotFingerprint } from './utils'

const DB_NAME = 'gymtracker-db'
const STORE_NAME = 'gymtracker-store'
const STATE_KEY = 'app-state'

let dbPromise: ReturnType<typeof openDB> | null = null

function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME)
        }
      },
    })
  }

  return dbPromise
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null
}

function asProfile(record: unknown, fallback: Profile): Profile {
  if (!isRecord(record)) {
    return fallback
  }

  return {
    ...fallback,
    ...record,
    trainingDays: Array.isArray(record.trainingDays)
      ? record.trainingDays.filter((day): day is string => typeof day === 'string')
      : fallback.trainingDays,
  }
}

function asGoals(record: unknown): Goal[] {
  if (!Array.isArray(record)) {
    return []
  }

  return record.filter((entry): entry is Goal => isRecord(entry) && typeof entry.id === 'string') as Goal[]
}

function asWorkouts(record: unknown): WorkoutSession[] {
  if (!Array.isArray(record)) {
    return []
  }

  return record.filter(
    (entry): entry is WorkoutSession => isRecord(entry) && typeof entry.id === 'string',
  ) as WorkoutSession[]
}

function asPlan(record: unknown, profile: Profile, goals: Goal[]): WorkoutPlan {
  if (!isRecord(record) || !Array.isArray(record.days) || record.days.length === 0) {
    return generateWorkoutPlan(profile, goals)
  }

  return {
    ...generateWorkoutPlan(profile, goals),
    ...record,
    days: record.days as WorkoutPlan['days'],
    generatedFromFingerprint:
      typeof record.generatedFromFingerprint === 'string'
        ? record.generatedFromFingerprint
        : getPlanFingerprint(profile, goals),
  }
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

interface NormalizedSnapshotPayload {
  version: number
  themePreference: ThemePreference
  profile: Profile
  goals: Goal[]
  workouts: WorkoutSession[]
  activePlan: WorkoutPlan
}

function normalizeSnapshotPayload(
  record: UnknownRecord,
  seed: PersistedAppState,
): NormalizedSnapshotPayload {
  const profile = asProfile(record.profile, seed.profile)
  const goals = asGoals(record.goals)
  const workouts = asWorkouts(record.workouts)
  const activePlan = asPlan(record.activePlan, profile, goals)

  return {
    version: typeof record.version === 'number' ? record.version : APP_VERSION,
    themePreference: isThemePreference(record.themePreference)
      ? record.themePreference
      : seed.themePreference,
    profile,
    goals,
    workouts,
    activePlan,
  }
}

function asConflict(record: unknown, seed: PersistedAppState): SyncConflict | null {
  if (!isRecord(record) || !isRecord(record.remoteSnapshot)) {
    return null
  }

  const remote = normalizeSnapshotPayload(record.remoteSnapshot, seed)
  const exportedAt =
    typeof record.remoteSnapshot.exportedAt === 'string'
      ? record.remoteSnapshot.exportedAt
      : seed.metadata.updatedAt

  return {
    detectedAt: typeof record.detectedAt === 'string' ? record.detectedAt : seed.metadata.updatedAt,
    remoteExportedAt:
      typeof record.remoteExportedAt === 'string' ? record.remoteExportedAt : exportedAt,
    remoteSnapshot: {
      version: remote.version,
      exportedAt,
      themePreference: remote.themePreference,
      profile: remote.profile,
      goals: remote.goals,
      workouts: remote.workouts,
      activePlan: remote.activePlan,
    },
  }
}

function asSync(
  record: unknown,
  fallback: SyncSettings,
  seed: PersistedAppState,
): SyncSettings {
  if (!isRecord(record)) {
    return fallback
  }

  const spreadsheetUrl =
    typeof record.spreadsheetUrl === 'string'
      ? record.spreadsheetUrl
      : typeof record.spreadsheetId === 'string' && record.spreadsheetId.trim()
        ? buildGoogleSheetUrl(record.spreadsheetId.trim())
        : ''
  const parsedSpreadsheet = parseGoogleSheetUrl(spreadsheetUrl)

  return {
    spreadsheetUrl,
    spreadsheetId: parsedSpreadsheet?.spreadsheetId ?? (
      typeof record.spreadsheetId === 'string' ? record.spreadsheetId : ''
    ),
    sheetName:
      typeof record.sheetName === 'string' && record.sheetName.trim()
        ? record.sheetName
        : fallback.sheetName,
    clientId: typeof record.clientId === 'string' ? record.clientId : '',
    accessToken: typeof record.accessToken === 'string' ? record.accessToken : '',
    tokenExpiresAt: typeof record.tokenExpiresAt === 'string' ? record.tokenExpiresAt : null,
    lastSyncedAt: typeof record.lastSyncedAt === 'string' ? record.lastSyncedAt : null,
    lastSyncedFingerprint:
      typeof record.lastSyncedFingerprint === 'string' ? record.lastSyncedFingerprint : null,
    pendingPush: record.pendingPush === true,
    lastError: typeof record.lastError === 'string' ? record.lastError : null,
    conflict: asConflict(record.conflict, seed),
  }
}

export function migratePersistedState(record: unknown): PersistedAppState {
  if (!isRecord(record)) {
    throw new Error('Stored GymTracker data is invalid. Reset local data to continue.')
  }

  const seed = createInitialState()
  const normalized = normalizeSnapshotPayload(record, seed)

  return {
    ...seed,
    ...normalized,
    version: APP_VERSION,
    sync: asSync(record.sync, seed.sync, seed),
    metadata: {
      ...seed.metadata,
      ...(isRecord(record.metadata) ? record.metadata : {}),
    },
  }
}

export async function loadAppState() {
  const database = await getDatabase()
  const stored = await database.get(STORE_NAME, STATE_KEY)

  if (stored === undefined) {
    return createInitialState()
  }

  return migratePersistedState(stored)
}

export async function saveAppState(state: PersistedAppState) {
  const database = await getDatabase()
  await database.put(STORE_NAME, state, STATE_KEY)
}

export async function clearAppState() {
  const database = await getDatabase()
  await database.delete(STORE_NAME, STATE_KEY)
}

export function createRemoteSnapshot(state: PersistedAppState): RemoteSnapshot {
  return {
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    themePreference: state.themePreference,
    profile: state.profile,
    goals: state.goals,
    workouts: state.workouts,
    activePlan: state.activePlan,
  }
}

export function remoteSnapshotFingerprint(snapshot: RemoteSnapshot) {
  return snapshotFingerprint({
    version: snapshot.version,
    themePreference: snapshot.themePreference,
    profile: snapshot.profile,
    goals: snapshot.goals,
    workouts: snapshot.workouts,
    activePlan: snapshot.activePlan,
  })
}

export function applyRemoteSnapshot(
  currentState: PersistedAppState,
  snapshot: RemoteSnapshot,
) {
  const merged = migratePersistedState({
    ...currentState,
    version: snapshot.version,
    themePreference: snapshot.themePreference,
    profile: snapshot.profile,
    goals: snapshot.goals,
    workouts: snapshot.workouts,
    activePlan: snapshot.activePlan,
  })
  const now = new Date().toISOString()

  return {
    ...merged,
    sync: {
      ...currentState.sync,
      lastSyncedAt: now,
      lastSyncedFingerprint: remoteSnapshotFingerprint(snapshot),
      pendingPush: false,
      lastError: null,
      conflict: null,
    },
    metadata: {
      ...merged.metadata,
      updatedAt: now,
    },
  }
}
