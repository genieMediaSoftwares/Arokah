'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { bcrypt: bcryptConfig } = require('../config/jwt');

const ROLES = ['admin', 'staff', 'customer'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: { type: String, trim: true, maxlength: 20 },
    // `select: false` keeps the hash out of every query result unless a caller
    // explicitly asks for it (see authService.login).
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'customer', index: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    // Any refresh token issued before this instant is rejected. Bumped on
    // password change and on "log out of all devices".
    tokensValidFrom: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, bcryptConfig.saltRounds);
  if (!this.isNew) this.tokensValidFrom = new Date();
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Never leak the password hash or internal token bookkeeping over the API.
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.password;
    delete ret.tokensValidFrom;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
