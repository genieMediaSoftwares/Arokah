import api, { unwrap, unwrapWithMeta } from "./api";

/**
 * Event CRUD. Every call that used to be a Firebase Realtime Database
 * operation (onValue / get / push / update / remove) is now a REST call.
 */

/** Replaces `onValue(ref(db, "events"))` — returns the current list once. */
export async function listEvents({ status, search, page, limit } = {}) {
  const response = await api.get("/events", { params: { status, search, page, limit } });
  const { data, meta } = unwrapWithMeta(response);
  return { events: data?.events ?? [], meta };
}

/** Replaces `get(ref(db, `events/${id}`))`. */
export async function getEvent(id) {
  const response = await api.get(`/events/${id}`);
  return unwrap(response)?.event ?? null;
}

/** Replaces `push(ref(db, "events"), payload)`. */
export async function createEvent(payload) {
  const response = await api.post("/events", payload);
  return unwrap(response)?.event ?? null;
}

/** Replaces `update(ref(db, `events/${id}`), payload)`. */
export async function updateEvent(id, payload) {
  const response = await api.put(`/events/${id}`, payload);
  return unwrap(response)?.event ?? null;
}

/** Replaces `remove(ref(db, `events/${id}`))`. */
export async function deleteEvent(id) {
  const response = await api.delete(`/events/${id}`);
  return unwrap(response);
}

export async function getEventStats() {
  const response = await api.get("/events/stats");
  return unwrap(response)?.stats ?? null;
}
