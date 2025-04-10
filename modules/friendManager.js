/**************************************
 * modules/friendManager.js
 * Arkadaşlık sistemi ile ilgili tüm işlevleri içerir
 **************************************/
const User = require('../models/User');

/**
 * Arkadaşlık isteği gönderir
 * @param {string} fromUsername - İsteği gönderen kullanıcı adı
 * @param {string} toUsername - İsteği alan kullanıcı adı
 * @param {Object} friendRequests - Bellek içi arkadaşlık istekleri nesnesi
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function sendFriendRequest(fromUsername, toUsername, friendRequests) {
  // Kendine istek gönderme kontrolü
  if (fromUsername === toUsername) {
    throw new Error('Kendinize arkadaşlık isteği gönderemezsiniz.');
  }
  
  // Hedef kullanıcıyı kontrol et
  const targetUser = await User.findOne({ username: toUsername });
  if (!targetUser) {
    throw new Error('Hedef kullanıcı bulunamadı.');
  }
  
  // Gönderen kullanıcıyı kontrol et
  const fromUser = await User.findOne({ username: fromUsername });
  if (!fromUser) {
    throw new Error('Gönderen kullanıcı bulunamadı.');
  }
  
  // Zaten arkadaş mı kontrol et
  if (fromUser.friends.includes(targetUser._id)) {
    throw new Error('Bu kullanıcı zaten arkadaşınız.');
  }
  
  // Engellenmiş mi kontrol et
  if (targetUser.blocked.includes(fromUser._id)) {
    throw new Error('Bu kullanıcı sizi engellemiş.');
  }
  
  if (fromUser.blocked.includes(targetUser._id)) {
    throw new Error('Bu kullanıcıyı engellemişsiniz.');
  }
  
  // Arkadaşlık isteği listesini oluştur veya güncelle
  if (!friendRequests[toUsername]) {
    friendRequests[toUsername] = [];
  }
  
  // Zaten istek gönderilmiş mi kontrol et
  const existingRequest = friendRequests[toUsername].find(req => req.from === fromUsername);
  if (existingRequest) {
    throw new Error('Zaten arkadaşlık isteği gönderilmiş.');
  }
  
  // Yeni isteği ekle
  friendRequests[toUsername].push({
    from: fromUsername,
    timestamp: new Date()
  });
  
  return { success: true };
}

/**
 * Arkadaşlık isteklerini getirir
 * @param {string} username - Kullanıcı adı
 * @param {Object} friendRequests - Bellek içi arkadaşlık istekleri nesnesi
 * @returns {Array} - Arkadaşlık istekleri listesi
 */
function getFriendRequests(username, friendRequests) {
  return friendRequests[username] || [];
}

/**
 * Arkadaşlık isteğini kabul eder
 * @param {string} username - İsteği kabul eden kullanıcı adı
 * @param {string} fromUsername - İsteği gönderen kullanıcı adı
 * @param {Object} friendRequests - Bellek içi arkadaşlık istekleri nesnesi
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function acceptFriendRequest(username, fromUsername, friendRequests) {
  // İstek var mı kontrol et
  if (!friendRequests[username] || !friendRequests[username].some(req => req.from === fromUsername)) {
    throw new Error('Arkadaşlık isteği bulunamadı.');
  }
  
  // Kullanıcıları bul
  const userDoc = await User.findOne({ username });
  const friendDoc = await User.findOne({ username: fromUsername });
  
  if (!userDoc || !friendDoc) {
    throw new Error('Kullanıcılar bulunamadı.');
  }
  
  // Zaten arkadaş mı kontrol et
  if (userDoc.friends.includes(friendDoc._id) && friendDoc.friends.includes(userDoc._id)) {
    // İsteği listeden kaldır
    friendRequests[username] = friendRequests[username].filter(req => req.from !== fromUsername);
    return { success: true, message: 'Zaten arkadaşsınız.' };
  }
  
  // Arkadaşlık ilişkisini kur
  if (!userDoc.friends.includes(friendDoc._id)) {
    userDoc.friends.push(friendDoc._id);
  }
  
  if (!friendDoc.friends.includes(userDoc._id)) {
    friendDoc.friends.push(userDoc._id);
  }
  
  await userDoc.save();
  await friendDoc.save();
  
  // İsteği listeden kaldır
  friendRequests[username] = friendRequests[username].filter(req => req.from !== fromUsername);
  
  return { success: true };
}

/**
 * Arkadaşlık isteğini reddeder
 * @param {string} username - İsteği reddeden kullanıcı adı
 * @param {string} fromUsername - İsteği gönderen kullanıcı adı
 * @param {Object} friendRequests - Bellek içi arkadaşlık istekleri nesnesi
 * @returns {Object} - İşlem sonucu
 */
function rejectFriendRequest(username, fromUsername, friendRequests) {
  // İstek var mı kontrol et
  if (!friendRequests[username] || !friendRequests[username].some(req => req.from === fromUsername)) {
    throw new Error('Arkadaşlık isteği bulunamadı.');
  }
  
  // İsteği listeden kaldır
  friendRequests[username] = friendRequests[username].filter(req => req.from !== fromUsername);
  
  return { success: true };
}

/**
 * Arkadaşlıktan çıkarır
 * @param {string} username - Kullanıcı adı
 * @param {string} friendUsername - Arkadaşlıktan çıkarılacak kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function removeFriend(username, friendUsername) {
  // Kullanıcıları bul
  const userDoc = await User.findOne({ username });
  const friendDoc = await User.findOne({ username: friendUsername });
  
  if (!userDoc || !friendDoc) {
    throw new Error('Kullanıcılar bulunamadı.');
  }
  
  // Arkadaşlık ilişkisini kaldır
  userDoc.friends = userDoc.friends.filter(friendId => !friendId.equals(friendDoc._id));
  friendDoc.friends = friendDoc.friends.filter(friendId => !friendId.equals(userDoc._id));
  
  await userDoc.save();
  await friendDoc.save();
  
  return { success: true };
}

module.exports = {
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend
};
