import api, { tokenStore, unwrap } from "./api";

/**
 * Admin authentication. Replaces Firebase Auth entirely — credentials are
 * checked by our own backend against a bcrypt hash in MongoDB.
 */

export async function login({ email, password }) {
  const response = await api.post("/auth/login", { email, password });
  const data = unwrap(response);
  tokenStore.set(data.accessToken);
  return data.user;
}

export async function register({ name, email, phone, password }) {
  const response = await api.post("/auth/register", { name, email, phone, password });
  const data = unwrap(response);
  tokenStore.set(data.accessToken);
  return data.user;
}

/** Resolves the signed-in user, or null when there is no valid session. */
export async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return unwrap(response)?.user ?? null;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } finally {
    // Clear locally even if the network call fails — the user asked to sign out.
    tokenStore.clear();
  }
}

export async function changePassword({ currentPassword, newPassword }) {
  await api.post("/auth/change-password", { currentPassword, newPassword });
  tokenStore.clear();
}

export async function updateProfile({ name, phone }) {
  const response = await api.patch("/auth/me", { name, phone });
  return unwrap(response)?.user ?? null;
}

/**
 * Attempts to restore a session on page load. The access token in localStorage
 * may be expired; the api interceptor silently refreshes it using the httpOnly
 * cookie before this resolves.
 *
 * A visitor who has never signed in short-circuits here rather than making a
 * request that can only 401 — most people who load this site are anonymous, so
 * calling the API for them is pure waste.
 */
export async function restoreSession() {
  if (!tokenStore.exists()) return null;

  try {
    return await getCurrentUser();
  } catch {
    tokenStore.clear();
    return null;
  }
}
