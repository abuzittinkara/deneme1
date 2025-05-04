/**
 * public/src/ts/fileUpload.ts
 * File upload module for handling file uploads in text channels and DMs
 */

// Socket.io socket interface
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// File attachment interface
interface FileAttachment {
  fileId: string;
  filePath: string;
  fileName: string;
}

// Upload response interface
interface UploadResponse {
  success: boolean;
  fileId?: string;
  filePath?: string;
  fileName?: string;
  message?: string;
}

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
  'video/webm',
];

/**
 * Initialize file upload functionality
 * @param socket - Socket.io socket
 */
export function initFileUpload(socket: Socket): void {
  // Add file upload button to text channel input
  const textChannelInput = document.querySelector('.text-channel-input');
  if (textChannelInput) {
    const fileUploadButton = document.createElement('button');
    fileUploadButton.className = 'file-upload-button';
    fileUploadButton.innerHTML = '<span class="material-icons">attach_file</span>';
    fileUploadButton.title = 'Dosya Ekle';
    textChannelInput.appendChild(fileUploadButton);

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileInput.multiple = false;
    textChannelInput.appendChild(fileInput);

    // Add click event to file upload button
    fileUploadButton.addEventListener('click', () => {
      fileInput.click();
    });

    // Add change event to file input
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          alert(`Dosya boyutu çok büyük. Maksimum dosya boyutu: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
          fileInput.value = '';
          return;
        }

        // Check file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          alert('Bu dosya türü desteklenmiyor.');
          fileInput.value = '';
          return;
        }

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = function (e) {
          const fileData = e.target?.result as string;

          // Check if we're in a channel or DM
          const channelId = document
            .querySelector('#textMessages')
            ?.getAttribute('data-channel-id');
          const dmUsername = document.querySelector('#dmMessages')?.getAttribute('data-friend');

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

  // Add file upload button to DM input
  const dmInput = document.querySelector('.dm-input');
  if (dmInput) {
    const fileUploadButton = document.createElement('button');
    fileUploadButton.className = 'file-upload-button';
    fileUploadButton.innerHTML = '<span class="material-icons">attach_file</span>';
    fileUploadButton.title = 'Dosya Ekle';
    dmInput.appendChild(fileUploadButton);

    // Create hidden file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.style.display = 'none';
    fileInput.multiple = false;
    dmInput.appendChild(fileInput);

    // Add click event to file upload button
    fileUploadButton.addEventListener('click', () => {
      fileInput.click();
    });

    // Add change event to file input
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
          alert(`Dosya boyutu çok büyük. Maksimum dosya boyutu: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
          fileInput.value = '';
          return;
        }

        // Check file type
        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
          alert('Bu dosya türü desteklenmiyor.');
          fileInput.value = '';
          return;
        }

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = function (e) {
          const fileData = e.target?.result as string;

          // Check if we're in a channel or DM
          const channelId = document
            .querySelector('#textMessages')
            ?.getAttribute('data-channel-id');
          const dmUsername = document.querySelector('#dmMessages')?.getAttribute('data-friend');

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
}

/**
 * Upload a file to a channel
 * @param socket - Socket.io socket
 * @param fileData - Base64 encoded file data
 * @param fileName - Original file name
 * @param fileType - MIME type of the file
 * @param channelId - Channel ID
 */
function uploadFileToChannel(
  socket: Socket,
  fileData: string,
  fileName: string,
  fileType: string,
  channelId: string
): void {
  // Show loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'file-upload-loading';
  loadingIndicator.textContent = `Yükleniyor: ${fileName}...`;
  const textMessages = document.querySelector('#textMessages');
  if (textMessages) {
    textMessages.appendChild(loadingIndicator);
  }

  // Upload file
  socket.emit(
    'uploadFile',
    {
      fileData,
      fileName,
      fileType,
      channelId,
    },
    (response: UploadResponse) => {
      // Remove loading indicator
      loadingIndicator.remove();

      if (response.success) {
        // Send message with file attachment
        const messageInput = document.querySelector('#textChannelMessageInput') as HTMLInputElement;
        const message = messageInput?.value || '';
        const currentGroup = (window as any).currentGroup;
        const username = (window as any).username;

        socket.emit('textMessage', {
          groupId: currentGroup,
          roomId: channelId,
          message: message,
          username: username,
          fileAttachment: {
            fileId: response.fileId,
            filePath: response.filePath,
            fileName: response.fileName,
          },
        });

        // Clear input
        if (messageInput) {
          messageInput.value = '';
        }
      } else {
        alert('Dosya yüklenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Upload a file to a DM
 * @param socket - Socket.io socket
 * @param fileData - Base64 encoded file data
 * @param fileName - Original file name
 * @param fileType - MIME type of the file
 * @param dmUsername - DM username
 */
function uploadFileToDM(
  socket: Socket,
  fileData: string,
  fileName: string,
  fileType: string,
  dmUsername: string
): void {
  // Show loading indicator
  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'file-upload-loading';
  loadingIndicator.textContent = `Yükleniyor: ${fileName}...`;
  const dmMessages = document.querySelector('#dmMessages');
  if (dmMessages) {
    dmMessages.appendChild(loadingIndicator);
  }

  // Upload file
  socket.emit(
    'uploadFile',
    {
      fileData,
      fileName,
      fileType,
      dmUsername,
    },
    (response: UploadResponse) => {
      // Remove loading indicator
      loadingIndicator.remove();

      if (response.success) {
        // Send message with file attachment
        const messageInput = document.querySelector('#dmMessageInput') as HTMLInputElement;
        const message = messageInput?.value || '';
        const username = (window as any).username;

        socket.emit('directMessage', {
          to: dmUsername,
          message: message,
          username: username,
          fileAttachment: {
            fileId: response.fileId,
            filePath: response.filePath,
            fileName: response.fileName,
          },
        });

        // Clear input
        if (messageInput) {
          messageInput.value = '';
        }
      } else {
        alert('Dosya yüklenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Get file attachment HTML
 * @param filePath - File path
 * @param fileName - File name
 * @param fileType - File type
 * @returns File attachment HTML
 */
export function getFileAttachmentHTML(
  filePath: string,
  fileName: string,
  fileType: string
): string {
  // Get file extension
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

  // Get icon class based on file type or extension
  let iconClass = 'insert_drive_file';

  if (fileType.startsWith('image/')) {
    iconClass = 'image';
  } else if (fileType.startsWith('video/')) {
    iconClass = 'videocam';
  } else if (fileType.startsWith('audio/')) {
    iconClass = 'audiotrack';
  } else if (fileType === 'application/pdf') {
    iconClass = 'picture_as_pdf';
  } else if (
    fileType.includes('spreadsheet') ||
    fileExtension === 'xlsx' ||
    fileExtension === 'xls'
  ) {
    iconClass = 'table_chart';
  } else if (
    fileType.includes('presentation') ||
    fileExtension === 'pptx' ||
    fileExtension === 'ppt'
  ) {
    iconClass = 'slideshow';
  } else if (fileType.includes('document') || fileExtension === 'docx' || fileExtension === 'doc') {
    iconClass = 'description';
  } else if (fileType.includes('zip') || fileExtension === 'zip' || fileExtension === 'rar') {
    iconClass = 'archive';
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
