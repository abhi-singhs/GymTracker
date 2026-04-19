import type { Dispatch, SetStateAction } from 'react'
import { WORKOUT_FOCUS_OPTIONS } from '../../lib/defaults'
import { formatVolume } from '../../lib/dashboard'
import { parseNumber, type WorkoutDraft } from '../../lib/app-drafts'
import type { LoggedExercise, WorkoutFocus, WorkoutSession } from '../../lib/types'
import { formatDisplayDate, titleCase, workoutVolume } from '../../lib/utils'
import { SectionHeader } from '../SectionHeader'

type UpdateWorkoutExercise = <Field extends keyof LoggedExercise>(
  exerciseId: string,
  field: Field,
  value: LoggedExercise[Field],
) => void

interface WorkoutsPageProps {
  workoutDraft: WorkoutDraft
  workoutFormError: string | null
  sortedWorkouts: WorkoutSession[]
  setWorkoutDraft: Dispatch<SetStateAction<WorkoutDraft>>
  addWorkoutExercise: () => void
  updateWorkoutExercise: UpdateWorkoutExercise
  removeWorkoutExercise: (exerciseId: string) => void
  logWorkout: () => void
  deleteWorkout: (workoutId: string) => void
}

export function WorkoutsPage({
  workoutDraft,
  workoutFormError,
  sortedWorkouts,
  setWorkoutDraft,
  addWorkoutExercise,
  updateWorkoutExercise,
  removeWorkoutExercise,
  logWorkout,
  deleteWorkout,
}: WorkoutsPageProps) {
  return (
    <section className="section-surface" id="workouts">
      <SectionHeader
        eyebrow="Workouts"
        title="Log sessions while the details still feel honest"
        description="Capture load, reps, notes, and how the workout felt. Volume and best-lift stats update automatically from here."
      />

      <div className="field-grid">
        <label className="field">
          <span>Session title</span>
          <input
            type="text"
            value={workoutDraft.title}
            onChange={(event) => setWorkoutDraft((current) => ({ ...current, title: event.target.value }))}
            placeholder="Lower strength"
          />
        </label>

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

      <div className="energy-picker" role="group" aria-label="Session energy">
        <span className="field-label">How did it feel?</span>
        <div className="toggle-row">
          {[1, 2, 3, 4, 5].map((energy) => (
            <button
              key={energy}
              className={workoutDraft.energy === energy ? 'day-toggle is-selected' : 'day-toggle'}
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

      <div className="exercise-composer">
        {workoutDraft.exercises.map((exercise, index) => (
          <div key={exercise.id} className="exercise-row">
            <label className="field exercise-name">
              <span>Exercise {index + 1}</span>
              <input
                type="text"
                value={exercise.name}
                onChange={(event) => updateWorkoutExercise(exercise.id, 'name', event.target.value)}
                placeholder="Bench press"
              />
            </label>

            <label className="field compact">
              <span>Sets</span>
              <input
                type="number"
                min={1}
                value={exercise.sets}
                onChange={(event) =>
                  updateWorkoutExercise(exercise.id, 'sets', parseNumber(event.target.value, exercise.sets))
                }
              />
            </label>

            <label className="field compact">
              <span>Reps</span>
              <input
                type="number"
                min={1}
                value={exercise.reps}
                onChange={(event) =>
                  updateWorkoutExercise(exercise.id, 'reps', parseNumber(event.target.value, exercise.reps))
                }
              />
            </label>

            <label className="field compact">
              <span>Load (kg)</span>
              <input
                type="number"
                min={0}
                step={2.5}
                value={exercise.loadKg}
                onChange={(event) =>
                  updateWorkoutExercise(
                    exercise.id,
                    'loadKg',
                    parseNumber(event.target.value, exercise.loadKg),
                  )
                }
              />
            </label>

            <button className="text-button" type="button" onClick={() => removeWorkoutExercise(exercise.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <button className="button subtle" type="button" onClick={addWorkoutExercise}>
        Add exercise row
      </button>

      <label className="field">
        <span>Session notes</span>
        <textarea
          rows={3}
          value={workoutDraft.notes}
          onChange={(event) => setWorkoutDraft((current) => ({ ...current, notes: event.target.value }))}
          placeholder="What felt strong, what to repeat next time, or anything worth remembering."
        />
      </label>

      {workoutFormError ? <p className="form-error">{workoutFormError}</p> : null}

      <button className="button primary" type="button" onClick={logWorkout}>
        Log workout
      </button>

      <div className="form-divider" />

      {sortedWorkouts.length === 0 ? (
        <div className="empty-state">
          <strong>No sessions logged yet.</strong>
          <p>
            Your latest sessions will appear here with volume, energy, and notes once you start
            tracking.
          </p>
        </div>
      ) : (
        <div className="timeline">
          {sortedWorkouts.slice(0, 5).map((workout) => (
            <article key={workout.id} className="timeline-item">
              <div className="timeline-topline">
                <div>
                  <p className="eyebrow">
                    {formatDisplayDate(workout.completedOn)} - {titleCase(workout.focus)}
                  </p>
                  <h3>{workout.title}</h3>
                </div>
                <button className="text-button" type="button" onClick={() => deleteWorkout(workout.id)}>
                  Remove
                </button>
              </div>

              <div className="timeline-metadata">
                <span>{workout.durationMinutes} min</span>
                <span>Energy {workout.energy}/5</span>
                <span>{formatVolume(workoutVolume(workout))} kg volume</span>
              </div>

              <ul className="exercise-list">
                {workout.exercises.map((exercise) => (
                  <li key={exercise.id}>
                    <strong>{exercise.name}</strong>
                    <span>
                      {exercise.sets} x {exercise.reps}
                      {exercise.loadKg > 0 ? ` @ ${exercise.loadKg} kg` : ' bodyweight'}
                    </span>
                  </li>
                ))}
              </ul>

              {workout.notes ? <p className="timeline-note">{workout.notes}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
