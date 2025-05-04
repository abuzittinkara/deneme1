/**
 * src/modules/auth/passwordManager.ts
 * Şifre yönetimi işlemleri
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { User } from '../../models/User';
import { PasswordResetToken } from '../../models/PasswordResetToken';
import { logger } from '../../utils/logger';
import { NotFoundError, ValidationError, AuthenticationError } from '../../utils/errors';
import * as emailService from '../../services/emailService';
import * as authManager from './authManager';
import { env } from '../../config/env';

// Şifre sıfırlama token süresi (24 saat)
const PASSWORD_RESET_TOKEN_EXPIRY = 24 * 60 * 60 * 1000;

/**
 * Şifre sıfırlama e-postası gönderir
 * @param email - Kullanıcı e-posta adresi
 * @returns İşlem sonucu
 */
export async function sendPasswordResetEmail(email: string): Promise<boolean> {
  try {
    // E-posta adresini küçük harfe çevir
    const normalizedEmail = email.toLowerCase();

    // Kullanıcıyı bul
    const user = await User.findOne({ email: normalizedEmail });

    // Kullanıcı bulunamazsa sessizce çık (güvenlik nedeniyle)
    if (!user) {
      logger.debug('Şifre sıfırlama isteği: Kullanıcı bulunamadı', { email: normalizedEmail });
      return true;
    }

    // Eski token'ları temizle
    await PasswordResetToken.deleteMany({ userId: user._id });

    // Yeni token oluştur
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Token'ı kaydet
    const resetToken = new PasswordResetToken({
      userId: user._id,
      token: hashedToken,
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_EXPIRY)
    });

    await resetToken.save();

    // Şifre sıfırlama bağlantısı oluştur
    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${token}`;

    // E-posta gönder
    const userEmail = user.get('email');
    const username = user.get('username');
    await emailService.sendPasswordResetEmail(userEmail, {
      username,
      resetUrl
    });

    logger.info('Şifre sıfırlama e-postası gönderildi', { userId: user._id });

    return true;
  } catch (error) {
    logger.error('Şifre sıfırlama e-postası gönderme hatası', {
      error: (error as Error).message,
      email
    });
    throw error;
  }
}

/**
 * Şifre sıfırlama işlemini tamamlar
 * @param token - Şifre sıfırlama token'ı
 * @param newPassword - Yeni şifre
 * @returns İşlem sonucu
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  try {
    // Token'ı hashle
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Token'ı bul
    const resetToken = await PasswordResetToken.findOne({
      token: hashedToken,
      expiresAt: { $gt: new Date() }
    });

    if (!resetToken) {
      throw new ValidationError('Geçersiz veya süresi dolmuş token');
    }

    // Kullanıcıyı bul
    const user = await User.findById(resetToken.userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Yeni şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Şifreyi güncelle
    user.set('passwordHash', hashedPassword);
    // Şifre değişiklik zamanını güncelle (eğer model destekliyorsa)
    if ('passwordChangedAt' in user) {
      user.set('passwordChangedAt', new Date());
    }
    await user.save();

    // Token'ı sil
    await PasswordResetToken.deleteMany({ userId: user._id });

    // Tüm cihazlardan çıkış yap
    await authManager.logoutAllDevices(user._id.toString());

    logger.info('Şifre başarıyla sıfırlandı', { userId: user._id });

    return true;
  } catch (error) {
    logger.error('Şifre sıfırlama hatası', {
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * Şifre değişikliğini doğrular
 * @param userId - Kullanıcı ID'si
 * @param currentPassword - Mevcut şifre
 * @param newPassword - Yeni şifre
 * @returns İşlem sonucu
 */
export async function validatePasswordChange(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<boolean> {
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Mevcut şifreyi doğrula
    const passwordHash = user.get('passwordHash');
    const isPasswordValid = await bcrypt.compare(currentPassword, passwordHash);

    if (!isPasswordValid) {
      throw new ValidationError('Mevcut şifre yanlış');
    }

    // Yeni şifre eskisiyle aynı mı kontrol et
    const isSamePassword = await bcrypt.compare(newPassword, passwordHash);

    if (isSamePassword) {
      throw new ValidationError('Yeni şifre eskisiyle aynı olamaz');
    }

    return true;
  } catch (error) {
    logger.error('Şifre değişikliği doğrulama hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

/**
 * Şifre karmaşıklığını kontrol eder
 * @param password - Kontrol edilecek şifre
 * @returns Şifre geçerli mi
 */
export function isPasswordComplex(password: string): boolean {
  // En az 8 karakter
  if (password.length < 8) {
    return false;
  }

  // En az bir büyük harf, bir küçük harf ve bir rakam içermeli
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);

  return hasUpperCase && hasLowerCase && hasNumbers;
}

export default {
  sendPasswordResetEmail,
  resetPassword,
  validatePasswordChange,
  isPasswordComplex
};
