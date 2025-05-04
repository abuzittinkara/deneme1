// modules/passwordReset.js
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');

/**
 * Şifre sıfırlama isteği oluşturur
 * @param {string} email - Kullanıcının e-posta adresi
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function createPasswordResetRequest(email) {
  const user = await User.findOne({ email });
  if (!user) {
    throw new Error('Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.');
  }
  
  // Rastgele token oluştur
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date();
  expires.setHours(expires.getHours() + 24); // 24 saat geçerli
  
  // Önceki sıfırlama isteklerini iptal et
  await PasswordReset.deleteMany({ user: user._id });
  
  // Yeni sıfırlama isteği oluştur
  const resetRequest = new PasswordReset({
    user: user._id,
    token,
    expires
  });
  
  await resetRequest.save();
  
  // Gerçek uygulamada burada e-posta gönderme işlemi yapılır
  // Bu örnek için sadece token döndürüyoruz
  return { 
    success: true, 
    message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
    token // Gerçek uygulamada bu dönmemeli, sadece test için
  };
}

/**
 * Şifre sıfırlama işlemini gerçekleştirir
 * @param {string} token - Sıfırlama token'ı
 * @param {string} newPassword - Yeni şifre
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function resetPassword(token, newPassword) {
  const resetRequest = await PasswordReset.findOne({ token, used: false });
  
  if (!resetRequest) {
    throw new Error('Geçersiz veya kullanılmış token.');
  }
  
  if (resetRequest.expires < new Date()) {
    throw new Error('Token süresi dolmuş.');
  }
  
  const user = await User.findById(resetRequest.user);
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  // Şifreyi güncelle
  const passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordHash = passwordHash;
  await user.save();
  
  // Token'ı kullanıldı olarak işaretle
  resetRequest.used = true;
  await resetRequest.save();
  
  return { success: true, message: 'Şifreniz başarıyla sıfırlandı.' };
}

module.exports = {
  createPasswordResetRequest,
  resetPassword
};
