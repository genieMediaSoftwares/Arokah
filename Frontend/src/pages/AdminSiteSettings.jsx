import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ImageUploader from "../components/ImageUploader";
import { useSiteSettings } from "../context/siteSettingsContext";
import { emptySiteSettings, getSiteSettings, saveSiteSettings } from "../services/siteSettingsService";

const inp =
  "w-full border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-white transition-all";

const SOCIAL_PLATFORMS = ["whatsapp", "instagram", "facebook", "linkedin", "youtube", "twitter"];

function Section({ number, icon, title, what, children }) {
  return (
    <section className="py-7">
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="sm:w-64 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">
              {number}
            </span>
            <h3 className="text-base font-extrabold text-slate-900">
              {icon} {title}
            </h3>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed">{what}</p>
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </section>
  );
}

function FieldLabel({ children }) {
  return <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">{children}</label>;
}

/** Editable list of `{ icon, title, description }` tiles. */
function CardListEditor({ items, onChange, addLabel, titlePlaceholder }) {
  const update = (index, field, value) =>
    onChange(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={index} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2.5">
          <input
            value={item.icon || ""}
            placeholder="🎉"
            onChange={(e) => update(index, "icon", e.target.value)}
            className={`${inp} sm:w-20 text-center`}
            aria-label="Icon"
          />
          <input
            value={item.title || ""}
            placeholder={titlePlaceholder}
            onChange={(e) => update(index, "title", e.target.value)}
            className={`${inp} sm:w-56`}
            aria-label="Title"
          />
          <input
            value={item.description || ""}
            placeholder="Short description…"
            onChange={(e) => update(index, "description", e.target.value)}
            className={`${inp} flex-1`}
            aria-label="Description"
          />
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== index))}
            title="Remove"
            className="flex-shrink-0 w-9 h-9 self-center rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-sm"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, { icon: "", title: "", description: "" }])}
        className="text-sm font-bold text-purple-600 hover:text-purple-700 border border-purple-200 hover:border-purple-400 rounded-xl px-4 py-2.5 transition-all active:scale-95"
      >
        + {addLabel}
      </button>
    </div>
  );
}

