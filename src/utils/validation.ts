/**
 * src/utils/validation.ts
 * Doğrulama yardımcıları
 */
import sanitizeHtml from 'sanitize-html';

/**
 * E-posta adresini doğrular
 * @param email - Doğrulanacak e-posta adresi
 * @returns Doğrulama sonucu
 */
export function validateEmail(email: string): boolean {
  if (!email) return false;

  // RFC 5322 standardına uygun e-posta regex'i
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email);
}

/**
 * Şifreyi doğrular
 * @param password - Doğrulanacak şifre
 * @returns Doğrulama sonucu
 */
export function validatePassword(password: string): boolean {
  if (!password) return false;

  // En az 8 karakter, en az bir büyük harf, bir küçük harf ve bir rakam
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
}

/**
 * Kullanıcı adını doğrular
 * @param username - Doğrulanacak kullanıcı adı
 * @returns Doğrulama sonucu
 */
export function validateUsername(username: string): boolean {
  if (!username) return false;

  // Alfanümerik karakterler, nokta, tire ve alt çizgi içerebilir, 1-30 karakter arası
  const usernameRegex = /^[a-zA-Z0-9._-]{1,30}$/;
  return usernameRegex.test(username);
}

/**
 * Grup adını doğrular
 * @param groupName - Doğrulanacak grup adı
 * @returns Doğrulama sonucu
 */
export function validateGroupName(groupName: string): boolean {
  if (!groupName) return false;

  // Alfanümerik karakterler, boşluk, tire ve alt çizgi içerebilir, 1-50 karakter arası
  const groupNameRegex = /^[a-zA-Z0-9 _-]{1,50}$/;
  return groupNameRegex.test(groupName);
}

/**
 * Kanal adını doğrular
 * @param channelName - Doğrulanacak kanal adı
 * @returns Doğrulama sonucu
 */
export function validateChannelName(channelName: string): boolean {
  if (!channelName) return false;

  // Alfanümerik karakterler, tire ve alt çizgi içerebilir, 1-30 karakter arası
  const channelNameRegex = /^[a-zA-Z0-9_-]{1,30}$/;
  return channelNameRegex.test(channelName);
}

/**
 * Girdiyi temizler ve güvenli hale getirir
 * @param input - Temizlenecek girdi
 * @returns Temizlenmiş girdi
 */
export function sanitizeInput(input: string): string {
  if (input === null || input === undefined) return '';

  // String olmayan girdileri string'e çevir
  if (typeof input !== 'string') {
    input = String(input);
  }

  // HTML içeriğini temizle
  return sanitizeHtml(input, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol',
      'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div',
      'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre', 'img', 'span'
    ],
    allowedAttributes: {
      a: ['href', 'name', 'target'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      div: ['class', 'id'],
      span: ['class', 'id'],
      p: ['class'],
      table: ['class'],
      th: ['scope']
    },
    // JavaScript URL'lerini engelle
    allowedSchemes: ['http', 'https', 'ftp', 'mailto'],
    // Tehlikeli CSS özelliklerini engelle
    allowedStyles: {}
  });
}
