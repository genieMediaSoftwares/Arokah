'use strict';

const homeContentService = require('../services/homeContent.service');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const getHomeContent = asyncHandler(async (_req, res) => {
  const content = await homeContentService.getHomeContent();
  return sendSuccess(res, { message: 'Home content fetched', data: { content } });
});

const saveHomeContent = asyncHandler(async (req, res) => {
  const content = await homeContentService.saveHomeContent(req.body, req.user._id);
  activityLog.record({ req, action: 'home_content.updated', entityType: 'HomeContent', entityId: content.id });
  return sendSuccess(res, { message: 'Home content updated', data: { content } });
});

const clearHomeContent = asyncHandler(async (req, res) => {
  const content = await homeContentService.clearHomeContent(req.user._id);
  activityLog.record({ req, action: 'home_content.cleared', entityType: 'HomeContent', entityId: content.id });
  return sendSuccess(res, { message: 'Home content cleared', data: { content } });
});

module.exports = { getHomeContent, saveHomeContent, clearHomeContent };
