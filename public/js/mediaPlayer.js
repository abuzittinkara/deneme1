// public/js/mediaPlayer.js

/**
 * Medya oynatıcı modülü
 * Resim, video ve ses dosyalarını görüntülemek için kullanılır
 */

/**
 * Medya oynatıcıyı başlatır
 */
export function initMediaPlayer() {
  // Medya önizlemelerine tıklama olayı ekle
  document.addEventListener('click', (e) => {
    // Resim önizlemesi
    if (e.target.closest('.image-preview')) {
      const img = e.target.closest('.image-preview').querySelector('img');
      if (img) {
        openMediaModal('image', img.src, img.alt);
      }
    }
    
    // Video önizlemesi
    if (e.target.closest('.video-preview') && !e.target.closest('video')) {
      const video = e.target.closest('.video-preview').querySelector('video');
      if (video) {
        openMediaModal('video', video.querySelector('source').src, video.querySelector('source').type);
      }
    }
    
    // Ses önizlemesi
    if (e.target.closest('.audio-preview') && !e.target.closest('audio')) {
      const audio = e.target.closest('.audio-preview').querySelector('audio');
      if (audio) {
        openMediaModal('audio', audio.querySelector('source').src, audio.querySelector('source').type);
      }
    }
    
    // PDF önizlemesi
    if (e.target.closest('.pdf-preview') && !e.target.closest('iframe')) {
      const iframe = e.target.closest('.pdf-preview').querySelector('iframe');
      if (iframe) {
        window.open(iframe.src, '_blank');
      }
    }
    
    // Belge önizlemesi
    if (e.target.closest('.document-preview') || e.target.closest('.file-preview')) {
      const preview = e.target.closest('.document-preview') || e.target.closest('.file-preview');
      const fileName = preview.querySelector('.document-name, .file-name').textContent;
      const filePath = preview.dataset.path;
      
      if (filePath) {
        window.open(filePath, '_blank');
      }
    }
  });
}

/**
 * Medya modalını açar
 * @param {string} type - Medya türü (image, video, audio)
 * @param {string} src - Medya kaynağı
 * @param {string} info - Ek bilgi (dosya adı, MIME türü)
 */
function openMediaModal(type, src, info) {
  // Varsa önceki modalı kaldır
  const existingModal = document.querySelector('.media-modal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Yeni modal oluştur
  const modal = document.createElement('div');
  modal.className = 'media-modal';
  
  let content = '';
  
  switch (type) {
    case 'image':
      content = `
        <div class="media-modal-content">
          <button class="media-modal-close">&times;</button>
          <img src="${src}" alt="${info || ''}">
          ${info ? `<div class="media-modal-info">${info}</div>` : ''}
        </div>
      `;
      break;
    
    case 'video':
      content = `
        <div class="media-modal-content">
          <button class="media-modal-close">&times;</button>
          <video controls autoplay>
            <source src="${src}" type="${info || 'video/mp4'}">
            Tarayıcınız video etiketini desteklemiyor.
          </video>
          <div class="media-controls">
            <button class="media-control-button play-pause">
              <span class="material-icons">pause</span>
            </button>
            <div class="media-time current-time">0:00</div>
            <div class="media-progress">
              <div class="media-progress-bar"></div>
            </div>
            <div class="media-time duration">0:00</div>
            <button class="media-control-button mute">
              <span class="material-icons">volume_up</span>
            </button>
            <button class="media-control-button fullscreen">
              <span class="material-icons">fullscreen</span>
            </button>
          </div>
        </div>
      `;
      break;
    
    case 'audio':
      content = `
        <div class="media-modal-content">
          <button class="media-modal-close">&times;</button>
          <div class="audio-player">
            <audio controls autoplay>
              <source src="${src}" type="${info || 'audio/mpeg'}">
              Tarayıcınız ses etiketini desteklemiyor.
            </audio>
          </div>
          <div class="media-controls">
            <button class="media-control-button play-pause">
              <span class="material-icons">pause</span>
            </button>
            <div class="media-time current-time">0:00</div>
            <div class="media-progress">
              <div class="media-progress-bar"></div>
            </div>
            <div class="media-time duration">0:00</div>
            <button class="media-control-button mute">
              <span class="material-icons">volume_up</span>
            </button>
          </div>
        </div>
      `;
      break;
  }
  
  modal.innerHTML = content;
  document.body.appendChild(modal);
  
  // Kapatma düğmesi olayı
  const closeButton = modal.querySelector('.media-modal-close');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      modal.remove();
    });
  }
  
  // ESC tuşu ile kapatma
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modal.remove();
    }
  });
  
  // Modal dışına tıklama ile kapatma
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Video ve ses kontrolleri
  if (type === 'video' || type === 'audio') {
    const mediaElement = modal.querySelector('video, audio');
    const playPauseButton = modal.querySelector('.play-pause');
    const muteButton = modal.querySelector('.mute');
    const fullscreenButton = modal.querySelector('.fullscreen');
    const progressBar = modal.querySelector('.media-progress-bar');
    const progressContainer = modal.querySelector('.media-progress');
    const currentTimeDisplay = modal.querySelector('.current-time');
    const durationDisplay = modal.querySelector('.duration');
    
    // Oynatma/duraklatma düğmesi
    if (playPauseButton) {
      playPauseButton.addEventListener('click', () => {
        if (mediaElement.paused) {
          mediaElement.play();
          playPauseButton.querySelector('.material-icons').textContent = 'pause';
        } else {
          mediaElement.pause();
          playPauseButton.querySelector('.material-icons').textContent = 'play_arrow';
        }
      });
    }
    
    // Ses açma/kapatma düğmesi
    if (muteButton) {
      muteButton.addEventListener('click', () => {
        mediaElement.muted = !mediaElement.muted;
        muteButton.querySelector('.material-icons').textContent = mediaElement.muted ? 'volume_off' : 'volume_up';
      });
    }
    
    // Tam ekran düğmesi (sadece video için)
    if (fullscreenButton && type === 'video') {
      fullscreenButton.addEventListener('click', () => {
        if (mediaElement.requestFullscreen) {
          mediaElement.requestFullscreen();
        } else if (mediaElement.webkitRequestFullscreen) {
          mediaElement.webkitRequestFullscreen();
        } else if (mediaElement.msRequestFullscreen) {
          mediaElement.msRequestFullscreen();
        }
      });
    }
    
    // İlerleme çubuğu
    if (progressContainer) {
      progressContainer.addEventListener('click', (e) => {
        const rect = progressContainer.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        mediaElement.currentTime = pos * mediaElement.duration;
      });
    }
    
    // Zaman güncellemesi
    mediaElement.addEventListener('timeupdate', () => {
      if (progressBar) {
        const percent = (mediaElement.currentTime / mediaElement.duration) * 100;
        progressBar.style.width = `${percent}%`;
      }
      
      if (currentTimeDisplay) {
        currentTimeDisplay.textContent = formatTime(mediaElement.currentTime);
      }
    });
    
    // Süre bilgisi
    mediaElement.addEventListener('loadedmetadata', () => {
      if (durationDisplay) {
        durationDisplay.textContent = formatTime(mediaElement.duration);
      }
    });
    
    // Oynatma durumu değişikliği
    mediaElement.addEventListener('play', () => {
      if (playPauseButton) {
        playPauseButton.querySelector('.material-icons').textContent = 'pause';
      }
    });
    
    mediaElement.addEventListener('pause', () => {
      if (playPauseButton) {
        playPauseButton.querySelector('.material-icons').textContent = 'play_arrow';
      }
    });
  }
}

