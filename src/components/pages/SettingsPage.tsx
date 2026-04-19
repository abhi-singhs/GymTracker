import {
  EQUIPMENT_OPTIONS,
  FITNESS_LEVEL_OPTIONS,
  PRIMARY_GOAL_OPTIONS,
  RECOVERY_OPTIONS,
  THEME_OPTIONS,
  WEEKDAY_OPTIONS,
} from '../../lib/defaults'
import { parseNumber } from '../../lib/app-drafts'
import { formatDateTime } from '../../lib/utils'
import type {
  PersistedAppState,
  Profile,
  SyncSettings as AppSyncSettings,
  ThemePreference,
} from '../../lib/types'
import { SectionHeader } from '../SectionHeader'

type SyncMode = 'pull' | 'push' | 'resolve' | null
type EditableSyncField = 'owner' | 'repo' | 'branch' | 'path' | 'token'
type UpdateProfileField = <Field extends keyof Profile>(field: Field, value: Profile[Field]) => void
type UpdateSyncField = <Field extends EditableSyncField>(
  field: Field,
  value: AppSyncSettings[Field],
) => void

interface SettingsPageProps {
  state: PersistedAppState
  online: boolean
  syncReady: boolean
  planNeedsRefresh: boolean
  syncMode: SyncMode
  updateTheme: (themePreference: ThemePreference) => void
  updateProfileField: UpdateProfileField
  toggleTrainingDay: (day: string) => void
  regeneratePlan: () => void
  updateSyncField: UpdateSyncField
  pushLocalSnapshot: () => Promise<void>
  pullRemoteData: () => Promise<void>
  keepRemoteVersion: () => void
  keepLocalVersion: () => Promise<void>
  resetLocalData: () => Promise<void>
}

interface AppearanceSettingsProps {
  themePreference: ThemePreference
  updateTheme: (themePreference: ThemePreference) => void
}

interface ProfileSettingsProps {
  profile: Profile
  planNeedsRefresh: boolean
  updateProfileField: UpdateProfileField
  toggleTrainingDay: (day: string) => void
  regeneratePlan: () => void
}

interface SyncSettingsPanelProps {
  sync: AppSyncSettings
  syncReady: boolean
  syncMode: SyncMode
  updateSyncField: UpdateSyncField
  pushLocalSnapshot: () => Promise<void>
  pullRemoteData: () => Promise<void>
  keepRemoteVersion: () => void
  keepLocalVersion: () => Promise<void>
}

interface DeviceSettingsProps {
  updatedAt: string
  syncReady: boolean
  resetLocalData: () => Promise<void>
}

