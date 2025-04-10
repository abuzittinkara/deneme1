// models/Role.js
const mongoose = require('mongoose');

const RoleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  color: { type: String, default: '#99AAB5' },
  position: { type: Number, default: 0 },
  permissions: {
    administrator: { type: Boolean, default: false },
    manageGroup: { type: Boolean, default: false },
    manageChannels: { type: Boolean, default: false },
    manageRoles: { type: Boolean, default: false },
    manageMessages: { type: Boolean, default: false },
    kickMembers: { type: Boolean, default: false },
    banMembers: { type: Boolean, default: false },
    createInvite: { type: Boolean, default: true },
    sendMessages: { type: Boolean, default: true },
    readMessages: { type: Boolean, default: true },
    attachFiles: { type: Boolean, default: true },
    connect: { type: Boolean, default: true },
    speak: { type: Boolean, default: true },
    useVoiceActivity: { type: Boolean, default: true },
    prioritySpeaker: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model('Role', RoleSchema);
