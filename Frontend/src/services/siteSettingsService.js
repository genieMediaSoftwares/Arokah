import api, { unwrap } from "./api";

/**
 * Site branding and contact details. These live in MongoDB rather than in the
 * frontend bundle, so an admin can change the company name or phone number
 * without a rebuild and redeploy.
 */

export async function getSiteSettings() {
  const response = await api.get("/site-settings");
  return unwrap(response)?.settings ?? null;
}

export async function saveSiteSettings(payload) {
  const response = await api.put("/site-settings", payload);
  return unwrap(response)?.settings ?? null;
}

/** Blank shape used before the API responds, and by the admin form. */
export function emptySiteSettings() {
  return {
    companyName: "",
    tagline: "",
    logo: "",
    favicon: "",
    contact: { phone: "", whatsappNumber: "", whatsappMessage: "", email: "", address: "" },
    socialLinks: [],
    footer: { description: "", copyrightText: "" },
    about: { heading: "", subheading: "", body: "", image: "" },
  };
}

/** Builds a wa.me link, or null when no WhatsApp number is configured. */
export function buildWhatsappLink(contact) {
  const number = String(contact?.whatsappNumber || "").replace(/\D/g, "");
  if (!number) return null;

  const message = contact?.whatsappMessage;
  return message
    ? `https://wa.me/${number}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${number}`;
}
