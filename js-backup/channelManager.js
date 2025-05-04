/**************************************
 * modules/channelManager.js
 * Kanal yönetimi ile ilgili tüm işlevleri içerir
 **************************************/
const { v4: uuidv4 } = require('uuid');
const Group = require('../models/Group');
const Channel = require('../models/Channel');
const Message = require('../models/Message');

/**
 * Veritabanından kanalları yükler ve bellek içi groups nesnesine ekler
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<void>}
 */
async function loadChannelsFromDB(groups) {
  try {
    const channelDocs = await Channel.find({}).populate('group');
    channelDocs.forEach(channelDoc => {
      const groupId = channelDoc.group.groupId;
      if (groups[groupId]) {
        groups[groupId].rooms[channelDoc.channelId] = {
          name: channelDoc.name,
          type: channelDoc.type,
          users: []
        };
      }
    });
    console.log("loadChannelsFromDB tamamlandı");
  } catch (err) {
    console.error("loadChannelsFromDB hatası:", err);
  }
}

/**
 * Bir kullanıcıya bir gruptaki kanalların listesini gönderir
 * @param {string} socketId - Kullanıcının socket ID'si
 * @param {string} groupId - Grup ID'si
 * @param {Object} groups - Bellek içi groups nesnesi
 * @param {Object} io - Socket.IO nesnesi
 * @returns {void}
 */
function sendRoomsListToUser(socketId, groupId, groups, io) {
  if (!groups[groupId]) return;
  
  const groupObj = groups[groupId];
  const roomArray = Object.keys(groupObj.rooms).map(rId => ({
    id: rId,
    name: groupObj.rooms[rId].name,
    type: groupObj.rooms[rId].type
  }));
  
  io.to(socketId).emit('roomsList', roomArray);
}

/**
 * Bir gruptaki tüm kullanıcılara kanal listesini yayınlar
 * @param {string} groupId - Grup ID'si
 * @param {Object} groups - Bellek içi groups nesnesi
 * @param {Object} io - Socket.IO nesnesi
 * @returns {void}
 */
function broadcastRoomsListToGroup(groupId, groups, io) {
  if (!groups[groupId]) return;
  
  const groupObj = groups[groupId];
  const roomArray = Object.keys(groupObj.rooms).map(rId => ({
    id: rId,
    name: groupObj.rooms[rId].name,
    type: groupObj.rooms[rId].type
  }));
  
  io.to(groupId).emit('roomsList', roomArray);
}

/**
 * Yeni bir kanal oluşturur
 * @param {string} groupId - Grup ID'si
 * @param {string} roomName - Kanal adı
 * @param {string} roomType - Kanal tipi ('text' veya 'voice')
 * @param {string} username - İşlemi yapan kullanıcı adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<Object>} - Oluşturulan kanal bilgileri
 */
async function createChannel(groupId, roomName, roomType, username, groups) {
  if (!groups[groupId]) throw new Error("Grup bulunamadı");
  
  // Grup sahibi kontrolü
  if (groups[groupId].owner !== username) {
    throw new Error("Bu grupta kanal oluşturma yetkiniz yok");
  }
  
  const trimmedName = roomName.trim();
  if (!trimmedName) throw new Error("Kanal adı boş olamaz");
  
  // Geçerli kanal tipi kontrolü
  if (roomType !== 'text' && roomType !== 'voice') {
    throw new Error("Geçersiz kanal tipi");
  }
  
  // Grubu veritabanından bul
  const groupDoc = await Group.findOne({ groupId });
  if (!groupDoc) throw new Error("Grup veritabanında bulunamadı");
  
  // Yeni kanal oluştur
  const channelId = uuidv4();
  const newChannel = new Channel({
    channelId,
    name: trimmedName,
    group: groupDoc._id,
    type: roomType
  });
  
  await newChannel.save();
  
  // Bellek içi gruba kanalı ekle
  groups[groupId].rooms[channelId] = {
    name: trimmedName,
    type: roomType,
    users: []
  };
  
  return { channelId, name: trimmedName, type: roomType };
}

/**
 * Bir kanalı siler
 * @param {string} groupId - Grup ID'si
 * @param {string} channelId - Kanal ID'si
 * @param {string} username - İşlemi yapan kullanıcı adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<void>}
 */
async function deleteChannel(groupId, channelId, username, groups) {
  if (!groups[groupId]) throw new Error("Grup bulunamadı");
  if (!groups[groupId].rooms[channelId]) throw new Error("Kanal bulunamadı");
  
  // Grup sahibi kontrolü
  if (groups[groupId].owner !== username) {
    throw new Error("Bu kanalı silme yetkiniz yok");
  }
  
  // Kanalı veritabanından bul
  const channelDoc = await Channel.findOne({ channelId });
  if (!channelDoc) throw new Error("Kanal veritabanında bulunamadı");
  
  // Kanala ait mesajları sil
  await Message.deleteMany({ channel: channelDoc._id });
  
  // Kanalı sil
  await Channel.deleteOne({ _id: channelDoc._id });
  
  // Bellek içi gruptan kanalı sil
  delete groups[groupId].rooms[channelId];
}

