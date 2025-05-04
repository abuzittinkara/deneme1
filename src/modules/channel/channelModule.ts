/**
 * src/modules/channel/channelModule.ts
 * Kanal modülü
 */
import { Module } from '../index';
import * as channelManager from './channelManager';

/**
 * Kanal modülü sınıfı
 */
export class ChannelModule implements Module {
  /**
   * Modül adı
   */
  name = 'channel';

  /**
   * Modül başlatma (eski metod)
   */
  async init(): Promise<void> {
    // Modül başlatma işlemleri
    console.log('Kanal modülü başlatıldı');
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
    console.log('Kanal modülü durduruldu');
  }

  /**
   * Kanal yöneticisini döndür
   */
  getChannelManager() {
    return channelManager;
  }
}

// Modül örneği oluştur
export const channelModule = new ChannelModule();

export default channelModule;
