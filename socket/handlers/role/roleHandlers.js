/**************************************
 * socket/handlers/role/roleHandlers.js
 * Rol ve izin ile ilgili socket olaylarını yönetir
 **************************************/
const { logger } = require('../../../utils/logger');
const { handleSocketError } = require('../../../utils/errorHandlers');

/**
 * Rol socket olaylarını kaydeder
 * @param {Object} socket - Socket nesnesi
 * @param {Object} io - Socket.IO sunucusu
 * @param {Object} deps - Bağımlılıklar
 */
function registerRoleHandlers(socket, io, deps) {
  const { 
    users, 
    groups, 
    roleManager
  } = deps;

  // Rol oluşturma olayı
  socket.on('createRole', async (data, callback) => {
    try {
      const { groupId, roleName, color, permissions } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Rol oluştur
      const result = await roleManager.createRole(groupId, userData.username, roleName, color, permissions);
      
      if (result.success) {
        // Gruptaki tüm kullanıcılara rol listesini güncelle
        const socketsInGroup = await io.in(groupId).fetchSockets();
        for (const s of socketsInGroup) {
          s.emit('roleListUpdated', { groupId });
        }
      }
      
      callback(result);
      
      logger.info('Rol oluşturuldu', { 
        groupId, 
        roleName,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Rol oluşturma hatası", socket, callback);
    }
  });

  // Rol güncelleme olayı
  socket.on('updateRole', async (data, callback) => {
    try {
      const { groupId, roleId, roleName, color, permissions } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Rol güncelle
      const result = await roleManager.updateRole(groupId, roleId, userData.username, roleName, color, permissions);
      
      if (result.success) {
        // Gruptaki tüm kullanıcılara rol listesini güncelle
        const socketsInGroup = await io.in(groupId).fetchSockets();
        for (const s of socketsInGroup) {
          s.emit('roleListUpdated', { groupId });
        }
      }
      
      callback(result);
      
      logger.info('Rol güncellendi', { 
        groupId, 
        roleId,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Rol güncelleme hatası", socket, callback);
    }
  });

  // Rol silme olayı
  socket.on('deleteRole', async (data, callback) => {
    try {
      const { groupId, roleId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Rol sil
      const result = await roleManager.deleteRole(groupId, roleId, userData.username);
      
      if (result.success) {
        // Gruptaki tüm kullanıcılara rol listesini güncelle
        const socketsInGroup = await io.in(groupId).fetchSockets();
        for (const s of socketsInGroup) {
          s.emit('roleListUpdated', { groupId });
        }
      }
      
      callback(result);
      
      logger.info('Rol silindi', { 
        groupId, 
        roleId,
        username: userData.username
      });
    } catch (err) {
      handleSocketError(err, "Rol silme hatası", socket, callback);
    }
  });

  // Rol atama olayı
  socket.on('assignRole', async (data, callback) => {
    try {
      const { groupId, roleId, targetUsername } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Rol ata
      const result = await roleManager.assignRole(groupId, roleId, userData.username, targetUsername);
      
      if (result.success) {
        // Hedef kullanıcıya bildirim gönder
        const targetSocketId = Object.keys(users).find(id => users[id].username === targetUsername);
        if (targetSocketId) {
          io.to(targetSocketId).emit('roleAssigned', {
            groupId,
            roleId,
            roleName: result.roleName
          });
        }
      }
      
      callback(result);
      
      logger.info('Rol atandı', { 
        groupId, 
        roleId,
        username: userData.username,
        targetUsername
      });
    } catch (err) {
      handleSocketError(err, "Rol atama hatası", socket, callback);
    }
  });

  // Rol kaldırma olayı
  socket.on('removeRole', async (data, callback) => {
    try {
      const { groupId, roleId, targetUsername } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Rol kaldır
      const result = await roleManager.removeRole(groupId, roleId, userData.username, targetUsername);
      
      if (result.success) {
        // Hedef kullanıcıya bildirim gönder
        const targetSocketId = Object.keys(users).find(id => users[id].username === targetUsername);
        if (targetSocketId) {
          io.to(targetSocketId).emit('roleRemoved', {
            groupId,
            roleId,
            roleName: result.roleName
          });
        }
      }
      
      callback(result);
      
      logger.info('Rol kaldırıldı', { 
        groupId, 
        roleId,
        username: userData.username,
        targetUsername
      });
    } catch (err) {
      handleSocketError(err, "Rol kaldırma hatası", socket, callback);
    }
  });

  // Grup rolleri getirme olayı
  socket.on('getGroupRoles', async (data, callback) => {
    try {
      const { groupId } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Grup rollerini getir
      const roles = await roleManager.getGroupRoles(groupId);
      
      callback({ success: true, roles });
      
      logger.debug('Grup rolleri getirildi', { 
        groupId,
        count: roles.length
      });
    } catch (err) {
      handleSocketError(err, "Grup rolleri getirme hatası", socket, callback);
    }
  });

  // Kullanıcı rolleri getirme olayı
  socket.on('getUserRoles', async (data, callback) => {
    try {
      const { groupId, username } = data;
      const userData = users[socket.id];
      
      if (!userData || !userData.username) {
        return callback({ success: false, message: "Kullanıcı adınız tanımlı değil." });
      }
      
      // Kullanıcı rollerini getir
      const roles = await roleManager.getUserRoles(groupId, username);
      
      callback({ success: true, roles });
      
      logger.debug('Kullanıcı rolleri getirildi', { 
        groupId,
        username,
        count: roles.length
      });
    } catch (err) {
      handleSocketError(err, "Kullanıcı rolleri getirme hatası", socket, callback);
    }
  });
}

module.exports = registerRoleHandlers;
