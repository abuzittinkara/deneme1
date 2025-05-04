/**
 * public/src/ts/mediaPlayer.ts
 * Media player module for handling media files
 */

// File interface
interface File {
  path: string;
  originalName: string;
  mimeType: string;
  size: number;
}

/**
 * Initialize media player functionality
 */
export function initMediaPlayer(): void {
  // Add event delegation for media previews
  document.addEventListener('click', e => {
    const target = e.target as HTMLElement;

    // Image preview
    if (target.closest('.image-preview')) {
      const preview = target.closest('.image-preview') as HTMLElement;
      const path = preview.getAttribute('data-path');
      if (path) {
        showImageModal(path);
      }
    }

    // Video preview
    if (target.closest('.video-preview')) {
      const preview = target.closest('.video-preview') as HTMLElement;
      const path = preview.getAttribute('data-path');
      if (path) {
        showVideoModal(path);
      }
    }

    // Audio preview
    if (target.closest('.audio-preview')) {
      const preview = target.closest('.audio-preview') as HTMLElement;
      const path = preview.getAttribute('data-path');
      if (path) {
        toggleAudioPlayback(preview);
      }
    }

    // Close modal
    if (target.classList.contains('close-media-modal') || target.closest('.close-media-modal')) {
      closeMediaModal();
    }
  });
}

/**
 * Show image modal
 * @param imagePath - Image path
 */
function showImageModal(imagePath: string): void {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'media-modal';
  modal.innerHTML = `
    <div class="media-modal-content">
      <img src="${imagePath}" alt="Image Preview" class="media-modal-image">
      <button class="close-media-modal">
        <span class="material-icons">close</span>
      </button>
    </div>
  `;

  // Add modal to body
  document.body.appendChild(modal);

  // Add event listener for escape key
  document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Show video modal
 * @param videoPath - Video path
 */
function showVideoModal(videoPath: string): void {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'media-modal';
  modal.innerHTML = `
    <div class="media-modal-content">
      <video src="${videoPath}" controls autoplay class="media-modal-video"></video>
      <button class="close-media-modal">
        <span class="material-icons">close</span>
      </button>
    </div>
  `;

  // Add modal to body
  document.body.appendChild(modal);

  // Add event listener for escape key
  document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Toggle audio playback
 * @param audioPreview - Audio preview element
 */
function toggleAudioPlayback(audioPreview: HTMLElement): void {
  const audio = audioPreview.querySelector('audio') as HTMLAudioElement;
  const playButton = audioPreview.querySelector('.audio-play-button') as HTMLElement;
  const pauseButton = audioPreview.querySelector('.audio-pause-button') as HTMLElement;

  if (audio) {
    if (audio.paused) {
      // Pause all other audio elements
      document.querySelectorAll('audio').forEach(a => {
        if (a !== audio) {
          a.pause();

          // Update play/pause buttons
          const preview = a.closest('.audio-preview');
          if (preview) {
            const play = preview.querySelector('.audio-play-button');
            const pause = preview.querySelector('.audio-pause-button');

            if (play) {
              play.classList.remove('hidden');
            }
            if (pause) {
              pause.classList.add('hidden');
            }
          }
        }
      });

      // Play this audio
      audio.play();

      // Update play/pause buttons
      if (playButton) {
        playButton.classList.add('hidden');
      }
      if (pauseButton) {
        pauseButton.classList.remove('hidden');
      }
    } else {
      // Pause this audio
      audio.pause();

      // Update play/pause buttons
      if (playButton) {
        playButton.classList.remove('hidden');
      }
      if (pauseButton) {
        pauseButton.classList.add('hidden');
      }
    }
  }
}

/**
 * Close media modal
 */
function closeMediaModal(): void {
  // Remove modal
  const modal = document.querySelector('.media-modal');
  if (modal) {
    modal.remove();
  }

  // Remove event listener for escape key
  document.removeEventListener('keydown', handleEscapeKey);
}

/**
 * Handle escape key press
 * @param e - Keyboard event
 */
function handleEscapeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    closeMediaModal();
  }
}

/**
 * Format file size
 * @param bytes - File size in bytes
 * @returns Formatted file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return '0 Bytes';
  }

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get document icon based on MIME type
 * @param mimeType - MIME type
 * @returns Material icon name
 */
export function getDocumentIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) {
    return 'picture_as_pdf';
  } else if (mimeType.includes('word') || mimeType.includes('document')) {
    return 'description';
  } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return 'table_chart';
  } else if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) {
    return 'slideshow';
  } else if (mimeType.includes('text/plain')) {
    return 'text_snippet';
  } else {
    return 'insert_drive_file';
  }
}

/**
 * Get file preview HTML
 * @param file - File object
 * @returns File preview HTML
 */
export function getFilePreviewHTML(file: File): string {
  // Check file type
  if (file.mimeType.startsWith('image/')) {
    return `
      <div class="image-preview" data-path="${file.path}">
        <img src="${file.path}" alt="${file.originalName}">
        <div class="image-info">
          <div class="image-name">${file.originalName}</div>
          <div class="image-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
    `;
  } else if (file.mimeType.startsWith('video/')) {
    return `
      <div class="video-preview" data-path="${file.path}">
        <div class="video-thumbnail">
          <span class="material-icons video-play-icon">play_circle_filled</span>
        </div>
        <div class="video-info">
          <div class="video-name">${file.originalName}</div>
          <div class="video-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
    `;
  } else if (file.mimeType.startsWith('audio/')) {
    return `
      <div class="audio-preview" data-path="${file.path}">
        <div class="audio-controls">
          <span class="material-icons audio-play-button">play_circle_filled</span>
          <span class="material-icons audio-pause-button hidden">pause_circle_filled</span>
          <audio src="${file.path}" preload="metadata"></audio>
        </div>
        <div class="audio-info">
          <div class="audio-name">${file.originalName}</div>
          <div class="audio-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
    `;
  } else if (file.mimeType === 'application/pdf') {
    return `
      <div class="document-preview" data-path="${file.path}">
        <div class="document-icon">
          <span class="material-icons">picture_as_pdf</span>
        </div>
        <div class="document-info">
          <div class="document-name">${file.originalName}</div>
          <div class="document-size">${formatFileSize(file.size)}</div>
        </div>
      </div>
    `;
  } else {
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
