/**
 * models/Message.js
 * Mesaj modeli
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const messageSchema = new Schema({
  channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  // Fields for edited messages
  isEdited: { type: Boolean, default: false },
  editedAt: { type: Date },
  originalContent: { type: String },
  // Field for deleted messages
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date },
  // References to file attachments
  attachments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FileAttachment' }],
  // Message reactions
  reactions: {
    type: Map,
    of: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    default: new Map()
  },
  // Is this message pinned?
  isPinned: { type: Boolean, default: false },
  pinnedAt: { type: Date },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Reference to the message this message is quoting
  quotedMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }
});

// İndeksler
messageSchema.index({ channel: 1, timestamp: -1 });
messageSchema.index({ user: 1, timestamp: -1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ content: 'text' });
messageSchema.index({ isPinned: 1 });
messageSchema.index({ quotedMessage: 1 });
messageSchema.index({ deletedAt: 1 }, {
  expireAfterSeconds: 30 * 24 * 60 * 60, // 30 gün sonra otomatik sil
  partialFilterExpression: { isDeleted: true }
});

// Mesaj modelini oluştur
const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
