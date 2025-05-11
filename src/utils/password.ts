/**
 * src/utils/password.ts
 * Şifre işlemleri için yardımcı fonksiyonlar
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { logger } from './logger';

/**
 * Şifre güvenlik seviyeleri
 */
export enum PasswordStrength {
  VERY_WEAK = 'very_weak',
  WEAK = 'weak',
  MEDIUM = 'medium',
  STRONG = 'strong',
  VERY_STRONG = 'very_strong',
}

/**
 * Şifre hash'ler
 * @param password - Şifre
 * @returns Hash'lenmiş şifre
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Bcrypt için salt round sayısı
    const saltRounds = 12;

    // Şifreyi hash'le
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    return hashedPassword;
  } catch (error) {
    logger.error('Şifre hash\'leme hatası', {
      error: (error as Error).message,
    });
    throw new Error('Şifre hash\'leme hatası');
  }
}

/**
 * Şifre doğrular
 * @param password - Şifre
 * @param hashedPassword - Hash'lenmiş şifre
 * @returns Şifre doğru mu
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  try {
    // Şifreyi doğrula
    const isMatch = await bcrypt.compare(password, hashedPassword);

    return isMatch;
  } catch (error) {
    logger.error('Şifre doğrulama hatası', {
      error: (error as Error).message,
    });
    return false;
  }
}

/**
 * Şifre sıfırlama token'ı oluşturur
 * @returns Şifre sıfırlama token'ı
 */
export function generateResetToken(): string {
  try {
    // 32 byte (64 karakter) token oluştur
    const token = crypto.randomBytes(32).toString('hex');

    return token;
  } catch (error) {
    logger.error('Şifre sıfırlama token\'ı oluşturma hatası', {
      error: (error as Error).message,
    });
    throw new Error('Şifre sıfırlama token\'ı oluşturma hatası');
  }
}

/**
 * Şifre sıfırlama token'ı hash'ler
 * @param token - Şifre sıfırlama token'ı
 * @returns Hash'lenmiş token
 */
export function hashResetToken(token: string): string {
  try {
    // Token'ı SHA-256 ile hash'le
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    return hashedToken;
  } catch (error) {
    logger.error('Token hash\'leme hatası', {
      error: (error as Error).message,
    });
    throw new Error('Token hash\'leme hatası');
  }
}

/**
 * Şifre gücünü kontrol eder
 * @param password - Şifre
 * @returns Şifre gücü
 */
export function checkPasswordStrength(password: string): {
  strength: PasswordStrength;
  score: number;
  feedback: string[];
} {
  // Şifre uzunluğu
  const length = password.length;

  // Şifre içeriği
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumbers = /[0-9]/.test(password);
  const hasSpecialChars = /[^a-zA-Z0-9]/.test(password);

  // Şifre gücü puanı (0-100)
  let score = 0;
  const feedback: string[] = [];

  // Uzunluk puanı (maksimum 40 puan)
  if (length < 8) {
    score += length * 2.5;
    feedback.push('Şifre çok kısa, en az 8 karakter olmalı');
  } else if (length < 12) {
    score += 20 + (length - 8) * 5;
  } else {
    score += 40;
  }

  // Karakter çeşitliliği puanı (maksimum 60 puan)
  if (hasLowercase) score += 10;
  else feedback.push('Küçük harf ekleyin');

  if (hasUppercase) score += 15;
  else feedback.push('Büyük harf ekleyin');

  if (hasNumbers) score += 15;
  else feedback.push('Rakam ekleyin');

  if (hasSpecialChars) score += 20;
  else feedback.push('Özel karakter ekleyin');

  // Şifre gücü seviyesi
  let strength: PasswordStrength;

  if (score < 20) {
    strength = PasswordStrength.VERY_WEAK;
    if (feedback.length === 0) feedback.push('Şifre çok zayıf');
  } else if (score < 40) {
    strength = PasswordStrength.WEAK;
    if (feedback.length === 0) feedback.push('Şifre zayıf');
  } else if (score < 60) {
    strength = PasswordStrength.MEDIUM;
    if (feedback.length === 0) feedback.push('Şifre orta güçte');
  } else if (score < 80) {
    strength = PasswordStrength.STRONG;
    if (feedback.length === 0) feedback.push('Şifre güçlü');
  } else {
    strength = PasswordStrength.VERY_STRONG;
    if (feedback.length === 0) feedback.push('Şifre çok güçlü');
  }

  return {
    strength,
    score,
    feedback,
  };
}

/**
 * Güvenli rastgele şifre oluşturur
 * @param length - Şifre uzunluğu
 * @param options - Şifre oluşturma seçenekleri
 * @returns Rastgele şifre
 */
export function generateRandomPassword(
  length = 12,
  options = {
    includeLowercase: true,
    includeUppercase: true,
    includeNumbers: true,
    includeSpecialChars: true,
  }
): string {
  try {
    // Karakter setleri
    const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
    const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numberChars = '0123456789';
    const specialChars = '!@#$%^&*()_+~`|}{[]:;?><,./-=';

    // Kullanılacak karakter seti
    let chars = '';
    if (options.includeLowercase) chars += lowercaseChars;
    if (options.includeUppercase) chars += uppercaseChars;
    if (options.includeNumbers) chars += numberChars;
    if (options.includeSpecialChars) chars += specialChars;

    // En az bir karakter seti seçilmeli
    if (chars.length === 0) {
      chars = lowercaseChars + numberChars;
    }

    // Rastgele şifre oluştur
    let password = '';
    const randomBytes = crypto.randomBytes(length);

    for (let i = 0; i < length; i++) {
      const randomIndex = randomBytes[i] % chars.length;
      password += chars.charAt(randomIndex);
    }

    // Her karakter setinden en az bir karakter içerdiğinden emin ol
    let hasLowercase = !options.includeLowercase;
    let hasUppercase = !options.includeUppercase;
    let hasNumbers = !options.includeNumbers;
    let hasSpecialChars = !options.includeSpecialChars;

    for (const char of password) {
      if (options.includeLowercase && lowercaseChars.includes(char)) hasLowercase = true;
      if (options.includeUppercase && uppercaseChars.includes(char)) hasUppercase = true;
      if (options.includeNumbers && numberChars.includes(char)) hasNumbers = true;
      if (options.includeSpecialChars && specialChars.includes(char)) hasSpecialChars = true;
    }

    // Eksik karakter setlerini ekle
    if (!hasLowercase || !hasUppercase || !hasNumbers || !hasSpecialChars) {
      return generateRandomPassword(length, options);
    }

    return password;
  } catch (error) {
    logger.error('Rastgele şifre oluşturma hatası', {
      error: (error as Error).message,
    });
    throw new Error('Rastgele şifre oluşturma hatası');
  }
}

export default {
  hashPassword,
  verifyPassword,
  generateResetToken,
  hashResetToken,
  checkPasswordStrength,
  generateRandomPassword,
};
