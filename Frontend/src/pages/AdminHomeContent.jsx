// import { useEffect, useState } from "react";
// import { db } from "../firebase/firebaseConfig";
// import { doc, setDoc, getDoc } from "firebase/firestore";
// import { toast } from "react-toastify";
// import { useNavigate } from "react-router-dom";

// function AdminHomeContent() {
//   const navigate = useNavigate();

//   const [heroSlides, setHeroSlides] = useState(["", "", "", "", ""]);
//   const [galleryImages, setGalleryImages] = useState([]);
//   const [pricingImage, setPricingImage] = useState("");
//   const [promotionImage, setPromotionImage] = useState("");
//   const [aboutText, setAboutText] = useState("");
//   const [saving, setSaving] = useState(false);
//   const [extraSections, setExtraSections] = useState([
//     { id: Date.now() + 1, label: "", imageURL: "" },
//     { id: Date.now() + 2, label: "", imageURL: "" },
//     { id: Date.now() + 3, label: "", imageURL: "" },
//     { id: Date.now() + 4, label: "", imageURL: "" },
//   ]);
//   const [storySection, setStorySection] = useState({
//     title: "",
//     description1: "",
//     description2: "",
//     image1: "",
//     image2: "",
//   });

//   useEffect(() => {
//     const fetchData = async () => {
//       const snap = await getDoc(doc(db, "homePage", "mainContent"));
//       if (snap.exists()) {
//         const data = snap.data();
//         setHeroSlides(data.heroSlides || ["", "", "", "", ""]);
//         setGalleryImages(data.galleryImages || []);
//         setPricingImage(data.pricingImage || "");
//         setPromotionImage(data.promotionImage || "");
//         setAboutText(data.aboutText || "");
//         setExtraSections(data.extraSections || []);
//         setStorySection(
//           data.storySection || {
//             title: "",
//             description1: "",
//             description2: "",
//             image1: "",
//             image2: "",
//           }
//         );
//       }
//     };
//     fetchData();
//   }, []);

//   const updateHeroSlide = (index, value) => {
//     const updated = [...heroSlides];
//     updated[index] = value;
//     setHeroSlides(updated);
//   };
//   const deleteHeroSlide = (index) => {
//     const updated = [...heroSlides];
//     updated[index] = "";
//     setHeroSlides(updated);
//   };

//   const addGalleryImage = () => setGalleryImages([...galleryImages, ""]);
//   const updateGalleryImage = (index, value) => {
//     const updated = [...galleryImages];
//     updated[index] = value;
//     setGalleryImages(updated);
//   };
//   const removeGalleryImage = (index) =>
//     setGalleryImages(galleryImages.filter((_, i) => i !== index));

//   const addExtraSection = () =>
//     setExtraSections([...extraSections, { id: Date.now(), label: "", imageURL: "" }]);
//   const updateExtraLabel = (id, label) =>
//     setExtraSections(extraSections.map((sec) => (sec.id === id ? { ...sec, label } : sec)));
//   const updateExtraImage = (id, imageURL) =>
//     setExtraSections(extraSections.map((sec) => (sec.id === id ? { ...sec, imageURL } : sec)));
//   const removeExtraSection = (id) => {
//     if (extraSections.length <= 4) {
//       toast.error("Minimum 4 images required");
//       return;
//     }
//     setExtraSections(extraSections.filter((sec) => sec.id !== id));
//   };

//   const saveHomeContent = async () => {
//     setSaving(true);
//     try {
//       await setDoc(doc(db, "homePage", "mainContent"), {
//         heroSlides,
//         galleryImages,
//         pricingImage,
//         promotionImage,
//         aboutText,
//         extraSections,
//         storySection,
//       });
//       toast.success("Home content updated successfully!");
//     } catch {
//       toast.error("Error saving. Try again.");
//     }
//     setSaving(false);
//   };

