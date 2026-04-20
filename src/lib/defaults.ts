import { generateWorkoutPlan } from './recommendations'
import { DEFAULT_GOOGLE_SYNC_SHEET_NAME } from './googleSheetsSetup'
import type {
  EquipmentAccess,
  FitnessLevel,
  GoalType,
  PersistedAppState,
  PrimaryGoal,
  RecoveryPriority,
  ThemePreference,
  WorkoutFocus,
} from './types'
import { APP_VERSION } from './types'

const DEFAULT_PROFILE = {
  name: 'Athlete',
  fitnessLevel: 'intermediate' as FitnessLevel,
  primaryGoal: 'strength' as PrimaryGoal,
  trainingDays: ['Mon', 'Wed', 'Fri', 'Sat'],
  sessionMinutes: 60,
  equipmentAccess: 'full-gym' as EquipmentAccess,
  recoveryPriority: 'balanced' as RecoveryPriority,
  constraints: '',
}

export const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'Auto' },
]

export const FITNESS_LEVEL_OPTIONS: Array<{ value: FitnessLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export const PRIMARY_GOAL_OPTIONS: Array<{ value: PrimaryGoal; label: string }> = [
  { value: 'strength', label: 'Strength' },
  { value: 'body-composition', label: 'Body composition' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'consistency', label: 'Consistency' },
]

export const GOAL_TYPE_OPTIONS: Array<{ value: GoalType; label: string }> = [
  { value: 'strength', label: 'Strength' },
  { value: 'body-composition', label: 'Body composition' },
  { value: 'endurance', label: 'Endurance' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'habit', label: 'Habit' },
]

export const EQUIPMENT_OPTIONS: Array<{ value: EquipmentAccess; label: string }> = [
  { value: 'full-gym', label: 'Full gym' },
  { value: 'limited-gym', label: 'Limited gym' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bodyweight', label: 'Bodyweight' },
]

export const RECOVERY_OPTIONS: Array<{ value: RecoveryPriority; label: string }> = [
  { value: 'balanced', label: 'Balanced' },
  { value: 'performance', label: 'Performance first' },
  { value: 'mobility', label: 'Mobility focus' },
]

export const WORKOUT_FOCUS_OPTIONS: Array<{ value: WorkoutFocus; label: string }> = [
  { value: 'full-body', label: 'Full body' },
  { value: 'upper', label: 'Upper' },
  { value: 'lower', label: 'Lower' },
  { value: 'push', label: 'Push' },
  { value: 'pull', label: 'Pull' },
  { value: 'legs', label: 'Legs' },
  { value: 'conditioning', label: 'Conditioning' },
  { value: 'recovery', label: 'Recovery' },
]

export const WEEKDAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function createInitialState(): PersistedAppState {
  const now = new Date().toISOString()

  return {
    version: APP_VERSION,
    themePreference: 'system',
    profile: DEFAULT_PROFILE,
    goals: [],
    workouts: [],
    activePlan: generateWorkoutPlan(DEFAULT_PROFILE, []),
    sync: {
      spreadsheetUrl: '',
      spreadsheetId: '',
      sheetName: DEFAULT_GOOGLE_SYNC_SHEET_NAME,
      clientId: '',
      accessToken: '',
      tokenExpiresAt: null,
      lastSyncedAt: null,
      lastSyncedFingerprint: null,
      pendingPush: false,
      lastError: null,
      conflict: null,
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
    },
  }
}
