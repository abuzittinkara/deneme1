// models/ScheduledMessage.js
const mongoose = require('mongoose');

const ScheduledMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel' },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: { type: String, required: true },
  scheduledTime: { type: Date, required: true },
  type: { type: String, enum: ['channel', 'dm'], required: true },
  isSent: { type: Boolean, default: false },
  sentAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScheduledMessage', ScheduledMessageSchema);
