import { describe, expect, it } from 'vitest'
import { migratePersistedState } from './storage'

describe('migratePersistedState', () => {
  it('converts legacy aggregate exercise fields into per-set entries', () => {
    const state = migratePersistedState({
      version: 2,
      themePreference: 'system',
      profile: {
        name: 'Athlete',
        fitnessLevel: 'intermediate',
        primaryGoal: 'strength',
        trainingDays: ['Mon', 'Wed', 'Fri'],
        sessionMinutes: 60,
        equipmentAccess: 'full-gym',
        recoveryPriority: 'balanced',
        constraints: '',
      },
      goals: [],
      workouts: [
        {
          id: 'workout-1',
          title: 'Lower strength',
          focus: 'lower',
          completedOn: '2026-04-01',
          durationMinutes: 70,
          energy: 4,
          notes: '',
          exercises: [
            {
              id: 'exercise-1',
              name: 'Front squat',
              sets: 3,
              reps: 5,
              loadKg: 82.5,
              notes: '',
            },
          ],
        },
      ],
      activePlan: {
        id: 'plan-1',
        createdAt: '2026-04-01T00:00:00.000Z',
        summary: 'Plan',
        rationale: [],
        generatedFromFingerprint: 'fp',
        days: [
          {
            id: 'day-1',
            day: 'Mon',
            focus: 'Lower',
            intention: 'Lift',
            durationMinutes: 60,
            exercises: [],
            recoveryNote: '',
          },
        ],
      },
      sync: {},
      metadata: {},
    })

    expect(state.workouts[0].exercises[0].sets).toHaveLength(3)
    expect(state.workouts[0].exercises[0].sets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'working',
          reps: 5,
          loadKg: 82.5,
          completed: false,
        }),
      ]),
    )
    expect(state.profile.heightCm).toBe(0)
    expect(state.weightEntries).toEqual([])
  })
})
