/**
 * src/modules/friend/friendManager.ts
 * Arkadaşlık işlemleri yöneticisi
 */
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { Friendship } from '../../models/Friendship';
import { FriendRequest } from '../../models/FriendRequest';
import { logger } from '../../utils/logger';
import { NotFoundError, ValidationError, FriendshipError } from '../../utils/errors';
import * as notificationManager from '../notification/notificationManager';
import { FriendshipStatus } from '../../types/common';

/**
 * Kullanıcının arkadaşlarını getirir
 * @param userId - Kullanıcı ID'si
 * @param status - Durum filtresi (all, online, offline)
 * @param limit - Sayfa başına kayıt sayısı
 * @param skip - Atlanacak kayıt sayısı
 * @returns Arkadaşlar listesi
 */
export async function getFriends(
  userId: string,
  status: string = 'all',
  limit: number = 50,
  skip: number = 0
): Promise<any[]> {
  try {
    // Arkadaşlıkları bul
    const friendships = await Friendship.find({
      $or: [
        { user1: userId, status: FriendshipStatus.ACCEPTED },
        { user2: userId, status: FriendshipStatus.ACCEPTED },
      ],
    })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    // Arkadaş ID'lerini topla
    const friendIds = friendships.map((friendship) => {
      return friendship.user1.toString() === userId ? friendship.user2 : friendship.user1;
    });

    // Durum filtresini oluştur
    const statusFilter: any = {};
    if (status === 'online') {
      statusFilter.status = 'online';
    } else if (status === 'offline') {
      statusFilter.status = 'offline';
    }

    // Arkadaş bilgilerini getir
    const friends = await User.find({
      _id: { $in: friendIds },
      ...statusFilter,
    })
      .select('username displayName email avatar status lastSeen')
      .lean();

    // Arkadaşlık bilgilerini ekle
    const friendsWithDetails = friends.map((friend) => {
      const friendship = friendships.find(
        (f) =>
          f.user1.toString() === friend._id.toString() ||
          f.user2.toString() === friend._id.toString()
      );

      return {
        ...friend,
        friendshipId: friendship?._id,
        friendSince: friendship?.createdAt,
      };
    });

    logger.debug('Arkadaşlar getirildi', {
      userId,
      count: friendsWithDetails.length,
      status,
    });

    return friendsWithDetails;
  } catch (error) {
    logger.error('Arkadaşları getirme hatası', {
      error: (error as Error).message,
      userId,
      status,
    });
    throw error;
  }
}

/**
 * Kullanıcının arkadaşlık isteklerini getirir
 * @param userId - Kullanıcı ID'si
 * @param type - İstek türü (received, sent, all)
 * @param limit - Sayfa başına kayıt sayısı
 * @param skip - Atlanacak kayıt sayısı
 * @returns Arkadaşlık istekleri listesi
 */
export async function getFriendRequests(
  userId: string,
  type: string = 'received',
  limit: number = 50,
  skip: number = 0
): Promise<any[]> {
  try {
    // İstek filtresini oluştur
    let filter: any = {};
    if (type === 'received') {
      filter = { receiver: userId, status: 'pending' };
    } else if (type === 'sent') {
      filter = { sender: userId, status: 'pending' };
    } else {
      filter = {
        $or: [
          { sender: userId, status: 'pending' },
          { receiver: userId, status: 'pending' },
        ],
      };
    }

    // Arkadaşlık isteklerini bul
    const requests = await FriendRequest.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('sender', 'username displayName email avatar status')
      .populate('receiver', 'username displayName email avatar status')
      .lean();

    logger.debug('Arkadaşlık istekleri getirildi', {
      userId,
      count: requests.length,
      type,
    });

    return requests;
  } catch (error) {
    logger.error('Arkadaşlık isteklerini getirme hatası', {
      error: (error as Error).message,
      userId,
      type,
    });
    throw error;
  }
}

