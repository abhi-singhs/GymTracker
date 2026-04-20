import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GOOGLE_SHEETS_SCOPE,
  buildGoogleAuthorizationUrl,
  exchangeGoogleAuthCode,
  readGoogleAuthorizationCallback,
} from './googleOAuth'

describe('googleOAuth helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds an authorization URL for the code flow', () => {
    const url = new URL(
      buildGoogleAuthorizationUrl({
        clientId: 'client-id',
        redirectUri: 'https://app.example.com/',
        state: 'state-123',
        codeChallenge: 'challenge-123',
      }),
    )

    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe('client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe(GOOGLE_SHEETS_SCOPE)
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('code_challenge')).toBe('challenge-123')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
  })

  it('reads an authorization callback from the URL query string', () => {
    expect(
      readGoogleAuthorizationCallback('?code=auth-code&state=state-123'),
    ).toEqual({
      code: 'auth-code',
      state: 'state-123',
      error: null,
      errorDescription: null,
    })
  })

  it('exchanges the auth code for an access token with an optional client secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
          expires_in: 3600,
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

    const token = await exchangeGoogleAuthCode({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      code: 'auth-code',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://app.example.com/',
    })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = new URLSearchParams(String(request.body))

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://oauth2.googleapis.com/token')
    expect(body.get('client_id')).toBe('client-id')
    expect(body.get('client_secret')).toBe('client-secret')
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('code_verifier')).toBe('verifier-123')
    expect(body.get('redirect_uri')).toBe('https://app.example.com/')
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(token.accessToken).toBe('access-token')
    expect(token.tokenExpiresAt).not.toBeNull()
  })

  it('omits client_secret when none is configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-token',
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

    await exchangeGoogleAuthCode({
      clientId: 'client-id',
      code: 'auth-code',
      codeVerifier: 'verifier-123',
      redirectUri: 'https://app.example.com/',
    })

    const request = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = new URLSearchParams(String(request.body))

    expect(body.has('client_secret')).toBe(false)
  })
})
