/**
 * src/modules/user/friendManager.ts
 * Arkadaş yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { User, UserDocument } from '../../models/User';
import { createModelHelper } from '../../utils/mongoose-helpers';
import { NotFoundError, ValidationError } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { toObjectId, objectIdEquals } from '../../utils/mongoose-helpers';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// Arkadaş bilgisi arayüzü
export interface FriendInfo {
  username: string;
  name?: string;
  surname?: string;
  email?: string;
  profilePicture?: string;
}

// İşlem sonucu arayüzü
export interface OperationResult {
  success: boolean;
  message?: string;
}

/**
 * Kullanıcının arkadaş listesini getirir
 * @param username - Kullanıcı adı
 * @returns Arkadaş listesi
 */
export async function getUserFriends(username: string): Promise<FriendInfo[]> {
  try {
    const user = await UserHelper.findOne({ username }, null, {
      populate: { path: 'friends', select: 'username name surname email profilePicture' },
    });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    logger.info('Arkadaş listesi getirildi', { username, count: user.friends.length });

    return user.friends.map((friend) => ({
      username: (friend as any).username,
      name: (friend as any).name,
      surname: (friend as any).surname,
      email: (friend as any).email,
      profilePicture: (friend as any).profilePicture?.toString(),
    }));
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error('Arkadaş listesi getirme hatası', { error: (error as Error).message, username });
    throw new Error('Arkadaş listesi getirilirken bir hata oluştu.');
  }
}

/**
 * Arkadaş ekler
 * @param username - Kullanıcı adı
 * @param friendUsername - Eklenecek arkadaşın kullanıcı adı
 * @returns İşlem sonucu
 */
export async function addFriend(
  username: string,
  friendUsername: string
): Promise<OperationResult> {
  try {
    // Kendini arkadaş olarak ekleme kontrolü
    if (username === friendUsername) {
      throw new ValidationError('Kendinizi arkadaş olarak ekleyemezsiniz.');
    }

    // Kullanıcıları bul
    const user = await UserHelper.findOne({ username });
    const friend = await UserHelper.findOne({ username: friendUsername });

    if (!user || !friend) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Zaten arkadaş mı kontrolü
    if (user.friends.some((friendId) => objectIdEquals(friendId, friend._id))) {
      return { success: true, message: 'Kullanıcı zaten arkadaşınız.' };
    }

    // Engelleme kontrolü
    if (
      user.blocked.some((blockedId) => objectIdEquals(blockedId, friend._id)) ||
      friend.blocked.some((blockedId) => objectIdEquals(blockedId, user._id))
    ) {
      throw new ValidationError(
        'Engellenen veya sizi engellemiş bir kullanıcıyı arkadaş olarak ekleyemezsiniz.'
      );
    }

    // Arkadaş ekle (karşılıklı)
    user.friends.push(toObjectId(friend._id));
    friend.friends.push(toObjectId(user._id));

    await user.save();
    await friend.save();

    logger.info('Arkadaş eklendi', { username, friendUsername });

    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }

    logger.error('Arkadaş ekleme hatası', {
      error: (error as Error).message,
      username,
      friendUsername,
    });
    throw new Error('Arkadaş eklenirken bir hata oluştu.');
  }
}

/**
 * Arkadaşlıktan çıkarır
 * @param username - Kullanıcı adı
 * @param friendUsername - Çıkarılacak arkadaşın kullanıcı adı
 * @returns İşlem sonucu
 */
export async function removeFriend(
  username: string,
  friendUsername: string
): Promise<OperationResult> {
  try {
    // Kullanıcıları bul
    const user = await UserHelper.findOne({ username });
    const friend = await UserHelper.findOne({ username: friendUsername });

    if (!user || !friend) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Arkadaş mı kontrolü
    if (!user.friends.some((friendId) => objectIdEquals(friendId, friend._id))) {
      return { success: true, message: 'Kullanıcı arkadaşınız değil.' };
    }

    // Arkadaşlıktan çıkar (karşılıklı)
    user.friends = user.friends.filter((friendId) => !objectIdEquals(friendId, friend._id));
    friend.friends = friend.friends.filter((friendId) => !objectIdEquals(friendId, user._id));

    await user.save();
    await friend.save();

    logger.info('Arkadaşlıktan çıkarıldı', { username, friendUsername });

    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }

    logger.error('Arkadaşlıktan çıkarma hatası', {
      error: (error as Error).message,
      username,
      friendUsername,
    });
    throw new Error('Arkadaşlıktan çıkarılırken bir hata oluştu.');
  }
}

export default {
  getUserFriends,
  addFriend,
  removeFriend,
};
