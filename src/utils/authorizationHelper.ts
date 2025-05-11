/**
 * src/utils/authorizationHelper.ts
 * Yetkilendirme işlemleri için yardımcı fonksiyonlar
 */
import { Request } from 'express';
import { ForbiddenError, NotFoundError } from './errors';
import { logger } from './logger';
import { User, UserDocument } from '../models/User';
import { Group } from '../models/Group';
import { Channel } from '../models/Channel';
import { Message } from '../models/Message';

/**
 * Kullanıcının bir kaynağa erişim yetkisi olup olmadığını kontrol eder
 *
 * @param userId - Kullanıcı ID
 * @param resourceId - Kaynak ID
 * @param resourceType - Kaynak tipi
 * @param requiredPermission - Gerekli izin
 * @returns Erişim yetkisi var mı?
 */
export async function hasPermission(
  userId: string,
  resourceId: string,
  resourceType: 'group' | 'channel' | 'message' | 'user',
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view'
): Promise<boolean> {
  try {
    // Kullanıcıyı kontrol et
    const user = await User.findById(userId);

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Admin kullanıcılar her şeye erişebilir
    const userRole = user.get('role') as string;
    if (userRole === 'admin') {
      return true;
    }

    // Kaynak tipine göre yetki kontrolü yap
    switch (resourceType) {
      case 'group':
        return await hasGroupPermission(userId, resourceId, requiredPermission);

      case 'channel':
        return await hasChannelPermission(userId, resourceId, requiredPermission);

      case 'message':
        return await hasMessagePermission(userId, resourceId, requiredPermission);

      case 'user':
        return await hasUserPermission(userId, resourceId, requiredPermission);

      default:
        return false;
    }
  } catch (error) {
    logger.error('Yetki kontrolü sırasında hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      userId,
      resourceId,
      resourceType,
      requiredPermission,
    });

    return false;
  }
}

/**
 * Kullanıcının bir gruba erişim yetkisi olup olmadığını kontrol eder
 *
 * @param userId - Kullanıcı ID
 * @param groupId - Grup ID
 * @param requiredPermission - Gerekli izin
 * @returns Erişim yetkisi var mı?
 */
async function hasGroupPermission(
  userId: string,
  groupId: string,
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin'
): Promise<boolean> {
  // Grubu kontrol et
  const group = await Group.findById(groupId);

  if (!group) {
    throw new NotFoundError('Grup bulunamadı');
  }

  // Grup sahibi her şeyi yapabilir
  const owner = group.get('owner');
  if (owner && owner.toString() === userId) {
    return true;
  }

  // Grup üyeliğini kontrol et
  const members = group.get('members') || [];
  const isMember = members.some((member: any) => member.user && member.user.toString() === userId);

  if (!isMember) {
    return false;
  }

  // Üye rolünü kontrol et
  const member = members.find((member: any) => member.user && member.user.toString() === userId);

  if (!member) {
    return false;
  }

  // İzin kontrolü
  const memberRole = member.role as string;
  switch (requiredPermission) {
    case 'view':
      return true; // Tüm üyeler görüntüleyebilir

    case 'edit':
      return ['admin', 'moderator'].includes(memberRole);

    case 'delete':
      return ['admin'].includes(memberRole);

    case 'admin':
      return memberRole === 'admin';

    default:
      return false;
  }
}

/**
 * Kullanıcının bir kanala erişim yetkisi olup olmadığını kontrol eder
 *
 * @param userId - Kullanıcı ID
 * @param channelId - Kanal ID
 * @param requiredPermission - Gerekli izin
 * @returns Erişim yetkisi var mı?
 */
