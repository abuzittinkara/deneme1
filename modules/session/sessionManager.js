/**
 * modules/session/sessionManager.js
 * Oturum yönetimi işlemleri
 */
const Session = require('../../models/Session');
const { redisClient, setHashCache, getAllHashCache, deleteCache } = require('../../config/redis');
const { logger } = require('../../utils/logger');

// Oturum TTL (24 saat)
const SESSION_TTL = 24 * 60 * 60;

/**
 * Yeni oturum oluşturur
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} socketId - Socket ID'si
 * @param {string} userAgent - Kullanıcı tarayıcı bilgisi
 * @param {string} ipAddress - IP adresi
 * @returns {Promise<Object>} - Oluşturulan oturum
 */
async function createSession(userId, socketId, userAgent, ipAddress) {
  try {
    // Veritabanında oturum oluştur
    const session = new Session({
      user: userId,
      socketId,
      userAgent,
      ipAddress,
      lastActivity: new Date()
    });
    
    await session.save();
    
    // Redis'e oturum bilgilerini kaydet
    const sessionData = {
      _id: session._id.toString(),
      user: userId,
      socketId,
      userAgent,
      ipAddress,
      lastActivity: new Date().toISOString(),
      createdAt: session.createdAt.toISOString()
    };
    
    // Socket ID'si ile oturum eşleştirmesi
    await setHashCache('sessions:socket', socketId, session._id.toString(), SESSION_TTL);
    
    // Kullanıcı ID'si ile oturum eşleştirmesi
    await setHashCache('sessions:user', userId, {
      sessionId: session._id.toString(),
      socketId
    }, SESSION_TTL);
    
    // Oturum detayları
    await setHashCache('sessions:details', session._id.toString(), sessionData, SESSION_TTL);
    
    logger.info('Oturum oluşturuldu', { userId, socketId, sessionId: session._id });
    
    return session;
  } catch (error) {
    logger.error('Oturum oluşturma hatası', { error: error.message, userId, socketId });
    throw error;
  }
}

/**
 * Socket ID'sine göre oturumu sonlandırır
 * @param {string} socketId - Socket ID'si
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function endSessionBySocketId(socketId) {
  try {
    // Redis'ten oturum ID'sini al
    const sessionId = await getAllHashCache('sessions:socket', socketId);
    
    if (!sessionId) {
      logger.warn('Sonlandırılacak oturum bulunamadı', { socketId });
      return false;
    }
    
    // Oturum detaylarını al
    const sessionDetails = await getAllHashCache('sessions:details', sessionId);
    
    if (!sessionDetails) {
      logger.warn('Oturum detayları bulunamadı', { socketId, sessionId });
      return false;
    }
    
    // Veritabanında oturumu güncelle
    await Session.findByIdAndUpdate(sessionId, {
      isActive: false,
      endedAt: new Date()
    });
    
    // Redis'ten oturum bilgilerini sil
    await deleteCache(`sessions:socket:${socketId}`);
    await deleteCache(`sessions:user:${sessionDetails.user}`);
    await deleteCache(`sessions:details:${sessionId}`);
    
    logger.info('Oturum sonlandırıldı', { socketId, sessionId });
    
    return true;
  } catch (error) {
    logger.error('Oturum sonlandırma hatası', { error: error.message, socketId });
    return false;
  }
}

/**
 * Kullanıcı ID'sine göre aktif oturumları getirir
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Array>} - Aktif oturumlar
 */
async function getUserActiveSessions(userId) {
  try {
    // Veritabanından aktif oturumları getir
    const sessions = await Session.find({
      user: userId,
      isActive: true
    }).sort({ createdAt: -1 });
    
    logger.debug('Kullanıcı aktif oturumları getirildi', { userId, count: sessions.length });
    
    return sessions;
  } catch (error) {
    logger.error('Kullanıcı oturumları getirme hatası', { error: error.message, userId });
    throw error;
  }
}

