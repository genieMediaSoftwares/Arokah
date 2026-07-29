import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase/firebaseConfig";
import { ref, get } from "firebase/database";
import { toast } from "react-toastify";
// ─── Booking Flow Modal ───────────────────────────────────────────────────────
function BookingModal({ event, normalizedExtras, groupedExtras, basePrice, onClose, onConfirm }) {
  const [step, setStep] = useState(1);
  const [quantity, setQuantity] = useState(1);
  const [selectedExtras, setSelectedExtras] = useState({});

  const CATEGORY_CONFIG = {
    game:  { label: "🎮 Games & Activities", color: "blue" },
    food:  { label: "🍽️ Food & Drinks",      color: "orange" },
    music: { label: "🎵 Music & DJ",          color: "purple" },
    other: { label: "✨ Other Extras",         color: "slate" },
  };

  const COLOR_MAP = {
    blue:   { bg: "bg-blue-50",   border: "border-blue-200",   light: "bg-blue-100",   ring: "ring-blue-400",   btn: "bg-blue-500" },
    orange: { bg: "bg-orange-50", border: "border-orange-200", light: "bg-orange-100", ring: "ring-orange-400", btn: "bg-orange-500" },
    purple: { bg: "bg-purple-50", border: "border-purple-200", light: "bg-purple-100", ring: "ring-purple-400", btn: "bg-purple-500" },
    slate:  { bg: "bg-slate-50",  border: "border-slate-200",  light: "bg-slate-100",  ring: "ring-slate-400",  btn: "bg-slate-500" },
  };

  const extractPrice = (priceStr) => {
    if (!priceStr || String(priceStr).toLowerCase() === "free") return 0;
    const match = String(priceStr).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const toggleExtra = (key) => setSelectedExtras((p) => ({ ...p, [key]: !p[key] }));
  const extrasPrice = normalizedExtras.reduce((t, e) => selectedExtras[e._key] ? t + extractPrice(e.price) : t, 0);
  const pricePerTicket = basePrice + extrasPrice;
  const totalPrice = pricePerTicket * quantity;
  const selectedCount = Object.values(selectedExtras).filter(Boolean).length;
  const hasExtras = normalizedExtras.length > 0;
  const totalSteps = hasExtras ? 3 : 2;

  const handleNext = () => {
    if (step === 1) setStep(hasExtras ? 2 : 3);
    else if (step === 2) setStep(3);
    else onConfirm(quantity, selectedExtras, totalPrice, normalizedExtras);
  };

  const handleBack = () => {
    if (step === 1) onClose();
    else setStep(step - 1);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden modal-slide max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="bg-[#330962] px-5 pt-5 pb-5 flex-shrink-0 relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: "radial-gradient(circle at 70% 50%, white 1px, transparent 1px)", backgroundSize: "20px 20px"}} />
          
          {/* Progress */}
          <div className="flex items-center gap-1.5 mb-4 relative z-10">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-500 ${
                  i + 1 <= step ? "bg-white w-8" : "bg-white/25 w-4"
                }`}
              />
            ))}
            <span className="text-white/50 text-xs ml-auto font-mono">{step}/{totalSteps}</span>
          </div>

          <div className="flex items-start justify-between relative z-10">
            <div>
              <h2 className="text-white font-black text-xl leading-tight tracking-tight">
                {step === 1 && "Select Tickets"}
                {step === 2 && "Choose Extras 🎪"}
                {step === 3 && "Order Summary"}
              </h2>
              <p className="text-violet-200 text-xs mt-1 font-medium">{event.title}</p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 px-5 py-5">

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <div className="relative bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-5 border border-violet-100 mb-5 overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-violet-100 rounded-full opacity-50" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-violet-400 font-bold mb-1">Price per ticket</p>
                    <p className="text-4xl font-black text-violet-700">
                      {basePrice > 0 ? `₹${basePrice.toLocaleString()}` : "Free"}
                    </p>
                  </div>
                  <div className="flex items-center bg-white rounded-2xl border-2 border-violet-200 overflow-hidden shadow-lg shadow-violet-100">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-violet-600 hover:bg-violet-50 font-black text-2xl transition-all active:bg-violet-100"
                    >−</button>
                    <span className="w-10 sm:w-12 text-center text-xl sm:text-2xl font-black text-slate-800">{quantity}</span>
                    <button
                      onClick={() => setQuantity(quantity + 1)}
                      className="w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center text-violet-600 hover:bg-violet-50 font-black text-2xl transition-all active:bg-violet-100"
                    >+</button>
                  </div>
                </div>

                {basePrice > 0 && quantity > 1 && (
                  <p className="relative z-10 text-xs text-violet-400 mt-3 font-medium">
                    ₹{basePrice.toLocaleString()} × {quantity} = <strong className="text-violet-700 text-sm">₹{(basePrice * quantity).toLocaleString()}</strong>
                  </p>
                )}
              </div>

              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold text-center mb-3">Quick Select</p>
              <div className="flex gap-2 justify-center">
                {[1,2,3,4,5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setQuantity(n)}
                    className={`flex-1 h-11 rounded-xl font-bold text-sm border-2 transition-all active:scale-90 ${
                      quantity === n
                        ? "bg-[#330962] border-[#330962]-600 text-white shadow-md shadow-violet-200"
                        : "border-slate-200 text-slate-500 hover:border-[#330962]-300 hover:text-violet-600"
                    }`}
                  >{n}</button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-center">
                <p className="text-xs text-amber-700 font-semibold">
                  Extras are added <strong>per ticket</strong> — {quantity} ticket{quantity > 1 ? "s" : ""} = prices × {quantity}
                </p>
              </div>
              <div className="space-y-5">
                {Object.entries(CATEGORY_CONFIG).map(([catKey, { label, color }]) => {
                  const items = groupedExtras[catKey] || [];
                  if (!items.length) return null;
                  const c = COLOR_MAP[color];
                  return (
                    <div key={catKey}>
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-3 ${c.light} border ${c.border}`}>
                        <span className="text-base">{label.split(" ")[0]}</span>
                        <span className="text-sm font-bold text-slate-700">{label.split(" ").slice(1).join(" ")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        {items.map((extra) => {
                          const isSelected = !!selectedExtras[extra._key];
                          const price = extractPrice(extra.price);
                          return (
                            <div
                              key={extra._key}
                              onClick={() => toggleExtra(extra._key)}
                              className={`relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all duration-150 active:scale-95 ${
                                isSelected ? `${c.border} ${c.bg} ring-2 ${c.ring} ring-offset-1 shadow-md` : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              {extra.imageURL ? (
                                <img src={extra.imageURL} alt={extra.name} className="w-full h-24 object-cover" />
                              ) : (
                                <div className={`w-full h-16 flex items-center justify-center text-3xl ${c.light}`}>
                                  {label.split(" ")[0]}
                                </div>
                              )}
                              {isSelected && (
                                <div className="absolute top-1.5 right-1.5 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">✓ Added</div>
                              )}
                              <div className="p-2.5">
                                <p className="text-xs font-bold text-slate-800 line-clamp-1">{extra.name}</p>
                                <p className="text-sm font-black text-violet-600 mt-0.5">
                                  {price > 0 ? <>₹{price}<span className="text-[10px] font-normal text-slate-400">/ticket</span></> : <span className="text-emerald-600 text-xs font-bold">Free</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <p className="font-black text-slate-800 text-lg">Almost there!</p>
                <p className="text-sm text-slate-400 mt-0.5">Review your order below</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-200">
                <div className="flex justify-between items-start pb-3 border-b border-slate-200">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Event</p>
                    <p className="font-bold text-slate-800 text-sm leading-snug">{event.title}</p>
                  </div>
                  <span className="bg-violet-100 text-violet-700 font-bold text-xs px-3 py-1.5 rounded-full whitespace-nowrap ml-3">
                    {quantity} ticket{quantity > 1 ? "s" : ""}
                  </span>
                </div>

                {basePrice > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Entry × {quantity}</span>
                    <span className="font-bold text-slate-700">₹{(basePrice * quantity).toLocaleString()}</span>
                  </div>
                )}

                {normalizedExtras.filter(e => selectedExtras[e._key]).map((extra) => (
                  <div key={extra._key} className="flex justify-between text-sm">
                    <span className="text-slate-500 flex-1 mr-2 truncate">{extra.name} × {quantity}</span>
                    <span className="font-bold text-violet-600">₹{(extractPrice(extra.price) * quantity).toLocaleString()}</span>
                  </div>
                ))}

                {selectedCount === 0 && basePrice === 0 && (
                  <p className="text-xs text-slate-400 italic">Free entry — no charge</p>
                )}

                <div className="pt-4 border-t-2 border-dashed border-slate-300 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">Total Amount</p>
                    <span className="font-black text-slate-800 text-sm">Payable now</span>
                  </div>
                  <span className="text-4xl font-black text-violet-700">₹{totalPrice.toLocaleString()}</span>
                </div>
              </div>

              {selectedCount > 0 && (
                <p className="text-xs text-slate-400 text-center">
                  Includes {selectedCount} extra{selectedCount > 1 ? "s" : ""} for {quantity} ticket{quantity > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 pb-6 pt-3 bg-white border-t border-slate-100 space-y-2.5">
          {step > 1 && totalPrice > 0 && (
            <div className="flex justify-between items-center px-1 mb-1">
              <span className="text-xs text-slate-400">Running total</span>
              <span className="text-sm font-black text-violet-700">₹{totalPrice.toLocaleString()}</span>
            </div>
          )}
          <button
            onClick={handleNext}
            className="w-full py-4 bg-[#330962] text-white font-black text-base rounded-2xl shadow-xl shadow-violet-200 active:scale-[0.98] transition-all"
          >
            {step === 1 && (hasExtras ? "Next: Choose Extras →" : "Review Order →")}
            {step === 2 && (selectedCount > 0 ? `Review (${selectedCount} extra${selectedCount > 1 ? "s" : ""}) →` : "Skip & Review →")}
            {step === 3 && "✅ Confirm Booking"}
          </button>
          <button onClick={handleBack} className="w-full py-2.5 text-slate-400 text-sm font-semibold hover:text-slate-600 transition-all">
            ← {step === 1 ? "Cancel" : "Go back"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Mobile Sticky Bar ────────────────────────────────────────────────────────
function MobileStickyBar({ basePrice, onBook, eventStatus }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
      <div className="bg-white/95 backdrop-blur-xl border-t border-slate-100 px-4 py-3 flex items-center gap-3 shadow-2xl shadow-slate-400/20">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold leading-none mb-1">Starting from</p>
          <div className="flex items-baseline gap-0.5">
            {basePrice > 0 ? (
              <>
                <span className="text-sm font-black text-violet-600">₹</span>
                <span className="text-2xl font-black text-violet-700 leading-none">{basePrice.toLocaleString()}</span>
                <span className="text-xs text-slate-400 ml-1 font-medium">/ticket</span>
              </>
            ) : (
              <span className="text-2xl font-black text-emerald-600 leading-none">Free</span>
            )}
          </div>
        </div>
        <button
          onClick={onBook}
          className="flex-shrink-0 px-6 py-3.5 bg-gradient-to-r from-violet-700 to-purple-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-violet-300 active:scale-95 transition-all"
        >
          {eventStatus === "live" ? "🎟️ Book Now" : "Book Tickets →"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function Details() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const snap = await get(ref(db, `events/${id}`));
        if (snap.exists()) setEvent({ id: snap.key, ...snap.val() });
      } catch (err) {
        console.error(err);
      }
    };
    fetchEvent();
  }, [id]);

  if (!event)
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
            <div className="absolute inset-0 rounded-full border-4 border-violet-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-slate-500 font-semibold text-sm">Loading event...</p>
        </div>
      </div>
    );

  const extractPrice = (priceStr) => {
    if (!priceStr || String(priceStr).toLowerCase() === "free") return 0;
    const match = String(priceStr).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
  };

  const displayTime = (ev) => {
    const start = ev.startTime12h || ev.startTime || "";
    const end = ev.endTime12h || ev.endTime || "";
    if (!start && !end) return "";
    if (!end) return start;
    return `${start} – ${end}`;
  };

  const normalizedExtras = (event.extras || []).map((e, i) => ({ ...e, _key: e.id || e.name || `extra_${i}` }));
  const groupedExtras = normalizedExtras.reduce((acc, extra) => {
    const cat = extra.category || "other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(extra);
    return acc;
  }, {});

  const basePrice = event.price ? extractPrice(event.price) : 0;
// const handleConfirmBooking = (quantity, selectedExtras, totalPrice, extras) => {

//   if (totalPrice <= 0) {
//     toast.error("Invalid amount");
//     return;
//   }

//   const options = {
//     key: "YOUR_REAL_TEST_KEY",
//     amount: totalPrice * 100,
//     currency: "INR",
//     name: "Event Booking",
//     description: event.title,
//     image: event.mainImage,

//     handler: function (response) {
//       console.log("SUCCESS:", response);

//       // 🔥 FORCE CLEANUP
//       document.body.style.overflow = "auto";
//       setShowBookingModal(false);

//       toast.success("Payment Successful!");

//       // optional redirect
//       navigate("/");
//     },

//     modal: {
//       ondismiss: function () {
//         console.log("Payment closed");

//         // 🔥 FORCE CLEANUP
//         document.body.style.overflow = "auto";
//         setShowBookingModal(false);

//         toast.error("Payment Cancelled");
//       }
//     },

//     theme: {
//       color: "#7c3aed"
//     }
//   };

//   if (!window.Razorpay) {
//     toast.error("Razorpay failed to load");
//     return;
//   }

//   const rzp = new window.Razorpay(options);

//   // 🔥 IMPORTANT
// document.body.style.overflow = "auto";
//   rzp.open();
// };
const handleConfirmBooking = (quantity, selectedExtras, totalPrice) => {

  if (totalPrice <= 0) {
    toast.error("Invalid amount");
    return;
  }

  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY, // 🔥 Replace with your real key
    amount: totalPrice * 100,  // ✅ dynamic amount
    currency: "INR",
    name: "Event Booking",
    description: event.title,

    handler: function (response) {
      console.log("SUCCESS:", response);

      document.body.style.overflow = "auto";
      setShowBookingModal(false);

      toast.success("Payment Successful!");
      navigate("/");
    },

    modal: {
      ondismiss: function () {
        document.body.style.overflow = "auto";
        setShowBookingModal(false);
        toast.error("Payment Cancelled");
      }
    },

    theme: {
      color: "#7c3aed"
    }
  };

  if (!window.Razorpay) {
    toast.error("Razorpay failed to load");
    return;
  }

  const rzp = new window.Razorpay(options);
  rzp.open();
};
  return (
    <div className="bg-slate-50 min-h-screen pt-14 pb-28 lg:pb-12">

      {showBookingModal && (
        <BookingModal
          event={event}
          normalizedExtras={normalizedExtras}
          groupedExtras={groupedExtras}
          basePrice={basePrice}
          onClose={() => setShowBookingModal(false)}
          onConfirm={handleConfirmBooking}
        />
      )}

      <MobileStickyBar
        basePrice={basePrice}
        onBook={() => setShowBookingModal(true)}
        eventStatus={event.status}
      />

      {/* ══ HERO ══ */}
<section className="relative text-white overflow-hidden" style={{background:"#330962"}}>
  <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage:"linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)", backgroundSize:"36px 36px"}} />
  <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 blur-3xl" style={{background:"radial-gradient(circle,#c084fc,#7c3aed)"}} />
  <div className="absolute -bottom-10 -left-10 w-60 h-60 rounded-full opacity-20 blur-3xl" style={{background:"radial-gradient(circle,#e879f9,#9333ea)"}} />
  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:"linear-gradient(to right,transparent,rgba(196,132,252,.6),transparent)"}} />
  <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{background:"linear-gradient(to right,transparent,rgba(232,121,249,.4),transparent)"}} />

  <div className="relative z-10 w-[90%] max-w-7xl mx-auto px-2 py-8 sm:py-10">
    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-white/60 hover:text-white text-sm font-semibold mb-5 transition-all group">
      <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
    </button>

    <div className="flex flex-wrap gap-2 mb-4">
      {event.status === "live" && (
        <span className="inline-flex items-center gap-2 bg-emerald-500 text-white text-xs font-black px-3 py-1.5 rounded-full" style={{boxShadow:"0 0 16px rgba(5,150,105,.5)"}}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE NOW
        </span>
      )}
      {event.status === "upcoming" && (
        <span className="inline-flex items-center gap-1.5 bg-[rgba(112,43,221,.3)] text-[#D4BBFF] border border-[rgba(112,43,221,.4)] text-xs font-bold px-3 py-1.5 rounded-full backdrop-blur-sm">📅 Upcoming</span>
      )}
      {event.type && (
        <span className="inline-flex items-center bg-white/10 text-white/80 border border-white/15 text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-sm">{event.type}</span>
      )}
    </div>

    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black leading-[1.1] tracking-tight mb-3 max-w-3xl drop-shadow-md">
      {event.title}
    </h1>

    <div className="flex flex-wrap gap-2 mt-5">
      {event.eventDate && (
        <span className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3.5 py-2 text-xs font-semibold text-white">📅 {formatDate(event.eventDate)}</span>
      )}
      {displayTime(event) && (
        <span className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3.5 py-2 text-xs font-semibold text-white">⏰ {displayTime(event)}</span>
      )}
      {event.location && (
        <span className="flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3.5 py-2 text-xs font-semibold text-white">📍 {event.location}</span>
      )}
    </div>
  </div>
</section>

      {/* ══ MAIN CONTENT ══ */}
      <div className="w-[90%] max-w-7xl mx-auto px-2 mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── LEFT: Event Info ── */}
          <div className="lg:col-span-3 space-y-5">

            {/* Event Image */}
            {event.mainImage && (
              <div className="rounded-2xl overflow-hidden shadow-lg shadow-slate-200 border border-slate-100 relative">
                {!imgLoaded && (
                  <div className="absolute inset-0 bg-slate-100 animate-pulse" />
                )}
                <img
                  src={event.mainImage}
                  alt={event.title}
                  onLoad={() => setImgLoaded(true)}
                  className={`w-full h-52 sm:h-64 lg:h-80 object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
                />
              </div>
            )}

            {/* About */}
            {event.description && (
              <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1 h-5 bg-gradient-to-b from-violet-600 to-purple-400 rounded-full" />
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">About this event</h2>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{event.description}</p>
                {event.phone && (
                  <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center text-base flex-shrink-0">📞</div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Contact</p>
                      <span className="text-sm font-bold text-slate-700">{event.phone}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Extras – mobile */}
            {normalizedExtras.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 lg:hidden">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1 h-5 bg-gradient-to-b from-amber-500 to-orange-400 rounded-full" />
                  <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest">Extras Available</h2>
                </div>
                <p className="text-xs text-slate-400 mb-4 ml-3">Choose when booking your tickets</p>
                <div className="flex flex-wrap gap-2">
                  {normalizedExtras.map((extra) => {
                    const price = extractPrice(extra.price);
                    return (
                      <span key={extra._key} className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 text-violet-700 text-xs font-bold px-3 py-2 rounded-xl">
                        {extra.name}
                        <span className="text-violet-400 font-normal ml-1">
                          {price > 0 ? `· ₹${price}` : "· Free"}
                        </span>
                      </span>
                    );
                  })}
                </div>

                {/* Mobile book CTA inside card */}
                <button
                  onClick={() => setShowBookingModal(true)}
                  className="w-full mt-4 py-3.5 bg-gradient-to-r from-violet-700 to-purple-600 text-white font-black text-sm rounded-xl shadow-md shadow-violet-200 active:scale-95 transition-all"
                >
                  🎟️ Book with Extras
                </button>
              </div>
            )}

            {/* Quick Info Strip – mobile */}
            <div className="grid grid-cols-2 gap-3 lg:hidden">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                <p className="text-2xl mb-1">💰</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Entry</p>
                <p className="font-black text-violet-700 text-lg">{basePrice > 0 ? `₹${basePrice}` : "Free"}</p>
              </div>
              {event.location && (
                <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
                  <p className="text-2xl mb-1">📍</p>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-0.5">Venue</p>
                  <p className="font-bold text-slate-700 text-xs line-clamp-2">{event.location}</p>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Desktop Booking Panel ── */}
          <div className="hidden lg:block lg:col-span-2">
            <div className="sticky top-24">
              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-200 overflow-hidden">

                {/* Panel header */}
                <div className="relative bg-[#330962] px-6 py-6 overflow-hidden">
                  <div className="absolute inset-0 opacity-10" style={{backgroundImage: "radial-gradient(circle at 70% 30%, white 1px, transparent 1px)", backgroundSize: "18px 18px"}} />
                  <div className="relative z-10">
                    <h3 className="text-white font-black text-lg tracking-tight">Book Tickets</h3>
                    {event.status === "live" && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-300 text-xs font-bold">Happening right now</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  {/* Price & Date */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Entry price</p>
                      <p className="text-4xl font-black text-violet-700">
                        {basePrice > 0 ? `₹${basePrice.toLocaleString()}` : "Free"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">per person</p>
                    </div>
                    {event.eventDate && (
                      <div className="text-right bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Date</p>
                        <p className="text-xs font-bold text-slate-700 leading-snug">{formatDate(event.eventDate)}</p>
                        {displayTime(event) && <p className="text-[11px] text-slate-400 mt-0.5">{displayTime(event)}</p>}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

                  {/* Extras available */}
                  {normalizedExtras.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span>🎪</span>
                        <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Extras available!</p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {normalizedExtras.slice(0, 4).map((extra) => (
                          <span key={extra._key} className="bg-white border border-amber-200 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                            {extra.name}
                          </span>
                        ))}
                        {normalizedExtras.length > 4 && (
                          <span className="text-amber-600 text-xs font-bold px-2 py-1 bg-amber-100 rounded-lg">+{normalizedExtras.length - 4} more</span>
                        )}
                      </div>
                      <p className="text-xs text-amber-500 mt-2.5 font-medium">Choose them in the booking flow →</p>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    onClick={() => setShowBookingModal(true)}
                    className="w-full py-4 bg-[#330962] hover:from-violet-800 hover:to-purple-700 text-white font-black text-base rounded-2xl shadow-xl shadow-violet-200 active:scale-[0.98] transition-all"
                  >
                    {event.status === "live" ? "🎟️ Book Now — Live" : "🎟️ Book Tickets"}
                  </button>

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-4 pt-1">
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                      <span>🔒</span> Secure
                    </span>
                    <span className="w-px h-3 bg-slate-200" />
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                      <span>✅</span> Instant Confirmation
                    </span>
                    <span className="w-px h-3 bg-slate-200" />
                    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-semibold">
                      <span>💳</span> No hidden fees
                    </span>
                  </div>
                </div>
              </div>

              {/* Back button on desktop */}
              <button
                onClick={() => navigate(-1)}
                className="w-full mt-3 py-3 text-slate-400 hover:text-slate-600 font-semibold text-sm flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 hover:border-slate-300 transition-all"
              >
                ← Go Back
              </button>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes modalSlide {
          from { opacity: 0; transform: translateY(40px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .modal-slide { animation: modalSlide 0.35s cubic-bezier(0.34, 1.4, 0.64, 1) both; }

        @media (max-width: 640px) {
          .modal-slide {
            animation-name: mobileSlide;
          }
        }
        @keyframes mobileSlide {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default Details;