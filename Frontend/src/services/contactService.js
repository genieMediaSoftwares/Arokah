import api, { unwrap } from "./api";

/**
 * Contact form. Replaces the client-side EmailJS integration: the enquiry is now
 * stored in MongoDB and both notification emails are sent by the backend, so no
 * mail credentials exist in the browser bundle.
 */
export async function submitEnquiry({ name, phone, email, eventName, members, message }) {
  const response = await api.post("/contact", { name, phone, email, eventName, members, message });
  return unwrap(response);
}

export async function listEnquiries({ status, page, limit } = {}) {
  const response = await api.get("/contact", { params: { status, page, limit } });
  return { messages: unwrap(response)?.messages ?? [], meta: response?.data?.meta ?? null };
}

export async function updateEnquiryStatus(id, status) {
  const response = await api.patch(`/contact/${id}/status`, { status });
  return unwrap(response)?.enquiry ?? null;
}
