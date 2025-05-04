/**
 * src/modules/user/userService.ts
 * Kullanıcı servisi
 */
import { UserDocument } from '../../models/User';
import { logger } from '../../utils/logger';
import { UserRepository } from './userRepository';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { executeWithRetry } from '../../utils/db-helpers';
import { caches } from '../../utils/cache';

/**
 * Kullanıcı servis sınıfı
 * Kullanıcı ile ilgili tüm iş mantığını içerir
 */
export class UserService {
  constructor(private repository: UserRepository) {}
  
  /**
   * Kullanıcı getir
   * @param userId Kullanıcı ID
   * @returns Kullanıcı dokümanı
   */
  async getUserById(userId: string): Promise<UserDocument> {
    try {
      // Önbellekten kontrol et
      const cacheKey = `user:${userId}`;
      const cachedUser = caches.users.get(cacheKey);
      
      if (cachedUser) {
        return cachedUser;
      }
      
      // Veritabanından getir
      const user = await executeWithRetry(() => 
        this.repository.findById(userId)
      );
      
      if (!user) {
        throw new NotFoundError(`Kullanıcı bulunamadı: ${userId}`);
      }
      
      // Önbelleğe ekle
      caches.users.set(cacheKey, user);
      
      return user;
    } catch (error) {
      logger.error('Kullanıcı getirme hatası', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Kullanıcı güncelle
   * @param userId Kullanıcı ID
   * @param updateData Güncellenecek veriler
   * @returns Güncellenmiş kullanıcı
   */
  async updateUser(userId: string, updateData: Partial<UserDocument>): Promise<UserDocument> {
    try {
      // Güvenlik kontrolü - hassas alanları kaldır
      const safeUpdateData = { ...updateData };
      delete safeUpdateData.passwordHash;
      delete safeUpdateData.twoFactorSecret;
      delete safeUpdateData.backupCodes;
      delete safeUpdateData.emailVerificationToken;
      delete safeUpdateData.role; // Rol değişikliği ayrı bir işlem olmalı
      
      // Kullanıcıyı güncelle
      const updatedUser = await executeWithRetry(() => 
        this.repository.update(userId, safeUpdateData)
      );
      
      if (!updatedUser) {
        throw new NotFoundError(`Kullanıcı bulunamadı: ${userId}`);
      }
      
      // Önbelleği güncelle
      const cacheKey = `user:${userId}`;
      caches.users.set(cacheKey, updatedUser);
      
      return updatedUser;
    } catch (error) {
      logger.error('Kullanıcı güncelleme hatası', {
        error: (error as Error).message,
        userId
      });
      throw error;
    }
  }
  
  /**
   * Kullanıcı ara
   * @param query Arama sorgusu
   * @param page Sayfa numarası
   * @param limit Sayfa başına öğe sayısı
   * @returns Kullanıcı listesi ve toplam sayı
   */
  async searchUsers(query: string, page = 1, limit = 20): Promise<{ users: UserDocument[], total: number }> {
    try {
      // Geçerlilik kontrolü
      if (!query || query.length < 2) {
        throw new ValidationError('Arama sorgusu en az 2 karakter olmalıdır');
      }
      
      // Kullanıcıları ara
      const { users, total } = await executeWithRetry(() => 
        this.repository.search(query, page, limit)
      );
      
      return { users, total };
    } catch (error) {
      logger.error('Kullanıcı arama hatası', {
        error: (error as Error).message,
        query,
        page,
        limit
      });
      throw error;
    }
  }
  
  /**
   * Kullanıcı durumunu güncelle
   * @param userId Kullanıcı ID
   * @param isOnline Çevrimiçi mi?
   * @returns Güncellenmiş kullanıcı
   */
  async updateUserStatus(userId: string, isOnline: boolean): Promise<UserDocument> {
    try {
      // Kullanıcıyı güncelle
      const updatedUser = await executeWithRetry(() => 
        this.repository.updateStatus(userId, isOnline)
      );
      
      if (!updatedUser) {
        throw new NotFoundError(`Kullanıcı bulunamadı: ${userId}`);
      }
      
      // Önbelleği güncelle
      const cacheKey = `user:${userId}`;
      caches.users.set(cacheKey, updatedUser);
      
      return updatedUser;
    } catch (error) {
      logger.error('Kullanıcı durumu güncelleme hatası', {
        error: (error as Error).message,
        userId,
        isOnline
      });
      throw error;
    }
  }
}
