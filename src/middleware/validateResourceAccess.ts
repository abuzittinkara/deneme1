/**
 * src/middleware/validateResourceAccess.ts
 * Kaynak erişimini doğrulayan middleware
 */
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';
import { User } from '../models/User';
import { Group } from '../models/Group';
import { Channel } from '../models/Channel';
import { Message } from '../models/Message';
import DirectMessage from '../models/DirectMessage';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/express';
import { getDocField, getDocId, getDocRefId } from '../utils/document-helpers';

/**
 * Kullanıcının bir kaynağa erişim yetkisi olup olmadığını kontrol eder
 * @param req - Express request nesnesi
 * @param resourceType - Kaynak tipi
 * @param resourceId - Kaynak ID'si
 * @param action - İşlem tipi
 * @returns Erişim yetkisi var mı?
 */
export async function hasResourceAccess(
  req: Request,
  resourceType: 'user' | 'group' | 'channel' | 'message' | 'directMessage',
  resourceId: string,
  action: 'view' | 'edit' | 'delete' = 'view'
): Promise<boolean> {
  try {
    // Kullanıcı ID'sini al
    const authReq = req as AuthRequest;
    const userId = getDocId(authReq.user);

    if (!userId) {
      return false;
    }

    // Admin kullanıcılar her şeye erişebilir
    if (getDocField(authReq.user, 'role', '') === 'admin') {
      return true;
    }

    // Moderatörler bazı kaynaklara erişebilir
    if (getDocField(authReq.user, 'role', '') === 'moderator') {
      if (resourceType === 'message' || resourceType === 'directMessage') {
        return true;
      }
    }

    // Kaynak tipine göre erişim kontrolü yap
    switch (resourceType) {
      case 'user':
        return await hasUserAccess(userId.toString(), resourceId, action);

      case 'group':
        return await hasGroupAccess(userId.toString(), resourceId, action);

      case 'channel':
        return await hasChannelAccess(userId.toString(), resourceId, action);

      case 'message':
        return await hasMessageAccess(userId.toString(), resourceId, action);

      case 'directMessage':
        return await hasDirectMessageAccess(userId.toString(), resourceId, action);

      default:
        return false;
    }
  } catch (error) {
    logger.error('Kaynak erişim kontrolü sırasında hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      resourceType,
      resourceId,
      action,
      userId: getDocId((req as AuthRequest).user),
    });

    return false;
  }
}

/**
 * Kullanıcının bir kullanıcıya erişim yetkisi olup olmadığını kontrol eder
 * @param userId - Kullanıcı ID'si
 * @param targetUserId - Hedef kullanıcı ID'si
 * @param action - İşlem tipi
 * @returns Erişim yetkisi var mı?
 */
async function hasUserAccess(
  userId: string,
  targetUserId: string,
  action: 'view' | 'edit' | 'delete'
): Promise<boolean> {
  // Kullanıcı kendi profiline her zaman erişebilir
  if (userId === targetUserId) {
    return true;
  }

  // Görüntüleme işlemi için tüm kullanıcılar erişebilir
  if (action === 'view') {
    return true;
  }

  // Düzenleme ve silme işlemleri için sadece kendi profiline erişebilir
  return false;
}

/**
 * Kullanıcının bir gruba erişim yetkisi olup olmadığını kontrol eder
 * @param userId - Kullanıcı ID'si
 * @param groupId - Grup ID'si
 * @param action - İşlem tipi
 * @returns Erişim yetkisi var mı?
 */
async function hasGroupAccess(
  userId: string,
  groupId: string,
  action: 'view' | 'edit' | 'delete'
): Promise<boolean> {
  // Grup ID'si geçerli mi?
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return false;
  }

  // Grubu bul
  const group = await Group.findById(groupId);

  if (!group) {
    return false;
  }

  // Kullanıcı grup üyesi mi?
  const members = getDocField<any, string>(group, 'members', []);
  const isMember = members.some((member: any) => member.toString() === userId);

  // Görüntüleme işlemi için grup üyeleri erişebilir
  if (action === 'view') {
    return isMember;
  }

  // Kullanıcı grup sahibi mi?
  const owner = getDocField<any, string>(group, 'owner', null);
  const isOwner = owner ? owner.toString() === userId : false;

  // Düzenleme ve silme işlemleri için grup sahibi erişebilir
  if (action === 'edit' || action === 'delete') {
    return isOwner;
  }

  return false;
}

