/**
 * src/utils/i18n.ts
 * Çoklu dil desteği için yardımcı sınıf
 */
import { logger } from './logger';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

// Desteklenen diller
export const SUPPORTED_LANGUAGES = ['tr', 'en'];

// Varsayılan dil
export const DEFAULT_LANGUAGE = 'tr';

// Dil çevirileri
const translations: Record<string, Record<string, any>> = {};

/**
 * Dil dosyalarını yükler
 */
export function loadTranslations(): void {
  try {
    // Dil dosyalarını yükle
    for (const lang of SUPPORTED_LANGUAGES) {
      const filePath = path.join(__dirname, '..', 'locales', `${lang}.json`);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        translations[lang] = JSON.parse(content);
        
        logger.info(`${lang} dil dosyası yüklendi`);
      } else {
        logger.warn(`${lang} dil dosyası bulunamadı: ${filePath}`);
      }
    }
    
    // Varsayılan dil dosyasını kontrol et
    if (!translations[DEFAULT_LANGUAGE]) {
      logger.error(`Varsayılan dil dosyası (${DEFAULT_LANGUAGE}) bulunamadı`);
      throw new Error(`Varsayılan dil dosyası (${DEFAULT_LANGUAGE}) bulunamadı`);
    }
  } catch (error) {
    logger.error('Dil dosyaları yüklenirken hata oluştu', { error: (error as Error).message });
    throw error;
  }
}

/**
 * Çeviri yapar
 * @param key Çeviri anahtarı (örn: "common.welcome")
 * @param lang Dil kodu
 * @param params Çeviri parametreleri
 * @returns Çevrilmiş metin
 */
export function translate(key: string, lang: string = DEFAULT_LANGUAGE, params: Record<string, any> = {}): string {
  try {
    // Dil kodunu kontrol et
    const language = SUPPORTED_LANGUAGES.includes(lang) ? lang : DEFAULT_LANGUAGE;
    
    // Çeviriyi bul
    const keys = key.split('.');
    let translation: any = translations[language];
    
    for (const k of keys) {
      if (!translation || !translation[k]) {
        // Çeviri bulunamadı, varsayılan dilde dene
        if (language !== DEFAULT_LANGUAGE) {
          return translate(key, DEFAULT_LANGUAGE, params);
        }
        
        // Varsayılan dilde de bulunamadı, anahtarı döndür
        return key;
      }
      
      translation = translation[k];
    }
    
    // Çeviri bir string değilse, anahtarı döndür
    if (typeof translation !== 'string') {
      return key;
    }
    
    // Parametreleri değiştir
    let result = translation;
    
    for (const [paramKey, paramValue] of Object.entries(params)) {
      result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), paramValue);
    }
    
    return result;
  } catch (error) {
    logger.error('Çeviri yapılırken hata oluştu', { 
      error: (error as Error).message,
      key,
      lang
    });
    
    return key;
  }
}

/**
 * Kısaltılmış çeviri fonksiyonu
 * @param key Çeviri anahtarı
 * @param params Çeviri parametreleri
 * @returns Çevrilmiş metin
 */
export function t(key: string, params: Record<string, any> = {}): string {
  // Kullanıcı dili veya varsayılan dil
  const lang = env.DEFAULT_LANGUAGE || DEFAULT_LANGUAGE;
  return translate(key, lang, params);
}

/**
 * Dil kodunu değiştirir
 * @param lang Yeni dil kodu
 * @returns Başarılı mı?
 */
export function changeLanguage(lang: string): boolean {
  if (SUPPORTED_LANGUAGES.includes(lang)) {
    env.DEFAULT_LANGUAGE = lang;
    logger.info(`Dil değiştirildi: ${lang}`);
    return true;
  }
  
  logger.warn(`Desteklenmeyen dil: ${lang}`);
  return false;
}

/**
 * Mevcut dil kodunu döndürür
 * @returns Dil kodu
 */
export function getCurrentLanguage(): string {
  return env.DEFAULT_LANGUAGE || DEFAULT_LANGUAGE;
}

/**
 * Desteklenen dilleri döndürür
 * @returns Desteklenen diller
 */
export function getSupportedLanguages(): string[] {
  return SUPPORTED_LANGUAGES;
}

// Dil dosyalarını yükle
loadTranslations();

export default {
  translate,
  t,
  changeLanguage,
  getCurrentLanguage,
  getSupportedLanguages,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
