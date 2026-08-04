'use strict';

const mongoose = require('mongoose');

const CONTACT_STATUSES = ['new', 'in_progress', 'closed'];

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    email: { type: String, trim: true, lowercase: true, default: '' },
    eventName: { type: String, required: true, trim: true, maxlength: 200 },
    members: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '', maxlength: 5000 },

    status: { type: String, enum: CONTACT_STATUSES, default: 'new', index: true },
    // Whether the notification/confirmation emails went out. A mail failure must
    // not lose the enquiry, so the record is saved first and flagged after.
    adminNotified: { type: Boolean, default: false },
    customerNotified: { type: Boolean, default: false },

    // Request metadata, kept for abuse investigation only.
    ipAddress: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true }
);

contactMessageSchema.index({ createdAt: -1 });

contactMessageSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = String(ret._id);
    delete ret._id;
    delete ret.ipAddress;
    delete ret.userAgent;
    return ret;
  },
});

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
module.exports.CONTACT_STATUSES = CONTACT_STATUSES;
