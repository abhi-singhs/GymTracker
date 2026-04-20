import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AppBanners } from './components/AppBanners'
import { AppHeader } from './components/AppHeader'
import { MobileTabBar } from './components/MobileTabBar'
import { SectionNavigation } from './components/SectionNavigation'
import { ShellMessage } from './components/ShellMessage'
import { GoalsPage } from './components/pages/GoalsPage'
import { OverviewPage } from './components/pages/OverviewPage'
import { PlanPage } from './components/pages/PlanPage'
import { SettingsPage } from './components/pages/SettingsPage'
import { WorkoutsPage } from './components/pages/WorkoutsPage'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { usePersistedAppState } from './hooks/usePersistedAppState'
import { usePrefersDark } from './hooks/usePrefersDark'
import { createExerciseDraft, createGoalDraft, createWorkoutDraft } from './lib/app-drafts'
import { NAV_TABS } from './lib/app-navigation'
import {
  getBestLift,
  getConsistencyStreak,
  getNextTrainingDay,
  goalProgress,
  workoutHeadline,
} from './lib/dashboard'
import {
  GoogleSheetsSyncError,
  fetchRemoteSnapshot,
  pushRemoteSnapshot,
  syncSettingsComplete,
} from './lib/googleSheets'
import {
  DEFAULT_GOOGLE_SYNC_SHEET_NAME,
  getConfiguredGoogleClientId,
  parseGoogleSheetUrl,
} from './lib/googleSheetsSetup'
import {
  GoogleOAuthError,
  consumeGoogleAuthorizationRequest,
  exchangeGoogleAuthCode,
  getGoogleOAuthRedirectUri,
  readGoogleAuthorizationCallback,
  replaceGoogleAuthorizationCallbackUrl,
  startGoogleAuthorization,
} from './lib/googleOAuth'
import { generateWorkoutPlan, getPlanFingerprint, inferWorkoutFocus } from './lib/recommendations'
import {
  applyRemoteSnapshot,
  createRemoteSnapshot,
  remoteSnapshotFingerprint,
} from './lib/storage'
import type {
  Goal,
  LoggedExercise,
  PersistedAppState,
  PlanDay,
  PlanExercise,
  ThemePreference,
} from './lib/types'
import { createId, isInCurrentWeek, workoutVolume } from './lib/utils'

type SyncMode = 'pull' | 'push' | 'resolve' | 'authorize' | null
const SYNC_NOTICE_TIMEOUT_MS = 5000

interface SyncNoticeState {
  id: string
  message: string
}

