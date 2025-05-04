/**
 * src/modules/mediaProcessor.ts
 * Medya dosyaları işleme modülü
 */
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { FileAttachment } from '../models/FileAttachment';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

// Dosya kategorileri
export type FileCategory = 'image' | 'video' | 'audio' | 'document' | 'other';

// Dosya bilgisi arayüzü
export interface FileInfo {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  formattedSize: string;
  path: string;
  uploadDate: Date;
  uploader: string | null;
  category: FileCategory;
}

// Resim önizleme meta verileri arayüzü
export interface ImagePreviewMetadata extends FileInfo {
  previewUrl: string;
  isAnimated: boolean;
}

// Video önizleme meta verileri arayüzü
export interface VideoPreviewMetadata extends FileInfo {
  previewUrl: string;
  isStreamable: boolean;
}

// Ses önizleme meta verileri arayüzü
export interface AudioPreviewMetadata extends FileInfo {
  previewUrl: string;
  isStreamable: boolean;
}

// Önizleme HTML sonucu arayüzü
export interface PreviewHtmlResult {
  previewHtml: string;
  fileInfo: FileInfo;
}

// Dosya işlemleri için promisify
const statAsync = promisify(fs.stat);

/**
 * Dosya türünü kategorize eder
 * @param mimeType - MIME türü
 * @returns Dosya kategorisi
 */
export function categorizeFileType(mimeType: string): FileCategory {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else if (
    mimeType === 'application/pdf' ||
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-powerpoint' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    mimeType === 'text/plain'
  ) {
    return 'document';
  } else {
    return 'other';
  }
}

/**
 * Dosya bilgilerini getirir
 * @param fileId - Dosya ID'si
 * @returns Dosya bilgileri
 */
