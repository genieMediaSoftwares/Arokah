// import { useEffect, useState } from "react";
// import { db } from "../firebase/firebaseConfig";
// import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
// import { toast } from "react-toastify";
// import { useNavigate } from "react-router-dom";

// function AdminDashboard() {
//   const [events, setEvents] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [search, setSearch] = useState("");
//   const navigate = useNavigate();

//   useEffect(() => {
//     const unsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
//       setEvents(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
//       setLoading(false);
//     });
//     return () => unsubscribe();
//   }, []);

//   const deleteEvent = async (event) => {
//     const confirmDelete = window.confirm(`Delete "${event.title}"? This cannot be undone.`);
//     if (!confirmDelete) return;
//     try {
//       await deleteDoc(doc(db, "events", event.id));
//       toast.success("Event deleted");
//     } catch {
//       toast.error("Error deleting event");
//     }
//   };

//   const filtered = events.filter(
//     (e) =>
//       e.title?.toLowerCase().includes(search.toLowerCase()) ||
//       e.type?.toLowerCase().includes(search.toLowerCase())
//   );

//   return (
//     <div className="min-h-screen bg-white mt-16 pb-24">
//       <div className="w-[92%] max-w-7xl mx-auto">

//         {/* ══════════════════════════════════════
//             TOP HEADER
//         ══════════════════════════════════════ */}
//         <div className="pt-6 pb-6 border-b border-slate-100">
//           {/* Live badge */}
//           <div className="flex items-center gap-2 mb-3">
//             <span className="relative flex h-2.5 w-2.5">
//               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
//               <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
//             </span>
//             <span className="text-[10px] font-bold tracking-widest uppercase text-green-600">
//               Live · Firebase Synced
//             </span>
//           </div>

//           {/* Title row */}
//           <div className="flex flex-col gap-4">
//             <div>
//               <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
//                 Admin Dashboard
//               </h1>
//               <p className="text-sm sm:text-base text-slate-500 mt-1">
//                 Manage events, home page content, and bookings from one place.
//               </p>
//             </div>

//             {/* Action buttons — horizontal scroll on mobile */}
//             <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
//               <ActionBtn
//                 onClick={() => navigate("/admin/add-event")}
//                 color="purple"
//                 icon="+"
//                 label="Add Event"
//               />
//               <ActionBtn
//                 onClick={() => navigate("/admin/home-content")}
//                 color="green"
//                 icon="🏠"
//                 label="Home Page"
//               />
//               {/* <ActionBtn
//                 onClick={() => navigate("/admin/bookings")}
//                 color="blue"
//                 icon="📋"
//                 label="Bookings"
//               /> */}
//             </div>
//           </div>
//         </div>

//         {/* ══════════════════════════════════════
//             STATS ROW
//         ══════════════════════════════════════ */}
//         <div className="grid grid-cols-3 gap-3 py-6 border-b border-slate-100">
//           <StatCard
//             label="Total"
//             value={loading ? "—" : events.length}
//             sub="events"
//             color="purple"
//             icon="🎪"
//           />
//           <StatCard
//             label="Live"
//             value={loading ? "—" : events.length}
//             sub="visible"
//             color="green"
//             icon="✅"
//           />
//           <StatCard
//             label="Status"
//             value="On"
//             sub="Firebase"
//             color="blue"
//             icon="🟢"
//             pulse
//           />
//         </div>

//         {/* ══════════════════════════════════════
//             QUICK NAVIGATION TILES
//         ══════════════════════════════════════ */}
//         <div className="py-6 border-b border-slate-100">
//           <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-4">
//             Quick Actions
//           </p>
//           {/* 1 col on mobile, 3 col on sm+ */}
//           <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
//             <NavTile
//               icon="🎉"
//               title="Add New Event"
//               desc="Create and publish a new event to the website instantly."
//               btnLabel="Go →"
//               btnColor="bg-purple-600 hover:bg-purple-700 shadow-purple-200"
//               onClick={() => navigate("/admin/add-event")}
//             />
//             <NavTile
//               icon="🏠"
//               title="Manage Home Page"
//               desc="Edit hero images, gallery, banners, story section & more."
//               btnLabel="Go →"
//               btnColor="bg-green-600 hover:bg-green-700 shadow-green-200"
//               onClick={() => navigate("/admin/home-content")}
//             />
//             {/* <NavTile
//               icon="📋"
//               title="View Bookings"
//               desc="See all customer booking requests and contact details."
//               btnLabel="Go →"
//               btnColor="bg-blue-600 hover:bg-blue-700 shadow-blue-200"
//               onClick={() => navigate("/admin/bookings")}
//             /> */}
//           </div>
//         </div>

