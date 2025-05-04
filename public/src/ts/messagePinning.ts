/**
 * public/src/ts/messagePinning.ts
 * Mesaj sabitleme modülü
 * Mesajları sabitleme ve sabitlenmiş mesajları görüntüleme özelliğini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Mesaj arayüzü
interface Message {
  id: string;
  content: string;
  timestamp: string;
  user: string;
  pinnedBy: string;
}

// Sabitleme yanıtı arayüzü
interface PinResponse {
  success: boolean;
  message?: string;
  messages?: Message[];
}

/**
 * Mesaj sabitleme özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initMessagePinning(socket: Socket): void {
  // Sabitleme düğmesine tıklama olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.pin-message-btn')) {
      const messageElement = target.closest('.text-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'];
        const groupId = (window as any).currentGroup;

        if (!groupId) {
          console.error('Grup ID bulunamadı');
          return;
        }

        if (messageId) {
          socket.emit('pinMessage', { messageId, groupId }, (response: PinResponse) => {
            if (!response.success) {
              console.error('Mesaj sabitleme hatası:', response.message);
            }
          });
        }
      }
    }

    // Sabitlemeyi kaldırma düğmesine tıklama olayı
    if (target.closest('.unpin-message-btn')) {
      const messageElement = target.closest('.text-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'];
        const groupId = (window as any).currentGroup;

        if (!groupId) {
          console.error('Grup ID bulunamadı');
          return;
        }

        if (messageId) {
          socket.emit('unpinMessage', { messageId, groupId }, (response: PinResponse) => {
            if (!response.success) {
              console.error('Mesaj sabitleme kaldırma hatası:', response.message);
            }
          });
        }
      }
    }

    // Sabitlenmiş mesajları görüntüleme düğmesine tıklama olayı
    if (target.closest('.view-pinned-messages-btn')) {
      const textMessages = document.querySelector('#textMessages') as HTMLElement;
      const channelId = textMessages?.dataset ? textMessages.dataset['channelId'] : undefined;
      if (channelId) {
        showPinnedMessages(channelId, socket);
      }
    }
  });

  // Socket olaylarını dinle
  socket.on('messagePinned', (data: { messageId: string }) => {
    updateMessagePinStatus(data, true);
  });

  socket.on('messageUnpinned', (data: { messageId: string }) => {
    updateMessagePinStatus(data, false);
  });

  // Kanal başlığına sabitlenmiş mesajlar düğmesi ekle
  addPinnedMessagesButton();
}

/**
 * Kanal başlığına sabitlenmiş mesajlar düğmesi ekler
 */
function addPinnedMessagesButton(): void {
  const channelHeader = document.querySelector('.channel-header');
  if (channelHeader) {
    const pinnedButton = document.createElement('button');
    pinnedButton.className = 'view-pinned-messages-btn';
    pinnedButton.innerHTML = '<span class="material-icons">push_pin</span>';
    pinnedButton.title = 'Sabitlenmiş Mesajlar';

    // Düğmeyi başlığa ekle (arama düğmesinden önce)
    const searchButton = channelHeader.querySelector('.search-button');
    if (searchButton) {
      channelHeader.insertBefore(pinnedButton, searchButton);
    } else {
      channelHeader.appendChild(pinnedButton);
    }
  }
}

