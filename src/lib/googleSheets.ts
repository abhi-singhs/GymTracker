import type {
  Goal,
  GoalType,
  LoggedExercise,
  LoggedSet,
  LoggedSetKind,
  PlanDay,
  PlanExercise,
  PrimaryGoal,
  Profile,
  RemoteSnapshot,
  SyncSettings,
  ThemePreference,
  WeightEntry,
  WorkoutFocus,
  WorkoutPlan,
  WorkoutSession,
} from './types'
import { APP_VERSION } from './types'
import { migratePersistedState } from './storage'
import { workoutVolume } from './utils'

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const LEGACY_SHEET_MARKER = 'gymtracker-snapshot'
const TABULAR_SHEET_MARKER = 'gymtracker-tabular-v1'
const MAX_SHEET_TITLE_LENGTH = 100
const YES_VALUE = 'Yes'
const NO_VALUE = 'No'

const SUMMARY_HEADERS = ['Section', 'Field', 'Value']
const GOAL_HEADERS = [
  'Goal ID',
  'Title',
  'Type',
  'Target Value',
  'Current Value',
  'Unit',
  'Deadline',
  'Status',
  'Notes',
  'Created At',
]
const WORKOUT_HEADERS = [
  'Workout ID',
  'Title',
  'Focus',
  'Completed On',
  'Duration (min)',
  'Energy',
  'Exercise Count',
  'Set Count',
  'Volume (kg)',
  'Notes',
]
const WORKOUT_SET_HEADERS = [
  'Workout ID',
  'Workout Title',
  'Exercise ID',
  'Exercise #',
  'Exercise Name',
  'Exercise Notes',
  'Set ID',
  'Set #',
  'Set Type',
  'Load (kg)',
  'Reps',
  'Completed',
]
const WEIGHT_HEADERS = ['Entry ID', 'Recorded On', 'Weight (kg)', 'BMI', 'Notes']
const PLAN_HEADERS = ['Field', 'Value']
const PLAN_DAY_HEADERS = ['Day ID', 'Day #', 'Day', 'Focus', 'Intention', 'Duration (min)', 'Recovery Note']
const PLAN_EXERCISE_HEADERS = ['Day ID', 'Day', 'Exercise ID', 'Exercise #', 'Name', 'Sets', 'Intensity', 'Cue']

type SheetCell = string | number | boolean | null

interface SheetMetadataResponse {
  sheets?: Array<{
    properties?: {
      title?: string
    }
  }>
}

interface SheetValuesResponse {
  values?: SheetCell[][]
}

interface SheetBatchValuesResponse {
  valueRanges?: SheetValuesResponse[]
}

interface SyncSheetTitles {
  summary: string
  goals: string
  workouts: string
  workoutSets: string
  weights: string
  plan: string
  planDays: string
  planExercises: string
}

interface ParsedWorkoutRow {
  id: string
  title: string
  focus: WorkoutFocus
  completedOn: string
  durationMinutes: number
  energy: 1 | 2 | 3 | 4 | 5
  notes: string
}

interface ParsedWorkoutSetRow {
  workoutId: string
  exerciseId: string
  exerciseOrder: number
  exerciseName: string
  exerciseNotes: string
  setOrder: number
  set: LoggedSet
}

interface ParsedPlanDayRow {
  order: number
  day: PlanDay
}

interface ParsedPlanExerciseRow {
  dayId: string
  order: number
  exercise: PlanExercise
}

export class GoogleSheetsSyncError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GoogleSheetsSyncError'
    this.status = status
  }
}

function hasRequiredFields(snapshot: unknown): snapshot is RemoteSnapshot {
  if (typeof snapshot !== 'object' || snapshot === null) {
    return false
  }

  const record = snapshot as Record<string, unknown>
  return (
    typeof record.exportedAt === 'string' &&
    typeof record.profile === 'object' &&
    Array.isArray(record.goals) &&
    Array.isArray(record.workouts) &&
    typeof record.activePlan === 'object'
  )
}