//         {/* ══════════════════════════════════════
//             EVENTS TABLE
//         ══════════════════════════════════════ */}
//         <div className="py-6">

//           {/* Section header + search */}
//           <div className="flex flex-col gap-3 mb-5">
//             <div className="flex items-center justify-between">
//               <div>
//                 <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">Manage Events</h2>
//                 <p className="text-xs text-slate-400 mt-0.5">
//                   {loading ? "Loading…" : `${events.length} event${events.length !== 1 ? "s" : ""} total`}
//                 </p>
//               </div>
//               {/* Add button — always visible on mobile top-right */}
//               <button
//                 onClick={() => navigate("/admin/add-event")}
//                 className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap"
//               >
//                 + New
//               </button>
//             </div>

//             {/* Full-width search on mobile */}
//             <div className="relative w-full">
//               <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
//               <input
//                 value={search}
//                 onChange={(e) => setSearch(e.target.value)}
//                 placeholder="Search events…"
//                 className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl bg-slate-50 focus:bg-white transition-all"
//               />
//             </div>
//           </div>

//           {/* Loading */}
//           {loading && (
//             <div className="flex items-center justify-center py-16 gap-3">
//               <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-purple-500 animate-spin" />
//               <p className="text-slate-400 text-sm">Syncing with Firebase…</p>
//             </div>
//           )}

//           {/* Empty state */}
//           {!loading && events.length === 0 && (
//             <div className="flex flex-col items-center justify-center py-16 gap-4 border-2 border-dashed border-slate-200 rounded-2xl">
//               <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-3xl">
//                 🎪
//               </div>
//               <div className="text-center">
//                 <p className="text-base font-bold text-slate-700">No events yet</p>
//                 <p className="text-slate-400 text-sm mt-1">Add your first event to get started</p>
//               </div>
//               <button
//                 onClick={() => navigate("/admin/add-event")}
//                 className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all active:scale-95"
//               >
//                 + Add First Event
//               </button>
//             </div>
//           )}

//           {/* No search results */}
//           {!loading && events.length > 0 && filtered.length === 0 && (
//             <div className="text-center py-12">
//               <p className="text-slate-400 text-sm">
//                 No events match "
//                 <span className="font-semibold text-slate-600">{search}</span>"
//               </p>
//               <button
//                 onClick={() => setSearch("")}
//                 className="mt-3 text-purple-600 hover:underline text-sm font-semibold"
//               >
//                 Clear search
//               </button>
//             </div>
//           )}

//           {/* Events list */}
//           {!loading && filtered.length > 0 && (
//             <div className="border border-slate-100 rounded-2xl overflow-hidden">

//               {/* ── DESKTOP TABLE HEAD ── */}
//               <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100">
//                 <span className="col-span-1 text-xs font-bold uppercase tracking-widest text-slate-400">#</span>
//                 <span className="col-span-4 text-xs font-bold uppercase tracking-widest text-slate-400">Event</span>
//                 <span className="col-span-2 text-xs font-bold uppercase tracking-widest text-slate-400">Type</span>
//                 <span className="col-span-2 text-xs font-bold uppercase tracking-widest text-slate-400">Price</span>
//                 <span className="col-span-2 text-xs font-bold uppercase tracking-widest text-slate-400">Date</span>
//                 <span className="col-span-1 text-xs font-bold uppercase tracking-widest text-slate-400 text-right">Actions</span>
//               </div>

//               {/* ── ROWS ── */}
//               <div className="divide-y divide-slate-100">
//                 {filtered.map((event, i) => (
//                   <div key={event.id}>

//                     {/* ── MOBILE CARD ── */}
//                     <div className="sm:hidden px-4 py-4 hover:bg-purple-50/30 transition-colors">
//                       <div className="flex items-start justify-between gap-3">
//                         {/* Left: index + title */}
//                         <div className="flex items-start gap-3 min-w-0">
//                           <span className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">
//                             {i + 1}
//                           </span>
//                           <div className="min-w-0">
//                             <p className="font-bold text-slate-800 text-sm leading-snug break-words">
//                               {event.title || "—"}
//                             </p>
//                             {/* Badges row */}
//                             <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
//                               {event.type && (
//                                 <span className="bg-slate-100 text-slate-500 text-[11px] font-medium px-2 py-0.5 rounded-full">
//                                   {event.type}
//                                 </span>
//                               )}
//                               {event.price && (
//                                 <span className="bg-purple-50 text-purple-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-100">
//                                   ₹{event.price}
//                                 </span>
//                               )}
//                               {event.eventDate && (
//                                 <span className="text-slate-400 text-[11px]">📅 {event.eventDate}</span>
//                               )}
//                             </div>
//                           </div>
//                         </div>

