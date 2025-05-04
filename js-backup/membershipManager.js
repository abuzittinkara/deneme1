/**************************************
 * modules/group/membershipManager.js
 * Grup üyeliği işlemleri
 **************************************/
const { logger } = require('../../utils/logger');

/**
 * Kullanıcıyı tüm gruplardan ve kanallardan çıkarır
 * @param {Object} socket - Kullanıcının socket nesnesi
 * @param {Object} users - Bellek içi users nesnesi
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {void}
 */
function removeUserFromAllGroupsAndRooms(socket, users, groups) {
  try {
    const userData = users[socket.id];
    if (!userData) return;
    
    const { currentGroup, currentRoom, username } = userData;
    
    // Kullanıcıyı mevcut gruptan çıkar
    if (currentGroup && groups[currentGroup]) {
      // Kullanıcıyı grup listesinden çıkar
      groups[currentGroup].users = groups[currentGroup].users.filter(u => u.id !== socket.id);
      
      // Kullanıcıyı mevcut kanaldan çıkar
      if (currentRoom && groups[currentGroup].rooms[currentRoom]) {
        groups[currentGroup].rooms[currentRoom].users = groups[currentGroup].rooms[currentRoom].users.filter(u => u.id !== socket.id);
      }
      
      // Socket'i grup ve kanal odalarından çıkar
      socket.leave(currentGroup);
      if (currentRoom) {
        socket.leave(`${currentGroup}::${currentRoom}`);
      }
      
      logger.info('Kullanıcı gruptan çıkarıldı', { username, groupId: currentGroup, roomId: currentRoom });
    }
    
    // Kullanıcı verilerini sıfırla
    if (userData) {
      userData.currentGroup = null;
      userData.currentRoom = null;
    }
  } catch (error) {
    logger.error('Kullanıcıyı gruplardan çıkarma hatası', { error: error.message, socketId: socket.id });
  }
}

/**
 * Kullanıcıyı bir gruba ekler
 * @param {Object} socket - Kullanıcının socket nesnesi
 * @param {string} groupId - Grup ID'si
 * @param {Object} users - Bellek içi users nesnesi
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {boolean} - İşlem başarılı mı
 */
function addUserToGroup(socket, groupId, users, groups) {
  try {
    const userData = users[socket.id];
    if (!userData || !userData.username) {
      logger.warn('Kullanıcı verisi bulunamadı', { socketId: socket.id });
      return false;
    }
    
    // Grup kontrolü
    if (!groups[groupId]) {
      logger.warn('Grup bulunamadı', { groupId });
      return false;
    }
    
    // Kullanıcıyı mevcut gruptan çıkar
    if (userData.currentGroup) {
      removeUserFromAllGroupsAndRooms(socket, users, groups);
    }
    
    // Kullanıcıyı gruba ekle
    if (!groups[groupId].users) {
      groups[groupId].users = [];
    }
    
    groups[groupId].users.push({
      id: socket.id,
      username: userData.username
    });
    
    // Socket'i grup odasına ekle
    socket.join(groupId);
    
    // Kullanıcı verilerini güncelle
    userData.currentGroup = groupId;
    
    logger.info('Kullanıcı gruba eklendi', { username: userData.username, groupId });
    
    return true;
  } catch (error) {
    logger.error('Kullanıcıyı gruba ekleme hatası', { error: error.message, socketId: socket.id, groupId });
    return false;
  }
}

/**
 * Kullanıcıyı bir kanala ekler
 * @param {Object} socket - Kullanıcının socket nesnesi
 * @param {string} groupId - Grup ID'si
 * @param {string} roomId - Kanal ID'si
 * @param {Object} users - Bellek içi users nesnesi
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {boolean} - İşlem başarılı mı
 */
function addUserToRoom(socket, groupId, roomId, users, groups) {
  try {
    const userData = users[socket.id];
    if (!userData || !userData.username) {
      logger.warn('Kullanıcı verisi bulunamadı', { socketId: socket.id });
      return false;
    }
    
    // Grup kontrolü
    if (!groups[groupId]) {
      logger.warn('Grup bulunamadı', { groupId });
      return false;
    }
    
    // Kanal kontrolü
    if (!groups[groupId].rooms || !groups[groupId].rooms[roomId]) {
      logger.warn('Kanal bulunamadı', { groupId, roomId });
      return false;
    }
    
    // Kullanıcı grupta değilse, gruba ekle
    if (userData.currentGroup !== groupId) {
      const addedToGroup = addUserToGroup(socket, groupId, users, groups);
      if (!addedToGroup) {
        return false;
      }
    }
    
    // Kullanıcıyı mevcut kanaldan çıkar
    if (userData.currentRoom) {
      const currentRoomId = userData.currentRoom;
      if (groups[groupId].rooms[currentRoomId]) {
        groups[groupId].rooms[currentRoomId].users = groups[groupId].rooms[currentRoomId].users.filter(u => u.id !== socket.id);
      }
      socket.leave(`${groupId}::${currentRoomId}`);
    }
    
    // Kullanıcıyı kanala ekle
    if (!groups[groupId].rooms[roomId].users) {
      groups[groupId].rooms[roomId].users = [];
    }
    
    groups[groupId].rooms[roomId].users.push({
      id: socket.id,
      username: userData.username
    });
    
    // Socket'i kanal odasına ekle
    socket.join(`${groupId}::${roomId}`);
    
    // Kullanıcı verilerini güncelle
    userData.currentRoom = roomId;
    
    logger.info('Kullanıcı kanala eklendi', { username: userData.username, groupId, roomId });
    
    return true;
  } catch (error) {
    logger.error('Kullanıcıyı kanala ekleme hatası', { error: error.message, socketId: socket.id, groupId, roomId });
    return false;
  }
}

module.exports = {
  removeUserFromAllGroupsAndRooms,
  addUserToGroup,
  addUserToRoom
};
