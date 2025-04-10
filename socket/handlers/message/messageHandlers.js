/**************************************
 * socket/handlers/message/messageHandlers.js
 * Mesaj ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Mesaj socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerMessageHandlers(socket, io, deps) {
  const { 
    users, 
    groups, 
    messageManager
  } = deps;

  // Mesaj gönderme olayı
  socket.on('sendMessage', async (data) => {
    try {
      const { groupId, roomId, message } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
        return;
      }
      
      if (!groups[groupId]) {
        socket.emit('errorMessage', "Grup bulunamadı.");
        return;
      }
      
      if (!groups[groupId].rooms[roomId]) {
        socket.emit('errorMessage', "Kanal bulunamadı.");
        return;
      }
      
      // Mesajı kaydet ve gönder
      const messageData = {
        username: userData.username,
        message,
        timestamp: new Date().toISOString()
      };
      
      // Mesajı kanaldaki tüm kullanıcılara gönder
      io.to(`${groupId}::${roomId}`).emit('message', messageData);
      
      // Mesajı veritabanına kaydet
      await messageManager.saveMessage(groupId, roomId, userData.username, message);
      
      logger.info('Mesaj gönderildi', { 
        groupId, 
        roomId, 
        username: userData.username,
        messageLength: message.length
      });
    } catch (err) {
      handleSocketError(err, "Mesaj gönderme hatası", socket);
    }
  });

  // Mesaj geçmişi getirme olayı
  socket.on('getMessageHistory', async (data, callback) => {
    try {
      const { groupId, roomId, limit, before } = data;
      
      if (!groups[groupId]) {
        return callback({ success: false, message: "Grup bulunamadı." });
      }
      
      if (!groups[groupId].rooms[roomId]) {
        return callback({ success: false, message: "Kanal bulunamadı." });
      }
      
      // Mesaj geçmişini getir
      const messages = await messageManager.getMessageHistory(groupId, roomId, limit, before);
      
      callback({ success: true, messages });
      
      logger.debug('Mesaj geçmişi getirildi', { 
        groupId, 
        roomId, 
        limit,
        count: messages.length
      });
    } catch (err) {
      handleSocketError(err, "Mesaj geçmişi getirme hatası", socket, callback);
    }
  });

  // Mesaj düzenleme olayı
  socket.on('editMessage', async (data, callback) => {
    try {
      const { messageId, newContent } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Mesajı düzenle
      const result = await messageManager.editMessage(messageId, userData.username, newContent);
      
      if (result.success) {
        // Mesajın bulunduğu kanala düzenleme bilgisini gönder
        io.to(`${result.groupId}::${result.roomId}`).emit('messageEdited', {
          messageId,
          newContent,
          editedAt: result.editedAt
        });
      }
      
      callback(result);
      
      logger.info('Mesaj düzenlendi', { 
        messageId, 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Mesaj düzenleme hatası", socket, callback);
    }
  });

  // Mesaj silme olayı
  socket.on('deleteMessage', async (data, callback) => {
    try {
      const { messageId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Mesajı sil
      const result = await messageManager.deleteMessage(messageId, userData.username);
      
      if (result.success) {
        // Mesajın bulunduğu kanala silme bilgisini gönder
        io.to(`${result.groupId}::${result.roomId}`).emit('messageDeleted', {
          messageId,
          deletedAt: result.deletedAt
        });
      }
      
      callback(result);
      
      logger.info('Mesaj silindi', { 
        messageId, 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Mesaj silme hatası", socket, callback);
    }
  });

  // Mesaj tepkisi ekleme olayı
  socket.on('addReaction', async (data, callback) => {
    try {
      const { messageId, emoji } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Tepki ekle
      const result = await messageManager.addReaction(messageId, userData.username, emoji);
      
      if (result.success) {
        // Mesajın bulunduğu kanala tepki bilgisini gönder
        io.to(`${result.groupId}::${result.roomId}`).emit('reactionAdded', {
          messageId,
          emoji,
          username: userData.username
        });
      }
      
      callback(result);
      
      logger.debug('Tepki eklendi', { 
        messageId, 
        emoji,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Tepki ekleme hatası", socket, callback);
    }
  });

  // Mesaj tepkisi kaldırma olayı
  socket.on('removeReaction', async (data, callback) => {
    try {
      const { messageId, emoji } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Tepki kaldır
      const result = await messageManager.removeReaction(messageId, userData.username, emoji);
      
      if (result.success) {
        // Mesajın bulunduğu kanala tepki kaldırma bilgisini gönder
        io.to(`${result.groupId}::${result.roomId}`).emit('reactionRemoved', {
          messageId,
          emoji,
          username: userData.username
        });
      }
      
      callback(result);
      
      logger.debug('Tepki kaldırıldı', { 
        messageId, 
        emoji,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Tepki kaldırma hatası", socket, callback);
    }
  });
}

module.exports = registerMessageHandlers;
