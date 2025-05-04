/**************************************
 * modules/userManager.js
 * Kullanıcı yönetimi ile ilgili tüm işlevleri içerir
 * NOT: Bu modül artık daha küçük, odaklanmış modüllere bölünmüştür.
 * Geriye dönük uyumluluk için korunmuştur.
 **************************************/
const authManager = require('./auth/authManager');
const friendManager = require('./user/friendManager');
const blockManager = require('./user/blockManager');
const membershipManager = require('./group/membershipManager');
const { logger } = require('../utils/logger');

// Geriye dönük uyumluluk için orijinal fonksiyonları dışa aktar
module.exports = {
  // Auth Manager'dan
  registerUser: authManager.registerUser,
  loginUser: authManager.loginUser,

  // Membership Manager'dan
  removeUserFromAllGroupsAndRooms: membershipManager.removeUserFromAllGroupsAndRooms,

  // Friend Manager'dan
  getUserFriends: friendManager.getUserFriends,

  // Block Manager'dan
  getUserBlocked: blockManager.getUserBlocked,
  blockUser: blockManager.blockUser,
  unblockUser: blockManager.unblockUser
};

// Kullanım günlüğü
logger.info('userManager.js modülü yüklendi (geriye dönük uyumluluk modu)');
