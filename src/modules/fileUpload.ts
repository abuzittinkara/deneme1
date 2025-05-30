/**
 * src/modules/fileUpload.ts
 * Dosya yükleme işlemleri
 */
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { FileAttachment, FileAttachmentDocument } from '../models/FileAttachment';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';

// Dosya kaydetme sonucu arayüzü
interface FileSaveResult {
  serverFilename: string;
  filePath: string;
  size: number;
}

// Uploads dizinini oluştur (yoksa) - güvenli yol kullanarak
const uploadsDir = path.resolve(path.join(__dirname, '..', '..', 'uploads'));
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true, mode: 0o755 });
    logger.info('Uploads dizini oluşturuldu', { path: uploadsDir });
  }
} catch (error) {
  logger.error('Uploads dizini oluşturulamadı', {
    error: error instanceof Error ? error.message : 'Bilinmeyen hata',
    path: uploadsDir,
  });
  // Kritik hata, uygulama başlatılmamalı
  throw new Error('Uploads dizini oluşturulamadı');
}

/**
 * Dosyayı diske kaydet
 * @param fileData - Base64 formatında dosya verisi
 * @param originalName - Orijinal dosya adı
 * @returns Kaydedilen dosya bilgileri
 */
async function saveFileToDisk(fileData: string, originalName: string): Promise<FileSaveResult> {
  try {
    // Dosya uzantısını güvenli hale getir
    const fileExtension = path.extname(originalName).toLowerCase();

    // İzin verilen uzantıları kontrol et
    const allowedExtensions = [
      '.jpg',
      '.jpeg',
      '.png',
      '.gif',
      '.webp',
      '.svg',
      '.mp3',
      '.wav',
      '.ogg',
      '.m4a',
      '.aac',
      '.mp4',
      '.webm',
      '.mov',
      '.avi',
      '.mkv',
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.txt',
      '.md',
      '.zip',
      '.rar',
      '.7z',
      '.tar',
      '.gz',
    ];

    const safeExtension = allowedExtensions.includes(fileExtension) ? fileExtension : '.bin';

    // Benzersiz ve güvenli bir dosya adı oluştur
    const serverFilename = `${uuidv4()}${safeExtension}`;

    // Dosya yolunu güvenli bir şekilde oluştur
    const filePath = path.resolve(path.join(uploadsDir, serverFilename));

    // Yol geçişi kontrolü
    if (!filePath.startsWith(uploadsDir)) {
      throw new Error('Güvenli olmayan dosya yolu');
    }

    // Base64 verisini buffer'a dönüştür
    const base64Data = fileData.replace(/^data:([A-Za-z-+/]+);base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Dosya boyutunu kontrol et (maksimum 10MB)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (buffer.length > maxFileSize) {
      throw new Error(`Dosya boyutu çok büyük. Maksimum boyut: ${maxFileSize / (1024 * 1024)}MB`);
    }

    // Dosyayı diske kaydet (promises kullanarak)
    await fs.promises.writeFile(filePath, buffer);

    logger.debug('Dosya diske kaydedildi', {
      originalName,
      serverFilename,
      size: buffer.length,
      path: filePath,
    });

    return {
      serverFilename,
      filePath: `/uploads/${serverFilename}`,
      size: buffer.length,
    };
  } catch (error) {
    logger.error('Dosya kaydetme hatası', { error: (error as Error).message, originalName });
    throw error;
  }
}

/**
 * İzin verilen MIME tipleri
 */
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
];

/**
 * Dosya yükleme işlemini yönet ve FileAttachment kaydı oluştur
 * @param fileData - Base64 formatında dosya verisi
 * @param originalName - Orijinal dosya adı
 * @param mimeType - Dosya MIME tipi
 * @param userId - Yükleyen kullanıcı ID'si
 * @param messageId - İlişkili mesaj ID'si (opsiyonel)
 * @param dmMessageId - İlişkili DM mesaj ID'si (opsiyonel)
 * @returns Oluşturulan dosya eki
 */
