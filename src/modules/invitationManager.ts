/**
 * src/modules/invitationManager.ts
 * Davetiye yönetimi işlemleri
 */
import mongoose from 'mongoose';
import {
  Invitation,
  InvitationDocument,
  InvitationType,
  InvitationStatus,
} from '../models/Invitation';
import { User, UserDocument } from '../models/User';
import { Group, GroupDocument } from '../models/Group';
import { Channel, ChannelDocument } from '../models/Channel';
import { GroupMember, GroupMemberDocument } from '../models/GroupMember';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { toObjectId } from '../utils/mongoose-helpers';
import * as activityManager from './activityManager';
import { ActivityType } from '../models/UserActivity';

// Model yardımcıları
const InvitationHelper = createModelHelper<InvitationDocument, typeof Invitation>(Invitation);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const GroupMemberHelper = createModelHelper<GroupMemberDocument, typeof GroupMember>(GroupMember);

// Davetiye oluşturma parametreleri
export interface CreateInvitationParams {
  type: InvitationType;
  targetId: string; // Grup veya kanal ID'si
  creatorId: string;
  recipientId?: string; // Belirli bir kullanıcı için (isteğe bağlı)
  maxUses?: number; // Maksimum kullanım sayısı (isteğe bağlı)
  expiresIn?: number; // Saniye cinsinden (isteğe bağlı)
}

// Davetiye kabul etme parametreleri
export interface AcceptInvitationParams {
  code: string;
  userId: string;
}

// Davetiye sonucu
export interface InvitationResult {
  id: string;
  code: string;
  type: InvitationType;
  creator: {
    id: string;
    username: string;
  };
  target: {
    id: string;
    name: string;
  };
  recipient?: {
    id: string;
    username: string;
  };
  maxUses?: number;
  useCount: number;
  expiresAt?: Date;
  status: InvitationStatus;
  createdAt: Date;
}

/**
 * Davetiye oluşturur
 * @param params - Davetiye parametreleri
 * @returns Oluşturulan davetiye
 */
export async function createInvitation(
  params: CreateInvitationParams
): Promise<InvitationDocument> {
  try {
    // Oluşturan kullanıcıyı kontrol et
    const creator = await UserHelper.findById(params.creatorId);
    if (!creator) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Hedefi kontrol et
    let target;
    if (params.type === InvitationType.GROUP) {
      target = await GroupHelper.findById(params.targetId);
      if (!target) {
        throw new NotFoundError('Grup bulunamadı');
      }

      // Kullanıcının grupta olduğunu kontrol et
      const isMember = await GroupMemberHelper.findOne({
        user: toObjectId(params.creatorId),
        group: toObjectId(params.targetId),
      });
      if (!isMember) {
        throw new ForbiddenError('Bu grup için davetiye oluşturma yetkiniz yok');
      }
    } else if (params.type === InvitationType.CHANNEL) {
      target = await ChannelHelper.findById(params.targetId);
      if (!target) {
        throw new NotFoundError('Kanal bulunamadı');
      }

      // Kullanıcının kanalın ait olduğu grupta olduğunu kontrol et
      const isMember = await GroupMemberHelper.findOne({
        user: toObjectId(params.creatorId),
        group: target.group,
      });
      if (!isMember) {
        throw new ForbiddenError('Bu kanal için davetiye oluşturma yetkiniz yok');
      }
    } else {
      throw new ValidationError('Geçersiz davetiye türü');
    }

    // Alıcıyı kontrol et (varsa)
    let recipient;
    if (params.recipientId) {
      recipient = await UserHelper.findById(params.recipientId);
      if (!recipient) {
        throw new NotFoundError('Alıcı kullanıcı bulunamadı');
      }
    }

    // Son kullanma tarihini hesapla (varsa)
    let expiresAt;
    if (params.expiresIn) {
      expiresAt = new Date(Date.now() + params.expiresIn * 1000);
    }

    // Davetiye kodu oluştur
    const code = Invitation.generateCode();

    // Davetiyeyi oluştur
    const invitation = await InvitationHelper.create({
      type: params.type,
      code,
      creator: toObjectId(params.creatorId),
      target: toObjectId(params.targetId),
      recipient: params.recipientId ? toObjectId(params.recipientId) : undefined,
      maxUses: params.maxUses,
      useCount: 0,
      expiresAt,
      status: InvitationStatus.PENDING,
      acceptedBy: [],
    });

    // Aktivite kaydı
    await activityManager.logActivity({
      userId: params.creatorId,
      type: ActivityType.INVITATION_CREATED,
      target: {
        type: params.type === InvitationType.GROUP ? 'group' : 'channel',
        id: params.targetId,
      },
      metadata: {
        invitationId: invitation._id.toString(),
        code: invitation.code,
      },
    });

    logger.info('Davetiye oluşturuldu', {
      invitationId: invitation._id,
      code: invitation.code,
      creatorId: params.creatorId,
      type: params.type,
      targetId: params.targetId,
    });

    return invitation;
  } catch (error) {
    logger.error('Davetiye oluşturma hatası', {
      error: (error as Error).message,
      creatorId: params.creatorId,
      type: params.type,
      targetId: params.targetId,
    });
    throw error;
  }
}

