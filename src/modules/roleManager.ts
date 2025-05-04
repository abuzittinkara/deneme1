/**
 * src/modules/roleManager.ts
 * Rol yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Role, RoleDocument, RolePermissions } from '../models/Role';
import { Group, GroupDocument } from '../models/Group';
import { GroupMember, GroupMemberDocument } from '../models/GroupMember';
import { User, UserDocument } from '../models/User';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { toObjectId } from '../utils/mongoose-helpers';
import { ObjectId } from '../types/mongoose';
import { Permission } from '../types/enums';

// Model yardımcıları
const RoleHelper = createModelHelper<RoleDocument, typeof Role>(Role);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const GroupMemberHelper = createModelHelper<GroupMemberDocument, typeof GroupMember>(GroupMember);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// Rol bilgisi arayüzü
export interface RoleInfo {
  id: mongoose.Types.ObjectId;
  name: string;
  color: string;
  position: number;
  permissions: RolePermissions;
}

// İşlem sonucu arayüzü
export interface OperationResult {
  success: boolean;
  message: string;
}

/**
 * Yeni rol oluşturur
 * @param groupId - Grup ID'si
 * @param name - Rol adı
 * @param permissions - İzinler
 * @param color - Renk kodu
 * @param position - Pozisyon
 * @returns Oluşturulan rol bilgileri
 */
export async function createRole(
  groupId: string,
  name: string,
  permissions?: Partial<RolePermissions>,
  color?: string,
  position?: number
): Promise<RoleInfo> {
  try {
    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    const role = new Role({
      name,
      group: group._id,
      color: color || '#99AAB5',
      position: position || 0,
      permissions: permissions || {}
    });

    await role.save();

    // Eğer bu ilk rol ise, varsayılan rol olarak ayarla
    if (!group.defaultRole) {
      group.defaultRole = role._id as any;
      await group.save();
    }

    logger.info('Yeni rol oluşturuldu', {
      roleId: role._id,
      groupId,
      name
    });

    return {
      id: role._id as mongoose.Types.ObjectId,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: role.permissions
    };
  } catch (error) {
    logger.error('Rol oluşturma hatası', {
      error: (error as Error).message,
      groupId,
      name
    });
    throw error;
  }
}

/**
 * Rol günceller
 * @param roleId - Rol ID'si
 * @param updates - Güncellenecek alanlar
 * @returns Güncellenmiş rol bilgileri
 */
export async function updateRole(
  roleId: string,
  updates: {
    name?: string;
    color?: string;
    position?: number;
    permissions?: Partial<RolePermissions>;
  }
): Promise<RoleInfo> {
  try {
    const role = await RoleHelper.findById(roleId);
    if (!role) {
      throw new NotFoundError('Rol bulunamadı.');
    }

    // Güncellenebilir alanlar
    if (updates.name) role.name = updates.name;
    if (updates.color) role.color = updates.color;
    if (updates.position !== undefined) role.position = updates.position;

    // İzinleri güncelle
    if (updates.permissions) {
      Object.keys(updates.permissions).forEach(perm => {
        if (perm in role.permissions) {
          (role.permissions as any)[perm] = (updates.permissions as any)[perm];
        }
      });
    }

    await role.save();

    logger.info('Rol güncellendi', {
      roleId,
      updates
    });

    return {
      id: role._id as mongoose.Types.ObjectId,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: role.permissions
    };
  } catch (error) {
    logger.error('Rol güncelleme hatası', {
      error: (error as Error).message,
      roleId,
      updates
    });
    throw error;
  }
}

/**
 * Rol siler
 * @param roleId - Rol ID'si
 * @returns İşlem sonucu
 */
export async function deleteRole(roleId: string): Promise<OperationResult> {
  try {
    const role = await RoleHelper.findById(roleId);
    if (!role) {
      throw new NotFoundError('Rol bulunamadı.');
    }

    // Varsayılan rol kontrolü
    const group = await GroupHelper.findById(role.group);
    if (group && group.defaultRole && group.defaultRole.toString() === roleId) {
      throw new ValidationError('Varsayılan rol silinemez.');
    }

    // Tüm üyelerden rolü kaldır
    await GroupMemberHelper.updateMany(
      { group: role.group, roles: roleId },
      { $pull: { roles: roleId } }
    );

    await RoleHelper.getModel().deleteOne({ _id: roleId });

    logger.info('Rol silindi', { roleId });

    return { success: true, message: 'Rol başarıyla silindi.' };
  } catch (error) {
    logger.error('Rol silme hatası', {
      error: (error as Error).message,
      roleId
    });
    throw error;
  }
}

/**
 * Kullanıcıya rol atar
 * @param groupId - Grup ID'si
 * @param username - Kullanıcı adı
 * @param roleId - Rol ID'si
 * @returns İşlem sonucu
 */
