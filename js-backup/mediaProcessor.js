// modules/mediaProcessor.js
const FileAttachment = require('../models/FileAttachment');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');
const statAsync = promisify(fs.stat);

/**
 * Dosya türünü kategorize eder
 * @param {string} mimeType - MIME türü
 * @returns {string} - Dosya kategorisi (image, video, audio, document, other)
 */
function categorizeFileType(mimeType) {
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
 * @param {string} fileId - Dosya ID'si
 * @returns {Promise<Object>} - Dosya bilgileri
 */
async function getFileInfo(fileId) {
  const file = await FileAttachment.findById(fileId)
    .populate('uploader', 'username');
  
  if (!file) {
    throw new Error('Dosya bulunamadı.');
  }
  
  // Dosya boyutunu formatla
  let formattedSize;
  if (file.size < 1024) {
    formattedSize = `${file.size} B`;
  } else if (file.size < 1024 * 1024) {
    formattedSize = `${(file.size / 1024).toFixed(2)} KB`;
  } else if (file.size < 1024 * 1024 * 1024) {
    formattedSize = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    formattedSize = `${(file.size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  
  // Dosya türünü kategorize et
  const category = categorizeFileType(file.mimeType);
  
  return {
    id: file._id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    formattedSize,
    path: file.path,
    uploadDate: file.uploadDate,
    uploader: file.uploader ? file.uploader.username : null,
    category
  };
}

/**
 * Resim önizlemesi için meta verileri getirir
 * @param {string} fileId - Dosya ID'si
 * @returns {Promise<Object>} - Resim meta verileri
 */
async function getImagePreviewMetadata(fileId) {
  const fileInfo = await getFileInfo(fileId);
  
  if (fileInfo.category !== 'image') {
    throw new Error('Bu dosya bir resim değil.');
  }
  
  return {
    ...fileInfo,
    previewUrl: fileInfo.path,
    isAnimated: fileInfo.mimeType === 'image/gif' || fileInfo.mimeType === 'image/webp'
  };
}

/**
 * Video önizlemesi için meta verileri getirir
 * @param {string} fileId - Dosya ID'si
 * @returns {Promise<Object>} - Video meta verileri
 */
async function getVideoPreviewMetadata(fileId) {
  const fileInfo = await getFileInfo(fileId);
  
  if (fileInfo.category !== 'video') {
    throw new Error('Bu dosya bir video değil.');
  }
  
  // Video meta verilerini döndür
  return {
    ...fileInfo,
    previewUrl: fileInfo.path,
    isStreamable: fileInfo.mimeType === 'video/mp4' || fileInfo.mimeType === 'video/webm'
  };
}

/**
 * Ses dosyası için meta verileri getirir
 * @param {string} fileId - Dosya ID'si
 * @returns {Promise<Object>} - Ses meta verileri
 */
async function getAudioPreviewMetadata(fileId) {
  const fileInfo = await getFileInfo(fileId);
  
  if (fileInfo.category !== 'audio') {
    throw new Error('Bu dosya bir ses dosyası değil.');
  }
  
  // Ses meta verilerini döndür
  return {
    ...fileInfo,
    previewUrl: fileInfo.path,
    isStreamable: fileInfo.mimeType === 'audio/mpeg' || fileInfo.mimeType === 'audio/wav' || fileInfo.mimeType === 'audio/ogg'
  };
}

/**
 * Dosya önizlemesi için HTML içeriği oluşturur
 * @param {string} fileId - Dosya ID'si
 * @returns {Promise<Object>} - Önizleme HTML'i ve dosya bilgileri
 */
async function generatePreviewHtml(fileId) {
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
  
  return {
    previewHtml,
    fileInfo
  };
}

/**
 * Belge türüne göre ikon döndürür
 * @param {string} mimeType - MIME türü
 * @returns {string} - Material icon adı
 */
function getDocumentIcon(mimeType) {
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

module.exports = {
  getFileInfo,
  getImagePreviewMetadata,
  getVideoPreviewMetadata,
  getAudioPreviewMetadata,
  generatePreviewHtml,
  categorizeFileType
};