export async function handleFileUpload(
  fileData: string,
  originalName: string,
  mimeType: string,
  userId: string,
  messageId: string | null = null,
  dmMessageId: string | null = null
): Promise<FileAttachmentDocument> {
  try {
    // Dosya tipini kontrol et
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Desteklenmeyen dosya tipi: ${mimeType}`);
    }

    // Dosya adını güvenli hale getir
    const safeOriginalName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Dosyayı kaydet
    const { serverFilename, filePath, size } = await saveFileToDisk(fileData, safeOriginalName);

    // Yeni FileAttachment kaydı oluştur
    const fileAttachment = new FileAttachment({
      originalName: safeOriginalName,
      serverFilename,
      mimeType,
      size,
      uploader: new mongoose.Types.ObjectId(userId),
      path: filePath,
      message: messageId ? new mongoose.Types.ObjectId(messageId) : undefined,
      dmMessage: dmMessageId ? new mongoose.Types.ObjectId(dmMessageId) : undefined,
      uploadDate: new Date(),
    });

    await fileAttachment.save();

    logger.info('Dosya yüklendi', {
      fileId: fileAttachment._id,
      originalName: safeOriginalName,
      size,
      mimeType,
      userId,
    });

    return fileAttachment;
  } catch (error) {
    logger.error('Dosya yükleme hatası', {
      error: (error as Error).message,
      originalName,
      mimeType,
      userId,
    });
    throw error;
  }
}

/**
 * Dosya bilgilerini getir
 * @param fileId - Dosya ID'si
 * @returns Dosya bilgileri
 */
export async function getFileInfo(fileId: string): Promise<FileAttachmentDocument> {
  try {
    const fileInfo = await FileAttachment.findById(fileId).populate('uploader', 'username');

    if (!fileInfo) {
      throw new NotFoundError('Dosya bulunamadı');
    }

    logger.debug('Dosya bilgileri getirildi', { fileId });

    return fileInfo as FileAttachmentDocument;
  } catch (error) {
    logger.error('Dosya bilgileri getirme hatası', { error: (error as Error).message, fileId });
    throw error;
  }
}

/**
 * Dosyayı sil
 * @param fileId - Dosya ID'si
 * @returns İşlem başarılı mı
 */
export async function deleteFile(fileId: string): Promise<boolean> {
  try {
    const file = await FileAttachment.findById(fileId);
    if (!file) {
      throw new NotFoundError('Dosya bulunamadı');
    }

    // Dosya yolunu al ve güvenlik kontrolü yap
    const filePath = file.get('path');
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Geçersiz dosya yolu');
    }

    // Dosya yolunun uploads dizini içinde olduğundan emin ol - güvenli yol kullanarak
    const absolutePath = path.resolve(path.join(__dirname, '..', '..', filePath));

    // Yol geçişi kontrolü
    if (!absolutePath.startsWith(uploadsDir)) {
      logger.warn('Güvenli olmayan dosya silme girişimi engellendi', {
        fileId,
        filePath,
        absolutePath,
        uploadsDir,
      });
      throw new Error('Güvenlik hatası: Dosya yolu uploads dizini dışında');
    }

    // Dosyanın varlığını kontrol et
    if (!fs.existsSync(absolutePath)) {
      logger.warn('Silinecek dosya bulunamadı', { fileId, absolutePath });
      // Dosya bulunamasa bile veritabanı kaydını silmeye devam et
    } else {
      // Dosyayı diskten sil (promises kullanarak)
      try {
        await fs.promises.unlink(absolutePath);
        logger.debug('Dosya diskten silindi', { fileId, absolutePath });
      } catch (unlinkError) {
        logger.error('Dosya diskten silinirken hata oluştu', {
          error: unlinkError instanceof Error ? unlinkError.message : 'Bilinmeyen hata',
          fileId,
          absolutePath,
        });
        // Dosya silme hatası kritik değil, veritabanı kaydını silmeye devam et
      }
    }

    // Veritabanından kaydı sil
    await FileAttachment.deleteOne({ _id: fileId });

    const originalName = file.get('originalName');
    logger.info('Dosya silindi', { fileId, originalName, path: filePath });

    return true;
  } catch (error) {
    logger.error('Dosya silme hatası', { error: (error as Error).message, fileId });
    throw error;
  }
}

export default {
  handleFileUpload,
  getFileInfo,
  deleteFile,
};
