'use strict';

const contactService = require('../services/contact.service');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendCreated, sendSuccess, buildPaginationMeta } = require('../utils/apiResponse');

const submitEnquiry = asyncHandler(async (req, res) => {
  const result = await contactService.submitEnquiry(req.body, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || '',
  });
  return sendCreated(res, { message: 'Booking request sent successfully!', data: result });
});

const listEnquiries = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.validated?.query || {};
  const result = await contactService.listEnquiries({ status, page, limit });
  return sendSuccess(res, {
    message: 'Enquiries fetched',
    data: { messages: result.messages },
    meta: buildPaginationMeta({ page: result.page, limit: result.limit, total: result.total }),
  });
});

const updateEnquiryStatus = asyncHandler(async (req, res) => {
  const message = await contactService.updateEnquiryStatus(req.params.id, req.body.status);
  activityLog.record({ req, action: 'contact.status_changed', entityType: 'ContactMessage', entityId: message.id });
  return sendSuccess(res, { message: 'Enquiry updated', data: { enquiry: message } });
});

module.exports = { submitEnquiry, listEnquiries, updateEnquiryStatus };
