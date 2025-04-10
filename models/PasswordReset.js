// models/PasswordReset.js
const mongoose = require('mongoose');

const PasswordResetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  expires: { type: Date, required: true },
  used: { type: Boolean, default: false }
});

// Token 24 saat sonra otomatik silinsin
PasswordResetSchema.index({ expires: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