export async function assignRoleToUser(
  groupId: string,
  username: string,
  roleId: string
): Promise<OperationResult> {
  try {
    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    const user = await UserHelper.findOne({ username });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    const role = await RoleHelper.findById(roleId);
    if (!role) {
      throw new NotFoundError('Rol bulunamadı.');
    }

    // Grup üyeliği kontrolü
    let member = await GroupMemberHelper.findOne({ user: user._id, group: group._id });
    if (!member) {
      // Kullanıcı grupta değilse, yeni üyelik oluştur
      member = new GroupMember({
        user: user._id,
        group: group._id,
        roles: []
      });
    }

    // Rol zaten atanmış mı kontrol et
    if (member.roles.some(r => r.toString() === roleId)) {
      return { success: true, message: 'Rol zaten atanmış.' };
    }

    // Rolü ata
    member.roles.push(toObjectId(roleId));
    await member.save();

    logger.info('Kullanıcıya rol atandı', {
      groupId,
      username,
      roleId
    });

    return { success: true, message: 'Rol başarıyla atandı.' };
  } catch (error) {
    logger.error('Rol atama hatası', {
      error: (error as Error).message,
      groupId,
      username,
      roleId
    });
    throw error;
  }
}

/**
 * Kullanıcıdan rol kaldırır
 * @param groupId - Grup ID'si
 * @param username - Kullanıcı adı
 * @param roleId - Rol ID'si
 * @returns İşlem sonucu
 */
export async function removeRoleFromUser(
  groupId: string,
  username: string,
  roleId: string
): Promise<OperationResult> {
  try {
    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    const user = await UserHelper.findOne({ username });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Grup üyeliği kontrolü
    let member = await GroupMemberHelper.findOne({ user: user._id, group: group._id });
    if (!member) {
      throw new ValidationError('Kullanıcı bu grubun üyesi değil.');
    }

    // Varsayılan rol kontrolü
    if (group.defaultRole && group.defaultRole.toString() === roleId) {
      throw new ValidationError('Varsayılan rol kaldırılamaz.');
    }

    // Rolü kaldır
    member.roles = member.roles.filter(r => r.toString() !== roleId);
    await member.save();

    logger.info('Kullanıcıdan rol kaldırıldı', {
      groupId,
      username,
      roleId
    });

    return { success: true, message: 'Rol başarıyla kaldırıldı.' };
  } catch (error) {
    logger.error('Rol kaldırma hatası', {
      error: (error as Error).message,
      groupId,
      username,
      roleId
    });
    throw error;
  }
}

/**
 * Kullanıcının izinlerini kontrol eder
 * @param username - Kullanıcı adı
 * @param groupId - Grup ID'si
 * @param permission - İzin adı
 * @returns İzin var mı
 */
export async function checkPermission(
  username: string,
  groupId: string,
  permission: Permission
): Promise<boolean> {
  try {
    const user = await UserHelper.findOne({ username });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    // Grup sahibi her zaman tüm izinlere sahiptir
    if (group.owner.toString() === user._id.toString()) {
      return true;
    }

    // Kullanıcının grup üyeliğini bul
    const member = await GroupMemberHelper.findOne(
      { user: user._id, group: group._id },
      null,
      { populate: 'roles' }
    );
    if (!member) {
      return false;
    }

    // Kullanıcının rollerini kontrol et
    for (const role of member.roles) {
      const roleDoc = role as unknown as RoleDocument;

      // Administrator izni her şeyi yapabilir
      if (roleDoc.permissions.administrator) {
        return true;
      }

      // Belirli izni kontrol et
      if (roleDoc.permissions[permission]) {
        return true;
      }
    }

    return false;
  } catch (error) {
    logger.error('İzin kontrolü hatası', {
      error: (error as Error).message,
      username,
      groupId,
      permission
    });
    throw error;
  }
}

/**
 * Kullanıcının rollerini getirir
 * @param username - Kullanıcı adı
 * @param groupId - Grup ID'si
 * @returns Roller listesi
 */
export async function getUserRoles(
  username: string,
  groupId: string
): Promise<RoleDocument[]> {
  try {
    const user = await UserHelper.findOne({ username });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    // Kullanıcının grup üyeliğini bul
    const member = await GroupMemberHelper.findOne({ user: user._id, group: group._id });
    if (!member) {
      return [];
    }

    // Kullanıcının rollerini getir
    const roles = await RoleHelper.find(
      { _id: { $in: member.roles } },
      null,
      { sort: { position: -1 } }
    );

    logger.info('Kullanıcı rolleri getirildi', {
      username,
      groupId,
      roleCount: roles.length
    });

    return roles;
  } catch (error) {
    logger.error('Kullanıcı rolleri getirme hatası', {
      error: (error as Error).message,
      username,
      groupId
    });
    throw error;
  }
}

export default {
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  checkPermission,
  getUserRoles
};
