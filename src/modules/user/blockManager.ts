/**
 * src/modules/user/blockManager.ts
 * Engelleme yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { User, UserDocument } from '../../models/User';
import { createModelHelper } from '../../utils/mongoose-helpers';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { toObjectId, objectIdEquals } from '../../utils/mongoose-helpers';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// Engellenen kullanıcı bilgisi arayüzü
export interface BlockedUserInfo {
  username: string;
}

// İşlem sonucu arayüzü
export interface OperationResult {
  success: boolean;
  message?: string;
}

/**
 * Kullanıcının engellediği kişilerin listesini getirir
 * @param username - Kullanıcı adı
 * @returns Engellenen kullanıcılar listesi
 */
export async function getUserBlocked(username: string): Promise<BlockedUserInfo[]> {
  try {
    const user = await UserHelper.findOne({ username }, null, {
      populate: { path: 'blocked', select: 'username' },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    logger.info('Engellenen kullanıcılar listesi getirildi', {
      username,
      count: user.blocked.length,
    });

    return user.blocked.map((blocked) => ({
      username: (blocked as any).username,
    }));
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error('Engellenen kullanıcılar listesi getirme hatası', {
      error: (error as Error).message,
      username,
    });
    throw new Error('Engellenen kullanıcılar listesi getirilirken bir hata oluştu.');
  }
}

/**
 * Bir kullanıcıyı engeller
 * @param username - Kullanıcı adı
 * @param blockedUsername - Engellenecek kullanıcı adı
 * @returns İşlem sonucu
 */
export async function blockUser(
  username: string,
  blockedUsername: string
): Promise<OperationResult> {
  try {
    // Kendini engelleme kontrolü
    if (username === blockedUsername) {
      throw new ValidationError('Kendinizi engelleyemezsiniz.');
    }

    const user = await UserHelper.findOne({ username });
    const blockedUser = await UserHelper.findOne({ username: blockedUsername });

    if (!user || !blockedUser) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Zaten engellenmiş mi kontrolü
    if (user.blocked.some((blockedId) => objectIdEquals(blockedId, blockedUser._id))) {
      return { success: true, message: 'Kullanıcı zaten engellenmiş.' };
    }

    // Engellenen kullanıcıyı listeye ekle
    user.blocked.push(toObjectId(blockedUser._id));

    // Arkadaşlıktan çıkar (karşılıklı)
    user.friends = user.friends.filter((friendId) => !objectIdEquals(friendId, blockedUser._id));
    blockedUser.friends = blockedUser.friends.filter(
      (friendId) => !objectIdEquals(friendId, user._id)
    );

    await user.save();
    await blockedUser.save();

    logger.info('Kullanıcı engellendi', { username, blockedUsername });

    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }

    logger.error('Kullanıcı engelleme hatası', {
      error: (error as Error).message,
      username,
      blockedUsername,
    });
    throw new Error('Kullanıcı engellenirken bir hata oluştu.');
  }
}

/**
 * Bir kullanıcının engelini kaldırır
 * @param username - Kullanıcı adı
 * @param unblockedUsername - Engeli kaldırılacak kullanıcı adı
 * @returns İşlem sonucu
 */
export async function unblockUser(
  username: string,
  unblockedUsername: string
): Promise<OperationResult> {
  try {
    const user = await UserHelper.findOne({ username });
    const unblockedUser = await UserHelper.findOne({ username: unblockedUsername });

    if (!user || !unblockedUser) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Engellenen kullanıcıyı listeden çıkar
    user.blocked = user.blocked.filter(
      (blockedId) => !objectIdEquals(blockedId, unblockedUser._id)
    );
    await user.save();

    logger.info('Kullanıcı engeli kaldırıldı', { username, unblockedUsername });

    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error('Kullanıcı engeli kaldırma hatası', {
      error: (error as Error).message,
      username,
      unblockedUsername,
    });
    throw new Error('Kullanıcı engeli kaldırılırken bir hata oluştu.');
  }
}

export default {
  getUserBlocked,
  blockUser,
  unblockUser,
};
