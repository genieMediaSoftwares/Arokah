import { useState } from "react";
import { toast } from "react-toastify";
import { submitEnquiry } from "../services/contactService";
import { useSiteSettings } from "../context/siteSettingsContext";
import { buildWhatsappLink } from "../services/siteSettingsService";
import logger from "../utils/logger";

function Contact() {

  const { settings } = useSiteSettings();
  const { contact } = settings;
  const whatsappLink = buildWhatsappLink(contact);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventName, setEventName] = useState("");
  const [members, setMembers] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sendBooking = async (e) => {
    e.preventDefault();

    if (!name || !phone || !eventName) {
      toast.error("Please fill required fields");
      return;
    }

    setLoading(true);

    try {

      // The backend stores the enquiry, notifies the admin, and emails the
      // customer a confirmation. No mail credentials exist in the browser.
      await submitEnquiry({ name, phone, email, eventName, members, message });

      toast.success("Booking request sent successfully!");

      // Reset form
      setName("");
      setPhone("");
      setEmail("");
      setEventName("");
      setMembers("");
      setMessage("");

    } catch (error) {
      logger.error("Contact enquiry failed", error);
      if (error?.fieldErrors?.length) {
        toast.error(error.fieldErrors[0].message);
      } else {
        toast.error(error?.message || "Something went wrong. Try again.");
      }
    }

    setLoading(false);
  };

  return (
    <div className="bg-slate-50 min-h-screen pt-16">

      {/* HERO */}
      <section className="relative overflow-hidden bg-[#330962] text-white py-16 text-center px-4">
        <div className="absolute -top-16 -left-16 w-72 h-72 rounded-full bg-purple-400/20 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-72 h-72 rounded-full bg-fuchsia-500/20 blur-[80px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)`, backgroundSize: "36px 36px" }} />
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-300/60 to-transparent pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 drop-shadow-md tracking-tight">Contact Us <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-fuchsia-200 to-pink-200"> Book Your Event</span></h1>
          <p className="max-w-3xl mx-auto text-sm sm:text-base md:text-lg text-purple-100/90 leading-relaxed">  Planning a wedding, DJ night, birthday party, or corporate event?
            Share your details and our team will contact you.</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent pointer-events-none" />
      </section>

      {/* CONTACT INFO — sourced from site settings, editable in the admin panel */}
      {(contact.phone || whatsappLink || contact.email) && (
        <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 px-6 mt-10 text-center ">

          {contact.phone && (
            <div className="group bg-white p-6 rounded-lg shadow  hover:bg-[#330962] transition duration-300">
              <h3 className="font-bold text-lg text-[#330962] mb-2
                     group-hover:text-white">
                Call Us
              </h3>
              <a href={`tel:${contact.phone.replace(/\s/g, "")}`}
                className="text-gray-600 group-hover:text-white">
                {contact.phone}
              </a>
            </div>
          )}

          {whatsappLink && (
            <div className="group bg-white p-6 rounded-lg shadow hover:bg-[#330962]">
              <h3 className="font-bold text-lg text-[#330962] mb-2 group-hover:text-white">WhatsApp</h3>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-600 group-hover:text-white"
              >
                Chat instantly
              </a>
            </div>
          )}

          {contact.email && (
            <div className="group bg-white p-6 rounded-lg shadow hover:bg-[#330962]">
              <h3 className="font-bold text-lg text-[#330962] mb-2 group-hover:text-white">Email</h3>
              <a href={`mailto:${contact.email}`} className="text-gray-600 group-hover:text-white">
                {contact.email}
              </a>
            </div>
          )}

        </section>
      )}

      {/* BOOKING FORM */}
      <div className="max-w-xl mx-auto p-6 mt-10 bg-white rounded-lg shadow">

        <h2 className="text-2xl font-bold text-[#330962] mb-6 text-center">
          Event Booking Form
        </h2>

        <form onSubmit={sendBooking} className="flex flex-col gap-4">

          <input
            value={name}
            placeholder="Your Name *"
            className="border p-3 rounded-md"
            onChange={(e) => setName(e.target.value)}
          />

          <input
            value={phone}
            placeholder="Phone Number *"
            className="border p-3 rounded-md"
            onChange={(e) => setPhone(e.target.value)}
          />

          <input
            value={email}
            placeholder="Email Address"
            className="border p-3 rounded-md"
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            value={eventName}
            placeholder="Event Interested (Wedding / DJ Night / Concert) *"
            className="border p-3 rounded-md"
            onChange={(e) => setEventName(e.target.value)}
          />

          <input
            value={members}
            placeholder="Number of Members"
            className="border p-3 rounded-md"
            onChange={(e) => setMembers(e.target.value)}
          />

          <textarea
            value={message}
            placeholder="Additional Message"
            className="border p-3 rounded-md"
            onChange={(e) => setMessage(e.target.value)}
          />

          <button
            disabled={loading}
            className="bg-[#330962] text-white py-3 rounded-md border border-transparent
           hover:bg-white hover:text-[#330962] hover:border-[#330962]
           transition-all duration-300"          >
            {loading ? "Sending..." : "Send Booking Request"}
          </button>

        </form>
      </div>

      {/* CTA */}
      <section className="text-center py-14">
        <h2 className="text-2xl font-bold text-[#330962] mb-3">
          Need Help Planning?
        </h2>

        <p className="text-gray-600 mb-6">
          Our team will assist you in organizing the perfect event.
        </p>

        <a
          href="/events"
          className="bg-[#330962] text-white px-6 py-3 rounded-full border border-transparent font-semibold hover:bg-white hover:border-[#330962] hover:text-[#330962] transition"
        >
          View Events
        </a>
      </section>

    </div>
  );
}

export default Contact;