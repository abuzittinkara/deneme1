/**
 * src/modules/group/memberManager.ts
 * Grup üye yönetimi
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

// Grup üyesi arayüzü
export interface GroupMemberInfo {
  id: string;
  username: string;
  name?: string;
  profilePicture?: string;
  roles: string[];
  joinedAt: Date;
  isOnline: boolean;
  lastActiveAt?: Date;
}

// Rol atama parametreleri
export interface AssignRoleParams {
  groupId: string;
  userId: string;
  memberId: string;
  roleId: string;
}

/**
 * Grup üyelerini getirir
 * @param groupId - Grup ID'si
 * @returns Grup üyeleri
 */
export async function getGroupMembers(groupId: string): Promise<GroupMemberInfo[]> {
  try {
    // Grubu bul
    const group = await GroupHelper.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Grup üyelerini getir
    const members = await GroupMemberHelper.find({ group: group._id })
      .populate('user', 'username name surname profilePicture onlineStatus')
      .populate('roles', 'name')
      .sort({ joinedAt: -1 })
      .exec();

    // Üye bilgilerini formatla
    return members.map((member: GroupMemberDocument) => ({
      id: (member.user as any)._id.toString(),
      username: (member.user as any).username,
      name: (member.user as any).name,
      profilePicture: (member.user as any).profilePicture?.toString(),
      roles: (member.roles as any[]).map(role => role.name),
      joinedAt: member.joinedAt,
      isOnline: (member.user as any).onlineStatus?.isOnline || false,
      lastActiveAt: (member.user as any).onlineStatus?.lastActiveAt
    }));
  } catch (error) {
    logger.error('Grup üyelerini getirme hatası', {
      error: (error as Error).message,
      groupId
    });
    throw error;
  }
}

/**
 * Grup üyesi ekler
 * @param groupId - Grup ID'si
 * @param userId - İşlemi yapan kullanıcı ID'si
 * @param memberUsername - Eklenecek üye kullanıcı adı
 * @returns Eklenen üye bilgisi
 */
export async function addGroupMember(
  groupId: string,
  userId: string,
  memberUsername: string
): Promise<GroupMemberInfo> {
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
        role.permissions.includes('MANAGE_MEMBERS')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Grup üyesi ekleme yetkiniz yok');
      }
    }

    // Eklenecek kullanıcıyı bul
    const memberUser = await UserHelper.findOne({ username: memberUsername }).exec();
    if (!memberUser) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcının zaten grupta olup olmadığını kontrol et
    const existingMembership = await GroupMemberHelper.findOne({
      group: group._id,
      user: memberUser._id
    }).exec();

    if (existingMembership) {
      throw new ValidationError('Kullanıcı zaten grupta üye');
    }

    // Varsayılan rolü bul
    let defaultRoles: mongoose.Types.ObjectId[] = [];
    if (group.defaultRole) {
      defaultRoles = [group.defaultRole];
    }

    // Üyelik oluştur
    const newMembership = await GroupMemberHelper.create({
      group: group._id,
      user: memberUser._id,
      roles: defaultRoles,
      joinedAt: new Date()
    });

    // Kullanıcının gruplar listesini güncelle
    await UserHelper.getModel().updateOne(
      { _id: memberUser._id },
      { $addToSet: { groups: group._id } }
    );

    // Grup üyeleri listesini güncelle
    await GroupHelper.getModel().updateOne(
      { _id: group._id },
      { $addToSet: { users: memberUser._id } }
    );

    // Yeni üyeliği getir
    const populatedMembership = await GroupMemberHelper.findById(newMembership._id.toString())
      .populate('user', 'username name surname profilePicture onlineStatus')
      .populate('roles', 'name')
      .exec();

    logger.info('Grup üyesi eklendi', {
      groupId,
      userId,
      memberUsername
    });

    // Üye bilgisini formatla
    return {
      id: (populatedMembership!.user as any)._id.toString(),
      username: (populatedMembership!.user as any).username,
      name: (populatedMembership!.user as any).name,
      profilePicture: (populatedMembership!.user as any).profilePicture?.toString(),
      roles: (populatedMembership!.roles as any[]).map(role => role.name),
      joinedAt: populatedMembership!.joinedAt,
      isOnline: (populatedMembership!.user as any).onlineStatus?.isOnline || false,
      lastActiveAt: (populatedMembership!.user as any).onlineStatus?.lastActiveAt
    };
  } catch (error) {
    logger.error('Grup üyesi ekleme hatası', {
      error: (error as Error).message,
      groupId,
      userId,
      memberUsername
    });
    throw error;
  }
}

