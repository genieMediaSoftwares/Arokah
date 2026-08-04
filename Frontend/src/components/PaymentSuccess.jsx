import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { getBookingByReference } from "../services/paymentService";

/**
 * Booking confirmation screen.
 *
 * Reached either from the checkout flow (booking passed in router state) or
 * directly via /payment-success?ref=ARK-XXXXXX, which fetches the booking from
 * the backend so the customer can reopen their receipt later.
 */
function PaymentSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const bookingFromState = location.state?.booking || null;
  const reference = searchParams.get("ref") || bookingFromState?.reference || null;

  const [booking, setBooking] = useState(bookingFromState);
  const [loading, setLoading] = useState(!bookingFromState && Boolean(reference));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (bookingFromState) return;

    if (!reference) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;
    getBookingByReference(reference)
      .then((data) => {
        if (cancelled) return;
        setBooking(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "We could not find that booking.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reference, bookingFromState, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-700 mx-auto" />
          <p className="mt-4 text-slate-600">Loading your booking…</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 pt-20">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold text-slate-800">Booking not found</h1>
          <p className="text-slate-500 mt-2 text-sm">{error || "Please check your reference number."}</p>
          <button
            onClick={() => navigate("/")}
            className="mt-6 bg-[#330962] text-white font-semibold px-6 py-3 rounded-xl"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const currency = booking.currency || "INR";

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">

        <div className="bg-[#330962] px-6 py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-white font-black text-2xl">Booking Confirmed</h1>
          <p className="text-violet-200 text-sm mt-1">{booking.eventTitle}</p>
        </div>

        <div className="px-6 py-6 space-y-3">
          <Row label="Reference" value={booking.reference} strong />
          <Row label="Tickets" value={booking.quantity} />
          {booking.extras?.length > 0 && (
            <Row label="Add-ons" value={booking.extras.map((extra) => extra.name).join(", ")} />
          )}
          <Row
            label="Amount paid"
            value={`${currency} ${Number(booking.totalAmount || 0).toLocaleString("en-IN")}`}
            strong
          />
          {booking.payment?.razorpayPaymentId && (
            <Row label="Payment ID" value={booking.payment.razorpayPaymentId} />
          )}
          {booking.customer?.email && <Row label="Receipt sent to" value={booking.customer.email} />}
        </div>

        <div className="px-6 pb-6">
          <p className="text-xs text-slate-400 text-center mb-4">
            Save your reference number — it is your proof of booking.
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-[#330962] hover:bg-white hover:text-[#330962] border border-[#330962] text-white font-bold py-3 rounded-xl transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong = false }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-slate-100 last:border-0">
      <span className="text-slate-400 text-xs uppercase tracking-widest whitespace-nowrap">{label}</span>
      <span className={`text-right text-sm ${strong ? "font-black text-slate-900" : "font-semibold text-slate-700"}`}>
        {value}
      </span>
    </div>
  );
}

export default PaymentSuccess;
