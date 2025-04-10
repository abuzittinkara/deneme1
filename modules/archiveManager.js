// modules/archiveManager.js
const Channel = require('../models/Channel');
const User = require('../models/User');
const roleManager = require('./roleManager');

/**
 * Kanalı arşivler
 * @param {string} channelId - Kanal ID'si
 * @param {string} username - İşlemi yapan kullanıcı adı
 * @param {string} groupId - Grup ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function archiveChannel(channelId, username, groupId) {
  // İzin kontrolü
  const hasPermission = await roleManager.checkPermission(username, groupId, 'manageChannels');
  if (!hasPermission) {
    throw new Error('Bu işlem için yetkiniz yok.');
  }
  
  const channel = await Channel.findOne({ channelId });
  if (!channel) {
    throw new Error('Kanal bulunamadı.');
  }
  
  if (channel.isArchived) {
    throw new Error('Kanal zaten arşivlenmiş.');
  }
  
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  // Kanalı arşivle
  channel.isArchived = true;
  channel.archivedAt = new Date();
  channel.archivedBy = user._id;
  
  await channel.save();
  
  return { 
    success: true, 
    message: 'Kanal başarıyla arşivlendi.',
    channel: {
      id: channel.channelId,
      name: channel.name,
      type: channel.type,
      isArchived: channel.isArchived,
      archivedAt: channel.archivedAt
    }
  };
}

/**
 * Kanalı arşivden çıkarır
 * @param {string} channelId - Kanal ID'si
 * @param {string} username - İşlemi yapan kullanıcı adı
 * @param {string} groupId - Grup ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function unarchiveChannel(channelId, username, groupId) {
  // İzin kontrolü
  const hasPermission = await roleManager.checkPermission(username, groupId, 'manageChannels');
  if (!hasPermission) {
    throw new Error('Bu işlem için yetkiniz yok.');
  }
  
  const channel = await Channel.findOne({ channelId });
  if (!channel) {
    throw new Error('Kanal bulunamadı.');
  }
  
  if (!channel.isArchived) {
    throw new Error('Kanal arşivlenmemiş.');
  }
  
  // Kanalı arşivden çıkar
  channel.isArchived = false;
  channel.archivedAt = undefined;
  channel.archivedBy = undefined;
  
  await channel.save();
  
  return { 
    success: true, 
    message: 'Kanal başarıyla arşivden çıkarıldı.',
    channel: {
      id: channel.channelId,
      name: channel.name,
      type: channel.type,
      isArchived: channel.isArchived
    }
  };
}

/**
 * Arşivlenmiş kanalları getirir
 * @param {string} groupId - Grup ID'si
 * @returns {Promise<Array>} - Arşivlenmiş kanallar listesi
 */
async function getArchivedChannels(groupId) {
  const group = await Group.findOne({ groupId });
  if (!group) {
    throw new Error('Grup bulunamadı.');
  }
  
  const channels = await Channel.find({ 
    group: group._id,
    isArchived: true
  }).populate('archivedBy', 'username');
  
  return channels.map(channel => ({
    id: channel.channelId,
    name: channel.name,
    type: channel.type,
    archivedAt: channel.archivedAt,
    archivedBy: channel.archivedBy ? channel.archivedBy.username : null
  }));
}

module.exports = {
  archiveChannel,
  unarchiveChannel,
  getArchivedChannels
};