function AdminSiteSettings() {
  const navigate = useNavigate();
  const { refresh } = useSiteSettings();

  const [form, setForm] = useState(emptySiteSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSiteSettings()
      .then((data) => {
        if (data) setForm({ ...emptySiteSettings(), ...data });
      })
      .catch((err) => toast.error(err?.message || "Could not load site settings"))
      .finally(() => setLoading(false));
  }, []);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const setNested = (group, field, value) =>
    setForm((prev) => ({ ...prev, [group]: { ...prev[group], [field]: value } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveSiteSettings(form);
      // Re-pull so the navbar and footer show the change immediately.
      await refresh();
      toast.success("Site settings saved");
    } catch (err) {
      if (err?.status === 401 || err?.status === 403) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/admin");
      } else if (err?.fieldErrors?.length) {
        toast.error(err.fieldErrors[0].message);
      } else {
        toast.error(err?.message || "Could not save. Try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 mt-16 flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 mt-16 pb-28">
      <div className="w-full lg:w-[90%] mx-auto px-4 sm:px-6 lg:px-0">

        {/* HEADER */}
        <div className="py-6 sm:py-8 border-b border-slate-200">
          <button
            onClick={() => navigate("/admin/dashboard")}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-purple-600 transition-colors mb-5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </button>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">⚙️ Site Settings</h1>
              <p className="text-sm text-slate-500 mt-1">
                Your company name, logo, contact details and About page content. These appear across the whole site.
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap"
            >
              {saving ? (
                <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</>
              ) : (
                "💾 Save Settings"
              )}
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">

          {/* 01 BRAND */}
          <Section number="01" icon="🏷️" title="Brand" what="Your company name and logo, shown in the header, footer and browser tab.">
            <div className="space-y-5">
              <div>
                <FieldLabel>Company Name</FieldLabel>
                <input
                  value={form.companyName}
                  placeholder="Your company name"
                  onChange={(e) => setField("companyName", e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <FieldLabel>Tagline</FieldLabel>
                <input
                  value={form.tagline}
                  placeholder="e.g. Concerts, weddings, corporate events & more"
                  onChange={(e) => setField("tagline", e.target.value)}
                  className={inp}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ImageUploader
                  label="Logo"
                  value={form.logo}
                  onChange={(image) => setField("logo", image)}
                  folder="general"
                  aspect="aspect-square"
                  hint="Square image works best — it renders as a circle."
                />
                <ImageUploader
                  label="Favicon (browser tab icon)"
                  value={form.favicon}
                  onChange={(image) => setField("favicon", image)}
                  folder="general"
                  aspect="aspect-square"
                />
              </div>
            </div>
          </Section>

          {/* 02 CONTACT */}
          <Section number="02" icon="📞" title="Contact Details" what="Shown on the Contact page and in the footer. Leave a field blank to hide it.">
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Phone</FieldLabel>
                  <input
                    value={form.contact.phone}
                    placeholder="+91 98765 43210"
                    onChange={(e) => setNested("contact", "phone", e.target.value)}
                    className={inp}
                  />
                </div>
                <div>
                  <FieldLabel>Email</FieldLabel>
                  <input
                    value={form.contact.email}
                    placeholder="hello@yourcompany.com"
                    onChange={(e) => setNested("contact", "email", e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>WhatsApp Number</FieldLabel>
                  <input
                    value={form.contact.whatsappNumber}
                    placeholder="919876543210"
                    onChange={(e) => setNested("contact", "whatsappNumber", e.target.value)}
                    className={inp}
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Digits only, including the country code and no “+” or spaces.
                  </p>
                </div>
                <div>
                  <FieldLabel>Pre-filled WhatsApp Message</FieldLabel>
                  <input
                    value={form.contact.whatsappMessage}
                    placeholder="Hello! I'd like to know more about your events."
                    onChange={(e) => setNested("contact", "whatsappMessage", e.target.value)}
                    className={inp}
                  />
                </div>
              </div>
              <div>
                <FieldLabel>Address</FieldLabel>
                <textarea
                  rows={2}
                  value={form.contact.address}
                  placeholder="Street, city, state, postcode"
                  onChange={(e) => setNested("contact", "address", e.target.value)}
                  className={inp + " resize-none"}
                />
              </div>
            </div>
          </Section>

          {/* 03 SOCIAL */}
          <Section number="03" icon="🔗" title="Social Links" what="Icons shown in the footer. Recognised platforms get their own icon.">
            <div className="space-y-3">
              {form.socialLinks.map((link, index) => (
                <div key={index} className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row gap-2.5">
                  <input
                    list="social-platforms"
                    value={link.platform || ""}
                    placeholder="instagram"
                    onChange={(e) =>
                      setField(
                        "socialLinks",
                        form.socialLinks.map((l, i) => (i === index ? { ...l, platform: e.target.value } : l))
                      )
                    }
                    className={`${inp} sm:w-44`}
                  />
                  <input
                    value={link.url || ""}
                    placeholder="https://instagram.com/yourhandle"
                    onChange={(e) =>
                      setField(
                        "socialLinks",
                        form.socialLinks.map((l, i) => (i === index ? { ...l, url: e.target.value } : l))
                      )
                    }
                    className={`${inp} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => setField("socialLinks", form.socialLinks.filter((_, i) => i !== index))}
                    className="flex-shrink-0 w-9 h-9 self-center rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-sm"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <datalist id="social-platforms">
                {SOCIAL_PLATFORMS.map((p) => <option key={p} value={p} />)}
              </datalist>
              <button
                type="button"
                onClick={() => setField("socialLinks", [...form.socialLinks, { platform: "", url: "" }])}
                className="text-sm font-bold text-purple-600 hover:text-purple-700 border border-purple-200 hover:border-purple-400 rounded-xl px-4 py-2.5 transition-all active:scale-95"
              >
                + Add Social Link
              </button>
            </div>
          </Section>

          {/* 04 FOOTER */}
          <Section number="04" icon="📄" title="Footer" what="The short blurb under your logo and the copyright line at the bottom.">
            <div className="space-y-5">
              <div>
                <FieldLabel>Footer Description</FieldLabel>
                <textarea
                  rows={2}
                  value={form.footer.description}
                  placeholder="Concerts, weddings, corporate events & more."
                  onChange={(e) => setNested("footer", "description", e.target.value)}
                  className={inp + " resize-none"}
                />
              </div>
              <div>
                <FieldLabel>Copyright Text</FieldLabel>
                <input
                  value={form.footer.copyrightText}
                  placeholder="Leave blank to generate automatically from the company name"
                  onChange={(e) => setNested("footer", "copyrightText", e.target.value)}
                  className={inp}
                />
              </div>
            </div>
          </Section>

          {/* 05 ABOUT PAGE */}
          <Section number="05" icon="ℹ️" title="About Page" what="Everything on the About page. Each section is hidden until you give it content.">
            <div className="space-y-5">
              <div>
                <FieldLabel>Page Heading</FieldLabel>
                <input
                  value={form.about.heading}
                  placeholder="e.g. About Our Event Management"
                  onChange={(e) => setNested("about", "heading", e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <FieldLabel>Page Subheading</FieldLabel>
                <textarea
                  rows={2}
                  value={form.about.subheading}
                  placeholder="One or two sentences shown under the heading."
                  onChange={(e) => setNested("about", "subheading", e.target.value)}
                  className={inp + " resize-none"}
                />
              </div>
              <div>
                <FieldLabel>Main Text</FieldLabel>
                <textarea
                  rows={7}
                  value={form.about.body}
                  placeholder="Tell visitors who you are. Leave a blank line between paragraphs."
                  onChange={(e) => setNested("about", "body", e.target.value)}
                  className={inp + " resize-none"}
                />
                <p className="text-xs text-slate-400 mt-1.5">Leave a blank line between paragraphs.</p>
              </div>
              <ImageUploader
                label="About Image"
                value={form.about.image}
                onChange={(image) => setNested("about", "image", image)}
                folder="general"
                aspect="aspect-[4/3]"
              />
              <div>
                <FieldLabel>“What We Do” Tiles</FieldLabel>
                <CardListEditor
                  items={form.about.services}
                  onChange={(items) => setNested("about", "services", items)}
                  addLabel="Add Service"
                  titlePlaceholder="e.g. Wedding Planning"
                />
              </div>
              <div>
                <FieldLabel>“Why Choose Us” Tiles</FieldLabel>
                <CardListEditor
                  items={form.about.features}
                  onChange={(items) => setNested("about", "features", items)}
                  addLabel="Add Reason"
                  titlePlaceholder="e.g. Professional Team"
                />
              </div>
            </div>
          </Section>

        </div>

        {/* Sticky save bar */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-slate-200 py-4 mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-6 py-3 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95"
          >
            {saving ? (
              <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</>
            ) : (
              "💾 Save Settings"
            )}
          </button>
        </div>

      </div>
    </div>
  );
}

export default AdminSiteSettings;
