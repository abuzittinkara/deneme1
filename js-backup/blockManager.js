/**************************************
 * modules/user/blockManager.js
 * Engelleme yönetimi işlemleri
 **************************************/
const User = require('../../models/User');
const { NotFoundError, ValidationError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');

/**
 * Kullanıcının engellediği kişilerin listesini getirir
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Array>} - Engellenen kullanıcılar listesi
 */
async function getUserBlocked(username) {
  try {
    const user = await User.findOne({ username }).populate('blocked', 'username');
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }
    
    logger.info('Engellenen kullanıcılar listesi getirildi', { username, count: user.blocked.length });
    
    return user.blocked.map(blocked => ({
      username: blocked.username
    }));
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    
    logger.error('Engellenen kullanıcılar listesi getirme hatası', { error: error.message, username });
    throw new Error('Engellenen kullanıcılar listesi getirilirken bir hata oluştu.');
  }
}

/**
 * Bir kullanıcıyı engeller
 * @param {string} username - Kullanıcı adı
 * @param {string} blockedUsername - Engellenecek kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function blockUser(username, blockedUsername) {
  try {
    // Kendini engelleme kontrolü
    if (username === blockedUsername) {
      throw new ValidationError('Kendinizi engelleyemezsiniz.');
    }
    
    const user = await User.findOne({ username });
    const blockedUser = await User.findOne({ username: blockedUsername });
    
    if (!user || !blockedUser) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }
    
    // Zaten engellenmiş mi kontrolü
    if (user.blocked.includes(blockedUser._id)) {
      return { success: true, message: 'Kullanıcı zaten engellenmiş.' };
    }
    
    // Engellenen kullanıcıyı listeye ekle
    user.blocked.push(blockedUser._id);
    
    // Arkadaşlıktan çıkar (karşılıklı)
    user.friends = user.friends.filter(friendId => !friendId.equals(blockedUser._id));
    blockedUser.friends = blockedUser.friends.filter(friendId => !friendId.equals(user._id));
    
    await user.save();
    await blockedUser.save();
    
    logger.info('Kullanıcı engellendi', { username, blockedUsername });
    
    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    
    logger.error('Kullanıcı engelleme hatası', { error: error.message, username, blockedUsername });
    throw new Error('Kullanıcı engellenirken bir hata oluştu.');
  }
}

/**
 * Bir kullanıcının engelini kaldırır
 * @param {string} username - Kullanıcı adı
 * @param {string} unblockedUsername - Engeli kaldırılacak kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function unblockUser(username, unblockedUsername) {
  try {
    const user = await User.findOne({ username });
    const unblockedUser = await User.findOne({ username: unblockedUsername });
    
    if (!user || !unblockedUser) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }
    
    // Engellenen kullanıcıyı listeden çıkar
    user.blocked = user.blocked.filter(blockedId => !blockedId.equals(unblockedUser._id));
    await user.save();
    
    logger.info('Kullanıcı engeli kaldırıldı', { username, unblockedUsername });
    
    return { success: true };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    
    logger.error('Kullanıcı engeli kaldırma hatası', { error: error.message, username, unblockedUsername });
    throw new Error('Kullanıcı engeli kaldırılırken bir hata oluştu.');
  }
}

module.exports = {
  getUserBlocked,
  blockUser,
  unblockUser
};
