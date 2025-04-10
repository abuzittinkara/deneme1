/**************************************
 * utils/errorHandlers.js
 * Hata yönetimi yardımcıları
 **************************************/
const { logger } = require('./logger');

/**
 * Socket hata işleyicisi
 * @param {Error} err - Hata nesnesi
 * @param {string} logMessage - Günlüğe kaydedilecek mesaj
 * @param {Object} socket - Socket nesnesi
 * @param {Function} callback - Callback fonksiyonu
 */
function handleSocketError(err, logMessage, socket, callback) {
  logger.error(`${logMessage}:`, { error: err.message, stack: err.stack });
  
  const errorResponse = {
    success: false,
    message: err.message || 'Bir hata oluştu.'
  };
  
  if (callback && typeof callback === 'function') {
    callback(errorResponse);
  } else {
    socket.emit('error', errorResponse);
  }
}

/**
 * API hata işleyicisi
 * @param {Error} err - Hata nesnesi
 * @param {Object} res - Express yanıt nesnesi
 */
function handleApiError(err, res) {
  logger.error(`API Hatası:`, { error: err.message, stack: err.stack });
  
  const statusCode = err.statusCode || 500;
  const errorResponse = {
    success: false,
    message: err.message || 'Sunucu hatası.'
  };
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Genel hata işleyicisi
 * @param {Error} err - Hata nesnesi
 * @param {string} logMessage - Günlüğe kaydedilecek mesaj
 */
function handleError(err, logMessage) {
  logger.error(`${logMessage}:`, { error: err.message, stack: err.stack });
}

module.exports = {
  handleSocketError,
  handleApiError,
  handleError
};
