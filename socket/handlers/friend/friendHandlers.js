/**************************************
 * socket/handlers/friend/friendHandlers.js
 * Arkadaş ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Arkadaş socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerFriendHandlers(socket, io, deps) {
  const { 
    users, 
    friendRequests,
    friendManager
  } = deps;

  // Arkadaş listesi getirme olayı
  socket.on('getFriends', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Arkadaş listesini getir
      const friends = await friendManager.getUserFriends(userData.username);
      
      callback({ success: true, friends });
      
      logger.debug('Arkadaş listesi getirildi', { 
        username: userData.username,
        count: friends.length
      });
    } catch (err) {
      handleSocketError(err, "Arkadaş listesi getirme hatası", socket, callback);
    }
  });

  // Arkadaşlık isteği gönderme olayı
  socket.on('sendFriendRequest', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Kendine istek gönderme kontrolü
      if (userData.username === username) {
        return callback({ success: false, message: "Kendinize arkadaşlık isteği gönderemezsiniz." });
      }
      
      // Arkadaşlık isteği gönder
      const result = await friendManager.sendFriendRequest(userData.username, username);
      
      if (result.success) {
        // İstek listesine ekle
        if (!friendRequests[username]) {
          friendRequests[username] = [];
        }
        
        if (!friendRequests[username].includes(userData.username)) {
          friendRequests[username].push(userData.username);
        }
        
        // Alıcıya bildirim gönder
        const recipientSocketId = Object.keys(users).find(id => users[id].username === username);
        if (recipientSocketId) {
          io.to(recipientSocketId).emit('friendRequestReceived', {
            from: userData.username
          });
        }
      }
      
      callback(result);
      
      logger.info('Arkadaşlık isteği gönderildi', { 
        from: userData.username, 
        to: username
      });
    } catch (err) {
      handleSocketError(err, "Arkadaşlık isteği gönderme hatası", socket, callback);
    }
  });

  // Arkadaşlık istekleri getirme olayı
  socket.on('getFriendRequests', (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Arkadaşlık isteklerini getir
      const requests = friendRequests[userData.username] || [];
      
      callback({ success: true, requests });
      
      logger.debug('Arkadaşlık istekleri getirildi', { 
        username: userData.username,
        count: requests.length
      });
    } catch (err) {
      handleSocketError(err, "Arkadaşlık istekleri getirme hatası", socket, callback);
    }
  });

  // Arkadaşlık isteği kabul etme olayı
  socket.on('acceptFriendRequest', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // İstek kontrolü
      if (!friendRequests[userData.username] || !friendRequests[userData.username].includes(username)) {
        return callback({ success: false, message: "Bu kullanıcıdan arkadaşlık isteği bulunmuyor." });
      }
      
      // Arkadaşlık isteğini kabul et
      const result = await friendManager.acceptFriendRequest(userData.username, username);
      
      if (result.success) {
        // İstek listesinden çıkar
        friendRequests[userData.username] = friendRequests[userData.username].filter(u => u !== username);
        
        // Gönderene bildirim gönder
        const senderSocketId = Object.keys(users).find(id => users[id].username === username);
        if (senderSocketId) {
          io.to(senderSocketId).emit('friendRequestAccepted', {
            username: userData.username
          });
        }
      }
      
      callback(result);
      
      logger.info('Arkadaşlık isteği kabul edildi', { 
        from: username, 
        to: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Arkadaşlık isteği kabul etme hatası", socket, callback);
    }
  });

  // Arkadaşlık isteği reddetme olayı
  socket.on('rejectFriendRequest', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // İstek kontrolü
      if (!friendRequests[userData.username] || !friendRequests[userData.username].includes(username)) {
        return callback({ success: false, message: "Bu kullanıcıdan arkadaşlık isteği bulunmuyor." });
      }
      
      // Arkadaşlık isteğini reddet
      const result = await friendManager.rejectFriendRequest(userData.username, username);
      
      if (result.success) {
        // İstek listesinden çıkar
        friendRequests[userData.username] = friendRequests[userData.username].filter(u => u !== username);
      }
      
      callback(result);
      
      logger.info('Arkadaşlık isteği reddedildi', { 
        from: username, 
        to: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Arkadaşlık isteği reddetme hatası", socket, callback);
    }
  });

  // Arkadaşlıktan çıkarma olayı
  socket.on('removeFriend', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Arkadaşlıktan çıkar
      const result = await friendManager.removeFriend(userData.username, username);
      
      if (result.success) {
        // Diğer kullanıcıya bildirim gönder
        const friendSocketId = Object.keys(users).find(id => users[id].username === username);
        if (friendSocketId) {
          io.to(friendSocketId).emit('friendRemoved', {
            username: userData.username
          });
        }
      }
      
      callback(result);
      
      logger.info('Arkadaşlıktan çıkarıldı', { 
        username: userData.username, 
        friend: username
      });
    } catch (err) {
      handleSocketError(err, "Arkadaşlıktan çıkarma hatası", socket, callback);
    }
  });
}

module.exports = registerFriendHandlers;
