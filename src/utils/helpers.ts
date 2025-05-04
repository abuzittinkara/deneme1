/**
 * src/utils/helpers.ts
 * Ortak yardımcı fonksiyonlar
 */
import { logger } from './logger';

/**
 * Bir dizi içindeki benzersiz değerleri döndürür
 * @param array - Dizi
 * @returns Benzersiz değerler dizisi
 */
export function uniqueArray<T>(array: T[]): T[] {
  return [...new Set(array)];
}

/**
 * Bir nesneyi belirli alanlarla filtreler
 * @param obj - Nesne
 * @param fields - Alanlar
 * @returns Filtrelenmiş nesne
 */
export function filterObject<T extends Record<string, any>>(obj: T, fields: string[]): Partial<T> {
  const result = {} as Partial<T>;

  for (const field of fields) {
    if (obj[field] !== undefined) {
      result[field as keyof T] = obj[field];
    }
  }

  return result;
}

/**
 * Bir nesneyi belirli alanlar hariç filtreler
 * @param obj - Nesne
 * @param excludeFields - Hariç tutulacak alanlar
 * @returns Filtrelenmiş nesne
 */
export function excludeFields<T extends Record<string, any>>(obj: T, excludeFields: string[]): Partial<T> {
  const result = { ...obj } as Partial<T>;

  for (const field of excludeFields) {
    delete result[field as keyof T];
  }

  return result;
}

/**
 * Bir metni belirli bir uzunlukta keser
 * @param text - Metin
 * @param maxLength - Maksimum uzunluk
 * @param suffix - Ek
 * @returns Kesilmiş metin
 */
export function truncateText(text: string, maxLength: number, suffix = '...'): string {
  if (!text || text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength) + suffix;
}

/**
 * Bir tarihi formatlar
 * @param date - Tarih
 * @param format - Format
 * @returns Formatlanmış tarih
 */
export function formatDate(date: Date | string | number | null | undefined, format = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!date) {
    return '';
  }

  const d = new Date(date);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year.toString())
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Bir tarihten geçen süreyi formatlar
 * @param date - Tarih
 * @returns Formatlanmış süre
 */
export function timeAgo(date: Date | string | number | null | undefined): string {
  if (!date) {
    return '';
  }

  const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

  let interval = Math.floor(seconds / 31536000);
  if (interval > 1) {
    return `${interval} yıl önce`;
  }

  interval = Math.floor(seconds / 2592000);
  if (interval > 1) {
    return `${interval} ay önce`;
  }

  interval = Math.floor(seconds / 86400);
  if (interval > 1) {
    return `${interval} gün önce`;
  }

  interval = Math.floor(seconds / 3600);
  if (interval > 1) {
    return `${interval} saat önce`;
  }

  interval = Math.floor(seconds / 60);
  if (interval > 1) {
    return `${interval} dakika önce`;
  }

  if (seconds < 10) {
    return 'şimdi';
  }

  return `${Math.floor(seconds)} saniye önce`;
}

/**
 * Bir metni güvenli hale getirir (HTML escape)
 * @param text - Metin
 * @returns Güvenli metin
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Bir metni slug haline getirir
 * @param text - Metin
 * @returns Slug
 */
