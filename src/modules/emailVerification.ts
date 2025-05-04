/**
 * src/modules/emailVerification.ts
 * E-posta doğrulama işlemleri
 */
import crypto from 'crypto';
import { User } from '../models/User';
import { EmailVerificationToken } from '../models/EmailVerificationToken';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import * as emailService from '../services/emailService';
import { env } from '../config/env';

// E-posta doğrulama token süresi (48 saat)
const EMAIL_VERIFICATION_TOKEN_EXPIRY = 48 * 60 * 60 * 1000;

/**
 * Doğrulama e-postası gönderir
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function sendVerificationEmail(userId: string, email?: string): Promise<boolean> {
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcı zaten doğrulanmış mı kontrol et
    const emailVerified = user.get('emailVerified');
    const userEmail = user.get('email');
    if (emailVerified) {
      logger.debug('E-posta zaten doğrulanmış', { userId, email: userEmail });
      return true;
    }

    // Eski token'ları temizle
    await EmailVerificationToken.deleteMany({ userId });

    // Yeni token oluştur
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Token'ı kaydet
    const verificationToken = new EmailVerificationToken({
      userId,
      token: hashedToken,
      expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_EXPIRY)
    });

    await verificationToken.save();

    // Doğrulama bağlantısı oluştur
    const verificationUrl = `${env.CLIENT_URL}/verify-email?token=${token}`;

    // E-posta gönder
    const username = user.get('username');
    await emailService.sendVerificationEmail(userEmail, {
      username,
      verificationUrl
    });

    logger.info('E-posta doğrulama bağlantısı gönderildi', { userId, email: userEmail });

    return true;
  } catch (error) {
    logger.error('E-posta doğrulama bağlantısı gönderme hatası', {
      error: (error as Error).message,
      userId,
      email: email || 'unknown'
    });
    throw error;
  }
}

/**
 * E-posta doğrulama
 * @param token - Doğrulama token'ı
 * @returns İşlem sonucu
 */
export async function verifyEmail(token: string): Promise<boolean> {
  try {
    // Token'ı hashle
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Token'ı bul
    const verificationToken = await EmailVerificationToken.findOne({
      token: hashedToken,
      expiresAt: { $gt: new Date() }
    });

    if (!verificationToken) {
      throw new ValidationError('Geçersiz veya süresi dolmuş token');
    }

    // Kullanıcıyı bul
    const user = await User.findById(verificationToken.userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // E-posta doğrulandı olarak işaretle
    user.set('emailVerified', true);
    await user.save();

    // Token'ı sil
    await EmailVerificationToken.deleteMany({ userId: user._id });

    const userEmail = user.get('email');
    logger.info('E-posta başarıyla doğrulandı', { userId: user._id, email: userEmail });

    return true;
  } catch (error) {
    logger.error('E-posta doğrulama hatası', {
      error: (error as Error).message
    });
    throw error;
  }
}

/**
 * E-posta doğrulama durumunu kontrol eder
 * @param userId - Kullanıcı ID'si
 * @returns Doğrulama durumu
 */
/**
 * E-posta doğrulama bağlantısını yeniden gönderir
 * @param email - E-posta adresi
 * @returns İşlem sonucu
 */
export async function resendVerificationEmail(email: string): Promise<boolean> {
  try {
    // Kullanıcıyı bul
    const user = await User.findOne({ email: email.toLowerCase() });

    // Kullanıcı bulunamazsa sessizce çık (güvenlik nedeniyle)
    if (!user) {
      logger.debug('E-posta doğrulama yeniden gönderme: Kullanıcı bulunamadı', { email });
      return true;
    }

    // Kullanıcı zaten doğrulanmış mı kontrol et
    const emailVerified = user.get('emailVerified');
    if (emailVerified) {
      logger.debug('E-posta zaten doğrulanmış', { userId: user._id, email });
      return true;
    }

    // Doğrulama e-postasını gönder
    return await sendVerificationEmail(user._id.toString(), email);
  } catch (error) {
    logger.error('E-posta doğrulama bağlantısı yeniden gönderme hatası', {
      error: (error as Error).message,
      email
    });
    throw error;
  }
}

/**
 * Kullanıcının e-posta doğrulama durumunu kontrol eder
 * @param userId - Kullanıcı ID'si
 * @returns E-posta doğrulanmış mı
 */
export async function isEmailVerified(userId: string): Promise<boolean> {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    return user.get('emailVerified') || false;
  } catch (error) {
    logger.error('E-posta doğrulama durumu kontrol hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

export default {
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmail,
  isEmailVerified
};
