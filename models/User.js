/**
 * models/User.js
 * Kullanıcı modeli
 */
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  surname: { type: String },
  birthdate: { type: Date },
  email: { type: String },
  phone: { type: String },

  // Email verification fields
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },

  // Enhanced profile fields
  bio: { type: String, default: '' },  // User biography/status
  status: { type: String, enum: ['online', 'idle', 'dnd', 'invisible'], default: 'online' },
  customStatus: { type: String, default: '' },  // Custom status message
  profilePicture: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAttachment' },  // Profile picture
  lastSeen: { type: Date },  // Last time user was online

  // Two-factor authentication fields
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  backupCodes: [{ type: String }],

  // Push notification subscription
  pushSubscription: { type: Object },

  // User preferences
  preferences: {
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    notifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    soundEffects: { type: Boolean, default: true },
    language: { type: String, default: 'tr' },
    notificationTypes: {
      directMessages: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      friendRequests: { type: Boolean, default: true },
      groupInvites: { type: Boolean, default: true },
      channelMessages: { type: Boolean, default: false }
    }
  },

  // Bu kullanıcının üyesi olduğu Gruplar (MongoDB ObjectId listesi)
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  // Arkadaşlar listesi (kalıcı olarak DB'de saklanacak)
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Engellenen arkadaşlar listesi
  blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // Favoriler listesi
  favorites: [
    {
      type: { type: String, enum: ['channel', 'user'], required: true },
      itemId: { type: String, required: true },  // Kanal ID veya kullanıcı ID
      name: { type: String, required: true },    // Kanal adı veya kullanıcı adı
      groupId: { type: String },                // Sadece kanal favorileri için
      addedAt: { type: Date, default: Date.now }
    }
  ]
});

// İndeksler
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ lastSeen: -1 });
userSchema.index({ 'friends': 1 });
userSchema.index({ 'blocked': 1 });
userSchema.index({ 'groups': 1 });
userSchema.index({ 'favorites.itemId': 1 });
userSchema.index({ 'favorites.type': 1 });
userSchema.index({ username: 'text', name: 'text', surname: 'text' });

// Kullanıcı modelini oluştur
const User = mongoose.model('User', userSchema);

module.exports = User;
