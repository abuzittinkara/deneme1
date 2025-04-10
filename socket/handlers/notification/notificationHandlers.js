/**************************************
 * socket/handlers/notification/notificationHandlers.js
 * Bildirim ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Bildirim socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerNotificationHandlers(socket, io, deps) {
  const { 
    users, 
    notificationManager
  } = deps;

  // Bildirimleri getirme olayı
  socket.on('getNotifications', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Bildirimleri getir
      const notifications = await notificationManager.getUserNotifications(userData.username);
      
      callback({ success: true, notifications });
      
      logger.debug('Bildirimler getirildi', { 
        username: userData.username,
        count: notifications.length
      });
    } catch (err) {
      handleSocketError(err, "Bildirim getirme hatası", socket, callback);
    }
  });

  // Bildirimi okundu olarak işaretleme olayı
  socket.on('markNotificationAsRead', async (data, callback) => {
    try {
      const { notificationId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Bildirimi okundu olarak işaretle
      const result = await notificationManager.markNotificationAsRead(notificationId, userData.username);
      
      callback(result);
      
      logger.debug('Bildirim okundu olarak işaretlendi', { 
        notificationId,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Bildirim işaretleme hatası", socket, callback);
    }
  });

  // Tüm bildirimleri okundu olarak işaretleme olayı
  socket.on('markAllNotificationsAsRead', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Tüm bildirimleri okundu olarak işaretle
      const result = await notificationManager.markAllNotificationsAsRead(userData.username);
      
      callback(result);
      
      logger.debug('Tüm bildirimler okundu olarak işaretlendi', { 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Tüm bildirimleri işaretleme hatası", socket, callback);
    }
  });

  // Bildirim silme olayı
  socket.on('deleteNotification', async (data, callback) => {
    try {
      const { notificationId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Bildirimi sil
      const result = await notificationManager.deleteNotification(notificationId, userData.username);
      
      callback(result);
      
      logger.debug('Bildirim silindi', { 
        notificationId,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Bildirim silme hatası", socket, callback);
    }
  });

  // Tüm bildirimleri silme olayı
  socket.on('deleteAllNotifications', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Tüm bildirimleri sil
      const result = await notificationManager.deleteAllNotifications(userData.username);
      
      callback(result);
      
      logger.debug('Tüm bildirimler silindi', { 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Tüm bildirimleri silme hatası", socket, callback);
    }
  });

  // Bildirim ayarlarını getirme olayı
  socket.on('getNotificationSettings', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Bildirim ayarlarını getir
      const settings = await notificationManager.getNotificationSettings(userData.username);
      
      callback({ success: true, settings });
      
      logger.debug('Bildirim ayarları getirildi', { 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Bildirim ayarları getirme hatası", socket, callback);
    }
  });

  // Bildirim ayarlarını güncelleme olayı
  socket.on('updateNotificationSettings', async (data, callback) => {
    try {
      const { settings } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Bildirim ayarlarını güncelle
      const result = await notificationManager.updateNotificationSettings(userData.username, settings);
      
      callback(result);
      
      logger.info('Bildirim ayarları güncellendi', { 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Bildirim ayarları güncelleme hatası", socket, callback);
    }
  });

  // Push bildirim aboneliği ekleme olayı
  socket.on('subscribePushNotifications', async (data, callback) => {
    try {
      const { subscription } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Push bildirim aboneliği ekle
      const result = await notificationManager.subscribePushNotifications(userData.username, subscription);
      
      callback(result);
      
      logger.info('Push bildirim aboneliği eklendi', { 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Push bildirim aboneliği ekleme hatası", socket, callback);
    }
  });

  // Push bildirim aboneliğini kaldırma olayı
  socket.on('unsubscribePushNotifications', async (callback) => {
    try {
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Push bildirim aboneliğini kaldır
      const result = await notificationManager.unsubscribePushNotifications(userData.username);
      
      callback(result);
      
      logger.info('Push bildirim aboneliği kaldırıldı', { 
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Push bildirim aboneliği kaldırma hatası", socket, callback);
    }
  });
}

module.exports = registerNotificationHandlers;
