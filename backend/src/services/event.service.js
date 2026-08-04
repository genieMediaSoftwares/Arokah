'use strict';

const crypto = require('crypto');
const eventRepository = require('../repositories/event.repository');
const imageCleanup = require('./imageCleanup.service');
const ApiError = require('../utils/ApiError');

const PUBLIC_STATUSES = ['upcoming', 'live'];

function parsePrice(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') return Math.max(0, Math.round(raw));
  const digits = String(raw).replace(/[^\d.]/g, '');
  if (!digits) return 0;
  const parsed = Number.parseFloat(digits);
  return Number.isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed));
}

function normalizeExtras(extras = []) {
  return extras
    .filter((extra) => extra && (extra.name || extra.imageURL))
    .map((extra) => ({
      key: String(extra.key || extra.id || crypto.randomUUID()),
      category: ['game', 'food', 'music', 'other'].includes(extra.category) ? extra.category : 'other',
      name: extra.name || '',
      description: extra.description || '',
      price: extra.price === undefined || extra.price === null ? '' : String(extra.price),
      imageURL: extra.imageURL || '',
    }));
}

function buildListFilter({ status, search, includeAll = false }) {
  const filter = {};

  if (status && status !== 'all') {
    filter.status = status;
  } else if (!includeAll) {
    filter.status = { $in: PUBLIC_STATUSES };
  }

  return filter;
}

async function listEvents({ status, search, page = 1, limit = 50, includeAll = false } = {}) {
  const filter = buildListFilter({ status, search, includeAll });
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    eventRepository.findAllByStatusPriority({
      filter,
      skip,
      limit,
    }),
    eventRepository.count(filter),
  ]);

  return { events: events.map((e) => e.toJSON()), total, page, limit };
}

async function getEvent(id, { includeAll = false } = {}) {
  const event = await eventRepository.findByIdOrLegacyId(id);
  if (!event) throw ApiError.notFound('Event not found');
  if (!includeAll && !PUBLIC_STATUSES.includes(event.status)) {
    throw ApiError.notFound('Event not found');
  }
  return event.toJSON();
}

async function createEvent(payload, actorId) {
  const event = await eventRepository.create({
    ...payload,
    extras: normalizeExtras(payload.extras),
    createdBy: actorId,
    updatedBy: actorId,
  });
  return event.toJSON();
}

async function updateEvent(id, payload, actorId) {
  const existing = await eventRepository.findByIdOrLegacyId(id);
  if (!existing) throw ApiError.notFound('Event not found');

  const before = existing.toObject();

  const updated = await eventRepository.update(existing.id, {
    ...payload,
    extras: payload.extras !== undefined ? normalizeExtras(payload.extras) : undefined,
    updatedBy: actorId,
  });

  await imageCleanup.removeOrphans(before, updated.toObject(), { ignoreEventId: existing.id });

  return updated.toJSON();
}

async function deleteEvent(id) {
  const existing = await eventRepository.findByIdOrLegacyId(id);
  if (!existing) throw ApiError.notFound('Event not found');

  const snapshot = existing.toObject();
  await eventRepository.deleteById(existing.id);
  await imageCleanup.removeAllFor(snapshot, { ignoreEventId: existing.id });

  return { id: String(existing.id), title: existing.title };
}

function getStats() {
  return eventRepository.statusCounts();
}

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getStats,
  normalizeExtras,
  parsePrice,
};