//   const deleteAllContent = async () => {
//     const confirm = window.confirm("Are you sure? This will delete ALL home page content.");
//     if (!confirm) return;
//     await setDoc(doc(db, "homePage", "mainContent"), {
//       heroSlides: ["", "", "", "", ""],
//       galleryImages: [],
//       pricingImage: "",
//       promotionImage: "",
//       aboutText: "",
//       extraSections: [],
//     });
//     setHeroSlides(["", "", "", "", ""]);
//     setGalleryImages([]);
//     setPricingImage("");
//     setPromotionImage("");
//     setAboutText("");
//     setExtraSections([]);
//     toast.success("All content deleted");
//   };

//   // shared input classes
//   const inp = "w-full border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-4 py-3 text-base text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all";
//   const inpSm = "flex-1 min-w-0 border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-4 py-3 text-base text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all";

//   return (
//     <div className="min-h-screen bg-white mt-16 pb-24">
//       <div className="w-[92%] mx-auto">

//         {/* ════════════════════════════════════════
//             PAGE HEADER — part of the page flow
//         ════════════════════════════════════════ */}
//         <div className="py-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border-b border-slate-200">
//           {/* Left: breadcrumb + title */}
//           <div>
//             <div className="flex items-center gap-2 mb-2">
//               <button
//                 onClick={() => navigate("/admin/dashboard")}
//                 className="text-base font-semibold text-slate-500 hover:text-purple-600 transition-colors"
//               >
//                 Back
//               </button>
//               <span className="text-slate-400 text-lg">/</span>
//               <span className="text-base font-semibold text-slate-800">Manage Home Page</span>
//             </div>
//             <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight">
//               Home Page Content
//             </h1>
//             <p className="text-base text-slate-500 mt-1.5">
//               Changes save directly to Firebase and go live instantly.
//             </p>
//           </div>

//           {/* Right: action buttons */}
//           <div className="flex items-center gap-3 flex-wrap">
//             <button
//               onClick={deleteAllContent}
//               className="flex items-center gap-2 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap"
//             >
//               🗑️ Delete All
//             </button>
//             <button
//               onClick={saveHomeContent}
//               disabled={saving}
//               className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap"
//             >
//               {saving ? (
//                 <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
//               ) : "💾 Save Changes"}
//             </button>
//           </div>
//         </div>

//         {/* ════════════════════════════════════════
//             UNIFIED FORM — no cards, just sections
//         ════════════════════════════════════════ */}
//         <div className="divide-y divide-slate-200">

//           {/* ── 01 HERO CAROUSEL ── */}
//           <Section number="01" title="Hero Carousel" description="Images displayed in the main slider at the top of your homepage. Paste image URLs below.">
//             <div className="space-y-3">
//               {heroSlides.map((slide, index) => (
//                 <div key={index} className="flex items-center gap-3">
//                   <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-sm font-bold">
//                     {index + 1}
//                   </span>
//                   <input
//                     value={slide}
//                     placeholder={`Slide ${index + 1} — paste image URL here…`}
//                     onChange={(e) => updateHeroSlide(index, e.target.value)}
//                     className={inpSm}
//                   />
//                   {slide && (
//                     <img src={slide} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />
//                   )}
//                   <button
//                     onClick={() => deleteHeroSlide(index)}
//                     className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-base"
//                   >✕</button>
//                 </div>
//               ))}
//             </div>
//             <p className="text-sm text-slate-400 mt-4">💡 Use 1920×600px images for best results.</p>
//           </Section>