/**
 * Arkadaşlık isteği gönderir
 * @param senderId - Gönderen kullanıcı ID'si
 * @param receiverId - Alıcı kullanıcı ID'si
 * @returns Oluşturulan arkadaşlık isteği
 */
export async function sendFriendRequest(senderId: string, receiverId: string): Promise<any> {
  try {
    // Kendine istek göndermeyi engelle
    if (senderId === receiverId) {
      throw new ValidationError('Kendinize arkadaşlık isteği gönderemezsiniz');
    }

    // Alıcı kullanıcıyı kontrol et
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      throw new NotFoundError('Alıcı kullanıcı bulunamadı');
    }

    // Zaten arkadaş mı kontrol et
    const existingFriendship = await Friendship.findOne({
      $or: [
        { user1: senderId, user2: receiverId },
        { user1: receiverId, user2: senderId },
      ],
      status: FriendshipStatus.ACCEPTED,
    });

    if (existingFriendship) {
      throw new FriendshipError('Bu kullanıcı zaten arkadaşınız');
    }

    // Bekleyen istek var mı kontrol et
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId, status: 'pending' },
        { sender: receiverId, receiver: senderId, status: 'pending' },
      ],
    });

    if (existingRequest) {
      if (existingRequest.sender.toString() === senderId) {
        throw new FriendshipError('Bu kullanıcıya zaten arkadaşlık isteği gönderdiniz');
      } else {
        throw new FriendshipError('Bu kullanıcı size zaten arkadaşlık isteği gönderdi');
      }
    }

    // Yeni istek oluştur
    const friendRequest = new FriendRequest({
      sender: senderId,
      receiver: receiverId,
      status: 'pending',
    });

    await friendRequest.save();

    // Bildirim oluştur
    await notificationManager.createFriendRequestNotification(receiverId, senderId);

    logger.info('Arkadaşlık isteği gönderildi', {
      senderId,
      receiverId,
      requestId: friendRequest._id,
    });

    return friendRequest;
  } catch (error) {
    logger.error('Arkadaşlık isteği gönderme hatası', {
      error: (error as Error).message,
      senderId,
      receiverId,
    });
    throw error;
  }
}

/**
 * Arkadaşlık isteğini kabul eder
 * @param senderId - Gönderen kullanıcı ID'si
 * @param receiverId - Alıcı kullanıcı ID'si
 * @returns Oluşturulan arkadaşlık
 */
export async function acceptFriendRequest(senderId: string, receiverId: string): Promise<any> {
  try {
    // İsteği bul
    const request = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: 'pending',
    });

    if (!request) {
      throw new NotFoundError('Arkadaşlık isteği bulunamadı');
    }

    // İsteği güncelle
    request.status = 'accepted';
    await request.save();

    // Arkadaşlık oluştur
    const friendship = new Friendship({
      user1: senderId,
      user2: receiverId,
      status: FriendshipStatus.ACCEPTED,
    });

    await friendship.save();

    // Bildirim oluştur
    await notificationManager.createFriendAcceptNotification(senderId, receiverId);

    logger.info('Arkadaşlık isteği kabul edildi', {
      senderId,
      receiverId,
      requestId: request._id,
      friendshipId: friendship._id,
    });

    return friendship;
  } catch (error) {
    logger.error('Arkadaşlık isteği kabul etme hatası', {
      error: (error as Error).message,
      senderId,
      receiverId,
    });
    throw error;
  }
}

