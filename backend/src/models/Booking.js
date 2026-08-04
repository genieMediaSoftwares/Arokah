'use strict';

const mongoose = require('mongoose');

const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'refunded', 'failed'];

const bookedExtraSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, trim: true, default: '' },
    category: { type: String, trim: true, default: 'other' },
    // Unit price at the moment of booking — an event's price may change later,
    // so the amount charged is frozen into the booking record.
    unitPrice: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    // Short human-facing reference shown on receipts, e.g. ARK-7K3P2Q.
    reference: { type: String, required: true, unique: true, index: true },

    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    eventTitle: { type: String, required: true, trim: true }, // denormalised for receipts
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },

    customer: {
      name: { type: String, trim: true, default: '' },
      email: { type: String, trim: true, lowercase: true, default: '' },
      phone: { type: String, trim: true, default: '' },
    },

    quantity: { type: Number, required: true, min: 1, max: 50 },
    basePrice: { type: Number, required: true, min: 0 },
    extras: { type: [bookedExtraSchema], default: [] },
    extrasPrice: { type: Number, default: 0, min: 0 },
    pricePerTicket: { type: Number, required: true, min: 0 },
    // Authoritative total, always recomputed on the server from event data.
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },

    status: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
    paymentMethod: { type: String, enum: ['razorpay', 'free'], default: 'razorpay' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    confirmedAt: { type: Date },
    cancelledAt: { type: Date },

    notes: { type: String, trim: true, default: '' },
    legacyId: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ 'customer.email': 1, createdAt: -1 });

bookingSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Booking', bookingSchema);
module.exports.BOOKING_STATUSES = BOOKING_STATUSES;
