/**
 * modules/user/onlineManager.js
 * Çevrimiçi kullanıcı yönetimi
 */
const { 
  addToSetCache, 
  removeFromSetCache, 
  getSetCache,
  setHashCache,
  getHashCache,
  getAllHashCache,
  deleteCache,
  publish
} = require('../../config/redis');
const { logger } = require('../../utils/logger');

// Çevrimiçi kullanıcı anahtarı
const ONLINE_USERS_KEY = 'online:users';

// Kullanıcı durumu anahtarı
const USER_STATUS_KEY = 'user:status';

// Kullanıcı socket eşleştirme anahtarı
const USER_SOCKET_KEY = 'user:socket';

// Kullanıcı durumları
const USER_STATUSES = {
  ONLINE: 'online',
  AWAY: 'away',
  DND: 'dnd', // Do Not Disturb
  INVISIBLE: 'invisible',
  OFFLINE: 'offline'
};

// Kullanıcı durumu TTL (12 saat)
const USER_STATUS_TTL = 12 * 60 * 60;

/**
 * Kullanıcıyı çevrimiçi olarak işaretler
 * @param {string} username - Kullanıcı adı
 * @param {string} socketId - Socket ID'si
 * @param {string} [status=online] - Kullanıcı durumu
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function setUserOnline(username, socketId, status = USER_STATUSES.ONLINE) {
  try {
    // Kullanıcıyı çevrimiçi kullanıcılar setine ekle
    await addToSetCache(ONLINE_USERS_KEY, username);
    
    // Kullanıcı durumunu kaydet
    await setHashCache(USER_STATUS_KEY, username, {
      status,
      lastSeen: new Date().toISOString()
    }, USER_STATUS_TTL);
    
    // Kullanıcı-socket eşleştirmesini kaydet
    await setHashCache(USER_SOCKET_KEY, username, socketId, USER_STATUS_TTL);
    
    // Kullanıcı durumu değişikliğini yayınla
    await publish('user:status:change', {
      username,
      status,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Kullanıcı çevrimiçi olarak işaretlendi', { username, socketId, status });
    
    return true;
  } catch (error) {
    logger.error('Kullanıcı çevrimiçi işaretleme hatası', { error: error.message, username, socketId });
    return false;
  }
}

/**
 * Kullanıcıyı çevrimdışı olarak işaretler
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function setUserOffline(username) {
  try {
    // Kullanıcıyı çevrimiçi kullanıcılar setinden çıkar
    await removeFromSetCache(ONLINE_USERS_KEY, username);
    
    // Kullanıcı durumunu güncelle
    await setHashCache(USER_STATUS_KEY, username, {
      status: USER_STATUSES.OFFLINE,
      lastSeen: new Date().toISOString()
    }, USER_STATUS_TTL);
    
    // Kullanıcı-socket eşleştirmesini sil
    await deleteCache(`${USER_SOCKET_KEY}:${username}`);
    
    // Kullanıcı durumu değişikliğini yayınla
    await publish('user:status:change', {
      username,
      status: USER_STATUSES.OFFLINE,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Kullanıcı çevrimdışı olarak işaretlendi', { username });
    
    return true;
  } catch (error) {
    logger.error('Kullanıcı çevrimdışı işaretleme hatası', { error: error.message, username });
    return false;
  }
}

/**
 * Kullanıcı durumunu günceller
 * @param {string} username - Kullanıcı adı
 * @param {string} status - Kullanıcı durumu
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function updateUserStatus(username, status) {
  try {
    // Geçerli durum kontrolü
    if (!Object.values(USER_STATUSES).includes(status)) {
      logger.warn('Geçersiz kullanıcı durumu', { username, status });
      return false;
    }
    
    // Kullanıcı durumunu güncelle
    await setHashCache(USER_STATUS_KEY, username, {
      status,
      lastSeen: new Date().toISOString()
    }, USER_STATUS_TTL);
    
    // Kullanıcı görünmez ise çevrimiçi listesinden çıkar
    if (status === USER_STATUSES.INVISIBLE) {
      await removeFromSetCache(ONLINE_USERS_KEY, username);
    } else if (status !== USER_STATUSES.OFFLINE) {
      // Çevrimdışı değilse çevrimiçi listesine ekle
      await addToSetCache(ONLINE_USERS_KEY, username);
    }
    
    // Kullanıcı durumu değişikliğini yayınla
    await publish('user:status:change', {
      username,
      status,
      timestamp: new Date().toISOString()
    });
    
    logger.debug('Kullanıcı durumu güncellendi', { username, status });
    
    return true;
  } catch (error) {
    logger.error('Kullanıcı durumu güncelleme hatası', { error: error.message, username, status });
    return false;
  }
}

/**
 * Kullanıcı durumunu getirir
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Object>} - Kullanıcı durumu
 */