//           {/* ── 02 STORY SECTION ── */}
//           <Section number="02" title="Story Section" description="A mid-page section with a title, two paragraphs of text, and two supporting images.">
//             <div className="space-y-5">
//               <div>
//                 <Label>Section Title</Label>
//                 <input
//                   value={storySection.title}
//                   placeholder="e.g. Every Picture Tells a Story"
//                   onChange={(e) => setStorySection({ ...storySection, title: e.target.value })}
//                   className={inp}
//                 />
//               </div>
//               <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
//                 <div>
//                   <Label>Paragraph 1</Label>
//                   <textarea
//                     rows={4}
//                     value={storySection.description1}
//                     placeholder="First descriptive paragraph…"
//                     onChange={(e) => setStorySection({ ...storySection, description1: e.target.value })}
//                     className={inp + " resize-none"}
//                   />
//                 </div>
//                 <div>
//                   <Label>Paragraph 2</Label>
//                   <textarea
//                     rows={4}
//                     value={storySection.description2}
//                     placeholder="Second descriptive paragraph…"
//                     onChange={(e) => setStorySection({ ...storySection, description2: e.target.value })}
//                     className={inp + " resize-none"}
//                   />
//                 </div>
//               </div>
//               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
//                 <div>
//                   <Label>Image 1 — Left Side</Label>
//                   <div className="flex items-center gap-3">
//                     <input
//                       value={storySection.image1}
//                       placeholder="Paste image URL…"
//                       onChange={(e) => setStorySection({ ...storySection, image1: e.target.value })}
//                       className={inpSm}
//                     />
//                     {storySection.image1 && <img src={storySection.image1} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />}
//                   </div>
//                 </div>
//                 <div>
//                   <Label>Image 2 — Right Side</Label>
//                   <div className="flex items-center gap-3">
//                     <input
//                       value={storySection.image2}
//                       placeholder="Paste image URL…"
//                       onChange={(e) => setStorySection({ ...storySection, image2: e.target.value })}
//                       className={inpSm}
//                     />
//                     {storySection.image2 && <img src={storySection.image2} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />}
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </Section>

//           {/* ── 03 GALLERY IMAGES ── */}
//           <Section number="03" title="Gallery Images" description="Images shown in the photo gallery section. Add as many as you need.">
//             <button
//               onClick={addGalleryImage}
//               className="flex items-center gap-2 bg-green-50 hover:bg-green-600 border border-green-200 hover:border-green-600 text-green-600 hover:text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 mb-4"
//             >
//               + Add Gallery Image
//             </button>
//             {galleryImages.length === 0 && (
//               <p className="text-base text-slate-400 text-center py-8 bg-white rounded-xl border border-dashed border-slate-200">
//                 No gallery images yet — click "Add Gallery Image" to start.
//               </p>
//             )}
//             <div className="space-y-3">
//               {galleryImages.map((img, index) => (
//                 <div key={index} className="flex items-center gap-3">
//                   <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center text-green-600 text-sm font-bold">{index + 1}</span>
//                   <input
//                     value={img}
//                     placeholder="Gallery image URL…"
//                     onChange={(e) => updateGalleryImage(index, e.target.value)}
//                     className={inpSm}
//                   />
//                   {img && <img src={img} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />}
//                   <button
//                     onClick={() => removeGalleryImage(index)}
//                     className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-base"
//                   >✕</button>
//                 </div>
//               ))}
//             </div>
//           </Section>

//           {/* ── 04 BANNERS ── */}
//           <Section number="04" title="Banners" description="Wide banner images for the Pricing and Promotion sections on your homepage.">
//             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
//               <div>
//                 <Label>Pricing Banner</Label>
//                 <div className="flex items-center gap-3">
//                   <input
//                     value={pricingImage}
//                     placeholder="Pricing banner image URL…"
//                     onChange={(e) => setPricingImage(e.target.value)}
//                     className={inpSm}
//                   />
//                   {pricingImage && <img src={pricingImage} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />}
//                 </div>
//               </div>
//               <div>
//                 <Label>Promotion Banner</Label>
//                 <div className="flex items-center gap-3">
//                   <input
//                     value={promotionImage}
//                     placeholder="Promotion banner image URL…"
//                     onChange={(e) => setPromotionImage(e.target.value)}
//                     className={inpSm}
//                   />
//                   {promotionImage && <img src={promotionImage} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />}
//                 </div>
//               </div>
//             </div>
//           </Section>

//           {/* ── 05 ABOUT TEXT ── */}
//           <Section number="05" title="About Text" description="A short description of your business shown in the About section of the homepage.">
//             <Label>Description</Label>
//             <textarea
//               rows={5}
//               value={aboutText}
//               placeholder="Write something about your business, services, or team…"
//               onChange={(e) => setAboutText(e.target.value)}
//               className={inp + " resize-none"}
//             />
//             <p className="text-sm text-slate-400 mt-2 text-right">{aboutText.length} characters</p>
//           </Section>

