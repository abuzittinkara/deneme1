// modules/twoFactorAuth.js
const crypto = require('crypto');
const User = require('../models/User');

// Not: Gerçek uygulamada speakeasy gibi bir kütüphane kullanılmalıdır
// Bu örnek basitleştirilmiş bir 2FA implementasyonudur

/**
 * 2FA kurulumu başlat
 * @param {string} userId - Kullanıcı ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function setupTwoFactor(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  // Zaten etkinleştirilmiş mi kontrol et
  if (user.twoFactorEnabled) {
    throw new Error('İki faktörlü kimlik doğrulama zaten etkinleştirilmiş.');
  }
  
  // Yeni gizli anahtar oluştur (gerçek uygulamada speakeasy kullanılmalı)
  const secret = crypto.randomBytes(20).toString('hex');
  
  // Kullanıcıyı güncelle (henüz etkinleştirme)
  user.twoFactorSecret = secret;
  await user.save();
  
  // Gerçek uygulamada QR kodu oluşturulur
  return {
    success: true,
    secret: secret,
    message: 'İki faktörlü kimlik doğrulama kurulumu başlatıldı.'
  };
}

/**
 * 2FA'yı doğrula ve etkinleştir
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} token - Doğrulama kodu
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function verifyAndEnableTwoFactor(userId, token) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  // Gerçek uygulamada token doğrulaması yapılır
  // Bu örnek için basit bir kontrol yapıyoruz
  if (token !== '123456') { // Örnek doğrulama kodu
    throw new Error('Geçersiz doğrulama kodu.');
  }
  
  // Yedek kodlar oluştur
  const backupCodes = [];
  for (let i = 0; i < 10; i++) {
    backupCodes.push(crypto.randomBytes(4).toString('hex'));
  }
  
  // Kullanıcıyı güncelle
  user.twoFactorEnabled = true;
  user.backupCodes = backupCodes;
  await user.save();
  
  return {
    success: true,
    message: 'İki faktörlü kimlik doğrulama etkinleştirildi.',
    backupCodes
  };
}

/**
 * 2FA ile giriş doğrulama
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} token - Doğrulama kodu
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function verifyLogin(userId, token) {
  const user = await User.findById(userId);
  if (!user || !user.twoFactorEnabled) {
    throw new Error('Kullanıcı bulunamadı veya 2FA etkin değil.');
  }
  
  // Yedek kod kontrolü
  if (user.backupCodes.includes(token)) {
    // Yedek kodu kullanıldı olarak işaretle
    user.backupCodes = user.backupCodes.filter(code => code !== token);
    await user.save();
    return { success: true };
  }
  
  // Gerçek uygulamada token doğrulaması yapılır
  // Bu örnek için basit bir kontrol yapıyoruz
  if (token !== '123456') { // Örnek doğrulama kodu
    throw new Error('Geçersiz doğrulama kodu.');
  }
  
  return { success: true };
}

/**
 * 2FA'yı devre dışı bırak
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} token - Doğrulama kodu
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function disableTwoFactor(userId, token) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  if (!user.twoFactorEnabled) {
    throw new Error('İki faktörlü kimlik doğrulama zaten devre dışı.');
  }
  
  // Gerçek uygulamada token doğrulaması yapılır
  // Bu örnek için basit bir kontrol yapıyoruz
  if (token !== '123456') { // Örnek doğrulama kodu
    throw new Error('Geçersiz doğrulama kodu.');
  }
  
  // 2FA'yı devre dışı bırak
  user.twoFactorEnabled = false;
  user.twoFactorSecret = undefined;
  user.backupCodes = [];
  await user.save();
  
  return { success: true, message: 'İki faktörlü kimlik doğrulama devre dışı bırakıldı.' };
}

module.exports = {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  verifyLogin,
  disableTwoFactor
};
