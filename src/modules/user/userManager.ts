/**
 * src/modules/user/userManager.ts
 * Kullanıcı yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { User, UserDocument } from '../../models/User';
import { createModelHelper } from '../../utils/mongoose-helpers';
import { logger } from '../../utils/logger';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { toObjectId } from '../../utils/mongoose-helpers';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// Kullanıcı profili güncelleme parametreleri
export interface UpdateProfileParams {
  name?: string;
  surname?: string;
  bio?: string;
  status?: string;
  customStatus?: string;
}

/**
 * Kullanıcı profilini getirir
 * @param userId - Kullanıcı ID'si
 * @returns Kullanıcı profili
 */
export async function getUserProfile(userId: string): Promise<any> {
  try {
    const user = await UserHelper.findById(userId, '-password -refreshToken');

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcı bilgilerini formatla
    const profile = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      name: user.name,
      surname: user.surname,
      profilePicture: user.profilePicture?.toString(),
      bio: user.bio,
      status: user.status,
      customStatus: user.customStatus,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      onlineStatus: user.onlineStatus,
    };

    logger.debug('Kullanıcı profili getirildi', {
      userId,
    });

    return profile;
  } catch (error) {
    logger.error('Kullanıcı profili getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Kullanıcı adına göre kullanıcı profilini getirir
 * @param username - Kullanıcı adı
 * @returns Kullanıcı profili
 */
export async function getUserProfileByUsername(username: string): Promise<any> {
  try {
    const user = await UserHelper.findOne({ username }, '-password -refreshToken -email');

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcı bilgilerini formatla
    const profile = {
      id: user._id.toString(),
      username: user.username,
      name: user.name,
      surname: user.surname,
      profilePicture: user.profilePicture?.toString(),
      bio: user.bio,
      status: user.status,
      customStatus: user.customStatus,
      isActive: user.isActive,
      createdAt: user.createdAt,
      lastSeen: user.lastSeen,
      onlineStatus: user.onlineStatus,
    };

    logger.debug('Kullanıcı profili getirildi', {
      username,
    });

    return profile;
  } catch (error) {
    logger.error('Kullanıcı profili getirme hatası', {
      error: (error as Error).message,
      username,
    });
    throw error;
  }
}

/**
 * Kullanıcı profilini günceller
 * @param userId - Kullanıcı ID'si
 * @param updates - Güncellenecek alanlar
 * @returns Güncellenmiş kullanıcı profili
 */
export async function updateUserProfile(
  userId: string,
  updates: UpdateProfileParams
): Promise<any> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Güncellenecek alanları kontrol et
    if (updates.name !== undefined) {
      user.name = updates.name;
    }

    if (updates.surname !== undefined) {
      user.surname = updates.surname;
    }

    if (updates.bio !== undefined) {
      user.bio = updates.bio;
    }

    if (updates.status !== undefined) {
      user.status = updates.status as any;
    }

    if (updates.customStatus !== undefined) {
      user.customStatus = updates.customStatus;
    }

    // Değişiklikleri kaydet
    await user.save();

    // Güncellenmiş profili döndür
    return await getUserProfile(userId);
  } catch (error) {
    logger.error('Kullanıcı profili güncelleme hatası', {
      error: (error as Error).message,
      userId,
      updates,
    });
    throw error;
  }
}

/**
 * Kullanıcı arama
 * @param query - Arama sorgusu
 * @param options - Arama seçenekleri
 * @returns Arama sonuçları
 */
export async function searchUsers(
  query: string,
  options: { limit?: number; skip?: number } = {}
): Promise<{ users: any[]; total: number }> {
  try {
    const { limit = 20, skip = 0 } = options;

    // Arama metnini temizle ve güvenli hale getir
    const sanitizedText = query.trim();
    const escapedText = sanitizedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Güvenli regex ile arama sorgusunu oluştur
    const searchQuery = {
      $or: [
        { username: { $regex: new RegExp(escapedText, 'i') } },
        { name: { $regex: new RegExp(escapedText, 'i') } },
        { surname: { $regex: new RegExp(escapedText, 'i') } },
      ],
      isActive: true,
    };

    // Toplam sonuç sayısını al
    const total = await User.countDocuments(searchQuery);

    // Kullanıcıları getir
    const users = await User.find(searchQuery)
      .select('username name surname profilePicture bio status customStatus onlineStatus')
      .skip(skip)
      .limit(limit)
      .sort({ username: 1 });

    // Sonuçları formatla
    const formattedUsers = users.map((user) => ({
      id: user._id.toString(),
      username: user.get('username'),
      name: user.get('name'),
      surname: user.get('surname'),
      profilePicture: user.get('profilePicture')?.toString(),
      bio: user.get('bio'),
      status: user.get('status'),
      customStatus: user.get('customStatus'),
      onlineStatus: user.get('onlineStatus'),
    }));

    logger.debug('Kullanıcı arama sonuçları', {
      query,
      total,
      resultCount: formattedUsers.length,
    });

    return {
      users: formattedUsers,
      total,
    };
  } catch (error) {
    logger.error('Kullanıcı arama hatası', {
      error: (error as Error).message,
      query,
    });
    throw error;
  }
}

/**
 * Profil resmini günceller
 * @param userId - Kullanıcı ID'si
 * @param avatarUrl - Profil resmi URL'si
 * @returns Güncellenmiş profil resmi URL'si
 */
export async function updateProfilePicture(
  userId: string,
  avatarUrl: string
): Promise<{ avatarUrl: string }> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Profil resmini güncelle
    user.set('profilePicture', avatarUrl);
    await user.save();

    logger.info('Profil resmi güncellendi', {
      userId,
      avatarUrl,
    });

    return { avatarUrl };
  } catch (error) {
    logger.error('Profil resmi güncelleme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Profil resmini kaldırır
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function removeProfilePicture(userId: string): Promise<boolean> {
  try {
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Profil resmini kaldır
    user.set('profilePicture', undefined);
    await user.save();

    logger.info('Profil resmi kaldırıldı', {
      userId,
    });

    return true;
  } catch (error) {
    logger.error('Profil resmi kaldırma hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

export default {
  getUserProfile,
  getUserProfileByUsername,
  updateUserProfile,
  searchUsers,
  updateProfilePicture,
  removeProfilePicture,
};
