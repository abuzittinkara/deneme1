// modules/notificationManager.js
const webpush = require('web-push');
const User = require('../models/User');

// VAPID anahtarlarını ayarla (gerçek uygulamada .env dosyasından alınmalı)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
  privateKey: process.env.VAPID_PRIVATE_KEY || 'UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTWKSbtM'
};

webpush.setVapidDetails(
  'mailto:info@fisqos.com.tr',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

/**
 * Kullanıcının push aboneliğini kaydeder
 * @param {string} userId - Kullanıcı ID'si
 * @param {Object} subscription - Push abonelik nesnesi
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function savePushSubscription(userId, subscription) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }
    
    user.pushSubscription = subscription;
    await user.save();
    
    return { success: true, message: 'Bildirim aboneliği kaydedildi' };
  } catch (error) {
    console.error('Push aboneliği kaydetme hatası:', error);
    throw error;
  }
}

/**
 * Kullanıcıya push bildirimi gönderir
 * @param {string} userId - Kullanıcı ID'si
 * @param {Object} notification - Bildirim içeriği
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendPushNotification(userId, notification) {
  try {
    const user = await User.findById(userId);
    if (!user || !user.pushSubscription) {
      return { success: false, message: 'Kullanıcı bildirim aboneliği bulunamadı' };
    }
    
    // Kullanıcı bildirim tercihini kontrol et
    if (user.preferences && user.preferences.notifications === false) {
      return { success: false, message: 'Kullanıcı bildirimleri devre dışı bırakmış' };
    }
    
    const payload = JSON.stringify({
      title: notification.title || 'Fisqos',
      body: notification.body,
      icon: notification.icon || '/images/logo.png',
      badge: notification.badge || '/images/badge.png',
      data: notification.data || {}
    });
    
    await webpush.sendNotification(user.pushSubscription, payload);
    return { success: true, message: 'Bildirim gönderildi' };
  } catch (error) {
    console.error('Push bildirimi gönderme hatası:', error);
    
    // Abonelik süresi dolmuşsa veya geçersizse, aboneliği kaldır
    if (error.statusCode === 404 || error.statusCode === 410) {
      try {
        await User.updateOne({ _id: userId }, { $unset: { pushSubscription: 1 } });
      } catch (err) {
        console.error('Abonelik kaldırma hatası:', err);
      }
    }
    
    throw error;
  }
}

/**
 * Birden çok kullanıcıya bildirim gönderir
 * @param {Array<string>} userIds - Kullanıcı ID'leri
 * @param {Object} notification - Bildirim içeriği
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendBulkNotifications(userIds, notification) {
  const results = {
    success: 0,
    failed: 0,
    errors: []
  };
  
  for (const userId of userIds) {
    try {
      const result = await sendPushNotification(userId, notification);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({ userId, message: result.message });
      }
    } catch (error) {
      results.failed++;
      results.errors.push({ userId, message: error.message });
    }
  }
  
  return results;
}

/**
 * Yeni mesaj bildirimi gönderir
 * @param {string} receiverId - Alıcı kullanıcı ID'si
 * @param {string} senderName - Gönderen kullanıcı adı
 * @param {string} messagePreview - Mesaj önizlemesi
 * @param {string} channelName - Kanal adı (opsiyonel, DM için null)
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendNewMessageNotification(receiverId, senderName, messagePreview, channelName = null) {
  const title = channelName 
    ? `${channelName} kanalında yeni mesaj` 
    : `${senderName} size mesaj gönderdi`;
  
  const body = messagePreview.length > 100 
    ? messagePreview.substring(0, 97) + '...' 
    : messagePreview;
  
  return sendPushNotification(receiverId, {
    title,
    body,
    data: {
      type: 'new_message',
      sender: senderName,
      channel: channelName
    }
  });
}

/**
 * Arkadaşlık isteği bildirimi gönderir
 * @param {string} receiverId - Alıcı kullanıcı ID'si
 * @param {string} senderName - Gönderen kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendFriendRequestNotification(receiverId, senderName) {
  return sendPushNotification(receiverId, {
    title: 'Yeni Arkadaşlık İsteği',
    body: `${senderName} size arkadaşlık isteği gönderdi`,
    data: {
      type: 'friend_request',
      sender: senderName
    }
  });
}

/**
 * Grup daveti bildirimi gönderir
 * @param {string} receiverId - Alıcı kullanıcı ID'si
 * @param {string} senderName - Davet eden kullanıcı adı
 * @param {string} groupName - Grup adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendGroupInviteNotification(receiverId, senderName, groupName) {
  return sendPushNotification(receiverId, {
    title: 'Grup Daveti',
    body: `${senderName} sizi "${groupName}" grubuna davet etti`,
    data: {
      type: 'group_invite',
      sender: senderName,
      group: groupName
    }
  });
}

module.exports = {
  vapidKeys,
  savePushSubscription,
  sendPushNotification,
  sendBulkNotifications,
  sendNewMessageNotification,
  sendFriendRequestNotification,
  sendGroupInviteNotification
};
