import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { WORKOUT_FOCUS_OPTIONS } from '../../lib/defaults'
import { formatVolume } from '../../lib/dashboard'
import { parseNumber, type WorkoutDraft } from '../../lib/app-drafts'
import type { LoggedExercise, LoggedSet, LoggedSetKind, WorkoutFocus, WorkoutSession } from '../../lib/types'
import { formatDisplayDate, titleCase, workoutVolume } from '../../lib/utils'
import { SectionHeader } from '../SectionHeader'

type UpdateWorkoutExercise = <Field extends Exclude<keyof LoggedExercise, 'sets'>>(
  exerciseId: string,
  field: Field,
  value: LoggedExercise[Field],
) => void

type UpdateWorkoutSet = <Field extends Exclude<keyof LoggedSet, 'id' | 'kind'>>(
  exerciseId: string,
  setId: string,
  field: Field,
  value: LoggedSet[Field],
) => void

interface WorkoutsPageProps {
  workoutDraft: WorkoutDraft
  workoutFormError: string | null
  sortedWorkouts: WorkoutSession[]
  setWorkoutDraft: Dispatch<SetStateAction<WorkoutDraft>>
  addWorkoutExercise: () => void
  updateWorkoutExercise: UpdateWorkoutExercise
  addWorkoutSet: (exerciseId: string) => void
  updateWorkoutSet: UpdateWorkoutSet
  cycleWorkoutSetKind: (exerciseId: string, setId: string) => void
  toggleWorkoutSetCompletion: (exerciseId: string, setId: string) => void
  removeWorkoutSet: (exerciseId: string) => void
  removeWorkoutExercise: (exerciseId: string) => void
  logWorkout: () => void
  deleteWorkout: (workoutId: string) => void
}

const SET_KIND_META: Record<
  LoggedSetKind,
  { badge: string; label: string; description: string; historyLabel: string }
> = {
  working: {
    badge: '',
    label: 'Working',
    description: 'Primary effort',
    historyLabel: 'Working set',
  },
  warmup: {
    badge: 'W',
    label: 'Warm-up',
    description: 'Prep before the main work',
    historyLabel: 'Warm-up',
  },
  drop: {
    badge: 'D',
    label: 'Drop set',
    description: 'Reduce load and keep going',
    historyLabel: 'Drop set',
  },
  failure: {
    badge: 'F',
    label: 'Failure',
    description: 'Push to technical failure',
    historyLabel: 'Failure set',
  },
}

function formatMetric(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 1,
  }).format(value)
}

function getExerciseVolume(exercise: LoggedExercise) {
  return exercise.sets.reduce((total, set) => total + set.reps * set.loadKg, 0)
}

function getExerciseTopLoad(exercise: LoggedExercise) {
  return exercise.sets.reduce((topLoad, set) => Math.max(topLoad, set.loadKg), 0)
}

function getExerciseRepTotal(exercise: LoggedExercise) {
  return exercise.sets.reduce((total, set) => total + set.reps, 0)
}

function getPreviousSetLabel(previousSet?: LoggedSet) {
  if (!previousSet) {
    return '—'
  }

  const load = previousSet.loadKg > 0 ? `${formatMetric(previousSet.loadKg)} kg` : 'BW'

  if (previousSet.reps > 0) {
    return `${load} × ${previousSet.reps}`
  }

  return load
}