export async function getFileInfo(fileId: string): Promise<FileInfo> {
  try {
    const file = await FileAttachment.findById(fileId)
      .populate('uploader', 'username');

    if (!file) {
      throw new NotFoundError('Dosya bulunamadı.');
    }

    // Dosya bilgilerini al
    const size = file.get('size');
    const mimeType = file.get('mimeType');

    // Dosya boyutunu formatla
    let formattedSize: string;
    if (size < 1024) {
      formattedSize = `${size} B`;
    } else if (size < 1024 * 1024) {
      formattedSize = `${(size / 1024).toFixed(2)} KB`;
    } else if (size < 1024 * 1024 * 1024) {
      formattedSize = `${(size / (1024 * 1024)).toFixed(2)} MB`;
    } else {
      formattedSize = `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }

    // Dosya türünü kategorize et
    const category = categorizeFileType(mimeType);

    logger.debug('Dosya bilgileri getirildi', { fileId, category });

    // Diğer dosya bilgilerini al
    const originalName = file.get('originalName');
    const path = file.get('path');
    const uploadDate = file.get('uploadDate');
    const uploader = file.get('uploader');

    return {
      id: file._id.toString(),
      originalName,
      mimeType,
      size,
      formattedSize,
      path,
      uploadDate,
      uploader: (uploader as any)?.username || null,
      category
    };
  } catch (error) {
    logger.error('Dosya bilgileri getirme hatası', {
      error: (error as Error).message,
      fileId
    });
    throw error;
  }
}

/**
 * Resim önizlemesi için meta verileri getirir
 * @param fileId - Dosya ID'si
 * @returns Resim meta verileri
 */
export async function getImagePreviewMetadata(fileId: string): Promise<ImagePreviewMetadata> {
  try {
    const fileInfo = await getFileInfo(fileId);

    if (fileInfo.category !== 'image') {
      throw new ValidationError('Bu dosya bir resim değil.');
    }

    logger.debug('Resim önizleme meta verileri getirildi', { fileId });

    return {
      ...fileInfo,
      previewUrl: fileInfo.path,
      isAnimated: fileInfo.mimeType === 'image/gif' || fileInfo.mimeType === 'image/webp'
    };
  } catch (error) {
    logger.error('Resim önizleme meta verileri getirme hatası', {
      error: (error as Error).message,
      fileId
    });
    throw error;
  }
}

/**
 * Video önizlemesi için meta verileri getirir
 * @param fileId - Dosya ID'si
 * @returns Video meta verileri
 */
export async function getVideoPreviewMetadata(fileId: string): Promise<VideoPreviewMetadata> {
  try {
    const fileInfo = await getFileInfo(fileId);

    if (fileInfo.category !== 'video') {
      throw new ValidationError('Bu dosya bir video değil.');
    }

    logger.debug('Video önizleme meta verileri getirildi', { fileId });

    // Video meta verilerini döndür
    return {
      ...fileInfo,
      previewUrl: fileInfo.path,
      isStreamable: fileInfo.mimeType === 'video/mp4' || fileInfo.mimeType === 'video/webm'
    };
  } catch (error) {
    logger.error('Video önizleme meta verileri getirme hatası', {
      error: (error as Error).message,
      fileId
    });
    throw error;
  }
}

/**
 * Ses dosyası için meta verileri getirir
 * @param fileId - Dosya ID'si
 * @returns Ses meta verileri
 */
export async function getAudioPreviewMetadata(fileId: string): Promise<AudioPreviewMetadata> {
  try {
    const fileInfo = await getFileInfo(fileId);

    if (fileInfo.category !== 'audio') {
      throw new ValidationError('Bu dosya bir ses dosyası değil.');
    }

    logger.debug('Ses önizleme meta verileri getirildi', { fileId });

    // Ses meta verilerini döndür
    return {
      ...fileInfo,
      previewUrl: fileInfo.path,
      isStreamable: fileInfo.mimeType === 'audio/mpeg' || fileInfo.mimeType === 'audio/wav' || fileInfo.mimeType === 'audio/ogg'
    };
  } catch (error) {
    logger.error('Ses önizleme meta verileri getirme hatası', {
      error: (error as Error).message,
      fileId
    });
    throw error;
  }
}

/**
 * Belge türüne göre ikon döndürür
 * @param mimeType - MIME türü
 * @returns Material icon adı
 */
export function getDocumentIcon(mimeType: string): string {
  switch (mimeType) {
    case 'application/pdf':
      return 'picture_as_pdf';
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'description';
    case 'application/vnd.ms-excel':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'table_chart';
    case 'application/vnd.ms-powerpoint':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return 'slideshow';
    case 'text/plain':
      return 'text_snippet';
    default:
      return 'insert_drive_file';
  }
}

/**
 * Dosya önizlemesi için HTML içeriği oluşturur
 * @param fileId - Dosya ID'si
 * @returns Önizleme HTML'i ve dosya bilgileri
 */
export async function generatePreviewHtml(fileId: string): Promise<PreviewHtmlResult> {
  try {
    const fileInfo = await getFileInfo(fileId);
    let previewHtml = '';

    switch (fileInfo.category) {
      case 'image':
        previewHtml = `<div class="image-preview">
          <img src="${fileInfo.path}" alt="${fileInfo.originalName}" class="preview-image">
        </div>`;
        break;

      case 'video':
        previewHtml = `<div class="video-preview">
          <video controls class="preview-video">
            <source src="${fileInfo.path}" type="${fileInfo.mimeType}">
            Tarayıcınız video etiketini desteklemiyor.
          </video>
        </div>`;
        break;

      case 'audio':
        previewHtml = `<div class="audio-preview">
          <audio controls class="preview-audio">
            <source src="${fileInfo.path}" type="${fileInfo.mimeType}">
            Tarayıcınız ses etiketini desteklemiyor.
          </audio>
        </div>`;
        break;

      case 'document':
        if (fileInfo.mimeType === 'application/pdf') {
          previewHtml = `<div class="pdf-preview">
            <iframe src="${fileInfo.path}" class="preview-pdf"></iframe>
          </div>`;
        } else {
          previewHtml = `<div class="document-preview">
            <div class="document-icon">
              <i class="material-icons">${getDocumentIcon(fileInfo.mimeType)}</i>
            </div>
            <div class="document-info">
              <div class="document-name">${fileInfo.originalName}</div>
              <div class="document-size">${fileInfo.formattedSize}</div>
            </div>
          </div>`;
        }
        break;

      default:
        previewHtml = `<div class="file-preview">
          <div class="file-icon">
            <i class="material-icons">insert_drive_file</i>
          </div>
          <div class="file-info">
            <div class="file-name">${fileInfo.originalName}</div>
            <div class="file-size">${fileInfo.formattedSize}</div>
          </div>
        </div>`;
    }

    logger.debug('Önizleme HTML\'i oluşturuldu', { fileId, category: fileInfo.category });

    return {
      previewHtml,
      fileInfo
    };
  } catch (error) {
    logger.error('Önizleme HTML\'i oluşturma hatası', {
      error: (error as Error).message,
      fileId
    });
    throw error;
  }
}

export default {
  getFileInfo,
  getImagePreviewMetadata,
  getVideoPreviewMetadata,
  getAudioPreviewMetadata,
  generatePreviewHtml,
  categorizeFileType,
  getDocumentIcon
};
