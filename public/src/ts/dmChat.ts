/**
 * public/src/ts/dmChat.ts
 * Direkt mesajlaşma modülü
 * İki kullanıcı arasında özel mesajlaşma işlevlerini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Mesaj verisi arayüzü
interface MessageData {
  _id: string;
  sender: string;
  recipient: string;
  content: string;
  timestamp: string;
  isEdited?: boolean;
  isDeleted?: boolean;
  fileAttachment?: {
    fileId: string;
    filePath: string;
    fileName: string;
  };
}

// Mesaj yanıtı arayüzü
interface MessageResponse {
  success: boolean;
  messages?: MessageData[];
  message?: string;
}

// Mesaj gönderme yanıtı arayüzü
interface SendMessageResponse {
  success: boolean;
  messageId?: string;
  message?: string;
}

// Aktif DM sohbeti
let activeDMUser: string | null = null;

// Mesaj geçmişi
let messageHistory: MessageData[] = [];

// Sayfalama değişkenleri
let currentPage = 1;
const messagesPerPage = 50;
let hasMoreMessages = true;

/**
 * DM sohbetini başlatır
 * @param socket - Socket.io socket
 * @param username - Sohbet edilecek kullanıcı adı
 */
export function initDMChat(socket: Socket, username: string): void {
  // Aktif kullanıcıyı ayarla
  activeDMUser = username;

  // Mesaj geçmişini temizle
  messageHistory = [];
  currentPage = 1;
  hasMoreMessages = true;

  // DM içerik alanını oluştur
  createDMContentArea();

  // Mesaj geçmişini yükle
  loadDMHistory(socket, username);

  // Mesaj gönderme olayı
  const sendButton = document.getElementById('dmSendButton');
  if (sendButton) {
    sendButton.addEventListener('click', () => {
      sendDMMessage(socket, username);
    });
  }

  // Enter tuşu ile mesaj gönderme
  const messageInput = document.getElementById('dmMessageInput') as HTMLInputElement;
  if (messageInput) {
    messageInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendDMMessage(socket, username);
      }
    });
  }

  // Mesaj alanı kaydırma olayı (daha fazla mesaj yükleme)
  const messagesContainer = document.getElementById('dmMessages');
  if (messagesContainer) {
    messagesContainer.addEventListener('scroll', () => {
      if (messagesContainer.scrollTop === 0 && hasMoreMessages) {
        loadMoreMessages(socket, username);
      }
    });
  }

  // Yeni mesaj olayını dinle
  socket.on('newDM', (data: MessageData) => {
    if (
      (data.sender === username && data.recipient === (window as any).username) ||
      (data.sender === (window as any).username && data.recipient === username)
    ) {
      addMessageToChat(data);
      scrollToBottom();
    }
  });

  // Mesaj düzenleme olayını dinle
  socket.on('dmUpdated', (data: { messageId: string; content: string }) => {
    updateMessage(data.messageId, data.content);
  });

  // Mesaj silme olayını dinle
  socket.on('dmDeleted', (data: { messageId: string }) => {
    markMessageAsDeleted(data.messageId);
  });

  // DM sohbeti başlatıldı olayını tetikle
  document.dispatchEvent(
    new CustomEvent('dmChatInitialized', {
      detail: { username },
    })
  );
}

/**
 * DM içerik alanını oluşturur
 */
function createDMContentArea(): void {
  // DM içerik alanını al
  const dmContentArea = document.getElementById('dmContentArea');
  if (!dmContentArea) {
    return;
  }

  // DM içerik alanını temizle
  dmContentArea.innerHTML = '';

  // DM mesajları konteyneri
  const dmMessagesContainer = document.createElement('div');
  dmMessagesContainer.id = 'dmMessages';
  dmMessagesContainer.className = 'dm-messages';
  dmMessagesContainer.setAttribute('data-friend', activeDMUser || '');

  // DM giriş alanı
  const dmInputContainer = document.createElement('div');
  dmInputContainer.className = 'dm-input-container';
  dmInputContainer.innerHTML = `
    <div class="dm-input">
      <textarea id="dmMessageInput" placeholder="Bir mesaj yazın..."></textarea>
      <button id="dmSendButton" class="dm-send-button">
        <span class="material-icons">send</span>
      </button>
    </div>
  `;

  // DM içerik alanına ekle
  dmContentArea.appendChild(dmMessagesContainer);
  dmContentArea.appendChild(dmInputContainer);

  // DM içerik alanını göster
  dmContentArea.style.display = 'flex';

  // Seçili DM barını göster
  const selectedDMBar = document.getElementById('selectedDMBar');
  if (selectedDMBar) {
    selectedDMBar.style.display = 'flex';
  }

  // Kanal içerik alanını gizle
  const channelContentArea = document.getElementById('channelContentArea');
  if (channelContentArea) {
    channelContentArea.style.display = 'none';
  }
}

/**
 * DM geçmişini yükler
 * @param socket - Socket.io socket
 * @param username - Sohbet edilecek kullanıcı adı
 */
