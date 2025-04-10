// modules/sessionManager.js
const Session = require('../models/Session');
const User = require('../models/User');

/**
 * Basit bir user agent parser
 * @param {string} userAgentString - User-Agent string
 * @returns {Object} - Parsed user agent information
 */
function parseUserAgent(userAgentString) {
  // Default values
  const result = {
    browser: 'Unknown',
    os: 'Unknown',
    device: 'Other',
    isMobile: false
  };

  if (!userAgentString) return result;

  // Browser detection (simple version)
  if (userAgentString.includes('Firefox/')) {
    result.browser = 'Firefox';
  } else if (userAgentString.includes('Chrome/') && !userAgentString.includes('Edg/') && !userAgentString.includes('OPR/')) {
    result.browser = 'Chrome';
  } else if (userAgentString.includes('Safari/') && !userAgentString.includes('Chrome/')) {
    result.browser = 'Safari';
  } else if (userAgentString.includes('Edg/')) {
    result.browser = 'Edge';
  } else if (userAgentString.includes('OPR/') || userAgentString.includes('Opera/')) {
    result.browser = 'Opera';
  } else if (userAgentString.includes('MSIE') || userAgentString.includes('Trident/')) {
    result.browser = 'Internet Explorer';
  }

  // OS detection (simple version)
  if (userAgentString.includes('Windows')) {
    result.os = 'Windows';
  } else if (userAgentString.includes('Macintosh') || userAgentString.includes('Mac OS')) {
    result.os = 'Mac OS';
  } else if (userAgentString.includes('Linux') && !userAgentString.includes('Android')) {
    result.os = 'Linux';
  } else if (userAgentString.includes('Android')) {
    result.os = 'Android';
    result.isMobile = true;
  } else if (userAgentString.includes('iOS') || userAgentString.includes('iPhone') || userAgentString.includes('iPad')) {
    result.os = 'iOS';
    result.isMobile = true;
  }

  // Device detection (simple version)
  if (userAgentString.includes('iPhone')) {
    result.device = 'iPhone';
    result.isMobile = true;
  } else if (userAgentString.includes('iPad')) {
    result.device = 'iPad';
    result.isMobile = true;
  } else if (userAgentString.includes('Android') && (userAgentString.includes('Mobile') || userAgentString.includes('mobile'))) {
    result.device = 'Android Phone';
    result.isMobile = true;
  } else if (userAgentString.includes('Android')) {
    result.device = 'Android Tablet';
    result.isMobile = true;
  } else if (result.isMobile) {
    result.device = 'Mobile Device';
  } else {
    result.device = 'Desktop';
  }

  return result;
}

/**
 * Yeni oturum oluşturur
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} socketId - Socket ID
 * @param {string} userAgentString - User-Agent bilgisi
 * @param {string} ipAddress - IP adresi
 * @returns {Promise<Object>} - Oluşturulan oturum
 */
async function createSession(userId, socketId, userAgentString, ipAddress) {
  try {
    // User-Agent bilgisini ayrıştır
    const deviceInfo = parseUserAgent(userAgentString);

    // Yeni oturum oluştur
    const session = new Session({
      user: userId,
      socketId,
      userAgent: userAgentString,
      ipAddress,
      deviceInfo: deviceInfo
    });

    await session.save();
    return session;
  } catch (err) {
    console.error('Oturum oluşturma hatası:', err);
    throw err;
  }
}

/**
 * Oturumu günceller
 * @param {string} sessionId - Oturum ID'si
 * @param {Object} updateData - Güncellenecek veriler
 * @returns {Promise<Object>} - Güncellenen oturum
 */
async function updateSession(sessionId, updateData) {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Oturum bulunamadı');
    }

    // Güncelleme verilerini uygula
    Object.keys(updateData).forEach(key => {
      if (key === 'deviceInfo' || key === 'location') {
        Object.keys(updateData[key]).forEach(subKey => {
          session[key][subKey] = updateData[key][subKey];
        });
      } else {
        session[key] = updateData[key];
      }
    });

    // Son aktivite zamanını güncelle
    session.lastActivity = new Date();

    await session.save();
    return session;
  } catch (err) {
    console.error('Oturum güncelleme hatası:', err);
    throw err;
  }
}

/**
 * Oturumu sonlandırır
 * @param {string} sessionId - Oturum ID'si
 * @returns {Promise<Object>} - Sonlandırılan oturum
 */
async function endSession(sessionId) {
  try {
    const session = await Session.findById(sessionId);
    if (!session) {
      throw new Error('Oturum bulunamadı');
    }

    session.isActive = false;
    session.logoutTime = new Date();

    await session.save();
    return session;
  } catch (err) {
    console.error('Oturum sonlandırma hatası:', err);
    throw err;
  }
}

/**
 * Socket ID'ye göre oturumu sonlandırır
 * @param {string} socketId - Socket ID
 * @returns {Promise<Object>} - Sonlandırılan oturum
 */
async function endSessionBySocketId(socketId) {
  try {
    const session = await Session.findOne({ socketId, isActive: true });
    if (!session) {
      return null;
    }

    session.isActive = false;
    session.logoutTime = new Date();

    await session.save();
    return session;
  } catch (err) {
    console.error('Socket ID ile oturum sonlandırma hatası:', err);
    throw err;
  }
}

/**
 * Kullanıcının aktif oturumlarını getirir
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Array>} - Aktif oturumlar listesi
 */
async function getUserActiveSessions(userId) {
  try {
    const sessions = await Session.find({ user: userId, isActive: true })
      .sort({ loginTime: -1 });

    return sessions;
  } catch (err) {
    console.error('Kullanıcı oturumlarını getirme hatası:', err);
    throw err;
  }
}

/**
 * Kullanıcının tüm oturumlarını getirir
 * @param {string} userId - Kullanıcı ID'si
 * @param {number} limit - Maksimum oturum sayısı
 * @returns {Promise<Array>} - Oturumlar listesi
 */
async function getUserAllSessions(userId, limit = 10) {
  try {
    const sessions = await Session.find({ user: userId })
      .sort({ loginTime: -1 })
      .limit(limit);

    return sessions;
  } catch (err) {
    console.error('Kullanıcı oturumlarını getirme hatası:', err);
    throw err;
  }
}

/**
 * Kullanıcının belirtilen oturum dışındaki tüm oturumlarını sonlandırır
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} currentSessionId - Mevcut oturum ID'si
 * @returns {Promise<number>} - Sonlandırılan oturum sayısı
 */
async function endAllOtherSessions(userId, currentSessionId) {
  try {
    const result = await Session.updateMany(
      { user: userId, _id: { $ne: currentSessionId }, isActive: true },
      { isActive: false, logoutTime: new Date() }
    );

    return result.nModified;
  } catch (err) {
    console.error('Diğer oturumları sonlandırma hatası:', err);
    throw err;
  }
}

module.exports = {
  createSession,
  updateSession,
  endSession,
  endSessionBySocketId,
  getUserActiveSessions,
  getUserAllSessions,
  endAllOtherSessions
};
