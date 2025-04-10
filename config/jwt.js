/**
 * JWT yapılandırması
 * Bu dosya JWT token oluşturma ve doğrulama işlemlerini içerir
 */
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const { redisClient, setCache, getCache, deleteCache } = require('./redis');

// JWT seçenekleri
const jwtOptions = {
  algorithm: 'HS256',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  issuer: 'sesli-sohbet-api',
  audience: 'sesli-sohbet-client'
};

// Refresh token seçenekleri
const refreshTokenOptions = {
  algorithm: 'HS256',
  expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  issuer: 'sesli-sohbet-api',
  audience: 'sesli-sohbet-client'
};

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Access ve refresh token oluşturur
 * @param {Object} user - Kullanıcı nesnesi
 * @returns {Object} - Token bilgileri
 */
async function generateTokens(user) {
  try {
    // Kullanıcı bilgilerini hazırla
    const payload = {
      sub: user._id.toString(),
      username: user.username,
      role: user.role || 'user'
    };
    
    // Access token oluştur
    const accessToken = jwt.sign(payload, JWT_SECRET, jwtOptions);
    
    // Refresh token için benzersiz ID oluştur
    const jti = crypto.randomBytes(32).toString('hex');
    
    // Refresh token oluştur
    const refreshToken = jwt.sign(
      { ...payload, jti },
      JWT_SECRET,
      refreshTokenOptions
    );
    
    // Refresh token'ı Redis'e kaydet
    const refreshTokenTTL = 7 * 24 * 60 * 60; // 7 gün (saniye cinsinden)
    await setCache(`refresh_token:${jti}`, {
      userId: user._id.toString(),
      username: user.username,
      jti
    }, refreshTokenTTL);
    
    // Kullanıcının aktif refresh token'larını takip et
    const userRefreshTokensKey = `user_refresh_tokens:${user._id}`;
    const userRefreshTokens = await getCache(userRefreshTokensKey) || [];
    userRefreshTokens.push(jti);
    
    // En fazla 5 aktif refresh token olsun
    if (userRefreshTokens.length > 5) {
      const oldestTokenJti = userRefreshTokens.shift();
      await deleteCache(`refresh_token:${oldestTokenJti}`);
    }
    
    await setCache(userRefreshTokensKey, userRefreshTokens, refreshTokenTTL);
    
    return {
      accessToken,
      refreshToken,
      expiresIn: parseInt(jwtOptions.expiresIn) || 3600 // 1 saat (saniye cinsinden)
    };
  } catch (error) {
    logger.error('Token oluşturma hatası', { error: error.message });
    throw new Error(`Token oluşturma hatası: ${error.message}`);
  }
}

/**
 * JWT token'ı doğrular
 * @param {string} token - JWT token
 * @returns {Object|null} - Doğrulanmış token payload'ı veya null
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: [jwtOptions.algorithm],
      issuer: jwtOptions.issuer,
      audience: jwtOptions.audience
    });
  } catch (error) {
    logger.error('Token doğrulama hatası', { error: error.message });
    return null;
  }
}

/**
 * Refresh token ile yeni token oluşturur
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - Yeni token bilgileri
 */
async function refreshAccessToken(refreshToken) {
  try {
    // Refresh token'ı doğrula
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: [refreshTokenOptions.algorithm],
      issuer: refreshTokenOptions.issuer,
      audience: refreshTokenOptions.audience
    });
    
    // Refresh token Redis'te var mı kontrol et
    const tokenData = await getCache(`refresh_token:${decoded.jti}`);
    
    if (!tokenData) {
      throw new Error('Geçersiz refresh token');
    }
    
    // Kullanıcı ID'leri eşleşiyor mu kontrol et
    if (tokenData.userId !== decoded.sub) {
      throw new Error('Refresh token kullanıcı eşleşmiyor');
    }
    
    // Kullanıcıyı bul
    const User = require('../models/User');
    const user = await User.findById(decoded.sub);
    
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }
    
    // Kullanıcı aktif mi kontrol et
    if (!user.isActive) {
      throw new Error('Kullanıcı hesabı aktif değil');
    }
    
    // Eski refresh token'ı sil
    await deleteCache(`refresh_token:${decoded.jti}`);
    
    // Kullanıcının aktif refresh token'larını güncelle
    const userRefreshTokensKey = `user_refresh_tokens:${user._id}`;
    let userRefreshTokens = await getCache(userRefreshTokensKey) || [];
    userRefreshTokens = userRefreshTokens.filter(jti => jti !== decoded.jti);
    await setCache(userRefreshTokensKey, userRefreshTokens);
    
    // Yeni token oluştur
    return await generateTokens(user);
  } catch (error) {
    logger.error('Token yenileme hatası', { error: error.message });
    throw new Error(`Token yenileme hatası: ${error.message}`);
  }
}

/**
 * Kullanıcının tüm refresh token'larını geçersiz kılar
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function invalidateAllUserTokens(userId) {
  try {
    // Kullanıcının aktif refresh token'larını al
    const userRefreshTokensKey = `user_refresh_tokens:${userId}`;
    const userRefreshTokens = await getCache(userRefreshTokensKey) || [];
    
    // Tüm refresh token'ları sil
    for (const jti of userRefreshTokens) {
      await deleteCache(`refresh_token:${jti}`);
    }
    
    // Kullanıcının token listesini temizle
    await deleteCache(userRefreshTokensKey);
    
    return true;
  } catch (error) {
    logger.error('Token geçersiz kılma hatası', { error: error.message, userId });
    return false;
  }
}

/**
 * Belirli bir refresh token'ı geçersiz kılar
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<boolean>} - İşlem başarılı mı
 */
async function invalidateRefreshToken(refreshToken) {
  try {
    // Refresh token'ı doğrula
    const decoded = jwt.verify(refreshToken, JWT_SECRET, {
      algorithms: [refreshTokenOptions.algorithm],
      issuer: refreshTokenOptions.issuer,
      audience: refreshTokenOptions.audience
    });
    
    // Refresh token'ı sil
    await deleteCache(`refresh_token:${decoded.jti}`);
    
    // Kullanıcının aktif refresh token'larını güncelle
    const userRefreshTokensKey = `user_refresh_tokens:${decoded.sub}`;
    let userRefreshTokens = await getCache(userRefreshTokensKey) || [];
    userRefreshTokens = userRefreshTokens.filter(jti => jti !== decoded.jti);
    await setCache(userRefreshTokensKey, userRefreshTokens);
    
    return true;
  } catch (error) {
    logger.error('Refresh token geçersiz kılma hatası', { error: error.message });
    return false;
  }
}

module.exports = {
  generateTokens,
  verifyToken,
  refreshAccessToken,
  invalidateAllUserTokens,
  invalidateRefreshToken
};