function loadDMHistory(socket: Socket, username: string): void {
  // Yükleniyor göstergesi
  const dmMessages = document.getElementById('dmMessages');
  if (dmMessages) {
    dmMessages.innerHTML = '<div class="loading-messages">Mesajlar yükleniyor...</div>';
  }

  // Mesaj geçmişini al
  socket.emit(
    'getDMHistory',
    {
      username,
      page: currentPage,
      limit: messagesPerPage,
    },
    (response: MessageResponse) => {
      if (response.success && response.messages) {
        // Mesaj geçmişini temizle
        if (dmMessages) {
          dmMessages.innerHTML = '';
        }

        // Mesajları ekle
        messageHistory = response.messages;

        if (messageHistory.length === 0) {
          if (dmMessages) {
            dmMessages.innerHTML =
              '<div class="no-messages">Henüz mesaj yok. Bir mesaj göndererek sohbete başlayın.</div>';
          }
        } else {
          // Mesajları ekle
          messageHistory.forEach(msg => {
            addMessageToChat(msg, true);
          });

          // Daha fazla mesaj var mı kontrol et
          hasMoreMessages = messageHistory.length >= messagesPerPage;

          // En alta kaydır
          scrollToBottom();
        }
      } else {
        if (dmMessages) {
          dmMessages.innerHTML =
            '<div class="error-messages">Mesajlar yüklenirken bir hata oluştu.</div>';
        }
        console.error('DM geçmişi yükleme hatası:', response.message);
      }
    }
  );
}

/**
 * Daha fazla mesaj yükler
 * @param socket - Socket.io socket
 * @param username - Sohbet edilecek kullanıcı adı
 */
function loadMoreMessages(socket: Socket, username: string): void {
  // Yükleniyor göstergesi
  const dmMessages = document.getElementById('dmMessages');
  if (!dmMessages) {
    return;
  }

  const loadingIndicator = document.createElement('div');
  loadingIndicator.className = 'loading-more-messages';
  loadingIndicator.textContent = 'Daha fazla mesaj yükleniyor...';
  dmMessages.prepend(loadingIndicator);

  // Mevcut kaydırma pozisyonunu kaydet
  const scrollHeight = dmMessages.scrollHeight;

  // Sonraki sayfayı yükle
  currentPage++;

  socket.emit(
    'getDMHistory',
    {
      username,
      page: currentPage,
      limit: messagesPerPage,
    },
    (response: MessageResponse) => {
      // Yükleniyor göstergesini kaldır
      loadingIndicator.remove();

      if (response.success && response.messages) {
        if (response.messages.length === 0) {
          // Daha fazla mesaj yok
          hasMoreMessages = false;
        } else {
          // Mesajları ekle
          response.messages.forEach(msg => {
            // Mesajı geçmişe ekle
            messageHistory.unshift(msg);

            // Mesajı sohbete ekle
            addMessageToChat(msg, true, true);
          });

          // Daha fazla mesaj var mı kontrol et
          hasMoreMessages = response.messages.length >= messagesPerPage;

          // Kaydırma pozisyonunu koru
          dmMessages.scrollTop = dmMessages.scrollHeight - scrollHeight;
        }
      } else {
        console.error('Daha fazla mesaj yükleme hatası:', response.message);
      }
    }
  );
}

/**
 * DM mesajı gönderir
 * @param socket - Socket.io socket
 * @param username - Alıcı kullanıcı adı
 */