/**
 * Arkadaşlık isteğini reddeder
 * @param senderId - Gönderen kullanıcı ID'si
 * @param receiverId - Alıcı kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function rejectFriendRequest(senderId: string, receiverId: string): Promise<boolean> {
  try {
    // İsteği bul
    const request = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: 'pending',
    });

    if (!request) {
      throw new NotFoundError('Arkadaşlık isteği bulunamadı');
    }

    // İsteği güncelle
    request.status = 'rejected';
    await request.save();

    logger.info('Arkadaşlık isteği reddedildi', {
      senderId,
      receiverId,
      requestId: request._id,
    });

    return true;
  } catch (error) {
    logger.error('Arkadaşlık isteği reddetme hatası', {
      error: (error as Error).message,
      senderId,
      receiverId,
    });
    throw error;
  }
}

/**
 * Gönderilen arkadaşlık isteğini iptal eder
 * @param senderId - Gönderen kullanıcı ID'si
 * @param receiverId - Alıcı kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function cancelFriendRequest(senderId: string, receiverId: string): Promise<boolean> {
  try {
    // İsteği bul
    const request = await FriendRequest.findOne({
      sender: senderId,
      receiver: receiverId,
      status: 'pending',
    });

    if (!request) {
      throw new NotFoundError('Arkadaşlık isteği bulunamadı');
    }

    // İsteği sil
    await FriendRequest.deleteOne({ _id: request._id });

    logger.info('Arkadaşlık isteği iptal edildi', {
      senderId,
      receiverId,
      requestId: request._id,
    });

    return true;
  } catch (error) {
    logger.error('Arkadaşlık isteği iptal etme hatası', {
      error: (error as Error).message,
      senderId,
      receiverId,
    });
    throw error;
  }
}

/**
 * Arkadaşlıktan çıkarır
 * @param userId - Kullanıcı ID'si
 * @param friendId - Arkadaş ID'si
 * @returns İşlem sonucu
 */
export async function removeFriend(userId: string, friendId: string): Promise<boolean> {
  try {
    // Arkadaşlığı bul
    const friendship = await Friendship.findOne({
      $or: [
        { user1: userId, user2: friendId },
        { user1: friendId, user2: userId },
      ],
      status: FriendshipStatus.ACCEPTED,
    });

    if (!friendship) {
      throw new NotFoundError('Arkadaşlık bulunamadı');
    }

    // Arkadaşlığı sil
    await Friendship.deleteOne({ _id: friendship._id });

    logger.info('Arkadaşlıktan çıkarıldı', {
      userId,
      friendId,
      friendshipId: friendship._id,
    });

    return true;
  } catch (error) {
    logger.error('Arkadaşlıktan çıkarma hatası', {
      error: (error as Error).message,
      userId,
      friendId,
    });
    throw error;
  }
}

/**
 * İki kullanıcı arasındaki arkadaşlık durumunu kontrol eder
 * @param userId - Kullanıcı ID'si
 * @param otherUserId - Diğer kullanıcı ID'si
 * @returns Arkadaşlık durumu
 */
export async function checkFriendshipStatus(userId: string, otherUserId: string): Promise<string> {
  try {
    // Arkadaşlığı kontrol et
    const friendship = await Friendship.findOne({
      $or: [
        { user1: userId, user2: otherUserId },
        { user1: otherUserId, user2: userId },
      ],
    });

    if (friendship) {
      return friendship.status;
    }

    // İsteği kontrol et
    const request = await FriendRequest.findOne({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
      status: 'pending',
    });

    if (request) {
      if (request.sender.toString() === userId) {
        return 'request_sent';
      } else {
        return 'request_received';
      }
    }

    return 'none';
  } catch (error) {
    logger.error('Arkadaşlık durumu kontrol hatası', {
      error: (error as Error).message,
      userId,
      otherUserId,
    });
    throw error;
  }
}

/**
 * Arkadaşlık isteğini ID'ye göre getirir
 * @param requestId - İstek ID'si
 * @returns Arkadaşlık isteği
 */
export async function getFriendRequestById(requestId: string): Promise<any> {
  try {
    const request = await FriendRequest.findById(requestId)
      .populate('sender', 'username displayName email avatar status')
      .populate('receiver', 'username displayName email avatar status');

    if (!request) {
      throw new NotFoundError('Arkadaşlık isteği bulunamadı');
    }

    return request;
  } catch (error) {
    logger.error('Arkadaşlık isteği getirme hatası', {
      error: (error as Error).message,
      requestId,
    });
    throw error;
  }
}

export default {
  getFriends,
  getFriendRequests,
  getFriendRequestById,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  checkFriendshipStatus,
};