/**
 * Grup üyesini çıkarır
 * @param groupId - Grup ID'si
 * @param userId - İşlemi yapan kullanıcı ID'si
 * @param memberId - Çıkarılacak üye ID'si
 * @returns İşlem sonucu
 */
export async function removeGroupMember(
  groupId: string,
  userId: string,
  memberId: string
): Promise<{ success: boolean }> {
  try {
    // Grubu bul
    const group = await GroupHelper.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Grup sahibini çıkaramama kontrolü
    if (group.owner.toString() === memberId) {
      throw new ValidationError('Grup sahibi gruptan çıkarılamaz');
    }

    // Yetki kontrolü
    const isOwner = group.owner.toString() === userId;
    const isSelfRemoval = userId === memberId;

    if (!isOwner && !isSelfRemoval) {
      // Yönetici rolü kontrolü
      const membership = await GroupMemberHelper.findOne({
        group: group._id,
        user: toObjectId(userId)
      }).populate('roles').exec();

      if (!membership) {
        throw new ForbiddenError('Bu grupta üye değilsiniz');
      }

      const hasAdminPermission = (membership.roles as any[]).some(role =>
        role.permissions.includes('MANAGE_MEMBERS')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Grup üyesi çıkarma yetkiniz yok');
      }
    }

    // Çıkarılacak üyeliği bul
    const membershipToRemove = await GroupMemberHelper.findOne({
      group: group._id,
      user: toObjectId(memberId)
    }).exec();

    if (!membershipToRemove) {
      throw new NotFoundError('Üyelik bulunamadı');
    }

    // Üyeliği sil
    await membershipToRemove.deleteOne();

    // Kullanıcının gruplar listesini güncelle
    await User.updateOne(
      { _id: toObjectId(memberId) },
      { $pull: { groups: group._id } }
    );

    // Grup üyeleri listesini güncelle
    await Group.updateOne(
      { _id: group._id },
      { $pull: { users: toObjectId(memberId) } }
    );

    logger.info('Grup üyesi çıkarıldı', {
      groupId,
      userId,
      memberId
    });

    return { success: true };
  } catch (error) {
    logger.error('Grup üyesi çıkarma hatası', {
      error: (error as Error).message,
      groupId,
      userId,
      memberId
    });
    throw error;
  }
}

/**
 * Kullanıcıya rol atar
 * @param params - Rol atama parametreleri
 * @returns İşlem sonucu
 */
export async function assignRole(params: AssignRoleParams): Promise<{ success: boolean }> {
  try {
    const { groupId, userId, memberId, roleId } = params;

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
        role.permissions.includes('MANAGE_ROLES')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Rol atama yetkiniz yok');
      }
    }

    // Rolü bul
    const role = await RoleHelper.findById(roleId.toString()).exec();
    if (!role || role.group.toString() !== group._id.toString()) {
      throw new NotFoundError('Rol bulunamadı');
    }

    // Üyeliği bul
    const membership = await GroupMemberHelper.findOne({
      group: group._id,
      user: toObjectId(memberId)
    }).exec();

    if (!membership) {
      throw new NotFoundError('Üyelik bulunamadı');
    }

    // Rolü ekle
    if (!membership.roles.some(r => r.toString() === roleId)) {
      membership.roles.push(toObjectId(roleId));
      await membership.save();
    }

    logger.info('Rol atandı', {
      groupId,
      userId,
      memberId,
      roleId
    });

    return { success: true };
  } catch (error) {
    logger.error('Rol atama hatası', {
      error: (error as Error).message,
      groupId: params.groupId,
      userId: params.userId,
      memberId: params.memberId,
      roleId: params.roleId
    });
    throw error;
  }
}

/**
 * Kullanıcıdan rol kaldırır
 * @param groupId - Grup ID'si
 * @param userId - İşlemi yapan kullanıcı ID'si
 * @param memberId - Üye ID'si
 * @param roleId - Rol ID'si
 * @returns İşlem sonucu
 */
