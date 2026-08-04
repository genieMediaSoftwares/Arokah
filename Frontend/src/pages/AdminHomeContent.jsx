import { useEffect, useState } from "react";
import { getHomeContent, saveHomeContent as saveHomeContentRequest, clearHomeContent } from "../services/homeService";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import ImageUploader from "../components/ImageUploader";
import MultipleImageUploader from "../components/MultipleImageUploader";
import logger from "../utils/logger";

function AdminHomeContent() {
  const navigate = useNavigate();

  const [heroSlides, setHeroSlides] = useState(["", "", "", "", ""]);
  const [galleryImages, setGalleryImages] = useState([]);
  const [pricingImage, setPricingImage] = useState("");
  const [promotionImage, setPromotionImage] = useState("");
  const [aboutText, setAboutText] = useState("");
  const [saving, setSaving] = useState(false);
  // Fixed placeholder ids: these four starter rows exist before anything is
  // loaded, so they need stable keys that don't change on re-render.
  const [extraSections, setExtraSections] = useState([
    { id: "section-1", label: "", imageURL: "" },
    { id: "section-2", label: "", imageURL: "" },
    { id: "section-3", label: "", imageURL: "" },
    { id: "section-4", label: "", imageURL: "" },
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
        const data = await getHomeContent();
        if (data) {
          setHeroSlides(data.heroSlides?.length ? data.heroSlides : ["", "", "", "", ""]);
          setGalleryImages(data.galleryImages || []);
          setPricingImage(data.pricingImage || "");
          setPromotionImage(data.promotionImage || "");
          setAboutText(data.aboutText || "");
          // The server identifies each portfolio tile by `key`; mirror it into
          // the local `id` the form uses so re-saving keeps tiles stable.
          setExtraSections(
            (data.extraSections || []).map((section, index) => ({
              ...section,
              id: String(section.key || section.id || `section-${index}`),
            }))
          );
          setStorySection(
            data.storySection || { title: "", description1: "", description2: "", image1: "", image2: "" }
          );
        }
      } catch (err) {
        logger.error("Failed to load home content", err);
        toast.error(err?.message || "Could not load home page content");
      }
    };
    fetchData();
  }, []);

  // Hero slides and gallery images are managed entirely by MultipleImageUploader,
  // which hands back the whole array.
  const addExtraSection = () =>
    setExtraSections([...extraSections, { id: `section-${Date.now()}`, label: "", imageURL: "" }]);
  const updateExtraLabel = (id, label) => setExtraSections(extraSections.map((s) => s.id === id ? { ...s, label } : s));
  const updateExtraImage = (id, imageURL) => setExtraSections(extraSections.map((s) => s.id === id ? { ...s, imageURL } : s));
  const removeExtraSection = (id) => {
    if (extraSections.length <= 4) { toast.error("Minimum 4 images required"); return; }
    setExtraSections(extraSections.filter((s) => s.id !== id));
  };

  const saveHomeContent = async () => {
    setSaving(true);
    try {
      await saveHomeContentRequest({
        heroSlides, galleryImages, pricingImage, promotionImage, aboutText, extraSections, storySection,
      });
      toast.success("Home content updated successfully!");
    } catch (err) {
      logger.error("Home content request failed", err);
      if (err?.status === 401 || err?.status === 403) {
        toast.error("Your session has expired. Please sign in again.");
        navigate("/admin");
      } else if (err?.fieldErrors?.length) {
        toast.error(err.fieldErrors[0].message);
      } else {
        toast.error(err?.message || "Error saving. Try again.");
      }
    }
    setSaving(false);
  };

  const deleteAllContent = async () => {
    if (!window.confirm("Are you sure? This will delete ALL home page content.")) return;
    try {
      await clearHomeContent();
      setHeroSlides(["", "", "", "", ""]); setGalleryImages([]); setPricingImage(""); setPromotionImage(""); setAboutText(""); setExtraSections([]);
      setStorySection({ title: "", description1: "", description2: "", image1: "", image2: "" });
      toast.success("All content deleted");
    } catch (err) {
      logger.error("Home content request failed", err);
      toast.error(err?.message || "Could not delete the content. Try again.");
    }
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
            how="Click a slot to upload a photo, or drag an image straight onto it. Use the arrows to reorder slides."
            spec="Best size: 1920 × 600 px  •  Wide landscape photos work best"
          >
            <MultipleImageUploader
              value={heroSlides}
              onChange={setHeroSlides}
              folder="home"
              fixedSlots={5}
              columns="grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
              hint="Slides appear in the order shown"
            />
          </Section>

          {/* 02 STORY SECTION */}
          <Section
            number="02" icon="📖" title="Story / About Section"
            what="A section in the middle of your homepage with a heading, two paragraphs of text, and two photos side by side."
            how="Write your studio story in the two text boxes, then upload the two side-by-side photos."
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
                  { label: "Photo 1 — Shown on the LEFT", key: "image1" },
                  { label: "Photo 2 — Shown on the RIGHT", key: "image2" },
                ].map(({ label, key }) => (
                  <ImageUploader
                    key={key}
                    label={label}
                    value={storySection[key]}
                    onChange={(image) => setStorySection((prev) => ({ ...prev, [key]: image }))}
                    folder="home"
                    aspect="aspect-[4/3]"
                  />
                ))}
              </div>
            </div>
          </Section>

          {/* 03 GALLERY */}
          <Section
            number="03" icon="🎨" title="Photo Gallery"
            what="A grid of photos shown in your Gallery section. Visitors scroll through these images to see your work."
            how="Click 'Add Images' to upload — you can select several at once, or drag a batch onto the tile."
            spec="Best size: 800 × 800 px  •  Square photos look cleanest in a grid"
          >
            <MultipleImageUploader
              value={galleryImages}
              onChange={setGalleryImages}
              folder="gallery"
              max={60}
              hint="Photos appear in the order shown"
            />
          </Section>

          {/* 04 BANNERS */}
          <Section
            number="04" icon="📢" title="Promotional Banners"
            what="Two wide banner images inside your homepage — one for your Pricing section, one for Promotions."
            how="Upload each banner below. These display as full-width images on the page."
            spec="Best size: 1920 × 400 px  •  Wide landscape banners with bold text work great"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">💰</span>
                  <FieldLabel>Pricing Banner</FieldLabel>
                </div>
                <p className="text-xs text-slate-400 mb-3">Appears in the <strong>Pricing section</strong>. Use an image showing your packages or rates.</p>
                <ImageUploader
                  value={pricingImage}
                  onChange={setPricingImage}
                  folder="home"
                  aspect="aspect-[21/9]"
                />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🎉</span>
                  <FieldLabel>Promotion Banner</FieldLabel>
                </div>
                <p className="text-xs text-slate-400 mb-3">Appears in the <strong>Promotions section</strong>. Highlight special offers, discounts, or seasonal deals.</p>
                <ImageUploader
                  value={promotionImage}
                  onChange={setPromotionImage}
                  folder="home"
                  aspect="aspect-[21/9]"
                />
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
            how="Give each tile a category name and upload its cover photo. You need at least 4 tiles."
            spec="Best size: 600 × 600 px  •  Square photos  •  Minimum 4 tiles required"
          >
            <button onClick={addExtraSection} className="flex items-center gap-2 bg-purple-50 hover:bg-purple-600 border border-purple-200 hover:border-purple-600 text-purple-600 hover:text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-all active:scale-95 mb-5">
              + Add Category Tile
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {extraSections.map((sec, index) => (
                <div key={sec.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="w-8 h-8 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 text-xs font-bold">{index + 1}</span>
                    <button
                      onClick={() => removeExtraSection(sec.id)}
                      title="Remove this tile"
                      className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-500 border border-red-200 hover:border-red-500 text-red-400 hover:text-white flex items-center justify-center transition-all active:scale-95 text-sm"
                    >
                      ✕
                    </button>
                  </div>

                  <div>
                    <p className="text-xs text-slate-400 mb-1">Category Name</p>
                    <input
                      value={sec.label}
                      placeholder="e.g. Wedding, Portrait"
                      onChange={(e) => updateExtraLabel(sec.id, e.target.value)}
                      className="w-full border border-slate-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none rounded-xl px-3 py-2.5 text-sm text-slate-700 placeholder-slate-400 bg-slate-50 focus:bg-white transition-all"
                    />
                  </div>

                  <ImageUploader
                    value={sec.imageURL}
                    onChange={(image) => updateExtraImage(sec.id, image)}
                    folder="categories"
                    aspect="aspect-square"
                  />
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