/**
 * modules/archive/archiveManager.js
 * Veri arşivleme işlemleri
 */
const mongoose = require('mongoose');
const Message = require('../../models/Message');
const DirectMessage = require('../../models/DirectMessage');
const Session = require('../../models/Session');
const FileAttachment = require('../../models/FileAttachment');
const { logger } = require('../../utils/logger');

/**
 * Eski mesajları arşivler
 * @param {number} [days=90] - Gün sayısı
 * @returns {Promise<Object>} - Arşivleme sonucu
 */
async function archiveOldMessages(days = 90) {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Arşivlenecek mesajları bul
    const messagesToArchive = await Message.find({
      timestamp: { $lt: cutoffDate },
      isArchived: { $ne: true },
      isDeleted: { $ne: true }
    }).limit(1000);

    if (messagesToArchive.length === 0) {
      logger.info('Arşivlenecek mesaj bulunamadı');
      return { archivedCount: 0 };
    }

    // Arşiv koleksiyonunu oluştur (yoksa)
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'messages_archive' }).toArray();

    if (collections.length === 0) {
      await db.createCollection('messages_archive');

      // İndeksler oluştur
      await db.collection('messages_archive').createIndex({ channel: 1, timestamp: -1 });
      await db.collection('messages_archive').createIndex({ user: 1, timestamp: -1 });
      await db.collection('messages_archive').createIndex({ archivedAt: 1 });
    }

    // Mesajları arşiv koleksiyonuna ekle
    const archiveResult = await db.collection('messages_archive').insertMany(
      messagesToArchive.map(msg => ({
        ...msg.toObject(),
        archivedAt: new Date()
      }))
    );

    // Arşivlenen mesajları işaretle
    const messageIds = messagesToArchive.map(msg => msg._id);
    await Message.updateMany(
      { _id: { $in: messageIds } },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date()
        }
      }
    );

    logger.info(`${messagesToArchive.length} mesaj arşivlendi`);

    return {
      archivedCount: messagesToArchive.length,
      oldestMessageDate: messagesToArchive[0].timestamp,
      newestMessageDate: messagesToArchive[messagesToArchive.length - 1].timestamp
    };
  } catch (error) {
    logger.error('Mesaj arşivleme hatası', { error: error.message, days });
    throw error;
  }
}

/**
 * Eski direkt mesajları arşivler
 * @param {number} [days=90] - Gün sayısı
 * @returns {Promise<Object>} - Arşivleme sonucu
 */
async function archiveOldDirectMessages(days = 90) {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Arşivlenecek mesajları bul
    const messagesToArchive = await DirectMessage.find({
      timestamp: { $lt: cutoffDate },
      isArchived: { $ne: true },
      isDeleted: { $ne: true }
    }).limit(1000);

    if (messagesToArchive.length === 0) {
      logger.info('Arşivlenecek direkt mesaj bulunamadı');
      return { archivedCount: 0 };
    }

    // Arşiv koleksiyonunu oluştur (yoksa)
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'directmessages_archive' }).toArray();

    if (collections.length === 0) {
      await db.createCollection('directmessages_archive');

      // İndeksler oluştur
      await db.collection('directmessages_archive').createIndex({ sender: 1, recipient: 1, timestamp: -1 });
      await db.collection('directmessages_archive').createIndex({ sender: 1, timestamp: -1 });
      await db.collection('directmessages_archive').createIndex({ recipient: 1, timestamp: -1 });
      await db.collection('directmessages_archive').createIndex({ archivedAt: 1 });
    }

    // Mesajları arşiv koleksiyonuna ekle
    const archiveResult = await db.collection('directmessages_archive').insertMany(
      messagesToArchive.map(msg => ({
        ...msg.toObject(),
        archivedAt: new Date()
      }))
    );

    // Arşivlenen mesajları işaretle
    const messageIds = messagesToArchive.map(msg => msg._id);
    await DirectMessage.updateMany(
      { _id: { $in: messageIds } },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date()
        }
      }
    );

    logger.info(`${messagesToArchive.length} direkt mesaj arşivlendi`);

    return {
      archivedCount: messagesToArchive.length,
      oldestMessageDate: messagesToArchive[0].timestamp,
      newestMessageDate: messagesToArchive[messagesToArchive.length - 1].timestamp
    };
  } catch (error) {
    logger.error('Direkt mesaj arşivleme hatası', { error: error.message, days });
    throw error;
  }
}

