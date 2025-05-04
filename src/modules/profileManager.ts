/**
 * src/modules/profileManager.ts
 * Kullanıcı profil yönetimi işlemleri
 */
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserDocument, UserPreferences } from '../models/User';
import * as fileUpload from './fileUpload';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, AuthenticationError } from '../utils/errors';
import { FileAttachmentDocument } from '../models/FileAttachment';
import { toObjectId, ObjectId } from '../types/mongoose';
import { UserStatus, NotificationType } from '../types/enums';

// Profil güncelleme verisi arayüzü
export interface ProfileUpdateData {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  bio?: string;
  customStatus?: string;
  birthdate?: string | Date;
  preferences?: Partial<UserPreferences>;
}

// Profil resmi güncelleme sonucu arayüzü
export interface ProfilePictureUpdateResult {
  success: boolean;
  profilePicture: FileAttachmentDocument;
}

// Kullanıcı adı değiştirme sonucu arayüzü
export interface UsernameChangeResult {
  success: boolean;
  oldUsername: string;
  newUsername: string;
}

// Bildirim tercihleri arayüzü
export interface NotificationPreferencesUpdate {
  notifications?: boolean;
  emailNotifications?: boolean;
  notificationTypes?: {
    [NotificationType.DIRECT_MESSAGES]?: boolean;
    [NotificationType.MENTIONS]?: boolean;
    [NotificationType.FRIEND_REQUESTS]?: boolean;
    [NotificationType.GROUP_INVITES]?: boolean;
    [NotificationType.CHANNEL_MESSAGES]?: boolean;
  };
}

/**
 * Kullanıcı profilini günceller
 * @param userId - Kullanıcı ID'si
 * @param profileData - Profil güncelleme verisi
 * @returns Güncellenmiş kullanıcı
 */
export async function updateUserProfile(
  userId: string,
  profileData: ProfileUpdateData
): Promise<Partial<UserDocument>> {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Temel profil alanlarını güncelle
    if (profileData.name !== undefined) user.set('name', profileData.name);
    if (profileData.surname !== undefined) user.set('surname', profileData.surname);
    if (profileData.email !== undefined) user.set('email', profileData.email);
    if (profileData.phone !== undefined) user.set('phone', profileData.phone);
    if (profileData.bio !== undefined) user.set('bio', profileData.bio);
    if (profileData.customStatus !== undefined) user.set('customStatus', profileData.customStatus);

    // Doğum tarihini güncelle (varsa)
    if (profileData.birthdate) {
      user.set('birthdate', new Date(profileData.birthdate));
    }

    // Kullanıcı tercihlerini güncelle
    if (profileData.preferences) {
      const preferences = user.get('preferences') || {};

      if (profileData.preferences.theme) {
        preferences.theme = profileData.preferences.theme;
      }

      if (profileData.preferences.notifications !== undefined) {
        preferences.notifications = profileData.preferences.notifications;
      }

      if (profileData.preferences.soundEffects !== undefined) {
        preferences.soundEffects = profileData.preferences.soundEffects;
      }

      if (profileData.preferences.language) {
        preferences.language = profileData.preferences.language;
      }

      user.set('preferences', preferences);
    }

    await user.save();

    // Güncellenmiş kullanıcıyı hassas bilgiler olmadan döndür
    const userObj = user.toObject();
    delete userObj.passwordHash;

    logger.info('Kullanıcı profili güncellendi', { userId });

    return userObj;
  } catch (error) {
    logger.error('Kullanıcı profili güncelleme hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * Kullanıcı şifresini değiştirir
 * @param userId - Kullanıcı ID'si
 * @param currentPassword - Mevcut şifre
 * @param newPassword - Yeni şifre
 * @returns İşlem sonucu
 */
export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Mevcut şifreyi doğrula
    const passwordHash = user.get('passwordHash');
    const isMatch = await bcrypt.compare(currentPassword, passwordHash);
    if (!isMatch) {
      throw new AuthenticationError('Mevcut şifre hatalı');
    }

    // Yeni şifreyi hashle ve güncelle
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    user.set('passwordHash', newPasswordHash);

    await user.save();

    logger.info('Kullanıcı şifresi değiştirildi', { userId });

    return { success: true, message: 'Şifre başarıyla güncellendi' };
  } catch (error) {
    logger.error('Kullanıcı şifresi değiştirme hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * Kullanıcı profil resmini günceller
 * @param userId - Kullanıcı ID'si
 * @param fileData - Dosya verisi (base64)
 * @param originalName - Orijinal dosya adı
 * @param mimeType - Dosya MIME tipi
 * @returns Güncelleme sonucu
 */
export async function updateProfilePicture(
  userId: string,
  fileData: string,
  originalName: string,
  mimeType: string
): Promise<ProfilePictureUpdateResult> {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Eski profil resmini sil (varsa)
    const profilePicture = user.get('profilePicture');
    if (profilePicture) {
      try {
        await fileUpload.deleteFile(profilePicture.toString());
      } catch (error) {
        logger.warn('Eski profil resmi silinirken hata oluştu', {
          error: (error as Error).message,
          userId,
          profilePictureId: profilePicture
        });
        // Silme başarısız olsa bile devam et
      }
    }

    // Yeni profil resmini yükle
    const fileAttachment = await fileUpload.handleFileUpload(fileData, originalName, mimeType, userId);

    // Kullanıcı profilini güncelle
    user.set('profilePicture', fileAttachment._id);
    await user.save();

    logger.info('Kullanıcı profil resmi güncellendi', { userId, fileId: fileAttachment._id });

    return {
      success: true,
      profilePicture: fileAttachment
    };
  } catch (error) {
    logger.error('Profil resmi güncelleme hatası', {
      error: (error as Error).message,
      userId,
      originalName
    });
    throw error;
  }
}

/**
 * Kullanıcı profilini getirir
 * @param userId - Kullanıcı ID'si
 * @returns Kullanıcı profili
 */
export async function getUserProfile(userId: string): Promise<Partial<UserDocument>> {
  try {
    const user = await User.findById(userId)
      .populate('profilePicture')
      .lean();

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Hassas bilgileri kaldır
    const userObj = user.toObject();
    delete userObj.passwordHash;

    logger.debug('Kullanıcı profili getirildi', { userId });

    return userObj;
  } catch (error) {
    logger.error('Kullanıcı profili getirme hatası', { error: (error as Error).message, userId });
    throw error;
  }
}

/**
 * Kullanıcı adını değiştirir
 * @param userId - Kullanıcı ID'si
 * @param newUsername - Yeni kullanıcı adı
 * @param password - Mevcut şifre (doğrulama için)
 * @returns İşlem sonucu
 */
export async function changeUsername(
  userId: string,
  newUsername: string,
  password: string
): Promise<UsernameChangeResult> {
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Şifreyi doğrula
    const passwordHash = user.get('passwordHash');
    const isMatch = await bcrypt.compare(password, passwordHash);
    if (!isMatch) {
      throw new AuthenticationError('Şifre hatalı');
    }

    // Mevcut kullanıcı adını al
    const currentUsername = user.get('username');

    // Yeni kullanıcı adı kullanılabilir mi kontrol et
    if (newUsername === currentUsername) {
      throw new ValidationError('Yeni kullanıcı adı mevcut kullanıcı adınızla aynı');
    }

    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser) {
      throw new ValidationError('Bu kullanıcı adı zaten kullanılıyor');
    }

    // Kullanıcı adını güncelle
    const oldUsername = currentUsername;
    user.set('username', newUsername);
    await user.save();

    logger.info('Kullanıcı adı değiştirildi', { userId, oldUsername, newUsername });

    return {
      success: true,
      oldUsername,
      newUsername
    };
  } catch (error) {
    logger.error('Kullanıcı adı değiştirme hatası', {
      error: (error as Error).message,
      userId,
      newUsername
    });
    throw error;
  }
}