function sendDMMessage(socket: Socket, username: string): void {
  const messageInput = document.getElementById('dmMessageInput') as HTMLInputElement;
  if (!messageInput) {
    return;
  }

  const content = messageInput.value.trim();
  if (content === '') {
    return;
  }

  // Mesajı gönder
  socket.emit(
    'sendDM',
    {
      to: username,
      content,
    },
    (response: SendMessageResponse) => {
      if (response.success) {
        // Giriş alanını temizle
        messageInput.value = '';

        // Giriş alanına odaklan
        messageInput.focus();
      } else {
        console.error('Mesaj gönderme hatası:', response.message);
        alert('Mesaj gönderilemedi: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Mesajı sohbete ekler
 * @param message - Mesaj verisi
 * @param isHistory - Geçmiş mesajı mı
 * @param prepend - Başa mı eklenecek
 */
function addMessageToChat(message: MessageData, isHistory = false, prepend = false): void {
  const dmMessages = document.getElementById('dmMessages');
  if (!dmMessages) {
    return;
  }

  // Mesaj öğesi oluştur
  const messageElement = document.createElement('div');
  messageElement.className = 'dm-message';
  messageElement.setAttribute('data-message-id', message._id);
  messageElement.setAttribute('data-sender', message.sender);

  // Mesaj içeriği
  let content = message.content;

  // Silinen mesaj kontrolü
  if (message.isDeleted) {
    content = '<em>Bu mesaj silindi.</em>';
  }

  // Dosya eki kontrolü
  let fileAttachmentHTML = '';
  if (message.fileAttachment) {
    fileAttachmentHTML = `
      <div class="message-attachment">
        <a href="${message.fileAttachment.filePath}" target="_blank" class="attachment-link">
          <span class="material-icons">attach_file</span>
          <span class="attachment-name">${message.fileAttachment.fileName}</span>
        </a>
      </div>
    `;
  }

  // Mesaj zamanı
  const timestamp = new Date(message.timestamp);
  const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedDate = timestamp.toLocaleDateString();

  // Kendim mi gönderdim
  const isSentByMe = message.sender === (window as any).username;

  // Mesaj HTML'i
  messageElement.innerHTML = `
    <div class="message-header">
      <div class="message-sender">${isSentByMe ? 'Sen' : message.sender}</div>
      <div class="message-timestamp" title="${formattedDate} ${formattedTime}">${formattedTime}</div>
    </div>
    <div class="message-content">${content}</div>
    ${fileAttachmentHTML}
    ${
      !message.isDeleted
        ? `
      <div class="message-actions">
        ${
          isSentByMe
            ? `
          <button class="edit-dm-btn" title="Düzenle">
            <span class="material-icons">edit</span>
          </button>
          <button class="delete-dm-btn" title="Sil">
            <span class="material-icons">delete</span>
          </button>
        `
            : ''
        }
        <button class="add-reaction-btn" title="Tepki Ekle">
          <span class="material-icons">add_reaction</span>
        </button>
      </div>
    `
        : ''
    }
  `;

  // Mesajı ekle
  if (prepend) {
    dmMessages.prepend(messageElement);
  } else {
    dmMessages.appendChild(messageElement);
  }

  // Düzenlendi işareti
  if (message.isEdited && !message.isDeleted) {
    const timestampElement = messageElement.querySelector('.message-timestamp');
    if (timestampElement) {
      const editedIndicator = document.createElement('span');
      editedIndicator.className = 'edited-indicator';
      editedIndicator.textContent = ' (düzenlendi)';
      timestampElement.appendChild(editedIndicator);
    }
  }

  // Geçmiş mesaj değilse ve en altta değilsek bildirim göster
  if (!isHistory && !isScrolledToBottom()) {
    showNewMessageNotification(message);
  }
}

/**
 * Mesajı günceller
 * @param messageId - Mesaj ID'si
 * @param content - Yeni içerik
 */
function updateMessage(messageId: string, content: string): void {
  const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);
  if (!messageElement) {
    return;
  }

  const contentElement = messageElement.querySelector('.message-content');
  if (contentElement) {
    contentElement.innerHTML = content;
  }

  // Düzenlendi işareti ekle
  const timestampElement = messageElement.querySelector('.message-timestamp');
  if (timestampElement && !timestampElement.querySelector('.edited-indicator')) {
    const editedIndicator = document.createElement('span');
    editedIndicator.className = 'edited-indicator';
    editedIndicator.textContent = ' (düzenlendi)';
    timestampElement.appendChild(editedIndicator);
  }
}

/**
 * Mesajı silindi olarak işaretler
 * @param messageId - Mesaj ID'si
 */
function markMessageAsDeleted(messageId: string): void {
  const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);
  if (!messageElement) {
    return;
  }

  const contentElement = messageElement.querySelector('.message-content');
  if (contentElement) {
    contentElement.innerHTML = '<em>Bu mesaj silindi.</em>';
  }

  // Mesaj eylemlerini kaldır
  const actionsElement = messageElement.querySelector('.message-actions');
  if (actionsElement) {
    actionsElement.remove();
  }

  // Dosya ekini kaldır
  const attachmentElement = messageElement.querySelector('.message-attachment');
  if (attachmentElement) {
    attachmentElement.remove();
  }
}

/**
 * Yeni mesaj bildirimi gösterir
 * @param message - Mesaj verisi
 */
function showNewMessageNotification(message: MessageData): void {
  const dmMessages = document.getElementById('dmMessages');
  if (!dmMessages) {
    return;
  }

  // Bildirim zaten varsa kaldır
  const existingNotification = document.querySelector('.new-message-notification');
  if (existingNotification) {
    existingNotification.remove();
  }

  // Yeni bildirim oluştur
  const notification = document.createElement('div');
  notification.className = 'new-message-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <span class="material-icons">arrow_downward</span>
      <span>Yeni mesaj</span>
    </div>
  `;

  // Bildirime tıklama olayı
  notification.addEventListener('click', () => {
    scrollToBottom();
    notification.remove();
  });

  // Bildirimi ekle
  dmMessages.appendChild(notification);
}

/**
 * En alta kaydırır
 */
function scrollToBottom(): void {
  const dmMessages = document.getElementById('dmMessages');
  if (dmMessages) {
    dmMessages.scrollTop = dmMessages.scrollHeight;
  }
}

/**
 * En altta mı kontrol eder
 * @returns En altta mı
 */
function isScrolledToBottom(): boolean {
  const dmMessages = document.getElementById('dmMessages');
  if (!dmMessages) {
    return true;
  }

  const scrollTop = dmMessages.scrollTop;
  const scrollHeight = dmMessages.scrollHeight;
  const clientHeight = dmMessages.clientHeight;

  // 20px tolerans ile en altta mı kontrol et
  return scrollTop + clientHeight >= scrollHeight - 20;
}
