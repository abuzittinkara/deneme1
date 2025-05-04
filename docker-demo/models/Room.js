// models/Room.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const RoomSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  description: {
    type: String,
    trim: true,
    maxlength: 200,
    default: ''
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  moderators: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  members: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  isPrivate: {
    type: Boolean,
    default: false
  },
  password: {
    type: String,
    default: null
  },
  maxUsers: {
    type: Number,
    default: 50,
    min: 2,
    max: 100
  },
  channels: [{
    type: Schema.Types.ObjectId,
    ref: 'Channel'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Oda oluşturulduğunda otomatik olarak bir Genel kanal oluştur
RoomSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      const Channel = mongoose.model('Channel');
      const generalChannel = new Channel({
        name: 'Genel',
        description: 'Genel sohbet kanalı',
        room: this._id,
        type: 'text'
      });
      
      const voiceChannel = new Channel({
        name: 'Sesli Sohbet',
        description: 'Sesli iletişim kanalı',
        room: this._id,
        type: 'voice'
      });
      
      await generalChannel.save();
      await voiceChannel.save();
      
      this.channels.push(generalChannel._id);
      this.channels.push(voiceChannel._id);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

// Oda silindiğinde ilişkili kanalları da sil
RoomSchema.pre('remove', async function(next) {
  try {
    const Channel = mongoose.model('Channel');
    await Channel.deleteMany({ room: this._id });
  } catch (error) {
    return next(error);
  }
  next();
});

// Kullanıcının odaya katılma izni var mı?
RoomSchema.methods.canJoin = function(userId) {
  // Oda sahibi her zaman katılabilir
  if (this.owner.toString() === userId.toString()) {
    return true;
  }
  
  // Moderatörler her zaman katılabilir
  if (this.moderators.some(modId => modId.toString() === userId.toString())) {
    return true;
  }
  
  // Özel oda ise, kullanıcı üye olmalı
  if (this.isPrivate) {
    return this.members.some(memberId => memberId.toString() === userId.toString());
  }
  
  // Herkese açık oda
  return true;
};

// Kullanıcının odayı düzenleme izni var mı?
RoomSchema.methods.canEdit = function(userId) {
  // Oda sahibi her zaman düzenleyebilir
  if (this.owner.toString() === userId.toString()) {
    return true;
  }
  
  // Moderatörler düzenleyebilir
  return this.moderators.some(modId => modId.toString() === userId.toString());
};

// Kullanıcının odayı silme izni var mı?
RoomSchema.methods.canDelete = function(userId) {
  // Sadece oda sahibi silebilir
  return this.owner.toString() === userId.toString();
};

// Kullanıcıyı odaya ekle
RoomSchema.methods.addMember = function(userId) {
  if (!this.members.some(memberId => memberId.toString() === userId.toString())) {
    this.members.push(userId);
  }
  return this.save();
};

// Kullanıcıyı odadan çıkar
RoomSchema.methods.removeMember = function(userId) {
  this.members = this.members.filter(memberId => memberId.toString() !== userId.toString());
  this.moderators = this.moderators.filter(modId => modId.toString() !== userId.toString());
  return this.save();
};

// Kullanıcıyı moderatör yap
RoomSchema.methods.addModerator = function(userId) {
  // Önce üye olarak ekle
  if (!this.members.some(memberId => memberId.toString() === userId.toString())) {
    this.members.push(userId);
  }
  
  // Sonra moderatör olarak ekle
  if (!this.moderators.some(modId => modId.toString() === userId.toString())) {
    this.moderators.push(userId);
  }
  
  return this.save();
};

// Kullanıcının moderatörlüğünü kaldır
RoomSchema.methods.removeModerator = function(userId) {
  this.moderators = this.moderators.filter(modId => modId.toString() !== userId.toString());
  return this.save();
};

const Room = mongoose.model('Room', RoomSchema);

module.exports = Room;
