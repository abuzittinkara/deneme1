// public/js/messageQuoting.js

/**
 * Mesaj alıntılama modülü
 * Mesajları alıntılama özelliğini sağlar
 */

/**
 * Mesaj alıntılama özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initMessageQuoting(socket) {
  // Alıntılama düğmesine tıklama olayı
  document.addEventListener('click', (e) => {
    if (e.target.closest('.quote-message-btn')) {
      const messageElement = e.target.closest('.text-message, .dm-message');
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const messageContent = messageElement.querySelector('.message-content').textContent;
        // Use data-sender attribute or find the sender-name element
        const username = messageElement.getAttribute('data-sender') ||
                         messageElement.querySelector('.sender-name')?.textContent ||
                         'Unknown User';

        // DM mesajı mı yoksa kanal mesajı mı kontrol et
        if (messageElement.classList.contains('dm-message')) {
          showDMQuoteInput(messageId, messageContent, username, socket);
        } else {
          showQuoteInput(messageId, messageContent, username, socket);
        }
      }
    }
  });

  // Alıntılı mesajlara tıklama olayı
  document.addEventListener('click', (e) => {
    if (e.target.closest('.quoted-message')) {
      const quotedMessage = e.target.closest('.quoted-message');
      const quotedMessageId = quotedMessage.dataset.quotedMessageId;

      if (quotedMessageId) {
        // Alıntılanan mesaja kaydır
        const originalMessage = document.querySelector(`.text-message[data-message-id="${quotedMessageId}"], .dm-message[data-message-id="${quotedMessageId}"]`);

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
 * @param {string} messageId - Alıntılanacak mesaj ID'si
 * @param {string} messageContent - Alıntılanacak mesaj içeriği
 * @param {string} username - Alıntılanacak mesajın sahibi
 * @param {Object} socket - Socket.io socket
 */
function showQuoteInput(messageId, messageContent, username, socket) {
  const inputElement = document.getElementById('textChannelMessageInput');
  const channelId = document.querySelector('#textMessages')?.dataset?.channelId;

  if (!inputElement || !channelId) return;

  // Alıntı bilgisini giriş alanına ekle
  inputElement.dataset.quotedMessageId = messageId;
  inputElement.dataset.quotedUsername = username;

  // Alıntı önizlemesi oluştur
  let quotePreview = document.querySelector('.quote-preview');
  if (!quotePreview) {
    quotePreview = document.createElement('div');
    quotePreview.className = 'quote-preview';
    inputElement.parentNode.insertBefore(quotePreview, inputElement);
  }

  // Önizleme içeriği
  quotePreview.innerHTML = `
    <div class="quote-preview-content">
      <div class="quote-preview-header">
        <span class="quote-preview-username">${username}</span>
        <button class="quote-preview-close">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="quote-preview-text">${messageContent}</div>
    </div>
  `;

  // Kapatma düğmesi olayı
  const closeButton = quotePreview.querySelector('.quote-preview-close');
  closeButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeQuotePreview(inputElement);
  });

  // Giriş alanına odaklan
  inputElement.focus();

  // Mesaj gönderme olayını geçersiz kıl
  const sendButton = document.querySelector('#textChatInputBar .send-icon');
  if (sendButton) {
    sendButton.onclick = function(e) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) return;

      // Alıntılı mesaj gönder
      socket.emit('quoteMessage', {
        messageId,
        content,
        channelId
      }, (response) => {
        if (response.success) {
          inputElement.value = '';
          removeQuotePreview(inputElement);
        } else {
          console.error('Alıntılı mesaj gönderme hatası:', response.message);
        }
      });
    };
  }

  // Enter tuşu olayını geçersiz kıl
  inputElement.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) return;

      // Alıntılı mesaj gönder
      socket.emit('quoteMessage', {
        messageId,
        content,
        channelId
      }, (response) => {
        if (response.success) {
          inputElement.value = '';
          removeQuotePreview(inputElement);
        } else {
          console.error('Alıntılı mesaj gönderme hatası:', response.message);
        }
      });
    }
  };
}

