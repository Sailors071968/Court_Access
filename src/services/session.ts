// ============================================================================
// Session and token renewal.
//
// Access tokens last fifteen minutes. The server issues a refresh token good
// for seven days and exposes /api/auth/refresh to exchange it, but nothing in
// the client ever called it: every request simply carried the token from login
// until it expired, after which the page reported "jwt expired" and the
// session was dead until the user signed in again by hand.
//
// Everything that talks to the API should go through `authorizedFetch` so a
// renewal happens on its own. Long uploads matter especially — a multi-gigabyte
// transfer outlives a fifteen-minute token, and without renewal every chunk
// after the first quarter hour would be rejected.
// ============================================================================

const ACCESS_KEY = 'court-access-token';
const REFRESH_KEY = 'court-access-refresh-token';
const AUTH_STATE_KEY = 'court-access-auth';

/** Renew slightly early, so a request in flight cannot straddle expiry. */
const RENEW_BEFORE_MS = 60_000;

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please sign in again.';

/** Raised when the session cannot be renewed and the user must sign in. */
export class SessionExpiredError extends Error {
  constructor() {
    super(SESSION_EXPIRED_MESSAGE);
    this.name = 'SessionExpiredError';
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

/** Expiry in epoch milliseconds, or null when the token cannot be read. */
export function accessTokenExpiresAt(token = getAccessToken()): number | null {
  if (!token) return null;
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const json = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function isExpiringSoon(token = getAccessToken()): boolean {
  const expiresAt = accessTokenExpiresAt(token);
  // A token whose expiry cannot be read is left alone; the server decides.
  if (expiresAt === null) return false;
  return Date.now() >= expiresAt - RENEW_BEFORE_MS;
}

/** Clear the session and send the user to sign in, once. */
let redirecting = false;
export function endSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);

  // Clear the persisted store too, or the app still believes it is signed in.
  try {
    const stored = JSON.parse(localStorage.getItem(AUTH_STATE_KEY) ?? '{}');
    if (stored?.state) {
      stored.state.user = null;
      stored.state.isAuthenticated = false;
      stored.state.subscriptionStatus = 'none';
      localStorage.setItem(AUTH_STATE_KEY, JSON.stringify(stored));
    }
  } catch {
    localStorage.removeItem(AUTH_STATE_KEY);
  }

  if (redirecting) return;
  redirecting = true;
  window.dispatchEvent(new CustomEvent('courtaccess:session-expired'));

  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign('/login?expired=1');
  }
}

// Concurrent callers share one renewal rather than each spending the refresh
// token, which would leave all but the winner holding a rejected token.
let inFlight: Promise<string | null> | null = null;

async function renew(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.accessToken) return null;

    localStorage.setItem(ACCESS_KEY, data.accessToken);
    if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
    return data.accessToken as string;
  } catch {
    return null;
  }
}

export function renewAccessToken(): Promise<string | null> {
  if (!inFlight) {
    inFlight = renew().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

/**
 * The token to send with the next request, renewed first if it is spent or
 * about to be. Returns null when there is no usable session.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = getAccessToken();
  if (token && !isExpiringSoon(token)) return token;
  if (!getRefreshToken()) return token;
  return (await renewAccessToken()) ?? token;
}

/**
 * Fetch with the bearer token attached, renewing ahead of expiry and retrying
 * once if the server rejects the token anyway — a clock skew or a token
 * revoked mid-flight both land here.
 *
 * Throws SessionExpiredError when renewal fails, having already cleared the
 * session and redirected. Callers should let that message reach the user
 * rather than the server's wording.
 */
export async function authorizedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();

  const withAuth = (bearer: string | null): RequestInit => ({
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
  });

  let res = await fetch(input, withAuth(token));
  if (res.status !== 401) return res;

  const renewed = await renewAccessToken();
  if (!renewed) {
    endSession();
    throw new SessionExpiredError();
  }

  res = await fetch(input, withAuth(renewed));
  if (res.status === 401) {
    endSession();
    throw new SessionExpiredError();
  }
  return res;
}

/**
 * Turn a failed response into something worth reading. The server's own
 * wording is used where it is useful, but never for authentication: "jwt
 * expired" tells the user nothing they can act on.
 */
export async function describeFailure(res: Response, body: string): Promise<string> {
  if (res.status === 401) return SESSION_EXPIRED_MESSAGE;
  if (res.status === 403) return 'You do not have permission to do this.';

  try {
    const parsed = JSON.parse(body);
    const message = parsed.message || parsed.error;
    if (typeof message === 'string' && message.length > 0) return message;
  } catch {
    /* fall through to the status */
  }
  return `The server returned an error (${res.status}). Please try again.`;
}