//                         {/* Right: action buttons stacked */}
//                         <div className="flex flex-col gap-1.5 flex-shrink-0">
//                           <button
//                             onClick={() => navigate(`/admin/edit/${event.id}`)}
//                             className="flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-500 border border-blue-200 hover:border-blue-500 text-blue-600 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
//                           >
//                             ✏️ Edit
//                           </button>
//                           <button
//                             onClick={() => deleteEvent(event)}
//                             className="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-500 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
//                           >
//                             🗑️ Del
//                           </button>
//                         </div>
//                       </div>
//                     </div>

//                     {/* ── DESKTOP ROW ── */}
//                     <div className="hidden sm:grid grid-cols-12 items-center gap-4 px-6 py-5 hover:bg-purple-50/30 transition-colors group">
//                       {/* # */}
//                       <div className="col-span-1">
//                         <span className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">
//                           {i + 1}
//                         </span>
//                       </div>

//                       {/* Title */}
//                       <div className="col-span-4 min-w-0">
//                         <p className="font-bold text-slate-800 text-base truncate">{event.title || "—"}</p>
//                       </div>

//                       {/* Type */}
//                       <div className="col-span-2">
//                         {event.type ? (
//                           <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full">
//                             {event.type}
//                           </span>
//                         ) : (
//                           <span className="text-slate-300 text-sm">—</span>
//                         )}
//                       </div>

//                       {/* Price */}
//                       <div className="col-span-2">
//                         {event.price ? (
//                           <span className="bg-purple-50 text-purple-700 text-xs font-bold px-3 py-1 rounded-full border border-purple-100">
//                             ₹{event.price}
//                           </span>
//                         ) : (
//                           <span className="text-slate-300 text-sm">—</span>
//                         )}
//                       </div>

//                       {/* Date */}
//                       <div className="col-span-2">
//                         <span className="text-sm text-slate-500 font-medium">
//                           {event.eventDate || <span className="text-slate-300">—</span>}
//                         </span>
//                       </div>

//                       {/* Actions */}
//                       <div className="col-span-1 flex items-center gap-2 justify-end">
//                         <button
//                           onClick={() => navigate(`/admin/edit/${event.id}`)}
//                           className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-500 border border-blue-200 hover:border-blue-500 text-blue-600 hover:text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
//                         >
//                           ✏️ Edit
//                         </button>
//                         <button
//                           onClick={() => deleteEvent(event)}
//                           className="flex items-center gap-1.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-500 hover:text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
//                         >
//                           🗑️ Delete
//                         </button>
//                       </div>
//                     </div>
//                   </div>
//                 ))}
//               </div>

//               {/* Footer */}
//               <div className="px-4 sm:px-6 py-3.5 bg-slate-50 flex items-center justify-between border-t border-slate-100">
//                 <div className="flex items-center gap-2">
//                   <span className="relative flex h-2.5 w-2.5">
//                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
//                     <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
//                   </span>
//                   <span className="text-xs text-slate-400 font-medium">Live · Real time</span>
//                 </div>
//                 <span className="text-xs text-slate-400 font-medium">
//                   {search ? `${filtered.length} of ${events.length}` : `${events.length}`} record
//                   {events.length !== 1 ? "s" : ""}
//                 </span>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// export default AdminDashboard;

// /* ── ACTION BUTTON ── */
// const ActionBtn = ({ onClick, color, icon, label }) => {
//   const colors = {
//     purple: "bg-purple-600 hover:bg-purple-700 shadow-purple-200",
//     green: "bg-green-600 hover:bg-green-700 shadow-green-200",
//     blue: "bg-blue-600 hover:bg-blue-700 shadow-blue-200",
//   };
//   return (
//     <button
//       onClick={onClick}
//       className={`flex items-center gap-2 ${colors[color]} text-white text-xs sm:text-sm font-bold px-4 sm:px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap flex-shrink-0`}
//     >
//       <span>{icon}</span> {label}
//     </button>
//   );
// };

