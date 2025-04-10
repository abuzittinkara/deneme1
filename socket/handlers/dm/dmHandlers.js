/**************************************
 * socket/handlers/dm/dmHandlers.js
 * Direkt mesaj ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Direkt mesaj socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerDMHandlers(socket, io, deps) {
  const { 
    users, 
    dmManager,
    blockManager
  } = deps;

  // DM gönderme olayı
  socket.on('sendDM', async (data, callback) => {
    try {
      const { recipientUsername, message } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Engelleme kontrolü
      const isBlocked = await blockManager.isUserBlocked(userData.username, recipientUsername);
      if (isBlocked) {
        return callback({ success: false, message: "Bu kullanıcıya mesaj gönderemezsiniz." });
      }
      
      // Mesajı kaydet ve gönder
      const result = await dmManager.sendDirectMessage(userData.username, recipientUsername, message);
      
      if (result.success) {
        // Alıcıya mesajı gönder
        const recipientSocketId = Object.keys(users).find(id => users[id].username === recipientUsername);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('newDM', {
            from: userData.username,
            message,
            timestamp: result.timestamp,
            messageId: result.messageId
          });
        }
        
        // Gönderene onay gönder
        callback({
          success: true,
          messageId: result.messageId,
          timestamp: result.timestamp
        });
      } else {
        callback(result);
      }
      
      logger.info('DM gönderildi', { 
        from: userData.username, 
        to: recipientUsername,
        messageLength: message.length
      });
    } catch (err) {
      handleSocketError(err, "DM gönderme hatası", socket, callback);
    }
  });

  // DM geçmişi getirme olayı
  socket.on('getDMHistory', async (data, callback) => {
    try {
      const { otherUsername, limit, before } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // DM geçmişini getir
      const messages = await dmManager.getDirectMessageHistory(userData.username, otherUsername, limit, before);
      
      callback({ success: true, messages });
      
      logger.debug('DM geçmişi getirildi', { 
        username: userData.username, 
        otherUsername,
        limit,
        count: messages.length
      });
    } catch (err) {
      handleSocketError(err, "DM geçmişi getirme hatası", socket, callback);
    }
  });

  // DM düzenleme olayı
  socket.on('editDM', async (data, callback) => {
    try {
      const { messageId, newContent } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Mesajı düzenle
      const result = await dmManager.editDirectMessage(messageId, userData.username, newContent);
      
      if (result.success) {
        // Alıcıya düzenleme bilgisini gönder
        const recipientSocketId = Object.keys(users).find(id => users[id].username === result.recipientUsername);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('dmEdited', {
            messageId,
            newContent,
            editedAt: result.editedAt
          });
        }
      }
      
      callback(result);
      
      logger.info('DM düzenlendi', { 
        messageId, 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "DM düzenleme hatası", socket, callback);
    }
  });

  // DM silme olayı
  socket.on('deleteDM', async (data, callback) => {
    try {
      const { messageId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Mesajı sil
      const result = await dmManager.deleteDirectMessage(messageId, userData.username);
      
      if (result.success) {
        // Alıcıya silme bilgisini gönder
        const recipientSocketId = Object.keys(users).find(id => users[id].username === result.recipientUsername);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('dmDeleted', {
            messageId,
            deletedAt: result.deletedAt
          });
        }
      }
      
      callback(result);
      
      logger.info('DM silindi', { 
        messageId, 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "DM silme hatası", socket, callback);
    }
  });

  // DM tepkisi ekleme olayı
  socket.on('addDMReaction', async (data, callback) => {
    try {
      const { messageId, emoji } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Tepki ekle
      const result = await dmManager.addDirectMessageReaction(messageId, userData.username, emoji);
      
      if (result.success) {
        // Alıcıya tepki bilgisini gönder
        const recipientSocketId = Object.keys(users).find(id => users[id].username === result.recipientUsername);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('dmReactionAdded', {
            messageId,
            emoji,
            username: userData.username
          });
        }
      }
      
      callback(result);
      
      logger.debug('DM tepkisi eklendi', { 
        messageId, 
        emoji,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "DM tepkisi ekleme hatası", socket, callback);
    }
  });

  // DM tepkisi kaldırma olayı
  socket.on('removeDMReaction', async (data, callback) => {
    try {
      const { messageId, emoji } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Tepki kaldır
      const result = await dmManager.removeDirectMessageReaction(messageId, userData.username, emoji);
      
      if (result.success) {
        // Alıcıya tepki kaldırma bilgisini gönder
        const recipientSocketId = Object.keys(users).find(id => users[id].username === result.recipientUsername);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('dmReactionRemoved', {
            messageId,
            emoji,
            username: userData.username
          });
        }
      }
      
      callback(result);
      
      logger.debug('DM tepkisi kaldırıldı', { 
        messageId, 
        emoji,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "DM tepkisi kaldırma hatası", socket, callback);
    }
  });
}

module.exports = registerDMHandlers;
