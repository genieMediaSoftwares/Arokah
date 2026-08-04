'use strict';

const crypto = require('crypto');
const Event = require('../models/Event');
const eventRepository = require('../repositories/event.repository');
const imageCleanup = require('./imageCleanup.service');
const ApiError = require('../utils/ApiError');

const PUBLIC_STATUSES = ['upcoming', 'live'];

/**
 * Normalises the extras array coming from the admin forms. The React UI keys
 * each row with `Date.now()`, so we accept whatever it sends and fall back to a
 * generated key — the key only has to be stable within one event.
 */
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
    // Public listings never expose cancelled or completed events.
    filter.status = { $in: PUBLIC_STATUSES };
  }

  if (search) {
    // Escaped so a user-supplied "(" cannot blow up the regex compiler.
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ title: rx }, { type: rx }, { location: rx }];
  }

  return filter;
}

async function listEvents({ status, search, page = 1, limit = 50, includeAll = false } = {}) {
  const filter = buildListFilter({ status, search, includeAll });
  const skip = (page - 1) * limit;

  const [events, total] = await Promise.all([
    eventRepository.findAllByStatusPriority({
      filter,
      // Live first, then upcoming, everything else last, newest-first within
      // each group — the ordering Services.jsx used to compute client-side.
      priority: { live: 0, upcoming: 1 },
      fallbackRank: 2,
      skip,
      limit,
    }),
    eventRepository.count(filter),
  ]);

  return { events: events.map(withId), total, page, limit };
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

  // Snapshot the images before mutating so replaced files can be reclaimed.
  const before = existing.toObject();

  Object.assign(existing, payload);
  if (payload.extras !== undefined) existing.extras = normalizeExtras(payload.extras);
  existing.updatedBy = actorId;

  await existing.save();

  // After the save, so a failed write never deletes a file that is still in use.
  await imageCleanup.removeOrphans(before, existing.toObject(), { ignoreEventId: existing._id });

  return existing.toJSON();
}

async function deleteEvent(id) {
  const existing = await eventRepository.findByIdOrLegacyId(id);
  if (!existing) throw ApiError.notFound('Event not found');

  const snapshot = existing.toObject();
  await existing.deleteOne();
  await imageCleanup.removeAllFor(snapshot, { ignoreEventId: existing._id });

  return { id: String(existing._id), title: existing.title };
}

function getStats() {
  return eventRepository.statusCounts();
}

/** `.lean()` skips the schema's toJSON transform, so add `id` back here. */
function withId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

module.exports = {
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  getStats,
  normalizeExtras,
  parsePrice: Event.parsePrice,
};
