import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from './defaults'
import { fetchRemoteSnapshot, pushRemoteSnapshot } from './googleSheets'
import { createRemoteSnapshot } from './storage'
import type { RemoteSnapshot, SyncSettings } from './types'

const settings: SyncSettings = {
  spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/spreadsheet-id/edit',
  spreadsheetId: 'spreadsheet-id',
  sheetName: 'GymTracker',
  clientId: '',
  clientSecret: '',
  accessToken: 'access-token',
  tokenExpiresAt: null,
  lastSyncedAt: null,
  lastSyncedFingerprint: null,
  pendingPush: false,
  lastError: null,
  conflict: null,
}

const syncTitles = {
  summary: 'GymTracker',
  goals: 'GymTracker Goals',
  workouts: 'GymTracker Workouts',
  workoutSets: 'GymTracker Workout Sets',
  weights: 'GymTracker Weights',
  plan: 'GymTracker Plan',
  planDays: 'GymTracker Plan Days',
  planExercises: 'GymTracker Plan Exercises',
}

function createSampleSnapshot() {
  const state = createInitialState()

  return createRemoteSnapshot({
    ...state,
    themePreference: 'dark',
    profile: {
      ...state.profile,
      heightCm: 180,
    },
    goals: [
      {
        id: 'goal-1',
        title: 'Bench twice a week',
        type: 'consistency',
        targetValue: 2,
        currentValue: 1,
        unit: 'sessions / week',
        deadline: '2026-05-01',
        notes: 'Keep elbows happy.',
        status: 'active',
        createdAt: '2026-04-10T08:00:00.000Z',
      },
    ],
    workouts: [
      {
        id: 'workout-1',
        title: 'Lower strength',
        focus: 'lower',
        completedOn: '2026-04-11',
        durationMinutes: 72,
        energy: 4,
        notes: 'Strong start.',
        exercises: [
          {
            id: 'exercise-1',
            name: 'Front squat',
            notes: 'Use the heel wedge.',
            sets: [
              {
                id: 'set-1',
                kind: 'warmup',
                reps: 8,
                loadKg: 40,
                completed: true,
              },
              {
                id: 'set-2',
                kind: 'working',
                reps: 5,
                loadKg: 82.5,
                completed: true,
              },
            ],
          },
        ],
      },
    ],
    weightEntries: [
      {
        id: 'weight-1',
        recordedOn: '2026-04-10',
        weightKg: 82.5,
        notes: 'Morning weigh-in',
      },
    ],
    activePlan: {
      id: 'plan-1',
      createdAt: '2026-04-09T07:00:00.000Z',
      summary: 'Bias lower-body strength while keeping recovery smooth.',
      rationale: ['Anchor the week with a lower day.', 'Use lighter accessory work to stay fresh.'],
      generatedFromFingerprint: 'fp-123',
      days: [
        {
          id: 'day-1',
          day: 'Mon',
          focus: 'Lower',
          intention: 'Build strength through squat volume.',
          durationMinutes: 60,
          recoveryNote: 'Easy walk after training.',
          exercises: [
            {
              id: 'plan-ex-1',
              name: 'Front squat',
              setsText: '4 x 5',
              intensity: 'Heavy but crisp',
              cue: 'Brace before the descent.',
            },
          ],
        },
      ],
    },
  })
}

