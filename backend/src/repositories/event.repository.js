'use strict';

const mongoose = require('mongoose');
const Event = require('../models/Event');

/**
 * All Event queries live here so the service layer never builds raw filters and
 * the query shape can change without touching business logic.
 */
const eventRepository = {
  /**
   * Accepts either a Mongo ObjectId or a legacy Firebase push key, so URLs
   * bookmarked before the migration keep resolving.
   */
  findByIdOrLegacyId(id) {
    if (mongoose.isValidObjectId(id)) {
      return Event.findById(id);
    }
    return Event.findOne({ legacyId: id });
  },

  findAll({ filter = {}, sort = { createdAt: -1 }, skip = 0, limit = 0 } = {}) {
    let query = Event.find(filter).sort(sort).skip(skip);
    if (limit > 0) query = query.limit(limit);
    return query.lean({ virtuals: true });
  },

  /**
   * Lists events ordered by a caller-supplied status ranking rather than
   * alphabetically, then newest-first within each status. This reproduces the
   * ordering the React pages used to compute client-side after reading Firebase.
   */
  findAllByStatusPriority({ filter = {}, priority = {}, fallbackRank = 99, skip = 0, limit = 0 } = {}) {
    const branches = Object.entries(priority).map(([status, rank]) => ({
      case: { $eq: ['$status', status] },
      then: rank,
    }));

    const pipeline = [
      { $match: filter },
      { $addFields: { _statusRank: { $switch: { branches, default: fallbackRank } } } },
      { $sort: { _statusRank: 1, createdAt: -1 } },
      { $skip: skip },
    ];
    if (limit > 0) pipeline.push({ $limit: limit });
    pipeline.push({ $project: { _statusRank: 0 } });

    return Event.aggregate(pipeline);
  },

  count(filter = {}) {
    return Event.countDocuments(filter);
  },

  create(payload) {
    return Event.create(payload);
  },

  findByIdAndUpdate(id, payload) {
    return Event.findByIdAndUpdate(id, payload, { new: true, runValidators: true });
  },

  deleteById(id) {
    return Event.findByIdAndDelete(id);
  },

  /** Dashboard counters in a single round trip instead of three. */
  async statusCounts() {
    const rows = await Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    return rows.reduce(
      (acc, row) => {
        acc[row._id] = row.count;
        acc.total += row.count;
        return acc;
      },
      { total: 0, live: 0, upcoming: 0, completed: 0, cancelled: 0 }
    );
  },
};

module.exports = eventRepository;
