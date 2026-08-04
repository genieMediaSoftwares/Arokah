import { Link, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { useSiteSettings } from "../context/siteSettingsContext";
import { resolveImageUrl } from "../utils/imageUrl";

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { settings } = useSiteSettings();
  const logoUrl = resolveImageUrl(settings.logo);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Structural, not content: each entry maps to a React Router route, so these
  // stay in code rather than becoming admin-editable data that could point at a
  // page that does not exist.
  const navLinks = [
    { label: "Home", to: "/" },
    { label: "About", to: "/about" },
    { label: "Events", to: "/events" },
    { label: "Contact", to: "/contact" },
  ];

  return (
    <>
      {/* Underline animation style */}
      <style>{`
        .nav-item {
          position: relative;
          text-decoration: none !important;
        }
        .nav-item::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 50%;
          transform: translateX(-50%) scaleX(0);
          width: 70%;
          height: 2.5px;
          background: #330962;
          border-radius: 9999px;
          transition: transform 0.25s ease;
          transform-origin: center;
        }
        .nav-item:hover::after,
        .nav-item.active::after {
          transform: translateX(-50%) scaleX(1);
        }
        .mobile-nav-item {
          text-decoration: none !important;
        }
      `}</style>

      {/* Backdrop Overlay (mobile) */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <header
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled
            ? "bg-white/90 backdrop-blur-md"
            : "bg-white"
          }`}
      >
        {/* Inner — 90% width, logo on left corner, links on right corner */}
        <div className="w-[90%] mx-auto flex items-center justify-between h-[68px]">

          {/* ── Logo (Left Corner) ── */}
          <Link to="/" className="flex items-center gap-3 no-underline group">
            {logoUrl && (
              <img
                src={logoUrl}
                alt={settings.companyName ? `${settings.companyName} logo` : "Logo"}
                className="w-[42px] h-[42px] rounded-full object-cover border border-purple-100 transition-all duration-300 group-hover:scale-110 shadow-sm"
              />
            )}
            {settings.companyName && (
              <span className="text-[1.35rem] font-extrabold text-[#330962] tracking-tight leading-none">
                {settings.companyName}
              </span>
            )}
          </Link>

          {/* ── Desktop Nav (Right Corner) ── */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `nav-item font-semibold text-[0.95rem] px-3 py-2 rounded-lg transition-colors duration-200 hover:text-purple-600 hover:bg-purple-50 ${isActive ? "active text-purple-600 bg-purple-50" : "text-gray-600"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {/* <Link
              to="/admin"
              className="ml-2 bg-[#330962] text-white border font-bold text-sm px-5 py-2 rounded-xl no-underline   duration-200  hover:text-[#330962] hover:bg-white hover:border-[#330962] whitespace-nowrap"
            >
              Admin Login
            </Link> */}
          </nav>

          {/* ── Hamburger (Mobile Only) ── */}
          <button
            className="md:hidden flex flex-col justify-center gap-[5px] p-1.5 rounded-lg bg-transparent border-none cursor-pointer hover:bg-purple-50 transition-colors duration-200"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span className={`block w-6 h-[2.5px] bg-purple-600 rounded-sm transition-all duration-300 origin-center ${menuOpen ? "translate-y-[7.5px] rotate-45" : ""}`} />
            <span className={`block w-6 h-[2.5px] bg-purple-600 rounded-sm transition-all duration-300 ${menuOpen ? "opacity-0 scale-x-0" : ""}`} />
            <span className={`block w-6 h-[2.5px] bg-purple-600 rounded-sm transition-all duration-300 origin-center ${menuOpen ? "-translate-y-[7.5px] -rotate-45" : ""}`} />
          </button>
        </div>

        {/* ── Mobile Dropdown Menu ── */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 bg-white border-t border-purple-50 ${menuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
        >
          <div className="w-[90%] mx-auto flex flex-col gap-1 py-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `mobile-nav-item font-semibold text-base px-3 py-2.5 rounded-xl transition-colors duration-200 hover:text-purple-600 hover:bg-purple-50 ${isActive ? "active text-purple-600 bg-purple-50" : "text-gray-600"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {/* <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className="mt-2 bg-[#330962] text-white font-bold text-base px-5 py-2.5 rounded-xl no-underline text-center shadow-[0_3px_12px_rgba(147,51,234,0.3)] transition-all duration-200 "
            >
              Admin Login
            </Link> */}
          </div>
        </div>
      </header>
    </>
  );
}

export default Navbar;