/**
 * DM mesajı alıntılama giriş alanını gösterir
 * @param {string} messageId - Alıntılanacak mesaj ID'si
 * @param {string} messageContent - Alıntılanacak mesaj içeriği
 * @param {string} username - Alıntılanacak mesajın sahibi
 * @param {Object} socket - Socket.io socket
 */
function showDMQuoteInput(messageId, messageContent, username, socket) {
  const inputElement = document.getElementById('dmMessageInput');
  const friendUsername = document.querySelector('#dmMessages')?.dataset?.friend;

  if (!inputElement || !friendUsername) return;

  // Alıntı bilgisini giriş alanına ekle
  inputElement.dataset.quotedMessageId = messageId;
  inputElement.dataset.quotedUsername = username;

  // Alıntı önizlemesi oluştur
  let quotePreview = document.querySelector('.quote-preview');
  if (!quotePreview) {
    quotePreview = document.createElement('div');
    quotePreview.className = 'quote-preview';
    inputElement.parentNode.insertBefore(quotePreview, inputElement);
  }

  // Önizleme içeriği
  quotePreview.innerHTML = `
    <div class="quote-preview-content">
      <div class="quote-preview-header">
        <span class="quote-preview-username">${username}</span>
        <button class="quote-preview-close">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="quote-preview-text">${messageContent}</div>
    </div>
  `;

  // Kapatma düğmesi olayı
  const closeButton = quotePreview.querySelector('.quote-preview-close');
  closeButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    removeQuotePreview(inputElement);
  });

  // Giriş alanına odaklan
  inputElement.focus();

  // Mesaj gönderme olayını geçersiz kıl
  const sendButton = document.querySelector('#dmChatInputBar .send-icon');
  if (sendButton) {
    sendButton.onclick = function(e) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) return;

      // Alıntılı DM mesajı gönder
      socket.emit('quoteDMMessage', {
        messageId,
        content,
        receiverUsername: friendUsername
      }, (response) => {
        if (response.success) {
          inputElement.value = '';
          removeQuotePreview(inputElement);
        } else {
          console.error('Alıntılı DM mesajı gönderme hatası:', response.message);
        }
      });
    };
  }

  // Enter tuşu olayını geçersiz kıl
  inputElement.onkeydown = function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();

      const content = inputElement.value.trim();
      if (!content) return;

      // Alıntılı DM mesajı gönder
      socket.emit('quoteDMMessage', {
        messageId,
        content,
        receiverUsername: friendUsername
      }, (response) => {
        if (response.success) {
          inputElement.value = '';
          removeQuotePreview(inputElement);
        } else {
          console.error('Alıntılı DM mesajı gönderme hatası:', response.message);
        }
      });
    }
  };
}

/**
 * Alıntı önizlemesini kaldırır
 * @param {HTMLElement} inputElement - Giriş alanı
 */
function removeQuotePreview(inputElement) {
  // Alıntı bilgisini temizle
  delete inputElement.dataset.quotedMessageId;
  delete inputElement.dataset.quotedUsername;

  // Önizlemeyi kaldır
  const quotePreview = document.querySelector('.quote-preview');
  if (quotePreview) {
    quotePreview.remove();
  }

  // Varsayılan olayları geri yükle
  resetInputEvents(inputElement);
}

/**
 * Giriş alanı olaylarını sıfırlar
 * @param {HTMLElement} inputElement - Giriş alanı
 */
function resetInputEvents(inputElement) {
  // Mesaj gönderme olayını sıfırla
  const sendButton = inputElement.id === 'textChannelMessageInput'
    ? document.querySelector('#textChatInputBar .send-icon')
    : document.querySelector('#dmChatInputBar .send-icon');

  if (sendButton) {
    sendButton.onclick = null;
  }

  // Enter tuşu olayını sıfırla
  inputElement.onkeydown = null;
}
