/**
 * src/modules/userManager.ts
 * Kullanıcı yönetimi ile ilgili tüm işlevleri içerir
 * NOT: Bu modül artık daha küçük, odaklanmış modüllere bölünmüştür.
 * Geriye dönük uyumluluk için korunmuştur.
 */
import * as authManager from './auth/authManager';
import * as friendManager from './user/friendManager';
import * as blockManager from './user/blockManager';
import * as membershipManager from './group/membershipManager';
import { logger } from '../utils/logger';

// Geriye dönük uyumluluk için orijinal fonksiyonları dışa aktar
const userManager = {
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
  unblockUser: blockManager.unblockUser,
};

// Kullanım günlüğü
logger.info('userManager.ts modülü yüklendi (geriye dönük uyumluluk modu)');

export default userManager;