/**
 * Oturum aktivitesini günceller
 * @param {string} sessionId - Oturum ID'si
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function updateSessionActivity(sessionId) {
  try {
    // Veritabanında oturumu güncelle
    await Session.findByIdAndUpdate(sessionId, {
      lastActivity: new Date()
    });
    
    // Redis'te oturum detaylarını güncelle
    const sessionDetails = await getAllHashCache('sessions:details', sessionId);
    
    if (sessionDetails) {
      sessionDetails.lastActivity = new Date().toISOString();
      await setHashCache('sessions:details', sessionId, sessionDetails, SESSION_TTL);
    }
    
    return true;
  } catch (error) {
    logger.error('Oturum aktivitesi güncelleme hatası', { error: error.message, sessionId });
    return false;
  }
}

/**
 * Oturum ID'sine göre oturumu sonlandırır
 * @param {string} sessionId - Oturum ID'si
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function endSessionById(sessionId) {
  try {
    // Oturum detaylarını al
    const sessionDetails = await getAllHashCache('sessions:details', sessionId);
    
    // Veritabanında oturumu güncelle
    await Session.findByIdAndUpdate(sessionId, {
      isActive: false,
      endedAt: new Date()
    });
    
    // Redis'ten oturum bilgilerini sil
    if (sessionDetails) {
      await deleteCache(`sessions:socket:${sessionDetails.socketId}`);
      await deleteCache(`sessions:user:${sessionDetails.user}`);
    }
    
    await deleteCache(`sessions:details:${sessionId}`);
    
    logger.info('Oturum sonlandırıldı', { sessionId });
    
    return true;
  } catch (error) {
    logger.error('Oturum sonlandırma hatası', { error: error.message, sessionId });
    return false;
  }
}

/**
 * Kullanıcı ID'sine göre tüm oturumları sonlandırır
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<number>} - Sonlandırılan oturum sayısı
 */
async function endAllUserSessions(userId) {
  try {
    // Veritabanında oturumları güncelle
    const result = await Session.updateMany(
      { user: userId, isActive: true },
      { isActive: false, endedAt: new Date() }
    );
    
    // Redis'ten kullanıcı oturum bilgilerini sil
    const userSession = await getAllHashCache('sessions:user', userId);
    
    if (userSession) {
      await deleteCache(`sessions:socket:${userSession.socketId}`);
      await deleteCache(`sessions:details:${userSession.sessionId}`);
      await deleteCache(`sessions:user:${userId}`);
    }
    
    logger.info('Tüm kullanıcı oturumları sonlandırıldı', { userId, count: result.modifiedCount });
    
    return result.modifiedCount;
  } catch (error) {
    logger.error('Tüm kullanıcı oturumlarını sonlandırma hatası', { error: error.message, userId });
    throw error;
  }
}

/**
 * Süresi dolmuş oturumları temizler
 * @param {number} [inactiveMinutes=1440] - İnaktif dakika sayısı (varsayılan: 24 saat)
 * @returns {Promise<number>} - Temizlenen oturum sayısı
 */
async function cleanupExpiredSessions(inactiveMinutes = 1440) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - inactiveMinutes);
    
    // Veritabanında oturumları güncelle
    const result = await Session.updateMany(
      { isActive: true, lastActivity: { $lt: cutoffDate } },
      { isActive: false, endedAt: new Date() }
    );
    
    logger.info('Süresi dolmuş oturumlar temizlendi', { count: result.modifiedCount, inactiveMinutes });
    
    return result.modifiedCount;
  } catch (error) {
    logger.error('Oturum temizleme hatası', { error: error.message, inactiveMinutes });
    throw error;
  }
}

module.exports = {
  createSession,
  endSessionBySocketId,
  getUserActiveSessions,
  updateSessionActivity,
  endSessionById,
  endAllUserSessions,
  cleanupExpiredSessions
};
