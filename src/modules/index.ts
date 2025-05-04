/**
 * src/modules/index.ts
 * Modül yapısı
 */
import { logger } from '../utils/logger';

// Modül arayüzü
export interface Module {
  name: string;
  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;
}

// Modül yöneticisi
class ModuleManager {
  private modules: Map<string, Module> = new Map();
  
  // Modül kaydet
  register(module: Module): void {
    if (this.modules.has(module.name)) {
      throw new Error(`Modül zaten kayıtlı: ${module.name}`);
    }
    
    this.modules.set(module.name, module);
    logger.debug(`Modül kaydedildi: ${module.name}`);
  }
  
  // Tüm modülleri başlat
  async initializeAll(): Promise<void> {
    logger.info(`${this.modules.size} modül başlatılıyor...`);
    
    for (const [name, module] of this.modules.entries()) {
      try {
        logger.debug(`Modül başlatılıyor: ${name}`);
        await module.initialize();
        logger.info(`Modül başlatıldı: ${name}`);
      } catch (error) {
        logger.error(`Modül başlatma hatası: ${name}`, {
          error: (error as Error).message,
          stack: (error as Error).stack
        });
        throw error;
      }
    }
    
    logger.info('Tüm modüller başarıyla başlatıldı');
  }
  
  // Tüm modülleri kapat
  async shutdownAll(): Promise<void> {
    logger.info(`${this.modules.size} modül kapatılıyor...`);
    
    // Modülleri ters sırada kapat (bağımlılıklar için)
    const moduleEntries = [...this.modules.entries()].reverse();
    
    for (const [name, module] of moduleEntries) {
      try {
        logger.debug(`Modül kapatılıyor: ${name}`);
        await module.shutdown();
        logger.info(`Modül kapatıldı: ${name}`);
      } catch (error) {
        logger.error(`Modül kapatma hatası: ${name}`, {
          error: (error as Error).message
        });
        // Diğer modülleri kapatmaya devam et
      }
    }
    
    logger.info('Tüm modüller kapatıldı');
  }
  
  // Modül al
  getModule<T extends Module>(name: string): T | undefined {
    return this.modules.get(name) as T | undefined;
  }
}

// Modül yöneticisi örneği
export const moduleManager = new ModuleManager();

// Modülleri dışa aktar
export * from './user/userModule';
export * from './group/groupModule';
export * from './channel/channelModule';
export * from './message/messageModule';
