import api, { unwrap } from "./api";

/**
 * Razorpay checkout, driven end-to-end by our backend.
 *
 * The browser never computes or sends an amount. It says "this event, this many
 * tickets, these add-ons" and the server prices the order, creates the Razorpay
 * order, and verifies the signature afterwards. The Razorpay key secret never
 * leaves the server.
 */

/** Server-authoritative price preview. */
export async function getQuote({ eventId, quantity, extraKeys }) {
  const response = await api.post("/payments/quote", { eventId, quantity, extraKeys });
  return unwrap(response);
}

/** Creates a pending booking and its Razorpay order. */
export async function createOrder({ eventId, quantity, extraKeys, customer }) {
  const response = await api.post("/payments/orders", { eventId, quantity, extraKeys, customer });
  return unwrap(response);
}

/** Hands the checkout response back for server-side signature verification. */
export async function verifyPayment(razorpayResponse) {
  const response = await api.post("/payments/verify", {
    razorpay_order_id: razorpayResponse.razorpay_order_id,
    razorpay_payment_id: razorpayResponse.razorpay_payment_id,
    razorpay_signature: razorpayResponse.razorpay_signature,
  });
  return unwrap(response);
}

/** Best-effort notice that the customer closed the checkout window. */
export async function abandonOrder(orderId) {
  try {
    await api.post("/payments/abandon", { razorpay_order_id: orderId });
  } catch {
    // Purely informational — the backend also learns this from the webhook.
  }
}

export async function getBookingByReference(reference) {
  const response = await api.get(`/payments/bookings/reference/${reference}`);
  return unwrap(response)?.booking ?? null;
}

export async function listBookings({ status, search, page, limit } = {}) {
  const response = await api.get("/payments/bookings", { params: { status, search, page, limit } });
  return { bookings: unwrap(response)?.bookings ?? [], meta: response?.data?.meta ?? null };
}

/**
 * Runs the whole booking flow.
 *
 * Returns { status: "confirmed" | "cancelled", booking? } so the caller can
 * react without knowing anything about Razorpay's callback shape.
 */
export function startCheckout({ eventId, quantity, extraKeys, customer, event, onStatusChange }) {
  return new Promise((resolve, reject) => {
    (async () => {
      let order;
      try {
        order = await createOrder({ eventId, quantity, extraKeys, customer });
      } catch (err) {
        reject(err);
        return;
      }

      // A free booking is confirmed server-side; there is nothing to pay for.
      if (order.free) {
        resolve({ status: "confirmed", booking: order.booking, free: true });
        return;
      }

      if (!window.Razorpay) {
        reject(new Error("Payment gateway failed to load. Please refresh and try again."));
        return;
      }

      let settled = false;

      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: "Event Booking",
        description: order.eventTitle || event?.title,
        image: order.eventImage || event?.mainImage,
        prefill: order.prefill,
        notes: { bookingReference: order.bookingReference },
        theme: { color: "#330962" },

        handler: async (response) => {
          settled = true;
          onStatusChange?.("verifying");
          try {
            // A booking counts as confirmed only once the backend has checked
            // the signature — never on the strength of this callback alone.
            const result = await verifyPayment(response);
            resolve({ status: "confirmed", booking: result.booking, payment: result.payment });
          } catch (err) {
            reject(err);
          }
        },

        modal: {
          ondismiss: () => {
            if (settled) return;
            settled = true;
            abandonOrder(order.orderId);
            resolve({ status: "cancelled" });
          },
        },
      });

      checkout.on("payment.failed", (response) => {
        if (settled) return;
        settled = true;
        abandonOrder(order.orderId);
        reject(new Error(response?.error?.description || "Payment failed. Please try again."));
      });

      onStatusChange?.("open");
      checkout.open();
    })();
  });
}
