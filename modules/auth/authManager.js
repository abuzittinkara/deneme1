/**************************************
 * modules/auth/authManager.js
 * Kimlik doğrulama işlemleri
 **************************************/
const bcrypt = require('bcrypt');
const User = require('../../models/User');
const { logger } = require('../../utils/logger');
const { generateTokens, verifyToken, refreshAccessToken, invalidateAllUserTokens, invalidateRefreshToken } = require('../../config/jwt');
const { NotFoundError, ValidationError, AuthenticationError } = require('../../utils/errors');
const sessionManager = require('../session/sessionManager');

/**
 * Kullanıcı kaydı yapar
 * @param {Object} userData - Kullanıcı verileri
 * @returns {Promise<Object>} - Kayıt sonucu
 */
async function registerUser(userData) {
  try {
    const { username, email, password, name, surname, birthdate, phone } = userData;

    // Zorunlu alanları kontrol et
    if (!username || !email || !password) {
      throw new ValidationError('Kullanıcı adı, e-posta ve şifre zorunludur');
    }

    // Kullanıcı adı ve e-posta benzersiz mi kontrol et
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existingUser) {
      if (existingUser.username.toLowerCase() === username.toLowerCase()) {
        throw new ValidationError('Bu kullanıcı adı zaten kullanılıyor');
      }
      if (existingUser.email.toLowerCase() === email.toLowerCase()) {
        throw new ValidationError('Bu e-posta adresi zaten kullanılıyor');
      }
    }

    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Yeni kullanıcı oluştur
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      surname,
      birthdate: birthdate ? new Date(birthdate) : undefined,
      phone,
      registrationDate: new Date(),
      lastSeen: new Date(),
      isActive: true,
      isEmailVerified: false,
      role: 'user',
      groups: [],
      friends: []
    });

    // Kullanıcıyı kaydet
    await newUser.save();

    logger.info('Yeni kullanıcı kaydedildi', { username: newUser.username, userId: newUser._id });

    return {
      success: true,
      userId: newUser._id,
      username: newUser.username,
      message: 'Kullanıcı başarıyla kaydedildi'
    };
  } catch (error) {
    logger.error('Kullanıcı kaydı hatası', { error: error.message, userData });
    throw error;
  }
}

/**
 * Kullanıcı girişi yapar
 * @param {string} usernameOrEmail - Kullanıcı adı veya e-posta
 * @param {string} password - Şifre
 * @returns {Promise<Object>} - Giriş sonucu
 */
async function loginUser(usernameOrEmail, password) {
  try {
    // Zorunlu alanları kontrol et
    if (!usernameOrEmail || !password) {
      throw new ValidationError('Kullanıcı adı/e-posta ve şifre zorunludur');
    }

    // Kullanıcıyı bul
    const user = await User.findOne({
      $or: [
        { username: usernameOrEmail.toLowerCase() },
        { email: usernameOrEmail.toLowerCase() }
      ]
    });

    if (!user) {
      throw new AuthenticationError('Geçersiz kullanıcı adı/e-posta veya şifre');
    }

    // Kullanıcı aktif mi kontrol et
    if (!user.isActive) {
      throw new AuthenticationError('Hesabınız aktif değil');
    }

    // Şifreyi doğrula
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AuthenticationError('Geçersiz kullanıcı adı/e-posta veya şifre');
    }

    // Son görülme zamanını güncelle
    user.lastSeen = new Date();
    await user.save();

    // Token oluştur
    const tokens = await generateTokens(user);

    logger.info('Kullanıcı girişi başarılı', { username: user.username, userId: user._id });

    return {
      success: true,
      userId: user._id,
      username: user.username,
      name: user.name,
      surname: user.surname,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture,
      isEmailVerified: user.isEmailVerified,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    };
  } catch (error) {
    logger.error('Kullanıcı girişi hatası', { error: error.message, usernameOrEmail });
    throw error;
  }
}

/**
 * Şifre değiştirir
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} currentPassword - Mevcut şifre
 * @param {string} newPassword - Yeni şifre
 * @returns {Promise<Object>} - Şifre değiştirme sonucu
 */
async function changePassword(userId, currentPassword, newPassword) {
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Mevcut şifreyi doğrula
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new ValidationError('Mevcut şifre yanlış');
    }

    // Yeni şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Şifreyi güncelle
    user.password = hashedPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    // Tüm cihazlardan çıkış yap
    await logoutAllDevices(userId);

    logger.info('Şifre değiştirildi', { userId });

    return {
      success: true,
      message: 'Şifre başarıyla değiştirildi'
    };
  } catch (error) {
    logger.error('Şifre değiştirme hatası', { error: error.message, userId });
    throw error;
  }
}

/**
 * Kullanıcı çıkışı yapar
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} refreshToken - Refresh token
 * @param {string} sessionId - Oturum ID'si
 * @returns {Promise<Object>} - Çıkış sonucu
 */
async function logoutUser(userId, refreshToken, sessionId) {
  try {
    // Refresh token'ı geçersiz kıl
    if (refreshToken) {
      await invalidateRefreshToken(refreshToken);
    }

    // Oturumu sonlandır
    if (sessionId) {
      await sessionManager.endSessionById(sessionId);
    }

    logger.info('Kullanıcı çıkışı başarılı', { userId, sessionId });

    return {
      success: true,
      message: 'Çıkış başarılı'
    };
  } catch (error) {
    logger.error('Kullanıcı çıkışı hatası', { error: error.message, userId, sessionId });
    throw error;
  }
}

/**
 * Tüm cihazlardan çıkış yapar
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - Çıkış sonucu
 */
async function logoutAllDevices(userId) {
  try {
    // Tüm refresh token'ları geçersiz kıl
    await invalidateAllUserTokens(userId);

    // Tüm oturumları sonlandır
    await sessionManager.endAllUserSessions(userId);

    logger.info('Tüm cihazlardan çıkış başarılı', { userId });

    return {
      success: true,
      message: 'Tüm cihazlardan çıkış başarılı'
    };
  } catch (error) {
    logger.error('Tüm cihazlardan çıkış hatası', { error: error.message, userId });
    throw error;
  }
}

/**
 * Refresh token ile yeni token oluşturur
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<Object>} - Yeni token bilgileri
 */
async function refreshToken(refreshToken) {
  try {
    // Refresh token ile yeni token oluştur
    const tokens = await refreshAccessToken(refreshToken);

    return {
      success: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn
    };
  } catch (error) {
    logger.error('Token yenileme hatası', { error: error.message });
    throw error;
  }
}

/**
 * Token doğrular
 * @param {string} token - JWT token
 * @returns {Object|null} - Doğrulanmış token payload'ı veya null
 */
function verifyAccessToken(token) {
  return verifyToken(token);
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  logoutAllDevices,
  changePassword,
  refreshToken,
  verifyAccessToken
};
