'use strict';

const mongoose = require('mongoose');

const EVENT_STATUSES = ['upcoming', 'live', 'completed', 'cancelled'];
const EXTRA_CATEGORIES = ['game', 'food', 'music', 'other'];

/**
 * Add-ons offered with an event (games, food stalls, DJ sets…). Stored inline
 * because they are only ever read and written as part of their parent event.
 */
const extraSchema = new mongoose.Schema(
  {
    // Preserves the client-generated key so the booking UI can keep referencing
    // a selected extra by the same id across edits.
    key: { type: String, required: true },
    category: { type: String, enum: EXTRA_CATEGORIES, default: 'other' },
    name: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    price: { type: String, trim: true, default: '' },
    imageURL: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    type: { type: String, trim: true, default: '', maxlength: 100 },
    // Kept as free text ("₹499", "Free", "500 onwards") to match the existing
    // admin UI; `priceAmount` below is the parsed number used for payments.
    price: { type: String, trim: true, default: '' },
    priceAmount: { type: Number, default: 0, min: 0 },
    phone: { type: String, trim: true, default: '', maxlength: 20 },
    location: { type: String, trim: true, default: '' },
    eventDate: { type: String, trim: true, default: '' }, // ISO date (YYYY-MM-DD)
    startTime: { type: String, trim: true, default: '' }, // 24h "HH:mm"
    endTime: { type: String, trim: true, default: '' },
    startTime12h: { type: String, trim: true, default: '' }, // display "7:30 PM"
    endTime12h: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    mainImage: { type: String, required: true, trim: true },
    extras: { type: [extraSchema], default: [] },
    status: { type: String, enum: EVENT_STATUSES, default: 'upcoming', index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Firebase Realtime Database push key, set by the migration script so old
    // /services/<pushId> links keep resolving after the cutover.
    legacyId: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

eventSchema.index({ status: 1, createdAt: -1 });
eventSchema.index({ title: 'text', type: 'text', description: 'text' });

/** Parses "₹1,499 onwards" → 1499. Returns 0 for free/blank prices. */
eventSchema.statics.parsePrice = function parsePrice(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : 0;
  const text = String(raw).trim();
  if (!text || text.toLowerCase() === 'free') return 0;
  const match = text.replace(/,/g, '').match(/\d+(\.\d+)?/);
  return match ? Math.round(Number(match[0])) : 0;
};

eventSchema.pre('validate', function syncPriceAmount(next) {
  if (this.isModified('price') || this.isNew) {
    this.priceAmount = this.constructor.parsePrice(this.price);
  }
  next();
});

eventSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    return ret;
  },
});

module.exports = mongoose.model('Event', eventSchema);
module.exports.EVENT_STATUSES = EVENT_STATUSES;
module.exports.EXTRA_CATEGORIES = EXTRA_CATEGORIES;
