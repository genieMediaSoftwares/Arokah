import React from "react";

function About() {
  return (
    <div className="bg-slate-50 pt-16">

      {/* HERO */}
<section className="relative overflow-hidden bg-[#330962] text-white py-16 text-center px-4">
  <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-purple-400/20 blur-[80px] pointer-events-none" />
  <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-[80px] pointer-events-none" />
  <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-300/60 to-transparent pointer-events-none" />
  <div className="relative z-10">
    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-md tracking-tight">About Our <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-fuchsia-200 to-pink-200">Event Management</span></h1>
    <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-purple-100/90 leading-relaxed">We create unforgettable experiences by planning and managing events with passion, creativity, and precision.</p>
  </div>
  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent pointer-events-none" />
</section>

      {/* ABOUT INTRO */}
      <section className="max-w-6xl mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-10 items-center">

          {/* TEXT */}
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#330962] mb-4">
              Who We Are
            </h2>
            <p className="text-gray-700 mb-4 leading-relaxed">
              We are a professional event management team dedicated to
              organizing weddings, concerts, DJ nights, corporate events,
              birthday parties, and cultural celebrations. Our goal is to turn
              your ideas into reality and make every event memorable.
            </p>

            <p className="text-gray-700 leading-relaxed">
              From planning to execution, we handle every detail including
              venue setup, decoration, photography, entertainment, catering,
              and guest management.
            </p>
          </div>

          {/* IMAGE */}
          <div>
            <img
              src="https://images.unsplash.com/photo-1511795409834-ef04bbd61622"
              alt="Event management"
              className="rounded-xl shadow-lg w-full h-[300px] object-cover"
            />
          </div>

        </div>
      </section>

      {/* SERVICES */}
     <section className="bg-gray-50 py-14">
  <div className="max-w-6xl mx-auto px-4">
    <div className="text-center mb-10">
      <span className="inline-block text-xs font-semibold tracking-widest uppercase text-white bg-[#330962] border border-purple-200 px-4 py-1.5 rounded-full mb-3">Our Events</span>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">What We <span className="text-transparent bg-clip-text bg-[#330962] to-fuchsia-500">Do</span></h2>
      <div className="mt-3 mx-auto w-12 h-1 rounded-full bg-[#330962]" />
    </div>
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-5 sm:gap-6">
      {[
        { name: "Wedding Planning", icon: "💍" },
        { name: "Concert Management", icon: "🎤" },
        { name: "DJ Nights", icon: "🎧" },
        { name: "Birthday Events", icon: "🎂" },
        { name: "Corporate Events", icon: "🏢" },
        { name: "Cultural Programs", icon: "🎭" },
      ].map((service, index) => (
        <div key={index} className="group relative bg-white border border-gray-100 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-[#330962]  opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="relative z-10">
            <div className="w-12 h-12 rounded-xl bg-[#330962] border border-purple-100 flex items-center justify-center text-2xl mb-4 group-hover:bg-purple-100 transition-colors duration-300">{service.icon}</div>
            <h3 className="font-bold text-base sm:text-lg text-gray-900 mb-2 group-hover:text-white transition-colors duration-300">{service.name}</h3>
            <p className="text-sm text-[#330962] group-hover:text-white leading-relaxed">Professional planning and execution tailored to your needs.</p>
            <div className="mt-4 h-0.5 w-0 bg-white rounded-full group-hover:w-10 transition-all duration-500" />
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

      {/* WHY CHOOSE US */}
<section className="py-14 bg-white">
  <div className="max-w-6xl mx-auto px-4">
    <div className="text-center mb-10">
      <span className="inline-block text-xs font-semibold tracking-widest uppercase text-white bg-[#330962] border border-purple-200 px-4 py-1.5 rounded-full mb-3">Why Us</span>
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900">Why <span className="text-transparent bg-clip-text bg-[#330962]">Choose Us</span></h2>
      <div className="mt-3 mx-auto w-12 h-1 rounded-full bg-[#330962]" />
    </div>
    <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
      {[
        { icon: "🏆", title: "Professional Team", desc: "Experienced planners, designers, and coordinators." },
        { icon: "💡", title: "Creative Ideas", desc: "Unique themes, decorations, and event concepts." },
        { icon: "🤝", title: "Complete Support", desc: "From booking to execution, we manage everything." },
      ].map((item, i) => (
        <div key={i} className="group relative text-center bg-gray-50 border border-gray-100 rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden">
          <div className="absolute inset-0 bg-[#330962] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
          <div className="relative z-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#330962] border border-purple-100 flex items-center justify-center text-2xl mb-4 group-hover:bg-purple-100 transition-colors duration-300">{item.icon}</div>
            <h3 className="font-bold text-lg text-gray-900 mb-2 group-hover:text-white transition-colors duration-300">{item.title}</h3>
            <p className="text-sm sm:text-base text-gray-500 group-hover:text-white leading-relaxed">{item.desc}</p>
            <div className="mt-5 mx-auto h-0.5 w-0 bg-white rounded-full group-hover:w-10 transition-all duration-500" />
          </div>
        </div>
      ))}
    </div>
  </div>
</section>

      {/* CTA */}
     <section className="relative overflow-hidden bg-[#330962] text-white text-center py-14 px-4">
  <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-purple-400/20 blur-[80px] pointer-events-none" />
  <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-[80px] pointer-events-none" />
  <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-300/60 to-transparent pointer-events-none" />
  <div className="relative z-10">
    <h2 className="text-2xl sm:text-3xl font-bold mb-4 tracking-tight drop-shadow-md">Let's Plan Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-fuchsia-200 to-pink-200">Next Event</span></h2>
    <p className="mb-6 text-purple-100/90 text-sm sm:text-base">Contact us today and make your event unforgettable.</p>
    <a href="/contact" className="bg-white text-[#7c3aed] px-6 sm:px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-purple-300/50 hover:scale-105 transition-all duration-200">Contact Us</a>
  </div>
  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent pointer-events-none" />
</section>

    </div>
  );
}

export default About;
