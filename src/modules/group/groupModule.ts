/**
 * src/modules/group/groupModule.ts
 * Grup modülü
 */
import { Module } from '../index';
import * as groupManager from './groupManager';
import * as memberManager from './memberManager';
import * as settingsManager from './settingsManager';
import * as statsManager from './statsManager';

/**
 * Grup modülü sınıfı
 */
export class GroupModule implements Module {
  /**
   * Modül adı
   */
  name = 'group';

  /**
   * Modül başlatma (eski metod)
   */
  async init(): Promise<void> {
    // Modül başlatma işlemleri
    console.log('Grup modülü başlatıldı');
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
    console.log('Grup modülü durduruldu');
  }

  /**
   * Grup yöneticisini döndür
   */
  getGroupManager() {
    return groupManager;
  }

  /**
   * Üye yöneticisini döndür
   */
  getMemberManager() {
    return memberManager;
  }

  /**
   * Ayarlar yöneticisini döndür
   */
  getSettingsManager() {
    return settingsManager;
  }

  /**
   * İstatistik yöneticisini döndür
   */
  getStatsManager() {
    return statsManager;
  }
}

// Modül örneği oluştur
export const groupModule = new GroupModule();

export default groupModule;