function normalizeRemoteSnapshot(snapshot: unknown): RemoteSnapshot {
  const migrated = migratePersistedState(snapshot)
  const record = snapshot as Record<string, unknown>
  const exportedAt =
    typeof record.exportedAt === 'string' && record.exportedAt.trim()
      ? record.exportedAt
      : migrated.metadata.updatedAt

  return {
    version: typeof record.version === 'number' ? record.version : APP_VERSION,
    exportedAt,
    themePreference: migrated.themePreference,
    profile: migrated.profile,
    goals: migrated.goals,
    workouts: migrated.workouts,
    weightEntries: migrated.weightEntries,
    activePlan: migrated.activePlan,
  }
}

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`
}

function toSheetCell(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

function rowHasData(row: SheetCell[] | undefined) {
  return Boolean(row?.some((cell) => toSheetCell(cell).trim().length > 0))
}

function normalizeSheetBaseName(sheetName: string) {
  const trimmed = sheetName.trim()
  return trimmed || 'GymTracker'
}

function appendSheetSuffix(base: string, suffix: string) {
  if (!suffix) {
    return base.slice(0, MAX_SHEET_TITLE_LENGTH)
  }

  const suffixText = ` ${suffix}`
  const baseLimit = Math.max(1, MAX_SHEET_TITLE_LENGTH - suffixText.length)
  return `${base.slice(0, baseLimit)}${suffixText}`
}

function getSyncSheetTitles(sheetName: string): SyncSheetTitles {
  const base = normalizeSheetBaseName(sheetName)

  return {
    summary: appendSheetSuffix(base, ''),
    goals: appendSheetSuffix(base, 'Goals'),
    workouts: appendSheetSuffix(base, 'Workouts'),
    workoutSets: appendSheetSuffix(base, 'Workout Sets'),
    weights: appendSheetSuffix(base, 'Weights'),
    plan: appendSheetSuffix(base, 'Plan'),
    planDays: appendSheetSuffix(base, 'Plan Days'),
    planExercises: appendSheetSuffix(base, 'Plan Exercises'),
  }
}

function buildSpreadsheetUrl(settings: SyncSettings, suffix = '', query = '') {
  const base = `${SHEETS_API_BASE}/${encodeURIComponent(settings.spreadsheetId)}${suffix}`
  return query ? `${base}?${query}` : base
}

function buildHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function buildBatchGetUrl(
  settings: SyncSettings,
  ranges: Array<{ sheetTitle: string; range: string }>,
) {
  const params = new URLSearchParams()

  ranges.forEach(({ sheetTitle, range }) => {
    params.append('ranges', `${quoteSheetName(sheetTitle)}!${range}`)
  })

  return buildSpreadsheetUrl(settings, '/values:batchGet', params.toString())
}

function buildValueBatchUpdateUrl(settings: SyncSettings) {
  return buildSpreadsheetUrl(settings, '/values:batchUpdate')
}

function buildValueBatchClearUrl(settings: SyncSettings) {
  return buildSpreadsheetUrl(settings, '/values:batchClear')
}

async function buildGoogleSheetsError(response: Response, fallbackMessage: string) {
  if (response.status === 401) {
    return new GoogleSheetsSyncError(
      'Google rejected the stored access token. Authorize with Google again or paste a fresh token.',
      response.status,
    )
  }

  const rawBody = await response.text()

  if (!rawBody) {
    return new GoogleSheetsSyncError(fallbackMessage, response.status)
  }

  let detail = rawBody.trim()

  try {
    const parsed = JSON.parse(rawBody) as {
      error?: {
        message?: string
      }
    }

    if (typeof parsed.error?.message === 'string') {
      detail = parsed.error.message
    }
  } catch {
    // Use the raw body when Google does not return a JSON error payload.
  }

  return new GoogleSheetsSyncError(`${fallbackMessage} ${detail}`.trim(), response.status)
}

async function getSheetTitles(settings: SyncSettings) {
  const response = await fetch(
    buildSpreadsheetUrl(settings, '', 'fields=sheets.properties.title'),
    {
      headers: buildHeaders(settings.accessToken),
    },
  )

  if (!response.ok) {
    throw await buildGoogleSheetsError(
      response,
      'Unable to access the target Google spreadsheet. Check the Google Sheets URL and login token.',
    )
  }

  const payload = (await response.json()) as SheetMetadataResponse

  return (
    payload.sheets
      ?.map((sheet) => sheet.properties?.title)
      .filter((title): title is string => typeof title === 'string') ?? []
  )
}

async function ensureSyncSheetsExist(settings: SyncSettings) {
  const titles = await getSheetTitles(settings)
  const syncSheets = getSyncSheetTitles(settings.sheetName)
  const missing = Object.values(syncSheets).filter((title) => !titles.includes(title))

  if (missing.length === 0) {
    return syncSheets
  }

  const response = await fetch(buildSpreadsheetUrl(settings, ':batchUpdate'), {
    method: 'POST',
    headers: buildHeaders(settings.accessToken),
    body: JSON.stringify({
      requests: missing.map((title) => ({
        addSheet: {
          properties: {
            title,
          },
        },
      })),
    }),
  })

  if (!response.ok) {
    throw await buildGoogleSheetsError(
      response,
      'Unable to create the Google Sheets tabs for GymTracker sync.',
    )
  }

  return syncSheets
}

async function getSheetValues(
  settings: SyncSettings,
  ranges: Array<{ sheetTitle: string; range: string }>,
) {
  const response = await fetch(buildBatchGetUrl(settings, ranges), {
    headers: buildHeaders(settings.accessToken),
  })

  if (!response.ok) {
    throw await buildGoogleSheetsError(
      response,
      'Unable to read the Google Sheets snapshot. Check the target spreadsheet and Google login token.',
    )
  }

  const payload = (await response.json()) as SheetBatchValuesResponse
  const valuesBySheet = new Map<string, SheetCell[][] | undefined>()

  ranges.forEach(({ sheetTitle }, index) => {
    valuesBySheet.set(sheetTitle, payload.valueRanges?.[index]?.values)
  })

  return valuesBySheet
}

function parseLegacySnapshot(values: SheetCell[][] | undefined) {
  if (!values || values.length === 0) {
    return {
      snapshot: null,
      chunkCount: 0,
    }
  }

  const metadataRow = values[0] ?? []
  const hasMetadata = metadataRow.some((cell) => toSheetCell(cell).trim().length > 0)

  if (!hasMetadata) {
    return {
      snapshot: null,
      chunkCount: 0,
    }
  }

  if (toSheetCell(metadataRow[0]) !== LEGACY_SHEET_MARKER) {
    throw new GoogleSheetsSyncError(
      'The selected Google Sheets tab already contains data that is not in GymTracker sync format.',
    )
  }

  const chunkCount = Number.parseInt(toSheetCell(metadataRow[2]), 10)

  if (!Number.isInteger(chunkCount) || chunkCount < 1) {
    throw new GoogleSheetsSyncError('The Google Sheets sync metadata is incomplete.')
  }

  const chunkRows = values.slice(1, chunkCount + 1)

  if (
    chunkRows.length < chunkCount ||
    chunkRows.some((row) => toSheetCell(row?.[0]).length === 0)
  ) {
    throw new GoogleSheetsSyncError('The Google Sheets snapshot is incomplete.')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(chunkRows.map((row) => toSheetCell(row[0])).join(''))
  } catch {
    throw new GoogleSheetsSyncError('The Google Sheets snapshot is not valid JSON.')
  }

  if (!hasRequiredFields(parsed)) {
    throw new GoogleSheetsSyncError('The Google Sheets tab does not contain valid GymTracker data.')
  }

  return {
    snapshot: normalizeRemoteSnapshot(parsed),
    chunkCount,
  }
}

function getSummaryLookup(values: SheetCell[][] | undefined) {
  const rows = values?.slice(2).filter(rowHasData) ?? []
  const lookup = new Map<string, string>()

  rows.forEach((row) => {
    const section = toSheetCell(row[0]).trim()
    const field = toSheetCell(row[1]).trim()

    if (!section || !field) {
      return
    }

    lookup.set(`${section}\u0000${field}`, toSheetCell(row[2]))
  })

  return lookup
}

function getLookupValue(
  lookup: Map<string, string>,
  section: string,
  field: string,
  options: { required?: boolean } = {},
) {
  const value = lookup.get(`${section}\u0000${field}`)

  if (value === undefined) {
    if (options.required) {
      throw new GoogleSheetsSyncError(`The Google Sheets summary is missing ${section} / ${field}.`)
    }

    return ''
  }

  return value
}

function parseNumberCell(value: string, label: string) {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    throw new GoogleSheetsSyncError(`The Google Sheets value for ${label} is not a valid number.`)
  }

  return parsed
}

function parseIntegerCell(value: string, label: string) {
  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed)) {
    throw new GoogleSheetsSyncError(`The Google Sheets value for ${label} is not a valid whole number.`)
  }

  return parsed
}

function parseThemePreference(value: string): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value
  }

  throw new GoogleSheetsSyncError('The Google Sheets summary contains an invalid theme preference.')
}

function parsePrimaryGoal(value: string): PrimaryGoal {
  if (
    value === 'strength' ||
    value === 'body-composition' ||
    value === 'endurance' ||
    value === 'consistency'
  ) {
    return value
  }

  throw new GoogleSheetsSyncError('The Google Sheets summary contains an invalid primary goal.')
}

function parseGoalType(value: string): GoalType {
  if (
    value === 'strength' ||
    value === 'body-composition' ||
    value === 'endurance' ||
    value === 'consistency' ||
    value === 'habit' ||
    value === 'weight'
  ) {
    return value
  }

  throw new GoogleSheetsSyncError('The Google Sheets goals table contains an invalid goal type.')
}

function parseWorkoutFocus(value: string): WorkoutFocus {
  if (
    value === 'full-body' ||
    value === 'upper' ||
    value === 'lower' ||
    value === 'push' ||
    value === 'pull' ||
    value === 'legs' ||
    value === 'conditioning' ||
    value === 'recovery'
  ) {
    return value
  }

  throw new GoogleSheetsSyncError('The Google Sheets workouts table contains an invalid workout focus.')
}

function parseLoggedSetKind(value: string): LoggedSetKind {
  const normalized = value.trim().toLowerCase()

  if (normalized === 'working') {
    return 'working'
  }

  if (normalized === 'warm-up' || normalized === 'warmup') {
    return 'warmup'
  }

  if (normalized === 'drop set' || normalized === 'drop') {
    return 'drop'
  }

  if (normalized === 'failure') {
    return 'failure'
  }

  throw new GoogleSheetsSyncError('The Google Sheets workout sets table contains an invalid set type.')
}

function parseBooleanCell(value: string, label: string) {
  const normalized = value.trim().toLowerCase()

  if (normalized === YES_VALUE.toLowerCase() || normalized === 'true') {
    return true
  }

  if (normalized === NO_VALUE.toLowerCase() || normalized === 'false' || normalized === '') {
    return false
  }

  throw new GoogleSheetsSyncError(`The Google Sheets value for ${label} is not a valid yes/no value.`)
}

function parseProfile(lookup: Map<string, string>): Profile {
  const fitnessLevel = getLookupValue(lookup, 'Profile', 'Fitness Level', { required: true })
  const equipmentAccess = getLookupValue(lookup, 'Profile', 'Equipment Access', { required: true })
  const recoveryPriority = getLookupValue(lookup, 'Profile', 'Recovery Priority', { required: true })
  const heightCm = getLookupValue(lookup, 'Profile', 'Height Cm')

  if (
    fitnessLevel !== 'beginner' &&
    fitnessLevel !== 'intermediate' &&
    fitnessLevel !== 'advanced'
  ) {
    throw new GoogleSheetsSyncError('The Google Sheets summary contains an invalid fitness level.')
  }

  if (
    equipmentAccess !== 'full-gym' &&
    equipmentAccess !== 'limited-gym' &&
    equipmentAccess !== 'dumbbells' &&
    equipmentAccess !== 'bodyweight'
  ) {
    throw new GoogleSheetsSyncError('The Google Sheets summary contains an invalid equipment access value.')
  }

  if (
    recoveryPriority !== 'balanced' &&
    recoveryPriority !== 'performance' &&
    recoveryPriority !== 'mobility'
  ) {
    throw new GoogleSheetsSyncError('The Google Sheets summary contains an invalid recovery priority.')
  }

  return {
    name: getLookupValue(lookup, 'Profile', 'Name'),
    fitnessLevel,
    primaryGoal: parsePrimaryGoal(
      getLookupValue(lookup, 'Profile', 'Primary Goal', { required: true }),
    ),
    trainingDays: getLookupValue(lookup, 'Profile', 'Training Days')
      .split(',')
      .map((day) => day.trim())
      .filter(Boolean),
    sessionMinutes: parseNumberCell(
      getLookupValue(lookup, 'Profile', 'Session Minutes', { required: true }),
      'Profile / Session Minutes',
    ),
    heightCm: heightCm ? parseNumberCell(heightCm, 'Profile / Height Cm') : 0,
    equipmentAccess,
    recoveryPriority,
    constraints: getLookupValue(lookup, 'Profile', 'Constraints'),
  }
}

function parseGoals(values: SheetCell[][] | undefined): Goal[] {
  const rows = values?.slice(1).filter(rowHasData) ?? []

  return rows.map((row, index) => ({
    id: toSheetCell(row[0]).trim() || `goal-${index + 1}`,
    title: toSheetCell(row[1]),
    type: parseGoalType(toSheetCell(row[2])),
    targetValue: parseNumberCell(toSheetCell(row[3]), `Goals row ${index + 2} target value`),
    currentValue: parseNumberCell(toSheetCell(row[4]), `Goals row ${index + 2} current value`),
    unit: toSheetCell(row[5]),
    deadline: toSheetCell(row[6]),
    status: toSheetCell(row[7]) === 'completed' ? 'completed' : 'active',
    notes: toSheetCell(row[8]),
    createdAt: toSheetCell(row[9]),
  }))
}

function parseWorkouts(values: SheetCell[][] | undefined): ParsedWorkoutRow[] {
  const rows = values?.slice(1).filter(rowHasData) ?? []

  return rows.map((row, index) => {
    const energy = parseIntegerCell(toSheetCell(row[5]), `Workouts row ${index + 2} energy`)

    if (energy < 1 || energy > 5) {
      throw new GoogleSheetsSyncError('The Google Sheets workouts table contains an invalid energy value.')
    }

    return {
      id: toSheetCell(row[0]).trim() || `workout-${index + 1}`,
      title: toSheetCell(row[1]),
      focus: parseWorkoutFocus(toSheetCell(row[2])),
      completedOn: toSheetCell(row[3]),
      durationMinutes: parseNumberCell(
        toSheetCell(row[4]),
        `Workouts row ${index + 2} duration`,
      ),
      energy: energy as ParsedWorkoutRow['energy'],
      notes: toSheetCell(row[9]),
    }
  })
}

function parseWorkoutSetRows(values: SheetCell[][] | undefined): ParsedWorkoutSetRow[] {
  const rows = values?.slice(1).filter(rowHasData) ?? []

  return rows.map((row, index) => ({
    workoutId: toSheetCell(row[0]).trim(),
    exerciseId: toSheetCell(row[2]).trim() || `exercise-${index + 1}`,
    exerciseOrder: parseIntegerCell(
      toSheetCell(row[3]),
      `Workout sets row ${index + 2} exercise order`,
    ),
    exerciseName: toSheetCell(row[4]),
    exerciseNotes: toSheetCell(row[5]),
    set: {
      id: toSheetCell(row[6]).trim() || `set-${index + 1}`,
      kind: parseLoggedSetKind(toSheetCell(row[8])),
      loadKg: parseNumberCell(toSheetCell(row[9]), `Workout sets row ${index + 2} load`),
      reps: parseNumberCell(toSheetCell(row[10]), `Workout sets row ${index + 2} reps`),
      completed: parseBooleanCell(
        toSheetCell(row[11]),
        `Workout sets row ${index + 2} completed`,
      ),
    },
    setOrder: parseIntegerCell(toSheetCell(row[7]), `Workout sets row ${index + 2} set order`),
  }))
}

function parseWeightEntries(values: SheetCell[][] | undefined): WeightEntry[] {
  const rows = values?.slice(1).filter(rowHasData) ?? []

  return rows.map((row, index) => ({
    id: toSheetCell(row[0]).trim() || `weight-${index + 1}`,
    recordedOn: toSheetCell(row[1]),
    weightKg: parseNumberCell(toSheetCell(row[2]), `Weights row ${index + 2} weight`),
    notes: toSheetCell(row[4]),
  }))
}

function attachExercisesToWorkouts(
  workouts: ParsedWorkoutRow[],
  setRows: ParsedWorkoutSetRow[],
): WorkoutSession[] {
  const workoutIds = new Set(workouts.map((workout) => workout.id))
  const rowsByWorkout = new Map<string, ParsedWorkoutSetRow[]>()

  setRows.forEach((row) => {
    if (!workoutIds.has(row.workoutId)) {
      throw new GoogleSheetsSyncError(
        `The Google Sheets workout sets table references an unknown workout ID: ${row.workoutId}.`,
      )
    }

    const currentRows = rowsByWorkout.get(row.workoutId) ?? []
    currentRows.push(row)
    rowsByWorkout.set(row.workoutId, currentRows)
  })

  return workouts.map((workout) => {
    const exerciseRows = rowsByWorkout.get(workout.id) ?? []
    const exercises = new Map<
      string,
      {
        order: number
        exercise: LoggedExercise
        sets: Array<{ order: number; set: LoggedSet }>
      }
    >()

    exerciseRows.forEach((row) => {
      const existing = exercises.get(row.exerciseId)

      if (existing) {
        existing.sets.push({
          order: row.setOrder,
          set: row.set,
        })
        return
      }

      exercises.set(row.exerciseId, {
        order: row.exerciseOrder,
        exercise: {
          id: row.exerciseId,
          name: row.exerciseName,
          notes: row.exerciseNotes,
          sets: [],
        },
        sets: [
          {
            order: row.setOrder,
            set: row.set,
          },
        ],
      })
    })

    return {
      ...workout,
      exercises: [...exercises.values()]
        .sort((left, right) => left.order - right.order)
        .map(({ exercise, sets }) => ({
          ...exercise,
          sets: sets
            .sort((left, right) => left.order - right.order)
            .map((entry) => entry.set),
        })),
    }
  })
}

function parsePlan(values: SheetCell[][] | undefined): Omit<WorkoutPlan, 'days'> {
  const rows = values?.slice(1).filter(rowHasData) ?? []
  const lookup = new Map(rows.map((row) => [toSheetCell(row[0]), toSheetCell(row[1])]))

  const id = lookup.get('Plan ID')
  const createdAt = lookup.get('Created At')
  const summary = lookup.get('Summary')
  const generatedFromFingerprint = lookup.get('Generated From Fingerprint')

  if (!id || !createdAt || summary === undefined || !generatedFromFingerprint) {
    throw new GoogleSheetsSyncError('The Google Sheets plan tab is incomplete.')
  }

  const rationale = (lookup.get('Rationale') ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return {
    id,
    createdAt,
    summary,
    rationale,
    generatedFromFingerprint,
  }
}

function parsePlanDays(values: SheetCell[][] | undefined): ParsedPlanDayRow[] {
  const rows = values?.slice(1).filter(rowHasData) ?? []

  return rows.map((row, index) => ({
    order: parseIntegerCell(toSheetCell(row[1]), `Plan days row ${index + 2} order`),
    day: {
      id: toSheetCell(row[0]).trim() || `plan-day-${index + 1}`,
      day: toSheetCell(row[2]),
      focus: toSheetCell(row[3]),
      intention: toSheetCell(row[4]),
      durationMinutes: parseNumberCell(
        toSheetCell(row[5]),
        `Plan days row ${index + 2} duration`,
      ),
      recoveryNote: toSheetCell(row[6]),
      exercises: [],
    },
  }))
}

function parsePlanExerciseRows(values: SheetCell[][] | undefined): ParsedPlanExerciseRow[] {
  const rows = values?.slice(1).filter(rowHasData) ?? []

  return rows.map((row, index) => ({
    dayId: toSheetCell(row[0]).trim(),
    order: parseIntegerCell(toSheetCell(row[3]), `Plan exercises row ${index + 2} order`),
    exercise: {
      id: toSheetCell(row[2]).trim() || `plan-exercise-${index + 1}`,
      name: toSheetCell(row[4]),
      setsText: toSheetCell(row[5]),
      intensity: toSheetCell(row[6]),
      cue: toSheetCell(row[7]),
    },
  }))
}

function attachExercisesToPlanDays(
  dayRows: ParsedPlanDayRow[],
  exerciseRows: ParsedPlanExerciseRow[],
): PlanDay[] {
  const dayIds = new Set(dayRows.map((entry) => entry.day.id))
  const rowsByDay = new Map<string, ParsedPlanExerciseRow[]>()

  exerciseRows.forEach((row) => {
    if (!dayIds.has(row.dayId)) {
      throw new GoogleSheetsSyncError(
        `The Google Sheets plan exercises table references an unknown day ID: ${row.dayId}.`,
      )
    }

    const currentRows = rowsByDay.get(row.dayId) ?? []
    currentRows.push(row)
    rowsByDay.set(row.dayId, currentRows)
  })

  return dayRows
    .sort((left, right) => left.order - right.order)
    .map(({ day }) => ({
      ...day,
      exercises: (rowsByDay.get(day.id) ?? [])
        .sort((left, right) => left.order - right.order)
        .map((row) => row.exercise),
    }))
}

function parseTabularSnapshot(
  valuesBySheet: Map<string, SheetCell[][] | undefined>,
  syncSheets: SyncSheetTitles,
): RemoteSnapshot {
  const summaryValues = valuesBySheet.get(syncSheets.summary)
  const markerRow = summaryValues?.[0] ?? []

  if (toSheetCell(markerRow[0]) !== TABULAR_SHEET_MARKER) {
    throw new GoogleSheetsSyncError('The Google Sheets summary tab is not in GymTracker tabular sync format.')
  }

  const exportedAt = toSheetCell(markerRow[1])
  const versionText = toSheetCell(markerRow[2]) || String(APP_VERSION)
  const lookup = getSummaryLookup(summaryValues)

  if (!exportedAt.trim()) {
    throw new GoogleSheetsSyncError('The Google Sheets summary tab is missing the exported timestamp.')
  }

  const snapshot: RemoteSnapshot = {
    version: parseIntegerCell(versionText, 'Sync / Version'),
    exportedAt,
    themePreference: parseThemePreference(
      getLookupValue(lookup, 'Appearance', 'Theme Preference', { required: true }),
    ),
    profile: parseProfile(lookup),
    goals: parseGoals(valuesBySheet.get(syncSheets.goals)),
    workouts: attachExercisesToWorkouts(
      parseWorkouts(valuesBySheet.get(syncSheets.workouts)),
      parseWorkoutSetRows(valuesBySheet.get(syncSheets.workoutSets)),
    ),
    weightEntries: parseWeightEntries(valuesBySheet.get(syncSheets.weights)),
    activePlan: {
      ...parsePlan(valuesBySheet.get(syncSheets.plan)),
      days: attachExercisesToPlanDays(
        parsePlanDays(valuesBySheet.get(syncSheets.planDays)),
        parsePlanExerciseRows(valuesBySheet.get(syncSheets.planExercises)),
      ),
    },
  }

  if (!hasRequiredFields(snapshot)) {
    throw new GoogleSheetsSyncError('The Google Sheets tabs do not contain valid GymTracker data.')
  }

  return snapshot
}

function formatSetKind(kind: LoggedSetKind) {
  switch (kind) {
    case 'warmup':
      return 'Warm-up'
    case 'drop':
      return 'Drop set'
    case 'failure':
      return 'Failure'
    default:
      return 'Working'
  }
}

function createSummaryRows(snapshot: RemoteSnapshot): string[][] {
  return [
    [TABULAR_SHEET_MARKER, snapshot.exportedAt, String(snapshot.version)],
    SUMMARY_HEADERS,
    ['Sync', 'Format', TABULAR_SHEET_MARKER],
    ['Sync', 'Version', String(snapshot.version)],
    ['Appearance', 'Theme Preference', snapshot.themePreference],
    ['Profile', 'Name', snapshot.profile.name],
    ['Profile', 'Fitness Level', snapshot.profile.fitnessLevel],
    ['Profile', 'Primary Goal', snapshot.profile.primaryGoal],
    ['Profile', 'Training Days', snapshot.profile.trainingDays.join(', ')],
    ['Profile', 'Session Minutes', String(snapshot.profile.sessionMinutes)],
    ['Profile', 'Height Cm', snapshot.profile.heightCm > 0 ? String(snapshot.profile.heightCm) : ''],
    ['Profile', 'Equipment Access', snapshot.profile.equipmentAccess],
    ['Profile', 'Recovery Priority', snapshot.profile.recoveryPriority],
    ['Profile', 'Constraints', snapshot.profile.constraints],
    ['Counts', 'Goals', String(snapshot.goals.length)],
    ['Counts', 'Workouts', String(snapshot.workouts.length)],
    ['Counts', 'Weight Entries', String(snapshot.weightEntries.length)],
    ['Counts', 'Plan Days', String(snapshot.activePlan.days.length)],
  ]
}

function createGoalRows(goals: Goal[]): string[][] {
  return [
    GOAL_HEADERS,
    ...goals.map((goal) => [
      goal.id,
      goal.title,
      goal.type,
      String(goal.targetValue),
      String(goal.currentValue),
      goal.unit,
      goal.deadline,
      goal.status,
      goal.notes,
      goal.createdAt,
    ]),
  ]
}

function createWorkoutRows(workouts: WorkoutSession[]): string[][] {
  return [
    WORKOUT_HEADERS,
    ...workouts.map((workout) => {
      const setCount = workout.exercises.reduce((total, exercise) => total + exercise.sets.length, 0)

      return [
        workout.id,
        workout.title,
        workout.focus,
        workout.completedOn,
        String(workout.durationMinutes),
        String(workout.energy),
        String(workout.exercises.length),
        String(setCount),
        String(workoutVolume(workout)),
        workout.notes,
      ]
    }),
  ]
}

function createWorkoutSetRows(workouts: WorkoutSession[]): string[][] {
  const rows = workouts.flatMap((workout) =>
    workout.exercises.flatMap((exercise, exerciseIndex) =>
      exercise.sets.map((set, setIndex) => [
        workout.id,
        workout.title,
        exercise.id,
        String(exerciseIndex + 1),
        exercise.name,
        exercise.notes,
        set.id,
        String(setIndex + 1),
        formatSetKind(set.kind),
        String(set.loadKg),
        String(set.reps),
        set.completed ? YES_VALUE : NO_VALUE,
      ]),
    ),
  )

  return [WORKOUT_SET_HEADERS, ...rows]
}

function createWeightRows(snapshot: RemoteSnapshot): string[][] {
  return [
    WEIGHT_HEADERS,
    ...snapshot.weightEntries.map((entry) => [
      entry.id,
      entry.recordedOn,
      String(entry.weightKg),
      snapshot.profile.heightCm > 0
        ? (entry.weightKg / ((snapshot.profile.heightCm / 100) * (snapshot.profile.heightCm / 100))).toFixed(2)
        : '',
      entry.notes,
    ]),
  ]
}

function createPlanRows(activePlan: WorkoutPlan): string[][] {
  return [
    PLAN_HEADERS,
    ['Plan ID', activePlan.id],
    ['Created At', activePlan.createdAt],
    ['Summary', activePlan.summary],
    ['Generated From Fingerprint', activePlan.generatedFromFingerprint],
    ['Rationale', activePlan.rationale.join('\n')],
  ]
}

function createPlanDayRows(activePlan: WorkoutPlan): string[][] {
  return [
    PLAN_DAY_HEADERS,
    ...activePlan.days.map((day, index) => [
      day.id,
      String(index + 1),
      day.day,
      day.focus,
      day.intention,
      String(day.durationMinutes),
      day.recoveryNote,
    ]),
  ]
}

function createPlanExerciseRows(activePlan: WorkoutPlan): string[][] {
  const rows = activePlan.days.flatMap((day) =>
    day.exercises.map((exercise, exerciseIndex) => [
      day.id,
      day.day,
      exercise.id,
      String(exerciseIndex + 1),
      exercise.name,
      exercise.setsText,
      exercise.intensity,
      exercise.cue,
    ]),
  )

  return [PLAN_EXERCISE_HEADERS, ...rows]
}

function createTabularWorkbook(snapshot: RemoteSnapshot, syncSheets: SyncSheetTitles) {
  return [
    {
      range: `${quoteSheetName(syncSheets.summary)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createSummaryRows(snapshot),
    },
    {
      range: `${quoteSheetName(syncSheets.goals)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createGoalRows(snapshot.goals),
    },
    {
      range: `${quoteSheetName(syncSheets.workouts)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createWorkoutRows(snapshot.workouts),
    },
    {
      range: `${quoteSheetName(syncSheets.workoutSets)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createWorkoutSetRows(snapshot.workouts),
    },
    {
      range: `${quoteSheetName(syncSheets.weights)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createWeightRows(snapshot),
    },
    {
      range: `${quoteSheetName(syncSheets.plan)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createPlanRows(snapshot.activePlan),
    },
    {
      range: `${quoteSheetName(syncSheets.planDays)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createPlanDayRows(snapshot.activePlan),
    },
    {
      range: `${quoteSheetName(syncSheets.planExercises)}!A1`,
      majorDimension: 'ROWS' as const,
      values: createPlanExerciseRows(snapshot.activePlan),
    },
  ]
}

export function syncSettingsComplete(settings: SyncSettings) {
  return Boolean(
    settings.spreadsheetId.trim() && settings.sheetName.trim() && settings.accessToken.trim(),
  )
}

export async function fetchRemoteSnapshot(settings: SyncSettings) {
  const sheetTitles = await getSheetTitles(settings)
  const syncSheets = getSyncSheetTitles(settings.sheetName)

  if (!sheetTitles.includes(syncSheets.summary)) {
    return {
      snapshot: null,
      chunkCount: 0,
    }
  }

  const requestedRanges = Object.values(syncSheets)
    .filter((title) => sheetTitles.includes(title))
    .map((sheetTitle) => ({
      sheetTitle,
      range: 'A:Z',
    }))
  const valuesBySheet = await getSheetValues(settings, requestedRanges)
  const summaryValues = valuesBySheet.get(syncSheets.summary)

  if (!summaryValues || summaryValues.length === 0 || !rowHasData(summaryValues[0])) {
    return {
      snapshot: null,
      chunkCount: 0,
    }
  }

  const marker = toSheetCell(summaryValues[0][0])

  if (marker === LEGACY_SHEET_MARKER) {
    return parseLegacySnapshot(summaryValues)
  }

  if (marker !== TABULAR_SHEET_MARKER) {
    throw new GoogleSheetsSyncError(
      'The selected Google Sheets tab already contains data that is not in GymTracker sync format.',
    )
  }

  return {
    snapshot: parseTabularSnapshot(valuesBySheet, syncSheets),
    chunkCount: 0,
  }
}

export async function pushRemoteSnapshot(
  settings: SyncSettings,
  snapshot: RemoteSnapshot,
) {
  const syncSheets = await ensureSyncSheetsExist(settings)

  const clearResponse = await fetch(buildValueBatchClearUrl(settings), {
    method: 'POST',
    headers: buildHeaders(settings.accessToken),
    body: JSON.stringify({
      ranges: Object.values(syncSheets).map((title) => `${quoteSheetName(title)}!A:Z`),
    }),
  })

  if (!clearResponse.ok) {
    throw await buildGoogleSheetsError(
      clearResponse,
      'Unable to clear the existing Google Sheets sync tables before writing new data.',
    )
  }

  const workbook = createTabularWorkbook(snapshot, syncSheets)
  const updateResponse = await fetch(buildValueBatchUpdateUrl(settings), {
    method: 'POST',
    headers: buildHeaders(settings.accessToken),
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: workbook,
    }),
  })

  if (!updateResponse.ok) {
    throw await buildGoogleSheetsError(
      updateResponse,
      'Unable to push the local snapshot to Google Sheets.',
    )
  }

  return { chunkCount: 0 }
}