//           {/* ── 06 EXTRA GALLERY ── */}
//           <Section number="06" title="Extra Gallery Sections" description="Gallery grid images on the homepage. Minimum 4 required. Give each image a title and URL.">
//             <button
//               onClick={addExtraSection}
//               className="flex items-center gap-2 bg-purple-50 hover:bg-purple-600 border border-purple-200 hover:border-purple-600 text-purple-600 hover:text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 mb-4"
//             >
//               + Add Image
//             </button>
//             <div className="space-y-3">
//               {extraSections.map((sec, index) => (
//                 <div key={sec.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
//                   <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-sm font-bold">{index + 1}</span>
//                   <input
//                     value={sec.label}
//                     placeholder="Title (e.g. Wedding)"
//                     onChange={(e) => updateExtraLabel(sec.id, e.target.value)}
//                     className="w-full sm:w-44 lg:w-56 border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-4 py-3 text-base text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all"
//                   />
//                   <input
//                     value={sec.imageURL}
//                     placeholder="Image URL (required)"
//                     onChange={(e) => updateExtraImage(sec.id, e.target.value)}
//                     className="w-full sm:flex-1 min-w-0 border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-4 py-3 text-base text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all"
//                   />
//                   {sec.imageURL && <img src={sec.imageURL} alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />}
//                   <button
//                     onClick={() => removeExtraSection(sec.id)}
//                     className="flex-shrink-0 w-10 h-10 rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-base"
//                   >✕</button>
//                 </div>
//               ))}
//             </div>
//             <p className="text-sm text-slate-400 mt-4">⚠️ Minimum 4 images required — delete is blocked below that.</p>
//           </Section>

//         </div>

//         {/* ── BOTTOM SAVE BAR ── */}
//         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-8 border-t border-slate-200 mt-2">
//           <p className="text-sm text-slate-400">Changes go live instantly after saving.</p>
//           <div className="flex items-center gap-3 flex-wrap">
//             <button
//               onClick={() => navigate("/admin/dashboard")}
//               className="border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap"
//             >
//               ← Back to Dashboard
//             </button>
//             <button
//               onClick={deleteAllContent}
//               className="border border-red-200 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 text-sm font-semibold px-5 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap"
//             >
//               🗑️ Delete All
//             </button>
//             <button
//               onClick={saveHomeContent}
//               disabled={saving}
//               className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap"
//             >
//               {saving ? (
//                 <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving…</>
//               ) : "💾 Save All Changes"}
//             </button>
//           </div>
//         </div>

//       </div>
//     </div>
//   );
// }

// export default AdminHomeContent;

// /* ── SECTION — full-width horizontal row with number, title, content ── */
// const Section = ({ number, title, description, children }) => (
//   <div className="py-10 flex flex-col lg:flex-row gap-6 lg:gap-12">
//     {/* Left label */}
//     <div className="lg:w-72 xl:w-80 flex-shrink-0">
//       <div className="flex items-center gap-3 mb-2">
//         <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 text-purple-600 text-sm font-extrabold flex-shrink-0">
//           {number}
//         </span>
//         <h3 className="text-xl font-bold text-slate-800">{title}</h3>
//       </div>
//       <p className="text-sm text-slate-500 leading-relaxed pl-11">{description}</p>
//     </div>
//     {/* Right content */}
//     <div className="flex-1 min-w-0">
//       {children}
//     </div>
//   </div>
// );

// /* ── LABEL ── */
// const Label = ({ children }) => (
//   <label className="block text-sm font-bold text-slate-600 uppercase tracking-wider mb-2">
//     {children}
//   </label>
// );



import { useEffect, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, get, set } from "firebase/database";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

