'use strict';

const eventService = require('../services/event.service');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated, buildPaginationMeta } = require('../utils/apiResponse');

const isAdmin = (req) => Boolean(req.user && ['admin', 'staff'].includes(req.user.role));

const listEvents = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 50 } = req.validated?.query || {};

  const result = await eventService.listEvents({
    status,
    search,
    page,
    limit,
    // Only staff see cancelled/completed events in listings.
    includeAll: isAdmin(req),
  });

  return sendSuccess(res, {
    message: 'Events fetched',
    data: { events: result.events },
    meta: buildPaginationMeta({ page: result.page, limit: result.limit, total: result.total }),
  });
});

const getEvent = asyncHandler(async (req, res) => {
  const event = await eventService.getEvent(req.params.id, { includeAll: isAdmin(req) });
  return sendSuccess(res, { message: 'Event fetched', data: { event } });
});

const createEvent = asyncHandler(async (req, res) => {
  const event = await eventService.createEvent(req.body, req.user._id);
  activityLog.record({ req, action: 'event.created', entityType: 'Event', entityId: event.id, metadata: { title: event.title } });
  return sendCreated(res, { message: 'Event published', data: { event } });
});

const updateEvent = asyncHandler(async (req, res) => {
  const event = await eventService.updateEvent(req.params.id, req.body, req.user._id);
  activityLog.record({ req, action: 'event.updated', entityType: 'Event', entityId: event.id, metadata: { title: event.title } });
  return sendSuccess(res, { message: 'Event updated', data: { event } });
});

const deleteEvent = asyncHandler(async (req, res) => {
  const deleted = await eventService.deleteEvent(req.params.id);
  activityLog.record({ req, action: 'event.deleted', entityType: 'Event', entityId: deleted.id, metadata: { title: deleted.title } });
  return sendSuccess(res, { message: 'Event deleted', data: deleted });
});

const getStats = asyncHandler(async (_req, res) => {
  const stats = await eventService.getStats();
  return sendSuccess(res, { message: 'Event stats', data: { stats } });
});

module.exports = { listEvents, getEvent, createEvent, updateEvent, deleteEvent, getStats };
