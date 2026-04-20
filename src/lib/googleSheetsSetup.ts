export const DEFAULT_GOOGLE_SYNC_SHEET_NAME = 'GymTracker'

const GOOGLE_SHEETS_HOST = 'docs.google.com'
const GOOGLE_SHEETS_ID_PATTERN = /^[A-Za-z0-9-_]{10,}$/

export interface ParsedGoogleSheetUrl {
  spreadsheetId: string
  normalizedUrl: string
}

export function getConfiguredGoogleClientId() {
  return (import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
}

export function buildGoogleSheetUrl(
  spreadsheetId: string,
  gid: string | null = null,
) {
  const url = new URL(`https://${GOOGLE_SHEETS_HOST}/spreadsheets/d/${spreadsheetId}/edit`)

  if (gid) {
    url.hash = `gid=${gid}`
  }

  return url.toString()
}

function extractGid(url: URL) {
  const searchGid = url.searchParams.get('gid')

  if (searchGid) {
    return searchGid
  }

  const hashMatch = url.hash.match(/gid=([0-9]+)/)
  return hashMatch?.[1] ?? null
}

export function parseGoogleSheetUrl(value: string): ParsedGoogleSheetUrl | null {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  if (GOOGLE_SHEETS_ID_PATTERN.test(trimmed)) {
    return {
      spreadsheetId: trimmed,
      normalizedUrl: buildGoogleSheetUrl(trimmed),
    }
  }

  let parsedUrl: URL

  try {
    parsedUrl = new URL(
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? trimmed
        : `https://${trimmed}`,
    )
  } catch {
    return null
  }

  if (parsedUrl.hostname !== GOOGLE_SHEETS_HOST) {
    return null
  }

  const match = parsedUrl.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9-_]+)/)

  if (!match) {
    return null
  }

  return {
    spreadsheetId: match[1],
    normalizedUrl: buildGoogleSheetUrl(match[1], extractGid(parsedUrl)),
  }
}
