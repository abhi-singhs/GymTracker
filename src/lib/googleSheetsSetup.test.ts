import { describe, expect, it } from 'vitest'
import {
  buildGoogleSheetUrl,
  parseGoogleSheetUrl,
} from './googleSheetsSetup'

describe('googleSheetsSetup helpers', () => {
  it('parses a Google Sheets URL into a spreadsheet id', () => {
    expect(
      parseGoogleSheetUrl('https://docs.google.com/spreadsheets/d/abc123DEF456ghi789/edit#gid=0'),
    ).toEqual({
      spreadsheetId: 'abc123DEF456ghi789',
      normalizedUrl: 'https://docs.google.com/spreadsheets/d/abc123DEF456ghi789/edit#gid=0',
    })
  })

  it('accepts a raw spreadsheet id as a fallback input', () => {
    expect(parseGoogleSheetUrl('abc123DEF456ghi789')).toEqual({
      spreadsheetId: 'abc123DEF456ghi789',
      normalizedUrl: buildGoogleSheetUrl('abc123DEF456ghi789'),
    })
  })

  it('rejects non-Google Sheets URLs', () => {
    expect(parseGoogleSheetUrl('https://example.com/not-a-sheet')).toBeNull()
  })
})
