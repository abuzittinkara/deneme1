/**************************************
 * utils/logger.js
 * Günlükleme yardımcısı
 **************************************/

/**
 * Basit günlükleme fonksiyonları
 */
const logger = {
  /**
   * Bilgi mesajı günlükler
   * @param {string} message - Günlük mesajı
   * @param {Object} [data] - İlgili veri
   */
  info: (message, data) => {
    console.log(`[INFO] ${message}`, data ? data : '');
  },
  
  /**
   * Uyarı mesajı günlükler
   * @param {string} message - Günlük mesajı
   * @param {Object} [data] - İlgili veri
   */
  warn: (message, data) => {
    console.warn(`[WARN] ${message}`, data ? data : '');
  },
  
  /**
   * Hata mesajı günlükler
   * @param {string} message - Günlük mesajı
   * @param {Object} [data] - İlgili veri
   */
  error: (message, data) => {
    console.error(`[ERROR] ${message}`, data ? data : '');
  },
  
  /**
   * Hata ayıklama mesajı günlükler
   * @param {string} message - Günlük mesajı
   * @param {Object} [data] - İlgili veri
   */
  debug: (message, data) => {
    if (process.env.DEBUG) {
      console.debug(`[DEBUG] ${message}`, data ? data : '');
    }
  }
};

module.exports = { logger };