/**
 * Kullanıcı durumunu günceller
 * @param userId - Kullanıcı ID'si
 * @param status - Yeni durum (online, idle, dnd, invisible)
 * @param customStatus - Özel durum mesajı
 * @returns Güncellenmiş kullanıcı
 */
export async function updateUserStatus(
  userId: string,
  status: UserStatus,
  customStatus: string | null = null
): Promise<Partial<UserDocument>> {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Durumu güncelle
    if (status && Object.values(UserStatus).includes(status)) {
      user.set('status', status);
    }

    // Özel durum mesajını güncelle
    if (customStatus !== null) {
      user.set('customStatus', customStatus);
    }

    await user.save();

    // Hassas bilgileri kaldır
    const userObj = user.toObject();
    delete userObj.passwordHash;

    logger.info('Kullanıcı durumu güncellendi', { userId, status, customStatus });

    return userObj;
  } catch (error) {
    logger.error('Kullanıcı durumu güncelleme hatası', {
      error: (error as Error).message,
      userId,
      status,
      customStatus
    });
    throw error;
  }
}

/**
 * Kullanıcı bildirim tercihlerini günceller
 * @param userId - Kullanıcı ID'si
 * @param notificationPreferences - Bildirim tercihleri
 * @returns Güncellenmiş kullanıcı
 */
export async function updateNotificationPreferences(
  userId: string,
  notificationPreferences: NotificationPreferencesUpdate
): Promise<Partial<UserDocument>> {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Bildirim tercihlerini güncelle
    const preferences = user.get('preferences') || {};

    if (notificationPreferences.notifications !== undefined) {
      preferences.notifications = notificationPreferences.notifications;
    }

    if (notificationPreferences.emailNotifications !== undefined) {
      preferences.emailNotifications = notificationPreferences.emailNotifications;
    }

    if (notificationPreferences.notificationTypes) {
      const types = notificationPreferences.notificationTypes;
      preferences.notificationTypes = preferences.notificationTypes || {};

      if (types[NotificationType.DIRECT_MESSAGES] !== undefined) {
        preferences.notificationTypes[NotificationType.DIRECT_MESSAGES] = types[NotificationType.DIRECT_MESSAGES];
      }
      if (types[NotificationType.MENTIONS] !== undefined) {
        preferences.notificationTypes[NotificationType.MENTIONS] = types[NotificationType.MENTIONS];
      }
      if (types[NotificationType.FRIEND_REQUESTS] !== undefined) {
        preferences.notificationTypes[NotificationType.FRIEND_REQUESTS] = types[NotificationType.FRIEND_REQUESTS];
      }
      if (types[NotificationType.GROUP_INVITES] !== undefined) {
        preferences.notificationTypes[NotificationType.GROUP_INVITES] = types[NotificationType.GROUP_INVITES];
      }
      if (types[NotificationType.CHANNEL_MESSAGES] !== undefined) {
        preferences.notificationTypes[NotificationType.CHANNEL_MESSAGES] = types[NotificationType.CHANNEL_MESSAGES];
      }
    }

    user.set('preferences', preferences);

    await user.save();

    // Hassas bilgileri kaldır
    const userObj = user.toObject();
    delete userObj.passwordHash;

    logger.info('Kullanıcı bildirim tercihleri güncellendi', { userId });

    return userObj;
  } catch (error) {
    logger.error('Bildirim tercihleri güncelleme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

export default {
  updateUserProfile,
  changeUserPassword,
  updateProfilePicture,
  getUserProfile,
  changeUsername,
  updateUserStatus,
  updateNotificationPreferences
};
