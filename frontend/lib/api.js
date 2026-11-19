// The only place the frontend talks to the backend.
// Every call goes to /api/..., which Next.js forwards to Express
// (see next.config.mjs), and every failure becomes an ApiError with the
// same fields the backend sends: status, code, message, details.

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;   // HTTP status, or 0 if the server couldn't be reached
    this.code = code;       // e.g. "VALIDATION_ERROR", "STALE_RECORD"
    this.details = details; // e.g. { contact: "Enter a valid email…" }
  }
}

// Used when a response has no error body (e.g. the API is down and the proxy
// returns a plain 500/502 page).
function fallbackMessage(status) {
  if (status >= 500) return 'The server is having trouble right now. Please try again in a moment.';
  if (status === 404) return 'Not found.';
  return 'Something went wrong. Please try again.';
}

// --- Session-expiry notifications ------------------------------------------
// When any request comes back 401, the session has ended (expired, or the user
// logged out in another tab). The auth gate listens for this and sends the
// user to the login page.
const unauthorizedListeners = new Set();

export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

// The auth endpoints answer 401 as a normal result ("wrong password",
// "not signed in yet"), so they don't count as a session ending.
const AUTH_PATHS = ['/auth/login', '/auth/me'];

// ---------------------------------------------------------------------------

export async function request(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin', // send the session cookie
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err; // request was cancelled on purpose
    throw new ApiError(0, 'NETWORK_ERROR', "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return null;

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Not JSON (e.g. a proxy error page). Handled below.
  }

  if (!res.ok) {
    const e = data?.error;
    const error = new ApiError(
      res.status,
      e?.code ?? `HTTP_${res.status}`,
      e?.message ?? fallbackMessage(res.status),
      e?.details,
    );
    if (res.status === 401 && !AUTH_PATHS.includes(path)) {
      unauthorizedListeners.forEach((listener) => listener(error));
    }
    throw error;
  }

  return data;
}

// Builds "?status=NEW&q=refund", skipping empty values.
function toQueryString(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

// --- Endpoints ----------------------------------------------------------------

export const api = {
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  listInquiries: (params, { signal } = {}) => request(`/inquiries${toQueryString(params)}`, { signal }),
  getInquiry: (id, { signal } = {}) => request(`/inquiries/${encodeURIComponent(id)}`, { signal }),
  createInquiry: (data) => request('/inquiries', { method: 'POST', body: data }),
  changeStatus: (id, { status, version }) =>
    request(`/inquiries/${encodeURIComponent(id)}/status`, { method: 'PATCH', body: { status, version } }),
};
