/**
 * src/modules/archive/archiveManager.ts
 * Arşivleme işlemleri
 */
import mongoose from 'mongoose';
import { Message, MessageDocument } from '../../models/Message';
import { DirectMessage, DirectMessageDocument } from '../../models/DirectMessage';
import { Session, SessionDocument } from '../../models/Session';
import { FileAttachment, FileAttachmentDocument } from '../../models/FileAttachment';
import { logger } from '../../utils/logger';
import { createModelHelper } from '../../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const DirectMessageHelper = createModelHelper<DirectMessageDocument, typeof DirectMessage>(DirectMessage);
const SessionHelper = createModelHelper<SessionDocument, typeof Session>(Session);
const FileAttachmentHelper = createModelHelper<FileAttachmentDocument, typeof FileAttachment>(FileAttachment);

/**
 * Arşivleme sonucu arayüzü
 */
interface ArchiveResult {
  archivedCount: number;
  deletedCount?: number;
}

/**
 * Temizleme sonucu arayüzü
 */
interface CleanupResult {
  cleanedCount: number;
}

/**
 * Eski mesajları arşivler
 * @param days - Gün sayısı
 * @returns Arşivleme sonucu
 */
export async function archiveOldMessages(days: number = 90): Promise<ArchiveResult> {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Arşivlenecek mesajları bul
    const messagesToArchive = await MessageHelper.find({
      timestamp: { $lt: cutoffDate },
      isArchived: { $ne: true },
      isDeleted: { $ne: true }
    }).limit(1000).exec();

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
    const updateResult = await MessageHelper.getModel().updateMany(
      { _id: { $in: messagesToArchive.map(msg => msg._id) } },
      { $set: { isArchived: true } }
    );

    logger.info('Eski mesajlar arşivlendi', {
      archivedCount: archiveResult.insertedCount,
      updatedCount: updateResult.modifiedCount
    });

    return { archivedCount: archiveResult.insertedCount };
  } catch (error) {
    logger.error('Mesaj arşivleme hatası', { error: (error as Error).message, days });
    throw error;
  }
}

/**
 * Eski direkt mesajları arşivler
 * @param days - Gün sayısı
 * @returns Arşivleme sonucu
 */
export async function archiveOldDirectMessages(days: number = 90): Promise<ArchiveResult> {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Arşivlenecek mesajları bul
    const messagesToArchive = await DirectMessageHelper.find({
      timestamp: { $lt: cutoffDate },
      isArchived: { $ne: true },
      isDeleted: { $ne: true }
    }).limit(1000).exec();

    if (messagesToArchive.length === 0) {
      logger.info('Arşivlenecek direkt mesaj bulunamadı');
      return { archivedCount: 0 };
    }

    // Arşiv koleksiyonunu oluştur (yoksa)
    const db = mongoose.connection.db;
    const collections = await db.listCollections({ name: 'direct_messages_archive' }).toArray();

    if (collections.length === 0) {
      await db.createCollection('direct_messages_archive');

      // İndeksler oluştur
      await db.collection('direct_messages_archive').createIndex({ sender: 1, timestamp: -1 });
      await db.collection('direct_messages_archive').createIndex({ recipient: 1, timestamp: -1 });
      await db.collection('direct_messages_archive').createIndex({ archivedAt: 1 });
    }

    // Mesajları arşiv koleksiyonuna ekle
    const archiveResult = await db.collection('direct_messages_archive').insertMany(
      messagesToArchive.map(msg => ({
        ...msg.toObject(),
        archivedAt: new Date()
      }))
    );

    // Arşivlenen mesajları işaretle
    const updateResult = await DirectMessageHelper.getModel().updateMany(
      { _id: { $in: messagesToArchive.map(msg => msg._id) } },
      { $set: { isArchived: true } }
    );

    logger.info('Eski direkt mesajlar arşivlendi', {
      archivedCount: archiveResult.insertedCount,
      updatedCount: updateResult.modifiedCount
    });

    return { archivedCount: archiveResult.insertedCount };
  } catch (error) {
    logger.error('Direkt mesaj arşivleme hatası', { error: (error as Error).message, days });
    throw error;
  }
}

/**
 * Eski oturumları temizler
 * @param days - Gün sayısı
 * @returns Temizleme sonucu
 */
export async function cleanupOldSessions(days: number = 30): Promise<CleanupResult> {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Eski oturumları sil
    const result = await SessionHelper.getModel().deleteMany({
      lastActivity: { $lt: cutoffDate },
      isActive: false
    });

    logger.info('Eski oturumlar temizlendi', {
      cleanedCount: result.deletedCount
    });

    return { cleanedCount: result.deletedCount || 0 };
  } catch (error) {
    logger.error('Oturum temizleme hatası', { error: (error as Error).message, days });
    throw error;
  }
}

/**
 * Kullanılmayan dosyaları temizler
 * @param days - Gün sayısı
 * @returns Temizleme sonucu
 */
export async function cleanupUnusedFiles(days: number = 365): Promise<CleanupResult> {
  try {
    // Kesim tarihini hesapla
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Kullanılmayan dosyaları bul
    const unusedFiles = await FileAttachmentHelper.find({
      uploadDate: { $lt: cutoffDate },
      // Mesaj veya DM mesajı olmayan dosyaları bul
      $and: [
        { message: { $exists: false } },
        { dmMessage: { $exists: false } }
      ]
    }).limit(100).exec();

    if (unusedFiles.length === 0) {
      logger.info('Temizlenecek dosya bulunamadı');
      return { cleanedCount: 0 };
    }

    // Dosyaları sil
    const fileIds = unusedFiles.map(file => file._id);
    const result = await FileAttachmentHelper.getModel().deleteMany({ _id: { $in: fileIds } });

    logger.info('Kullanılmayan dosyalar temizlendi', {
      cleanedCount: result.deletedCount
    });

    return { cleanedCount: result.deletedCount || 0 };
  } catch (error) {
    logger.error('Dosya temizleme hatası', { error: (error as Error).message, days });
    throw error;
  }
}

/**
 * Arşivleme işlemlerini çalıştırır
 * @returns Arşivleme sonucu
 */
export async function runArchiveTasks(): Promise<{
  archivedMessages: number;
  archivedDirectMessages: number;
  cleanedSessions: number;
  cleanedFiles: number;
}> {
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
    logger.error('Arşivleme görevleri hatası', { error: (error as Error).message });
    throw error;
  }
}

export default {
  archiveOldMessages,
  archiveOldDirectMessages,
  cleanupOldSessions,
  cleanupUnusedFiles,
  runArchiveTasks
};
