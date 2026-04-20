export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

const GOOGLE_OAUTH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_OAUTH_STORAGE_KEY = 'gymtracker-google-oauth-request'

interface StoredGoogleAuthorizationRequest {
  state: string
  codeVerifier: string
  clientId: string
  redirectUri: string
  returnHash: string
}

interface GoogleAuthorizationUrlOptions {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  scope?: string
}

export interface GoogleAuthorizationCallback {
  code: string | null
  state: string | null
  error: string | null
  errorDescription: string | null
}

interface ExchangeGoogleAuthCodeOptions {
  clientId: string
  code: string
  codeVerifier: string
  redirectUri: string
}

export interface ExchangeGoogleAuthCodeResult {
  accessToken: string
  tokenExpiresAt: string | null
}

export class GoogleOAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleOAuthError'
  }
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = ''

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function createRandomUrlSafeString(byteLength: number) {
  const buffer = new Uint8Array(byteLength)
  crypto.getRandomValues(buffer)
  return base64UrlEncode(buffer)
}

async function createCodeChallenge(codeVerifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))
  return base64UrlEncode(new Uint8Array(digest))
}

function readStoredRequest() {
  try {
    const raw = window.sessionStorage.getItem(GOOGLE_OAUTH_STORAGE_KEY)

    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as StoredGoogleAuthorizationRequest).state !== 'string' ||
      typeof (parsed as StoredGoogleAuthorizationRequest).codeVerifier !== 'string' ||
      typeof (parsed as StoredGoogleAuthorizationRequest).clientId !== 'string' ||
      typeof (parsed as StoredGoogleAuthorizationRequest).redirectUri !== 'string' ||
      typeof (parsed as StoredGoogleAuthorizationRequest).returnHash !== 'string'
    ) {
      return null
    }

    return parsed as StoredGoogleAuthorizationRequest
  } catch {
    return null
  }
}

function writeStoredRequest(request: StoredGoogleAuthorizationRequest) {
  window.sessionStorage.setItem(GOOGLE_OAUTH_STORAGE_KEY, JSON.stringify(request))
}

export function getGoogleOAuthRedirectUri(currentUrl: string) {
  const url = new URL(currentUrl)
  return `${url.origin}${url.pathname}`
}

export function buildGoogleAuthorizationUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  scope = GOOGLE_SHEETS_SCOPE,
}: GoogleAuthorizationUrlOptions) {
  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    include_granted_scopes: 'true',
  })

  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${searchParams.toString()}`
}

export function readGoogleAuthorizationCallback(search: string): GoogleAuthorizationCallback | null {
  const query = search.startsWith('?') ? search.slice(1) : search

  if (!query) {
    return null
  }

  const searchParams = new URLSearchParams(query)

  if (
    !searchParams.has('code') &&
    !searchParams.has('state') &&
    !searchParams.has('error') &&
    !searchParams.has('error_description')
  ) {
    return null
  }

  return {
    code: searchParams.get('code'),
    state: searchParams.get('state'),
    error: searchParams.get('error'),
    errorDescription: searchParams.get('error_description'),
  }
}

export async function startGoogleAuthorization(options: {
  clientId: string
  redirectUri: string
  returnHash: string
}) {
  const clientId = options.clientId.trim()

  if (!clientId) {
    throw new GoogleOAuthError('Add your Google OAuth client ID before authorizing.')
  }

  if (typeof window === 'undefined' || typeof crypto === 'undefined' || !crypto.subtle) {
    throw new GoogleOAuthError('This browser cannot start the Google authorization flow.')
  }

  const state = createRandomUrlSafeString(24)
  const codeVerifier = createRandomUrlSafeString(64)
  const codeChallenge = await createCodeChallenge(codeVerifier)

  writeStoredRequest({
    state,
    codeVerifier,
    clientId,
    redirectUri: options.redirectUri,
    returnHash: options.returnHash || '#/settings',
  })

  window.location.assign(
    buildGoogleAuthorizationUrl({
      clientId,
      redirectUri: options.redirectUri,
      state,
      codeChallenge,
    }),
  )
}

export function consumeGoogleAuthorizationRequest(expectedState: string | null) {
  if (typeof window === 'undefined' || !expectedState) {
    return null
  }

  const request = readStoredRequest()
  window.sessionStorage.removeItem(GOOGLE_OAUTH_STORAGE_KEY)

  if (!request || request.state !== expectedState) {
    return null
  }

  return request
}

export function replaceGoogleAuthorizationCallbackUrl(returnHash: string) {
  if (typeof window === 'undefined') {
    return
  }

  const nextHash = returnHash || window.location.hash || '#/settings'
  window.history.replaceState(
    {},
    document.title,
    `${window.location.origin}${window.location.pathname}${nextHash}`,
  )
}

export async function exchangeGoogleAuthCode({
  clientId,
  code,
  codeVerifier,
  redirectUri,
}: ExchangeGoogleAuthCodeOptions): Promise<ExchangeGoogleAuthCodeResult> {
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  })

  const rawBody = await response.text()
  let payload: Record<string, unknown> | null = null

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      payload = null
    }
  }

  if (!response.ok) {
    const detail =
      typeof payload?.error_description === 'string'
        ? payload.error_description
        : typeof payload?.error === 'string'
          ? payload.error
          : rawBody.trim()

    throw new GoogleOAuthError(
      `Unable to exchange the Google authorization code for an access token.${detail ? ` ${detail}` : ''}`,
    )
  }

  if (!payload || typeof payload.access_token !== 'string') {
    throw new GoogleOAuthError('Google did not return an access token.')
  }

  const expiresIn = typeof payload.expires_in === 'number' ? payload.expires_in : null

  return {
    accessToken: payload.access_token,
    tokenExpiresAt:
      expiresIn === null ? null : new Date(Date.now() + expiresIn * 1000).toISOString(),
  }
}