// /* ── STAT CARD ── */
// const StatCard = ({ label, value, sub, color, icon, pulse }) => {
//   const colors = {
//     purple: { val: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100", bar: "bg-purple-500" },
//     green: { val: "text-green-600", bg: "bg-green-50", border: "border-green-100", bar: "bg-green-500" },
//     blue: { val: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", bar: "bg-blue-500" },
//   };
//   const c = colors[color];
//   return (
//     <div className={`rounded-2xl border ${c.border} ${c.bg} px-3 sm:px-6 py-4 sm:py-6 flex flex-col gap-2 sm:gap-3 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`}>
//       <div className="flex items-center justify-between">
//         <p className="text-[9px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 leading-tight">{label}</p>
//         <span className="text-base sm:text-xl">{icon}</span>
//       </div>
//       <div className="flex items-end gap-1.5">
//         <span className={`text-2xl sm:text-4xl font-extrabold ${c.val} leading-none`}>{value}</span>
//         {pulse && (
//           <span className="relative flex h-2.5 w-2.5 mb-1">
//             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
//             <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
//           </span>
//         )}
//       </div>
//       <p className="text-[11px] sm:text-sm text-slate-500">{sub}</p>
//       <div className="h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
//         <div className={`h-full ${c.bar} rounded-full w-full`} />
//       </div>
//     </div>
//   );
// };

// /* ── NAV TILE ── */
// const NavTile = ({ icon, title, desc, btnLabel, btnColor, onClick }) => (
//   <div className="border border-slate-200 rounded-2xl px-4 sm:px-6 py-5 sm:py-6 flex flex-col gap-3 sm:gap-4 hover:border-slate-300 hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 bg-white">
//     <div className="flex items-center gap-3">
//       <span className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl sm:text-2xl flex-shrink-0">
//         {icon}
//       </span>
//       <h4 className="text-sm sm:text-base font-bold text-slate-800">{title}</h4>
//     </div>
//     <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{desc}</p>
//     <button
//       onClick={onClick}
//       className={`self-start flex items-center gap-2 ${btnColor} text-white text-xs sm:text-sm font-bold px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap`}
//     >
//       {btnLabel}
//     </button>
//   </div>
// );


