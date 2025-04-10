/**************************************
 * socket/handlers/user/userHandlers.js
 * Kullanıcı ile ilgili socket olaylarını yönetir
 **************************************/
const User = require('../../../models/User');
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Kullanıcı socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerUserHandlers(socket, io, deps) {
  const { 
    users, 
    onlineUsernames, 
    userManager,
    profileManager,
    sessionManager
  } = deps;

  // Kullanıcı kayıt olayı
  socket.on('register', async (userData, callback) => {
    try {
      const result = await userManager.registerUser(userData);
      
      if (callback) {
        callback(result);
      } else {
        socket.emit('registerResult', result);
      }
      
      logger.info('Kullanıcı kaydedildi', { username: userData.username });
    } catch (err) {
      handleSocketError(err, 'Kayıt hatası', socket, callback);
    }
  });

  // Kullanıcı giriş olayı
  socket.on('login', async (data, callback) => {
    try {
      const { username, password } = data;
      
      // Kullanıcı girişi
      const result = await userManager.loginUser(username, password);
      
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
      handleSocketError(err, 'Giriş hatası', socket, callback);
    }
  });

  // Kullanıcı adı ayarlama olayı
  socket.on('set-username', (username) => {
    try {
      if (users[socket.id]) {
        users[socket.id].username = username;
        onlineUsernames.add(username);
        deps.groupManager.sendGroupsListToUser(socket.id, users, io);
        
        logger.info('Kullanıcı adı ayarlandı', { username, socketId: socket.id });
      }
    } catch (err) {
      handleSocketError(err, 'Kullanıcı adı ayarlama hatası', socket);
    }
  });

  // Profil güncelleme olayı
  socket.on('updateProfile', async (data, callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
      }
      
      const userDoc = await User.findOne({ username: userData.username });
      if (!userDoc) {
        return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
      }
      
      // Profili güncelle
      const updatedProfile = await profileManager.updateUserProfile(userDoc._id, data);
      
      callback({ success: true, profile: updatedProfile });
      
      logger.info('Kullanıcı profili güncellendi', { username: userData.username });
    } catch (err) {
      handleSocketError(err, 'Profil güncelleme hatası', socket, callback);
    }
  });

  // Kullanıcı adı değiştirme olayı
  socket.on('changeUsername', async (data, callback) => {
    try {
      const { newUsername, password } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
      }
      
      const userDoc = await User.findOne({ username: userData.username });
      if (!userDoc) {
        return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
      }
      
      // Kullanıcı adını değiştir
      const result = await profileManager.changeUsername(userDoc._id, newUsername, password);
      
      // Kullanıcı adını güncelle
      if (result.success) {
        userData.username = newUsername;
        onlineUsernames.delete(result.oldUsername);
        onlineUsernames.add(newUsername);
        
        logger.info('Kullanıcı adı değiştirildi', { 
          oldUsername: result.oldUsername, 
          newUsername, 
          socketId: socket.id 
        });
      }
      
      callback(result);
    } catch (err) {
      handleSocketError(err, 'Kullanıcı adı değiştirme hatası', socket, callback);
    }
  });

  // Ses durumu değişikliği olayı
  socket.on('audioStateChanged', ({ micEnabled, selfDeafened }) => {
    try {
      if (!users[socket.id]) return;
      
      users[socket.id].micEnabled = micEnabled;
      users[socket.id].selfDeafened = selfDeafened;
      
      const groupId = users[socket.id].currentGroup;
      if (groupId) {
        deps.channelManager.broadcastAllChannelsData(groupId, deps.groups, io);
        
        logger.debug('Ses durumu değiştirildi', { 
          username: users[socket.id].username,
          micEnabled,
          selfDeafened
        });
      }
    } catch (err) {
      handleSocketError(err, 'Ses durumu değiştirme hatası', socket);
    }
  });

  // Ekran paylaşımı durumu değişikliği olayı
  socket.on('screenShareStatusChanged', ({ isScreenSharing }) => {
    try {
      if (users[socket.id]) {
        users[socket.id].isScreenSharing = isScreenSharing;
        
        const groupId = users[socket.id].currentGroup;
        if (groupId) {
          deps.channelManager.broadcastAllChannelsData(groupId, deps.groups, io);
          
          logger.debug('Ekran paylaşımı durumu değiştirildi', { 
            username: users[socket.id].username,
            isScreenSharing
          });
        }
      }
    } catch (err) {
      handleSocketError(err, 'Ekran paylaşımı durumu değiştirme hatası', socket);
    }
  });

  // Ekran paylaşımı başlatma olayı
  socket.on('screenShareStarted', ({ producerId }) => {
    try {
      if (users[socket.id]) {
        users[socket.id].screenShareProducerId = producerId;
        
        const groupId = users[socket.id].currentGroup;
        if (groupId) {
          deps.channelManager.broadcastAllChannelsData(groupId, deps.groups, io);
          
          logger.info('Ekran paylaşımı başlatıldı', { 
            username: users[socket.id].username,
            producerId
          });
        }
      }
    } catch (err) {
      handleSocketError(err, 'Ekran paylaşımı başlatma hatası', socket);
    }
  });
}

module.exports = registerUserHandlers;
