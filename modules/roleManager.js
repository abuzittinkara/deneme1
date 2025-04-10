// modules/roleManager.js
const Role = require('../models/Role');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');

/**
 * Yeni rol oluşturur
 * @param {string} groupId - Grup ID'si
 * @param {string} name - Rol adı
 * @param {Object} permissions - İzinler
 * @param {string} color - Renk kodu
 * @param {number} position - Pozisyon
 * @returns {Promise<Object>} - Oluşturulan rol bilgileri
 */
async function createRole(groupId, name, permissions, color, position) {
  const group = await Group.findOne({ groupId });
  if (!group) {
    throw new Error('Grup bulunamadı.');
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
    group.defaultRole = role._id;
    await group.save();
  }
  
  return {
    id: role._id,
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.permissions
  };
}

/**
 * Rol günceller
 * @param {string} roleId - Rol ID'si
 * @param {Object} updates - Güncellenecek alanlar
 * @returns {Promise<Object>} - Güncellenmiş rol bilgileri
 */
async function updateRole(roleId, updates) {
  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error('Rol bulunamadı.');
  }
  
  // Güncellenebilir alanlar
  if (updates.name) role.name = updates.name;
  if (updates.color) role.color = updates.color;
  if (updates.position !== undefined) role.position = updates.position;
  
  // İzinleri güncelle
  if (updates.permissions) {
    Object.keys(updates.permissions).forEach(perm => {
      if (role.permissions.hasOwnProperty(perm)) {
        role.permissions[perm] = updates.permissions[perm];
      }
    });
  }
  
  await role.save();
  
  return {
    id: role._id,
    name: role.name,
    color: role.color,
    position: role.position,
    permissions: role.permissions
  };
}

/**
 * Rol siler
 * @param {string} roleId - Rol ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function deleteRole(roleId) {
  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error('Rol bulunamadı.');
  }
  
  // Varsayılan rol kontrolü
  const group = await Group.findById(role.group);
  if (group && group.defaultRole && group.defaultRole.toString() === roleId) {
    throw new Error('Varsayılan rol silinemez.');
  }
  
  // Tüm üyelerden rolü kaldır
  await GroupMember.updateMany(
    { group: role.group, roles: roleId },
    { $pull: { roles: roleId } }
  );
  
  await Role.deleteOne({ _id: roleId });
  
  return { success: true, message: 'Rol başarıyla silindi.' };
}

/**
 * Kullanıcıya rol atar
 * @param {string} groupId - Grup ID'si
 * @param {string} username - Kullanıcı adı
 * @param {string} roleId - Rol ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function assignRoleToUser(groupId, username, roleId) {
  const group = await Group.findOne({ groupId });
  if (!group) {
    throw new Error('Grup bulunamadı.');
  }
  
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  const role = await Role.findById(roleId);
  if (!role) {
    throw new Error('Rol bulunamadı.');
  }
  
  // Grup üyeliği kontrolü
  let member = await GroupMember.findOne({ user: user._id, group: group._id });
  if (!member) {
    // Kullanıcı grupta değilse, yeni üyelik oluştur
    member = new GroupMember({
      user: user._id,
      group: group._id,
      roles: []
    });
  }
  
  // Rol zaten atanmış mı kontrol et
  if (member.roles.includes(roleId)) {
    return { success: true, message: 'Rol zaten atanmış.' };
  }
  
  // Rolü ata
  member.roles.push(roleId);
  await member.save();
  
  return { success: true, message: 'Rol başarıyla atandı.' };
}

/**
 * Kullanıcıdan rol kaldırır
 * @param {string} groupId - Grup ID'si
 * @param {string} username - Kullanıcı adı
 * @param {string} roleId - Rol ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function removeRoleFromUser(groupId, username, roleId) {
  const group = await Group.findOne({ groupId });
  if (!group) {
    throw new Error('Grup bulunamadı.');
  }
  
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  // Grup üyeliği kontrolü
  let member = await GroupMember.findOne({ user: user._id, group: group._id });
  if (!member) {
    throw new Error('Kullanıcı bu grubun üyesi değil.');
  }
  
  // Varsayılan rol kontrolü
  if (group.defaultRole && group.defaultRole.toString() === roleId) {
    throw new Error('Varsayılan rol kaldırılamaz.');
  }
  
  // Rolü kaldır
  member.roles = member.roles.filter(r => r.toString() !== roleId);
  await member.save();
  
  return { success: true, message: 'Rol başarıyla kaldırıldı.' };
}

/**
 * Kullanıcının izinlerini kontrol eder
 * @param {string} username - Kullanıcı adı
 * @param {string} groupId - Grup ID'si
 * @param {string} permission - İzin adı
 * @returns {Promise<boolean>} - İzin var mı
 */
async function checkPermission(username, groupId, permission) {
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }
  
  const group = await Group.findOne({ groupId });
  if (!group) {
    throw new Error('Grup bulunamadı.');
  }
  
  // Grup sahibi her zaman tüm izinlere sahiptir
  if (group.owner.toString() === user._id.toString()) {
    return true;
  }
  
  // Kullanıcının grup üyeliğini bul
  const member = await GroupMember.findOne({ user: user._id, group: group._id }).populate('roles');
  if (!member) {
    return false;
  }
  
  // Kullanıcının rollerini kontrol et
  for (const role of member.roles) {
    // Administrator izni her şeyi yapabilir
    if (role.permissions.administrator) {
      return true;
    }
    
    // Belirli izni kontrol et
    if (role.permissions[permission]) {
      return true;
    }
  }
  
  return false;
}

module.exports = {
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
  removeRoleFromUser,
  checkPermission
};
