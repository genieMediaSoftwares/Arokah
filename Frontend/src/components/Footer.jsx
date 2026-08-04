import { FaWhatsapp, FaLinkedin, FaInstagram, FaFacebook, FaYoutube, FaXTwitter, FaLink } from "react-icons/fa6";
import { useSiteSettings } from "../context/siteSettingsContext";
import { buildWhatsappLink } from "../services/siteSettingsService";
import { resolveImageUrl } from "../utils/imageUrl";

/** Maps a configured platform name to its icon and brand colour. */
const SOCIAL_ICONS = {
  whatsapp: { Icon: FaWhatsapp, className: "text-green-600" },
  linkedin: { Icon: FaLinkedin, className: "text-blue-700" },
  instagram: { Icon: FaInstagram, className: "text-pink-600" },
  facebook: { Icon: FaFacebook, className: "text-blue-600" },
  youtube: { Icon: FaYoutube, className: "text-red-600" },
  twitter: { Icon: FaXTwitter, className: "text-slate-800" },
  x: { Icon: FaXTwitter, className: "text-slate-800" },
};

// Structural links, deliberately kept in code: each one maps to a React Router
// route, so making them editable would let an admin point the footer at a page
// that does not exist.
const QUICK_LINKS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Events", to: "/events" },
  { label: "Contact", to: "/contact" },
];

const Footer = () => {
  const { settings } = useSiteSettings();
  const { companyName, tagline, logo, contact, socialLinks, footer } = settings;

  const whatsappLink = buildWhatsappLink(contact);
  const logoUrl = resolveImageUrl(logo);
  const year = new Date().getFullYear();

  return (
    <footer className="bg-white border-t mt-8">
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-10">

        {/* Grid — 2 cols on mobile, 4 cols on lg */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-8">

          {/* Brand — spans full width on mobile */}
          <div className="col-span-2 lg:col-span-1 flex flex-col gap-2">
            <div className="flex items-center gap-2.5">
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={companyName ? `${companyName} logo` : "Logo"}
                  className="w-10 h-10 rounded-full object-cover border border-purple-100 shadow-sm"
                />
              )}
              {companyName && (
                <h3 className="text-base sm:text-xl font-bold text-[#330962]">{companyName}</h3>
              )}
            </div>

            {(footer.description || tagline) && (
              <p className="text-gray-500 text-xs sm:text-sm leading-relaxed">
                {footer.description || tagline}
              </p>
            )}

            {socialLinks.length > 0 && (
              <div className="flex gap-3 mt-1">
                {socialLinks.map((link) => {
                  const key = String(link.platform || "").toLowerCase();
                  const { Icon, className } = SOCIAL_ICONS[key] || { Icon: FaLink, className: "text-slate-500" };
                  return (
                    <a
                      key={`${link.platform}-${link.url}`}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.platform}
                      title={link.platform}
                      className={`${className} text-lg hover:scale-110 transition`}
                    >
                      <Icon />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact */}
          {(contact.phone || whatsappLink || contact.email) && (
            <div className="flex flex-col gap-1.5">
              <h4 className="font-semibold text-gray-800 text-xs sm:text-sm uppercase tracking-wide">
                Contact
              </h4>
              {contact.phone && (
                <a
                  href={`tel:${contact.phone.replace(/\s/g, "")}`}
                  className="text-gray-500 text-xs sm:text-sm hover:text-[#9333EA]"
                >
                  📞 {contact.phone}
                </a>
              )}
              {whatsappLink && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer"
                  className="text-gray-500 text-xs sm:text-sm hover:text-[#9333EA]">
                  💬 WhatsApp Chat
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="text-gray-500 text-xs sm:text-sm hover:text-[#9333EA]">
                  ✉️ {contact.email}
                </a>
              )}
            </div>
          )}

          {/* Quick Links */}
          <div className="flex flex-col gap-1.5">
            <h4 className="font-semibold text-gray-800 text-xs sm:text-sm uppercase tracking-wide">
              Quick Links
            </h4>
            {QUICK_LINKS.map((link) => (
              <a
                key={link.to}
                href={link.to}
                className="text-gray-500 text-xs sm:text-sm hover:text-[#9333EA]"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA — spans full width on mobile */}
          {whatsappLink && (
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
          )}

        </div>

        {/* Bottom Copyright */}
        <div className="border-t mt-5 sm:mt-8 pt-3 sm:pt-4 text-center">
          <p className="text-gray-400 text-xs sm:text-sm">
            {footer.copyrightText || (companyName ? `© ${year} ${companyName}. All rights reserved.` : "")}
          </p>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
