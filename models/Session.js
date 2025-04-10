/**
 * models/Session.js
 * Oturum modeli
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  socketId: { type: String },
  userAgent: { type: String },
  ipAddress: { type: String },
  loginTime: { type: Date, default: Date.now },
  lastActivity: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  logoutTime: { type: Date },
  deviceInfo: {
    browser: { type: String },
    os: { type: String },
    device: { type: String },
    isMobile: { type: Boolean }
  },
  location: {
    country: { type: String },
    city: { type: String }
  }
});

// İndeksler
sessionSchema.index({ user: 1 });
sessionSchema.index({ socketId: 1 });
sessionSchema.index({ lastActivity: -1 });
sessionSchema.index({ isActive: 1 });
sessionSchema.index({ ipAddress: 1 });
sessionSchema.index({ user: 1, isActive: 1 });
sessionSchema.index({ logoutTime: 1 }, {
  expireAfterSeconds: 7 * 24 * 60 * 60, // 7 gün sonra otomatik sil
  partialFilterExpression: { isActive: false }
});

// Oturum modelini oluştur
const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
