/**
 * src/modules/passwordReset.ts
 * Şifre sıfırlama işlemleri
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from '../models/User';
import { PasswordReset, PasswordResetDocument } from '../models/PasswordReset';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const PasswordResetHelper = createModelHelper<PasswordResetDocument, typeof PasswordReset>(PasswordReset);

// Şifre sıfırlama isteği sonucu arayüzü
export interface PasswordResetRequestResult {
  success: boolean;
  message: string;
  token?: string; // Gerçek uygulamada bu dönmemeli, sadece test için
}

// Şifre sıfırlama sonucu arayüzü
export interface PasswordResetResult {
  success: boolean;
  message: string;
}

/**
 * Şifre sıfırlama isteği oluşturur
 * @param email - Kullanıcının e-posta adresi
 * @returns İşlem sonucu
 */
export async function createPasswordResetRequest(email: string): Promise<PasswordResetRequestResult> {
  try {
    const user = await UserHelper.findOne({ email });
    if (!user) {
      throw new NotFoundError('Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.');
    }

    // Rastgele token oluştur
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // 24 saat geçerli

    // Önceki sıfırlama isteklerini iptal et
    await PasswordResetHelper.getModel().deleteMany({ user: user._id });

    // Yeni sıfırlama isteği oluştur
    const resetRequest = await PasswordResetHelper.create({
      user: user._id,
      token,
      expires
    });

    logger.info('Şifre sıfırlama isteği oluşturuldu', {
      userId: user._id,
      email,
      expires
    });

    // Gerçek uygulamada burada e-posta gönderme işlemi yapılır
    // Bu örnek için sadece token döndürüyoruz
    return {
      success: true,
      message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
      token // Gerçek uygulamada bu dönmemeli, sadece test için
    };
  } catch (error) {
    logger.error('Şifre sıfırlama isteği oluşturma hatası', {
      error: (error as Error).message,
      email
    });
    throw error;
  }
}

/**
 * Şifre sıfırlama işlemini gerçekleştirir
 * @param token - Sıfırlama token'ı
 * @param newPassword - Yeni şifre
 * @returns İşlem sonucu
 */
export async function resetPassword(token: string, newPassword: string): Promise<PasswordResetResult> {
  try {
    const resetRequest = await PasswordResetHelper.findOne({ token, used: false });

    if (!resetRequest) {
      throw new ValidationError('Geçersiz veya kullanılmış token.');
    }

    if (resetRequest.expires < new Date()) {
      throw new ValidationError('Token süresi dolmuş.');
    }

    const user = await UserHelper.findById(resetRequest.user);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Şifreyi güncelle
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;
    await user.save();

    // Token'ı kullanıldı olarak işaretle
    resetRequest.used = true;
    await resetRequest.save();

    logger.info('Şifre sıfırlama başarılı', { userId: user._id });

    return { success: true, message: 'Şifreniz başarıyla sıfırlandı.' };
  } catch (error) {
    logger.error('Şifre sıfırlama hatası', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Token geçerliliğini kontrol eder
 * @param token - Sıfırlama token'ı
 * @returns Token geçerli mi
 */
export async function validateResetToken(token: string): Promise<boolean> {
  try {
    const resetRequest = await PasswordResetHelper.findOne({ token, used: false });

    if (!resetRequest) {
      return false;
    }

    if (resetRequest.expires < new Date()) {
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Token doğrulama hatası', { error: (error as Error).message, token });
    return false;
  }
}

export default {
  createPasswordResetRequest,
  resetPassword,
  validateResetToken
};