/**
 * Kullanıcının bir kanala erişim yetkisi olup olmadığını kontrol eder
 * @param userId - Kullanıcı ID'si
 * @param channelId - Kanal ID'si
 * @param action - İşlem tipi
 * @returns Erişim yetkisi var mı?
 */
async function hasChannelAccess(
  userId: string,
  channelId: string,
  action: 'view' | 'edit' | 'delete'
): Promise<boolean> {
  // Kanal ID'si geçerli mi?
  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    return false;
  }

  // Kanalı bul
  const channel = await Channel.findById(channelId).populate('group');

  if (!channel) {
    return false;
  }

  // Grup ID'sini al
  const groupId = getDocRefId<any>(channel, 'group');

  // Kullanıcının gruba erişim yetkisi var mı?
  if (!groupId) {
    return false;
  }
  const hasAccess = await hasGroupAccess(userId, groupId, 'view');

  if (!hasAccess) {
    return false;
  }

  // Görüntüleme işlemi için grup üyeleri erişebilir
  if (action === 'view') {
    return true;
  }

  // Grup sahibi mi?
  const group = await Group.findById(groupId);

  if (!group) {
    return false;
  }

  const owner = getDocField<any, string>(group, 'owner', null);
  const isGroupOwner = owner ? owner.toString() === userId : false;

  // Düzenleme ve silme işlemleri için grup sahibi erişebilir
  if (action === 'edit' || action === 'delete') {
    return isGroupOwner;
  }

  return false;
}

/**
 * Kullanıcının bir mesaja erişim yetkisi olup olmadığını kontrol eder
 * @param userId - Kullanıcı ID'si
 * @param messageId - Mesaj ID'si
 * @param action - İşlem tipi
 * @returns Erişim yetkisi var mı?
 */
async function hasMessageAccess(
  userId: string,
  messageId: string,
  action: 'view' | 'edit' | 'delete'
): Promise<boolean> {
  // Mesaj ID'si geçerli mi?
  if (!mongoose.Types.ObjectId.isValid(messageId)) {
    return false;
  }

  // Mesajı bul
  const message = await Message.findById(messageId).populate('channel');

  if (!message) {
    return false;
  }

  // Kanal ID'sini al
  const channelId = getDocRefId<any>(message, 'channel');

  // Kullanıcının kanala erişim yetkisi var mı?
  if (!channelId) {
    return false;
  }
  const hasAccess = await hasChannelAccess(userId, channelId, 'view');

  if (!hasAccess) {
    return false;
  }

  // Görüntüleme işlemi için kanal üyeleri erişebilir
  if (action === 'view') {
    return true;
  }

  // Mesaj sahibi mi?
  const sender = getDocField<any, string>(message, 'sender', null);
  const isMessageOwner = sender ? sender.toString() === userId : false;

  // Düzenleme ve silme işlemleri için mesaj sahibi erişebilir
  if (action === 'edit' || action === 'delete') {
    return isMessageOwner;
  }

  return false;
}

/**
 * Kullanıcının bir direkt mesaja erişim yetkisi olup olmadığını kontrol eder
 * @param userId - Kullanıcı ID'si
 * @param directMessageId - Direkt mesaj ID'si
 * @param action - İşlem tipi
 * @returns Erişim yetkisi var mı?
 */