function createTabularValueRanges(snapshot: RemoteSnapshot) {
  return [
    {
      values: [
        ['gymtracker-tabular-v1', snapshot.exportedAt, String(snapshot.version)],
        ['Section', 'Field', 'Value'],
        ['Sync', 'Format', 'gymtracker-tabular-v1'],
        ['Sync', 'Version', String(snapshot.version)],
        ['Appearance', 'Theme Preference', snapshot.themePreference],
        ['Profile', 'Name', snapshot.profile.name],
        ['Profile', 'Fitness Level', snapshot.profile.fitnessLevel],
        ['Profile', 'Primary Goal', snapshot.profile.primaryGoal],
        ['Profile', 'Training Days', snapshot.profile.trainingDays.join(', ')],
        ['Profile', 'Session Minutes', String(snapshot.profile.sessionMinutes)],
        ['Profile', 'Height Cm', String(snapshot.profile.heightCm)],
        ['Profile', 'Equipment Access', snapshot.profile.equipmentAccess],
        ['Profile', 'Recovery Priority', snapshot.profile.recoveryPriority],
        ['Profile', 'Constraints', snapshot.profile.constraints],
        ['Counts', 'Goals', String(snapshot.goals.length)],
        ['Counts', 'Workouts', String(snapshot.workouts.length)],
        ['Counts', 'Weight Entries', String(snapshot.weightEntries.length)],
        ['Counts', 'Plan Days', String(snapshot.activePlan.days.length)],
      ],
    },
    {
      values: [
        ['Goal ID', 'Title', 'Type', 'Target Value', 'Current Value', 'Unit', 'Deadline', 'Status', 'Notes', 'Created At'],
        [
          'goal-1',
          'Bench twice a week',
          'consistency',
          '2',
          '1',
          'sessions / week',
          '2026-05-01',
          'active',
          'Keep elbows happy.',
          '2026-04-10T08:00:00.000Z',
        ],
      ],
    },
    {
      values: [
        ['Workout ID', 'Title', 'Focus', 'Completed On', 'Duration (min)', 'Energy', 'Exercise Count', 'Set Count', 'Volume (kg)', 'Notes'],
        [
          'workout-1',
          'Lower strength',
          'lower',
          '2026-04-11',
          '72',
          '4',
          '1',
          '2',
          '732.5',
          'Strong start.',
        ],
      ],
    },
    {
      values: [
        ['Workout ID', 'Workout Title', 'Exercise ID', 'Exercise #', 'Exercise Name', 'Exercise Notes', 'Set ID', 'Set #', 'Set Type', 'Load (kg)', 'Reps', 'Completed'],
        [
          'workout-1',
          'Lower strength',
          'exercise-1',
          '1',
          'Front squat',
          'Use the heel wedge.',
          'set-1',
          '1',
          'Warm-up',
          '40',
          '8',
          'Yes',
        ],
        [
          'workout-1',
          'Lower strength',
          'exercise-1',
          '1',
          'Front squat',
          'Use the heel wedge.',
          'set-2',
          '2',
          'Working',
          '82.5',
          '5',
          'Yes',
        ],
      ],
    },
    {
      values: [
        ['Entry ID', 'Recorded On', 'Weight (kg)', 'BMI', 'Notes'],
        ['weight-1', '2026-04-10', '82.5', '25.46', 'Morning weigh-in'],
      ],
    },
    {
      values: [
        ['Field', 'Value'],
        ['Plan ID', 'plan-1'],
        ['Created At', '2026-04-09T07:00:00.000Z'],
        ['Summary', 'Bias lower-body strength while keeping recovery smooth.'],
        ['Generated From Fingerprint', 'fp-123'],
        ['Rationale', 'Anchor the week with a lower day.\nUse lighter accessory work to stay fresh.'],
      ],
    },
    {
      values: [
        ['Day ID', 'Day #', 'Day', 'Focus', 'Intention', 'Duration (min)', 'Recovery Note'],
        [
          'day-1',
          '1',
          'Mon',
          'Lower',
          'Build strength through squat volume.',
          '60',
          'Easy walk after training.',
        ],
      ],
    },
    {
      values: [
        ['Day ID', 'Day', 'Exercise ID', 'Exercise #', 'Name', 'Sets', 'Intensity', 'Cue'],
        [
          'day-1',
          'Mon',
          'plan-ex-1',
          '1',
          'Front squat',
          '4 x 5',
          'Heavy but crisp',
          'Brace before the descent.',
        ],
      ],
    },
  ]
}