async function getUserStatus(username) {
  try {
    // Kullanıcı durumunu getir
    const status = await getHashCache(USER_STATUS_KEY, username);
    
    if (!status) {
      return {
        status: USER_STATUSES.OFFLINE,
        lastSeen: null
      };
    }
    
    return status;
  } catch (error) {
    logger.error('Kullanıcı durumu getirme hatası', { error: error.message, username });
    return {
      status: USER_STATUSES.OFFLINE,
      lastSeen: null
    };
  }
}

/**
 * Çevrimiçi kullanıcıları getirir
 * @returns {Promise<Array>} - Çevrimiçi kullanıcı adları
 */
async function getOnlineUsers() {
  try {
    // Çevrimiçi kullanıcıları getir
    return await getSetCache(ONLINE_USERS_KEY);
  } catch (error) {
    logger.error('Çevrimiçi kullanıcıları getirme hatası', { error: error.message });
    return [];
  }
}

/**
 * Kullanıcının socket ID'sini getirir
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<string|null>} - Socket ID'si
 */
async function getUserSocketId(username) {
  try {
    // Kullanıcı socket ID'sini getir
    return await getHashCache(USER_SOCKET_KEY, username);
  } catch (error) {
    logger.error('Kullanıcı socket ID getirme hatası', { error: error.message, username });
    return null;
  }
}

/**
 * Socket ID'sine göre kullanıcı adını getirir
 * @param {string} socketId - Socket ID'si
 * @returns {Promise<string|null>} - Kullanıcı adı
 */
async function getUsernameBySocketId(socketId) {
  try {
    // Tüm kullanıcı-socket eşleştirmelerini getir
    const allUserSockets = await getAllHashCache(USER_SOCKET_KEY);
    
    // Socket ID'sine göre kullanıcı adını bul
    for (const [username, id] of Object.entries(allUserSockets)) {
      if (id === socketId) {
        return username;
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Socket ID\'ye göre kullanıcı adı getirme hatası', { error: error.message, socketId });
    return null;
  }
}

/**
 * Arkadaş listesindeki çevrimiçi kullanıcıları getirir
 * @param {Array} friendUsernames - Arkadaş kullanıcı adları
 * @returns {Promise<Array>} - Çevrimiçi arkadaşlar
 */
async function getOnlineFriends(friendUsernames) {
  try {
    // Çevrimiçi kullanıcıları getir
    const onlineUsers = await getSetCache(ONLINE_USERS_KEY);
    
    // Arkadaş listesindeki çevrimiçi kullanıcıları filtrele
    return friendUsernames.filter(username => onlineUsers.includes(username));
  } catch (error) {
    logger.error('Çevrimiçi arkadaşları getirme hatası', { error: error.message });
    return [];
  }
}

module.exports = {
  USER_STATUSES,
  setUserOnline,
  setUserOffline,
  updateUserStatus,
  getUserStatus,
  getOnlineUsers,
  getUserSocketId,
  getUsernameBySocketId,
  getOnlineFriends
};