/**
 * Sabitlenmiş mesajları gösterir
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 */
function showPinnedMessages(channelId: string, socket: Socket): void {
  socket.emit('getPinnedMessages', { channelId }, (response: PinResponse) => {
    if (!response.success) {
      console.error('Sabitlenmiş mesajları getirme hatası:', response.message);
      return;
    }

    const pinnedMessages = response.messages || [];

    // Mevcut modalı kaldır
    const existingModal = document.getElementById('pinnedMessagesModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Yeni modal oluştur
    const modal = document.createElement('div');
    modal.id = 'pinnedMessagesModal';
    modal.className = 'modal';

    // Modal içeriği
    modal.innerHTML = `
      <div class="modal-content pinned-messages-modal">
        <h2>Sabitlenmiş Mesajlar</h2>
        <div class="pinned-messages-list">
          ${
            pinnedMessages.length > 0
              ? pinnedMessages.map(msg => createPinnedMessageHTML(msg)).join('')
              : '<div class="no-pinned-messages">Bu kanalda sabitlenmiş mesaj yok.</div>'
          }
        </div>
        <button id="closePinnedMessagesBtn" class="btn secondary">Kapat</button>
      </div>
    `;

    document.body.appendChild(modal);

    // Kapatma düğmesi olayı
    const closeBtn = document.getElementById('closePinnedMessagesBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.remove();
      });
    }

    // Mesaja tıklama olayı
    const pinnedMessageItems = modal.querySelectorAll('.pinned-message-item');
    pinnedMessageItems.forEach(item => {
      item.addEventListener('click', () => {
        const messageId = (item as HTMLElement).dataset['messageId'];
        if (!messageId) {
          return;
        }

        const messageElement = document.querySelector(
          `.text-message[data-message-id="${messageId}"]`
        );

        if (messageElement) {
          // Mesaja kaydır ve vurgula
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('highlight-message');

          setTimeout(() => {
            messageElement.classList.remove('highlight-message');
          }, 2000);

          // Modalı kapat
          modal.remove();
        }
      });
    });
  });
}

/**
 * Sabitlenmiş mesaj HTML'i oluşturur
 * @param message - Mesaj verileri
 * @returns Mesaj HTML'i
 */
function createPinnedMessageHTML(message: Message): string {
  const date = new Date(message.timestamp);
  const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

  return `
    <div class="pinned-message-item" data-message-id="${message.id}">
      <div class="pinned-message-header">
        <span class="pinned-message-username">${message.user}</span>
        <span class="pinned-message-time">${formattedDate}</span>
      </div>
      <div class="pinned-message-content">${message.content}</div>
      <div class="pinned-message-footer">
        <span class="pinned-by">
          <span class="material-icons">push_pin</span>
          <span>${message.pinnedBy} tarafından sabitlendi</span>
        </span>
      </div>
    </div>
  `;
}

/**
 * Mesajın sabitleme durumunu günceller
 * @param data - Mesaj verileri
 * @param isPinned - Sabitlenmiş mi?
 */
function updateMessagePinStatus(data: { messageId: string }, isPinned: boolean): void {
  const { messageId } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);

  if (!messageElement) {
    return;
  }

  // Sabitleme göstergesini bul veya oluştur
  let pinIndicator = messageElement.querySelector('.pin-indicator');

  if (isPinned) {
    // Sabitleme göstergesi yoksa oluştur
    if (!pinIndicator) {
      pinIndicator = document.createElement('div');
      pinIndicator.className = 'pin-indicator';
      pinIndicator.innerHTML = '<span class="material-icons">push_pin</span>';

      // Mesaj içeriğinin yanına ekle
      const messageContent = messageElement.querySelector('.message-content');
      if (messageContent && messageContent.parentNode) {
        messageContent.parentNode.insertBefore(pinIndicator, messageContent.nextSibling);
      }
    }

    // Sabitleme düğmesini kaldırma düğmesiyle değiştir
    const pinButton = messageElement.querySelector('.pin-message-btn');
    if (pinButton && pinButton.parentNode) {
      const unpinButton = document.createElement('button');
      unpinButton.className = 'unpin-message-btn message-action-btn';
      unpinButton.innerHTML = '<span class="material-icons">push_pin</span>';
      unpinButton.title = 'Sabitlemeyi Kaldır';

      pinButton.parentNode.replaceChild(unpinButton, pinButton);
    }
  } else {
    // Sabitleme göstergesini kaldır
    if (pinIndicator) {
      pinIndicator.remove();
    }

    // Kaldırma düğmesini sabitleme düğmesiyle değiştir
    const unpinButton = messageElement.querySelector('.unpin-message-btn');
    if (unpinButton && unpinButton.parentNode) {
      const pinButton = document.createElement('button');
      pinButton.className = 'pin-message-btn message-action-btn';
      pinButton.innerHTML = '<span class="material-icons">push_pin</span>';
      pinButton.title = 'Mesajı Sabitle';

      unpinButton.parentNode.replaceChild(pinButton, unpinButton);
    }
  }
}
