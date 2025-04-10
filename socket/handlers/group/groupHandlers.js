/**************************************
 * socket/handlers/group/groupHandlers.js
 * Grup ile ilgili socket olaylarını yönetir
 **************************************/
const Group = require('../../../models/Group');
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Grup socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerGroupHandlers(socket, io, deps) {
  const { 
    users, 
    groups, 
    groupManager,
    channelManager,
    userManager
  } = deps;

  // Grup oluşturma olayı
  socket.on('createGroup', async (groupName) => {
    try {
      const username = users[socket.id]?.username;
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
        return;
      }
      
      const result = await groupManager.createGroup(groupName, username, groups);
      groupManager.sendGroupsListToUser(socket.id, users, io);
      
      logger.info('Grup oluşturuldu', { groupName, username });
    } catch (err) {
      handleSocketError(err, "Grup oluşturma hatası", socket);
    }
  });

  // Gruba katılma olayı
  socket.on('joinGroup', async (groupId) => {
    try {
      if (!groups[groupId]) {
        socket.emit('errorMessage', "Grup bulunamadı.");
        return;
      }
      
      if (users[socket.id].currentGroup === groupId) {
        return;
      }
      
      userManager.removeUserFromAllGroupsAndRooms(socket, users, groups);
      
      const userData = users[socket.id];
      const username = userData.username;
      
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız yok.");
        return;
      }
      
      if (!groups[groupId].users.some(u => u.id === socket.id)) {
        groups[groupId].users.push({ id: socket.id, username });
      }
      
      userData.currentGroup = groupId;
      userData.currentRoom = null;
      
      socket.join(groupId);
      channelManager.sendRoomsListToUser(socket.id, groupId, groups, io);
      channelManager.broadcastAllChannelsData(groupId, groups, io);
      await groupManager.broadcastGroupUsers(groupId, io, deps.onlineUsernames);
      
      logger.info('Gruba katılındı', { groupId, username });
    } catch (err) {
      handleSocketError(err, "Gruba katılma hatası", socket);
    }
  });

  // Grup silme olayı
  socket.on('deleteGroup', async (groupId) => {
    try {
      const username = users[socket.id]?.username;
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
        return;
      }
      
      await groupManager.deleteGroup(groupId, username, groups);
      
      // Gruptaki tüm kullanıcıları gruptan çıkar
      const socketsInGroup = await io.in(groupId).fetchSockets();
      for (const s of socketsInGroup) {
        userManager.removeUserFromAllGroupsAndRooms(s, users, groups);
        groupManager.sendGroupsListToUser(s.id, users, io);
      }
      
      // Grup odasını kapat
      io.in(groupId).socketsLeave(groupId);
      
      // Grup listesini güncelle
      groupManager.sendGroupsListToUser(socket.id, users, io);
      
      logger.info('Grup silindi', { groupId, username });
    } catch (err) {
      handleSocketError(err, "Grup silme hatası", socket);
    }
  });

  // Grup yeniden adlandırma olayı
  socket.on('renameGroup', async (data) => {
    try {
      const { groupId, newName } = data;
      const username = users[socket.id]?.username;
      
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
        return;
      }
      
      await groupManager.renameGroup(groupId, newName, username, groups);
      
      // Gruptaki tüm kullanıcılara grup listesini güncelle
      const socketsInGroup = await io.in(groupId).fetchSockets();
      for (const s of socketsInGroup) {
        groupManager.sendGroupsListToUser(s.id, users, io);
      }
      
      logger.info('Grup yeniden adlandırıldı', { groupId, newName, username });
    } catch (err) {
      handleSocketError(err, "Grup yeniden adlandırma hatası", socket);
    }
  });
}

module.exports = registerGroupHandlers;
