/**************************************
 * modules/groupManager.js
 * Grup yönetimi ile ilgili tüm işlevleri içerir
 **************************************/
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const Group = require('../models/Group');
const Channel = require('../models/Channel');

/**
 * Veritabanından grupları yükler ve bellek içi groups nesnesine ekler
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<void>}
 */
async function loadGroupsFromDB(groups) {
  try {
    const groupDocs = await Group.find({});
    groupDocs.forEach(groupDoc => {
      groups[groupDoc.groupId] = {
        owner: groupDoc.owner,
        name: groupDoc.name,
        users: [],
        rooms: {}
      };
    });
    console.log("loadGroupsFromDB tamamlandı, gruplar:", Object.keys(groups));
  } catch (err) {
    console.error("loadGroupsFromDB hatası:", err);
  }
}

/**
 * Bir kullanıcıya ait grupları getirir ve socket'e gönderir
 * @param {string} socketId - Kullanıcının socket ID'si
 * @param {Object} users - Bellek içi users nesnesi
 * @param {Object} io - Socket.IO nesnesi
 * @returns {Promise<void>}
 */
async function sendGroupsListToUser(socketId, users, io) {
  const userData = users[socketId];
  if (!userData || !userData.username) return;
  try {
    const userDoc = await User.findOne({ username: userData.username }).populate('groups');
    if (!userDoc) return;
    const groupList = userDoc.groups.map(g => ({
      id: g.groupId,
      name: g.name,
      owner: g.owner
    }));
    io.to(socketId).emit('groupsList', groupList);
  } catch (err) {
    console.error("sendGroupsListToUser hatası:", err);
  }
}

/**
 * Yeni bir grup oluşturur
 * @param {string} groupName - Grup adı
 * @param {string} username - Grup sahibinin kullanıcı adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<Object>} - Oluşturulan grup bilgileri
 */
async function createGroup(groupName, username, groups) {
  if (!groupName) throw new Error("Grup adı boş olamaz");
  
  const trimmed = groupName.trim();
  if (!trimmed) throw new Error("Grup adı boş olamaz");
  
  const userDoc = await User.findOne({ username });
  if (!userDoc) throw new Error("Kullanıcı bulunamadı");
  
  const groupId = uuidv4();
  const newGroup = new Group({
    groupId,
    name: trimmed,
    owner: userDoc._id,
    users: [userDoc._id]
  });
  
  await newGroup.save();
  userDoc.groups.push(newGroup._id);
  await userDoc.save();
  
  groups[groupId] = {
    owner: username, 
    name: trimmed,
    users: [{ id: null, username }],
    rooms: {}
  };
  
  return { groupId, name: trimmed };
}

/**
 * Bir gruba kullanıcı ekler
 * @param {string} groupId - Grup ID'si
 * @param {string} username - Eklenecek kullanıcının adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<void>}
 */
async function addUserToGroup(groupId, username, groups) {
  if (!groups[groupId]) throw new Error("Grup bulunamadı");
  
  const userDoc = await User.findOne({ username });
  if (!userDoc) throw new Error("Kullanıcı bulunamadı");
  
  const groupDoc = await Group.findOne({ groupId });
  if (!groupDoc) throw new Error("Grup bulunamadı");
  
  // Kullanıcı zaten grupta mı kontrol et
  if (groupDoc.users.includes(userDoc._id)) {
    return; // Kullanıcı zaten grupta, işlem yapma
  }
  
  // Kullanıcıyı gruba ekle
  groupDoc.users.push(userDoc._id);
  await groupDoc.save();
  
  // Kullanıcının gruplarına bu grubu ekle
  if (!userDoc.groups.includes(groupDoc._id)) {
    userDoc.groups.push(groupDoc._id);
    await userDoc.save();
  }
}

/**
 * Bir grubu siler
 * @param {string} groupId - Silinecek grup ID'si
 * @param {string} username - İşlemi yapan kullanıcı adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<void>}
 */
async function deleteGroup(groupId, username, groups) {
  if (!groups[groupId]) throw new Error("Grup bulunamadı");
  
  // Grup sahibi kontrolü
  if (groups[groupId].owner !== username) {
    throw new Error("Bu grubu silme yetkiniz yok");
  }
  
  // Grubu veritabanından sil
  const groupDoc = await Group.findOne({ groupId });
  if (!groupDoc) throw new Error("Grup veritabanında bulunamadı");
  
  // Grup üyelerinin listesinden grubu kaldır
  for (const userId of groupDoc.users) {
    await User.updateOne(
      { _id: userId },
      { $pull: { groups: groupDoc._id } }
    );
  }
  
  // Gruba ait kanalları sil
  await Channel.deleteMany({ group: groupDoc._id });
  
  // Grubu sil
  await Group.deleteOne({ _id: groupDoc._id });
  
  // Bellek içi gruptan sil
  delete groups[groupId];
}

/**
 * Bir grubun adını değiştirir
 * @param {string} groupId - Grup ID'si
 * @param {string} newName - Yeni grup adı
 * @param {string} username - İşlemi yapan kullanıcı adı
 * @param {Object} groups - Bellek içi groups nesnesi
 * @returns {Promise<Object>} - Güncellenmiş grup bilgileri
 */
async function renameGroup(groupId, newName, username, groups) {
  if (!groups[groupId]) throw new Error("Grup bulunamadı");
  
  // Grup sahibi kontrolü
  if (groups[groupId].owner !== username) {
    throw new Error("Bu grubu yeniden adlandırma yetkiniz yok");
  }
  
  const trimmedName = newName.trim();
  if (!trimmedName) throw new Error("Grup adı boş olamaz");
  
  // Grubu veritabanında güncelle
  const groupDoc = await Group.findOne({ groupId });
  if (!groupDoc) throw new Error("Grup veritabanında bulunamadı");
  
  groupDoc.name = trimmedName;
  await groupDoc.save();
  
  // Bellek içi grubu güncelle
  groups[groupId].name = trimmedName;
  
  return { groupId, name: trimmedName };
}

/**
 * Bir gruptaki tüm kullanıcıların listesini getirir
 * @param {string} groupId - Grup ID'si
 * @returns {Promise<Object>} - Çevrimiçi ve çevrimdışı kullanıcılar
 */
async function getOnlineOfflineDataForGroup(groupId, onlineUsernames) {
  const groupDoc = await Group.findOne({ groupId }).populate('users');
  if (!groupDoc) return { online: [], offline: [] };
  
  const online = [];
  const offline = [];
  
  groupDoc.users.forEach(u => {
    if (onlineUsernames.has(u.username)) {
      online.push({ username: u.username });
    } else {
      offline.push({ username: u.username });
    }
  });
  
  return { online, offline };
}

/**
 * Bir gruptaki tüm kullanıcılara grup üyelerini yayınlar
 * @param {string} groupId - Grup ID'si
 * @param {Object} io - Socket.IO nesnesi
 * @param {Set} onlineUsernames - Çevrimiçi kullanıcılar kümesi
 * @returns {Promise<void>}
 */
async function broadcastGroupUsers(groupId, io, onlineUsernames) {
  try {
    const { online, offline } = await getOnlineOfflineDataForGroup(groupId, onlineUsernames);
    io.to(groupId).emit('groupUsers', { online, offline });
  } catch (err) {
    console.error("broadcastGroupUsers hatası:", err);
  }
}

module.exports = {
  loadGroupsFromDB,
  sendGroupsListToUser,
  createGroup,
  addUserToGroup,
  deleteGroup,
  renameGroup,
  getOnlineOfflineDataForGroup,
  broadcastGroupUsers
};
