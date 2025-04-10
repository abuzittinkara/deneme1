/**************************************
 * socket/socketEvents.js
 * Socket.IO olaylarını yönetir
 **************************************/

/**
 * Socket.IO olaylarını yapılandırır
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar (users, groups, vb.)
 */
module.exports = function(io, deps) {
  const {
    users,
    groups,
    onlineUsernames,
    friendRequests,
    groupManager,
    channelManager,
    userManager,
    friendManager,
    dmManager,
    fileUpload,
    messageManager,
    profileManager,
    richTextFormatter,
    registerTextChannelEvents,
    sfu,
    // Yeni modüller
    passwordReset,
    emailVerification,
    twoFactorAuth,
    roleManager,
    categoryManager,
    archiveManager,
    messageInteractions,
    mediaProcessor,
    notificationManager,
    emailNotifications,
    scheduledMessageManager,
    sessionManager,
    reportManager
  } = deps;

  // Kullanıcı bağlantı olayı
  io.on('connection', (socket) => {
    console.log('Kullanıcı bağlandı:', socket.id);

    // Yeni bağlanan kullanıcı için varsayılan durum
    users[socket.id] = {
      username: null,
      currentGroup: null,
      currentRoom: null,
      micEnabled: true,
      selfDeafened: false,
      isScreenSharing: false,
      screenShareProducerId: null
    };

    // Kullanıcı kayıt olayı
    socket.on('register', async (userData, callback) => {
      try {
        const result = await userManager.registerUser(userData);
        socket.emit('registerResult', result);
      } catch (err) {
        console.error("Kayıt hatası:", err);
        socket.emit('registerResult', { success: false, message: err.message || 'Kayıt hatası.' });
      }
    });

    // Kullanıcı giriş olayı
    socket.on('login', async (data, callback) => {
      try {
        const { username, password } = data;
        const result = await userManager.loginUser(username, password);

        if (result.success) {
          users[socket.id].username = username;
          onlineUsernames.add(username);

          // Kullanıcı ID'sini al
          const userDoc = await User.findOne({ username });
          if (userDoc) {
            // Oturum oluştur
            const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
            const ipAddress = socket.handshake.address || 'Unknown';
            const session = await sessionManager.createSession(userDoc._id, socket.id, userAgent, ipAddress);

            // Oturum ID'sini socket'e kaydet
            socket.sessionId = session._id;
          }
        }

        socket.emit('loginResult', result);
      } catch (err) {
        console.error("Giriş hatası:", err);
        socket.emit('loginResult', { success: false, message: err.message || 'Giriş hatası.' });
      }
    });

    // Kullanıcı adı ayarlama olayı
    socket.on('set-username', (username) => {
      if (users[socket.id]) {
        users[socket.id].username = username;
        onlineUsernames.add(username);
        groupManager.sendGroupsListToUser(socket.id, users, io);
      }
    });

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
      } catch (err) {
        console.error("Grup oluşturma hatası:", err);
        socket.emit('errorMessage', err.message || "Grup oluşturulurken bir hata oluştu.");
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
        await groupManager.broadcastGroupUsers(groupId, io, onlineUsernames);
      } catch (err) {
        console.error("Gruba katılma hatası:", err);
        socket.emit('errorMessage', err.message || "Gruba katılırken bir hata oluştu.");
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
      } catch (err) {
        console.error("Grup silme hatası:", err);
        socket.emit('errorMessage', err.message || "Grup silinirken bir hata oluştu.");
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
      } catch (err) {
        console.error("Grup yeniden adlandırma hatası:", err);
        socket.emit('errorMessage', err.message || "Grup yeniden adlandırılırken bir hata oluştu.");
      }
    });

    // Kanal oluşturma olayı
    socket.on('createRoom', async (data) => {
      try {
        const { groupId, roomName, roomType } = data;
        const username = users[socket.id]?.username;

        if (!username) {
          socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
          return;
        }

        await channelManager.createChannel(groupId, roomName, roomType, username, groups);
        channelManager.broadcastRoomsListToGroup(groupId, groups, io);
      } catch (err) {
        console.error("Kanal oluşturma hatası:", err);
        socket.emit('errorMessage', err.message || "Kanal oluşturulurken bir hata oluştu.");
      }
    });

    // Kanala katılma olayı
    socket.on('joinRoom', (data) => {
      try {
        const { groupId, roomId } = data;
        const username = users[socket.id]?.username;

        if (!username) {
          socket.emit('errorMessage', "Kullanıcı adınız tanımlı değil.");
          return;
        }

        if (!groups[groupId] || !groups[groupId].rooms[roomId]) {
          socket.emit('errorMessage', "Grup veya kanal bulunamadı.");
          return;
        }

        // Kullanıcı zaten bir kanaldaysa, o kanaldan çıkar
        const currentRoom = users[socket.id].currentRoom;
        if (currentRoom && groups[groupId].rooms[currentRoom]) {
          channelManager.removeUserFromChannel(groupId, currentRoom, socket.id, groups);
          socket.leave(`${groupId}::${currentRoom}`);
        }

        // Kullanıcıyı yeni kanala ekle
        channelManager.addUserToChannel(groupId, roomId, socket.id, username, groups, users);
        socket.join(`${groupId}::${roomId}`);

        // Kanal kullanıcılarını güncelle
        channelManager.broadcastChannelUsers(groupId, roomId, groups, io);
      } catch (err) {
        console.error("Kanala katılma hatası:", err);
        socket.emit('errorMessage', err.message || "Kanala katılırken bir hata oluştu.");
      }
    });

    // Ses durumu değişikliği olayı
    socket.on('audioStateChanged', ({ micEnabled, selfDeafened }) => {
      if (!users[socket.id]) return;

      users[socket.id].micEnabled = micEnabled;
      users[socket.id].selfDeafened = selfDeafened;

      const groupId = users[socket.id].currentGroup;
      if (groupId) {
        channelManager.broadcastAllChannelsData(groupId, groups, io);
      }
    });

    // Ekran paylaşımı durumu değişikliği olayı
    socket.on('screenShareStatusChanged', ({ isScreenSharing }) => {
      if (users[socket.id]) {
        users[socket.id].isScreenSharing = isScreenSharing;

        const groupId = users[socket.id].currentGroup;
        if (groupId) {
          channelManager.broadcastAllChannelsData(groupId, groups, io);
        }
      }
    });

    // Ekran paylaşımı başlatma olayı
    socket.on('screenShareStarted', ({ producerId }) => {
      if (users[socket.id]) {
        users[socket.id].screenShareProducerId = producerId;

        const groupId = users[socket.id].currentGroup;
        if (groupId) {
          channelManager.broadcastAllChannelsData(groupId, groups, io);
        }
      }
    });

    // Metin kanalı olaylarını kaydet
    registerTextChannelEvents(socket, { Channel, Message, User });

    // Arkadaşlık isteği olayı
    socket.on('sendFriendRequest', async (data, callback) => {
      try {
        const fromUsername = users[socket.id]?.username;
        if (!fromUsername) {
          return callback({ success: false, message: 'Kullanıcı adı tanımlı değil.' });
        }

        const result = await friendManager.sendFriendRequest(fromUsername, data.to, friendRequests);
        callback(result);

        // Hedef kullanıcı çevrimiçiyse bildirim gönder
        const targetSocketId = Object.keys(users).find(id => users[id].username === data.to);
        if (targetSocketId) {
          io.to(targetSocketId).emit('newFriendRequest', { from: fromUsername });
        }
      } catch (err) {
        console.error("Arkadaşlık isteği hatası:", err);
        callback({ success: false, message: err.message || 'Arkadaşlık isteği gönderilirken hata oluştu.' });
      }
    });

    // Arkadaşlık isteklerini getirme olayı
    socket.on('getFriendRequests', (data, callback) => {
      try {
        const username = users[socket.id]?.username;
        if (!username) {
          return callback({ success: false, message: 'Kullanıcı adı tanımlı değil.' });
        }

        const requests = friendManager.getFriendRequests(username, friendRequests);
        callback({ success: true, requests });
      } catch (err) {
        console.error("Arkadaşlık istekleri getirme hatası:", err);
        callback({ success: false, message: err.message || 'Arkadaşlık istekleri alınırken hata oluştu.' });
      }
    });

    // Arkadaşlık isteğini kabul etme olayı
    socket.on('acceptFriendRequest', async (data, callback) => {
      try {
        const username = users[socket.id]?.username;
        if (!username) {
          return callback({ success: false, message: 'Kullanıcı adı tanımlı değil.' });
        }

        const result = await friendManager.acceptFriendRequest(username, data.from, friendRequests);
        callback(result);

        // İsteği gönderen kullanıcı çevrimiçiyse bildirim gönder
        const senderSocketId = Object.keys(users).find(id => users[id].username === data.from);
        if (senderSocketId) {
          io.to(senderSocketId).emit('friendRequestAccepted', { username });
        }
      } catch (err) {
        console.error("Arkadaşlık isteği kabul hatası:", err);
        callback({ success: false, message: err.message || 'Arkadaşlık isteği kabul edilirken hata oluştu.' });
      }
    });

    // Arkadaşlık isteğini reddetme olayı
    socket.on('rejectFriendRequest', (data, callback) => {
      try {
        const username = users[socket.id]?.username;
        if (!username) {
          return callback({ success: false, message: 'Kullanıcı adı tanımlı değil.' });
        }

        const result = friendManager.rejectFriendRequest(username, data.from, friendRequests);
        callback(result);
      } catch (err) {
        console.error("Arkadaşlık isteği reddetme hatası:", err);
        callback({ success: false, message: err.message || 'Arkadaşlık isteği reddedilirken hata oluştu.' });
      }
    });

    // Arkadaş listesini getirme olayı
    socket.on('getFriends', async (data, callback) => {
      try {
        const username = users[socket.id]?.username;
        if (!username) {
          return callback({ success: false, message: 'Kullanıcı adı tanımlı değil.' });
        }

        const friends = await userManager.getUserFriends(username);
        callback({ success: true, friends });
      } catch (err) {
        console.error("Arkadaş listesi getirme hatası:", err);
        callback({ success: false, message: err.message || 'Arkadaş listesi alınırken hata oluştu.' });
      }
    });

    // DM mesajı gönderme olayı
    socket.on('dmMessage', async (data, callback) => {
      try {
        const senderUsername = users[socket.id]?.username;
        if (!senderUsername) {
          return callback({ success: false, message: 'Kullanıcı adı tanımlı değil.' });
        }

        const { friend: receiverUsername, message, fileAttachment } = data;

        const messageData = await dmManager.sendDMMessage(senderUsername, receiverUsername, message, fileAttachment);

        // Hedef kullanıcı çevrimiçiyse mesajı gönder
        const targetSocketId = Object.keys(users).find(id => users[id].username === receiverUsername);
        if (targetSocketId) {
          io.to(targetSocketId).emit('newDMMessage', { friend: senderUsername, message: messageData });
        }

        // Gönderen de mesajı görsün
        socket.emit('newDMMessage', { friend: receiverUsername, message: messageData });
        callback({ success: true });
      } catch (err) {
        console.error("DM mesajı hatası:", err);
        callback({ success: false, message: err.message || 'Mesaj gönderilirken hata oluştu.' });
      }
    });

    // DM geçmişini getirme olayı
    socket.on('getDMHistory', async (data, callback) => {
      try {
        const username = users[socket.id]?.username;
        if (!username) {
          return callback({ success: false, message: 'Kullanıcı adı tanımlı değil.' });
        }

        const { friend, limit, skip } = data;
        const messages = await dmManager.getDMHistory(username, friend, limit, skip);
        callback({ success: true, messages });
      } catch (err) {
        console.error("DM geçmişi getirme hatası:", err);
        callback({ success: false, message: err.message || 'Mesaj geçmişi alınırken hata oluştu.' });
      }
    });

    // Dosya yükleme olayı
    socket.on('uploadFile', async (data, callback) => {
      try {
        const { fileData, fileName, fileType, channelId, messageId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Dosya yükleme işlemi
        const fileAttachment = await fileUpload.handleFileUpload(
          fileData,
          fileName,
          fileType,
          userDoc._id,
          messageId
        );

        callback({
          success: true,
          fileId: fileAttachment._id,
          filePath: fileAttachment.path,
          fileName: fileAttachment.originalName
        });
      } catch (err) {
        console.error('Dosya yükleme hatası:', err);
        callback({ success: false, message: err.message || 'Dosya yükleme hatası.' });
      }
    });

    // Mesaj düzenleme olayı
    socket.on('editMessage', async (data, callback) => {
      try {
        const { messageId, newContent } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Mesaj içeriğini formatla
        const formattedContent = richTextFormatter.processText(newContent);

        // Mesajı düzenle
        const result = await messageManager.editChannelMessage(messageId, formattedContent, userDoc._id);

        // Kanaldaki tüm kullanıcılara düzenlemeyi bildir
        const channelDoc = await Channel.findById(result.channelId);
        if (channelDoc) {
          io.to(channelDoc.channelId).emit('messageEdited', {
            messageId: result.messageId,
            content: result.content,
            isEdited: result.isEdited,
            editedAt: result.editedAt
          });
        }

        callback({ success: true });
      } catch (err) {
        console.error('Mesaj düzenleme hatası:', err);
        callback({ success: false, message: err.message || 'Mesaj düzenlenirken hata oluştu.' });
      }
    });

    // Mesaj silme olayı
    socket.on('deleteMessage', async (data, callback) => {
      try {
        const { messageId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Mesajı sil
        const result = await messageManager.deleteChannelMessage(messageId, userDoc._id);

        // Kanaldaki tüm kullanıcılara silme işlemini bildir
        const channelDoc = await Channel.findById(result.channelId);
        if (channelDoc) {
          io.to(channelDoc.channelId).emit('messageDeleted', {
            messageId: result.messageId,
            isDeleted: result.isDeleted,
            deletedAt: result.deletedAt
          });
        }

        callback({ success: true });
      } catch (err) {
        console.error('Mesaj silme hatası:', err);
        callback({ success: false, message: err.message || 'Mesaj silinirken hata oluştu.' });
      }
    });

    // DM mesajı düzenleme olayı
    socket.on('editDMMessage', async (data, callback) => {
      try {
        const { messageId, newContent, friendUsername } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Mesaj içeriğini formatla
        const formattedContent = richTextFormatter.processText(newContent);

        // Mesajı düzenle
        const result = await messageManager.editDMMessage(messageId, formattedContent, userDoc._id);

        // Gönderene ve alıcıya düzenlemeyi bildir
        socket.emit('dmMessageEdited', {
          messageId: result.messageId,
          content: result.content,
          isEdited: result.isEdited,
          editedAt: result.editedAt,
          friend: friendUsername
        });

        // Alıcı çevrimiçiyse ona da bildir
        const targetSocketId = Object.keys(users).find(id => users[id].username === friendUsername);
        if (targetSocketId) {
          io.to(targetSocketId).emit('dmMessageEdited', {
            messageId: result.messageId,
            content: result.content,
            isEdited: result.isEdited,
            editedAt: result.editedAt,
            friend: userData.username
          });
        }

        callback({ success: true });
      } catch (err) {
        console.error('DM mesajı düzenleme hatası:', err);
        callback({ success: false, message: err.message || 'DM mesajı düzenlenirken hata oluştu.' });
      }
    });

    // DM mesajı silme olayı
    socket.on('deleteDMMessage', async (data, callback) => {
      try {
        const { messageId, friendUsername } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Mesajı sil
        const result = await messageManager.deleteDMMessage(messageId, userDoc._id);

        // Gönderene ve alıcıya silme işlemini bildir
        socket.emit('dmMessageDeleted', {
          messageId: result.messageId,
          isDeleted: result.isDeleted,
          deletedAt: result.deletedAt,
          friend: friendUsername
        });

        // Alıcı çevrimiçiyse ona da bildir
        const targetSocketId = Object.keys(users).find(id => users[id].username === friendUsername);
        if (targetSocketId) {
          io.to(targetSocketId).emit('dmMessageDeleted', {
            messageId: result.messageId,
            isDeleted: result.isDeleted,
            deletedAt: result.deletedAt,
            friend: userData.username
          });
        }

        callback({ success: true });
      } catch (err) {
        console.error('DM mesajı silme hatası:', err);
        callback({ success: false, message: err.message || 'DM mesajı silinirken hata oluştu.' });
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
      } catch (err) {
        console.error('Profil güncelleme hatası:', err);
        callback({ success: false, message: err.message || 'Profil güncellenirken hata oluştu.' });
      }
    });

    // ===== YENİ ÖZELLİKLER =====

    // ----- Şifre Sıfırlama -----
    socket.on('forgotPassword', async (data, callback) => {
      try {
        const { email } = data;
        const result = await passwordReset.createPasswordResetRequest(email);
        callback(result);
      } catch (err) {
        console.error('Şifre sıfırlama isteği hatası:', err);
        callback({ success: false, message: err.message || 'Şifre sıfırlama isteği oluşturulurken hata oluştu.' });
      }
    });

    socket.on('resetPassword', async (data, callback) => {
      try {
        const { token, newPassword } = data;
        const result = await passwordReset.resetPassword(token, newPassword);
        callback(result);
      } catch (err) {
        console.error('Şifre sıfırlama hatası:', err);
        callback({ success: false, message: err.message || 'Şifre sıfırlanırken hata oluştu.' });
      }
    });

    // ----- E-posta Doğrulama -----
    socket.on('sendVerificationEmail', async (data, callback) => {
      try {
        const userData = users[socket.id];
        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const result = await emailVerification.sendVerificationEmail(userDoc._id);
        callback(result);
      } catch (err) {
        console.error('Doğrulama e-postası gönderme hatası:', err);
        callback({ success: false, message: err.message || 'Doğrulama e-postası gönderilirken hata oluştu.' });
      }
    });

    socket.on('verifyEmail', async (data, callback) => {
      try {
        const { token } = data;
        const result = await emailVerification.verifyEmail(token);
        callback(result);
      } catch (err) {
        console.error('E-posta doğrulama hatası:', err);
        callback({ success: false, message: err.message || 'E-posta doğrulanırken hata oluştu.' });
      }
    });

    // ----- İki Faktörlü Kimlik Doğrulama -----
    socket.on('setupTwoFactor', async (data, callback) => {
      try {
        const userData = users[socket.id];
        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const result = await twoFactorAuth.setupTwoFactor(userDoc._id);
        callback(result);
      } catch (err) {
        console.error('2FA kurulum hatası:', err);
        callback({ success: false, message: err.message || '2FA kurulumu sırasında hata oluştu.' });
      }
    });

    socket.on('verifyAndEnableTwoFactor', async (data, callback) => {
      try {
        const { token } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const result = await twoFactorAuth.verifyAndEnableTwoFactor(userDoc._id, token);
        callback(result);
      } catch (err) {
        console.error('2FA doğrulama hatası:', err);
        callback({ success: false, message: err.message || '2FA doğrulanırken hata oluştu.' });
      }
    });

    socket.on('verifyTwoFactorLogin', async (data, callback) => {
      try {
        const { userId, token } = data;
        const result = await twoFactorAuth.verifyLogin(userId, token);
        callback(result);
      } catch (err) {
        console.error('2FA giriş doğrulama hatası:', err);
        callback({ success: false, message: err.message || '2FA giriş doğrulaması sırasında hata oluştu.' });
      }
    });

    socket.on('disableTwoFactor', async (data, callback) => {
      try {
        const { token } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const result = await twoFactorAuth.disableTwoFactor(userDoc._id, token);
        callback(result);
      } catch (err) {
        console.error('2FA devre dışı bırakma hatası:', err);
        callback({ success: false, message: err.message || '2FA devre dışı bırakılırken hata oluştu.' });
      }
    });

    // ----- Rol Yönetimi -----
    socket.on('createRole', async (data, callback) => {
      try {
        const { groupId, name, permissions, color, position } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        // İzin kontrolü
        const hasPermission = await roleManager.checkPermission(userData.username, groupId, 'manageRoles');
        if (!hasPermission) {
          return callback({ success: false, message: 'Bu işlem için yetkiniz yok.' });
        }

        const result = await roleManager.createRole(groupId, name, permissions, color, position);
        callback({ success: true, role: result });
      } catch (err) {
        console.error('Rol oluşturma hatası:', err);
        callback({ success: false, message: err.message || 'Rol oluşturulurken hata oluştu.' });
      }
    });

    socket.on('assignRole', async (data, callback) => {
      try {
        const { groupId, username, roleId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        // İzin kontrolü
        const hasPermission = await roleManager.checkPermission(userData.username, groupId, 'manageRoles');
        if (!hasPermission) {
          return callback({ success: false, message: 'Bu işlem için yetkiniz yok.' });
        }

        const result = await roleManager.assignRoleToUser(groupId, username, roleId);
        callback(result);
      } catch (err) {
        console.error('Rol atama hatası:', err);
        callback({ success: false, message: err.message || 'Rol atanırken hata oluştu.' });
      }
    });

    // ----- Mesaj Tepkileri -----
    socket.on('addReaction', async (data, callback) => {
      try {
        const { messageId, emoji } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const result = await messageInteractions.addReaction(messageId, emoji, userData.username);

        // Tepkiyi kanaldaki herkese bildir
        const message = await Message.findById(messageId).populate('channel');
        if (message && message.channel) {
          const channel = await Channel.findById(message.channel);
          if (channel) {
            io.to(channel.channelId).emit('messageReactionAdded', result);
          }
        }

        callback({ success: true, reaction: result });
      } catch (err) {
        console.error('Tepki ekleme hatası:', err);
        callback({ success: false, message: err.message || 'Tepki eklenirken hata oluştu.' });
      }
    });

    socket.on('removeReaction', async (data, callback) => {
      try {
        const { messageId, emoji } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const result = await messageInteractions.removeReaction(messageId, emoji, userData.username);

        // Tepki kaldırmayı kanaldaki herkese bildir
        const message = await Message.findById(messageId).populate('channel');
        if (message && message.channel) {
          const channel = await Channel.findById(message.channel);
          if (channel) {
            io.to(channel.channelId).emit('messageReactionRemoved', result);
          }
        }

        callback({ success: true, reaction: result });
      } catch (err) {
        console.error('Tepki kaldırma hatası:', err);
        callback({ success: false, message: err.message || 'Tepki kaldırılırken hata oluştu.' });
      }
    });

    // ----- Mesaj Sabitleme -----
    socket.on('pinMessage', async (data, callback) => {
      try {
        const { messageId, groupId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const result = await messageInteractions.pinMessage(messageId, userData.username, groupId);

        // Sabitlemeyi kanaldaki herkese bildir
        const message = await Message.findById(messageId).populate('channel');
        if (message && message.channel) {
          const channel = await Channel.findById(message.channel);
          if (channel) {
            io.to(channel.channelId).emit('messagePinned', {
              messageId,
              pinnedBy: userData.username,
              pinnedAt: result.pinnedAt
            });
          }
        }

        callback({ success: true });
      } catch (err) {
        console.error('Mesaj sabitleme hatası:', err);
        callback({ success: false, message: err.message || 'Mesaj sabitlenirken hata oluştu.' });
      }
    });

    // ----- Mesaj Alıntılama -----
    socket.on('quoteMessage', async (data, callback) => {
      try {
        const { messageId, content, channelId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const result = await messageInteractions.quoteMessage(messageId, content, userData.username, channelId);

        // Yeni mesajı kanaldaki herkese bildir
        const channel = await Channel.findOne({ channelId });
        if (channel) {
          io.to(channelId).emit('newMessage', result);
        }

        callback({ success: true, message: result });
      } catch (err) {
        console.error('Mesaj alıntılama hatası:', err);
        callback({ success: false, message: err.message || 'Mesaj alıntılanırken hata oluştu.' });
      }
    });

    // ----- Medya İşleme -----
    socket.on('getFileInfo', async (data, callback) => {
      try {
        const { fileId } = data;
        const fileInfo = await mediaProcessor.getFileInfo(fileId);
        callback({ success: true, fileInfo });
      } catch (err) {
        console.error('Dosya bilgisi getirme hatası:', err);
        callback({ success: false, message: err.message || 'Dosya bilgisi alınırken hata oluştu.' });
      }
    });

    socket.on('generatePreview', async (data, callback) => {
      try {
        const { fileId } = data;
        const preview = await mediaProcessor.generatePreviewHtml(fileId);
        callback({ success: true, preview });
      } catch (err) {
        console.error('Önizleme oluşturma hatası:', err);
        callback({ success: false, message: err.message || 'Önizleme oluşturulurken hata oluştu.' });
      }
    });

    // ----- Kategori Yönetimi -----
    socket.on('createCategory', async (data, callback) => {
      try {
        const { groupId, name, position } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        // İzin kontrolü
        const hasPermission = await roleManager.checkPermission(userData.username, groupId, 'manageChannels');
        if (!hasPermission) {
          return callback({ success: false, message: 'Bu işlem için yetkiniz yok.' });
        }

        const result = await categoryManager.createCategory(groupId, name, position);
        callback({ success: true, category: result });
      } catch (err) {
        console.error('Kategori oluşturma hatası:', err);
        callback({ success: false, message: err.message || 'Kategori oluşturulurken hata oluştu.' });
      }
    });

    socket.on('moveChannelToCategory', async (data, callback) => {
      try {
        const { channelId, categoryId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const channel = await Channel.findOne({ channelId });
        if (!channel) {
          return callback({ success: false, message: 'Kanal bulunamadı.' });
        }

        const group = await Group.findById(channel.group);
        if (!group) {
          return callback({ success: false, message: 'Grup bulunamadı.' });
        }

        // İzin kontrolü
        const hasPermission = await roleManager.checkPermission(userData.username, group.groupId, 'manageChannels');
        if (!hasPermission) {
          return callback({ success: false, message: 'Bu işlem için yetkiniz yok.' });
        }

        const result = await categoryManager.moveChannelToCategory(channelId, categoryId);
        callback(result);
      } catch (err) {
        console.error('Kanal taşıma hatası:', err);
        callback({ success: false, message: err.message || 'Kanal taşınırken hata oluştu.' });
      }
    });

    // ----- Kanal Arşivleme -----
    socket.on('archiveChannel', async (data, callback) => {
      try {
        const { channelId, groupId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const result = await archiveManager.archiveChannel(channelId, userData.username, groupId);
        callback(result);
      } catch (err) {
        console.error('Kanal arşivleme hatası:', err);
        callback({ success: false, message: err.message || 'Kanal arşivlenirken hata oluştu.' });
      }
    });

    socket.on('unarchiveChannel', async (data, callback) => {
      try {
        const { channelId, groupId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const result = await archiveManager.unarchiveChannel(channelId, userData.username, groupId);
        callback(result);
      } catch (err) {
        console.error('Kanal arşivden çıkarma hatası:', err);
        callback({ success: false, message: err.message || 'Kanal arşivden çıkarılırken hata oluştu.' });
      }
    });

    // Mediasoup SFU olayları
    socket.on('getRouterRtpCapabilities', async ({ groupId, roomId }, callback) => {
      try {
        if (!groups[groupId] || !groups[groupId].rooms[roomId]) {
          return callback({ error: "Grup veya oda bulunamadı" });
        }

        // Router'ı al veya oluştur
        let router = await sfu.getRouter(`${groupId}::${roomId}`);
        if (!router) {
          router = await sfu.createRouter(`${groupId}::${roomId}`);
        }

        callback(router.rtpCapabilities);
      } catch (err) {
        console.error("getRouterRtpCapabilities error:", err);
        callback({ error: err.message });
      }
    });

    // ----- Bildirim Sistemi -----
    socket.on('savePushSubscription', async (data, callback) => {
      try {
        const userData = users[socket.id];
        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const result = await notificationManager.savePushSubscription(userDoc._id, data.subscription);
        callback(result);
      } catch (err) {
        console.error('Push aboneliği kaydetme hatası:', err);
        callback({ success: false, message: err.message || 'Push aboneliği kaydedilirken hata oluştu.' });
      }
    });

    socket.on('getNotificationSettings', async (callback) => {
      try {
        const userData = users[socket.id];
        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Bildirim ayarlarını döndür
        callback({
          success: true,
          settings: {
            notifications: userDoc.preferences?.notifications,
            emailNotifications: userDoc.preferences?.emailNotifications,
            soundEffects: userDoc.preferences?.soundEffects,
            notificationTypes: userDoc.preferences?.notificationTypes || {}
          }
        });
      } catch (err) {
        console.error('Bildirim ayarları getirme hatası:', err);
        callback({ success: false, message: err.message || 'Bildirim ayarları alınırken hata oluştu.' });
      }
    });

    socket.on('updateNotificationSettings', async (settings, callback) => {
      try {
        const userData = users[socket.id];
        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Bildirim ayarlarını güncelle
        if (!userDoc.preferences) {
          userDoc.preferences = {};
        }

        userDoc.preferences.notifications = settings.notifications;
        userDoc.preferences.emailNotifications = settings.emailNotifications;
        userDoc.preferences.soundEffects = settings.soundEffects;

        if (settings.notificationTypes) {
          userDoc.preferences.notificationTypes = {
            directMessages: settings.notificationTypes.directMessages,
            mentions: settings.notificationTypes.mentions,
            friendRequests: settings.notificationTypes.friendRequests,
            groupInvites: settings.notificationTypes.groupInvites,
            channelMessages: settings.notificationTypes.channelMessages
          };
        }

        await userDoc.save();

        callback({ success: true, message: 'Bildirim ayarları güncellendi.' });
      } catch (err) {
        console.error('Bildirim ayarları güncelleme hatası:', err);
        callback({ success: false, message: err.message || 'Bildirim ayarları güncellenirken hata oluştu.' });
      }
    });

    // ----- Yazıyor Göstergesi -----
    socket.on('typing', (data) => {
      const { channelId, username } = data;

      // Kanaldaki diğer kullanıcılara bildir
      socket.to(channelId).emit('userTyping', { channelId, username });
    });

    socket.on('stoppedTyping', (data) => {
      const { channelId, username } = data;

      // Kanaldaki diğer kullanıcılara bildir
      socket.to(channelId).emit('userStoppedTyping', { channelId, username });
    });

    socket.on('dmTyping', (data) => {
      const { username, friendUsername } = data;

      // Hedef kullanıcıya bildir
      const targetSocketId = Object.keys(users).find(id => users[id].username === friendUsername);
      if (targetSocketId) {
        io.to(targetSocketId).emit('dmUserTyping', { username });
      }
    });

    socket.on('dmStoppedTyping', (data) => {
      const { username, friendUsername } = data;

      // Hedef kullanıcıya bildir
      const targetSocketId = Object.keys(users).find(id => users[id].username === friendUsername);
      if (targetSocketId) {
        io.to(targetSocketId).emit('dmUserStoppedTyping', { username });
      }
    });

    // ----- Okundu Bilgisi -----
    socket.on('markMessageRead', async (data) => {
      try {
        const { messageId, channelId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return;
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return;
        }

        // Mesajı oku
        const message = await Message.findById(messageId);
        if (!message) {
          return;
        }

        // Mesajı gönderen kullanıcıya okundu bilgisini gönder
        const senderSocketId = Object.keys(users).find(id => {
          return users[id].username === message.user.username ||
                 (message.user._id && users[id].username === message.user._id.username);
        });

        if (senderSocketId) {
          io.to(senderSocketId).emit('messageRead', {
            messageId,
            readBy: userData.username,
            readAt: new Date()
          });
        }
      } catch (err) {
        console.error('Mesaj okundu işaretleme hatası:', err);
      }
    });

    socket.on('markDMMessageRead', async (data) => {
      try {
        const { messageId, friendUsername } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return;
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return;
        }

        // Mesajı oku
        const message = await DMMessage.findById(messageId);
        if (!message) {
          return;
        }

        // Mesajı gönderen kullanıcıya okundu bilgisini gönder
        const senderSocketId = Object.keys(users).find(id => {
          return users[id].username === friendUsername;
        });

        if (senderSocketId) {
          io.to(senderSocketId).emit('dmMessageRead', {
            messageId,
            readAt: new Date(),
            friend: userData.username
          });
        }
      } catch (err) {
        console.error('DM mesajı okundu işaretleme hatası:', err);
      }
    });

    // ----- Zamanlanmış Mesajlar -----
    socket.on('scheduleMessage', async (data, callback) => {
      try {
        const { content, channelId, scheduledTime } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const channelDoc = await Channel.findOne({ channelId });
        if (!channelDoc) {
          return callback({ success: false, message: 'Kanal bulunamadı.' });
        }

        // Zamanlanmış mesajı oluştur
        const scheduledMessage = new ScheduledMessage({
          user: userDoc._id,
          channel: channelDoc._id,
          content,
          scheduledTime: new Date(scheduledTime),
          type: 'channel'
        });

        await scheduledMessage.save();

        // Kullanıcıya bildirim gönder
        socket.emit('scheduledMessageCreated', {
          id: scheduledMessage._id,
          scheduledTime,
          type: 'channel'
        });

        callback({ success: true });
      } catch (err) {
        console.error('Mesaj zamanlama hatası:', err);
        callback({ success: false, message: err.message || 'Mesaj zamanlanırken hata oluştu.' });
      }
    });

    socket.on('scheduleDMMessage', async (data, callback) => {
      try {
        const { content, friendUsername, scheduledTime } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        const friendDoc = await User.findOne({ username: friendUsername });
        if (!friendDoc) {
          return callback({ success: false, message: 'Arkadaş bulunamadı.' });
        }

        // Zamanlanmış mesajı oluştur
        const scheduledMessage = new ScheduledMessage({
          user: userDoc._id,
          receiver: friendDoc._id,
          content,
          scheduledTime: new Date(scheduledTime),
          type: 'dm'
        });

        await scheduledMessage.save();

        // Kullanıcıya bildirim gönder
        socket.emit('scheduledMessageCreated', {
          id: scheduledMessage._id,
          scheduledTime,
          type: 'dm'
        });

        callback({ success: true });
      } catch (err) {
        console.error('DM mesajı zamanlama hatası:', err);
        callback({ success: false, message: err.message || 'DM mesajı zamanlanırken hata oluştu.' });
      }
    });

    // ----- Kullanıcı Profil Yönetimi -----
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
        }

        callback(result);
      } catch (err) {
        console.error('Kullanıcı adı değiştirme hatası:', err);
        callback({ success: false, message: err.message || 'Kullanıcı adı değiştirilirken hata oluştu.' });
      }
    });

    socket.on('updateUserStatus', async (data, callback) => {
      try {
        const { status, customStatus } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Kullanıcı durumunu güncelle
        const result = await profileManager.updateUserStatus(userDoc._id, status, customStatus);

        // Arkadaşlara durum güncellemesini bildir
        const friends = await User.find({ _id: { $in: userDoc.friends } });
        for (const friend of friends) {
          const friendSocketId = Object.keys(users).find(id => users[id].username === friend.username);
          if (friendSocketId) {
            io.to(friendSocketId).emit('friendStatusUpdated', {
              username: userData.username,
              status,
              customStatus
            });
          }
        }

        callback({ success: true, status, customStatus });
      } catch (err) {
        console.error('Kullanıcı durumu güncelleme hatası:', err);
        callback({ success: false, message: err.message || 'Kullanıcı durumu güncellenirken hata oluştu.' });
      }
    });

    // ----- Kullanıcı Engelleme -----
    socket.on('blockUser', async (data, callback) => {
      try {
        const { username } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        // Kullanıcıyı engelle
        const result = await userManager.blockUser(userData.username, username);

        // Engellenen kullanıcıya bildir
        const blockedSocketId = Object.keys(users).find(id => users[id].username === username);
        if (blockedSocketId) {
          io.to(blockedSocketId).emit('youWereBlocked', {
            username: userData.username
          });
        }

        callback({ success: true, username });
      } catch (err) {
        console.error('Kullanıcı engelleme hatası:', err);
        callback({ success: false, message: err.message || 'Kullanıcı engellenirken hata oluştu.' });
      }
    });

    socket.on('unblockUser', async (data, callback) => {
      try {
        const { username } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        // Kullanıcı engelini kaldır
        const result = await userManager.unblockUser(userData.username, username);

        callback({ success: true, username });
      } catch (err) {
        console.error('Kullanıcı engeli kaldırma hatası:', err);
        callback({ success: false, message: err.message || 'Kullanıcı engeli kaldırılırken hata oluştu.' });
      }
    });

    socket.on('getBlockedUsers', async (data, callback) => {
      try {
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        // Engellenen kullanıcıları getir
        const blockedUsers = await userManager.getUserBlocked(userData.username);

        callback({ success: true, blockedUsers });
      } catch (err) {
        console.error('Engellenen kullanıcıları getirme hatası:', err);
        callback({ success: false, message: err.message || 'Engellenen kullanıcılar getirilirken hata oluştu.' });
      }
    });

    // ----- Kullanıcı Raporlama -----
    socket.on('reportUser', async (data, callback) => {
      try {
        const { username, reason, description, messageId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // İlgili mesajları kontrol et
        let relatedMessageIds = [];
        let relatedDMMessageIds = [];

        if (messageId) {
          // Mesajın kanal mesajı mı yoksa DM mesajı mı olduğunu kontrol et
          const channelMessage = await Message.findById(messageId);
          if (channelMessage) {
            relatedMessageIds.push(messageId);
          } else {
            const dmMessage = await DMMessage.findById(messageId);
            if (dmMessage) {
              relatedDMMessageIds.push(messageId);
            }
          }
        }

        // Raporu oluştur
        const report = await reportManager.createUserReport(
          userDoc._id,
          username,
          reason,
          description,
          relatedMessageIds,
          relatedDMMessageIds
        );

        callback({ success: true, reportId: report._id });
      } catch (err) {
        console.error('Kullanıcı raporlama hatası:', err);
        callback({ success: false, message: err.message || 'Kullanıcı raporlanırken hata oluştu.' });
      }
    });

    socket.on('getMyReports', async (data, callback) => {
      try {
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Raporları getir
        const reports = await reportManager.getUserReports(userDoc._id);

        callback({ success: true, reports });
      } catch (err) {
        console.error('Raporları getirme hatası:', err);
        callback({ success: false, message: err.message || 'Raporlar getirilirken hata oluştu.' });
      }
    });

    // ----- Oturum Yönetimi -----
    socket.on('getUserSessions', async (data, callback) => {
      try {
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Aktif oturumları getir
        const sessions = await sessionManager.getUserActiveSessions(userDoc._id);

        callback({
          success: true,
          sessions,
          currentSessionId: socket.sessionId
        });
      } catch (err) {
        console.error('Oturumları getirme hatası:', err);
        callback({ success: false, message: err.message || 'Oturumlar getirilirken hata oluştu.' });
      }
    });

    socket.on('endSession', async (data, callback) => {
      try {
        const { sessionId } = data;
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Oturumu sonlandır
        const session = await sessionManager.endSession(sessionId);

        // Sonlandırılan oturumun socket'ini bul ve bağlantısını kes
        const targetSocketId = Object.keys(io.sockets.sockets).find(id => {
          return io.sockets.sockets[id].sessionId === sessionId;
        });

        if (targetSocketId) {
          io.sockets.sockets[targetSocketId].disconnect(true);
        }

        callback({ success: true });
      } catch (err) {
        console.error('Oturum sonlandırma hatası:', err);
        callback({ success: false, message: err.message || 'Oturum sonlandırılırken hata oluştu.' });
      }
    });

    socket.on('endAllOtherSessions', async (data, callback) => {
      try {
        const userData = users[socket.id];

        if (!userData || !userData.username) {
          return callback({ success: false, message: 'Kullanıcı oturumu bulunamadı.' });
        }

        const userDoc = await User.findOne({ username: userData.username });
        if (!userDoc) {
          return callback({ success: false, message: 'Kullanıcı bulunamadı.' });
        }

        // Diğer tüm oturumları sonlandır
        const count = await sessionManager.endAllOtherSessions(userDoc._id, socket.sessionId);

        // Sonlandırılan oturumların socket'lerini bul ve bağlantılarını kes
        Object.keys(io.sockets.sockets).forEach(id => {
          const s = io.sockets.sockets[id];
          if (s.sessionId && s.sessionId !== socket.sessionId && users[id]?.username === userData.username) {
            s.disconnect(true);
          }
        });

        callback({ success: true, count });
      } catch (err) {
        console.error('Tüm diğer oturumları sonlandırma hatası:', err);
        callback({ success: false, message: err.message || 'Oturumlar sonlandırılırken hata oluştu.' });
      }
    });

    // Bağlantı kesilme olayı
    socket.on("disconnect", async () => {
      console.log("disconnect:", socket.id);
      const userData = users[socket.id];
      if (userData) {
        const { username } = userData;
        if (username) {
          onlineUsernames.delete(username);
        }
      }

      // Oturumu sonlandır
      if (socket.sessionId) {
        try {
          await sessionManager.endSessionBySocketId(socket.id);
        } catch (err) {
          console.error('Oturum sonlandırma hatası:', err);
        }
      }

      userManager.removeUserFromAllGroupsAndRooms(socket, users, groups);
      delete users[socket.id];
    });
  });
};