export async function removeRole(
  groupId: string,
  userId: string,
  memberId: string,
  roleId: string
): Promise<{ success: boolean }> {
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
        role.permissions.includes('MANAGE_ROLES')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Rol kaldırma yetkiniz yok');
      }
    }

    // Rolü bul
    const role = await RoleHelper.findById(roleId.toString()).exec();
    if (!role || role.group.toString() !== group._id.toString()) {
      throw new NotFoundError('Rol bulunamadı');
    }

    // Üyeliği bul
    const membership = await GroupMemberHelper.findOne({
      group: group._id,
      user: toObjectId(memberId)
    }).exec();

    if (!membership) {
      throw new NotFoundError('Üyelik bulunamadı');
    }

    // Rolü kaldır
    membership.roles = membership.roles.filter(r => r.toString() !== roleId);
    await membership.save();

    logger.info('Rol kaldırıldı', {
      groupId,
      userId,
      memberId,
      roleId
    });

    return { success: true };
  } catch (error) {
    logger.error('Rol kaldırma hatası', {
      error: (error as Error).message,
      groupId,
      userId,
      memberId,
      roleId
    });
    throw error;
  }
}

/**
 * Kullanıcıyı gruptan yasaklar
 * @param groupId - Grup ID'si
 * @param userId - İşlemi yapan kullanıcı ID'si
 * @param memberId - Yasaklanacak üye ID'si
 * @param reason - Yasaklama nedeni
 * @returns İşlem sonucu
 */
export async function banGroupMember(
  groupId: string,
  userId: string,
  memberId: string,
  reason?: string
): Promise<{ success: boolean }> {
  try {
    // Grubu bul
    const group = await GroupHelper.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Grup sahibini yasaklayamama kontrolü
    if (group.owner.toString() === memberId) {
      throw new ValidationError('Grup sahibi gruptan yasaklanamaz');
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
        role.permissions.includes('BAN_MEMBERS')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Grup üyesi yasaklama yetkiniz yok');
      }
    }

    // Önce üyeyi gruptan çıkar
    await removeGroupMember(groupId, userId, memberId);

    // Yasaklama kaydı oluştur
    await GroupBan.create({
      group: group._id,
      user: toObjectId(memberId),
      bannedBy: toObjectId(userId),
      reason: reason || 'Neden belirtilmedi',
      bannedAt: new Date()
    });

    logger.info('Grup üyesi yasaklandı', {
      groupId,
      userId,
      memberId,
      reason
    });

    return { success: true };
  } catch (error) {
    logger.error('Grup üyesi yasaklama hatası', {
      error: (error as Error).message,
      groupId,
      userId,
      memberId
    });
    throw error;
  }
}

/**
 * Kullanıcının grup yasağını kaldırır
 * @param groupId - Grup ID'si
 * @param userId - İşlemi yapan kullanıcı ID'si
 * @param bannedUserId - Yasağı kaldırılacak kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function unbanGroupMember(
  groupId: string,
  userId: string,
  bannedUserId: string
): Promise<{ success: boolean }> {
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
        role.permissions.includes('BAN_MEMBERS')
      );

      if (!hasAdminPermission) {
        throw new ForbiddenError('Grup üyesi yasağını kaldırma yetkiniz yok');
      }
    }

    // Yasaklama kaydını bul ve sil
    const result = await GroupBan.deleteOne({
      group: group._id,
      user: toObjectId(bannedUserId)
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError('Yasaklama kaydı bulunamadı');
    }

    logger.info('Grup üyesi yasağı kaldırıldı', {
      groupId,
      userId,
      bannedUserId
    });

    return { success: true };
  } catch (error) {
    logger.error('Grup üyesi yasağı kaldırma hatası', {
      error: (error as Error).message,
      groupId,
      userId,
      bannedUserId
    });
    throw error;
  }
}

// Grup yasaklama modeli (bu dosyada tanımlanmış)
interface GroupBanDocument extends mongoose.Document {
  group: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  bannedBy: mongoose.Types.ObjectId;
  reason: string;
  bannedAt: Date;
}

const GroupBanSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, default: 'Neden belirtilmedi' },
  bannedAt: { type: Date, default: Date.now }
});

// İndeksler
GroupBanSchema.index({ group: 1, user: 1 }, { unique: true });
GroupBanSchema.index({ bannedAt: 1 });

const GroupBan = mongoose.model<GroupBanDocument>('GroupBan', GroupBanSchema);

export default {
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  assignRole,
  removeRole,
  banGroupMember,
  unbanGroupMember
};
