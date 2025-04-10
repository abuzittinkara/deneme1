/**************************************
 * utils/helpers.js
 * Ortak yardımcı fonksiyonlar
 **************************************/
const { logger } = require('./logger');

/**
 * Bir dizi içindeki benzersiz değerleri döndürür
 * @param {Array} array - Dizi
 * @returns {Array} - Benzersiz değerler dizisi
 */
function uniqueArray(array) {
  return [...new Set(array)];
}

/**
 * Bir nesneyi belirli alanlarla filtreler
 * @param {Object} obj - Nesne
 * @param {Array} fields - Alanlar
 * @returns {Object} - Filtrelenmiş nesne
 */
function filterObject(obj, fields) {
  const result = {};
  
  for (const field of fields) {
    if (obj[field] !== undefined) {
      result[field] = obj[field];
    }
  }
  
  return result;
}

/**
 * Bir nesneyi belirli alanlar hariç filtreler
 * @param {Object} obj - Nesne
 * @param {Array} excludeFields - Hariç tutulacak alanlar
 * @returns {Object} - Filtrelenmiş nesne
 */
function excludeFields(obj, excludeFields) {
  const result = { ...obj };
  
  for (const field of excludeFields) {
    delete result[field];
  }
  
  return result;
}

/**
 * Bir metni belirli bir uzunlukta keser
 * @param {string} text - Metin
 * @param {number} maxLength - Maksimum uzunluk
 * @param {string} [suffix='...'] - Ek
 * @returns {string} - Kesilmiş metin
 */
function truncateText(text, maxLength, suffix = '...') {
  if (!text || text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength) + suffix;
}

/**
 * Bir tarihi formatlar
 * @param {Date} date - Tarih
 * @param {string} [format='YYYY-MM-DD HH:mm:ss'] - Format
 * @returns {string} - Formatlanmış tarih
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
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
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
}

/**
 * Bir tarihten geçen süreyi formatlar
 * @param {Date} date - Tarih
 * @returns {string} - Formatlanmış süre
 */
