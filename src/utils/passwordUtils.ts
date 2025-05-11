/**
 * src/utils/passwordUtils.ts
 * Şifre işlemleri için yardımcı fonksiyonlar
 */
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import zxcvbn from 'zxcvbn';
import { logger } from './logger';

/**
 * Şifre güvenlik seviyesi
 */
export enum PasswordStrength {
  VERY_WEAK = 0,
  WEAK = 1,
  MEDIUM = 2,
  STRONG = 3,
  VERY_STRONG = 4,
}

/**
 * Şifre güvenlik analizi sonucu
 */
export interface PasswordAnalysis {
  score: PasswordStrength;
  feedback: {
    warning: string;
    suggestions: string[];
  };
  isStrong: boolean;
  estimatedCrackTime: string;
  estimatedCrackTimeSeconds: number;
}

/**
 * Şifre hash'i oluşturur
 * @param password - Şifre
 * @returns Şifre hash'i
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Güvenli tuz faktörü (maliyet faktörü)
    const saltRounds = 12;

    // Şifreyi hash'le
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    return hashedPassword;
  } catch (error) {
    logger.error('Şifre hash\'leme hatası', { error: (error as Error).message });
    throw new Error('Şifre hash\'lenemedi');
  }
}

/**
 * Şifre hash'ini doğrular
 * @param password - Şifre
 * @param hash - Şifre hash'i
 * @returns Şifre doğru mu
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    // Şifreyi doğrula
    const isMatch = await bcrypt.compare(password, hash);
    return isMatch;
  } catch (error) {
    logger.error('Şifre doğrulama hatası', { error: (error as Error).message });
    return false;
  }
}

/**
 * Güvenli rastgele şifre oluşturur
 * @param length - Şifre uzunluğu
 * @param options - Şifre seçenekleri
 * @returns Rastgele şifre
 */
export function generateRandomPassword(
  length = 16,
  options: {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
  } = {}
): string {
  try {
    // Varsayılan seçenekler
    const opts = {
      includeUppercase: options.includeUppercase !== false,
      includeLowercase: options.includeLowercase !== false,
      includeNumbers: options.includeNumbers !== false,
      includeSymbols: options.includeSymbols !== false,
    };

    // Karakter kümeleri
    const uppercaseChars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // I ve O hariç
    const lowercaseChars = 'abcdefghijkmnpqrstuvwxyz'; // l ve o hariç
    const numberChars = '23456789'; // 0 ve 1 hariç
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    // Kullanılacak karakter kümesini oluştur
    let chars = '';
    if (opts.includeUppercase) chars += uppercaseChars;
    if (opts.includeLowercase) chars += lowercaseChars;
    if (opts.includeNumbers) chars += numberChars;
    if (opts.includeSymbols) chars += symbolChars;

    // Karakter kümesi boşsa varsayılan olarak tüm karakterleri kullan
    if (!chars) {
      chars = uppercaseChars + lowercaseChars + numberChars;
    }

    // Rastgele şifre oluştur
    const randomBytes = crypto.randomBytes(length * 2);
    let password = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = randomBytes[i] % chars.length;
      password += chars.charAt(randomIndex);
    }

    // Her karakter kümesinden en az bir karakter içerdiğinden emin ol
    let hasUppercase = !opts.includeUppercase;
    let hasLowercase = !opts.includeLowercase;
    let hasNumber = !opts.includeNumbers;
    let hasSymbol = !opts.includeSymbols;

    for (const char of password) {
      if (opts.includeUppercase && uppercaseChars.includes(char)) hasUppercase = true;
      if (opts.includeLowercase && lowercaseChars.includes(char)) hasLowercase = true;
      if (opts.includeNumbers && numberChars.includes(char)) hasNumber = true;
      if (opts.includeSymbols && symbolChars.includes(char)) hasSymbol = true;
    }

    // Eğer herhangi bir karakter kümesinden karakter yoksa, şifreyi yeniden oluştur
    if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
      return generateRandomPassword(length, options);
    }

    return password;
  } catch (error) {
    logger.error('Rastgele şifre oluşturma hatası', { error: (error as Error).message });
    // Hata durumunda basit bir şifre oluştur
    // Hata durumunda bile güvenli rastgele şifre oluştur
    try {
      return crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
    } catch (fallbackError) {
      logger.error('Yedek rastgele şifre oluşturma hatası', {
        error: (fallbackError as Error).message,
      });
      // Son çare olarak basit bir şifre oluştur
      return `Tmp${Date.now().toString(36)}${length}`;
    }
  }
}

