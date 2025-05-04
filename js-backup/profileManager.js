/**************************************
 * modules/profileManager.js
 **************************************/
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const fileUpload = require('./fileUpload');

// Function to update user profile
async function updateUserProfile(userId, profileData) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Update basic profile fields
    if (profileData.name !== undefined) user.name = profileData.name;
    if (profileData.surname !== undefined) user.surname = profileData.surname;
    if (profileData.email !== undefined) user.email = profileData.email;
    if (profileData.phone !== undefined) user.phone = profileData.phone;
    if (profileData.bio !== undefined) user.bio = profileData.bio;
    if (profileData.customStatus !== undefined) user.customStatus = profileData.customStatus;

    // Update birthdate if provided
    if (profileData.birthdate) {
      user.birthdate = new Date(profileData.birthdate);
    }

    // Update user preferences
    if (profileData.preferences) {
      if (profileData.preferences.theme) user.preferences.theme = profileData.preferences.theme;
      if (profileData.preferences.notifications !== undefined) user.preferences.notifications = profileData.preferences.notifications;
      if (profileData.preferences.soundEffects !== undefined) user.preferences.soundEffects = profileData.preferences.soundEffects;
      if (profileData.preferences.language) user.preferences.language = profileData.preferences.language;
    }

    await user.save();

    // Return the updated user without sensitive information
    const userObj = user.toObject();
    delete userObj.passwordHash;

    return userObj;
  } catch (err) {
    console.error('Update user profile error:', err);
    throw err;
  }
}

// Function to change user password
async function changeUserPassword(userId, currentPassword, newPassword) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    // Hash and update the new password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    user.passwordHash = passwordHash;

    await user.save();

    return { success: true, message: 'Password updated successfully' };
  } catch (err) {
    console.error('Change user password error:', err);
    throw err;
  }
}

// Function to update user profile picture
async function updateProfilePicture(userId, fileData, originalName, mimeType) {
  try {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      try {
        await fileUpload.deleteFile(user.profilePicture);
      } catch (err) {
        console.error('Error deleting old profile picture:', err);
        // Continue even if deletion fails
      }
    }

    // Upload new profile picture
    const fileAttachment = await fileUpload.handleFileUpload(fileData, originalName, mimeType, userId);

    // Update user profile
    user.profilePicture = fileAttachment._id;
    await user.save();

    return {
      success: true,
      profilePicture: fileAttachment
    };
  } catch (err) {
    console.error('Update profile picture error:', err);
    throw err;
  }
}

// Function to get user profile
async function getUserProfile(userId) {
  try {
    const user = await User.findById(userId)
      .populate('profilePicture')
      .lean();

    if (!user) {
      throw new Error('User not found');
    }

    // Remove sensitive information
    delete user.passwordHash;

    return user;
  } catch (err) {
    console.error('Get user profile error:', err);
    throw err;
  }
}

/**
 * Kullanıcı adını değiştirir
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} newUsername - Yeni kullanıcı adı
 * @param {string} password - Mevcut şifre (doğrulama için)
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function changeUsername(userId, newUsername, password) {
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Şifreyi doğrula
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Şifre hatalı');
    }

    // Yeni kullanıcı adı kullanılabilir mi kontrol et
    if (newUsername === user.username) {
      throw new Error('Yeni kullanıcı adı mevcut kullanıcı adınızla aynı');
    }

    const existingUser = await User.findOne({ username: newUsername });
    if (existingUser) {
      throw new Error('Bu kullanıcı adı zaten kullanılıyor');
    }

    // Kullanıcı adını güncelle
    const oldUsername = user.username;
    user.username = newUsername;
    await user.save();

    return {
      success: true,
      oldUsername,
      newUsername
    };
  } catch (err) {
    console.error('Kullanıcı adı değiştirme hatası:', err);
    throw err;
  }
}

/**
 * Kullanıcı durumunu günceller
 * @param {string} userId - Kullanıcı ID'si
 * @param {string} status - Yeni durum (online, idle, dnd, invisible)
 * @param {string} customStatus - Özel durum mesajı
 * @returns {Promise<Object>} - Güncellenen kullanıcı
 */
async function updateUserStatus(userId, status, customStatus = null) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Durumu güncelle
    if (status && ['online', 'idle', 'dnd', 'invisible'].includes(status)) {
      user.status = status;
    }

    // Özel durum mesajını güncelle
    if (customStatus !== null) {
      user.customStatus = customStatus;
    }

    await user.save();

    // Hassas bilgileri kaldır
    const userObj = user.toObject();
    delete userObj.passwordHash;

    return userObj;
  } catch (err) {
    console.error('Kullanıcı durumu güncelleme hatası:', err);
    throw err;
  }
}

/**
 * Kullanıcı bildirim tercihlerini günceller
 * @param {string} userId - Kullanıcı ID'si
 * @param {Object} notificationPreferences - Bildirim tercihleri
 * @returns {Promise<Object>} - Güncellenen kullanıcı
 */
async function updateNotificationPreferences(userId, notificationPreferences) {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }

    // Bildirim tercihlerini güncelle
    if (notificationPreferences.notifications !== undefined) {
      user.preferences.notifications = notificationPreferences.notifications;
    }

    if (notificationPreferences.emailNotifications !== undefined) {
      user.preferences.emailNotifications = notificationPreferences.emailNotifications;
    }

    if (notificationPreferences.notificationTypes) {
      const types = notificationPreferences.notificationTypes;
      if (types.directMessages !== undefined) {
        user.preferences.notificationTypes.directMessages = types.directMessages;
      }
      if (types.mentions !== undefined) {
        user.preferences.notificationTypes.mentions = types.mentions;
      }
      if (types.friendRequests !== undefined) {
        user.preferences.notificationTypes.friendRequests = types.friendRequests;
      }
      if (types.groupInvites !== undefined) {
        user.preferences.notificationTypes.groupInvites = types.groupInvites;
      }
      if (types.channelMessages !== undefined) {
        user.preferences.notificationTypes.channelMessages = types.channelMessages;
      }
    }

    await user.save();

    // Hassas bilgileri kaldır
    const userObj = user.toObject();
    delete userObj.passwordHash;

    return userObj;
  } catch (err) {
    console.error('Bildirim tercihleri güncelleme hatası:', err);
    throw err;
  }
}

module.exports = {
  updateUserProfile,
  changeUserPassword,
  updateProfilePicture,
  getUserProfile,
  changeUsername,
  updateUserStatus,
  updateNotificationPreferences
};
