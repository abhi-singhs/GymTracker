import type { RemoteSnapshot, SyncSettings } from './types'

export class GitHubSyncError extends Error {
  readonly status?: number

  constructor(
    message: string,
    status?: number,
  ) {
    super(message)
    this.name = 'GitHubSyncError'
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

function encodePath(path: string) {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function buildContentsUrl(settings: SyncSettings, withRef = true) {
  const base = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${encodePath(settings.path)}`

  if (!withRef) {
    return base
  }

  return `${base}?ref=${encodeURIComponent(settings.branch)}`
}

function buildHeaders(token: string) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

function encodeContent(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary)
}

function decodeContent(value: string) {
  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function syncSettingsComplete(settings: SyncSettings) {
  return Boolean(settings.owner && settings.repo && settings.branch && settings.path && settings.token)
}

export async function fetchRemoteSnapshot(settings: SyncSettings) {
  const response = await fetch(buildContentsUrl(settings), {
    headers: buildHeaders(settings.token),
  })

  if (response.status === 404) {
    return {
      snapshot: null,
      sha: null,
    }
  }

  if (!response.ok) {
    throw new GitHubSyncError('Unable to read the GitHub snapshot. Check the repo, branch, and token.', response.status)
  }

  const payload = (await response.json()) as {
    content?: string
    sha?: string
  }

  if (!payload.content || !payload.sha) {
    throw new GitHubSyncError('GitHub returned an unexpected file payload.')
  }

  const parsed = JSON.parse(decodeContent(payload.content)) as unknown

  if (!hasRequiredFields(parsed)) {
    throw new GitHubSyncError('The remote file does not contain valid GymTracker data.')
  }

  return {
    snapshot: parsed,
    sha: payload.sha,
  }
}

export async function pushRemoteSnapshot(
  settings: SyncSettings,
  snapshot: RemoteSnapshot,
  sha: string | null,
) {
  const response = await fetch(buildContentsUrl(settings, false), {
    method: 'PUT',
    headers: buildHeaders(settings.token),
    body: JSON.stringify({
      message: `Sync GymTracker snapshot ${new Date().toISOString()}`,
      branch: settings.branch,
      content: encodeContent(JSON.stringify(snapshot, null, 2)),
      ...(sha ? { sha } : {}),
    }),
  })

  if (response.status === 409 || response.status === 422) {
    throw new GitHubSyncError('The GitHub file changed since your last sync. Resolve the conflict before pushing again.', response.status)
  }

  if (!response.ok) {
    throw new GitHubSyncError('Unable to push the local snapshot to GitHub.', response.status)
  }

  const payload = (await response.json()) as {
    content?: {
      sha?: string
    }
  }

  const nextSha = payload.content?.sha

  if (!nextSha) {
    throw new GitHubSyncError('GitHub accepted the push but did not return a new file SHA.')
  }

  return {
    sha: nextSha,
  }
}
