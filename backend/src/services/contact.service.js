'use strict';

const contactMessageRepository = require('../repositories/contactMessage.repository');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');

/**
 * Persists the enquiry first, then sends the two notification emails.
 */
async function submitEnquiry(payload, { ipAddress = '', userAgent = '' } = {}) {
  const enquiry = await contactMessageRepository.create({
    ...payload,
    ipAddress,
    userAgent: String(userAgent).slice(0, 300),
  });

  const [adminNotified, customerNotified] = await Promise.all([
    emailService.sendContactNotificationToAdmin(enquiry),
    emailService.sendContactConfirmationToCustomer(enquiry),
  ]);

  if (adminNotified || customerNotified) {
    await contactMessageRepository.updateNotifications(enquiry.id, { adminNotified, customerNotified });
  }

  return { reference: String(enquiry.id), submittedAt: enquiry.createdAt };
}

async function listEnquiries({ status, page = 1, limit = 20 } = {}) {
  return contactMessageRepository.list({ status, page, limit });
}

async function updateEnquiryStatus(id, status) {
  const message = await contactMessageRepository.updateStatus(id, status);
  if (!message) throw ApiError.notFound('Enquiry not found');
  return message;
}

module.exports = { submitEnquiry, listEnquiries, updateEnquiryStatus };
