import { useEffect, useState } from "react";
import { getEvent, updateEvent } from "../services/eventService";
import { toast } from "react-toastify";
import { useNavigate, useParams } from "react-router-dom";
import ImageUploader from "../components/ImageUploader";
import logger from "../utils/logger";

/* ─────────────────────────────────────────
   HELPERS  — 12h ↔ 24h conversion
───────────────────────────────────────── */
function build12h({ hour, minute, ampm }) {
  if (!hour || !minute || !ampm) return "";
  return `${hour}:${minute} ${ampm}`;
}

function to24h({ hour, minute, ampm }) {
  if (!hour || !minute || !ampm) return "";
  let h = parseInt(hour, 10);
  if (ampm === "AM" && h === 12) h = 0;
  if (ampm === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

// Convert stored 24h string "20:30" → { hour: "8", minute: "30", ampm: "PM" }
function from24h(time24) {
  if (!time24) return { hour: "", minute: "", ampm: "" };
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { hour: String(h), minute: mStr || "00", ampm };
}

// Convert stored 12h string "8:30 PM" → { hour: "8", minute: "30", ampm: "PM" }
function from12hStr(time12) {
  if (!time12) return { hour: "", minute: "", ampm: "" };
  const parts = time12.split(" ");
  if (parts.length < 2) return { hour: "", minute: "", ampm: "" };
  const [timePart, ampm] = parts;
  const [hour, minute] = timePart.split(":");
  return { hour: hour || "", minute: minute || "00", ampm: ampm || "" };
}

/* ─────────────────────────────────────────
   12-HOUR TIME PICKER COMPONENT
───────────────────────────────────────── */
const HOURS   = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];

function TimePicker12h({ value, onChange, label }) {
  const sel = "border border-slate-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-3 py-3 text-base text-slate-700 bg-white transition-all cursor-pointer";
  const update = (field, val) => onChange({ ...value, [field]: val });

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <select value={value.hour} onChange={(e) => update("hour", e.target.value)} className={sel + " flex-1"}>
          <option value="">HH</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-slate-400 font-bold text-lg">:</span>
        <select value={value.minute} onChange={(e) => update("minute", e.target.value)} className={sel + " flex-1"}>
          <option value="">MM</option>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={value.ampm} onChange={(e) => update("ampm", e.target.value)} className={sel + " w-20"}>
          <option value="">--</option>
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
      {build12h(value) && (
        <p className="text-xs text-purple-600 font-semibold mt-1.5 pl-1">
          → Displays as: <strong>{build12h(value)}</strong>
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   CATEGORY CONFIG
───────────────────────────────────────── */
const CATEGORIES = [
  { key: "game",  label: "🎮 Game / Activity", color: "blue",   placeholder: "e.g. Cricket Match, Treasure Hunt, Kabaddi, Tug of War…" },
  { key: "food",  label: "🍽️ Food / Drink",    color: "orange", placeholder: "e.g. Biryani Stall, Mocktail Bar, Dessert Buffet…"       },
  { key: "music", label: "🎵 Music / DJ",       color: "purple", placeholder: "e.g. Live Band, DJ Night, Classical Music Performance…"  },
  { key: "other", label: "✨ Other",            color: "slate",  placeholder: "e.g. Photo Booth, Lucky Draw, Raffle, Gifts…"           },
];

const COLOR_MAP = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-200",   badge: "bg-blue-100 border-blue-200 text-blue-700",      dot: "bg-blue-500"   },
  orange: { bg: "bg-orange-50", border: "border-orange-200", badge: "bg-orange-100 border-orange-200 text-orange-700", dot: "bg-orange-500" },
  purple: { bg: "bg-purple-50", border: "border-purple-200", badge: "bg-purple-100 border-purple-200 text-purple-700", dot: "bg-purple-500" },
  slate:  { bg: "bg-slate-50",  border: "border-slate-200",  badge: "bg-slate-100 border-slate-200 text-slate-600",    dot: "bg-slate-400"  },
};

/* ─────────────────────────────────────────
   COMPONENT
───────────────────────────────────────── */
function EditEvent() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // Basic fields
  const [title, setTitle]             = useState("");
  const [type, setType]               = useState("");
  const [price, setPrice]             = useState("");
  const [phone, setPhone]             = useState("");
  const [location, setLocation]       = useState("");
  const [eventDate, setEventDate]     = useState("");
  const [description, setDescription] = useState("");
  const [imageURL, setImageURL]       = useState("");
  const [status, setStatus]           = useState("upcoming");

  // 12h time state objects
  const [startTime, setStartTime] = useState({ hour: "", minute: "", ampm: "" });
  const [endTime, setEndTime]     = useState({ hour: "", minute: "", ampm: "" });

  // Extras (Games, Food, Music, Other)
  const [extras, setExtras] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  /* ── Fetch existing event data ── */
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const d = await getEvent(id);
        if (d) {
          setTitle(d.title || "");
          setType(d.type || "");
          setPrice(d.price || "");
          setPhone(d.phone || "");
          setLocation(d.location || "");
          setEventDate(d.eventDate || "");
          setDescription(d.description || "");
          setImageURL(d.mainImage || "");
          setStatus(d.status || "upcoming");

          if (d.startTime) {
            setStartTime(from24h(d.startTime));
          } else if (d.startTime12h) {
            setStartTime(from12hStr(d.startTime12h));
          }
          if (d.endTime) {
            setEndTime(from24h(d.endTime));
          } else if (d.endTime12h) {
            setEndTime(from12hStr(d.endTime12h));
          }

          const savedExtras = d.extras || d.extraFields || [];
          // Reuse the server-side `key` as the local row id so re-saving keeps
          // each add-on's identity stable instead of minting a new one.
          setExtras(
            savedExtras.map((ex) => ({
              ...ex,
              id: String(ex.key || ex.id || `extra-${Date.now()}-${Math.random()}`),
            }))
          );
        } else {
          toast.error("Event not found");
          navigate("/admin/dashboard");
        }
      } catch (err) {
        logger.error("Failed to load event", err);
        if (err?.status === 404) {
          toast.error("Event not found");
          navigate("/admin/dashboard");
        } else {
          toast.error(err?.message || "Failed to load event");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, navigate]);

  /* ── Extras helpers ── */
  const addExtra = (category) =>
    setExtras([...extras, { id: Date.now(), category, name: "", description: "", price: "", imageURL: "" }]);

  const removeExtra = (eid) => setExtras(extras.filter((e) => e.id !== eid));

  const updateExtra = (eid, field, value) =>
    setExtras(extras.map((e) => (e.id === eid ? { ...e, [field]: value } : e)));

  const countByCategory = (key) => extras.filter((e) => e.category === key).length;

  /* ── UPDATE ── */
  const handleUpdate = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!title || !imageURL) {
      toast.error("Event title and banner image are required");
      return;
    }

    const startTime12h = build12h(startTime);
    const endTime12h   = build12h(endTime);
    const startTime24h = to24h(startTime);
    const endTime24h   = to24h(endTime);

    setSubmitting(true);
    try {
      await updateEvent(id, {
        title, type, price, phone, location,
        eventDate,
        startTime: startTime24h,
        endTime:   endTime24h,
        startTime12h,
        endTime12h,
        description,
        mainImage: imageURL,
        extras,
        status,
        // updatedAt is stamped by the server.
      });
      toast.success("Event updated successfully!");
      navigate("/admin/dashboard");
    } catch (err) {
      logger.error("Error updating event", err);
      if (err?.status === 401 || err?.status === 403) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/admin");
      } else if (err?.fieldErrors?.length) {
        toast.error(err.fieldErrors[0].message);
      } else {
        toast.error(err?.message || "Error updating event. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inp = "w-full border border-slate-300 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-4 py-3 text-base text-slate-700 placeholder-slate-400 bg-white transition-all";

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-white mt-16 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
          <p className="text-slate-500 font-semibold">Loading event…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white mt-16 pb-24">
      <form onSubmit={handleUpdate}>
        <div className="w-[92%] mx-auto">

          {/* ══ PAGE HEADER ══ */}
          <div className="py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => navigate("/admin")}
                  className="text-base font-semibold text-slate-500 hover:text-purple-600 transition-colors">
                  Back
                </button>
                <span className="text-slate-400 text-lg">/</span>
                <span className="text-base font-semibold text-slate-800">Edit Event</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">Edit Event</h1>
              <p className="text-base text-slate-500 mt-1.5">Update the details below. Changes will go live on your website instantly after saving.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => navigate("/admin/dashboard")}
                className="border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap">
                ← Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap">
                {submitting ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
                ) : (
                  "💾 Save Changes"
                )}
              </button>
            </div>
          </div>

          {/* ══ QUICK GUIDE ══ */}
          <div className="mt-8 bg-purple-50 border border-purple-200 rounded-2xl px-6 py-5 flex flex-col sm:flex-row gap-4 sm:items-start">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-lg">💡</div>
            <div>
              <h4 className="text-base font-bold text-purple-700 mb-1">Admin Quick Guide</h4>
              <ul className="text-sm text-purple-600 space-y-0.5 list-disc ml-4">
                <li>Title and a banner image are <strong>required</strong> — everything else is optional but recommended.</li>
                <li>Times are picked in <strong>12-hour AM/PM format</strong> directly.</li>
                <li>Set status to <strong>Upcoming</strong> or <strong>Live</strong> — changes apply instantly.</li>
                <li>In <strong>Section 06</strong>, add, edit, or remove Games, Food, Music, or any extras already saved.</li>
              </ul>
            </div>
          </div>

          <div className="divide-y divide-slate-200 mt-2">

            {/* ── 01 EVENT BASICS ── */}
            <Section number="01" title="Event Basics" description="Core details shown on the event listing — title and type help visitors find your event.">
              <div className="space-y-5">
                <div>
                  <Label required>Event Title</Label>
                  <input placeholder="e.g. Grand Wedding Reception, DJ Night, Corporate Gala…"
                    value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
                </div>
                <div>
                  <Label>Event Type</Label>
                  <input placeholder="e.g. Wedding, Birthday, Corporate, Concert…"
                    value={type} onChange={(e) => setType(e.target.value)} className={inp} />
                </div>
                <div>
                  <Label>Description</Label>
                  <textarea rows={4} placeholder="Describe the event — what makes it special, what guests can expect…"
                    value={description} onChange={(e) => setDescription(e.target.value)}
                    className={inp + " resize-none"} />
                </div>
              </div>
            </Section>

            {/* ── 02 STATUS ── */}
            <Section number="02" title="Event Status" description="Choose whether this event is Upcoming or Live. Changes apply instantly.">
              <div className="flex flex-col sm:flex-row gap-4">
                <button type="button" onClick={() => setStatus("upcoming")}
                  className={`flex-1 flex items-center gap-4 border-2 rounded-2xl px-5 py-4 text-left transition-all active:scale-95 ${status === "upcoming" ? "border-purple-500 bg-purple-50 shadow-md shadow-purple-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className={`text-sm font-extrabold uppercase tracking-wider ${status === "upcoming" ? "text-purple-700" : "text-slate-700"}`}>Upcoming</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">Event is listed but not yet happening. Shown with an "Upcoming" badge.</p>
                  </div>
                  {status === "upcoming" && <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-bold">✓</span>}
                </button>
                <button type="button" onClick={() => setStatus("live")}
                  className={`flex-1 flex items-center gap-4 border-2 rounded-2xl px-5 py-4 text-left transition-all active:scale-95 ${status === "live" ? "border-emerald-500 bg-emerald-50 shadow-md shadow-emerald-100" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                  <span className="text-2xl">🟢</span>
                  <div>
                    <p className={`text-sm font-extrabold uppercase tracking-wider ${status === "live" ? "text-emerald-700" : "text-slate-700"}`}>Live</p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-snug">Event is currently happening. Shown with a pulsing "Live" badge.</p>
                  </div>
                  {status === "live" && <span className="ml-auto flex-shrink-0 w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">✓</span>}
                </button>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Badge preview:</p>
                {status === "upcoming"
                  ? <span className="inline-flex items-center gap-1.5 bg-purple-100 text-purple-700 text-xs font-bold px-3 py-1 rounded-full border border-purple-200">📅 Upcoming</span>
                  : <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" /> Live Now</span>}
              </div>
            </Section>

            {/* ── 03 DATE & TIME ── */}
            <Section number="03" title="Date & Time" description="Set the event date and timing. Pick hours, minutes, and AM/PM directly — no conversion needed.">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <Label>Event Date</Label>
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className={inp} />
                </div>
                <TimePicker12h label="Start Time" value={startTime} onChange={setStartTime} />
                <TimePicker12h label="End Time"   value={endTime}   onChange={setEndTime}   />
              </div>
            </Section>

            {/* ── 04 CONTACT & LOCATION ── */}
            <Section number="04" title="Contact & Location" description="Provide booking price, contact number, and venue address for interested guests.">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <Label>Price / Package</Label>
                  <input placeholder="e.g. ₹15,000 / Starting from ₹10,000"
                    value={price} onChange={(e) => setPrice(e.target.value)} className={inp} />
                </div>
                <div>
                  <Label>Phone Number</Label>
                  <input placeholder="e.g. +91 98765 43210"
                    value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Venue / Location</Label>
                  <input placeholder="e.g. Grand Ballroom, Hotel Marriott, Hyderabad"
                    value={location} onChange={(e) => setLocation(e.target.value)} className={inp} />
                </div>
              </div>
            </Section>

            {/* ── 05 EVENT IMAGE ── */}
            <Section number="05" title="Event Image" description="Upload the main event banner image. A high-resolution horizontal photo works best.">
              <div>
                <Label required>Event Banner</Label>
                <ImageUploader
                  value={imageURL}
                  onChange={setImageURL}
                  folder="events"
                  aspect="aspect-[16/9]"
                  hint="Replacing this image removes the old file from the server automatically."
                />
              </div>
            </Section>

            {/* ── 06 EVENT EXTRAS ── */}
            <Section
              number="06"
              title="Event Extras"
              description="Edit or add Games, Food stalls, Music acts, and more. Existing items are pre-loaded — update, remove, or add new ones."
            >
              {/* Step 1 — Add buttons */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Step 1 —</span>
                  <span className="text-sm font-semibold text-slate-600">Choose what you want to add</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">Click a button to add a new item. Existing items are shown below.</p>
                <div className="flex flex-wrap gap-3">
                  {CATEGORIES.map((cat) => {
                    const c = COLOR_MAP[cat.color];
                    const count = countByCategory(cat.key);
                    return (
                      <button key={cat.key} type="button" onClick={() => addExtra(cat.key)}
                        className={`flex items-center gap-2 border-2 ${c.border} ${c.bg} hover:opacity-80 active:scale-95 text-sm font-bold px-4 py-2.5 rounded-xl transition-all`}>
                        {cat.label}
                        {count > 0 && (
                          <span className={`text-xs font-extrabold px-1.5 py-0.5 rounded-full border ${c.badge}`}>{count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 2 label */}
              {extras.length > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-extrabold text-slate-700 uppercase tracking-wider">Step 2 —</span>
                  <span className="text-sm font-semibold text-slate-600">Update the details for each item</span>
                </div>
              )}

              {/* Empty state */}
              {extras.length === 0 && (
                <div className="w-full py-12 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center gap-2 text-center px-4">
                  <span className="text-5xl">🎪</span>
                  <p className="text-slate-600 font-bold text-base mt-1">No extras yet</p>
                  <p className="text-slate-400 text-sm max-w-sm">
                    Use the buttons above to add Games, Food, Music acts, or anything else at your event.
                  </p>
                </div>
              )}

              {/* Extra item cards */}
              <div className="space-y-5">
                {extras.map((extra, index) => {
                  const cat   = CATEGORIES.find((c) => c.key === extra.category);
                  const color = COLOR_MAP[cat?.color || "slate"];
                  return (
                    <div key={extra.id} className={`rounded-2xl border-2 ${color.border} overflow-hidden shadow-sm`}>

                      {/* Card header */}
                      <div className={`flex items-center justify-between px-5 py-3 ${color.bg} border-b ${color.border}`}>
                        <div className="flex items-center gap-2.5">
                          <span className={`w-7 h-7 rounded-full ${color.dot} flex items-center justify-center text-white text-xs font-extrabold flex-shrink-0`}>
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-sm font-extrabold text-slate-700">{cat?.label || "Extra"}</p>
                            {extra.name && <p className="text-xs text-slate-500 leading-none mt-0.5">"{extra.name}"</p>}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeExtra(extra.id)}
                          className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-white bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 px-3 py-1.5 rounded-lg transition-all active:scale-95">
                          ✕ Remove
                        </button>
                      </div>

                      {/* Card body */}
                      <div className="p-5 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4">

                        {/* Name */}
                        <div className="sm:col-span-2">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Name <span className="text-red-400">*</span>
                            <span className="text-slate-300 font-normal normal-case tracking-normal">— What is this item?</span>
                          </label>
                          <input placeholder={cat?.placeholder || "Enter a name…"} value={extra.name}
                            onChange={(e) => updateExtra(extra.id, "name", e.target.value)} className={inp} />
                        </div>

                        {/* Description */}
                        <div className="sm:col-span-2">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Description
                            <span className="text-slate-300 font-normal normal-case tracking-normal">— Rules, details, or what's included</span>
                          </label>
                          <textarea rows={2}
                            placeholder="e.g. Teams of 5 players. Open to all guests. Winner gets a prize."
                            value={extra.description}
                            onChange={(e) => updateExtra(extra.id, "description", e.target.value)}
                            className={inp + " resize-none"} />
                        </div>

                        {/* Price */}
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Price <span className="text-slate-300 font-normal normal-case tracking-normal">— Optional</span>
                          </label>
                          <input placeholder="e.g. Free   /   ₹200 per person"
                            value={extra.price} onChange={(e) => updateExtra(extra.id, "price", e.target.value)} className={inp} />
                        </div>

                        {/* Item photo */}
                        <div className="sm:col-span-2">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Photo <span className="text-slate-300 font-normal normal-case tracking-normal">— Optional</span>
                          </label>
                          <ImageUploader
                            value={extra.imageURL}
                            onChange={(image) => updateExtra(extra.id, "imageURL", image)}
                            folder="events"
                            aspect="aspect-[16/9]"
                            compact
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary bar */}
              {extras.length > 0 && (
                <div className="mt-5 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap gap-2 items-center">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Items:</p>
                  {CATEGORIES.map((cat) => {
                    const count = countByCategory(cat.key);
                    if (count === 0) return null;
                    const c = COLOR_MAP[cat.color];
                    return (
                      <span key={cat.key} className={`text-xs font-bold px-3 py-1 rounded-full border ${c.badge}`}>
                        {cat.label} × {count}
                      </span>
                    );
                  })}
                  <span className="ml-auto text-xs text-slate-400 font-semibold">
                    {extras.length} item{extras.length > 1 ? "s" : ""} total
                  </span>
                </div>
              )}
            </Section>

          </div>

          {/* ══ BOTTOM SAVE BAR ══ */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-8 pb-4 border-t border-slate-200 mt-2">
            <div>
              <p className="text-base font-semibold text-slate-700">Ready to save changes?</p>
              <p className="text-sm text-slate-400 mt-0.5">Updates will appear on your website instantly after saving.</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" onClick={() => navigate("/admin/dashboard")}
                className="border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap">
                ← Cancel
              </button>
              <button type="submit" disabled={submitting}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-7 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap">
                {submitting ? (
                  <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
                ) : (
                  "💾 Save Changes"
                )}
              </button>
            </div>
          </div>

        </div>
      </form>
    </div>
  );
}

export default EditEvent;

/* ─── SECTION ─── */
const Section = ({ number, title, description, children }) => (
  <div className="py-10 flex flex-col lg:flex-row gap-6 lg:gap-12">
    <div className="lg:w-72 xl:w-80 flex-shrink-0">
      <div className="flex items-center gap-3 mb-2">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 text-purple-600 text-sm font-extrabold flex-shrink-0">
          {number}
        </span>
        <h3 className="text-xl font-bold text-slate-800">{title}</h3>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed pl-11">{description}</p>
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

/* ─── LABEL ─── */
const Label = ({ children, required }) => (
  <label className="flex items-center gap-1.5 text-sm font-bold text-slate-600 uppercase tracking-wider mb-2">
    {children}
    {required && <span className="text-red-400 text-base leading-none">*</span>}
  </label>
);