/**
 * Şifre güvenliğini analiz eder
 * @param password - Şifre
 * @param userInputs - Kullanıcı girdileri (kullanıcı adı, e-posta vb.)
 * @returns Şifre analizi
 */
export function analyzePassword(password: string, userInputs: string[] = []): PasswordAnalysis {
  try {
    // zxcvbn ile şifre güvenliğini analiz et
    const result = zxcvbn(password, userInputs);

    // Analiz sonucunu dönüştür
    return {
      score: result.score as PasswordStrength,
      feedback: {
        warning: result.feedback.warning || '',
        suggestions: result.feedback.suggestions || [],
      },
      isStrong: result.score >= PasswordStrength.STRONG,
      estimatedCrackTime: result.crack_times_display.offline_slow_hashing_1e4_per_second,
      estimatedCrackTimeSeconds: result.crack_times_seconds.offline_slow_hashing_1e4_per_second,
    };
  } catch (error) {
    logger.error('Şifre analizi hatası', { error: (error as Error).message });

    // Hata durumunda varsayılan analiz sonucu
    return {
      score: PasswordStrength.VERY_WEAK,
      feedback: {
        warning: 'Şifre analizi yapılamadı',
        suggestions: ['Daha güçlü bir şifre seçin'],
      },
      isStrong: false,
      estimatedCrackTime: 'anında',
      estimatedCrackTimeSeconds: 0,
    };
  }
}

/**
 * Şifre sıfırlama token'ı oluşturur
 * @returns Şifre sıfırlama token'ı
 */
export function generatePasswordResetToken(): string {
  try {
    // 32 byte (64 karakter) rastgele token oluştur
    return crypto.randomBytes(32).toString('hex');
  } catch (error) {
    logger.error('Şifre sıfırlama token\'ı oluşturma hatası', { error: (error as Error).message });
    // Hata durumunda bile güvenli alternatif yöntem
    try {
      // UUID v4 kullan (güvenli rastgele sayı üretimi)
      return require('uuid').v4().replace(/-/g, '');
    } catch (fallbackError) {
      logger.error('Yedek token oluşturma hatası', { error: (fallbackError as Error).message });
      // Son çare olarak timestamp ve sabit bir değer kullan
      return `tkn_${Date.now().toString(36)}_${process.pid}_reset`;
    }
  }
}

/**
 * Şifre gereksinimlerini kontrol eder
 * @param password - Şifre
 * @returns Geçerli mi ve hata mesajı
 */
export function validatePasswordRequirements(password: string): {
  isValid: boolean;
  message: string;
} {
  try {
    // Minimum uzunluk
    if (password.length < 8) {
      return { isValid: false, message: 'Şifre en az 8 karakter uzunluğunda olmalıdır' };
    }

    // Büyük harf kontrolü
    if (!/[A-Z]/.test(password)) {
      return { isValid: false, message: 'Şifre en az bir büyük harf içermelidir' };
    }

    // Küçük harf kontrolü
    if (!/[a-z]/.test(password)) {
      return { isValid: false, message: 'Şifre en az bir küçük harf içermelidir' };
    }

    // Rakam kontrolü
    if (!/[0-9]/.test(password)) {
      return { isValid: false, message: 'Şifre en az bir rakam içermelidir' };
    }

    // Özel karakter kontrolü
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      return { isValid: false, message: 'Şifre en az bir özel karakter içermelidir' };
    }

    // Tekrarlayan karakter kontrolü
    if (/(.)\1{2,}/.test(password)) {
      return {
        isValid: false,
        message: 'Şifre aynı karakteri üç veya daha fazla kez tekrar edemez',
      };
    }

    // Sıralı karakter kontrolü
    const sequences = [
      'abcdefghijklmnopqrstuvwxyz',
      '01234567890',
      'qwertyuiop',
      'asdfghjkl',
      'zxcvbnm',
    ];
    for (const seq of sequences) {
      for (let i = 0; i < seq.length - 2; i++) {
        const fragment = seq.substring(i, i + 3);
        if (password.toLowerCase().includes(fragment)) {
          return {
            isValid: false,
            message: 'Şifre sıralı karakterler içeremez (abc, 123, qwe vb.)',
          };
        }
      }
    }

    return { isValid: true, message: 'Şifre gereksinimleri karşılanıyor' };
  } catch (error) {
    logger.error('Şifre gereksinimleri kontrolü hatası', { error: (error as Error).message });
    return { isValid: false, message: 'Şifre gereksinimleri kontrol edilemedi' };
  }
}

export default {
  hashPassword,
  verifyPassword,
  generateRandomPassword,
  analyzePassword,
  generatePasswordResetToken,
  validatePasswordRequirements,
  PasswordStrength,
};
