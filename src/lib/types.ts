export const APP_VERSION = 2

export type ThemePreference = 'light' | 'dark' | 'system'

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced'

export type PrimaryGoal = 'strength' | 'body-composition' | 'endurance' | 'consistency'

export type GoalType = PrimaryGoal | 'habit'

export type EquipmentAccess =
  | 'full-gym'
  | 'limited-gym'
  | 'dumbbells'
  | 'bodyweight'

export type RecoveryPriority = 'balanced' | 'performance' | 'mobility'

export type WorkoutFocus =
  | 'full-body'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'conditioning'
  | 'recovery'

export interface Profile {
  name: string
  fitnessLevel: FitnessLevel
  primaryGoal: PrimaryGoal
  trainingDays: string[]
  sessionMinutes: number
  equipmentAccess: EquipmentAccess
  recoveryPriority: RecoveryPriority
  constraints: string
}

export interface Goal {
  id: string
  title: string
  type: GoalType
  targetValue: number
  currentValue: number
  unit: string
  deadline: string
  notes: string
  status: 'active' | 'completed'
  createdAt: string
}

export interface LoggedExercise {
  id: string
  name: string
  sets: number
  reps: number
  loadKg: number
  notes: string
}

export interface WorkoutSession {
  id: string
  title: string
  focus: WorkoutFocus
  completedOn: string
  durationMinutes: number
  energy: 1 | 2 | 3 | 4 | 5
  notes: string
  exercises: LoggedExercise[]
}

export interface PlanExercise {
  id: string
  name: string
  setsText: string
  intensity: string
  cue: string
}

export interface PlanDay {
  id: string
  day: string
  focus: string
  intention: string
  durationMinutes: number
  exercises: PlanExercise[]
  recoveryNote: string
}

export interface WorkoutPlan {
  id: string
  createdAt: string
  summary: string
  rationale: string[]
  generatedFromFingerprint: string
  days: PlanDay[]
}

export interface RemoteSnapshot {
  version: number
  exportedAt: string
  themePreference: ThemePreference
  profile: Profile
  goals: Goal[]
  workouts: WorkoutSession[]
  activePlan: WorkoutPlan
}

export interface SyncConflict {
  detectedAt: string
  remoteExportedAt: string
  remoteSnapshot: RemoteSnapshot
}

export interface SyncSettings {
  spreadsheetUrl: string
  spreadsheetId: string
  sheetName: string
  clientId: string
  clientSecret: string
  accessToken: string
  tokenExpiresAt: string | null
  lastSyncedAt: string | null
  lastSyncedFingerprint: string | null
  pendingPush: boolean
  lastError: string | null
  conflict: SyncConflict | null
}

export interface AppMetadata {
  createdAt: string
  updatedAt: string
}

export interface PersistedAppState {
  version: number
  themePreference: ThemePreference
  profile: Profile
  goals: Goal[]
  workouts: WorkoutSession[]
  activePlan: WorkoutPlan
  sync: SyncSettings
  metadata: AppMetadata
}