function timeAgo(date) {
  if (!date) {
    return '';
  }
  
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  
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
 * @param {string} text - Metin
 * @returns {string} - Güvenli metin
 */
function escapeHtml(text) {
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
 * @param {string} text - Metin
 * @returns {string} - Slug
 */
function slugify(text) {
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
 * @param {number} number - Sayı
 * @param {number} [decimals=0] - Ondalık basamak sayısı
 * @param {string} [decimalPoint=','] - Ondalık ayırıcı
 * @param {string} [thousandsSeparator='.'] - Binlik ayırıcı
 * @returns {string} - Formatlanmış sayı
 */
function formatNumber(number, decimals = 0, decimalPoint = ',', thousandsSeparator = '.') {
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
 * @param {number} bytes - Bayt
 * @param {number} [decimals=2] - Ondalık basamak sayısı
 * @returns {string} - Formatlanmış dosya boyutu
 */
function formatFileSize(bytes, decimals = 2) {
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
 * @param {string} text - Metin
 * @returns {string} - Büyük harfli metin
 */
function toUpperCaseTr(text) {
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
 * @param {string} text - Metin
 * @returns {string} - Küçük harfli metin
 */
function toLowerCaseTr(text) {
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
 * @param {string} text - Metin
 * @returns {string} - İlk harfi büyük metin
 */
function capitalizeFirstLetter(text) {
  if (!text) {
    return '';
  }
  
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Bir metni her kelimenin ilk harfi büyük yapar
 * @param {string} text - Metin
 * @returns {string} - Her kelimenin ilk harfi büyük metin
 */
function capitalizeWords(text) {
  if (!text) {
    return '';
  }
  
  return text.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Bir metni rastgele bir ID'ye dönüştürür
 * @param {number} [length=10] - Uzunluk
 * @returns {string} - Rastgele ID
 */
function generateRandomId(length = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * Bir metni şifreler
 * @param {string} text - Metin
 * @param {number} [shift=3] - Kaydırma
 * @returns {string} - Şifrelenmiş metin
 */
function caesarCipher(text, shift = 3) {
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
 * @param {string} text - Şifrelenmiş metin
 * @param {number} [shift=3] - Kaydırma
 * @returns {string} - Çözülmüş metin
 */
function caesarDecipher(text, shift = 3) {
  return caesarCipher(text, 26 - (shift % 26));
}

/**
 * Bir metni belirli bir karakter ile doldurur
 * @param {string} text - Metin
 * @param {number} length - Uzunluk
 * @param {string} [char='0'] - Karakter
 * @param {boolean} [end=false] - Sona ekle
 * @returns {string} - Doldurulmuş metin
 */
function padString(text, length, char = '0', end = false) {
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
 * @param {string} text - Metin
 * @param {number} [visibleChars=4] - Görünür karakter sayısı
 * @param {string} [maskChar='*'] - Maskeleme karakteri
 * @returns {string} - Maskelenmiş metin
 */
function maskString(text, visibleChars = 4, maskChar = '*') {
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
 * @param {string} email - E-posta adresi
 * @returns {string} - Maskelenmiş e-posta adresi
 */
function maskEmail(email) {
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
 * @param {string} phone - Telefon numarası
 * @returns {string} - Maskelenmiş telefon numarası
 */
function maskPhone(phone) {
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
 * @param {string} html - HTML metni
 * @param {number} maxLength - Maksimum uzunluk
 * @param {string} [suffix='...'] - Ek
 * @returns {string} - Kesilmiş metin
 */
function truncateHtml(html, maxLength, suffix = '...') {
  if (!html) {
    return '';
  }
  
  // HTML etiketlerini temizle
  const text = html.replace(/<[^>]*>/g, '');
  
  return truncateText(text, maxLength, suffix);
}

/**
 * Bir metni belirli bir karakter ile böler
 * @param {string} text - Metin
 * @param {string} [separator=','] - Ayırıcı
 * @returns {Array} - Bölünmüş metin dizisi
 */
function splitText(text, separator = ',') {
  if (!text) {
    return [];
  }
  
  return text.split(separator).map(item => item.trim()).filter(Boolean);
}

/**
 * Bir diziyi belirli bir karakter ile birleştirir
 * @param {Array} array - Dizi
 * @param {string} [separator=', '] - Ayırıcı
 * @returns {string} - Birleştirilmiş metin
 */
function joinArray(array, separator = ', ') {
  if (!array || !Array.isArray(array)) {
    return '';
  }
  
  return array.join(separator);
}

/**
 * Bir metni belirli bir karakter ile böler ve benzersiz değerleri döndürür
 * @param {string} text - Metin
 * @param {string} [separator=','] - Ayırıcı
 * @returns {Array} - Benzersiz değerler dizisi
 */
function splitUnique(text, separator = ',') {
  return uniqueArray(splitText(text, separator));
}

/**
 * Bir metni belirli bir karakter ile böler ve sayısal değerleri döndürür
 * @param {string} text - Metin
 * @param {string} [separator=','] - Ayırıcı
 * @returns {Array} - Sayısal değerler dizisi
 */
function splitNumbers(text, separator = ',') {
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
 * @param {string} text - Metin
 * @param {string} [separator=','] - Ayırıcı
 * @returns {Array} - Boolean değerler dizisi
 */
function splitBooleans(text, separator = ',') {
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
 * @param {string} text - Metin
 * @param {string} [separator=','] - Ayırıcı
 * @returns {Array} - Tarih değerleri dizisi
 */
function splitDates(text, separator = ',') {
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
 * @param {string} text - Metin
 * @param {string} [separator=','] - Ayırıcı
 * @returns {Array} - JSON değerleri dizisi
 */
function splitJson(text, separator = ',') {
  if (!text) {
    return [];
  }
  
  return text.split(separator)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      try {
        return JSON.parse(item);
      } catch (error) {
        logger.error('JSON parse hatası', { error: error.message, item });
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = {
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
