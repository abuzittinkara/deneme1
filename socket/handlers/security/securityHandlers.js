/**************************************
 * socket/handlers/security/securityHandlers.js
 * Güvenlik ile ilgili socket olaylarını yönetir
 **************************************/
const User = require('../../../models/User');
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Güvenlik socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerSecurityHandlers(socket, io, deps) {
  const { 
    users, 
    passwordReset,
    emailVerification,
    twoFactorAuth
  } = deps;

  // ----- Şifre Sıfırlama -----
  socket.on('forgotPassword', async (data, callback) => {
    try {
      const { email } = data;
      const result = await passwordReset.createPasswordResetRequest(email);
      callback(result);
      
      logger.info('Şifre sıfırlama isteği oluşturuldu', { email });
    } catch (err) {
      handleSocketError(err, 'Şifre sıfırlama isteği hatası', socket, callback);
    }
  });

  socket.on('resetPassword', async (data, callback) => {
    try {
      const { token, newPassword } = data;
      const result = await passwordReset.resetPassword(token, newPassword);
      callback(result);
      
      logger.info('Şifre sıfırlandı', { token });
    } catch (err) {
      handleSocketError(err, 'Şifre sıfırlama hatası', socket, callback);
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
      
      logger.info('Doğrulama e-postası gönderildi', { username: userData.username });
    } catch (err) {
      handleSocketError(err, 'Doğrulama e-postası gönderme hatası', socket, callback);
    }
  });

  socket.on('verifyEmail', async (data, callback) => {
    try {
      const { token } = data;
      const result = await emailVerification.verifyEmail(token);
      callback(result);
      
      logger.info('E-posta doğrulandı', { token });
    } catch (err) {
      handleSocketError(err, 'E-posta doğrulama hatası', socket, callback);
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
      
      logger.info('2FA kurulumu başlatıldı', { username: userData.username });
    } catch (err) {
      handleSocketError(err, '2FA kurulum hatası', socket, callback);
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
      
      logger.info('2FA etkinleştirildi', { username: userData.username });
    } catch (err) {
      handleSocketError(err, '2FA doğrulama hatası', socket, callback);
    }
  });

  socket.on('verifyTwoFactorLogin', async (data, callback) => {
    try {
      const { userId, token } = data;
      const result = await twoFactorAuth.verifyLogin(userId, token);
      callback(result);
      
      logger.info('2FA giriş doğrulaması yapıldı', { userId });
    } catch (err) {
      handleSocketError(err, '2FA giriş doğrulama hatası', socket, callback);
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
      
      logger.info('2FA devre dışı bırakıldı', { username: userData.username });
    } catch (err) {
      handleSocketError(err, '2FA devre dışı bırakma hatası', socket, callback);
    }
  });
}

module.exports = registerSecurityHandlers;
