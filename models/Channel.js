// models/Channel.js
const mongoose = require('mongoose');

const ChannelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  type: { type: String, enum: ['text', 'voice'], required: true },
  // Kanaldaki kullanıcılar (isteğe bağlı)
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Kanalın kategorisi
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  // Kanal açıklaması
  description: { type: String, default: '' },
  // Kanalın pozisyonu
  position: { type: Number, default: 0 },
  // Arşivlenmiş mi?
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Channel', ChannelSchema);
