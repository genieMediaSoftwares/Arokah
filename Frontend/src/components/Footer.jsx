import React from "react";
import { FaWhatsapp, FaLinkedin, FaInstagram } from "react-icons/fa";

const Footer = () => {
  const phoneNumber = "918978465963";
  const message = encodeURIComponent(
    "Hello Arokah! 👋\n\nThese events are available?\nWhich event do you want?\nPlease contact us."
  );
  const whatsappLink = `https://wa.me/${phoneNumber}?text=${message}`;

  return (
    <footer className="bg-white border-t mt-8">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-10">

        {/* Grid — 2 cols on mobile, 4 cols on lg */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">

          {/* Brand — spans full width on mobile */}
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/arokah-logo.png"
                alt="Arokah Logo"
                className="w-10 h-10 rounded-full object-cover border border-purple-100 shadow-sm"
              />
              <h3 className="text-base sm:text-xl font-bold text-[#330962]">
                Arokah
              </h3>
            </div>
            <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">
              Concerts, bhajans, weddings, corporate events & more.
            </p>
            <div className="flex gap-3 mt-1">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                className="text-green-600 text-lg hover:scale-110 transition">
                <FaWhatsapp />
              </a>
              <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer"
                className="text-blue-700 text-lg hover:scale-110 transition">
                <FaLinkedin />
              </a>
              <a href="https://www.instagram.com/arokah.club/" target="_blank" rel="noopener noreferrer"
                className="text-pink-600 text-lg hover:scale-110 transition">
                <FaInstagram />
              </a>
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-1.5">
            <h4 className="font-semibold text-gray-800 text-xs sm:text-sm uppercase tracking-wide">
              Contact
            </h4>
            <a href="tel:+918978465963"
              className="text-gray-500 text-xs sm:text-sm hover:text-[#9333EA]">
              📞 8978465963
            </a>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
              className="text-gray-500 text-xs sm:text-sm hover:text-[#9333EA]">
              💬 WhatsApp Chat
            </a>
          </div>

          {/* Quick Links */}
          <div className="flex flex-col gap-1.5">
            <h4 className="font-semibold text-gray-800 text-xs sm:text-sm uppercase tracking-wide">
              Quick Links
            </h4>
            {["Home", "About", "Events", "Contact"].map((link) => (
              <a
                key={link}
                href={link === "Home" ? "/" : `/${link.toLowerCase()}`}
                className="text-gray-500 text-xs sm:text-sm hover:text-[#9333EA]"
              >
                {link}
              </a>
            ))}
          </div>

          {/* CTA — spans full width on mobile */}
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-2 sm:gap-3">
            <h4 className="font-semibold text-gray-800 text-xs sm:text-sm uppercase tracking-wide">
              Book an Event
            </h4>
            <p className="text-gray-500 text-xs sm:text-sm hidden sm:block">
              Talk to us instantly and plan your next event today.
            </p>
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-500 text-white text-xs sm:text-sm py-2 px-4 rounded-md text-center hover:bg-green-600 transition w-full sm:w-auto"
            >
              Chat on WhatsApp
            </a>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="border-t mt-5 sm:mt-8 pt-3 sm:pt-4 text-center">
          <p className="text-gray-400 text-xs sm:text-sm">
            © 2026 Arokah. All rights reserved.
          </p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;