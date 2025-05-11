/**
 * src/modules/messageManager.ts
 * Mesaj yönetimi ile ilgili tüm işlevleri içerir
 * NOT: Bu modül artık daha küçük, odaklanmış modüllere bölünmüştür.
 * Geriye dönük uyumluluk için korunmuştur.
 */
import * as messageManager from './message/messageManager';
import * as searchManager from './message/searchManager';
import * as unreadManager from './message/unreadManager';
import { logger } from '../utils/logger';

// Geriye dönük uyumluluk için orijinal fonksiyonları dışa aktar
const messageManagerLegacy = {
  // Message Manager'dan
  sendChannelMessage: messageManager.sendChannelMessage,
  editChannelMessage: messageManager.editChannelMessage,
  deleteChannelMessage: messageManager.deleteChannelMessage,
  getChannelMessages: messageManager.getChannelMessages,
  addReaction: messageManager.addReaction,
  removeReaction: messageManager.removeReaction,
  pinMessage: messageManager.pinMessage,
  unpinMessage: messageManager.unpinMessage,
  getPinnedMessages: messageManager.getPinnedMessages,

  // Search Manager'dan
  searchChannelMessages: searchManager.searchChannelMessages,
  searchDirectMessages: searchManager.searchDirectMessages,
  searchAllMessages: searchManager.searchAllMessages,

  // Unread Manager'dan
  getUnreadMessages: unreadManager.getUnreadMessages,
  markAllDirectMessagesAsRead: unreadManager.markAllDirectMessagesAsRead,
};

// Kullanım günlüğü
logger.info('messageManager.ts modülü yüklendi (geriye dönük uyumluluk modu)');

export default messageManagerLegacy;