async function hasChannelPermission(
  userId: string,
  channelId: string,
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin'
): Promise<boolean> {
  // Kanalı kontrol et
  const channel = await Channel.findById(channelId).populate('group');

  if (!channel) {
    throw new NotFoundError('Kanal bulunamadı');
  }

  // Önce grup izinlerini kontrol et
  const groupId = channel.get('group');
  const hasGroupPerm = await hasGroupPermission(
    userId,
    groupId ? groupId.toString() : '',
    requiredPermission
  );

  if (hasGroupPerm) {
    return true;
  }

  // Özel kanal kontrolü
  const isPrivate = channel.get('isPrivate');
  if (isPrivate) {
    // Özel kanala erişim kontrolü
    const allowedUsers = channel.get('allowedUsers') || [];
    const hasAccess = allowedUsers.some((user: any) => user && user.toString() === userId);

    return hasAccess;
  }

  // Genel kanallar için sadece görüntüleme izni ver
  return requiredPermission === 'view';
}

/**
 * Kullanıcının bir mesaja erişim yetkisi olup olmadığını kontrol eder
 *
 * @param userId - Kullanıcı ID
 * @param messageId - Mesaj ID
 * @param requiredPermission - Gerekli izin
 * @returns Erişim yetkisi var mı?
 */
async function hasMessagePermission(
  userId: string,
  messageId: string,
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin'
): Promise<boolean> {
  // Mesajı kontrol et
  const message = await Message.findById(messageId).populate('channel');

  if (!message) {
    throw new NotFoundError('Mesaj bulunamadı');
  }

  // Mesaj sahibi düzenleme ve silme yetkisine sahiptir
  const sender = message.get('sender');
  if (sender && sender.toString() === userId) {
    return true;
  }

  // Kanal izinlerini kontrol et
  const channelId = message.get('channel');
  return hasChannelPermission(userId, channelId ? channelId.toString() : '', requiredPermission);
}

/**
 * Kullanıcının başka bir kullanıcıya erişim yetkisi olup olmadığını kontrol eder
 *
 * @param userId - Kullanıcı ID
 * @param targetUserId - Hedef kullanıcı ID
 * @param requiredPermission - Gerekli izin
 * @returns Erişim yetkisi var mı?
 */
async function hasUserPermission(
  userId: string,
  targetUserId: string,
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin'
): Promise<boolean> {
  // Kendisi için her zaman izin var
  if (userId === targetUserId) {
    return true;
  }

  // Hedef kullanıcıyı kontrol et
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) {
    throw new NotFoundError('Kullanıcı bulunamadı');
  }

  // Kullanıcıyı kontrol et
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('Kullanıcı bulunamadı');
  }

  // Admin kullanıcılar her şeye erişebilir
  const currentUserRole = user.get('role') as string;
  if (currentUserRole === 'admin') {
    return true;
  }

  // Moderatörler normal kullanıcıları düzenleyebilir
  const targetUserRole = targetUser.get('role') as string;
  if (currentUserRole === 'moderator' && targetUserRole === 'user') {
    return ['view', 'edit'].includes(requiredPermission);
  }

  // Diğer durumlarda sadece görüntüleme izni var
  return requiredPermission === 'view';
}

/**
 * İstek nesnesinden kullanıcı ID'sini alır
 *
 * @param req - Express istek nesnesi
 * @returns Kullanıcı ID
 */
export function getUserIdFromRequest(req: Request): string {
  const user = (req as any).user as UserDocument;

  if (!user || !user._id) {
    throw new ForbiddenError('Yetkilendirme gerekli');
  }

  return user._id.toString();
}

/**
 * Yetkilendirme kontrolü yapar ve hata fırlatır
 *
 * @param userId - Kullanıcı ID
 * @param resourceId - Kaynak ID
 * @param resourceType - Kaynak tipi
 * @param requiredPermission - Gerekli izin
 * @throws ForbiddenError - Yetki hatası
 */
export async function authorizeOrFail(
  userId: string,
  resourceId: string,
  resourceType: 'group' | 'channel' | 'message' | 'user',
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view'
): Promise<void> {
  const hasAccess = await hasPermission(userId, resourceId, resourceType, requiredPermission);

  if (!hasAccess) {
    throw new ForbiddenError(`Bu işlem için yetkiniz yok: ${resourceType} ${requiredPermission}`);
  }
}

export default {
  hasPermission,
  getUserIdFromRequest,
  authorizeOrFail,
};