describe('googleSheets sync helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns no remote snapshot when the summary tab does not exist yet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sheets: [{ properties: { title: 'Sheet1' } }] }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchRemoteSnapshot(settings)).resolves.toEqual({
      snapshot: null,
      chunkCount: 0,
    })
  })

  it('reassembles a legacy chunked snapshot from Google Sheets rows', async () => {
    const snapshot = createRemoteSnapshot(createInitialState())
    const serialized = JSON.stringify(snapshot)
    const splitAt = Math.ceil(serialized.length / 2)
    const chunks = [serialized.slice(0, splitAt), serialized.slice(splitAt)]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sheets: [{ properties: { title: settings.sheetName } }],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            valueRanges: [
              {
                values: [
                  ['gymtracker-snapshot', snapshot.exportedAt, String(chunks.length)],
                  [chunks[0]],
                  [chunks[1]],
                ],
              },
            ],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchRemoteSnapshot(settings)).resolves.toEqual({
      snapshot,
      chunkCount: 2,
    })
  })

  it('reconstructs a tabular workbook into a remote snapshot', async () => {
    const snapshot = createSampleSnapshot()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sheets: Object.values(syncTitles).map((title) => ({ properties: { title } })),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            valueRanges: createTabularValueRanges(snapshot),
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )

    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchRemoteSnapshot(settings)).resolves.toEqual({
      snapshot,
      chunkCount: 0,
    })
  })

  it('writes readable tables across dedicated Google Sheets tabs', async () => {
    const snapshot = createSampleSnapshot()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            sheets: [{ properties: { title: syncTitles.summary } }],
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ replies: [] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ clearedRanges: [] }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ totalUpdatedSheets: 7 }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      )

    vi.stubGlobal('fetch', fetchMock)

    await pushRemoteSnapshot(settings, snapshot)

    const addSheetsRequest = fetchMock.mock.calls[1][1] as RequestInit
    const addSheetsBody = JSON.parse(String(addSheetsRequest.body)) as {
      requests: Array<{ addSheet: { properties: { title: string } } }>
    }
    const clearRequest = fetchMock.mock.calls[2][1] as RequestInit
    const clearBody = JSON.parse(String(clearRequest.body)) as {
      ranges: string[]
    }
    const updateRequest = fetchMock.mock.calls[3][1] as RequestInit
    const updateBody = JSON.parse(String(updateRequest.body)) as {
      data: Array<{ range: string; values: string[][] }>
    }

    expect(addSheetsBody.requests.map((request) => request.addSheet.properties.title)).toEqual([
      syncTitles.goals,
      syncTitles.workouts,
      syncTitles.workoutSets,
      syncTitles.weights,
      syncTitles.plan,
      syncTitles.planDays,
      syncTitles.planExercises,
    ])
    expect(clearBody.ranges).toContain("'GymTracker Workout Sets'!A:Z")
    expect(clearBody.ranges).toContain("'GymTracker Weights'!A:Z")
    expect(updateBody.data).toHaveLength(8)
    expect(updateBody.data[0]).toEqual(
      expect.objectContaining({
        range: "'GymTracker'!A1",
        values: expect.arrayContaining([
          ['gymtracker-tabular-v1', snapshot.exportedAt, String(snapshot.version)],
          ['Section', 'Field', 'Value'],
        ]),
      }),
    )
    expect(updateBody.data[3]).toEqual(
      expect.objectContaining({
        range: "'GymTracker Workout Sets'!A1",
        values: expect.arrayContaining([
          ['Workout ID', 'Workout Title', 'Exercise ID', 'Exercise #', 'Exercise Name', 'Exercise Notes', 'Set ID', 'Set #', 'Set Type', 'Load (kg)', 'Reps', 'Completed'],
          expect.arrayContaining(['workout-1', 'Lower strength', 'exercise-1', '1', 'Front squat']),
        ]),
      }),
    )
    expect(updateBody.data[4]).toEqual(
      expect.objectContaining({
        range: "'GymTracker Weights'!A1",
        values: expect.arrayContaining([
          ['Entry ID', 'Recorded On', 'Weight (kg)', 'BMI', 'Notes'],
          ['weight-1', '2026-04-10', '82.5', '25.46', 'Morning weigh-in'],
        ]),
      }),
    )
  })
})
