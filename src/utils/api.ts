/**
 * Centralized API utility for official examination results portal.
 * Guarantees session token persistence and credentials: 'include' across all requests,
 * ensuring robust authentication in both direct domains (e.g. Vercel) and iframe embeds (e.g. Google AI Studio preview).
 */

const TOKEN_KEY = 'results_portal_token';

/**
 * Retrieve the active session token from browser storage
 */
export function getStoredSessionToken(): string | null {
  try {
    const sessionToken = sessionStorage.getItem(TOKEN_KEY);
    if (sessionToken) return sessionToken;
    const localToken = localStorage.getItem(TOKEN_KEY);
    if (localToken) return localToken;
  } catch {
    // Storage access may be restricted in some iframe sandboxes
  }
  return null;
}

/**
 * Store the authenticated session token across browser storage
 */
export function setStoredSessionToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Ignore storage quota or sandbox restrictions
  }
}

/**
 * Remove stored session tokens upon logout
 */
export function clearStoredSessionToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Wrapped fetch that automatically:
 * 1. Sets `credentials: 'include'` for cookie transmission
 * 2. Injects `Authorization: Bearer <token>` and `x-session-token` headers when available
 * 3. Sets default `Accept: application/json`
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});

  // Ensure default Accept header
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Inject active session token if present
  const token = getStoredSessionToken();
  if (token) {
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    if (!headers.has('x-session-token')) {
      headers.set('x-session-token', token);
    }
  }

  const mergedInit: RequestInit = {
    ...init,
    headers,
    credentials: init.credentials || 'include',
  };

  const response = await fetch(input, mergedInit);

  // If response has a new token or updates session, automatically capture it
  try {
    const authHeader = response.headers.get('x-session-token');
    if (authHeader) {
      setStoredSessionToken(authHeader);
    }
  } catch {
    // Ignore header inspection errors
  }

  return response;
}
