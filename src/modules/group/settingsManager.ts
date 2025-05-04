/**
 * src/modules/group/settingsManager.ts
 * Grup ayarları yönetimi
 */
import mongoose from 'mongoose';
import { Group, GroupDocument } from '../../models/Group';
import { User, UserDocument } from '../../models/User';
import { GroupMember, GroupMemberDocument } from '../../models/GroupMember';
import { Role, RoleDocument } from '../../models/Role';
import { logger } from '../../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import { toObjectId, createModelHelper } from '../../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const GroupMemberHelper = createModelHelper<GroupMemberDocument, typeof GroupMember>(GroupMember);
const RoleHelper = createModelHelper<RoleDocument, typeof Role>(Role);

// Grup ayarları arayüzü
export interface GroupSettings {
  name: string;
  description: string;
  type: 'public' | 'private' | 'secret';
  rules?: string;
  icon?: string;
  defaultRole?: string;
}

// Grup ayarları güncelleme parametreleri
export interface UpdateGroupSettingsParams {
  groupId: string;
  userId: string;
  settings: Partial<GroupSettings>;
}

/**
 * Grup ayarlarını getirir
 * @param groupId - Grup ID'si
 * @returns Grup ayarları
 */
export async function getGroupSettings(groupId: string): Promise<GroupSettings> {
  try {
    const group = await GroupHelper.findOne({ groupId })
      .populate('defaultRole', 'name permissions')
      .populate('icon', 'url')
      .exec();

    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    return {
      name: group.name,
      description: group.description,
      type: group.type,
      rules: group.rules,
      icon: (group.icon as any)?.url,
      defaultRole: group.defaultRole ? (group.defaultRole as any)._id.toString() : undefined
    };
  } catch (error) {
    logger.error('Grup ayarlarını getirme hatası', {
      error: (error as Error).message,
      groupId
    });
    throw error;
  }
}

/**
 * Grup ayarlarını günceller
 * @param params - Güncelleme parametreleri
 * @returns Güncellenmiş grup ayarları
 */
export async function updateGroupSettings(params: UpdateGroupSettingsParams): Promise<GroupSettings> {
  try {
    const { groupId, userId, settings } = params;

    // Grubu bul
    const group = await GroupHelper.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Yetki kontrolü
    const isOwner = group.owner.toString() === userId;
    if (!isOwner) {
      // Yönetici rolü kontrolü
      const membership = await GroupMemberHelper.findOne({
        group: group._id,
        user: toObjectId(userId)
      }).populate('roles').exec();

      if (!membership) {
        throw new ForbiddenError('Bu grupta üye değilsiniz');
      }

      const hasAdminPermission = (membership.roles as any[]).some(role =>
        role.permissions.includes('MANAGE_GROUP')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Grup ayarlarını değiştirme yetkiniz yok');
      }
    }

    // Ayarları güncelle
    if (settings.name !== undefined) {
      if (!settings.name.trim()) {
        throw new ValidationError('Grup adı boş olamaz');
      }
      group.name = settings.name.trim();
    }

    if (settings.description !== undefined) {
      group.description = settings.description.trim();
    }

    if (settings.type !== undefined) {
      group.type = settings.type;
    }

    if (settings.rules !== undefined) {
      group.rules = settings.rules.trim();
    }

    if (settings.defaultRole !== undefined) {
      if (settings.defaultRole) {
        // Rolün varlığını kontrol et
        const role = await RoleHelper.findById(settings.defaultRole.toString()).exec();
        if (!role || role.group.toString() !== group._id.toString()) {
          throw new ValidationError('Geçersiz rol');
        }
        group.defaultRole = toObjectId(settings.defaultRole);
      } else {
        group.defaultRole = undefined;
      }
    }

    // Değişiklikleri kaydet
    await group.save();

    logger.info('Grup ayarları güncellendi', {
      groupId,
      userId,
      updatedFields: Object.keys(settings)
    });

    // Güncellenmiş ayarları döndür
    return await getGroupSettings(groupId);
  } catch (error) {
    logger.error('Grup ayarlarını güncelleme hatası', {
      error: (error as Error).message,
      groupId: params.groupId,
      userId: params.userId
    });
    throw error;
  }
}

/**
 * Grup ikonunu günceller
 * @param groupId - Grup ID'si
 * @param userId - Kullanıcı ID'si
 * @param fileId - Dosya ID'si
 * @returns Güncellenmiş grup ayarları
 */
export async function updateGroupIcon(groupId: string, userId: string, fileId: string): Promise<GroupSettings> {
  try {
    // Grubu bul
    const group = await GroupHelper.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Yetki kontrolü
    const isOwner = group.owner.toString() === userId;
    if (!isOwner) {
      // Yönetici rolü kontrolü
      const membership = await GroupMemberHelper.findOne({
        group: group._id,
        user: toObjectId(userId)
      }).populate('roles').exec();

      if (!membership) {
        throw new ForbiddenError('Bu grupta üye değilsiniz');
      }

      const hasAdminPermission = (membership.roles as any[]).some(role =>
        role.permissions.includes('MANAGE_GROUP')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Grup ikonunu değiştirme yetkiniz yok');
      }
    }

    // İkonu güncelle
    group.icon = toObjectId(fileId);
    await group.save();

    logger.info('Grup ikonu güncellendi', {
      groupId,
      userId,
      fileId
    });

    // Güncellenmiş ayarları döndür
    return await getGroupSettings(groupId);
  } catch (error) {
    logger.error('Grup ikonunu güncelleme hatası', {
      error: (error as Error).message,
      groupId,
      userId,
      fileId
    });
    throw error;
  }
}

/**
 * Grup sahibini değiştirir
 * @param groupId - Grup ID'si
 * @param currentOwnerId - Mevcut sahip ID'si
 * @param newOwnerId - Yeni sahip ID'si
 * @returns İşlem sonucu
 */
export async function transferGroupOwnership(
  groupId: string,
  currentOwnerId: string,
  newOwnerId: string
): Promise<{ success: boolean }> {
  try {
    // Grubu bul
    const group = await GroupHelper.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Mevcut sahibi kontrol et
    if (group.owner.toString() !== currentOwnerId) {
      throw new ForbiddenError('Bu grubu transfer etme yetkiniz yok');
    }

    // Yeni sahibi kontrol et
    const newOwner = await UserHelper.findById(newOwnerId).exec();
    if (!newOwner) {
      throw new NotFoundError('Yeni sahip bulunamadı');
    }

    // Yeni sahibin grupta olduğunu kontrol et
    const isMember = await GroupMemberHelper.findOne({
      group: group._id,
      user: toObjectId(newOwnerId)
    }).exec();

    if (!isMember) {
      throw new ValidationError('Yeni sahip grupta üye değil');
    }

    // Sahipliği transfer et
    group.owner = toObjectId(newOwnerId);
    await group.save();

    logger.info('Grup sahipliği transfer edildi', {
      groupId,
      previousOwnerId: currentOwnerId,
      newOwnerId
    });

    return { success: true };
  } catch (error) {
    logger.error('Grup sahipliği transfer hatası', {
      error: (error as Error).message,
      groupId,
      currentOwnerId,
      newOwnerId
    });
    throw error;
  }
}

export default {
  getGroupSettings,
  updateGroupSettings,
  updateGroupIcon,
  transferGroupOwnership
};
