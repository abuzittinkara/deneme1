/**
 * src/modules/user/userModule.ts
 * Kullanıcı modülü
 */
import { Module } from '../index';
import { logger } from '../../utils/logger';
import { UserService } from './userService';
import { UserRepository } from './userRepository';

// Kullanıcı modülü
export class UserModule implements Module {
  name = 'user';
  private service: UserService;
  private repository: UserRepository;

  constructor() {
    this.repository = new UserRepository();
    this.service = new UserService(this.repository);
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Kullanıcı modülü başlatılıyor...');

      // Modül başlatma işlemleri
      await this.repository.initialize();

      logger.info('Kullanıcı modülü başlatıldı');
    } catch (error) {
      logger.error('Kullanıcı modülü başlatma hatası', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Kullanıcı modülü kapatılıyor...');

      // Modül kapatma işlemleri

      logger.info('Kullanıcı modülü kapatıldı');
    } catch (error) {
      logger.error('Kullanıcı modülü kapatma hatası', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  // Kullanıcı servisini döndür
  getService(): UserService {
    return this.service;
  }
}

// Kullanıcı modülü örneği
export const userModule = new UserModule();
