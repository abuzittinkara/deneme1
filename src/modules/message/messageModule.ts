/**
 * src/modules/message/messageModule.ts
 * Mesaj modülü
 */
import { Module } from '../index';
import * as messageManager from './messageManager';
import * as searchManager from './searchManager';
import * as unreadManager from './unreadManager';

/**
 * Mesaj modülü sınıfı
 */
export class MessageModule implements Module {
  /**
   * Modül adı
   */
  name = 'message';

  /**
   * Modül başlatma (eski metod)
   */
  async init(): Promise<void> {
    // Modül başlatma işlemleri
    console.log('Mesaj modülü başlatıldı');
  }

  /**
   * Modül başlatma (Module arayüzü için)
   */
  async initialize(): Promise<void> {
    // Modül başlatma işlemleri
    return this.init();
  }

  /**
   * Modül durdurma
   */
  async shutdown(): Promise<void> {
    // Modül durdurma işlemleri
    console.log('Mesaj modülü durduruldu');
  }

  /**
   * Mesaj yöneticisini döndür
   */
  getMessageManager() {
    return messageManager;
  }

  /**
   * Arama yöneticisini döndür
   */
  getSearchManager() {
    return searchManager;
  }

  /**
   * Okunmamış mesaj yöneticisini döndür
   */
  getUnreadManager() {
    return unreadManager;
  }
}

// Modül örneği oluştur
export const messageModule = new MessageModule();

export default messageModule;