/**
 * Bir kanalın adını değiştirir
 * @param {string} groupId - Grup ID'si
 * @param {string} channelId - Kanal ID'si
 * @param {string} newName - Yeni kanal adı
 * @param {string} username - İşlemi yapan kullanıcı adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<Object>} - Güncellenmiş kanal bilgileri
 */
async function renameChannel(groupId, channelId, newName, username, groups) {
  if (!groups[groupId]) throw new Error("Grup bulunamadı");
  if (!groups[groupId].rooms[channelId]) throw new Error("Kanal bulunamadı");
  
  // Grup sahibi kontrolü
  if (groups[groupId].owner !== username) {
    throw new Error("Bu kanalı yeniden adlandırma yetkiniz yok");
  }
  
  const trimmedName = newName.trim();
  if (!trimmedName) throw new Error("Kanal adı boş olamaz");
  
  // Kanalı veritabanında güncelle
  const channelDoc = await Channel.findOne({ channelId });
  if (!channelDoc) throw new Error("Kanal veritabanında bulunamadı");
  
  channelDoc.name = trimmedName;
  await channelDoc.save();
  
  // Bellek içi kanalı güncelle
  groups[groupId].rooms[channelId].name = trimmedName;
  
  return { 
    channelId, 
    name: trimmedName, 
    type: groups[groupId].rooms[channelId].type 
  };
}

/**
 * Bir kanala kullanıcı ekler
 * @param {string} groupId - Grup ID'si
 * @param {string} channelId - Kanal ID'si
 * @param {string} socketId - Kullanıcının socket ID'si
 * @param {string} username - Kullanıcı adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @param {Object} users - Bellek içi users nesnesi
 * @returns {void}
 */
function addUserToChannel(groupId, channelId, socketId, username, groups, users) {
  if (!groups[groupId]) return;
  if (!groups[groupId].rooms[channelId]) return;
  
  // Kullanıcı zaten kanalda mı kontrol et
  const userIndex = groups[groupId].rooms[channelId].users.findIndex(u => u.id === socketId);
  if (userIndex === -1) {
    groups[groupId].rooms[channelId].users.push({ id: socketId, username });
  }
  
  // Kullanıcının mevcut kanal bilgisini güncelle
  users[socketId].currentRoom = channelId;
}

/**
 * Bir kanaldan kullanıcı çıkarır
 * @param {string} groupId - Grup ID'si
 * @param {string} channelId - Kanal ID'si
 * @param {string} socketId - Kullanıcının socket ID'si
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {void}
 */
function removeUserFromChannel(groupId, channelId, socketId, groups) {
  if (!groups[groupId]) return;
  if (!groups[groupId].rooms[channelId]) return;
  
  // Kullanıcıyı kanaldan çıkar
  groups[groupId].rooms[channelId].users = groups[groupId].rooms[channelId].users.filter(u => u.id !== socketId);
}

/**
 * Bir kanaldaki tüm kullanıcıların listesini yayınlar
 * @param {string} groupId - Grup ID'si
 * @param {string} channelId - Kanal ID'si
 * @param {Object} groups - Bellek içi groups nesnesi
 * @param {Object} io - Socket.IO nesnesi
 * @returns {void}
 */
function broadcastChannelUsers(groupId, channelId, groups, io) {
  if (!groups[groupId]) return;
  if (!groups[groupId].rooms[channelId]) return;
  
  io.to(`${groupId}::${channelId}`).emit('roomUsers', groups[groupId].rooms[channelId].users);
}

/**
 * Bir gruptaki tüm kanalların kullanıcı listelerini yayınlar
 * @param {string} groupId - Grup ID'si
 * @param {Object} groups - Bellek içi groups nesnesi
 * @param {Object} io - Socket.IO nesnesi
 * @returns {void}
 */
function broadcastAllChannelsData(groupId, groups, io) {
  if (!groups[groupId]) return;
  
  Object.keys(groups[groupId].rooms).forEach(roomId => {
    io.to(`${groupId}::${roomId}`).emit('roomUsers', groups[groupId].rooms[roomId].users);
  });
}

module.exports = {
  loadChannelsFromDB,
  sendRoomsListToUser,
  broadcastRoomsListToGroup,
  createChannel,
  deleteChannel,
  renameChannel,
  addUserToChannel,
  removeUserFromChannel,
  broadcastChannelUsers,
  broadcastAllChannelsData
};