function AdminHomeContent() {
  const navigate = useNavigate();

  const [heroSlides, setHeroSlides] = useState(["", "", "", "", ""]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [pricingImage, setPricingImage] = useState("");
  const [promotionImage, setPromotionImage] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [saving, setSaving] = useState(false);
  const [extraSections, setExtraSections] = useState([
    { id: Date.now() + 1, label: "", imageURL: "" },
    { id: Date.now() + 2, label: "", imageURL: "" },
    { id: Date.now() + 3, label: "", imageURL: "" },
    { id: Date.now() + 4, label: "", imageURL: "" },
  ]);
  const [storySection, setStorySection] = useState({
    title: "",
    description1: "",
    description2: "",
    image1: "",
    image2: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const snap = await get(ref(db, "homePage/mainContent"));
        if (snap.exists()) {
          const data = snap.val();
          setHeroSlides(data.heroSlides || ["", "", "", "", ""]);
          setGalleryImages(data.galleryImages || []);
          setPricingImage(data.pricingImage || "");
          setPromotionImage(data.promotionImage || "");
          setAboutText(data.aboutText || "");
          setExtraSections(data.extraSections || []);
          setStorySection(
            data.storySection || { title: "", description1: "", description2: "", image1: "", image2: "" }
          );
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  const updateHeroSlide = (i, v) => { const a = [...heroSlides]; a[i] = v; setHeroSlides(a); };
  const deleteHeroSlide = (i) => { const a = [...heroSlides]; a[i] = ""; setHeroSlides(a); };
  const addGalleryImage = () => setGalleryImages([...galleryImages, ""]);
  const updateGalleryImage = (i, v) => { const a = [...galleryImages]; a[i] = v; setGalleryImages(a); };
  const removeGalleryImage = (i) => setGalleryImages(galleryImages.filter((_, idx) => idx !== i));
  const addExtraSection = () => setExtraSections([...extraSections, { id: Date.now(), label: "", imageURL: "" }]);
  const updateExtraLabel = (id, label) => setExtraSections(extraSections.map((s) => s.id === id ? { ...s, label } : s));
  const updateExtraImage = (id, imageURL) => setExtraSections(extraSections.map((s) => s.id === id ? { ...s, imageURL } : s));
  const removeExtraSection = (id) => {
    if (extraSections.length <= 4) { toast.error("Minimum 4 images required"); return; }
    setExtraSections(extraSections.filter((s) => s.id !== id));
  };

  const saveHomeContent = async () => {
    setSaving(true);
    try {
      await set(ref(db, "homePage/mainContent"), {
        heroSlides, galleryImages, pricingImage, promotionImage, aboutText, extraSections, storySection,
      });
      toast.success("Home content updated successfully!");
    } catch (err) { console.error(err); toast.error("Error saving. Try again."); }
    setSaving(false);
  };

  const deleteAllContent = async () => {
    if (!window.confirm("Are you sure? This will delete ALL home page content.")) return;
    const empty = { heroSlides: ["", "", "", "", ""], galleryImages: [], pricingImage: "", promotionImage: "", aboutText: "", extraSections: [] };
    await set(ref(db, "homePage/mainContent"), empty);
    setHeroSlides(["", "", "", "", ""]); setGalleryImages([]); setPricingImage(""); setPromotionImage(""); setAboutText(""); setExtraSections([]);
    toast.success("All content deleted");
  };

  const inp = "w-full border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-4 py-3 text-sm text-slate-700 placeholder-slate-400 bg-white transition-all";

  return (
    <div className="min-h-screen bg-slate-50 mt-16 pb-28">
      {/* 90% width on laptop, full on mobile */}
      <div className="w-full lg:w-[90%] mx-auto px-4 sm:px-6 lg:px-0">

        {/* PAGE HEADER */}
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
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">🏠 Home Page Content</h1>
              <p className="text-sm text-slate-500 mt-1">Edit every section of your homepage. Press <strong>Save All Changes</strong> when you're done.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={deleteAllContent} className="flex items-center gap-1.5 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap">
                🗑️ Delete All
              </button>
              <button onClick={saveHomeContent} disabled={saving} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap">
                {saving ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</> : "💾 Save All Changes"}
              </button>
            </div>
          </div>
        </div>

        {/* SECTIONS */}
        <div className="divide-y divide-slate-200">

          {/* 01 HERO CAROUSEL */}
          <Section
            number="01" icon="🖼️" title="Hero Carousel (Top Slider)"
            what="The big banner images visitors see first on your homepage — they slide automatically one by one."
            how="Upload your photo to any image host (Google Drive, Imgur, etc.), then copy and paste the direct image link into the box."
            spec="Best size: 1920 × 600 px  •  Wide landscape photos work best"
          >
            <div className="space-y-3">
              {heroSlides.map((slide, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">
                    {index + 1}
                  </span>
                  <input
                    value={slide}
                    placeholder={`Slide ${index + 1} — paste image link here (e.g. https://i.imgur.com/abc.jpg)`}
                    onChange={(e) => updateHeroSlide(index, e.target.value)}
                    className={inp}
                  />
                  {slide ? (
                    <img src={slide} alt="preview" className="w-14 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />
                  ) : (
                    <div className="w-14 h-10 rounded-lg border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-slate-300 text-xs">preview</span>
                    </div>
                  )}
                  <button onClick={() => deleteHeroSlide(index)} className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-sm">✕</button>
                </div>
              ))}
            </div>
          </Section>

          {/* 02 STORY SECTION */}
          <Section
            number="02" icon="📖" title="Story / About Section"
            what="A section in the middle of your homepage with a heading, two paragraphs of text, and two photos side by side."
            how="Write your studio story in the two text boxes. Then paste image links for the two side-by-side photos."
            spec="Photo size: 800 × 600 px  •  Portrait or square photos work best here"
          >
            <div className="space-y-5">
              <div>
                <FieldLabel>Section Heading</FieldLabel>
                <input
                  value={storySection.title}
                  placeholder="e.g.  Every Picture Tells a Story"
                  onChange={(e) => setStorySection({ ...storySection, title: e.target.value })}
                  className={inp}
                />
                <Hint>This is the big bold title that appears above the text paragraphs.</Hint>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Paragraph 1 — Left Column</FieldLabel>
                  <textarea rows={5} value={storySection.description1} placeholder="Write your first paragraph here. Talk about your studio, mission, or experience…" onChange={(e) => setStorySection({ ...storySection, description1: e.target.value })} className={inp + " resize-none"} />
                </div>
                <div>
                  <FieldLabel>Paragraph 2 — Right Column</FieldLabel>
                  <textarea rows={5} value={storySection.description2} placeholder="Continue the story — team details, awards, or what makes you unique…" onChange={(e) => setStorySection({ ...storySection, description2: e.target.value })} className={inp + " resize-none"} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Photo 1 — Shown on the LEFT", key: "image1", placeholder: "Paste link for left photo…" },
                  { label: "Photo 2 — Shown on the RIGHT", key: "image2", placeholder: "Paste link for right photo…" },
                ].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <FieldLabel>{label}</FieldLabel>
                    <div className="flex items-center gap-2">
                      <input value={storySection[key]} placeholder={placeholder} onChange={(e) => setStorySection({ ...storySection, [key]: e.target.value })} className={inp} />
                      {storySection[key] ? (
                        <img src={storySection[key]} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />
                      ) : (
                        <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-300 text-xs text-center leading-tight">no<br />img</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* 03 GALLERY */}
          <Section
            number="03" icon="🎨" title="Photo Gallery"
            what="A grid of photos shown in your Gallery section. Visitors scroll through these images to see your work."
            how="Click '+ Add Photo' to add a slot, then paste the photo link. You can add as many as needed."
            spec="Best size: 800 × 800 px  •  Square photos look cleanest in a grid"
          >
            <button onClick={addGalleryImage} className="flex items-center gap-2 bg-green-50 hover:bg-green-600 border border-green-200 hover:border-green-600 text-green-600 hover:text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 mb-4">
              + Add Photo
            </button>
            {galleryImages.length === 0 && (
              <div className="text-center py-10 border border-dashed border-slate-300 rounded-xl bg-white">
                <p className="text-3xl mb-2">📷</p>
                <p className="text-sm font-semibold text-slate-500">No gallery photos yet</p>
                <p className="text-xs text-slate-400 mt-1">Click "+ Add Photo" above to get started</p>
              </div>
            )}
            <div className="space-y-3">
              {galleryImages.map((img, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-green-100 border border-green-200 flex items-center justify-center text-green-600 text-xs font-bold">{index + 1}</span>
                  <input value={img} placeholder="Paste photo link here (e.g. https://i.imgur.com/xyz.jpg)" onChange={(e) => updateGalleryImage(index, e.target.value)} className={inp} />
                  {img ? (
                    <img src={img} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-300 text-xs">img</div>
                  )}
                  <button onClick={() => removeGalleryImage(index)} className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-sm">✕</button>
                </div>
              ))}
            </div>
          </Section>

          {/* 04 BANNERS */}
          <Section
            number="04" icon="📢" title="Promotional Banners"
            what="Two wide banner images inside your homepage — one for your Pricing section, one for Promotions."
            how="Paste the image link for each banner below. These display as full-width images on the page."
            spec="Best size: 1920 × 400 px  •  Wide landscape banners with bold text work great"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">💰</span>
                  <FieldLabel>Pricing Banner</FieldLabel>
                </div>
                <p className="text-xs text-slate-400 mb-3">Appears in the <strong>Pricing section</strong>. Use an image showing your packages or rates.</p>
                <div className="flex items-center gap-2">
                  <input value={pricingImage} placeholder="Paste pricing banner image link…" onChange={(e) => setPricingImage(e.target.value)} className={inp} />
                  {pricingImage ? (
                    <img src={pricingImage} alt="" className="w-14 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />
                  ) : (
                    <div className="w-14 h-10 rounded-lg border border-dashed border-slate-300 bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-300 text-xs">img</div>
                  )}
                </div>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎉</span>
                  <FieldLabel>Promotion Banner</FieldLabel>
                </div>
                <p className="text-xs text-slate-400 mb-3">Appears in the <strong>Promotions section</strong>. Highlight special offers, discounts, or seasonal deals.</p>
                <div className="flex items-center gap-2">
                  <input value={promotionImage} placeholder="Paste promotion banner image link…" onChange={(e) => setPromotionImage(e.target.value)} className={inp} />
                  {promotionImage ? (
                    <img src={promotionImage} alt="" className="w-14 h-10 rounded-lg object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />
                  ) : (
                    <div className="w-14 h-10 rounded-lg border border-dashed border-slate-300 bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-300 text-xs">img</div>
                  )}
                </div>
              </div>
            </div>
          </Section>

          {/* 05 ABOUT TEXT */}
          <Section
            number="05" icon="✍️" title="About Us Text"
            what="A short paragraph about your business shown in the About section of your homepage."
            how="Simply type or paste your business description. Keep it friendly, clear, and welcoming."
            spec="Recommended: 100–300 characters  •  Short and impactful works best"
          >
            <FieldLabel>Your Business Description</FieldLabel>
            <textarea
              rows={5}
              value={aboutText}
              placeholder="e.g. We are a professional photography studio based in Hyderabad, specialising in weddings, portraits, and commercial shoots. With 10+ years of experience, we capture your most precious moments beautifully…"
              onChange={(e) => setAboutText(e.target.value)}
              className={inp + " resize-none"}
            />
            <div className="flex items-center justify-between mt-2">
              <Hint>This appears under the "About Us" heading on your homepage.</Hint>
              <span className={`text-xs font-semibold ${aboutText.length > 300 ? "text-orange-500" : "text-slate-400"}`}>{aboutText.length} characters</span>
            </div>
          </Section>

          {/* 06 EXTRA GALLERY / CATEGORY GRID */}
          <Section
            number="06" icon="🗂️" title="Category Gallery Grid"
            what="A grid showing your photography categories — e.g. Weddings, Portraits, Events. Each tile shows a photo and a label."
            how="Give each tile a category name and paste its cover photo link. You need at least 4 tiles."
            spec="Best size: 600 × 600 px  •  Square photos  •  Minimum 4 tiles required"
          >
            <button onClick={addExtraSection} className="flex items-center gap-2 bg-purple-50 hover:bg-purple-600 border border-purple-200 hover:border-purple-600 text-purple-600 hover:text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 mb-5">
              + Add Category Tile
            </button>

            {/* Desktop column headers */}
            <div className="hidden sm:flex items-center gap-3 px-4 mb-2">
              <div className="w-8" />
              <span className="w-44 text-xs font-bold text-slate-400 uppercase tracking-wider">Category Name</span>
              <span className="flex-1 text-xs font-bold text-slate-400 uppercase tracking-wider">Photo Link (URL)</span>
              <span className="w-12 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Preview</span>
              <div className="w-9" />
            </div>

            <div className="space-y-3">
              {extraSections.map((sec, index) => (
                <div key={sec.id} className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">{index + 1}</span>

                  <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
                    <div className="sm:w-44">
                      <p className="text-xs text-slate-400 mb-1 sm:hidden">Category Name</p>
                      <input
                        value={sec.label}
                        placeholder="e.g. Wedding, Portrait"
                        onChange={(e) => updateExtraLabel(sec.id, e.target.value)}
                        className="w-full border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-400 mb-1 sm:hidden">Photo Link</p>
                      <input
                        value={sec.imageURL}
                        placeholder="Paste photo link (URL) here…"
                        onChange={(e) => updateExtraImage(sec.id, e.target.value)}
                        className="w-full border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {sec.imageURL ? (
                    <img src={sec.imageURL} alt="" className="w-12 h-12 rounded-xl object-cover border border-slate-200 flex-shrink-0" onError={(e) => (e.target.style.display = "none")} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl border border-dashed border-slate-300 bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-300 text-xs">img</div>
                  )}

                  <button onClick={() => removeExtraSection(sec.id)} className="flex-shrink-0 w-9 h-9 rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-sm">✕</button>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4 inline-block">
              ⚠️ You must keep at least 4 tiles — the delete button is blocked if fewer than 4 remain.
            </p>
          </Section>

        </div>

        {/* FIXED BOTTOM SAVE BAR */}
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 z-50">
          <div className="w-full lg:w-[90%] mx-auto flex items-center justify-between gap-3">
            <p className="text-xs text-slate-400 hidden sm:block">💡 Changes go live on your website the moment you save.</p>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => navigate("/admin/dashboard")} className="border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95 hidden sm:flex">← Back</button>
              <button onClick={deleteAllContent} className="border border-red-200 text-red-500 hover:bg-red-500 hover:text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all active:scale-95 whitespace-nowrap">🗑️ Delete All</button>
              <button onClick={saveHomeContent} disabled={saving} className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-purple-200 transition-all active:scale-95 whitespace-nowrap">
                {saving ? <><span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</> : "💾 Save All Changes"}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default AdminHomeContent;

/* SECTION */
const Section = ({ number, icon, title, what, how, spec, children }) => (
  <div className="py-8 sm:py-10">
    <div className="flex items-center gap-3 mb-4">
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-600 text-white text-xs font-extrabold flex-shrink-0">{number}</span>
      <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">{icon} {title}</h3>
    </div>

    {/* Info strip */}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 ml-0 sm:ml-11">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-1">📌 What is this?</p>
        <p className="text-xs text-blue-800 leading-relaxed">{what}</p>
      </div>
      <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-purple-500 uppercase tracking-wider mb-1">🛠 How to fill</p>
        <p className="text-xs text-purple-800 leading-relaxed">{how}</p>
      </div>
      <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">📐 Recommended Size</p>
        <p className="text-xs text-slate-700 leading-relaxed">{spec}</p>
      </div>
    </div>

    <div className="ml-0 sm:ml-11">{children}</div>
  </div>
);

const FieldLabel = ({ children }) => (
  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">{children}</label>
);

const Hint = ({ children }) => (
  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{children}</p>
);