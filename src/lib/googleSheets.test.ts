import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createInitialState } from './defaults'
import { fetchRemoteSnapshot, pushRemoteSnapshot } from './googleSheets'
import { createRemoteSnapshot } from './storage'
import type { SyncSettings } from './types'

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

describe('googleSheets sync helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns no remote snapshot when the sheet tab does not exist yet', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sheets: [] }), {
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

  it('reassembles a chunked snapshot from Google Sheets rows', async () => {
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
            values: [
              ['gymtracker-snapshot', snapshot.exportedAt, String(chunks.length)],
              [chunks[0]],
              [chunks[1]],
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

  it('pads writes so stale chunk rows are cleared', async () => {
    const snapshot = createRemoteSnapshot(createInitialState())
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
            updatedRange: "'GymTracker'!A1:C4",
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

    await pushRemoteSnapshot(settings, snapshot, 3)

    const updateCall = fetchMock.mock.calls[1]
    const updateUrl = updateCall[0] as string
    const updateRequest = updateCall[1] as RequestInit
    const updateBody = JSON.parse(String(updateRequest.body)) as {
      values: string[][]
    }

    expect(updateUrl).toContain(encodeURIComponent("'GymTracker'!A1:C4"))
    expect(updateBody.values).toHaveLength(4)
    expect(updateBody.values.at(-1)).toEqual([''])
  })
})
