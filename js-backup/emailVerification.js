// modules/emailVerification.js
const crypto = require('crypto');
const User = require('../models/User');

/**
 * Doğrulama e-postası gönderir
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendVerificationEmail(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  if (user.emailVerified) {
    throw new Error('E-posta adresi zaten doğrulanmış.');
  }
  
  // Token oluştur
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // 24 saat geçerli
  
  // Kullanıcıyı güncelle
  user.emailVerificationToken = token;
  user.emailVerificationExpires = expires;
  await user.save();
  
  // Gerçek uygulamada burada e-posta gönderme işlemi yapılır
  // Bu örnek için sadece token döndürüyoruz
  return { 
    success: true, 
    message: 'Doğrulama e-postası gönderildi.',
    token // Gerçek uygulamada bu dönmemeli, sadece test için
  };
}

/**
 * E-posta doğrulama
 * @param {string} token - Doğrulama token'ı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function verifyEmail(token) {
  const user = await User.findOne({
    emailVerificationToken: token,
    emailVerificationExpires: { $gt: Date.now() }
  });
  
  if (!user) {
    throw new Error('Geçersiz veya süresi dolmuş token.');
  }
  
  // Kullanıcıyı güncelle
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  
  return { success: true, message: 'E-posta adresiniz başarıyla doğrulandı.' };
}

module.exports = {
  sendVerificationEmail,
  verifyEmail
};
