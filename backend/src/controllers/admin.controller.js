'use strict';

const userRepository = require('../repositories/user.repository');
const contactMessageRepository = require('../repositories/contactMessage.repository');
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
    contactMessageRepository.count({ status: 'new' }),
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
      recentBookings: recentBookings.map(({ _id, id, ...rest }) => ({ id: String(_id || id), ...rest })),
    },
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role } = req.validated?.query || {};
  const result = await userRepository.list({ role, page, limit });

  return sendSuccess(res, {
    message: 'Users fetched',
    data: { users: result.users },
    meta: buildPaginationMeta({ page: result.page, limit: result.limit, total: result.total }),
  });
});

const setUserActive = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const targetId = req.params.id;

  if (String(req.user._id || req.user.id) === String(targetId) && isActive === false) {
    throw ApiError.badRequest('You cannot deactivate your own account');
  }

  const userRow = await userRepository.update(targetId, { isActive });
  if (!userRow) throw ApiError.notFound('User not found');
  const user = userRepository.toApi(userRow);

  activityLog.record({
    req,
    action: isActive ? 'user.activated' : 'user.deactivated',
    entityType: 'User',
    entityId: user.id,
  });

  return sendSuccess(res, { message: `User ${isActive ? 'activated' : 'deactivated'}`, data: { user } });
});

const listActivity = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.validated?.query || {};
  const logs = await activityLog.list({ skip: (page - 1) * limit, limit });
  return sendSuccess(res, { message: 'Activity log', data: { logs } });
});

module.exports = { getDashboard, listUsers, setUserActive, listActivity };
