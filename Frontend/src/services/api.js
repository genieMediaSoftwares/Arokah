import axios from "axios";

/**
 * The single HTTP client for the app. Every request to our backend goes through
 * here — the frontend has no other network dependency and no database access.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api").replace(/\/$/, "");

const ACCESS_TOKEN_KEY = "arokah.accessToken";

/**
 * The access token is short-lived and kept in localStorage so a page refresh
 * keeps the admin signed in. The refresh token is NOT here — it lives in an
 * httpOnly cookie the browser sends automatically, out of reach of JavaScript.
 */
export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (token) => {
    try {
      if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
      else localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // Private browsing can block storage; the session just won't survive a reload.
    }
  },
  clear: () => tokenStore.set(null),
  /**
   * Whether this browser has ever held a session. Used to avoid firing a
   * pointless /auth/refresh for a visitor who has simply never signed in —
   * that request can only fail, and it burns the auth rate limit.
   */
  exists: () => Boolean(tokenStore.get()),
};

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // sends the refresh cookie on /api/auth calls
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Refresh coordination: when several requests 401 at once, only the first one
 * calls /auth/refresh and the rest wait on that same promise. Without this a
 * dashboard that fires five parallel requests would trigger five refreshes and
 * the token rotation would invalidate itself.
 */
let refreshPromise = null;
const sessionExpiredListeners = new Set();

export function onSessionExpired(listener) {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired() {
  tokenStore.clear();
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // A broken listener must not stop the others from running.
    }
  });
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${BASE_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const token = response.data?.data?.accessToken;
        if (!token) throw new Error("No access token in the refresh response");
        tokenStore.set(token);
        return token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

const RETRYABLE_STATUSES = new Set([502, 503, 504]);
const MAX_NETWORK_RETRIES = 2;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const status = error.response?.status;

    // 401 → try exactly one silent refresh, then replay the original request.
    //
    // Only worth doing when this browser actually held a token: an anonymous
    // visitor has no refresh cookie, so refreshing could only fail while still
    // consuming the auth rate limit — which would then lock them out of /login.
    const canRefresh =
      status === 401 &&
      !config._retriedAfterRefresh &&
      !config.url?.includes("/auth/refresh") &&
      tokenStore.exists();

    if (canRefresh) {
      config._retriedAfterRefresh = true;
      try {
        await refreshAccessToken();
        return api(config);
      } catch {
        notifySessionExpired();
        return Promise.reject(normalizeError(error));
      }
    }

    if (status === 401) notifySessionExpired();

    // Transient network/gateway failures get a couple of backed-off retries.
    const isTransient = !error.response || RETRYABLE_STATUSES.has(status);
    const isIdempotent = ["get", "head", "options"].includes((config.method || "get").toLowerCase());

    if (isTransient && isIdempotent && error.code !== "ECONNABORTED") {
      config._retryCount = (config._retryCount || 0) + 1;
      if (config._retryCount <= MAX_NETWORK_RETRIES) {
        await delay(300 * 2 ** (config._retryCount - 1));
        return api(config);
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

/**
 * Flattens an axios error into something a component can show directly.
 * The backend always replies { success, message, code, errors? }.
 */
export function normalizeError(error) {
  const response = error.response;

  if (!response) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return Object.assign(error, {
      message: offline
        ? "You appear to be offline. Check your connection and try again."
        : "Could not reach the server. Please try again.",
      code: "NETWORK_ERROR",
      status: 0,
      fieldErrors: [],
    });
  }

  const data = response.data || {};
  return Object.assign(error, {
    message: data.message || `Request failed (${response.status})`,
    code: data.code || "ERROR",
    status: response.status,
    fieldErrors: Array.isArray(data.errors) ? data.errors : [],
  });
}

/** Unwraps the `data` envelope so callers work with the payload directly. */
export function unwrap(response) {
  return response?.data?.data ?? null;
}

/** Unwraps `data` plus the pagination `meta` block. */
export function unwrapWithMeta(response) {
  return { data: response?.data?.data ?? null, meta: response?.data?.meta ?? null };
}

export { BASE_URL };
export default api;
