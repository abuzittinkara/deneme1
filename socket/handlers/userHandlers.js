/**************************************
 * socket/handlers/userHandlers.js
 * Kullanıcı ile ilgili socket olaylarını yönetir
 **************************************/
const User = require('../../models/User');
const authManager = require('../../modules/auth/authManager');
const friendManager = require('../../modules/user/friendManager');
const blockManager = require('../../modules/user/blockManager');
const { logger } = require('../../utils/logger');
const { handleSocketError } = require('../../utils/errorHandlers');

/**
 * Socket hata işleyicisi
 * @param {Error} err - Hata nesnesi
 * @param {string} logMessage - Günlüğe kaydedilecek mesaj
 * @param {Object} socket - Socket nesnesi
 * @param {Function} callback - Callback fonksiyonu
 */
function handleError(err, logMessage, socket, callback) {
  console.error(`${logMessage}:`, err);
  
  const errorResponse = {
    success: false,
    message: err.message || 'Bir hata oluştu.'
  };
  
  if (callback && typeof callback === 'function') {
    callback(errorResponse);
  } else {
    socket.emit('error', errorResponse);
  }
}

/**
 * Kullanıcı socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} deps - Bağımlılıklar
 */
function registerUserHandlers(socket, deps) {
  const { 
    users, 
    onlineUsernames, 
    friendRequests, 
    sessionManager 
  } = deps;

  // Kullanıcı kayıt olayı
  socket.on('register', async (userData, callback) => {
    try {
      const result = await authManager.registerUser(userData);
      
      if (callback) {
        callback(result);
      } else {
        socket.emit('registerResult', result);
      }
      
      logger.info('Kullanıcı kaydedildi', { username: userData.username });
    } catch (err) {
      handleError(err, 'Kayıt hatası', socket, callback);
    }
  });

  // Kullanıcı giriş olayı
  socket.on('login', async (data, callback) => {
    try {
      const { username, password } = data;
      
      // Kullanıcı girişi
      const result = await authManager.loginUser(username, password);
      
      if (result.success) {
        // Kullanıcı bilgilerini socket'e kaydet
        users[socket.id] = {
          username,
          currentGroup: null,
          currentRoom: null,
          micEnabled: true,
          selfDeafened: false,
          isScreenSharing: false,
          screenShareProducerId: null
        };
        
        // Çevrimiçi kullanıcılar listesine ekle
        onlineUsernames.add(username);
        
        // Kullanıcı belgesini bul
        const userDoc = await User.findOne({ username });
        
        if (userDoc) {
          // Oturum oluştur
          const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
          const ipAddress = socket.handshake.address || 'Unknown';
          
          const session = await sessionManager.createSession(
            userDoc._id, 
            socket.id, 
            userAgent, 
            ipAddress
          );
          
          // Oturum ID'sini socket'e kaydet
          socket.sessionId = session._id;
          
          logger.info('Kullanıcı oturumu başlatıldı', { username, socketId: socket.id });
        }
      }
      
      if (callback) {
        callback(result);
      } else {
        socket.emit('loginResult', result);
      }
    } catch (err) {
      handleError(err, 'Giriş hatası', socket, callback);
    }
  });

  // Şifre değiştirme olayı
  socket.on('changePassword', async (data, callback) => {
    try {
      const { currentPassword, newPassword } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        throw new Error('Kullanıcı oturumu bulunamadı.');
      }
      
      const result = await authManager.changePassword(userData.username, currentPassword, newPassword);
      
      if (callback) {
        callback(result);
      }
      
      logger.info('Kullanıcı şifresi değiştirildi', { username: userData.username });
    } catch (err) {
      handleError(err, 'Şifre değiştirme hatası', socket, callback);
    }
  });

  // Arkadaş listesini getirme olayı
  socket.on('getFriends', async (data, callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        throw new Error('Kullanıcı oturumu bulunamadı.');
      }
      
      const friends = await friendManager.getUserFriends(userData.username);
      
      if (callback) {
        callback({ success: true, friends });
      }
      
      logger.info('Arkadaş listesi getirildi', { username: userData.username });
    } catch (err) {
      handleError(err, 'Arkadaş listesi getirme hatası', socket, callback);
    }
  });

  // Arkadaş ekleme olayı
  socket.on('addFriend', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        throw new Error('Kullanıcı oturumu bulunamadı.');
      }
      
      const result = await friendManager.addFriend(userData.username, username);
      
      // Eklenen arkadaşa bildirim gönder
      const friendSocketId = Object.keys(users).find(id => users[id].username === username);
      if (friendSocketId) {
        socket.to(friendSocketId).emit('friendAdded', {
          username: userData.username
        });
      }
      
      if (callback) {
        callback(result);
      }
      
      logger.info('Arkadaş eklendi', { username: userData.username, friendUsername: username });
    } catch (err) {
      handleError(err, 'Arkadaş ekleme hatası', socket, callback);
    }
  });

  // Arkadaşlıktan çıkarma olayı
  socket.on('removeFriend', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        throw new Error('Kullanıcı oturumu bulunamadı.');
      }
      
      const result = await friendManager.removeFriend(userData.username, username);
      
      // Çıkarılan arkadaşa bildirim gönder
      const friendSocketId = Object.keys(users).find(id => users[id].username === username);
      if (friendSocketId) {
        socket.to(friendSocketId).emit('friendRemoved', {
          username: userData.username
        });
      }
      
      if (callback) {
        callback(result);
      }
      
      logger.info('Arkadaşlıktan çıkarıldı', { username: userData.username, friendUsername: username });
    } catch (err) {
      handleError(err, 'Arkadaşlıktan çıkarma hatası', socket, callback);
    }
  });

  // Engellenen kullanıcıları getirme olayı
  socket.on('getBlockedUsers', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        throw new Error('Kullanıcı oturumu bulunamadı.');
      }
      
      const blockedUsers = await blockManager.getUserBlocked(userData.username);
      
      if (callback) {
        callback({ success: true, blockedUsers });
      }
      
      logger.info('Engellenen kullanıcılar listesi getirildi', { username: userData.username });
    } catch (err) {
      handleError(err, 'Engellenen kullanıcılar getirme hatası', socket, callback);
    }
  });

  // Kullanıcı engelleme olayı
  socket.on('blockUser', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        throw new Error('Kullanıcı oturumu bulunamadı.');
      }
      
      const result = await blockManager.blockUser(userData.username, username);
      
      // Engellenen kullanıcıya bildirim gönder
      const blockedSocketId = Object.keys(users).find(id => users[id].username === username);
      if (blockedSocketId) {
        socket.to(blockedSocketId).emit('youWereBlocked', {
          username: userData.username
        });
      }
      
      if (callback) {
        callback(result);
      }
      
      logger.info('Kullanıcı engellendi', { username: userData.username, blockedUsername: username });
    } catch (err) {
      handleError(err, 'Kullanıcı engelleme hatası', socket, callback);
    }
  });

  // Kullanıcı engeli kaldırma olayı
  socket.on('unblockUser', async (data, callback) => {
    try {
      const { username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        throw new Error('Kullanıcı oturumu bulunamadı.');
      }
      
      const result = await blockManager.unblockUser(userData.username, username);
      
      if (callback) {
        callback(result);
      }
      
      logger.info('Kullanıcı engeli kaldırıldı', { username: userData.username, unblockedUsername: username });
    } catch (err) {
      handleError(err, 'Kullanıcı engeli kaldırma hatası', socket, callback);
    }
  });
}

module.exports = registerUserHandlers;
