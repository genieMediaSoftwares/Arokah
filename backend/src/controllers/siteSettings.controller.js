'use strict';

const siteSettingsService = require('../services/siteSettings.service');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

/** Public: every visitor needs the branding and contact details to render. */
const getSettings = asyncHandler(async (_req, res) => {
  const settings = await siteSettingsService.getSettings();
  return sendSuccess(res, { message: 'Site settings fetched', data: { settings } });
});

const saveSettings = asyncHandler(async (req, res) => {
  const settings = await siteSettingsService.saveSettings(req.body, req.user._id);
  activityLog.record({ req, action: 'site_settings.updated', entityType: 'SiteSettings', entityId: settings.id });
  return sendSuccess(res, { message: 'Site settings updated', data: { settings } });
});

module.exports = { getSettings, saveSettings };