async function hasDirectMessageAccess(
  userId: string,
  directMessageId: string,
  action: 'view' | 'edit' | 'delete'
): Promise<boolean> {
  // Direkt mesaj ID'si geçerli mi?
  if (!mongoose.Types.ObjectId.isValid(directMessageId)) {
    return false;
  }

  // Direkt mesajı bul
  const directMessage = await DirectMessage.findById(directMessageId);

  if (!directMessage) {
    return false;
  }

  // Kullanıcı mesajın alıcısı veya göndericisi mi?
  const messageSender = getDocField<any, string>(directMessage, 'sender', null);
  const recipient = getDocField<any, string>(directMessage, 'recipient', null);
  const isParticipant =
    (messageSender ? messageSender.toString() === userId : false) ||
    (recipient ? recipient.toString() === userId : false);

  if (!isParticipant) {
    return false;
  }

  // Görüntüleme işlemi için mesajın alıcısı veya göndericisi erişebilir
  if (action === 'view') {
    return true;
  }

  // Mesaj sahibi mi?
  const dmSender = getDocField<any, string>(directMessage, 'sender', null);
  const isMessageOwner = dmSender ? dmSender.toString() === userId : false;

  // Düzenleme ve silme işlemleri için mesaj sahibi erişebilir
  if (action === 'edit' || action === 'delete') {
    return isMessageOwner;
  }

  return false;
}

/**
 * Kullanıcı kaynağa erişim middleware'i
 * @param resourceType - Kaynak tipi
 * @param action - İşlem tipi
 * @param getResourceId - Kaynak ID'sini alan fonksiyon
 * @returns Middleware fonksiyonu
 */
export function validateResourceAccess(
  resourceType: 'user' | 'group' | 'channel' | 'message' | 'directMessage',
  action: 'view' | 'edit' | 'delete' = 'view',
  getResourceId: (req: Request) => string = (req) => req.params['id'] || ''
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Kaynak ID'sini al
      const resourceId = getResourceId(req);

      if (!resourceId) {
        return next(new NotFoundError('Kaynak bulunamadı'));
      }

      // Erişim kontrolü yap
      const hasAccess = await hasResourceAccess(req, resourceType, resourceId, action);

      if (!hasAccess) {
        return next(new ForbiddenError(`Bu işlem için yetkiniz yok: ${resourceType} ${action}`));
      }

      next();
    } catch (error) {
      logger.error('Kaynak erişim kontrolü sırasında hata oluştu', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        resourceType,
        action,
        path: req.path,
        method: req.method,
        userId: getDocId((req as AuthRequest).user),
      });

      next(error);
    }
  };
}

/**
 * Kullanıcı erişim middleware'i
 * @param action - İşlem tipi
 * @returns Middleware fonksiyonu
 */
export function validateUserAccess(action: 'view' | 'edit' | 'delete' = 'view') {
  return validateResourceAccess('user', action);
}

/**
 * Grup erişim middleware'i
 * @param action - İşlem tipi
 * @returns Middleware fonksiyonu
 */
export function validateGroupAccess(action: 'view' | 'edit' | 'delete' = 'view') {
  return validateResourceAccess('group', action);
}

/**
 * Kanal erişim middleware'i
 * @param action - İşlem tipi
 * @returns Middleware fonksiyonu
 */
export function validateChannelAccess(action: 'view' | 'edit' | 'delete' = 'view') {
  return validateResourceAccess('channel', action);
}

/**
 * Mesaj erişim middleware'i
 * @param action - İşlem tipi
 * @returns Middleware fonksiyonu
 */
export function validateMessageAccess(action: 'view' | 'edit' | 'delete' = 'view') {
  return validateResourceAccess('message', action);
}

/**
 * Direkt mesaj erişim middleware'i
 * @param action - İşlem tipi
 * @returns Middleware fonksiyonu
 */
export function validateDirectMessageAccess(action: 'view' | 'edit' | 'delete' = 'view') {
  return validateResourceAccess('directMessage', action);
}

export default {
  hasResourceAccess,
  validateResourceAccess,
  validateUserAccess,
  validateGroupAccess,
  validateChannelAccess,
  validateMessageAccess,
  validateDirectMessageAccess,
};
