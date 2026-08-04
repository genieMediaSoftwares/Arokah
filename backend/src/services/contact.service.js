'use strict';

const ContactMessage = require('../models/ContactMessage');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');

/**
 * Persists the enquiry first, then sends the two notification emails. The old
 * EmailJS flow did the reverse and kept no record at all, so a mail failure lost
 * the lead entirely — here the record always survives.
 */
async function submitEnquiry(payload, { ipAddress = '', userAgent = '' } = {}) {
  const enquiry = await ContactMessage.create({
    ...payload,
    ipAddress,
    userAgent: String(userAgent).slice(0, 300),
  });

  const [adminNotified, customerNotified] = await Promise.all([
    emailService.sendContactNotificationToAdmin(enquiry),
    emailService.sendContactConfirmationToCustomer(enquiry),
  ]);

  if (adminNotified || customerNotified) {
    enquiry.adminNotified = adminNotified;
    enquiry.customerNotified = customerNotified;
    await enquiry.save({ validateBeforeSave: false });
  }

  // The submitter only needs to know it landed; delivery details are internal.
  return { reference: String(enquiry._id), submittedAt: enquiry.createdAt };
}

async function listEnquiries({ status, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status && status !== 'all') filter.status = status;

  const skip = (page - 1) * limit;
  const [messages, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ContactMessage.countDocuments(filter),
  ]);

  return { messages: messages.map((m) => m.toJSON()), total, page, limit };
}

async function updateEnquiryStatus(id, status) {
  const message = await ContactMessage.findByIdAndUpdate(id, { $set: { status } }, { new: true });
  if (!message) throw ApiError.notFound('Enquiry not found');
  return message.toJSON();
}

module.exports = { submitEnquiry, listEnquiries, updateEnquiryStatus };