function AppearanceSettings({ themePreference, updateTheme }: AppearanceSettingsProps) {
  return (
    <div className="settings-block settings-block--appearance">
      <div className="settings-block-header">
        <p className="eyebrow">Appearance</p>
        <h3>Keep the shell calm</h3>
        <p>Switch between light, dark, and automatic without leaving the journal flow.</p>
      </div>

      <div className="theme-switch theme-switch--settings" role="group" aria-label="Theme preference">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={option.value === themePreference ? 'is-active' : ''}
            type="button"
            onClick={() => updateTheme(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ProfileSettings({
  profile,
  planNeedsRefresh,
  updateProfileField,
  toggleTrainingDay,
  regeneratePlan,
}: ProfileSettingsProps) {
  return (
    <div className="settings-block">
      <div className="settings-block-header">
        <p className="eyebrow">Training profile</p>
        <h3>Shape the week around how you actually train</h3>
        <p>Your plan engine reads this profile every time you regenerate the weekly split.</p>
      </div>

      <div className="profile-layout">
        <div className="field-grid">
          <label className="field">
            <span>Name</span>
            <input
              type="text"
              value={profile.name}
              onChange={(event) => updateProfileField('name', event.target.value)}
            />
          </label>

          <label className="field">
            <span>Fitness level</span>
            <select
              value={profile.fitnessLevel}
              onChange={(event) =>
                updateProfileField('fitnessLevel', event.target.value as Profile['fitnessLevel'])
              }
            >
              {FITNESS_LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Primary goal</span>
            <select
              value={profile.primaryGoal}
              onChange={(event) =>
                updateProfileField('primaryGoal', event.target.value as Profile['primaryGoal'])
              }
            >
              {PRIMARY_GOAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Equipment</span>
            <select
              value={profile.equipmentAccess}
              onChange={(event) =>
                updateProfileField(
                  'equipmentAccess',
                  event.target.value as Profile['equipmentAccess'],
                )
              }
            >
              {EQUIPMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Session length (minutes)</span>
            <input
              type="number"
              min={30}
              max={150}
              step={5}
              value={profile.sessionMinutes}
              onChange={(event) =>
                updateProfileField('sessionMinutes', parseNumber(event.target.value, 60))
              }
            />
          </label>

          <label className="field">
            <span>Recovery bias</span>
            <select
              value={profile.recoveryPriority}
              onChange={(event) =>
                updateProfileField(
                  'recoveryPriority',
                  event.target.value as Profile['recoveryPriority'],
                )
              }
            >
              {RECOVERY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="profile-side">
          <div className="day-picker">
            <p className="field-label">Preferred training days</p>
            <div className="toggle-row">
              {WEEKDAY_OPTIONS.map((day) => (
                <button
                  key={day}
                  className={profile.trainingDays.includes(day) ? 'day-toggle is-selected' : 'day-toggle'}
                  type="button"
                  onClick={() => toggleTrainingDay(day)}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span>Notes and constraints</span>
            <textarea
              rows={5}
              value={profile.constraints}
              onChange={(event) => updateProfileField('constraints', event.target.value)}
              placeholder="Examples: tight shoulders, prefer shorter Saturday sessions, avoiding heavy running for now."
            />
          </label>

          <div className="settings-inline-status">
            {planNeedsRefresh ? (
              <span className="status-pill warning">Plan needs refresh</span>
            ) : (
              <span className="status-pill success">Plan aligned</span>
            )}
            <button className="button subtle" type="button" onClick={regeneratePlan}>
              Refresh from profile
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function SyncSettingsPanel({
  sync,
  syncReady,
  syncMode,
  updateSyncField,
  pushLocalSnapshot,
  pullRemoteData,
  keepRemoteVersion,
  keepLocalVersion,
}: SyncSettingsPanelProps) {
  return (
    <div className="settings-block">
      <div className="settings-block-header">
        <p className="eyebrow">Private sync</p>
        <h3>Back up the journal to your own repository</h3>
        <p>Local storage stays primary. Push or pull when you want the GitHub copy to match.</p>
      </div>

      <div className="sync-layout">
        <form
          className="sync-fields"
          onSubmit={(event) => {
            event.preventDefault()
            void pushLocalSnapshot()
          }}
        >
          <div className="field-grid">
            <label className="field">
              <span>Owner</span>
              <input
                type="text"
                value={sync.owner}
                onChange={(event) => updateSyncField('owner', event.target.value)}
                placeholder="your-github-name"
              />
            </label>

            <label className="field">
              <span>Repository</span>
              <input
                type="text"
                value={sync.repo}
                onChange={(event) => updateSyncField('repo', event.target.value)}
                placeholder="private-gymtracker-data"
              />
            </label>

            <label className="field">
              <span>Branch</span>
              <input
                type="text"
                value={sync.branch}
                onChange={(event) => updateSyncField('branch', event.target.value)}
              />
            </label>

            <label className="field">
              <span>Path</span>
              <input
                type="text"
                value={sync.path}
                onChange={(event) => updateSyncField('path', event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Personal access token</span>
            <input
              type="password"
              value={sync.token}
              onChange={(event) => updateSyncField('token', event.target.value)}
              placeholder="Stored locally on this device only"
            />
          </label>

          <div className="sync-actions">
            <button className="button primary" type="submit" disabled={syncMode !== null}>
              {syncMode === 'push' || syncMode === 'resolve' ? 'Syncing...' : 'Push local snapshot'}
            </button>

            <button
              className="button subtle"
              type="button"
              onClick={() => void pullRemoteData()}
              disabled={syncMode !== null}
            >
              {syncMode === 'pull' ? 'Pulling...' : 'Pull from GitHub'}
            </button>
          </div>
        </form>

        <aside className="sync-aside">
          <div className="sync-status-card">
            <p className="eyebrow">Repository status</p>
            <h3>{syncReady ? `${sync.owner}/${sync.repo}` : 'Not connected yet'}</h3>
            <p>
              {syncReady
                ? `Branch ${sync.branch} · ${sync.path}`
                : 'Add owner, repo, branch, path, and token to enable private sync.'}
            </p>
            <dl className="sync-meta">
              <div>
                <dt>Last synced</dt>
                <dd>{formatDateTime(sync.lastSyncedAt)}</dd>
              </div>
              <div>
                <dt>Pending push</dt>
                <dd>{sync.pendingPush ? 'Yes' : 'No'}</dd>
              </div>
              <div>
                <dt>Local backup</dt>
                <dd>IndexedDB on this device</dd>
              </div>
            </dl>
          </div>

          {sync.lastError ? (
            <div className="sync-conflict">
              <strong>Sync issue</strong>
              <p>{sync.lastError}</p>
            </div>
          ) : null}

          {sync.conflict ? (
            <div className="sync-conflict">
              <strong>Conflict detected</strong>
              <p>
                Remote snapshot from {formatDateTime(sync.conflict.remoteExportedAt)} differs from
                your local changes.
              </p>
              <div className="sync-actions stacked">
                <button className="button subtle" type="button" onClick={keepRemoteVersion}>
                  Use remote version
                </button>
                <button className="button primary" type="button" onClick={() => void keepLocalVersion()}>
                  Keep local version
                </button>
              </div>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

function DeviceSettings({ updatedAt, syncReady, resetLocalData }: DeviceSettingsProps) {
  return (
    <div className="settings-block settings-block--device">
      <div className="settings-block-header">
        <p className="eyebrow">Device</p>
        <h3>Keep local storage deliberate</h3>
        <p>
          The journal saves here first, then syncs outward when you choose. Reset only if you want
          a clean starter state on this device.
        </p>
      </div>

      <div className="device-meta">
        <div>
          <span className="field-label">Last local update</span>
          <strong>{formatDateTime(updatedAt)}</strong>
        </div>
        <div>
          <span className="field-label">Storage mode</span>
          <strong>IndexedDB first</strong>
        </div>
        <div>
          <span className="field-label">Remote backup</span>
          <strong>{syncReady ? 'Configured' : 'Not configured'}</strong>
        </div>
      </div>

      <details className="danger-panel">
        <summary>Reset local journal</summary>
        <p>
          Erase the device copy and rebuild the starter state. Your GitHub snapshot is left
          untouched until you decide to sync again.
        </p>
        <button className="button subtle" type="button" onClick={() => void resetLocalData()}>
          Reset local data
        </button>
      </details>
    </div>
  )
}

export function SettingsPage({
  state,
  online,
  syncReady,
  planNeedsRefresh,
  syncMode,
  updateTheme,
  updateProfileField,
  toggleTrainingDay,
  regeneratePlan,
  updateSyncField,
  pushLocalSnapshot,
  pullRemoteData,
  keepRemoteVersion,
  keepLocalVersion,
  resetLocalData,
}: SettingsPageProps) {
  return (
    <section className="section-surface" id="settings">
      <SectionHeader
        eyebrow="Settings"
        title="Tune the journal around your routine, device, and backup flow"
        description="Training profile, appearance, private sync, and local safeguards live together here so the mobile shell can stay focused."
        action={
          <span className={online ? 'status-pill success' : 'status-pill warning'}>
            {online ? 'Ready to sync' : 'Offline mode'}
          </span>
        }
      />

      <div className="settings-stack">
        <AppearanceSettings
          themePreference={state.themePreference}
          updateTheme={updateTheme}
        />
        <ProfileSettings
          profile={state.profile}
          planNeedsRefresh={planNeedsRefresh}
          updateProfileField={updateProfileField}
          toggleTrainingDay={toggleTrainingDay}
          regeneratePlan={regeneratePlan}
        />
        <SyncSettingsPanel
          sync={state.sync}
          syncReady={syncReady}
          syncMode={syncMode}
          updateSyncField={updateSyncField}
          pushLocalSnapshot={pushLocalSnapshot}
          pullRemoteData={pullRemoteData}
          keepRemoteVersion={keepRemoteVersion}
          keepLocalVersion={keepLocalVersion}
        />
        <DeviceSettings
          updatedAt={state.metadata.updatedAt}
          syncReady={syncReady}
          resetLocalData={resetLocalData}
        />
      </div>
    </section>
  )
}
