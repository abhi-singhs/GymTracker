import type { RemoteSnapshot, SyncSettings } from './types'

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const SHEET_MARKER = 'gymtracker-snapshot'
const SNAPSHOT_CHUNK_SIZE = 40000

interface SheetMetadataResponse {
  sheets?: Array<{
    properties?: {
      title?: string
    }
  }>
}

interface SheetValuesResponse {
  values?: string[][]
}

export class GoogleSheetsSyncError extends Error {
  readonly status?: number

  constructor(
    message: string,
    status?: number,
  ) {
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

function quoteSheetName(sheetName: string) {
  return `'${sheetName.replace(/'/g, "''")}'`
}

function buildSpreadsheetUrl(settings: SyncSettings, suffix = '', query = '') {
  const base = `${SHEETS_API_BASE}/${encodeURIComponent(settings.spreadsheetId)}${suffix}`
  return query ? `${base}?${query}` : base
}

function buildValuesUrl(settings: SyncSettings, range: string, query = '') {
  const encodedRange = encodeURIComponent(`${quoteSheetName(settings.sheetName)}!${range}`)
  return buildSpreadsheetUrl(settings, `/values/${encodedRange}`, query)
}

function buildHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

function chunkSnapshot(snapshot: RemoteSnapshot) {
  // Keep each chunk comfortably under the Google Sheets per-cell character limit.
  const serialized = JSON.stringify(snapshot)
  const chunks: string[] = []

  for (let start = 0; start < serialized.length; start += SNAPSHOT_CHUNK_SIZE) {
    chunks.push(serialized.slice(start, start + SNAPSHOT_CHUNK_SIZE))
  }

  return chunks
}

async function buildGoogleSheetsError(
  response: Response,
  fallbackMessage: string,
) {
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

async function ensureSheetExists(settings: SyncSettings) {
  const titles = await getSheetTitles(settings)

  if (titles.includes(settings.sheetName)) {
    return
  }

  const response = await fetch(buildSpreadsheetUrl(settings, ':batchUpdate'), {
    method: 'POST',
    headers: buildHeaders(settings.accessToken),
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: settings.sheetName,
            },
          },
        },
      ],
    }),
  })

  if (!response.ok) {
    throw await buildGoogleSheetsError(
      response,
      'Unable to create the Google Sheets tab for GymTracker sync.',
    )
  }
}

function parseStoredSnapshot(values: string[][] | undefined) {
  if (!values || values.length === 0) {
    return {
      snapshot: null,
      chunkCount: 0,
    }
  }

  const metadataRow = values[0]
  const hasMetadata = metadataRow.some((cell) => typeof cell === 'string' && cell.trim().length > 0)

  if (!hasMetadata) {
    return {
      snapshot: null,
      chunkCount: 0,
    }
  }

  if (metadataRow[0] !== SHEET_MARKER) {
    throw new GoogleSheetsSyncError(
      'The selected Google Sheets tab already contains data that is not in GymTracker sync format.',
    )
  }

  const chunkCount = Number.parseInt(metadataRow[2] ?? '', 10)

  if (!Number.isInteger(chunkCount) || chunkCount < 1) {
    throw new GoogleSheetsSyncError('The Google Sheets sync metadata is incomplete.')
  }

  const chunkRows = values.slice(1, chunkCount + 1)

  if (
    chunkRows.length < chunkCount ||
    chunkRows.some((row) => typeof row[0] !== 'string' || row[0].length === 0)
  ) {
    throw new GoogleSheetsSyncError('The Google Sheets snapshot is incomplete.')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(chunkRows.map((row) => row[0]).join(''))
  } catch {
    throw new GoogleSheetsSyncError('The Google Sheets snapshot is not valid JSON.')
  }

  if (!hasRequiredFields(parsed)) {
    throw new GoogleSheetsSyncError('The Google Sheets tab does not contain valid GymTracker data.')
  }

  return {
    snapshot: parsed,
    chunkCount,
  }
}

export function syncSettingsComplete(settings: SyncSettings) {
  return Boolean(
    settings.spreadsheetId.trim() && settings.sheetName.trim() && settings.accessToken.trim(),
  )
}

export async function fetchRemoteSnapshot(settings: SyncSettings) {
  const sheetTitles = await getSheetTitles(settings)

  if (!sheetTitles.includes(settings.sheetName)) {
    return {
      snapshot: null,
      chunkCount: 0,
    }
  }

  const response = await fetch(buildValuesUrl(settings, 'A1:C'), {
    headers: buildHeaders(settings.accessToken),
  })

  if (!response.ok) {
    throw await buildGoogleSheetsError(
      response,
      'Unable to read the Google Sheets snapshot. Check the target spreadsheet and Google login token.',
    )
  }

  const payload = (await response.json()) as SheetValuesResponse
  return parseStoredSnapshot(payload.values)
}

export async function pushRemoteSnapshot(
  settings: SyncSettings,
  snapshot: RemoteSnapshot,
  previousChunkCount = 0,
) {
  await ensureSheetExists(settings)

  const chunks = chunkSnapshot(snapshot)
  const paddedChunkCount = Math.max(chunks.length, previousChunkCount)
  const values = [
    [SHEET_MARKER, snapshot.exportedAt, String(chunks.length)],
    ...chunks.map((chunk) => [chunk]),
    ...Array.from({ length: paddedChunkCount - chunks.length }, () => ['']),
  ]

  const response = await fetch(
    buildValuesUrl(settings, `A1:C${paddedChunkCount + 1}`, 'valueInputOption=RAW'),
    {
      method: 'PUT',
      headers: buildHeaders(settings.accessToken),
      body: JSON.stringify({
        majorDimension: 'ROWS',
        values,
      }),
    },
  )

  if (!response.ok) {
    throw await buildGoogleSheetsError(
      response,
      'Unable to push the local snapshot to Google Sheets.',
    )
  }

  return { chunkCount: chunks.length }
}