export function WorkoutsPage({
  workoutDraft,
  workoutFormError,
  sortedWorkouts,
  setWorkoutDraft,
  addWorkoutExercise,
  updateWorkoutExercise,
  addWorkoutSet,
  updateWorkoutSet,
  cycleWorkoutSetKind,
  toggleWorkoutSetCompletion,
  removeWorkoutSet,
  removeWorkoutExercise,
  logWorkout,
  deleteWorkout,
}: WorkoutsPageProps) {
  const [expandedExerciseNotes, setExpandedExerciseNotes] = useState<Record<string, boolean>>({})

  const exerciseHistoryLookup = useMemo(() => {
    const lookup = new Map<string, { workout: WorkoutSession; exercise: LoggedExercise }>()

    sortedWorkouts.forEach((workout) => {
      workout.exercises.forEach((exercise) => {
        const key = exercise.name.trim().toLowerCase()

        if (key && !lookup.has(key)) {
          lookup.set(key, {
            workout,
            exercise,
          })
        }
      })
    })

    return lookup
  }, [sortedWorkouts])

  const draftSetCount = useMemo(
    () => workoutDraft.exercises.reduce((total, exercise) => total + exercise.sets.length, 0),
    [workoutDraft.exercises],
  )

  const draftVolume = useMemo(
    () => workoutDraft.exercises.reduce((total, exercise) => total + getExerciseVolume(exercise), 0),
    [workoutDraft.exercises],
  )

  const completedSetCount = useMemo(
    () =>
      workoutDraft.exercises.reduce(
        (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
        0,
      ),
    [workoutDraft.exercises],
  )

  const namedExerciseCount = useMemo(
    () => workoutDraft.exercises.filter((exercise) => exercise.name.trim()).length,
    [workoutDraft.exercises],
  )

  return (
    <section className="section-surface workout-tracker-surface" id="workouts">
      <SectionHeader
        eyebrow="Workout tracking"
        title="Track the workout"
        description="Previous sets up front, quick checks on the right, and one clean stack of exercises."
        action={<span className="status-pill neutral">{draftSetCount} set rows queued</span>}
      />

      <div className="tracker-session-shell">
        <div className="tracker-session-card">
          <label className="tracker-title-field">
            <span className="field-label">Session title</span>
            <input
              type="text"
              value={workoutDraft.title}
              onChange={(event) => setWorkoutDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Lower strength"
            />
          </label>

          <div className="tracker-session-grid">
            <label className="field">
              <span>Focus</span>
              <select
                value={workoutDraft.focus}
                onChange={(event) =>
                  setWorkoutDraft((current) => ({
                    ...current,
                    focus: event.target.value as WorkoutFocus,
                  }))
                }
              >
                {WORKOUT_FOCUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={workoutDraft.completedOn}
                onChange={(event) =>
                  setWorkoutDraft((current) => ({
                    ...current,
                    completedOn: event.target.value,
                  }))
                }
              />
            </label>

            <label className="field">
              <span>Duration</span>
              <input
                type="number"
                min={10}
                max={240}
                value={workoutDraft.durationMinutes}
                onChange={(event) =>
                  setWorkoutDraft((current) => ({
                    ...current,
                    durationMinutes: parseNumber(event.target.value, current.durationMinutes),
                  }))
                }
              />
            </label>
          </div>

          <div className="tracker-energy-panel" role="group" aria-label="Session energy">
            <div>
              <span className="field-label">How did it feel?</span>
              <p className="tracker-helper">Pick the effort level that best matches the session.</p>
            </div>

            <div className="tracker-energy-row">
              {[1, 2, 3, 4, 5].map((energy) => (
                <button
                  key={energy}
                  className={workoutDraft.energy === energy ? 'tracker-energy-button is-selected' : 'tracker-energy-button'}
                  type="button"
                  onClick={() =>
                    setWorkoutDraft((current) => ({
                      ...current,
                      energy: energy as WorkoutDraft['energy'],
                    }))
                  }
                >
                  {energy}
                </button>
              ))}
            </div>
          </div>

          <div className="tracker-summary-ribbon" aria-label="Draft summary">
            <article className="tracker-summary-card">
              <span>Exercises</span>
              <strong>{namedExerciseCount || workoutDraft.exercises.length}</strong>
              <p>Blocks in the current session.</p>
            </article>

            <article className="tracker-summary-card">
              <span>Completed sets</span>
              <strong>{completedSetCount}</strong>
              <p>Rows marked done in this draft.</p>
            </article>

            <article className="tracker-summary-card accent">
              <span>Draft volume</span>
              <strong>{formatVolume(draftVolume)} kg</strong>
              <p>Calculated from every filled weighted set.</p>
            </article>
          </div>
        </div>

        <div className="tracker-exercise-stack">
          {workoutDraft.exercises.map((exercise, exerciseIndex) => {
            const historyKey = exercise.name.trim().toLowerCase()
            const previous = historyKey ? exerciseHistoryLookup.get(historyKey) : undefined
            const notesExpanded = expandedExerciseNotes[exercise.id] || Boolean(exercise.notes)

            return (
              <article key={exercise.id} className="tracker-exercise-card">
                <div className="tracker-exercise-header">
                  <div className="tracker-exercise-heading">
                    <span className="tracker-exercise-index">Exercise {exerciseIndex + 1}</span>
                    <input
                      className="tracker-exercise-name"
                      type="text"
                      value={exercise.name}
                      onChange={(event) => updateWorkoutExercise(exercise.id, 'name', event.target.value)}
                      placeholder="Bench press"
                    />
                    <p className="tracker-exercise-context">
                      {previous
                        ? `Last logged on ${formatDisplayDate(previous.workout.completedOn)} · ${
                            getExerciseTopLoad(previous.exercise) > 0
                              ? `${formatMetric(getExerciseTopLoad(previous.exercise))} kg top set`
                              : `${previous.exercise.sets.length} sets recorded`
                          }`
                        : 'Name the exercise to pull previous sets from your own history.'}
                    </p>
                  </div>

                  <div className="tracker-exercise-actions">
                    <button
                      className="tracker-chip-button"
                      type="button"
                      onClick={() =>
                        setExpandedExerciseNotes((current) => ({
                          ...current,
                          [exercise.id]: !notesExpanded,
                        }))
                      }
                    >
                      {notesExpanded ? 'Hide note' : 'Add note'}
                    </button>
                    <button
                      className="tracker-chip-button danger"
                      type="button"
                      onClick={() => removeWorkoutExercise(exercise.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {notesExpanded ? (
                  <label className="field tracker-exercise-note">
                    <span>Exercise notes</span>
                    <textarea
                      rows={2}
                      value={exercise.notes}
                      onChange={(event) => updateWorkoutExercise(exercise.id, 'notes', event.target.value)}
                      placeholder="Tempo cues, machine setup, or anything to repeat next time."
                    />
                  </label>
                ) : null}

                <div className="tracker-table" role="table" aria-label={`${exercise.name || `Exercise ${exerciseIndex + 1}`} sets`}>
                  <div className="tracker-table-head" role="row">
                    <span>Set</span>
                    <span>Previous</span>
                    <span>kg</span>
                    <span>Reps</span>
                    <span>Done</span>
                  </div>

                  <div className="tracker-set-list">
                    {exercise.sets.map((set, setIndex) => {
                      const previousSet = previous?.exercise.sets[setIndex]
                      const kindMeta = SET_KIND_META[set.kind]
                      const setBadge = set.kind === 'working' ? String(setIndex + 1) : kindMeta.badge

                      return (
                        <div
                          key={set.id}
                          className={[
                            'tracker-set-row',
                            `is-${set.kind}`,
                            set.completed ? 'is-completed' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          role="row"
                        >
                          <button
                            className={`tracker-set-kind is-${set.kind}`}
                            type="button"
                            title={`${kindMeta.label}: ${kindMeta.description}. Tap to cycle the set type.`}
                            onClick={() => cycleWorkoutSetKind(exercise.id, set.id)}
                          >
                            {setBadge}
                          </button>

                          <div className="tracker-set-previous" role="cell">
                            <span>{getPreviousSetLabel(previousSet)}</span>
                            <small>{previousSet ? SET_KIND_META[previousSet.kind].historyLabel : 'No prior set'}</small>
                          </div>

                          <input
                            className="tracker-set-input"
                            type="number"
                            min={0}
                            step={2.5}
                            inputMode="decimal"
                            aria-label={`${exercise.name || `Exercise ${exerciseIndex + 1}`} load for set ${setIndex + 1}`}
                            value={set.loadKg > 0 ? set.loadKg : ''}
                            onChange={(event) =>
                              updateWorkoutSet(
                                exercise.id,
                                set.id,
                                'loadKg',
                                parseNumber(event.target.value, set.loadKg),
                              )
                            }
                            placeholder="0"
                          />

                          <input
                            className="tracker-set-input"
                            type="number"
                            min={0}
                            inputMode="numeric"
                            aria-label={`${exercise.name || `Exercise ${exerciseIndex + 1}`} reps for set ${setIndex + 1}`}
                            value={set.reps > 0 ? set.reps : ''}
                            onChange={(event) =>
                              updateWorkoutSet(
                                exercise.id,
                                set.id,
                                'reps',
                                parseNumber(event.target.value, set.reps),
                              )
                            }
                            placeholder="0"
                          />

                          <button
                            className={set.completed ? 'tracker-set-check is-completed' : 'tracker-set-check'}
                            type="button"
                            aria-pressed={set.completed}
                            aria-label={`${set.completed ? 'Unmark' : 'Mark'} set ${setIndex + 1} as complete`}
                            onClick={() => toggleWorkoutSetCompletion(exercise.id, set.id)}
                          >
                            ✓
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="tracker-exercise-footer">
                  <p className="tracker-helper">
                    Tap the left badge to cycle working, warm-up, drop, and failure.
                  </p>

                  <div className="tracker-exercise-footer-actions">
                    <button
                      className="tracker-inline-button"
                      type="button"
                      onClick={() => removeWorkoutSet(exercise.id)}
                      disabled={exercise.sets.length === 1}
                    >
                      Remove last set
                    </button>
                    <button className="tracker-add-set" type="button" onClick={() => addWorkoutSet(exercise.id)}>
                      + Add Set
                    </button>
                  </div>
                </div>
              </article>
            )
          })}

          <div className="tracker-bottom-bar">
            <button className="button subtle" type="button" onClick={addWorkoutExercise}>
              Add exercise
            </button>
            <button className="button primary" type="button" onClick={logWorkout}>
              Save workout
            </button>
          </div>

          <label className="field tracker-session-notes">
            <span>Session notes</span>
            <textarea
              rows={3}
              value={workoutDraft.notes}
              onChange={(event) => setWorkoutDraft((current) => ({ ...current, notes: event.target.value }))}
              placeholder="What felt sharp, what to keep, and what needs adjusting next time."
            />
          </label>

          {workoutFormError ? <p className="form-error">{workoutFormError}</p> : null}
        </div>
      </div>

      <div className="form-divider" />

      <div className="tracker-history-header">
        <div>
          <p className="eyebrow">Recent sessions</p>
          <h3>Keep the last few workouts close at hand</h3>
        </div>
      </div>

      {sortedWorkouts.length === 0 ? (
        <div className="empty-state">
          <strong>No sessions logged yet.</strong>
          <p>Your recent workouts, top sets, and exercise history will start filling this space as soon as you save the first session.</p>
        </div>
      ) : (
        <div className="tracker-history-grid">
          {sortedWorkouts.slice(0, 5).map((workout) => (
            <article key={workout.id} className="tracker-history-card">
              <div className="tracker-history-topline">
                <div>
                  <p className="eyebrow">
                    {formatDisplayDate(workout.completedOn)} · {titleCase(workout.focus)}
                  </p>
                  <h3>{workout.title}</h3>
                </div>
                <button className="text-button" type="button" onClick={() => deleteWorkout(workout.id)}>
                  Remove
                </button>
              </div>

              <div className="tracker-history-meta">
                <span>{workout.durationMinutes} min</span>
                <span>Energy {workout.energy}/5</span>
                <span>{formatVolume(workoutVolume(workout))} kg volume</span>
                <span>{workout.exercises.length} exercises</span>
              </div>

              <div className="tracker-history-exercises">
                {workout.exercises.map((exercise) => {
                  const topLoad = getExerciseTopLoad(exercise)

                  return (
                    <div key={exercise.id} className="tracker-history-exercise">
                      <div>
                        <strong>{exercise.name}</strong>
                        <span>
                          {exercise.sets.length} sets · {getExerciseRepTotal(exercise)} reps
                        </span>
                      </div>
                      <div className="tracker-history-highlight">
                        {topLoad > 0 ? `${formatMetric(topLoad)} kg top set` : 'Bodyweight focus'}
                      </div>
                    </div>
                  )
                })}
              </div>

              {workout.notes ? <p className="timeline-note">{workout.notes}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
