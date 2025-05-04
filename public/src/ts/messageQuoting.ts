/**
 * public/src/ts/messageQuoting.ts
 * Mesaj alıntılama modülü
 * Mesajları alıntılama ve alıntılı mesaj gönderme özelliğini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Alıntı yanıtı arayüzü
interface QuoteResponse {
  success: boolean;
  message?: string;
}

/**
 * Mesaj alıntılama özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initMessageQuoting(socket: Socket): void {
  // Alıntılama düğmesine tıklama olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.quote-message-btn')) {
      const messageElement = target.closest('.text-message, .dm-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'];
        const messageContent = messageElement.querySelector('.message-content')?.textContent || '';
        // Use data-sender attribute or find the sender-name element
        const username =
          messageElement.getAttribute('data-sender') ||
          messageElement.querySelector('.sender-name')?.textContent ||
          'Unknown User';

        if (messageId) {
          // Mesaj türüne göre alıntılama giriş alanını göster
          if (messageElement.classList.contains('text-message')) {
            showQuoteInput(messageId, messageContent, username, socket);
          } else if (messageElement.classList.contains('dm-message')) {
            showDMQuoteInput(messageId, messageContent, username, socket);
          }
        }
      }
    }
  });

  // Alıntı önizleme kapatma düğmesine tıklama olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.close-quote-preview')) {
      const inputElement = target.closest('.chat-input-container')?.querySelector('textarea');
      if (inputElement) {
        removeQuotePreview(inputElement);
      }
    }
  });

  // Alıntılı mesajlara tıklama olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.quoted-message')) {
      const quotedMessage = target.closest('.quoted-message') as HTMLElement;
      const quotedMessageId = quotedMessage.dataset['quotedMessageId'];

      if (quotedMessageId) {
        // Alıntılanan mesaja kaydır
        const originalMessage = document.querySelector(
          `.text-message[data-message-id="${quotedMessageId}"], .dm-message[data-message-id="${quotedMessageId}"]`
        );

        if (originalMessage) {
          originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
          originalMessage.classList.add('highlight-message');

          setTimeout(() => {
            originalMessage.classList.remove('highlight-message');
          }, 2000);
        }
      }
    }
  });
}

/**
 * Kanal mesajı alıntılama giriş alanını gösterir
 * @param messageId - Alıntılanacak mesaj ID'si
 * @param messageContent - Alıntılanacak mesaj içeriği
 * @param username - Alıntılanacak mesajın sahibi
 * @param socket - Socket.io socket
 */
function showQuoteInput(
  messageId: string,
  messageContent: string,
  username: string,
  socket: Socket
): void {
  const inputElement = document.getElementById('textChannelMessageInput') as HTMLTextAreaElement;
  const textMessages = document.querySelector('#textMessages') as HTMLElement;
  const channelId = textMessages?.dataset ? textMessages.dataset['channelId'] : undefined;

  if (!inputElement || !channelId) {
    return;
  }

  // Alıntı bilgisini giriş alanına ekle
  inputElement.dataset['quotedMessageId'] = messageId;
  inputElement.dataset['quotedUsername'] = username;

  // Alıntı önizlemesi oluştur
  const quotePreview = document.createElement('div');
  quotePreview.className = 'quote-preview';
  quotePreview.innerHTML = `
    <div class="quote-preview-header">
      <span class="material-icons">format_quote</span>
      <span class="quote-preview-username">${username}</span>
      <button class="close-quote-preview">
        <span class="material-icons">close</span>
      </button>
    </div>
    <div class="quote-preview-content">${messageContent}</div>
  `;

  // Önizlemeyi giriş alanının üzerine ekle
  const inputContainer = inputElement.closest('.chat-input-container');
  if (inputContainer) {
    // Varsa eski önizlemeyi kaldır
    const oldPreview = inputContainer.querySelector('.quote-preview');
    if (oldPreview) {
      oldPreview.remove();
    }

    inputContainer.insertBefore(quotePreview, inputElement);
  }

  // Giriş alanına odaklan
  inputElement.focus();

  // Mesaj gönderme olayını geçersiz kıl
  const sendButton = document.querySelector('#textChatInputBar .send-icon') as HTMLElement;
  if (sendButton) {
    sendButton.onclick = function (e: MouseEvent) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) {
        return;
      }

      // Alıntılı mesaj gönder
      socket.emit(
        'quoteMessage',
        {
          messageId,
          content,
          channelId,
        },
        (response: QuoteResponse) => {
          if (response.success) {
            inputElement.value = '';
            removeQuotePreview(inputElement);
          } else {
            console.error('Alıntılı mesaj gönderme hatası:', response.message);
          }
        }
      );
    };
  }

  // Enter tuşu olayını geçersiz kıl
  inputElement.onkeydown = function (e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) {
        return;
      }

      // Alıntılı mesaj gönder
      socket.emit(
        'quoteMessage',
        {
          messageId,
          content,
          channelId,
        },
        (response: QuoteResponse) => {
          if (response.success) {
            inputElement.value = '';
            removeQuotePreview(inputElement);
          } else {
            console.error('Alıntılı mesaj gönderme hatası:', response.message);
          }
        }
      );
    }
  };
}

