/**
 * models/DirectMessage.js
 * Direkt mesaj modeli
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const directMessageSchema = new Schema({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipient: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  attachments: [{
    type: Schema.Types.ObjectId,
    ref: 'File'
  }],
  reactions: {
    type: Map,
    of: [Schema.Types.ObjectId]
  },
  replyTo: {
    type: Schema.Types.ObjectId,
    ref: 'DirectMessage'
  }
}, {
  timestamps: true
});

// İndeksler
directMessageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });
directMessageSchema.index({ sender: 1, timestamp: -1 });
directMessageSchema.index({ recipient: 1, timestamp: -1 });
directMessageSchema.index({ recipient: 1, isRead: 1 });
directMessageSchema.index({ isDeleted: 1 });
directMessageSchema.index({ content: 'text' });
directMessageSchema.index({ replyTo: 1 });
directMessageSchema.index({ deletedAt: 1 }, { 
  expireAfterSeconds: 30 * 24 * 60 * 60, // 30 gün sonra otomatik sil
  partialFilterExpression: { isDeleted: true } 
});

// Direkt mesaj modelini oluştur
const DirectMessage = mongoose.model('DirectMessage', directMessageSchema);

module.exports = DirectMessage;
