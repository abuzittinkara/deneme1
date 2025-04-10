// public/js/fileUpload.js

/**
 * File upload module for handling file uploads in text channels and DMs
 */

// Maximum file size in bytes (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'audio/mpeg',
  'audio/wav',
  'video/mp4',
  'video/webm'
];

/**
 * Initialize file upload functionality
 * @param {Object} socket - Socket.io socket
 */
export function initFileUpload(socket) {
  // Add file upload button click handler
  document.addEventListener('click', function(e) {
    if (e.target && e.target.classList.contains('file-upload-btn')) {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = ALLOWED_FILE_TYPES.join(',');
      fileInput.click();
      
      fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          
          // Check file size
          if (file.size > MAX_FILE_SIZE) {
            alert('Dosya boyutu çok büyük. Maksimum 5MB yükleyebilirsiniz.');
            return;
          }
          
          // Check file type
          if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            alert('Bu dosya türü desteklenmiyor.');
            return;
          }
          
          // Read file as data URL
          const reader = new FileReader();
          reader.onload = function(e) {
            const fileData = e.target.result;
            
            // Check if we're in a channel or DM
            const channelId = document.querySelector('#textMessages')?.dataset?.channelId;
            const dmUsername = document.querySelector('#dmMessages')?.dataset?.friend;
            
            if (channelId) {
              // Upload to channel
              uploadFileToChannel(socket, fileData, file.name, file.type, channelId);
            } else if (dmUsername) {
              // Upload to DM
              uploadFileToDM(socket, fileData, file.name, file.type, dmUsername);
            }
          };
          reader.readAsDataURL(file);
        }
      });
    }
  });
}

/**
 * Upload a file to a channel
 * @param {Object} socket - Socket.io socket
 * @param {string} fileData - Base64 encoded file data
 * @param {string} fileName - Original file name
 * @param {string} fileType - MIME type of the file
 * @param {string} channelId - Channel ID
 */
function uploadFileToChannel(socket, fileData, fileName, fileType, channelId) {
  // Show loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'file-upload-loading';
  loadingIndicator.textContent = `Yükleniyor: ${fileName}...`;
  document.querySelector('#textMessages').appendChild(loadingIndicator);
  
  // Upload file
  socket.emit('uploadFile', {
    fileData,
    fileName,
    fileType,
    channelId
  }, (response) => {
    // Remove loading indicator
    loadingIndicator.remove();
    
    if (response.success) {
      // Send message with file attachment
      const messageInput = document.querySelector('#textChannelMessageInput');
      const message = messageInput.value || '';
      
      socket.emit('textMessage', {
        groupId: currentGroup,
        roomId: channelId,
        message: message,
        username: window.username,
        fileAttachment: {
          fileId: response.fileId,
          filePath: response.filePath,
          fileName: response.fileName
        }
      });
      
      // Clear input
      messageInput.value = '';
    } else {
      alert('Dosya yüklenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Upload a file to a DM conversation
 * @param {Object} socket - Socket.io socket
 * @param {string} fileData - Base64 encoded file data
 * @param {string} fileName - Original file name
 * @param {string} fileType - MIME type of the file
 * @param {string} friendUsername - Friend's username
 */
function uploadFileToDM(socket, fileData, fileName, fileType, friendUsername) {
  // Show loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'file-upload-loading';
  loadingIndicator.textContent = `Yükleniyor: ${fileName}...`;
  document.querySelector('#dmMessages').appendChild(loadingIndicator);
  
  // Upload file
  socket.emit('uploadDMFile', {
    fileData,
    fileName,
    fileType,
    friendUsername
  }, (response) => {
    // Remove loading indicator
    loadingIndicator.remove();
    
    if (response.success) {
      // Send message with file attachment
      const messageInput = document.querySelector('#dmMessageInput');
      const message = messageInput.value || '';
      
      socket.emit('dmMessage', {
        friend: friendUsername,
        message: message,
        fileAttachment: {
          fileId: response.fileId,
          filePath: response.filePath,
          fileName: response.fileName
        }
      }, (dmResponse) => {
        if (!dmResponse.success) {
          alert('Mesaj gönderilirken bir hata oluştu: ' + (dmResponse.message || 'Bilinmeyen hata'));
        }
      });
      
      // Clear input
      messageInput.value = '';
    } else {
      alert('Dosya yüklenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Render a file attachment in a message
 * @param {Object} fileAttachment - File attachment data
 * @returns {string} HTML for the file attachment
 */
export function renderFileAttachment(fileAttachment) {
  const { filePath, fileName } = fileAttachment;
  const fileExtension = fileName.split('.').pop().toLowerCase();
  
  // Check if it's an image
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
  
  if (isImage) {
    return `
      <div class="file-attachment image-attachment">
        <a href="${filePath}" target="_blank">
          <img src="${filePath}" alt="${fileName}" class="attachment-preview">
        </a>
        <div class="file-name">${fileName}</div>
      </div>
    `;
  } else {
    // Get icon based on file extension
    let iconClass = 'description'; // Default icon
    
    if (['pdf'].includes(fileExtension)) {
      iconClass = 'picture_as_pdf';
    } else if (['doc', 'docx'].includes(fileExtension)) {
      iconClass = 'article';
    } else if (['xls', 'xlsx'].includes(fileExtension)) {
      iconClass = 'table_chart';
    } else if (['ppt', 'pptx'].includes(fileExtension)) {
      iconClass = 'slideshow';
    } else if (['zip', 'rar'].includes(fileExtension)) {
      iconClass = 'folder_zip';
    } else if (['mp3', 'wav', 'ogg'].includes(fileExtension)) {
      iconClass = 'audio_file';
    } else if (['mp4', 'webm', 'avi'].includes(fileExtension)) {
      iconClass = 'video_file';
    }
    
    return `
      <div class="file-attachment">
        <a href="${filePath}" target="_blank" class="file-link">
          <span class="material-icons file-icon">${iconClass}</span>
          <span class="file-name">${fileName}</span>
        </a>
      </div>
    `;
  }
}