/**
 * DM mesajı alıntılama giriş alanını gösterir
 * @param messageId - Alıntılanacak mesaj ID'si
 * @param messageContent - Alıntılanacak mesaj içeriği
 * @param username - Alıntılanacak mesajın sahibi
 * @param socket - Socket.io socket
 */
function showDMQuoteInput(
  messageId: string,
  messageContent: string,
  username: string,
  socket: Socket
): void {
  const inputElement = document.getElementById('dmMessageInput') as HTMLTextAreaElement;
  const dmMessages = document.querySelector('#dmMessages') as HTMLElement;
  const friendUsername = dmMessages?.dataset ? dmMessages.dataset['friend'] : undefined;

  if (!inputElement || !friendUsername) {
    return;
  }

  // Alıntı bilgisini giriş alanına ekle
  inputElement.dataset['quotedMessageId'] = messageId;
  inputElement.dataset['quotedUsername'] = username;

  // Alıntı önizlemesi oluştur
  const quotePreview = document.createElement('div');
  quotePreview.className = 'quote-preview';
  quotePreview.innerHTML = `
    <div class="quote-preview-header">
      <span class="material-icons">format_quote</span>
      <span class="quote-preview-username">${username}</span>
      <button class="close-quote-preview">
        <span class="material-icons">close</span>
      </button>
    </div>
    <div class="quote-preview-content">${messageContent}</div>
  `;

  // Önizlemeyi giriş alanının üzerine ekle
  const inputContainer = inputElement.closest('.chat-input-container');
  if (inputContainer) {
    // Varsa eski önizlemeyi kaldır
    const oldPreview = inputContainer.querySelector('.quote-preview');
    if (oldPreview) {
      oldPreview.remove();
    }

    inputContainer.insertBefore(quotePreview, inputElement);
  }

  // Giriş alanına odaklan
  inputElement.focus();

  // Mesaj gönderme olayını geçersiz kıl
  const sendButton = document.querySelector('#dmChatInputBar .send-icon') as HTMLElement;
  if (sendButton) {
    sendButton.onclick = function (e: MouseEvent) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) {
        return;
      }

      // Alıntılı DM mesajı gönder
      socket.emit(
        'quoteDMMessage',
        {
          messageId,
          content,
          receiverUsername: friendUsername,
        },
        (response: QuoteResponse) => {
          if (response.success) {
            inputElement.value = '';
            removeQuotePreview(inputElement);
          } else {
            console.error('Alıntılı DM mesajı gönderme hatası:', response.message);
          }
        }
      );
    };
  }

  // Enter tuşu olayını geçersiz kıl
  inputElement.onkeydown = function (e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) {
        return;
      }

      // Alıntılı DM mesajı gönder
      socket.emit(
        'quoteDMMessage',
        {
          messageId,
          content,
          receiverUsername: friendUsername,
        },
        (response: QuoteResponse) => {
          if (response.success) {
            inputElement.value = '';
            removeQuotePreview(inputElement);
          } else {
            console.error('Alıntılı DM mesajı gönderme hatası:', response.message);
          }
        }
      );
    }
  };
}

/**
 * Alıntı önizlemesini kaldırır
 * @param inputElement - Giriş alanı elementi
 */
function removeQuotePreview(inputElement: HTMLTextAreaElement): void {
  // Alıntı bilgilerini temizle
  delete inputElement.dataset['quotedMessageId'];
  delete inputElement.dataset['quotedUsername'];

  // Önizlemeyi kaldır
  const inputContainer = inputElement.closest('.chat-input-container');
  if (inputContainer) {
    const quotePreview = inputContainer.querySelector('.quote-preview');
    if (quotePreview) {
      quotePreview.remove();
    }
  }

  // Orijinal mesaj gönderme olaylarını geri yükle
  const isTextChannel = inputElement.id === 'textChannelMessageInput';
  const sendButton = document.querySelector(
    isTextChannel ? '#textChatInputBar .send-icon' : '#dmChatInputBar .send-icon'
  ) as HTMLElement;

  if (sendButton) {
    sendButton.onclick = null;
  }

  inputElement.onkeydown = null;
}
