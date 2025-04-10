/**************************************
 * socket/handlers/channel/channelHandlers.js
 * Kanal ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Kanal socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerChannelHandlers(socket, io, deps) {
  const { 
    users, 
    groups, 
    channelManager,
    groupManager,
    userManager
  } = deps;

  // Kanal oluşturma olayı
  socket.on('createRoom', async (data) => {
    try {
      const { groupId, roomName, roomType } = data;
      const username = users[socket.id]?.username;
      
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
        return;
      }
      
      await channelManager.createRoom(groupId, roomName, roomType, username, groups);
      channelManager.sendRoomsListToUser(socket.id, groupId, groups, io);
      
      // Gruptaki tüm kullanıcılara kanal listesini güncelle
      const socketsInGroup = await io.in(groupId).fetchSockets();
      for (const s of socketsInGroup) {
        channelManager.sendRoomsListToUser(s.id, groupId, groups, io);
      }
      
      logger.info('Kanal oluşturuldu', { groupId, roomName, roomType, username });
    } catch (err) {
      handleSocketError(err, "Kanal oluşturma hatası", socket);
    }
  });

  // Kanala katılma olayı
  socket.on('joinRoom', async (data) => {
    try {
      const { groupId, roomId } = data;
      
      if (!groups[groupId]) {
        socket.emit('errorMessage', "Grup bulunamadı.");
        return;
      }
      
      if (!groups[groupId].rooms[roomId]) {
        socket.emit('errorMessage', "Kanal bulunamadı.");
        return;
      }
      
      const userData = users[socket.id];
      const username = userData.username;
      
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız yok.");
        return;
      }
      
      // Kullanıcı zaten bu gruptaysa, sadece kanalı değiştir
      if (userData.currentGroup === groupId) {
        // Mevcut kanaldan çık
        if (userData.currentRoom) {
          const currentRoomId = userData.currentRoom;
          if (groups[groupId].rooms[currentRoomId]) {
            groups[groupId].rooms[currentRoomId].users = groups[groupId].rooms[currentRoomId].users.filter(u => u.id !== socket.id);
          }
          socket.leave(`${groupId}::${currentRoomId}`);
        }
      } else {
        // Kullanıcı başka bir gruptaysa, önce o gruptan çıkar
        userManager.removeUserFromAllGroupsAndRooms(socket, users, groups);
        
        // Gruba katıl
        if (!groups[groupId].users.some(u => u.id === socket.id)) {
          groups[groupId].users.push({ id: socket.id, username });
        }
        
        userData.currentGroup = groupId;
        socket.join(groupId);
      }
      
      // Kanala katıl
      if (!groups[groupId].rooms[roomId].users) {
        groups[groupId].rooms[roomId].users = [];
      }
      
      if (!groups[groupId].rooms[roomId].users.some(u => u.id === socket.id)) {
        groups[groupId].rooms[roomId].users.push({ id: socket.id, username });
      }
      
      userData.currentRoom = roomId;
      socket.join(`${groupId}::${roomId}`);
      
      // Kanal verilerini güncelle
      channelManager.sendRoomsListToUser(socket.id, groupId, groups, io);
      channelManager.broadcastAllChannelsData(groupId, groups, io);
      
      // Ses kanalıysa, ses verilerini güncelle
      if (groups[groupId].rooms[roomId].type === 'voice') {
        socket.emit('voiceRoomJoined', { groupId, roomId });
      }
      
      logger.info('Kanala katılındı', { groupId, roomId, username });
    } catch (err) {
      handleSocketError(err, "Kanala katılma hatası", socket);
    }
  });

  // Kanaldan çıkma olayı
  socket.on('leaveRoom', async () => {
    try {
      const userData = users[socket.id];
      if (!userData) return;
      
      const { currentGroup, currentRoom, username } = userData;
      
      if (!currentGroup || !currentRoom) return;
      
      // Kanaldan çık
      if (groups[currentGroup] && groups[currentGroup].rooms[currentRoom]) {
        groups[currentGroup].rooms[currentRoom].users = groups[currentGroup].rooms[currentRoom].users.filter(u => u.id !== socket.id);
      }
      
      socket.leave(`${currentGroup}::${currentRoom}`);
      userData.currentRoom = null;
      
      // Kanal verilerini güncelle
      channelManager.broadcastAllChannelsData(currentGroup, groups, io);
      
      logger.info('Kanaldan çıkıldı', { groupId: currentGroup, roomId: currentRoom, username });
    } catch (err) {
      handleSocketError(err, "Kanaldan çıkma hatası", socket);
    }
  });

  // Kanal silme olayı
  socket.on('deleteRoom', async (data) => {
    try {
      const { groupId, roomId } = data;
      const username = users[socket.id]?.username;
      
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
        return;
      }
      
      await channelManager.deleteRoom(groupId, roomId, username, groups);
      
      // Kanaldaki tüm kullanıcıları kanaldan çıkar
      const roomName = `${groupId}::${roomId}`;
      const socketsInRoom = await io.in(roomName).fetchSockets();
      
      for (const s of socketsInRoom) {
        if (users[s.id]) {
          users[s.id].currentRoom = null;
        }
        s.leave(roomName);
      }
      
      // Kanal listesini güncelle
      const socketsInGroup = await io.in(groupId).fetchSockets();
      for (const s of socketsInGroup) {
        channelManager.sendRoomsListToUser(s.id, groupId, groups, io);
      }
      
      logger.info('Kanal silindi', { groupId, roomId, username });
    } catch (err) {
      handleSocketError(err, "Kanal silme hatası", socket);
    }
  });

  // Kanal yeniden adlandırma olayı
  socket.on('renameRoom', async (data) => {
    try {
      const { groupId, roomId, newName } = data;
      const username = users[socket.id]?.username;
      
      if (!username) {
        socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
        return;
      }
      
      await channelManager.renameRoom(groupId, roomId, newName, username, groups);
      
      // Kanal listesini güncelle
      const socketsInGroup = await io.in(groupId).fetchSockets();
      for (const s of socketsInGroup) {
        channelManager.sendRoomsListToUser(s.id, groupId, groups, io);
      }
      
      logger.info('Kanal yeniden adlandırıldı', { groupId, roomId, newName, username });
    } catch (err) {
      handleSocketError(err, "Kanal yeniden adlandırma hatası", socket);
    }
  });
}

module.exports = registerChannelHandlers;
