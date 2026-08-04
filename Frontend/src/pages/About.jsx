import { useSiteSettings } from "../context/siteSettingsContext";
import ImagePreview from "../components/ImagePreview";

/**
 * About page. All copy, imagery and tiles come from site settings in MongoDB —
 * an admin edits them in the admin panel, and each section simply does not
 * render until it has content.
 */
function About() {
  const { settings, loading } = useSiteSettings();
  const { about, companyName } = settings;

  const hasIntro = Boolean(about.body || about.image);
  const hasServices = about.services?.length > 0;
  const hasFeatures = about.features?.length > 0;
  const hasAnything = Boolean(about.heading || about.subheading) || hasIntro || hasServices || hasFeatures;

  if (loading) {
    return (
      <div className="bg-slate-50 pt-16 min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-4 border-purple-200 border-t-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 pt-16">

      {/* HERO */}
      {(about.heading || about.subheading) && (
        <section className="relative overflow-hidden bg-[#330962] text-white py-16 text-center px-4">
          <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-purple-400/20 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-[80px] pointer-events-none" />
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-300/60 to-transparent pointer-events-none" />
          <div className="relative z-10">
            {about.heading && (
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-md tracking-tight">
                {about.heading}
              </h1>
            )}
            {about.subheading && (
              <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-purple-100/90 leading-relaxed">
                {about.subheading}
              </p>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent pointer-events-none" />
        </section>
      )}

      {/* ABOUT INTRO */}
      {hasIntro && (
        <section className="max-w-6xl mx-auto px-4 py-14">
          <div className={`grid gap-10 items-center ${about.image ? "md:grid-cols-2" : "grid-cols-1"}`}>

            {about.body && (
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#330962] mb-4">
                  {companyName ? `About ${companyName}` : "Who We Are"}
                </h2>
                {/* Blank lines in the stored text become paragraph breaks. */}
                {about.body.split(/\n\s*\n/).map((paragraph, index) => (
                  <p key={index} className="text-gray-700 mb-4 leading-relaxed whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            )}

            {about.image && (
              <div>
                <ImagePreview
                  src={about.image}
                  alt={companyName ? `${companyName} team` : "About us"}
                  rounded="rounded-xl"
                  className="shadow-lg w-full h-[300px]"
                />
              </div>
            )}

          </div>
        </section>
      )}

      {/* WHAT WE DO */}
      {hasServices && (
        <section className="bg-gray-50 py-14">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold tracking-widest uppercase text-white bg-[#330962] border border-purple-200 px-4 py-1.5 rounded-full mb-3">
                Our Events
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">What We Do</h2>
              <div className="mt-3 mx-auto w-12 h-1 rounded-full bg-[#330962]" />
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
              {about.services.map((service, index) => (
                <div key={`${service.title}-${index}`} className="group relative bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-[#330962] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                  <div className="relative z-10">
                    {service.icon && (
                      <div className="w-12 h-12 rounded-xl bg-[#330962] border border-purple-100 flex items-center justify-center text-2xl mb-4 group-hover:bg-purple-100 transition-colors duration-300">
                        {service.icon}
                      </div>
                    )}
                    <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 group-hover:text-white transition-colors duration-300">
                      {service.title}
                    </h3>
                    {service.description && (
                      <p className="text-sm text-[#330962] group-hover:text-white leading-relaxed">
                        {service.description}
                      </p>
                    )}
                    <div className="mt-4 h-0.5 w-0 bg-white rounded-full group-hover:w-10 transition-all duration-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WHY CHOOSE US */}
      {hasFeatures && (
        <section className="py-14 bg-white">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold tracking-widest uppercase text-white bg-[#330962] border border-purple-200 px-4 py-1.5 rounded-full mb-3">
                Why Us
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Why Choose Us</h2>
              <div className="mt-3 mx-auto w-12 h-1 rounded-full bg-[#330962]" />
            </div>
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {about.features.map((item, index) => (
                <div key={`${item.title}-${index}`} className="group relative text-center bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
                  <div className="absolute inset-0 bg-[#330962] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                  <div className="relative z-10">
                    {item.icon && (
                      <div className="w-14 h-14 mx-auto rounded-2xl bg-[#330962] border border-purple-100 flex items-center justify-center text-2xl mb-4 group-hover:bg-purple-100 transition-colors duration-300">
                        {item.icon}
                      </div>
                    )}
                    <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-white transition-colors duration-300">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-sm sm:text-base text-gray-500 group-hover:text-white leading-relaxed">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-5 mx-auto h-0.5 w-0 bg-white rounded-full group-hover:w-10 transition-all duration-500" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Nothing configured yet — tell the admin where to fix it. */}
      {!hasAnything && (
        <section className="max-w-3xl mx-auto px-4 py-24 text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-3">About</h1>
          <p className="text-slate-500">
            This page has no content yet. Add it from the admin panel under Site Settings.
          </p>
        </section>
      )}

      {/* CTA */}
      <section className="relative overflow-hidden bg-[#330962] text-white text-center py-14 px-4">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-purple-400/20 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-300/60 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 tracking-tight drop-shadow-md">
            Let&apos;s Plan Your{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-fuchsia-200 to-pink-200">
              Next Event
            </span>
          </h2>
          <p className="mb-6 text-purple-100/90 text-sm sm:text-base">
            Contact us today and make your event unforgettable.
          </p>
          <a href="/contact" className="bg-white text-[#7c3aed] px-6 sm:px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-purple-300/50 hover:scale-105 transition-all duration-200">
            Contact Us
          </a>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent pointer-events-none" />
      </section>

    </div>
  );
}

export default About;
