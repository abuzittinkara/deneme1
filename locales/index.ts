/**
 * locales/index.ts
 * Dil dosyalarını yönetir
 */

import tr from './tr';
import en from './en';

export interface Translations {
  [key: string]: string;
}

export interface LocaleData {
  [locale: string]: Translations;
}

const locales: LocaleData = {
  tr,
  en
};

/**
 * Belirtilen dilde bir metni getirir
 * @param key - Metin anahtarı
 * @param locale - Dil kodu (tr, en)
 * @returns - Çevirisi
 */
export function getText(key: string, locale: string = 'tr'): string {
  if (!locales[locale]) {
    locale = 'tr'; // Varsayılan dil
  }
  
  return locales[locale][key] || key;
}

export default {
  getText,
  locales
};
