import api, { unwrap } from "./api";

/**
 * Home page content — replaces the Firebase `homePage/mainContent` node.
 */

/** Public read. Always resolves to an object, even before any content is saved. */
export async function getHomeContent() {
  const response = await api.get("/home-content");
  return unwrap(response)?.content ?? null;
}

/** Replaces `set(ref(db, "homePage/mainContent"), payload)`. Admin only. */
export async function saveHomeContent(payload) {
  const response = await api.put("/home-content", payload);
  return unwrap(response)?.content ?? null;
}

/** Resets every homepage section. Admin only. */
export async function clearHomeContent() {
  const response = await api.delete("/home-content");
  return unwrap(response)?.content ?? null;
}
