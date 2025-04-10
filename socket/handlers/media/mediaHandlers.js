/**************************************
 * socket/handlers/media/mediaHandlers.js
 * Medya ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Medya socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerMediaHandlers(socket, io, deps) {
  const { 
    users, 
    mediaManager
  } = deps;

  // Dosya yükleme olayı
  socket.on('uploadFile', async (data, callback) => {
    try {
      const { file, metadata } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Dosya boyutu kontrolü
      const maxFileSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxFileSize) {
        return callback({ success: false, message: "Dosya boyutu çok büyük. Maksimum 50MB yükleyebilirsiniz." });
      }
      
      // Dosya türü kontrolü
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'video/mp4', 'application/pdf', 'text/plain'];
      if (!allowedTypes.includes(file.type)) {
        return callback({ success: false, message: "Bu dosya türü desteklenmiyor." });
      }
      
      // Dosyayı kaydet
      const result = await mediaManager.saveFile(file, userData.username, metadata);
      
      callback(result);
      
      logger.info('Dosya yüklendi', { 
        username: userData.username, 
        fileId: result.fileId,
        fileType: file.type,
        fileSize: file.size
      });
    } catch (err) {
      handleSocketError(err, "Dosya yükleme hatası", socket, callback);
    }
  });

  // Dosya silme olayı
  socket.on('deleteFile', async (data, callback) => {
    try {
      const { fileId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Dosyayı sil
      const result = await mediaManager.deleteFile(fileId, userData.username);
      
      callback(result);
      
      logger.info('Dosya silindi', { 
        username: userData.username, 
        fileId
      });
    } catch (err) {
      handleSocketError(err, "Dosya silme hatası", socket, callback);
    }
  });

  // Kullanıcı dosyalarını getirme olayı
  socket.on('getUserFiles', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Kullanıcı dosyalarını getir
      const files = await mediaManager.getUserFiles(userData.username);
      
      callback({ success: true, files });
      
      logger.debug('Kullanıcı dosyaları getirildi', { 
        username: userData.username,
        count: files.length
      });
    } catch (err) {
      handleSocketError(err, "Kullanıcı dosyaları getirme hatası", socket, callback);
    }
  });

  // Dosya önizleme oluşturma olayı
  socket.on('generateThumbnail', async (data, callback) => {
    try {
      const { fileId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Önizleme oluştur
      const result = await mediaManager.generateThumbnail(fileId);
      
      callback(result);
      
      logger.debug('Dosya önizlemesi oluşturuldu', { 
        fileId
      });
    } catch (err) {
      handleSocketError(err, "Dosya önizleme oluşturma hatası", socket, callback);
    }
  });

  // Dosya indirme bağlantısı oluşturma olayı
  socket.on('getDownloadLink', async (data, callback) => {
    try {
      const { fileId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // İndirme bağlantısı oluştur
      const result = await mediaManager.getDownloadLink(fileId);
      
      callback(result);
      
      logger.debug('Dosya indirme bağlantısı oluşturuldu', { 
        fileId
      });
    } catch (err) {
      handleSocketError(err, "Dosya indirme bağlantısı oluşturma hatası", socket, callback);
    }
  });
}

module.exports = registerMediaHandlers;
