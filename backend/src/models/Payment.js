'use strict';

const mongoose = require('mongoose');

const PAYMENT_STATUSES = ['created', 'authorized', 'paid', 'failed', 'refunded', 'partially_refunded'];

const refundSchema = new mongoose.Schema(
  {
    razorpayRefundId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 }, // major units (₹)
    reason: { type: String, trim: true, default: '' },
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    provider: { type: String, default: 'razorpay' },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    // Set only once Razorpay reports a captured payment.
    razorpayPaymentId: { type: String, index: true, sparse: true },
    // The HMAC returned by Checkout. Stored for audit; verification happens in
    // paymentService before anything is marked paid.
    razorpaySignature: { type: String, select: false },

    // Stored in major units (rupees) to match what the UI shows; the Razorpay
    // API is fed paise by the service layer.
    amount: { type: Number, required: true, min: 0 },
    amountRefunded: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'created', index: true },
    method: { type: String, trim: true, default: '' }, // card / upi / netbanking…

    receiptNumber: { type: String, index: true },
    failureReason: { type: String, trim: true, default: '' },
    refunds: { type: [refundSchema], default: [] },

    // Raw provider payload, useful for reconciliation. Never returned by the API.
    providerResponse: { type: mongoose.Schema.Types.Mixed, select: false },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index({ createdAt: -1 });

paymentSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.razorpaySignature;
    delete ret.providerResponse;
    return ret;
  },
});

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
