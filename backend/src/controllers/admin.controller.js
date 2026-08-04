'use strict';

const User = require('../models/User');
const ContactMessage = require('../models/ContactMessage');
const eventService = require('../services/event.service');
const bookingRepository = require('../repositories/booking.repository');
const activityLog = require('../services/activityLog.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { sendSuccess, buildPaginationMeta } = require('../utils/apiResponse');

/** Everything the admin dashboard needs, in one round trip. */
const getDashboard = asyncHandler(async (_req, res) => {
  const [eventStats, revenue, pendingEnquiries, recentBookings] = await Promise.all([
    eventService.getStats(),
    bookingRepository.revenueSummary(),
    ContactMessage.countDocuments({ status: 'new' }),
    bookingRepository.findAll({ limit: 5 }),
  ]);

  return sendSuccess(res, {
    message: 'Dashboard data',
    data: {
      events: eventStats,
      revenue: {
        totalRevenue: revenue.totalRevenue,
        totalTickets: revenue.totalTickets,
        confirmedBookings: revenue.bookings,
      },
      pendingEnquiries,
      recentBookings: recentBookings.map(({ _id, ...rest }) => ({ id: String(_id), ...rest })),
    },
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role } = req.validated?.query || {};
  const filter = {};
  if (role && role !== 'all') filter.role = role;

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return sendSuccess(res, {
    message: 'Users fetched',
    data: { users: users.map((user) => user.toJSON()) },
    meta: buildPaginationMeta({ page, limit, total }),
  });
});

const setUserActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  // Without this, an admin could lock themselves out of their own dashboard.
  if (String(req.user._id) === String(req.params.id) && isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const user = await User.findByIdAndUpdate(req.params.id, { $set: { isActive } }, { new: true });
  if (!user) throw ApiError.notFound('User not found');

  activityLog.record({
    req,
    action: isActive ? 'user.activated' : 'user.deactivated',
    entityType: 'User',
    entityId: user.id,
  });

  return sendSuccess(res, { message: `User ${isActive ? 'activated' : 'deactivated'}`, data: { user: user.toJSON() } });
});

const listActivity = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.validated?.query || {};
  const logs = await activityLog.list({ skip: (page - 1) * limit, limit });
  return sendSuccess(res, { message: 'Activity log', data: { logs } });
});

module.exports = { getDashboard, listUsers, setUserActive, listActivity };