/**
 * Eski oturumları temizler
 * @param {number} [days=30] - Gün sayısı
 * @returns {Promise<Object>} - Temizleme sonucu
 */
async function cleanupOldSessions(days = 30) {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Eski oturumları bul ve güncelle
    const result = await Session.updateMany(
      {
        isActive: true,
        lastActivity: { $lt: cutoffDate }
      },
      {
        $set: {
          isActive: false,
          logoutTime: new Date()
        }
      }
    );

    logger.info(`${result.modifiedCount} eski oturum temizlendi`);

    return {
      cleanedCount: result.modifiedCount
    };
  } catch (error) {
    logger.error('Oturum temizleme hatası', { error: error.message, days });
    throw error;
  }
}

/**
 * Kullanılmayan dosyaları temizler
 * @param {number} [days=365] - Gün sayısı
 * @returns {Promise<Object>} - Temizleme sonucu
 */
async function cleanupUnusedFiles(days = 365) {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Kullanılmayan dosyaları bul
    const unusedFiles = await FileAttachment.find({
      uploadDate: { $lt: cutoffDate },
      // FileAttachment şemasında isImportant alanı yok, bu nedenle kaldırıldı
      // Mesaj veya DM mesajı olmayan dosyaları bul
      $and: [
        { message: { $exists: false } },
        { dmMessage: { $exists: false } }
      ]
    }).limit(100);

    if (unusedFiles.length === 0) {
      logger.info('Temizlenecek dosya bulunamadı');
      return { cleanedCount: 0 };
    }

    // Dosyaları sil
    for (const file of unusedFiles) {
      try {
        // Dosyayı depolama alanından sil
        await deleteFileFromStorage(file.path);

        // Dosyayı veritabanından sil
        await FileAttachment.findByIdAndDelete(file._id);
      } catch (error) {
        logger.error('Dosya silme hatası', { error: error.message, fileId: file._id });
      }
    }

    logger.info(`${unusedFiles.length} kullanılmayan dosya temizlendi`);

    return {
      cleanedCount: unusedFiles.length
    };
  } catch (error) {
    logger.error('Dosya temizleme hatası', { error: error.message, days });
    throw error;
  }
}

/**
 * Dosyayı depolama alanından siler
 * @param {string} filePath - Dosya yolu
 * @returns {Promise<void>}
 */
async function deleteFileFromStorage(filePath) {
  // Bu fonksiyon, kullanılan depolama sistemine göre uyarlanmalıdır
  // Örneğin: S3, yerel dosya sistemi, vb.

  // Şimdilik sadece günlüğe kaydet
  logger.debug('Dosya silindi (simülasyon)', { filePath });
}

/**
 * Arşivleme işlemlerini çalıştırır
 * @returns {Promise<Object>} - Arşivleme sonucu
 */
async function runArchiveTasks() {
  try {
    // Eski mesajları arşivle
    const messagesResult = await archiveOldMessages();

    // Eski direkt mesajları arşivle
    const directMessagesResult = await archiveOldDirectMessages();

    // Eski oturumları temizle
    const sessionsResult = await cleanupOldSessions();

    // Kullanılmayan dosyaları temizle
    const filesResult = await cleanupUnusedFiles();

    logger.info('Arşivleme görevleri tamamlandı', {
      archivedMessages: messagesResult.archivedCount,
      archivedDirectMessages: directMessagesResult.archivedCount,
      cleanedSessions: sessionsResult.cleanedCount,
      cleanedFiles: filesResult.cleanedCount
    });

    return {
      archivedMessages: messagesResult.archivedCount,
      archivedDirectMessages: directMessagesResult.archivedCount,
      cleanedSessions: sessionsResult.cleanedCount,
      cleanedFiles: filesResult.cleanedCount
    };
  } catch (error) {
    logger.error('Arşivleme görevleri hatası', { error: error.message });
    throw error;
  }
}

module.exports = {
  archiveOldMessages,
  archiveOldDirectMessages,
  cleanupOldSessions,
  cleanupUnusedFiles,
  runArchiveTasks
};