/**
 * Saniye cinsinden zamanı biçimlendirir
 * @param {number} seconds - Saniye cinsinden zaman
 * @returns {string} - Biçimlendirilmiş zaman (mm:ss)
 */
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Dosya önizlemesi oluşturur
 * @param {Object} file - Dosya bilgileri
 * @returns {string} - Önizleme HTML'i
 */
export function createFilePreview(file) {
  const fileType = getFileType(file.mimeType);
  
  switch (fileType) {
    case 'image':
      return `
        <div class="image-preview">
          <img src="${file.path}" alt="${file.originalName}" class="preview-image">
        </div>
      `;
    
    case 'video':
      return `
        <div class="video-preview">
          <video controls class="preview-video">
            <source src="${file.path}" type="${file.mimeType}">
            Tarayıcınız video etiketini desteklemiyor.
          </video>
        </div>
      `;
    
    case 'audio':
      return `
        <div class="audio-preview">
          <audio controls class="preview-audio">
            <source src="${file.path}" type="${file.mimeType}">
            Tarayıcınız ses etiketini desteklemiyor.
          </audio>
        </div>
      `;
    
    case 'pdf':
      return `
        <div class="pdf-preview">
          <iframe src="${file.path}" class="preview-pdf"></iframe>
        </div>
      `;
    
    case 'document':
      return `
        <div class="document-preview" data-path="${file.path}">
          <div class="document-icon">
            <span class="material-icons">${getDocumentIcon(file.mimeType)}</span>
          </div>
          <div class="document-info">
            <div class="document-name">${file.originalName}</div>
            <div class="document-size">${formatFileSize(file.size)}</div>
          </div>
        </div>
      `;
    
    default:
      return `
        <div class="file-preview" data-path="${file.path}">
          <div class="file-icon">
            <span class="material-icons">insert_drive_file</span>
          </div>
          <div class="file-info">
            <div class="file-name">${file.originalName}</div>
            <div class="file-size">${formatFileSize(file.size)}</div>
          </div>
        </div>
      `;
  }
}

/**
 * Dosya türünü belirler
 * @param {string} mimeType - MIME türü
 * @returns {string} - Dosya türü (image, video, audio, pdf, document, other)
 */
function getFileType(mimeType) {
  if (mimeType.startsWith('image/')) {
    return 'image';
  } else if (mimeType.startsWith('video/')) {
    return 'video';
  } else if (mimeType.startsWith('audio/')) {
    return 'audio';
  } else if (mimeType === 'application/pdf') {
    return 'pdf';
  } else if (
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

/**
 * Dosya boyutunu biçimlendirir
 * @param {number} bytes - Bayt cinsinden boyut
 * @returns {string} - Biçimlendirilmiş boyut
 */
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
