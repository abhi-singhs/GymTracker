import { Link } from 'react-router-dom'
import { formatVolume } from '../../lib/dashboard'
import { formatDateTime } from '../../lib/utils'
import type { PlanDay } from '../../lib/types'

interface OverviewPageProps {
  pageHeadline: string
  nextPlanDay: PlanDay | null
  weeklySessions: number
  nextTrainingDay: string
  averageGoalProgress: number
  activeGoalCount: number
  weeklyVolume: number
  consistencyStreak: number
  bestLift: string
  syncReady: boolean
  syncPendingPush: boolean
  lastSyncedAt: string | null
  regeneratePlan: () => void
}

export function OverviewPage({
  pageHeadline,
  nextPlanDay,
  weeklySessions,
  nextTrainingDay,
  averageGoalProgress,
  activeGoalCount,
  weeklyVolume,
  consistencyStreak,
  bestLift,
  syncReady,
  syncPendingPush,
  lastSyncedAt,
  regeneratePlan,
}: OverviewPageProps) {
  return (
    <>
      <section className="hero-panel" id="overview">
        <div className="hero-copy">
          <p className="eyebrow">Calm, motivating, and entirely yours</p>
          <h1>Train with clarity. Keep your progress on-device and in your own private repo.</h1>
          <p className="hero-summary">{pageHeadline}</p>

          <div className="hero-actions">
            <button className="button primary" type="button" onClick={regeneratePlan}>
              Refresh my plan
            </button>
            <Link className="button subtle" to="/workouts">
              Log a session
            </Link>
          </div>
        </div>

        <aside className="hero-rail">
          <div className="rail-card primary-rail">
            <p className="rail-label">Next up</p>
            <strong>{nextPlanDay ? `${nextPlanDay.day} · ${nextPlanDay.focus}` : 'Generate a plan'}</strong>
            <p>{nextPlanDay?.intention ?? 'Use the profile and goals below to shape your first week.'}</p>
          </div>

          <div className="rail-grid">
            <div className="rail-card">
              <p className="rail-label">Weekly sessions</p>
              <strong>{weeklySessions}</strong>
              <p>
                {nextTrainingDay === 'Today'
                  ? 'A training day is on deck.'
                  : `Next scheduled day: ${nextTrainingDay}`}
              </p>
            </div>

            <div className="rail-card">
              <p className="rail-label">Goal rhythm</p>
              <strong>{Math.round(averageGoalProgress)}%</strong>
              <p>
                {activeGoalCount > 0
                  ? `${activeGoalCount} active goals in motion.`
                  : 'Add a goal to set the rhythm.'}
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="metric-ribbon" aria-label="Weekly summary">
        <article className="metric-block accent">
          <p>Volume this week</p>
          <strong>{formatVolume(weeklyVolume)} kg</strong>
          <span>
            {weeklySessions > 0
              ? 'Counted from all weighted sets logged this week.'
              : 'No sessions logged this week yet.'}
          </span>
        </article>

        <article className="metric-block">
          <p>Consistency streak</p>
          <strong>
            {consistencyStreak} week{consistencyStreak === 1 ? '' : 's'}
          </strong>
          <span>Weeks meeting at least half of your planned schedule.</span>
        </article>

        <article className="metric-block">
          <p>Best lift</p>
          <strong>{bestLift}</strong>
          <span>Highest single load captured in your workout history.</span>
        </article>

        <article className="metric-block">
          <p>Sync health</p>
          <strong>
            {syncPendingPush ? 'Queued locally' : lastSyncedAt ? 'Aligned to GitHub' : 'Local only'}
          </strong>
          <span>
            {syncReady
              ? `Last sync ${formatDateTime(lastSyncedAt)}.`
              : 'Add repository details when you want backup and sync.'}
          </span>
        </article>
      </section>
    </>
  )
}
