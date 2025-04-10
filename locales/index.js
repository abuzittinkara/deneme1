/**************************************
 * locales/index.js
 * Dil dosyalarını yönetir
 **************************************/

const tr = require('./tr');
const en = require('./en');

const locales = {
  tr,
  en
};

/**
 * Belirtilen dilde bir metni getirir
 * @param {string} key - Metin anahtarı
 * @param {string} locale - Dil kodu (tr, en)
 * @returns {string} - Çevirisi
 */
function getText(key, locale = 'tr') {
  if (!locales[locale]) {
    locale = 'tr'; // Varsayılan dil
  }
  
  return locales[locale][key] || key;
}

module.exports = {
  getText,
  locales
};
