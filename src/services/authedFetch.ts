// Shared authenticated fetch.
//
// Several views called bare fetch() without the bearer token and swallowed the
// resulting 401 in an empty catch, so the page rendered a normal-looking empty
// state. In a litigation tool that is worse than an error: it tells an attorney
// there are no exhibits when in fact nothing was ever loaded.

import { authorizedFetch as renewingFetch, SESSION_EXPIRED_MESSAGE, SessionExpiredError } from './session';

const API_BASE = '/api';

export interface LoadResult<T> {
  /** Parsed body when the request succeeded. */
  data: T | null;
  /**
   * Null when the load succeeded. Otherwise a message describing why the view
   * has no data, suitable for showing to the user.
   */
  unavailableReason: string | null;
}

export async function authedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return renewingFetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  });
}

/**
 * Load a panel's data, returning an explanation instead of throwing so the
 * view can distinguish "nothing to show" from "could not be loaded".
 */
export async function loadPanel<T>(path: string, label: string): Promise<LoadResult<T>> {
  let res: Response;
  try {
    res = await authedFetch(path);
  } catch (err) {
    if (err instanceof SessionExpiredError) {
      return { data: null, unavailableReason: SESSION_EXPIRED_MESSAGE };
    }
    return {
      data: null,
      unavailableReason: `${label} could not be loaded because the server could not be reached. Check your connection and reload.`,
    };
  }

  // Always drain the body, including on failures. An unread response stream
  // leaves the connection open, which is enough to keep the page from ever
  // reaching network idle.
  const body = await res.text().catch(() => '');

  if (res.status === 401) {
    return { data: null, unavailableReason: SESSION_EXPIRED_MESSAGE };
  }
  if (res.status === 403) {
    return { data: null, unavailableReason: `You do not have permission to view ${label.toLowerCase()} for this case.` };
  }
  if (res.status === 404) {
    return {
      data: null,
      unavailableReason: `${label} is not available for this case yet. This part of the platform is still being rolled out.`,
    };
  }
  if (!res.ok) {
    return {
      data: null,
      unavailableReason: `${label} could not be loaded (server returned ${res.status}). Please retry shortly.`,
    };
  }

  try {
    return { data: JSON.parse(body) as T, unavailableReason: null };
  } catch {
    return { data: null, unavailableReason: `${label} could not be read because the server returned an unexpected response.` };
  }
}