export function slugify(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Bir sayıyı formatlar
 * @param number - Sayı
 * @param decimals - Ondalık basamak sayısı
 * @param decimalPoint - Ondalık ayırıcı
 * @param thousandsSeparator - Binlik ayırıcı
 * @returns Formatlanmış sayı
 */
export function formatNumber(
  number: number | string | null | undefined,
  decimals = 0,
  decimalPoint = ',',
  thousandsSeparator = '.'
): string {
  if (number === null || number === undefined) {
    return '';
  }

  const n = Number(number).toFixed(decimals);
  const parts = n.split('.');

  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

  return parts.join(decimalPoint);
}

/**
 * Bir dosya boyutunu formatlar
 * @param bytes - Bayt
 * @param decimals - Ondalık basamak sayısı
 * @returns Formatlanmış dosya boyutu
 */
export function formatFileSize(bytes: number, decimals = 2): string {
  if (bytes === 0) {
    return '0 Bayt';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bayt', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Bir metni büyük harfe çevirir (Türkçe karakterler dahil)
 * @param text - Metin
 * @returns Büyük harfli metin
 */
export function toUpperCaseTr(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text
    .replace(/i/g, 'İ')
    .replace(/ı/g, 'I')
    .toUpperCase();
}

/**
 * Bir metni küçük harfe çevirir (Türkçe karakterler dahil)
 * @param text - Metin
 * @returns Küçük harfli metin
 */
export function toLowerCaseTr(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase();
}

/**
 * Bir metni ilk harfi büyük yapar
 * @param text - Metin
 * @returns İlk harfi büyük metin
 */
export function capitalizeFirstLetter(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Bir metni her kelimenin ilk harfi büyük yapar
 * @param text - Metin
 * @returns Her kelimenin ilk harfi büyük metin
 */
export function capitalizeWords(text: string | null | undefined): string {
  if (!text) {
    return '';
  }

  return text.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Bir metni rastgele bir ID'ye dönüştürür
 * @param length - Uzunluk
 * @returns Rastgele ID
 */
export function generateRandomId(length = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';

  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
}

/**
 * Bir metni şifreler
 * @param text - Metin
 * @param shift - Kaydırma
 * @returns Şifrelenmiş metin
 */
export function caesarCipher(text: string | null | undefined, shift = 3): string {
  if (!text) {
    return '';
  }

  return text.split('').map(char => {
    const code = char.charCodeAt(0);

    // Büyük harf (A-Z)
    if (code >= 65 && code <= 90) {
      return String.fromCharCode(((code - 65 + shift) % 26) + 65);
    }

    // Küçük harf (a-z)
    if (code >= 97 && code <= 122) {
      return String.fromCharCode(((code - 97 + shift) % 26) + 97);
    }

    return char;
  }).join('');
}

/**
 * Bir metni şifresini çözer
 * @param text - Şifrelenmiş metin
 * @param shift - Kaydırma
 * @returns Çözülmüş metin
 */
export function caesarDecipher(text: string | null | undefined, shift = 3): string {
  return caesarCipher(text, 26 - (shift % 26));
}

/**
 * Bir metni belirli bir karakter ile doldurur
 * @param text - Metin
 * @param length - Uzunluk
 * @param char - Karakter
 * @param end - Sona ekle
 * @returns Doldurulmuş metin
 */
export function padString(text: string | null | undefined, length: number, char = '0', end = false): string {
  if (!text) {
    return ''.padStart(length, char);
  }

  if (text.length >= length) {
    return text;
  }

  if (end) {
    return text.padEnd(length, char);
  }

  return text.padStart(length, char);
}

/**
 * Bir metni belirli bir karakter ile maskeler
 * @param text - Metin
 * @param visibleChars - Görünür karakter sayısı
 * @param maskChar - Maskeleme karakteri
 * @returns Maskelenmiş metin
 */
export function maskString(text: string | null | undefined, visibleChars = 4, maskChar = '*'): string {
  if (!text) {
    return '';
  }

  if (text.length <= visibleChars) {
    return text;
  }

  const visiblePart = text.slice(-visibleChars);
  const maskedPart = maskChar.repeat(text.length - visibleChars);

  return maskedPart + visiblePart;
}

/**
 * Bir e-posta adresini maskeler
 * @param email - E-posta adresi
 * @returns Maskelenmiş e-posta adresi
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) {
    return '';
  }

  const parts = email.split('@');

  if (parts.length !== 2) {
    return email;
  }

  const username = parts[0];
  const domain = parts[1];

  const maskedUsername = username.charAt(0) + '*'.repeat(username.length - 2) + username.charAt(username.length - 1);

  return maskedUsername + '@' + domain;
}

/**
 * Bir telefon numarasını maskeler
 * @param phone - Telefon numarası
 * @returns Maskelenmiş telefon numarası
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) {
    return '';
  }

  // Sadece rakamları al
  const digits = phone.replace(/\D/g, '');

  if (digits.length < 4) {
    return phone;
  }

  const lastFour = digits.slice(-4);
  const maskedPart = '*'.repeat(digits.length - 4);

  return maskedPart + lastFour;
}

/**
 * Bir metni belirli bir uzunlukta keser ve HTML etiketlerini temizler
 * @param html - HTML metni
 * @param maxLength - Maksimum uzunluk
 * @param suffix - Ek
 * @returns Kesilmiş metin
 */
export function truncateHtml(html: string | null | undefined, maxLength: number, suffix = '...'): string {
  if (!html) {
    return '';
  }

  // HTML etiketlerini temizle
  const text = html.replace(/<[^>]*>/g, '');

  return truncateText(text, maxLength, suffix);
}

/**
 * Bir metni belirli bir karakter ile böler
 * @param text - Metin
 * @param separator - Ayırıcı
 * @returns Bölünmüş metin dizisi
 */
export function splitText(text: string | null | undefined, separator = ','): string[] {
  if (!text) {
    return [];
  }

  return text.split(separator).map(item => item.trim()).filter(Boolean);
}

/**
 * Bir diziyi belirli bir karakter ile birleştirir
 * @param array - Dizi
 * @param separator - Ayırıcı
 * @returns Birleştirilmiş metin
 */
export function joinArray<T>(array: T[] | null | undefined, separator = ', '): string {
  if (!array || !Array.isArray(array)) {
    return '';
  }

  return array.join(separator);
}

/**
 * Bir metni belirli bir karakter ile böler ve benzersiz değerleri döndürür
 * @param text - Metin
 * @param separator - Ayırıcı
 * @returns Benzersiz değerler dizisi
 */
export function splitUnique(text: string | null | undefined, separator = ','): string[] {
  return uniqueArray(splitText(text, separator));
}

/**
 * Bir metni belirli bir karakter ile böler ve sayısal değerleri döndürür
 * @param text - Metin
 * @param separator - Ayırıcı
 * @returns Sayısal değerler dizisi
 */
export function splitNumbers(text: string | null | undefined, separator = ','): number[] {
  if (!text) {
    return [];
  }

  return text.split(separator)
    .map(item => item.trim())
    .filter(Boolean)
    .map(Number)
    .filter(num => !isNaN(num));
}

/**
 * Bir metni belirli bir karakter ile böler ve boolean değerleri döndürür
 * @param text - Metin
 * @param separator - Ayırıcı
 * @returns Boolean değerler dizisi
 */
export function splitBooleans(text: string | null | undefined, separator = ','): boolean[] {
  if (!text) {
    return [];
  }

  return text.split(separator)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .map(item => item === 'true' || item === '1' || item === 'yes' || item === 'evet');
}

/**
 * Bir metni belirli bir karakter ile böler ve tarih değerleri döndürür
 * @param text - Metin
 * @param separator - Ayırıcı
 * @returns Tarih değerleri dizisi
 */
export function splitDates(text: string | null | undefined, separator = ','): Date[] {
  if (!text) {
    return [];
  }

  return text.split(separator)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => new Date(item))
    .filter(date => !isNaN(date.getTime()));
}

/**
 * Bir metni belirli bir karakter ile böler ve JSON değerleri döndürür
 * @param text - Metin
 * @param separator - Ayırıcı
 * @returns JSON değerleri dizisi
 */
export function splitJson<T = any>(text: string | null | undefined, separator = ','): T[] {
  if (!text) {
    return [];
  }

  return text.split(separator)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      try {
        return JSON.parse(item) as T;
      } catch (error) {
        logger.error('JSON parse hatası', { error: (error as Error).message, item });
        return null;
      }
    })
    .filter((item): item is T => item !== null);
}

export default {
  uniqueArray,
  filterObject,
  excludeFields,
  truncateText,
  formatDate,
  timeAgo,
  escapeHtml,
  slugify,
  formatNumber,
  formatFileSize,
  toUpperCaseTr,
  toLowerCaseTr,
  capitalizeFirstLetter,
  capitalizeWords,
  generateRandomId,
  caesarCipher,
  caesarDecipher,
  padString,
  maskString,
  maskEmail,
  maskPhone,
  truncateHtml,
  splitText,
  joinArray,
  splitUnique,
  splitNumbers,
  splitBooleans,
  splitDates,
  splitJson
};
