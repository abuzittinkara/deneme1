/**
 * src/modules/twoFactorAuth.ts
 * İki faktörlü kimlik doğrulama işlemleri
 *
 * Not: Gerçek uygulamada speakeasy gibi bir kütüphane kullanılmalıdır
 * Bu örnek basitleştirilmiş bir 2FA implementasyonudur
 */
import crypto from 'crypto';
import { User, UserDocument } from '../models/User';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, AuthenticationError } from '../utils/errors';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// 2FA kurulum sonucu arayüzü
export interface TwoFactorSetupResult {
  success: boolean;
  secret: string;
  message: string;
}

// 2FA etkinleştirme sonucu arayüzü
export interface TwoFactorEnableResult {
  success: boolean;
  message: string;
  backupCodes: string[];
}

// 2FA doğrulama sonucu arayüzü
export interface TwoFactorVerifyResult {
  success: boolean;
}

// 2FA devre dışı bırakma sonucu arayüzü
export interface TwoFactorDisableResult {
  success: boolean;
  message: string;
}

/**
 * 2FA kurulumu başlat
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function setupTwoFactor(userId: string): Promise<TwoFactorSetupResult> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Zaten etkinleştirilmiş mi kontrol et
    if (user.twoFactorEnabled) {
      throw new ValidationError('İki faktörlü kimlik doğrulama zaten etkinleştirilmiş.');
    }

    // Yeni gizli anahtar oluştur (gerçek uygulamada speakeasy kullanılmalı)
    const secret = crypto.randomBytes(20).toString('hex');

    // Kullanıcıyı güncelle (henüz etkinleştirme)
    user.twoFactorSecret = secret;
    await user.save();

    logger.info('2FA kurulumu başlatıldı', { userId });

    // Gerçek uygulamada QR kodu oluşturulur
    return {
      success: true,
      secret: secret,
      message: 'İki faktörlü kimlik doğrulama kurulumu başlatıldı.',
    };
  } catch (error) {
    logger.error('2FA kurulum hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * 2FA'yı doğrula ve etkinleştir
 * @param userId - Kullanıcı ID'si
 * @param token - Doğrulama kodu
 * @returns İşlem sonucu
 */
export async function verifyAndEnableTwoFactor(
  userId: string,
  token: string
): Promise<TwoFactorEnableResult> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Gerçek uygulamada token doğrulaması yapılır
    // Bu örnek için basit bir kontrol yapıyoruz
    if (token !== '123456') {
      // Örnek doğrulama kodu
      throw new ValidationError('Geçersiz doğrulama kodu.');
    }

    // Yedek kodlar oluştur
    const backupCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      backupCodes.push(crypto.randomBytes(4).toString('hex'));
    }

    // Kullanıcıyı güncelle
    user.twoFactorEnabled = true;
    user.backupCodes = backupCodes;
    await user.save();

    logger.info('2FA etkinleştirildi', { userId });

    return {
      success: true,
      message: 'İki faktörlü kimlik doğrulama etkinleştirildi.',
      backupCodes,
    };
  } catch (error) {
    logger.error('2FA etkinleştirme hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * 2FA ile giriş doğrulama
 * @param userId - Kullanıcı ID'si
 * @param token - Doğrulama kodu
 * @returns İşlem sonucu
 */
export async function verifyLogin(userId: string, token: string): Promise<TwoFactorVerifyResult> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user || !user.twoFactorEnabled) {
      throw new ValidationError('Kullanıcı bulunamadı veya 2FA etkin değil.');
    }

    // Yedek kod kontrolü
    if (user.backupCodes && user.backupCodes.includes(token)) {
      // Yedek kodu kullanıldı olarak işaretle
      user.backupCodes = user.backupCodes.filter((code) => code !== token);
      await user.save();

      logger.info('2FA yedek kod ile doğrulandı', { userId });

      return { success: true };
    }

    // Gerçek uygulamada token doğrulaması yapılır
    // Bu örnek için basit bir kontrol yapıyoruz
    if (token !== '123456') {
      // Örnek doğrulama kodu
      throw new AuthenticationError('Geçersiz doğrulama kodu.');
    }

    logger.info('2FA doğrulandı', { userId });

    return { success: true };
  } catch (error) {
    logger.error('2FA doğrulama hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * 2FA'yı devre dışı bırak
 * @param userId - Kullanıcı ID'si
 * @param token - Doğrulama kodu
 * @returns İşlem sonucu
 */
export async function disableTwoFactor(
  userId: string,
  token: string
): Promise<TwoFactorDisableResult> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    if (!user.twoFactorEnabled) {
      throw new ValidationError('İki faktörlü kimlik doğrulama zaten devre dışı.');
    }

    // Gerçek uygulamada token doğrulaması yapılır
    // Bu örnek için basit bir kontrol yapıyoruz
    if (token !== '123456') {
      // Örnek doğrulama kodu
      throw new AuthenticationError('Geçersiz doğrulama kodu.');
    }

    // 2FA'yı devre dışı bırak
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.backupCodes = [];
    await user.save();

    logger.info('2FA devre dışı bırakıldı', { userId });

    return { success: true, message: 'İki faktörlü kimlik doğrulama devre dışı bırakıldı.' };
  } catch (error) {
    logger.error('2FA devre dışı bırakma hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * 2FA durumunu kontrol et
 * @param userId - Kullanıcı ID'si
 * @returns 2FA durumu
 */
export async function checkTwoFactorStatus(userId: string): Promise<{ enabled: boolean }> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    return { enabled: user.twoFactorEnabled || false };
  } catch (error) {
    logger.error('2FA durum kontrolü hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

export default {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  verifyLogin,
  disableTwoFactor,
  checkTwoFactorStatus,
};