import { useEffect, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, onValue, remove } from "firebase/database";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onValue(
      ref(db, "events"),
      (snap) => {
        const val = snap.val() || {};
        const list = Object.keys(val).map((k) => ({ id: k, ...val[k] }));
        setEvents(list);
        setLoading(false);
      },
      (err) => {
        console.error("AdminDashboard onValue error:", err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const deleteEvent = async (event) => {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    try {
      await remove(ref(db, `events/${event.id}`));
      toast.success("Event deleted");
    } catch { toast.error("Error deleting event"); }
  };

  const totalEvents   = events.length;
  const liveCount     = events.filter((e) => e.status === "live").length;
  const upcomingCount = events.filter((e) => e.status === "upcoming").length;

  const filtered = events.filter((e) => {
    const matchSearch =
      e.title?.toLowerCase().includes(search.toLowerCase()) ||
      e.type?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ||
      (filter === "live" && e.status === "live") ||
      (filter === "upcoming" && e.status === "upcoming");
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-white mt-16">

      {/* ════════════════════════════════
          PAGE HEADER
      ════════════════════════════════ */}
      <div className="bg-white border-b border-slate-200">
        <div className="w-full lg:w-[90%] mx-auto px-4 sm:px-6 lg:px-0 py-8 sm:py-10">

          {/* Live indicator */}
          <div className="flex items-center gap-2 mb-5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-600">
              Live · Firebase Synced
            </span>
          </div>

          {/* Title + action buttons */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
                Admin Dashboard
              </h1>
              <p className="text-slate-500 text-sm sm:text-base mt-2">
                Manage events, homepage content, and more — all in one place.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => navigate("/admin/add-event")}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shadow-purple-200 whitespace-nowrap"
              >
                <span className="text-base leading-none">+</span> Add Event
              </button>
              <button
                onClick={() => navigate("/admin/home-content")}
                className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap"
              >
                🏠 Home Page
              </button>
            </div>
          </div>

          {/* ── INLINE STATS STRIP ── */}
          <div className="mt-8 grid grid-cols-3 divide-x divide-slate-200 border border-slate-200 rounded-2xl overflow-hidden">
            <StatStrip
              label="Total Events"
              value={loading ? "—" : totalEvents}
              sub="in database"
              accent="text-purple-600"
            />
            <StatStrip
              label="Live Now"
              value={loading ? "—" : liveCount}
              sub="active"
              accent="text-emerald-600"
              pulse
            />
            <StatStrip
              label="Upcoming"
              value={loading ? "—" : upcomingCount}
              sub="scheduled"
              accent="text-sky-600"
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          QUICK NAVIGATION LINKS
      ════════════════════════════════ */}
      <div className="bg-slate-50 border-b border-slate-200">
        <div className="w-full lg:w-[90%] mx-auto px-4 sm:px-6 lg:px-0 py-5">
          <p className="text-[10px] font-bold tracking-widest uppercase text-slate-400 mb-4">Quick Actions</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <QuickLink
              icon="🎉"
              title="Add New Event"
              desc="Create and publish a new event to the website instantly."
              onClick={() => navigate("/admin/add-event")}
              accent="purple"
            />
            <QuickLink
              icon="🏠"
              title="Manage Home Page"
              desc="Edit hero images, gallery, banners & story section."
              onClick={() => navigate("/admin/home-content")}
              accent="green"
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          EVENTS TABLE
      ════════════════════════════════ */}
      <div className="bg-white">
        <div className="w-full lg:w-[90%] mx-auto px-4 sm:px-6 lg:px-0 py-7">

          {/* Section header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">All Events</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {loading ? "Syncing…" : `${totalEvents} event${totalEvents !== 1 ? "s" : ""} total`}
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/add-event")}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shadow-purple-200 self-start sm:self-auto whitespace-nowrap"
            >
              + New Event
            </button>
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by event name or type…"
                className="w-full pl-10 pr-9 py-2.5 text-sm border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl bg-slate-50 focus:bg-white text-slate-700 placeholder-slate-400 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
              )}
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
              {[
                { key: "all",      label: "All",          count: totalEvents   },
                { key: "live",     label: "🟢 Live",       count: liveCount     },
                { key: "upcoming", label: "📅 Upcoming",   count: upcomingCount },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap ${
                    filter === f.key
                      ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                      : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                  }`}
                >
                  {f.label}
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    filter === f.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── LOADING ── */}
          {loading && (
            <div className="flex items-center justify-center py-20 gap-3">
              <div className="w-6 h-6 rounded-full border-2 border-slate-200 border-t-purple-500 animate-spin" />
              <p className="text-slate-400 text-sm">Syncing with Firebase…</p>
            </div>
          )}

          {/* ── EMPTY STATE ── */}
          {!loading && events.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-5 border-2 border-dashed border-slate-200 rounded-2xl">
              <span className="text-6xl">🎪</span>
              <div className="text-center">
                <p className="text-lg font-bold text-slate-700">No events yet</p>
                <p className="text-slate-400 text-sm mt-1">Add your first event to get started</p>
              </div>
              <button
                onClick={() => navigate("/admin/add-event")}
                className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-all active:scale-95 shadow-md shadow-purple-200"
              >
                + Add First Event
              </button>
            </div>
          )}

          {/* ── NO RESULTS ── */}
          {!loading && events.length > 0 && filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-400 text-sm">
                No events match <span className="font-semibold text-slate-700">"{search || filter}"</span>
              </p>
              <button onClick={() => { setSearch(""); setFilter("all"); }}
                className="mt-3 text-purple-600 hover:text-purple-700 hover:underline text-sm font-semibold">
                Clear filters
              </button>
            </div>
          )}

          {/* ── TABLE ── */}
          {!loading && filtered.length > 0 && (
            <div className="border border-slate-200 rounded-2xl overflow-hidden">

              {/* Desktop table header */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200">
                <span className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">#</span>
                <span className="col-span-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">Event Name</span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Type</span>
                <span className="col-span-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Status</span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Price</span>
                <span className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 text-right">Actions</span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-slate-100">
                {filtered.map((event, i) => (
                  <div key={event.id}>

                    {/* ── MOBILE ROW ── */}
                    <div className="sm:hidden px-4 py-4 hover:bg-purple-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="flex-shrink-0 w-7 h-7 mt-0.5 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm leading-snug break-words">{event.title || "—"}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                              {event.type && (
                                <span className="bg-slate-100 text-slate-500 text-[11px] font-medium px-2 py-0.5 rounded-full border border-slate-200">
                                  {event.type}
                                </span>
                              )}
                              {event.status === "live" ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" /> Live
                                </span>
                              ) : (
                                <span className="bg-purple-50 text-purple-600 text-[11px] font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                  📅 Upcoming
                                </span>
                              )}
                              {event.eventDate && (
                                <span className="text-slate-400 text-[11px]">{event.eventDate}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => navigate(`/admin/edit/${event.id}`)}
                            className="flex items-center justify-center gap-1 bg-blue-50 hover:bg-blue-500 border border-blue-200 hover:border-blue-500 text-blue-600 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => deleteEvent(event)}
                            className="flex items-center justify-center gap-1 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-500 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95"
                          >
                            🗑️ Del
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* ── DESKTOP ROW ── */}
                    <div className="hidden sm:grid grid-cols-12 items-center gap-4 px-6 py-4 hover:bg-purple-50/40 transition-colors group">
                      {/* # */}
                      <div className="col-span-1">
                        <span className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">
                          {i + 1}
                        </span>
                      </div>

                      {/* Title + date */}
                      <div className="col-span-4 min-w-0">
                        <p className="font-bold text-slate-800 text-sm truncate">{event.title || "—"}</p>
                        {event.eventDate && (
                          <p className="text-[11px] text-slate-400 mt-0.5">{event.eventDate}</p>
                        )}
                      </div>

                      {/* Type */}
                      <div className="col-span-2">
                        {event.type ? (
                          <span className="bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200">
                            {event.type}
                          </span>
                        ) : <span className="text-slate-300 text-sm">—</span>}
                      </div>

                      {/* Status */}
                      <div className="col-span-1">
                        {event.status === "live" ? (
                          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            Live
                          </span>
                        ) : (
                          <span className="bg-purple-50 text-purple-600 text-xs font-bold px-2.5 py-1 rounded-full border border-purple-200">
                            Soon
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div className="col-span-2">
                        {event.price ? (
                          <span className="text-sm font-bold text-slate-700">{event.price}</span>
                        ) : <span className="text-slate-300 text-sm">—</span>}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center gap-2 justify-end">
                        <button
                          onClick={() => navigate(`/admin/edit/${event.id}`)}
                          className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-500 border border-blue-200 hover:border-blue-500 text-blue-600 hover:text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteEvent(event)}
                          className="flex items-center gap-1.5 bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-500 hover:text-white text-xs font-bold px-3 py-2 rounded-lg transition-all active:scale-95"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>

              {/* Table footer */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-xs text-slate-400 font-medium">Real-time sync</span>
                </div>
                <span className="text-xs text-slate-400 font-medium">
                  {search || filter !== "all" ? `${filtered.length} of ${totalEvents}` : totalEvents} record{totalEvents !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

/* ── STAT STRIP ── */
const StatStrip = ({ label, value, sub, accent, pulse }) => (
  <div className="flex flex-col gap-1 px-4 sm:px-8 py-5 bg-white hover:bg-slate-50 transition-colors">
    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
    <div className="flex items-end gap-2">
      <span className={`text-2xl sm:text-3xl font-extrabold ${accent} leading-none`}>{value}</span>
      {pulse && (
        <span className="relative flex h-2 w-2 mb-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
      )}
    </div>
    <p className="text-[11px] text-slate-400">{sub}</p>
  </div>
);

/* ── QUICK LINK (left-border row, no card) ── */
const QuickLink = ({ icon, title, desc, onClick, accent }) => {
  const borders = {
    purple: "border-l-purple-500 hover:bg-purple-50/50",
    green:  "border-l-emerald-500 hover:bg-emerald-50/50",
    blue:   "border-l-sky-500 hover:bg-sky-50/50",
  };
  const btnColors = {
    purple: "bg-purple-600 hover:bg-purple-700 shadow-purple-200",
    green:  "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200",
    blue:   "bg-sky-600 hover:bg-sky-700 shadow-sky-200",
  };
  return (
    <div
      onClick={onClick}
      className={`flex-1 flex items-center justify-between gap-4 border-l-4 ${borders[accent]} pl-4 sm:pl-5 py-3 cursor-pointer group transition-all rounded-r-xl`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xl sm:text-2xl flex-shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-800 group-hover:text-slate-900 transition-colors">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5 leading-snug">{desc}</p>
        </div>
      </div>
      <button
        className={`flex-shrink-0 flex items-center gap-1.5 ${btnColors[accent]} text-white text-xs font-bold px-4 py-2 rounded-xl transition-all active:scale-95 shadow-md whitespace-nowrap`}
      >
        Go →
      </button>
    </div>
  );
};