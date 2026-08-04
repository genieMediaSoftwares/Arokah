'use strict';

const Booking = require('../models/Booking');

const bookingRepository = {
  create(payload) {
    return Booking.create(payload);
  },

  findById(id) {
    return Booking.findById(id);
  },

  findByReference(reference) {
    return Booking.findOne({ reference });
  },

  findAll({ filter = {}, sort = { createdAt: -1 }, skip = 0, limit = 20 } = {}) {
    return Booking.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('event', 'title mainImage eventDate status')
      .populate('payment', 'razorpayPaymentId razorpayOrderId status method amount receiptNumber paidAt')
      .lean({ virtuals: true });
  },

  count(filter = {}) {
    return Booking.countDocuments(filter);
  },

  /** Revenue + volume rollup for the admin dashboard. */
  async revenueSummary() {
    const [row] = await Booking.aggregate([
      { $match: { status: 'confirmed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalTickets: { $sum: '$quantity' },
          bookings: { $sum: 1 },
        },
      },
    ]);
    return row || { totalRevenue: 0, totalTickets: 0, bookings: 0 };
  },
};

module.exports = bookingRepository;