/**
 * Davetiye koduna göre davetiye getirir
 * @param code - Davetiye kodu
 * @returns Davetiye
 */
export async function getInvitationByCode(code: string): Promise<InvitationDocument | null> {
  try {
    const invitation = await InvitationHelper.getModel().findByCode(code);

    if (invitation) {
      logger.debug('Davetiye koda göre getirildi', {
        code,
        invitationId: invitation._id,
      });
    } else {
      logger.debug('Davetiye bulunamadı', { code });
    }

    return invitation;
  } catch (error) {
    logger.error('Davetiye getirme hatası', {
      error: (error as Error).message,
      code,
    });
    throw error;
  }
}

/**
 * Davetiyeyi kabul eder
 * @param params - Kabul etme parametreleri
 * @returns İşlem sonucu
 */
export async function acceptInvitation(
  params: AcceptInvitationParams
): Promise<{ success: boolean; invitation: InvitationDocument }> {
  try {
    // Davetiyeyi bul
    const invitation = await InvitationHelper.getModel().findByCode(params.code);
    if (!invitation) {
      throw new NotFoundError('Davetiye bulunamadı');
    }

    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(params.userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Davetiyenin geçerli olup olmadığını kontrol et
    if (!invitation.isValid()) {
      throw new ValidationError('Davetiye geçersiz veya süresi dolmuş');
    }

    // Belirli bir kullanıcı için mi kontrol et
    if (invitation.recipient && !invitation.recipient.equals(toObjectId(params.userId))) {
      throw new ForbiddenError('Bu davetiye sizin için değil');
    }

    // Hedefi kontrol et
    if (invitation.type === InvitationType.GROUP) {
      // Grup davetiyesi
      const group = await GroupHelper.findById(invitation.target);
      if (!group) {
        throw new NotFoundError('Grup bulunamadı');
      }

      // Kullanıcının zaten grupta olup olmadığını kontrol et
      const isMember = await GroupMemberHelper.findOne({
        user: toObjectId(params.userId),
        group: invitation.target,
      });
      if (isMember) {
        throw new ValidationError('Zaten bu grubun üyesisiniz');
      }

      // Kullanıcıyı gruba ekle
      await GroupMemberHelper.create({
        user: toObjectId(params.userId),
        group: invitation.target,
        roles: [],
        joinedAt: new Date(),
      });

      // Grup üyeleri listesini güncelle
      await GroupHelper.getModel().updateOne(
        { _id: invitation.target },
        { $addToSet: { users: toObjectId(params.userId) } }
      );

      // Kullanıcının gruplar listesini güncelle
      await UserHelper.getModel().updateOne(
        { _id: params.userId },
        { $addToSet: { groups: invitation.target } }
      );
    } else if (invitation.type === InvitationType.CHANNEL) {
      // Kanal davetiyesi
      const channel = await ChannelHelper.findById(invitation.target);
      if (!channel) {
        throw new NotFoundError('Kanal bulunamadı');
      }

      // Kullanıcının kanalın ait olduğu grupta olup olmadığını kontrol et
      const isMember = await GroupMemberHelper.findOne({
        user: toObjectId(params.userId),
        group: channel.group,
      });
      if (!isMember) {
        throw new ValidationError('Önce gruba katılmalısınız');
      }

      // Kullanıcıyı kanala ekle
      await ChannelHelper.getModel().updateOne(
        { _id: invitation.target },
        { $addToSet: { members: toObjectId(params.userId) } }
      );
    }

    // Davetiyeyi güncelle
    invitation.useCount += 1;
    invitation.acceptedBy.push(toObjectId(params.userId));

    // Maksimum kullanım sayısına ulaşıldıysa durumu güncelle
    if (invitation.maxUses && invitation.useCount >= invitation.maxUses) {
      invitation.status = InvitationStatus.EXPIRED;
    }

    await invitation.save();

    // Aktivite kaydı
    await activityManager.logActivity({
      userId: params.userId,
      type: ActivityType.INVITATION_ACCEPTED,
      target: {
        type: invitation.type === InvitationType.GROUP ? 'group' : 'channel',
        id: invitation.target.toString(),
      },
      metadata: {
        invitationId: invitation._id.toString(),
        code: invitation.code,
      },
    });

    logger.info('Davetiye kabul edildi', {
      invitationId: invitation._id,
      code: invitation.code,
      userId: params.userId,
    });

    return { success: true, invitation };
  } catch (error) {
    logger.error('Davetiye kabul etme hatası', {
      error: (error as Error).message,
      code: params.code,
      userId: params.userId,
    });
    throw error;
  }
}

/**
 * Davetiyeyi iptal eder
 * @param invitationId - Davetiye ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function revokeInvitation(
  invitationId: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    // Davetiyeyi bul
    const invitation = await InvitationHelper.findById(invitationId);
    if (!invitation) {
      throw new NotFoundError('Davetiye bulunamadı');
    }

    // Kullanıcının davetiyeyi oluşturan kişi olup olmadığını kontrol et
    if (!invitation.creator.equals(toObjectId(userId))) {
      throw new ForbiddenError('Bu davetiyeyi iptal etme yetkiniz yok');
    }

    // Davetiyeyi iptal et
    invitation.status = InvitationStatus.REVOKED;
    await invitation.save();

    // Aktivite kaydı
    await activityManager.logActivity({
      userId,
      type: ActivityType.INVITATION_REVOKED,
      target: {
        type: invitation.type === InvitationType.GROUP ? 'group' : 'channel',
        id: invitation.target.toString(),
      },
      metadata: {
        invitationId: invitation._id.toString(),
        code: invitation.code,
      },
    });

    logger.info('Davetiye iptal edildi', {
      invitationId,
      code: invitation.code,
      userId,
    });

    return { success: true };
  } catch (error) {
    logger.error('Davetiye iptal etme hatası', {
      error: (error as Error).message,
      invitationId,
      userId,
    });
    throw error;
  }
}

/**
 * Kullanıcının oluşturduğu davetiyeleri getirir
 * @param userId - Kullanıcı ID'si
 * @returns Davetiyeler
 */
export async function getInvitationsByCreator(userId: string): Promise<InvitationDocument[]> {
  try {
    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Davetiyeleri getir
    const invitations = await InvitationHelper.getModel().findByCreator(toObjectId(userId));

    logger.debug('Kullanıcının oluşturduğu davetiyeler getirildi', {
      userId,
      count: invitations.length,
    });

    return invitations;
  } catch (error) {
    logger.error('Kullanıcının davetiyelerini getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Kullanıcıya gönderilen davetiyeleri getirir
 * @param userId - Kullanıcı ID'si
 * @returns Davetiyeler
 */
export async function getInvitationsByRecipient(userId: string): Promise<InvitationDocument[]> {
  try {
    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Davetiyeleri getir
    const invitations = await InvitationHelper.getModel().findByRecipient(toObjectId(userId));

    logger.debug('Kullanıcıya gönderilen davetiyeler getirildi', {
      userId,
      count: invitations.length,
    });

    return invitations;
  } catch (error) {
    logger.error('Kullanıcıya gönderilen davetiyeleri getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Süresi dolmuş davetiyeleri işaretler
 * @returns İşlem sonucu
 */
export async function markExpiredInvitations(): Promise<{ success: boolean }> {
  try {
    await InvitationHelper.getModel().markAsExpired();

    logger.info('Süresi dolmuş davetiyeler işaretlendi');

    return { success: true };
  } catch (error) {
    logger.error('Süresi dolmuş davetiyeleri işaretleme hatası', {
      error: (error as Error).message,
    });
    throw error;
  }
}

/**
 * Davetiye dokümanını sonuç formatına dönüştürür
 * @param invitation - Davetiye dokümanı
 * @returns Davetiye sonucu
 */
export function formatInvitation(invitation: InvitationDocument): InvitationResult {
  const result: InvitationResult = {
    id: invitation._id.toString(),
    code: invitation.code,
    type: invitation.type,
    creator: {
      id: invitation.creator.toString(),
      username: (invitation.creator as any)?.username || 'Unknown',
    },
    target: {
      id: invitation.target.toString(),
      name: (invitation.target as any)?.name || 'Unknown',
    },
    useCount: invitation.useCount,
    status: invitation.status,
    createdAt: invitation.createdAt,
  };

  // Alıcı bilgisini ekle (varsa)
  if (invitation.recipient) {
    result.recipient = {
      id: invitation.recipient.toString(),
      username: (invitation.recipient as any)?.username || 'Unknown',
    };
  }

  // Maksimum kullanım sayısını ekle (varsa)
  if (invitation.maxUses) {
    result.maxUses = invitation.maxUses;
  }

  // Son kullanma tarihini ekle (varsa)
  if (invitation.expiresAt) {
    result.expiresAt = invitation.expiresAt;
  }

  return result;
}

export default {
  createInvitation,
  getInvitationByCode,
  acceptInvitation,
  revokeInvitation,
  getInvitationsByCreator,
  getInvitationsByRecipient,
  markExpiredInvitations,
  formatInvitation,
};
