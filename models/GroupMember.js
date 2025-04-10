// models/GroupMember.js
const mongoose = require('mongoose');

const GroupMemberSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  roles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
  nickname: { type: String },
  joinedAt: { type: Date, default: Date.now }
});

// Kullanıcı başına grup için benzersiz kayıt
GroupMemberSchema.index({ user: 1, group: 1 }, { unique: true });

module.exports = mongoose.model('GroupMember', GroupMemberSchema);
