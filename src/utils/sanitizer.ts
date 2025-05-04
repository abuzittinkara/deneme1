/**
 * src/utils/sanitizer.ts
 * Kullanıcı girdilerini sanitize etmek için yardımcı fonksiyonlar
 */
import { logger } from './logger';
import sanitizeHtml from 'sanitize-html';
import validator from 'validator';
import path from 'path';

/**
 * HTML karakterlerini escape eder
 *
 * @param html - HTML metni
 * @returns Escape edilmiş metin
 */
export function escapeHtml(html: string | undefined | null): string {
  if (!html) return '';

  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * XSS saldırılarına karşı metni temizler
 *
 * @param text - Temizlenecek metin
 * @returns Temizlenmiş metin
 */
export function sanitizeXss(text: string | undefined | null): string {
  if (!text) return '';

  try {
    // sanitize-html kütüphanesini kullan
    return sanitizeHtml(text, {
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
        'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
        'b', 'i', 'strong', 'em', 'mark', 'small', 'del', 'ins', 'sub', 'sup',
        'a', 'img', 'span', 'div'
      ],
      allowedAttributes: {
        a: ['href', 'target', 'rel', 'title'],
        img: ['src', 'alt', 'title', 'width', 'height'],
        '*': ['class', 'id', 'style']
      },
      allowedStyles: {
        '*': {
          'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
          'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
          'font-size': [/^\d+(?:px|em|rem|%)$/]
        }
      }
    });
  } catch (error) {
    logger.error('HTML sanitizasyon hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      input: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    // Hata durumunda tüm HTML etiketlerini kaldır
    return text.replace(/<[^>]*>/g, '');
  }
}

/**
 * SQL enjeksiyonlarına karşı metni temizler
 *
 * @param text - Temizlenecek metin
 * @returns Temizlenmiş metin
 */
export function sanitizeSql(text: string | undefined | null): string {
  if (!text) return '';

  return text
    .replace(/'/g, "''")
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\x1a/g, '\\Z');
}

/**
 * URL'yi sanitize eder
 *
 * @param url - Sanitize edilecek URL
 * @returns Sanitize edilmiş URL
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url) return '';

  try {
    // JavaScript URL'lerini engelle
    if (url.toLowerCase().startsWith('javascript:')) {
      logger.warn('JavaScript URL engellendi', { url });
      return '';
    }

    // Data URL'lerini engelle
    if (url.toLowerCase().startsWith('data:')) {
      logger.warn('Data URL engellendi', { url });
      return '';
    }

    // Validator ile URL'yi doğrula
    if (!validator.isURL(url, { require_protocol: true })) {
      // Protokol yoksa, http:// ekle ve tekrar doğrula
      const urlWithProtocol = url.startsWith('http') ? url : `http://${url}`;

      if (!validator.isURL(urlWithProtocol)) {
        logger.warn('Geçersiz URL engellendi', { url });
        return '';
      }

      return urlWithProtocol;
    }

    return url;
  } catch (error) {
    logger.error('URL sanitizasyon hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      url
    });

    return '';
  }
}

/**
 * Dosya adını sanitize eder
 *
 * @param filename - Sanitize edilecek dosya adı
 * @returns Sanitize edilmiş dosya adı
 */
export function sanitizeFilename(filename: string | undefined | null): string {
  if (!filename) return '';

  try {
    // Dosya adını parçalara ayır
    const extname = path.extname(filename);
    const basename = path.basename(filename, extname);

    // Basename'i sanitize et
    const sanitizedBasename = basename
      .replace(/[^\w\s.-]/g, '_') // Alfanümerik olmayan karakterleri _ ile değiştir
      .replace(/\s+/g, '_')       // Boşlukları _ ile değiştir
      .replace(/_{2,}/g, '_')     // Birden fazla _ karakterini tek _ ile değiştir
      .replace(/^[.-]+/g, '_')    // Başlangıçtaki . ve - karakterlerini _ ile değiştir
      .replace(/[.-]+$/g, '_');   // Sondaki . ve - karakterlerini _ ile değiştir

    // Uzantıyı sanitize et
    const sanitizedExtname = extname
      .replace(/[^\w.]/g, '')     // Alfanümerik olmayan karakterleri kaldır
      .toLowerCase();             // Küçük harfe çevir

    // Sanitize edilmiş dosya adını oluştur
    let result = sanitizedBasename + sanitizedExtname;

    // Son kontrol: Sonda nokta varsa kaldır
    result = result.replace(/\.$/, '');

    return result;
  } catch (error) {
    logger.error('Dosya adı sanitizasyon hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      filename
    });

    // Hata durumunda güvenli bir dosya adı döndür
    return 'file_' + Date.now();
  }
}

/**
 * Metni sanitize eder
 *
 * @param input - Sanitize edilecek metin
 * @returns Sanitize edilmiş metin
 */
export function sanitizeText(input: string | undefined | null): string {
  if (!input) return '';

  try {
    // HTML etiketlerini kaldır
    return input.replace(/<[^>]*>/g, '');
  } catch (error) {
    logger.error('Metin sanitizasyon hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      input: input.substring(0, 100) + (input.length > 100 ? '...' : '')
    });

    return '';
  }
}

/**
 * Tüm sanitizasyon fonksiyonlarını uygular
 *
 * @param input - Sanitize edilecek girdi
 * @returns Sanitize edilmiş girdi
 */
export function sanitizeAll(input: string | undefined | null): string {
  if (!input) return '';

  try {
    // Önce XSS temizliği yap
    const xssSanitized = sanitizeXss(input);

    // Sonra SQL sanitize et
    const sqlSanitized = sanitizeSql(xssSanitized);

    // En son HTML escape et
    const htmlEscaped = escapeHtml(sqlSanitized);

    return htmlEscaped;
  } catch (error) {
    logger.error('Genel sanitizasyon hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      input: input.substring(0, 100) + (input.length > 100 ? '...' : '')
    });

    // Hata durumunda tüm HTML etiketlerini kaldır
    return input.replace(/<[^>]*>/g, '');
  }
}

export default {
  escapeHtml,
  sanitizeXss,
  sanitizeSql,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeText,
  sanitizeAll
};
