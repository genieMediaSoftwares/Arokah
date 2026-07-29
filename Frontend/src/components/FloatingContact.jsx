// import React, { useState } from "react";
// import { FaWhatsapp, FaInstagram, FaPhoneAlt, FaTimes, FaTicketAlt } from "react-icons/fa";
// import { useNavigate } from "react-router-dom";

// const FloatingContact = () => {
//   const [isOpen, setIsOpen] = useState(false);
//   const navigate = useNavigate();

//   const phoneNumber = "918978465963";
//   const whatsappMsg = encodeURIComponent(
//     "Hello Arokah! 👋\n\nI want to know more about your events."
//   );
//   const whatsappLink = `https://wa.me/${phoneNumber}?text=${whatsappMsg}`;
//   const instagramLink = "https://www.instagram.com/arokah.club/";
//   const callLink = `tel:+${phoneNumber}`;

//   const handleLiveEventsClick = () => {
//     setIsOpen(false);
//     navigate("/events");
//   };

//   return (
//     <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-3">
      
//       {/* Expanded Circular Menu Icons */}
//       <div
//         className={`flex flex-col items-center gap-3 transition-all duration-300 transform origin-bottom ${
//           isOpen
//             ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
//             : "opacity-0 scale-95 translate-y-4 pointer-events-none"
//         }`}
//       >
//         {/* Live Events Icon */}
//         <button
//           onClick={handleLiveEventsClick}
//           aria-label="Live Events"
//           className="group relative w-12 h-12 rounded-full bg-gradient-to-tr from-purple-700 to-indigo-900 text-white flex items-center justify-center shadow-lg shadow-purple-900/30 transition-all duration-200 hover:scale-110 active:scale-95 border border-white/20"
//         >
//           <FaTicketAlt className="text-lg group-hover:rotate-12 transition-transform duration-300 text-amber-300" />
//           <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
//         </button>

//         {/* Instagram Icon */}
//         <a
//           href={instagramLink}
//           target="_blank"
//           rel="noopener noreferrer"
//           onClick={() => setIsOpen(false)}
//           aria-label="Instagram"
//           className="group relative w-12 h-12 rounded-full bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/25 transition-all duration-200 hover:scale-110 active:scale-95 border border-white/20"
//         >
//           <FaInstagram className="text-xl group-hover:rotate-6 transition-transform duration-300" />
//         </a>

//         {/* Call Icon */}
//         <a
//           href={callLink}
//           onClick={() => setIsOpen(false)}
//           aria-label="Call Us"
//           className="group relative w-12 h-12 rounded-full bg-[#330962] hover:bg-purple-900 text-white flex items-center justify-center shadow-lg shadow-purple-950/30 transition-all duration-200 hover:scale-110 active:scale-95 border border-white/20"
//         >
//           <FaPhoneAlt className="text-base group-hover:rotate-12 transition-transform duration-300" />
//         </a>

//         {/* WhatsApp Direct Link Icon */}
//         <a
//           href={whatsappLink}
//           target="_blank"
//           rel="noopener noreferrer"
//           onClick={() => setIsOpen(false)}
//           aria-label="WhatsApp Chat"
//           className="group relative w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:scale-110 active:scale-95 border border-white/20"
//         >
//           <FaWhatsapp className="text-xl group-hover:scale-110 transition-transform duration-300" />
//         </a>
//       </div>

//       {/* Main Single Floating Toggle Button (WhatsApp Icon by default) */}
//       <button
//         onClick={() => setIsOpen(!isOpen)}
//         aria-label="Toggle Quick Links"
//         className={`w-14 h-14 rounded-full text-white flex items-center justify-center shadow-xl transition-all duration-300 border border-white/20 active:scale-95 ${
//           isOpen
//             ? "bg-gray-900 rotate-90 shadow-gray-900/40"
//             : "bg-emerald-500 hover:bg-emerald-600 hover:scale-105 shadow-emerald-500/35"
//         }`}
//       >
//         {isOpen ? (
//           <FaTimes className="text-xl" />
//         ) : (
//           <FaWhatsapp className="text-2xl" />
//         )}
//       </button>

//     </div>
//   );
// };

// export default FloatingContact;
