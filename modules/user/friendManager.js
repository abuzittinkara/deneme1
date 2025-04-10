/**************************************
 * modules/user/friendManager.js
 * Arkadaş yönetimi işlemleri
 **************************************/
const User = require('../../models/User');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

/**
 * Kullanıcının arkadaş listesini getirir
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Array>} - Arkadaş listesi
 */
async function getUserFriends(username) {
  try {
    const user = await User.findOne({ username }).populate('friends', 'username name surname email profilePicture');
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }
    
    logger.info('Arkadaş listesi getirildi', { username, count: user.friends.length });
    
    return user.friends.map(friend => ({
      username: friend.username,
      name: friend.name,
      surname: friend.surname,
      email: friend.email,
      profilePicture: friend.profilePicture
    }));
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    
    logger.error('Arkadaş listesi getirme hatası', { error: error.message, username });
    throw new Error('Arkadaş listesi getirilirken bir hata oluştu.');
  }
}

/**
 * Arkadaş ekler
 * @param {string} username - Kullanıcı adı
 * @param {string} friendUsername - Eklenecek arkadaşın kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function addFriend(username, friendUsername) {
  try {
    // Kendini arkadaş olarak ekleme kontrolü
    if (username === friendUsername) {
      throw new ValidationError('Kendinizi arkadaş olarak ekleyemezsiniz.');
    }
    
    // Kullanıcıları bul
    const user = await User.findOne({ username });
    const friend = await User.findOne({ username: friendUsername });
    
    if (!user || !friend) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }
    
    // Zaten arkadaş mı kontrolü
    if (user.friends.includes(friend._id)) {
      return { success: true, message: 'Kullanıcı zaten arkadaşınız.' };
    }
    
    // Engelleme kontrolü
    if (user.blocked.includes(friend._id) || friend.blocked.includes(user._id)) {
      throw new ValidationError('Engellenen veya sizi engellemiş bir kullanıcıyı arkadaş olarak ekleyemezsiniz.');
    }
    
    // Arkadaş ekle (karşılıklı)
    user.friends.push(friend._id);
    friend.friends.push(user._id);
    
    await user.save();
    await friend.save();
    
    logger.info('Arkadaş eklendi', { username, friendUsername });
    
    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    
    logger.error('Arkadaş ekleme hatası', { error: error.message, username, friendUsername });
    throw new Error('Arkadaş eklenirken bir hata oluştu.');
  }
}

/**
 * Arkadaşlıktan çıkarır
 * @param {string} username - Kullanıcı adı
 * @param {string} friendUsername - Çıkarılacak arkadaşın kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function removeFriend(username, friendUsername) {
  try {
    // Kullanıcıları bul
    const user = await User.findOne({ username });
    const friend = await User.findOne({ username: friendUsername });
    
    if (!user || !friend) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }
    
    // Arkadaş mı kontrolü
    if (!user.friends.includes(friend._id)) {
      return { success: true, message: 'Kullanıcı arkadaşınız değil.' };
    }
    
    // Arkadaşlıktan çıkar (karşılıklı)
    user.friends = user.friends.filter(friendId => !friendId.equals(friend._id));
    friend.friends = friend.friends.filter(friendId => !friendId.equals(user._id));
    
    await user.save();
    await friend.save();
    
    logger.info('Arkadaşlıktan çıkarıldı', { username, friendUsername });
    
    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    
    logger.error('Arkadaşlıktan çıkarma hatası', { error: error.message, username, friendUsername });
    throw new Error('Arkadaşlıktan çıkarılırken bir hata oluştu.');
  }
}

module.exports = {
  getUserFriends,
  addFriend,
  removeFriend
};
