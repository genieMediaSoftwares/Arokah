import React, { memo } from "react";
import { useEffect, useState } from "react";
import { db } from "../firebase/firebaseConfig";
import { ref, onValue } from "firebase/database";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay, EffectFade } from "swiper/modules";
import { useNavigate } from "react-router-dom";
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import "swiper/css/effect-fade";


function Home() {

  const [homeData, setHomeData] = useState(null);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [imageLoaded, setImageLoaded] = useState({});
  const navigate = useNavigate();
  const [lightbox, setLightbox] = useState(null); // { imageURL, label }

  useEffect(() => {
    const unsub = onValue(
      ref(db, "homePage/mainContent"),
      (snap) => {
        if (snap.exists()) {
          const val = snap.val();
          setHomeData(prev => JSON.stringify(prev) === JSON.stringify(val) ? prev : val);
        } else {
          setHomeData({});
        }
      },
      (err) => {
        console.error("Home onValue error:", err);
        setHomeData({});
      }
    );
    return () => unsub();
  }, []);

  if (!homeData) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="bg-white overflow-x-hidden">

      {/* HERO */}

      {homeData.heroSlides?.length > 0 && (
        <div className="relative w-full overflow-hidden">
          <Swiper
            modules={[Navigation, Pagination, Autoplay, EffectFade]}
            autoplay={{
              delay: 4000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true
            }}
            navigation={{
              nextEl: '.swiper-button-next-custom',
              prevEl: '.swiper-button-prev-custom',
            }}
            pagination={{
              clickable: true,
              dynamicBullets: true,
              el: '.swiper-pagination-custom'
            }}
            loop={homeData.heroSlides.length > 1}
            speed={800}
            effect="slide"
            fadeEffect={{ crossFade: true }}
            breakpoints={{
              320: { slidesPerView: 1 },
              640: { slidesPerView: 1 },
              768: { slidesPerView: 1 },
              1024: { slidesPerView: 1 }
            }}
            className="w-full h-auto"
          >

            {homeData.heroSlides.map((img, i) => img && (
              <SwiperSlide key={i}>
                <div className="relative w-full h-[440px] xs:h-[300px] sm:h-[460px] md:h-[480px] lg:h-[580px] xl:h-[680px] 2xl:h-[780px]">
                  {/* Loading skeleton */}
                  {!imageLoaded[i] && (
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 animate-pulse" />
                  )}

                  {/* Optimized image with lazy loading */}
                  <img
                    src={img}
                    alt={`Hero slide ${i + 1}`}

                    className={`
                   w-full h-full object-cover object-center
                   transition-opacity duration-500
                   ${imageLoaded[i] ? 'opacity-100' : 'opacity-0'}
                              `}
                    loading={i === 0 ? "eager" : "lazy"}
                    fetchPriority={i === 0 ? "high" : "low"}
                    decoding="async"
                    width="1920"
                    height="1080"
                    onLoad={() => setImageLoaded(prev => ({ ...prev, [i]: true }))}
                  />


                  {/* Swiper lazy loading preloader */}
                  <div className="swiper-lazy-preloader swiper-lazy-preloader-white"></div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>

          {/* Custom Navigation Buttons - Previous */}
          <button
            className="swiper-button-prev-custom absolute left-2 sm:left-4 lg:left-6 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 "
            aria-label="Previous slide"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Custom Navigation Buttons - Next */}
          <button
            className="swiper-button-next-custom absolute right-2 sm:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-10 w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition-all duration-300 "
            aria-label="Next slide"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Custom Pagination */}
          <div className="swiper-pagination-custom absolute bottom-4 sm:bottom-6 left-0 right-0 flex items-center justify-center gap-2 z-10 [&_.swiper-pagination-bullet]:w-2 [&_.swiper-pagination-bullet]:h-2 [&_.swiper-pagination-bullet]:sm:w-2.5 [&_.swiper-pagination-bullet]:sm:h-2.5 [&_.swiper-pagination-bullet]:bg-white [&_.swiper-pagination-bullet]:opacity-60 [&_.swiper-pagination-bullet]:rounded-full [&_.swiper-pagination-bullet]:transition-all [&_.swiper-pagination-bullet]:duration-300 [&_.swiper-pagination-bullet-active]:!w-6 [&_.swiper-pagination-bullet-active]:sm:!w-8 [&_.swiper-pagination-bullet-active]:!opacity-100 [&_.swiper-pagination-bullet-active]:!rounded-sm"></div>
        </div>
      )}

      {/* STORY SECTION */}
      {/* {homeData?.storySection && (
        <section className="py-6 md:py-24 bg-white">

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-14 items-center">

              <div className="order-2 lg:order-1 text-center lg:text-left">

                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                  {homeData.storySection.title}
                </h2>

                <p className="text-lg text-slate-600 mb-6 leading-relaxed">
                  {homeData.storySection.description1}
                </p>

                <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                  {homeData.storySection.description2}
                </p>

                <a
                  href="/about"
                  className="inline-block px-7 py-3 bg-[#9333EA] text-white rounded-lg font-medium hover:bg-purple-700 transition shadow-md"
                >
                  Learn More About Us
                </a>
              </div>

              <div className="order-1 lg:order-2">
                <div className="grid grid-cols-2 gap-4">

                  <img
                    src={homeData.storySection.image1}
                    className="rounded-xl shadow-md w-full h-48 sm:h-64 object-cover"
                  />

                  <img
                    src={homeData.storySection.image2}
                    className="rounded-xl shadow-md w-full h-48 sm:h-64 object-cover mt-8"
                  />

                </div>
              </div>

            </div>
          </div>
        </section>
      )} */}
      {homeData?.storySection && (
        <section className="py-12 sm:py-16 lg:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center">

              {/* Text — LEFT aligned on all screens */}
              <div className="order-2 lg:order-1 text-left">
                <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4 sm:mb-5">
                  {homeData.storySection.title}
                </h2>
                <p className="text-base sm:text-lg text-slate-600 mb-4 leading-relaxed">
                  {homeData.storySection.description1}
                </p>
                <p className="text-base sm:text-lg text-slate-600 mb-6 leading-relaxed">
                  {homeData.storySection.description2}
                </p>
                <a
                  href="/about"
                  className="inline-block px-6 py-2.5 sm:px-7 sm:py-3 bg-[#330962] border border-transparent text-white rounded-lg font-medium hover:bg-white hover:text-[#330962] hover:border-[#330962] transition shadow-md text-sm sm:text-base"
                >
                  Learn More About Us
                </a>
              </div>

              {/* Images */}
              <div className="order-1 lg:order-2">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <img
                    src={homeData.storySection.image1}
                    className="rounded-xl shadow-md w-full h-40 sm:h-56 lg:h-64 object-cover"
                    alt="Story 1"
                    loading="lazy"
                    decoding="async"
                  />
                  <img
                    src={homeData.storySection.image2}
                    className="rounded-xl shadow-md w-full h-40 sm:h-56 lg:h-64 object-cover mt-6 sm:mt-8"
                    alt="Story 2"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>
      )}

      {(homeData.pricingImage || homeData.promotionImage) && (
        <section className="bg-white py-16 sm:py-20 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Section Heading */}
            <div className="text-center mb-12 sm:mb-16">
              <span className="inline-block text-xs font-bold tracking-widest uppercase text-white bg-[#330962] border border-purple-100 px-4 py-1.5 rounded-full mb-4">
                Our Offerings
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight">
                Pricing & Promotions
              </h2>
              <p className="text-gray-500 mt-4 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
                Explore our latest offers and customized packages designed for your special moments.
              </p>
              {/* Decorative line */}
              <div className="flex items-center justify-center gap-2 mt-5">
                <span className="w-8 h-0.5 bg-[#330962] rounded-full" />
                <span className="w-3 h-3 rounded-full bg-[#330962]" />
                <span className="w-8 h-0.5 bg-[#330962] rounded-full" />
              </div>
            </div>

            {/* Banners Grid */}
            <div className={`grid gap-6 sm:gap-8 ${homeData.pricingImage && homeData.promotionImage
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 max-w-3xl mx-auto"
              }`}>

              {homeData.pricingImage && (
                <div className="group flex flex-col">
                  {/* Card label */}
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <span className="w-2 h-7 bg-[#330962] rounded-full" />
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                      Pricing Packages
                    </h3>
                  </div>
                  {/* Image card */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl border border-slate-100 flex-1">
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 rounded-2xl sm:rounded-3xl" />
                    <img
                      src={homeData.pricingImage}
                      alt="Pricing Banner"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-56 sm:h-72 md:h-80 lg:h-96 object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    {/* Bottom badge */}
                    <div className="absolute bottom-4 left-4 z-20 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-400">
                      <span className="bg-white/90 backdrop-blur-sm text-purple-700 text-xs font-bold px-4 py-2 rounded-full shadow-md">
                        View Packages →
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {homeData.promotionImage && (
                <div className="group flex flex-col">
                  {/* Card label */}
                  <div className="flex items-center gap-2 mb-3 sm:mb-4">
                    <span className="w-2 h-7 bg-pink-500 rounded-full" />
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                      Special Promotions
                    </h3>
                  </div>
                  {/* Image card */}
                  <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-xl border border-slate-100 flex-1">
                    {/* Overlay on hover */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-10 rounded-2xl sm:rounded-3xl" />
                    <img
                      src={homeData.promotionImage}
                      alt="Promotion Banner"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-56 sm:h-72 md:h-80 lg:h-96 object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                    />
                    {/* Bottom badge */}
                    <div className="absolute bottom-4 left-4 z-20 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-400">
                      <span className="bg-white/90 backdrop-blur-sm text-pink-700 text-xs font-bold px-4 py-2 rounded-full shadow-md">
                        See Offers →
                      </span>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </section>
      )}

      {/* 🔒 GALLERY — KEEP OLD STYLE */}
      {homeData.galleryImages?.length > 0 && (
        <section>

          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-bold text-slate-900 mb-12 py-4">
            Event Gallery
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3">
            {homeData.galleryImages.map((src, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <img
                  src={src}
                  loading="lazy"
                  decoding="async"
                  className={`w-full h-full object-cover transition ${hoveredIndex === i ? "scale-110 brightness-75" : ""
                    }`}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {homeData.extraSections?.length > 0 && (
        <section className="py-16 sm:py-20 lg:py-24 bg-white">

          {/* Section Heading */}
          <div className="text-center mb-12 sm:mb-16 px-4">
            <span className="inline-block text-xs font-bold tracking-widest uppercase text-white bg-[#330962] border border-[#330962]/20 px-4 py-1.5 rounded-full mb-4">
              Portfolio
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold  leading-tight">
              Our Latest Work
            </h2>
            <p className="text-slate-400 mt-4 max-w-xl mx-auto text-base sm:text-lg leading-relaxed">
              Explore a selection of our favorite captures across different photography styles.
            </p>
            <div className="flex items-center justify-center gap-2 mt-5">
              <span className="w-8 h-px bg-[#330962] rounded-full" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#330962]" />
              <span className="w-8 h-px bg-[#330962] rounded-full" />
            </div>
          </div>

          {/* Gallery Grid */}

          <>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div
                className="gallery-grid grid gap-3 sm:gap-4"
                style={{
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gridAutoRows: "260px",
                }}
              >
                {homeData.extraSections.map((sec, index) =>
                  sec.imageURL ? (
                    <div
                      key={sec.id}
                      className="group relative overflow-hidden rounded-2xl cursor-pointer"
                      style={{
                        gridColumn: index % 7 === 0 ? "span 2" : "span 1",
                        gridRow: index % 7 === 0 ? "span 2" : "span 1",
                      }}
                      onClick={() => setLightbox({ imageURL: sec.imageURL, label: sec.label })}
                    >
                      <img
                        src={sec.imageURL}
                        alt={sec.label || "Gallery image"}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/50 transition-colors duration-500" />
                      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 to-transparent" />
                      {sec.label && (
                        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-5 py-4 translate-y-1 group-hover:translate-y-0 transition-transform duration-500">
                          <h3 className="text-white font-bold text-sm sm:text-base leading-tight drop-shadow">
                            {sec.label}
                          </h3>
                          <span className="block mt-1.5 h-0.5 w-0 bg-[#330962] group-hover:w-8 transition-all duration-500 rounded-full" />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      </div>
                    </div>
                  ) : null
                )}
              </div>

              <style>{`
      @media (max-width: 639px) {
        .gallery-grid {
          grid-template-columns: repeat(2, 1fr) !important;
          grid-auto-rows: 180px !important;
        }
        .gallery-grid > div {
          grid-column: span 1 !important;
          grid-row: span 1 !important;
        }
      }
    `}</style>
            </div>

            {/* ── Lightbox Modal ── */}
            {lightbox && (
              <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 sm:p-6 lg:p-10"
                onClick={() => setLightbox(null)}
              >
                <div
                  className="relative w-full h-full flex items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Image — no bg color, scales to fit screen naturally */}
                  <img
                    src={lightbox.imageURL}
                    alt={lightbox.label || "Gallery image"}
                    className="max-w-full max-h-full w-auto h-auto object-contain rounded-2xl shadow-2xl"
                    style={{ maxHeight: "calc(100vh - 80px)", maxWidth: "calc(100vw - 80px)" }}
                  />

                  {/* Label */}
                  {lightbox.label && (
                    <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-2">
                      <span className="bg-black/60 backdrop-blur-sm text-white font-semibold text-sm sm:text-base px-5 py-2 rounded-full">
                        {lightbox.label}
                      </span>
                    </div>
                  )}

                  {/* Close button */}
                  <button
                    onClick={() => setLightbox(null)}
                    className="absolute top-0 right-0 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white hover:bg-black/90 transition-colors duration-200"
                    aria-label="Close"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>

        </section>
      )}
      {/* CTA */}
      <section className="relative overflow-hidden bg-[#330962] py-14 text-center text-white px-4">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-[#330962]/20 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-300/60 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight drop-shadow-md">Plan Your Next <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-fuchsia-200 to-pink-200">Event With Us</span></h2>
          <button className="mt-5 bg-white text-[#330962] px-6 sm:px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-purple-300/50 hover:scale-105 transition-all duration-200" onClick={() => navigate("/contact")}>Contact Now</button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent pointer-events-none" />
      </section>

    </div>
  );

}

export default memo(Home);

