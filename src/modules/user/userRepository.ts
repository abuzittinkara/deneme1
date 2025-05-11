/**
 * src/modules/user/userRepository.ts
 * Kullanıcı repository
 */
import { User, UserDocument } from '../../models/User';
import { logger } from '../../utils/logger';
import { getPaginationParams } from '../../utils/db-helpers';

/**
 * Kullanıcı repository sınıfı
 * Kullanıcı ile ilgili tüm veritabanı işlemlerini içerir
 */
export class UserRepository {
  /**
   * Repository'yi başlat
   */
  async initialize(): Promise<void> {
    // Gerekirse başlatma işlemleri
  }

  /**
   * ID'ye göre kullanıcı bul
   * @param userId Kullanıcı ID
   * @returns Kullanıcı dokümanı
   */
  async findById(userId: string): Promise<UserDocument | null> {
    try {
      const user = await User.findById(userId).select(
        '-passwordHash -twoFactorSecret -backupCodes'
      );
      return user as unknown as UserDocument;
    } catch (error) {
      logger.error('Kullanıcı bulma hatası', {
        error: (error as Error).message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Kullanıcı adına göre kullanıcı bul
   * @param username Kullanıcı adı
   * @returns Kullanıcı dokümanı
   */
  async findByUsername(username: string): Promise<UserDocument | null> {
    try {
      const user = await User.findOne({ username }).select(
        '-passwordHash -twoFactorSecret -backupCodes'
      );
      return user as unknown as UserDocument;
    } catch (error) {
      logger.error('Kullanıcı adına göre kullanıcı bulma hatası', {
        error: (error as Error).message,
        username,
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
  async update(userId: string, updateData: Partial<UserDocument>): Promise<UserDocument | null> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).select('-passwordHash -twoFactorSecret -backupCodes');
      return user as unknown as UserDocument;
    } catch (error) {
      logger.error('Kullanıcı güncelleme hatası', {
        error: (error as Error).message,
        userId,
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
  async search(
    query: string,
    page = 1,
    limit = 20
  ): Promise<{ users: UserDocument[]; total: number }> {
    try {
      const { skip, limit: limitValue } = getPaginationParams(page, limit);

      // Arama metnini temizle ve güvenli hale getir
      const sanitizedText = query.trim();
      const escapedText = sanitizedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Güvenli regex ile arama sorgusunu oluştur
      const searchQuery = {
        $or: [
          { username: { $regex: new RegExp(escapedText, 'i') } },
          { name: { $regex: new RegExp(escapedText, 'i') } },
          { surname: { $regex: new RegExp(escapedText, 'i') } },
          { email: { $regex: new RegExp(escapedText, 'i') } },
        ],
      };

      // Toplam sayıyı al
      const total = await User.countDocuments(searchQuery);

      // Kullanıcıları getir
      const users = await User.find(searchQuery)
        .select('-passwordHash -twoFactorSecret -backupCodes')
        .skip(skip)
        .limit(limitValue)
        .sort({ username: 1 });

      return {
        users: users as unknown as UserDocument[],
        total,
      };
    } catch (error) {
      logger.error('Kullanıcı arama hatası', {
        error: (error as Error).message,
        query,
        page,
        limit,
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
  async updateStatus(userId: string, isOnline: boolean): Promise<UserDocument | null> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            'onlineStatus.isOnline': isOnline,
            'onlineStatus.lastActiveAt': new Date(),
          },
        },
        { new: true }
      ).select('-passwordHash -twoFactorSecret -backupCodes');
      return user as unknown as UserDocument;
    } catch (error) {
      logger.error('Kullanıcı durumu güncelleme hatası', {
        error: (error as Error).message,
        userId,
        isOnline,
      });
      throw error;
    }
  }
}