function App() {
  const { state, setState, hydrated, loadError, saveError, resetLocalData } = usePersistedAppState()
  const location = useLocation()
  const [goalDraft, setGoalDraft] = useState(createGoalDraft)
  const [workoutDraft, setWorkoutDraft] = useState(createWorkoutDraft)
  const [goalFormError, setGoalFormError] = useState<string | null>(null)
  const [workoutFormError, setWorkoutFormError] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<SyncMode>(null)
  const [syncNotice, setSyncNotice] = useState<SyncNoticeState | null>(null)
  const online = useOnlineStatus()
  const prefersDark = usePrefersDark()
  const stateRef = useRef<PersistedAppState | null>(state)
  const oauthCallbackHandledRef = useRef(false)
  const previousOnlineRef = useRef(online)
  const configuredGoogleClientId = getConfiguredGoogleClientId()
  const manualGoogleClientId = state?.sync.clientId.trim() ?? ''
  const resolvedGoogleClientId = configuredGoogleClientId || manualGoogleClientId

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (!syncNotice || typeof window === 'undefined') {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setSyncNotice((current) => (current?.id === syncNotice.id ? null : current))
    }, SYNC_NOTICE_TIMEOUT_MS)

    return () => window.clearTimeout(timeoutId)
  }, [syncNotice])

  const showSyncNotice = useCallback((message: string) => {
    setSyncNotice({
      id: createId(),
      message,
    })
  }, [])

  const resolvedTheme = useMemo(() => {
    if (!state) {
      return prefersDark ? 'dark' : 'light'
    }

    return state.themePreference === 'system'
      ? prefersDark
        ? 'dark'
        : 'light'
      : state.themePreference
  }, [prefersDark, state])

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [resolvedTheme])

  const updateState = useCallback(
    (
      updater: (current: PersistedAppState) => PersistedAppState,
      options: { markDirty?: boolean } = {},
    ) => {
      const markDirty = options.markDirty ?? true

      setState((current) => {
        if (!current) {
          return current
        }

        const next = updater(current)
        return {
          ...next,
          sync: {
            ...next.sync,
            pendingPush: markDirty ? syncSettingsComplete(next.sync) : next.sync.pendingPush,
            lastError: null,
          },
          metadata: {
            ...next.metadata,
            updatedAt: new Date().toISOString(),
          },
        }
      })
    },
    [setState],
  )

  const planFingerprint = useMemo(
    () => (state ? getPlanFingerprint(state.profile, state.goals) : ''),
    [state],
  )

  const sortedWorkouts = useMemo(
    () =>
      state
        ? [...state.workouts].sort((left, right) => right.completedOn.localeCompare(left.completedOn))
        : [],
    [state],
  )

  const weeklySessions = useMemo(
    () => sortedWorkouts.filter((workout) => isInCurrentWeek(workout.completedOn)).length,
    [sortedWorkouts],
  )

  const weeklyVolume = useMemo(
    () =>
      sortedWorkouts
        .filter((workout) => isInCurrentWeek(workout.completedOn))
        .reduce((total, workout) => total + workoutVolume(workout), 0),
    [sortedWorkouts],
  )

  const activeGoals = useMemo(
    () => (state ? state.goals.filter((goal) => goal.status === 'active') : []),
    [state],
  )

  const completedGoals = useMemo(
    () => (state ? state.goals.filter((goal) => goal.status === 'completed').length : 0),
    [state],
  )

  const averageGoalProgress = useMemo(() => {
    if (activeGoals.length === 0) {
      return 0
    }

    return activeGoals.reduce((total, goal) => total + goalProgress(goal), 0) / activeGoals.length
  }, [activeGoals])

  const consistencyStreak = useMemo(
    () => (state ? getConsistencyStreak(sortedWorkouts, state.profile.trainingDays) : 0),
    [sortedWorkouts, state],
  )

  const bestLift = useMemo(() => getBestLift(sortedWorkouts), [sortedWorkouts])

  const nextTrainingDay = useMemo(
    () => (state ? getNextTrainingDay(state.profile.trainingDays) : 'Today'),
    [state],
  )

  const nextPlanDay = useMemo(
    () =>
      state?.activePlan.days.find((day) => day.day === nextTrainingDay) ??
      state?.activePlan.days[0] ??
      null,
    [nextTrainingDay, state],
  )

  const planNeedsRefresh = Boolean(state && state.activePlan.generatedFromFingerprint !== planFingerprint)
  const syncReady = Boolean(state && syncSettingsComplete(state.sync))
  const pageHeadline = workoutHeadline(
    weeklySessions,
    state?.profile.trainingDays ?? [],
    sortedWorkouts,
    planNeedsRefresh,
  )
  const oauthRedirectUri = useMemo(
    () => (typeof window === 'undefined' ? '' : getGoogleOAuthRedirectUri(window.location.href)),
    [],
  )
  const oauthOrigin = useMemo(() => {
    if (!oauthRedirectUri) {
      return ''
    }

    return new URL(oauthRedirectUri).origin
  }, [oauthRedirectUri])
  const currentTab = NAV_TABS.find((tab) => tab.path === location.pathname) ?? null

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    window.scrollTo(0, 0)
  }, [location.pathname])

  const handleResetLocalData = useCallback(async () => {
    await resetLocalData()
    setGoalDraft(createGoalDraft())
    setWorkoutDraft(createWorkoutDraft())
    setGoalFormError(null)
    setWorkoutFormError(null)
    showSyncNotice('Local data reset. You are back to a fresh starter setup.')
  }, [resetLocalData, showSyncNotice])

  const updateTheme = useCallback(
    (themePreference: ThemePreference) => {
      updateState((current) => ({
        ...current,
        themePreference,
      }))
    },
    [updateState],
  )

  const updateProfileField = useCallback(
    <Field extends keyof PersistedAppState['profile']>(
      field: Field,
      value: PersistedAppState['profile'][Field],
    ) => {
      updateState((current) => ({
        ...current,
        profile: {
          ...current.profile,
          [field]: value,
        },
      }))
    },
    [updateState],
  )

  const toggleTrainingDay = useCallback(
    (day: string) => {
      updateState((current) => {
        const selected = current.profile.trainingDays.includes(day)
          ? current.profile.trainingDays.filter((entry) => entry !== day)
          : [...current.profile.trainingDays, day]

        return {
          ...current,
          profile: {
            ...current.profile,
            trainingDays: selected.length === 0 ? [day] : selected,
          },
        }
      })
    },
    [updateState],
  )

  const regeneratePlan = useCallback(() => {
    updateState((current) => ({
      ...current,
      activePlan: generateWorkoutPlan(current.profile, current.goals),
    }))
    showSyncNotice('Fresh plan generated from your current profile and goals.')
  }, [showSyncNotice, updateState])

  const addGoal = useCallback(() => {
    if (!goalDraft.title.trim()) {
      setGoalFormError('Give the goal a short title so you can recognize it later.')
      return
    }

    if (goalDraft.targetValue <= 0) {
      setGoalFormError('Set a target value above zero.')
      return
    }

    updateState((current) => ({
      ...current,
      goals: [
        {
          id: createId(),
          title: goalDraft.title.trim(),
          type: goalDraft.type,
          targetValue: goalDraft.targetValue,
          currentValue: goalDraft.currentValue,
          unit: goalDraft.unit.trim() || 'units',
          deadline: goalDraft.deadline,
          notes: goalDraft.notes.trim(),
          status: 'active',
          createdAt: new Date().toISOString(),
        },
        ...current.goals,
      ],
    }))
    setGoalDraft(createGoalDraft())
    setGoalFormError(null)
  }, [goalDraft, updateState])

  const updateGoal = useCallback(
    (goalId: string, updater: (goal: Goal) => Goal) => {
      updateState((current) => ({
        ...current,
        goals: current.goals.map((goal) => (goal.id === goalId ? updater(goal) : goal)),
      }))
    },
    [updateState],
  )

  const deleteGoal = useCallback(
    (goalId: string) => {
      updateState((current) => ({
        ...current,
        goals: current.goals.filter((goal) => goal.id !== goalId),
      }))
    },
    [updateState],
  )

  const addWorkoutExercise = useCallback(() => {
    setWorkoutDraft((current) => ({
      ...current,
      exercises: [...current.exercises, createExerciseDraft()],
    }))
  }, [])

  const updateWorkoutExercise = useCallback(
    <Field extends keyof LoggedExercise>(
      exerciseId: string,
      field: Field,
      value: LoggedExercise[Field],
    ) => {
      setWorkoutDraft((current) => ({
        ...current,
        exercises: current.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                [field]: value,
              }
            : exercise,
        ),
      }))
    },
    [],
  )

  const removeWorkoutExercise = useCallback((exerciseId: string) => {
    setWorkoutDraft((current) => ({
      ...current,
      exercises:
        current.exercises.length === 1
          ? current.exercises
          : current.exercises.filter((exercise) => exercise.id !== exerciseId),
    }))
  }, [])

  const logWorkout = useCallback(() => {
    const namedExercises = workoutDraft.exercises.filter((exercise) => exercise.name.trim())

    if (!workoutDraft.title.trim()) {
      setWorkoutFormError('Give this session a short title.')
      return
    }

    if (namedExercises.length === 0) {
      setWorkoutFormError('Add at least one exercise before logging the workout.')
      return
    }

    const focus =
      workoutDraft.focus === 'full-body' ? inferWorkoutFocus(namedExercises) : workoutDraft.focus

    updateState((current) => ({
      ...current,
      workouts: [
        {
          id: createId(),
          title: workoutDraft.title.trim(),
          focus,
          completedOn: workoutDraft.completedOn,
          durationMinutes: workoutDraft.durationMinutes,
          energy: workoutDraft.energy,
          notes: workoutDraft.notes.trim(),
          exercises: namedExercises.map((exercise) => ({
            ...exercise,
            name: exercise.name.trim(),
          })),
        },
        ...current.workouts,
      ],
    }))
    setWorkoutDraft(createWorkoutDraft())
    setWorkoutFormError(null)
  }, [updateState, workoutDraft])

  const deleteWorkout = useCallback(
    (workoutId: string) => {
      updateState((current) => ({
        ...current,
        workouts: current.workouts.filter((workout) => workout.id !== workoutId),
      }))
    },
    [updateState],
  )

  const updatePlanDay = useCallback(
    (dayId: string, updater: (day: PlanDay) => PlanDay) => {
      updateState((current) => ({
        ...current,
        activePlan: {
          ...current.activePlan,
          days: current.activePlan.days.map((day) => (day.id === dayId ? updater(day) : day)),
        },
      }))
    },
    [updateState],
  )

  const addPlanExercise = useCallback(
    (dayId: string) => {
      updatePlanDay(dayId, (day) => ({
        ...day,
        exercises: [
          ...day.exercises,
          {
            id: createId(),
            name: 'Custom movement',
            setsText: '3 x 10',
            intensity: 'Smooth effort',
            cue: 'Write the cue that matters most to you.',
          },
        ],
      }))
    },
    [updatePlanDay],
  )

  const updatePlanExercise = useCallback(
    <Field extends keyof PlanExercise>(
      dayId: string,
      exerciseId: string,
      field: Field,
      value: PlanExercise[Field],
    ) => {
      updatePlanDay(dayId, (day) => ({
        ...day,
        exercises: day.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                [field]: value,
              }
            : exercise,
        ),
      }))
    },
    [updatePlanDay],
  )

  const removePlanExercise = useCallback(
    (dayId: string, exerciseId: string) => {
      updatePlanDay(dayId, (day) => ({
        ...day,
        exercises:
          day.exercises.length === 1
            ? day.exercises
            : day.exercises.filter((exercise) => exercise.id !== exerciseId),
      }))
    },
    [updatePlanDay],
  )

  const updateSpreadsheetUrl = useCallback(
    (spreadsheetUrl: string) => {
      const parsed = parseGoogleSheetUrl(spreadsheetUrl)

      updateState(
        (current) => ({
          ...current,
          sync: {
            ...current.sync,
            spreadsheetUrl,
            spreadsheetId: parsed?.spreadsheetId ?? '',
            sheetName: current.sync.sheetName || DEFAULT_GOOGLE_SYNC_SHEET_NAME,
          },
        }),
        { markDirty: false },
      )
    },
    [updateState],
  )

  const updateManualAccessToken = useCallback(
    (accessToken: string) => {
      updateState(
        (current) => ({
          ...current,
          sync: {
            ...current.sync,
            accessToken,
            tokenExpiresAt: null,
          },
        }),
        { markDirty: false },
      )
    },
    [updateState],
  )

  const updateGoogleClientId = useCallback(
    (clientId: string) => {
      updateState(
        (current) => ({
          ...current,
          sync: {
            ...current.sync,
            clientId,
          },
        }),
        { markDirty: false },
      )
    },
    [updateState],
  )

  const syncErrorMessage = useCallback((error: unknown) => {
    if (error instanceof GoogleSheetsSyncError || error instanceof GoogleOAuthError) {
      return error.message
    }

    if (error instanceof Error) {
      return error.message
    }

    return 'Something went wrong while talking to Google.'
  }, [])

  const authorizeGoogleSheets = useCallback(async () => {
    const current = stateRef.current

    if (!current) {
      return
    }

    if (!current.sync.spreadsheetId) {
      showSyncNotice('Paste a valid Google Sheets URL before logging in with Google.')
      return
    }

    if (!resolvedGoogleClientId) {
      showSyncNotice('Add a Google OAuth client ID in Advanced setup before logging in with Google.')
      return
    }

    if (!online) {
      showSyncNotice('Google authorization is unavailable while you are offline.')
      return
    }

    setSyncMode('authorize')
    setSyncNotice(null)

    try {
      await startGoogleAuthorization({
        clientId: resolvedGoogleClientId,
        redirectUri: oauthRedirectUri,
        returnHash: typeof window === 'undefined' ? '#/settings' : window.location.hash || '#/settings',
      })
    } catch (error: unknown) {
      const message = syncErrorMessage(error)
      setState((snapshot) =>
        snapshot
          ? {
              ...snapshot,
              sync: {
                ...snapshot.sync,
                lastError: message,
              },
            }
          : snapshot,
      )
      showSyncNotice(message)
      setSyncMode(null)
    }
  }, [online, oauthRedirectUri, resolvedGoogleClientId, setState, showSyncNotice, syncErrorMessage])

  useEffect(() => {
    if (typeof window === 'undefined' || oauthCallbackHandledRef.current || !hydrated || !state) {
      return
    }

    const callback = readGoogleAuthorizationCallback(window.location.search)

    if (!callback) {
      return
    }

    oauthCallbackHandledRef.current = true

    const request = consumeGoogleAuthorizationRequest(callback.state)
    replaceGoogleAuthorizationCallbackUrl(
      request?.returnHash ?? (window.location.hash || '#/settings'),
    )

    const setAuthorizationError = (message: string) => {
      setState((snapshot) =>
        snapshot
          ? {
              ...snapshot,
              sync: {
                ...snapshot.sync,
                lastError: message,
              },
            }
          : snapshot,
      )
      showSyncNotice(message)
    }

    if (!request) {
      setAuthorizationError('Google authorization state expired or was missing. Start authorization again.')
      return
    }

    if (callback.error) {
      const message = `Google authorization failed: ${callback.error}${
        callback.errorDescription ? ` ${callback.errorDescription}` : ''
      }`
      setAuthorizationError(message)
      return
    }

    if (!callback.code) {
      setAuthorizationError('Google did not return an authorization code.')
      return
    }

    const authorizationCode = callback.code

    void (async () => {
      try {
        const token = await exchangeGoogleAuthCode({
          clientId: request.clientId,
          code: authorizationCode,
          codeVerifier: request.codeVerifier,
          redirectUri: request.redirectUri,
        })

        setState((snapshot) =>
          snapshot
            ? {
                ...snapshot,
                sync: {
                ...snapshot.sync,
                  accessToken: token.accessToken,
                  tokenExpiresAt: token.tokenExpiresAt,
                  lastError: null,
                },
              }
            : snapshot,
        )
        showSyncNotice('Google login complete. Access granted for Google Sheets sync on this device.')
      } catch (error: unknown) {
        setAuthorizationError(syncErrorMessage(error))
      } finally {
        setSyncMode(null)
      }
    })()
  }, [hydrated, setState, showSyncNotice, state, syncErrorMessage])

  const pushLocalSnapshot = useCallback(
    async (forceLocal = false) => {
      const current = stateRef.current

      if (!current) {
        return
      }

      if (!syncSettingsComplete(current.sync)) {
        showSyncNotice('Paste a valid Google Sheets URL and log in with Google before syncing.')
        return
      }

      if (current.sync.tokenExpiresAt && new Date(current.sync.tokenExpiresAt).getTime() <= Date.now()) {
        showSyncNotice('Google access token expired. Authorize with Google again before syncing.')
        return
      }

      if (!online) {
        updateState(
          (snapshot) => ({
            ...snapshot,
            sync: {
              ...snapshot.sync,
              pendingPush: true,
              lastError: 'You are offline. Local changes are queued until you reconnect.',
            },
          }),
          { markDirty: false },
        )
        showSyncNotice('You are offline. Local changes are queued for the next connection.')
        return
      }

      setSyncMode(forceLocal ? 'resolve' : 'push')
      setSyncNotice(null)

      try {
        const remote = await fetchRemoteSnapshot(current.sync)
        const localSnapshot = createRemoteSnapshot(current)
        const localFingerprint = remoteSnapshotFingerprint(localSnapshot)
        const lastSyncedFingerprint = current.sync.lastSyncedFingerprint
        const remoteFingerprint = remote.snapshot ? remoteSnapshotFingerprint(remote.snapshot) : null
        const localChanged = lastSyncedFingerprint !== localFingerprint
        const remoteChanged =
          remote.snapshot !== null &&
          lastSyncedFingerprint !== null &&
          remoteFingerprint !== lastSyncedFingerprint

        if (remote.snapshot && remoteChanged && !localChanged && !forceLocal) {
          setState((snapshot) => (snapshot ? applyRemoteSnapshot(snapshot, remote.snapshot!) : snapshot))
          showSyncNotice(
            'Google Sheets already had the newer snapshot, so local data was updated from remote.',
          )
          return
        }

        if (remote.snapshot && remoteChanged && localChanged && !forceLocal) {
          setState((snapshot) => {
            if (!snapshot) {
              return snapshot
            }

            return {
              ...snapshot,
              sync: {
                ...snapshot.sync,
                conflict: {
                  detectedAt: new Date().toISOString(),
                  remoteExportedAt: remote.snapshot.exportedAt,
                  remoteSnapshot: remote.snapshot,
                },
                lastError:
                  'Google Sheets has newer data than your local copy. Choose which version to keep.',
                pendingPush: true,
              },
            }
          })
          showSyncNotice('Remote data changed after your last sync. Review the conflict below.')
          return
        }

        await pushRemoteSnapshot(current.sync, localSnapshot, remote.chunkCount)

        setState((snapshot) => {
          if (!snapshot) {
            return snapshot
          }

          return {
            ...snapshot,
            sync: {
              ...snapshot.sync,
              lastSyncedAt: new Date().toISOString(),
              lastSyncedFingerprint: localFingerprint,
              pendingPush: false,
              lastError: null,
              conflict: null,
            },
          }
        })
        showSyncNotice(
          remote.snapshot
            ? 'Local snapshot pushed to Google Sheets.'
            : 'First Google Sheets snapshot created.',
        )
      } catch (error: unknown) {
        const message = syncErrorMessage(error)
        setState((snapshot) => {
          if (!snapshot) {
            return snapshot
          }

          return {
            ...snapshot,
            sync: {
              ...snapshot.sync,
              lastError: message,
            },
          }
        })
        showSyncNotice(message)
      } finally {
        setSyncMode(null)
      }
    },
    [online, setState, showSyncNotice, syncErrorMessage, updateState],
  )

  const pullRemoteData = useCallback(async () => {
    const current = stateRef.current

    if (!current) {
      return
    }

    if (!syncSettingsComplete(current.sync)) {
      showSyncNotice('Paste a valid Google Sheets URL and log in with Google before pulling.')
      return
    }

    if (current.sync.tokenExpiresAt && new Date(current.sync.tokenExpiresAt).getTime() <= Date.now()) {
      showSyncNotice('Google access token expired. Authorize with Google again before pulling.')
      return
    }

    if (!online) {
      showSyncNotice('Pull is unavailable while you are offline.')
      return
    }

    setSyncMode('pull')
    setSyncNotice(null)

    try {
      const remote = await fetchRemoteSnapshot(current.sync)

      if (!remote.snapshot) {
        showSyncNotice('No Google Sheets snapshot exists yet. Push your local data first.')
        return
      }

      setState((snapshot) => (snapshot ? applyRemoteSnapshot(snapshot, remote.snapshot!) : snapshot))
      showSyncNotice('Latest data pulled from Google Sheets.')
    } catch (error: unknown) {
      const message = syncErrorMessage(error)
      setState((snapshot) => {
        if (!snapshot) {
          return snapshot
        }

        return {
          ...snapshot,
          sync: {
            ...snapshot.sync,
            lastError: message,
          },
        }
      })
      showSyncNotice(message)
    } finally {
      setSyncMode(null)
    }
  }, [online, setState, showSyncNotice, syncErrorMessage])

  const keepRemoteVersion = useCallback(() => {
    const current = stateRef.current

    if (!current?.sync.conflict) {
      return
    }

    setState((snapshot) =>
      snapshot
        ? applyRemoteSnapshot(snapshot, current.sync.conflict!.remoteSnapshot)
        : snapshot,
    )
    showSyncNotice('Remote Google Sheets snapshot replaced the local version.')
  }, [setState, showSyncNotice])

  const keepLocalVersion = useCallback(async () => {
    await pushLocalSnapshot(true)
  }, [pushLocalSnapshot])

  useEffect(() => {
    const cameBackOnline = online && !previousOnlineRef.current

    if (
      cameBackOnline &&
      state?.sync.pendingPush &&
      syncSettingsComplete(state.sync) &&
      !(
        state.sync.tokenExpiresAt &&
        new Date(state.sync.tokenExpiresAt).getTime() <= Date.now()
      ) &&
      !state.sync.conflict
    ) {
      void pushLocalSnapshot()
    }

    previousOnlineRef.current = online
  }, [online, pushLocalSnapshot, state])

  if (!hydrated) {
    return (
      <ShellMessage
        eyebrow="GymTracker"
        title="Preparing your private training journal..."
      />
    )
  }

  if (!state) {
    return (
      <ShellMessage
        eyebrow="Storage issue"
        title={loadError ?? 'Unable to load GymTracker.'}
        description="Resetting local data will rebuild a fresh offline starter state on this device."
        action={
          <button className="button primary" type="button" onClick={() => void handleResetLocalData()}>
            Reset local data
          </button>
        }
      />
    )
  }

  if (!currentTab) {
    return <Navigate to="/" replace />
  }

  let pageContent

  switch (currentTab.id) {
    case 'overview':
      pageContent = (
        <OverviewPage
          pageHeadline={pageHeadline}
          nextPlanDay={nextPlanDay}
          weeklySessions={weeklySessions}
          nextTrainingDay={nextTrainingDay}
          averageGoalProgress={averageGoalProgress}
          activeGoalCount={activeGoals.length}
          weeklyVolume={weeklyVolume}
          consistencyStreak={consistencyStreak}
          bestLift={bestLift}
          syncReady={syncReady}
          syncPendingPush={state.sync.pendingPush}
          lastSyncedAt={state.sync.lastSyncedAt}
          regeneratePlan={regeneratePlan}
        />
      )
      break
    case 'goals':
      pageContent = (
        <GoalsPage
          activeGoals={activeGoals}
          completedGoals={completedGoals}
          goalDraft={goalDraft}
          goalFormError={goalFormError}
          setGoalDraft={setGoalDraft}
          addGoal={addGoal}
          updateGoal={updateGoal}
          deleteGoal={deleteGoal}
        />
      )
      break
    case 'workouts':
      pageContent = (
        <WorkoutsPage
          workoutDraft={workoutDraft}
          workoutFormError={workoutFormError}
          sortedWorkouts={sortedWorkouts}
          setWorkoutDraft={setWorkoutDraft}
          addWorkoutExercise={addWorkoutExercise}
          updateWorkoutExercise={updateWorkoutExercise}
          removeWorkoutExercise={removeWorkoutExercise}
          logWorkout={logWorkout}
          deleteWorkout={deleteWorkout}
        />
      )
      break
    case 'plan':
      pageContent = (
        <PlanPage
          activePlan={state.activePlan}
          planNeedsRefresh={planNeedsRefresh}
          regeneratePlan={regeneratePlan}
          updatePlanDay={updatePlanDay}
          addPlanExercise={addPlanExercise}
          updatePlanExercise={updatePlanExercise}
          removePlanExercise={removePlanExercise}
        />
      )
      break
    case 'settings':
      pageContent = (
        <SettingsPage
          state={state}
          online={online}
          syncReady={syncReady}
          planNeedsRefresh={planNeedsRefresh}
          syncMode={syncMode}
          googleLoginConfigured={Boolean(resolvedGoogleClientId)}
          needsGoogleClientIdSetup={!configuredGoogleClientId}
          oauthOrigin={oauthOrigin}
          oauthRedirectUri={oauthRedirectUri}
          updateTheme={updateTheme}
          updateProfileField={updateProfileField}
          toggleTrainingDay={toggleTrainingDay}
          regeneratePlan={regeneratePlan}
          updateSpreadsheetUrl={updateSpreadsheetUrl}
          updateGoogleClientId={updateGoogleClientId}
          updateManualAccessToken={updateManualAccessToken}
          authorizeGoogleSheets={authorizeGoogleSheets}
          pushLocalSnapshot={() => pushLocalSnapshot()}
          pullRemoteData={pullRemoteData}
          keepRemoteVersion={keepRemoteVersion}
          keepLocalVersion={keepLocalVersion}
          resetLocalData={handleResetLocalData}
        />
      )
      break
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-a" aria-hidden="true" />
      <div className="ambient ambient-b" aria-hidden="true" />

      <AppHeader online={online} />
      <AppBanners online={online} saveError={saveError} syncNotice={syncNotice?.message ?? null} />
      <MobileTabBar tabs={NAV_TABS} currentTabId={currentTab.id} />

      <main className="page-shell">
        <SectionNavigation tabs={NAV_TABS} />
        {pageContent}
      </main>
    </div>
  )
}

export default App
