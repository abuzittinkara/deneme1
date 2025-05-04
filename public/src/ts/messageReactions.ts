/**
 * public/src/ts/messageReactions.ts
 * Mesaj tepkileri modülü
 * Mesajlara emoji ile tepki verme özelliğini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Tepki verisi arayüzü
interface ReactionData {
  messageId: string;
  emoji: string;
  username: string;
  count?: number;
  users?: string[];
}

// Tepki yanıtı arayüzü
interface ReactionResponse {
  success: boolean;
  message?: string;
}

/**
 * Mesaj tepkileri özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initMessageReactions(socket: Socket): void {
  // Tepki ekleme olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Tepki düğmesine tıklama
    if (target.closest('.add-reaction-btn')) {
      const messageElement = target.closest('.text-message, .dm-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'] || '';
        showEmojiPicker(messageElement, messageId, socket);
      }
    }

    // Mevcut tepkiye tıklama
    if (target.closest('.message-reaction')) {
      const reactionElement = target.closest('.message-reaction') as HTMLElement;
      const messageElement = target.closest('.text-message, .dm-message') as HTMLElement;

      if (reactionElement && messageElement) {
        const messageId = messageElement.dataset['messageId'] || '';
        const emoji = reactionElement.dataset['emoji'] || '';

        // DM mesajı mı yoksa kanal mesajı mı kontrol et
        if (messageElement.classList.contains('dm-message')) {
          toggleDMReaction(messageId, emoji, socket);
        } else {
          toggleReaction(messageId, emoji, socket);
        }
      }
    }
  });

  // Tepki olaylarını dinle
  socket.on('messageReactionAdded', (data: ReactionData) => {
    updateMessageReaction(data);
  });

  socket.on('messageReactionRemoved', (data: ReactionData) => {
    updateMessageReaction(data);
  });

  socket.on('dmMessageReactionAdded', (data: ReactionData) => {
    updateDMMessageReaction(data);
  });

  socket.on('dmMessageReactionRemoved', (data: ReactionData) => {
    updateDMMessageReaction(data);
  });
}

/**
 * Emoji seçiciyi gösterir
 * @param messageElement - Mesaj elementi
 * @param messageId - Mesaj ID'si
 * @param socket - Socket.io socket
 */
function showEmojiPicker(messageElement: HTMLElement, messageId: string, socket: Socket): void {
  // Mevcut emoji seçiciyi kaldır
  const existingPicker = document.querySelector('.reaction-emoji-picker');
  if (existingPicker) {
    existingPicker.remove();
  }

  // Yeni emoji seçici oluştur
  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'reaction-emoji-picker';

  // Sık kullanılan emojiler
  const commonEmojis = [
    '😊',
    '😂',
    '😍',
    '👍',
    '👎',
    '❤️',
    '🔥',
    '🎉',
    '🤔',
    '😢',
    '😠',
    '👀',
    '✅',
    '❌',
  ];

  commonEmojis.forEach(emoji => {
    const emojiButton = document.createElement('button');
    emojiButton.className = 'reaction-emoji-btn';
    emojiButton.textContent = emoji;

    emojiButton.addEventListener('click', () => {
      // DM mesajı mı yoksa kanal mesajı mı kontrol et
      if (messageElement.classList.contains('dm-message')) {
        socket.emit('addDMReaction', { messageId, emoji }, (response: ReactionResponse) => {
          if (!response.success) {
            console.error('Tepki ekleme hatası:', response.message);
          }
        });
      } else {
        socket.emit('addReaction', { messageId, emoji }, (response: ReactionResponse) => {
          if (!response.success) {
            console.error('Tepki ekleme hatası:', response.message);
          }
        });
      }

      // Emoji seçiciyi kapat
      emojiPicker.remove();
    });

    emojiPicker.appendChild(emojiButton);
  });

  // Emoji seçiciyi konumlandır
  const rect = messageElement.getBoundingClientRect();
  emojiPicker.style.top = `${rect.bottom + window.scrollY}px`;
  emojiPicker.style.left = `${rect.left + window.scrollX}px`;

  document.body.appendChild(emojiPicker);

  // Dışarı tıklama ile kapatma
  document.addEventListener('click', function closeEmojiPicker(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!emojiPicker.contains(target) && !target.closest('.add-reaction-btn')) {
      emojiPicker.remove();
      document.removeEventListener('click', closeEmojiPicker);
    }
  });
}

/**
 * Tepkiyi değiştirir (ekler veya kaldırır)
 * @param messageId - Mesaj ID'si
 * @param emoji - Emoji
 * @param socket - Socket.io socket
 */
function toggleReaction(messageId: string, emoji: string, socket: Socket): void {
  // Kullanıcı adını al
  const username = (window as any).username;

  // Mesaj elementini bul
  const messageElement = document.querySelector(
    `.text-message[data-message-id="${messageId}"]`
  ) as HTMLElement;
  if (!messageElement) {
    return;
  }

  // Tepki elementini bul
  const reactionElement = messageElement.querySelector(
    `.message-reaction[data-emoji="${emoji}"]`
  ) as HTMLElement;
  if (!reactionElement) {
    return;
  }

  // Kullanıcı zaten tepki vermiş mi kontrol et
  const hasReacted = reactionElement.classList.contains('user-reacted');

  if (hasReacted) {
    // Tepkiyi kaldır
    socket.emit('removeReaction', { messageId, emoji }, (response: ReactionResponse) => {
      if (!response.success) {
        console.error('Tepki kaldırma hatası:', response.message);
      }
    });
  } else {
    // Tepki ekle
    socket.emit('addReaction', { messageId, emoji }, (response: ReactionResponse) => {
      if (!response.success) {
        console.error('Tepki ekleme hatası:', response.message);
      }
    });
  }
}

/**
 * DM tepkisini değiştirir (ekler veya kaldırır)
 * @param messageId - Mesaj ID'si
 * @param emoji - Emoji
 * @param socket - Socket.io socket
 */
function toggleDMReaction(messageId: string, emoji: string, socket: Socket): void {
  // Kullanıcı adını al
  const username = (window as any).username;

  // Mesaj elementini bul
  const messageElement = document.querySelector(
    `.dm-message[data-message-id="${messageId}"]`
  ) as HTMLElement;
  if (!messageElement) {
    return;
  }

  // Tepki elementini bul
  const reactionElement = messageElement.querySelector(
    `.message-reaction[data-emoji="${emoji}"]`
  ) as HTMLElement;
  if (!reactionElement) {
    return;
  }

  // Kullanıcı zaten tepki vermiş mi kontrol et
  const hasReacted = reactionElement.classList.contains('user-reacted');

  if (hasReacted) {
    // Tepkiyi kaldır
    socket.emit('removeDMReaction', { messageId, emoji }, (response: ReactionResponse) => {
      if (!response.success) {
        console.error('Tepki kaldırma hatası:', response.message);
      }
    });
  } else {
    // Tepki ekle
    socket.emit('addDMReaction', { messageId, emoji }, (response: ReactionResponse) => {
      if (!response.success) {
        console.error('Tepki ekleme hatası:', response.message);
      }
    });
  }
}

/**
 * Mesaj tepkisini günceller
 * @param data - Tepki verisi
 */
function updateMessageReaction(data: ReactionData): void {
  const { messageId, emoji, username, count = 0, users = [] } = data;

  // Mesaj elementini bul
  const messageElement = document.querySelector(
    `.text-message[data-message-id="${messageId}"]`
  ) as HTMLElement;
  if (!messageElement) {
    return;
  }

  // Tepkiler konteynerini bul veya oluştur
  let reactionsContainer = messageElement.querySelector('.message-reactions');
  if (!reactionsContainer) {
    reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    messageElement.appendChild(reactionsContainer);
  }

  // Tepki elementini bul veya oluştur
  let reactionElement = reactionsContainer.querySelector(
    `.message-reaction[data-emoji="${emoji}"]`
  ) as HTMLElement;

  if (count > 0) {
    // Tepki var, güncelle veya oluştur
    if (!reactionElement) {
      reactionElement = document.createElement('div');
      reactionElement.className = 'message-reaction';
      reactionElement.dataset['emoji'] = emoji;
      reactionsContainer.appendChild(reactionElement);
    }

    // Tepki içeriğini güncelle
    reactionElement.innerHTML = `
      <span class="reaction-emoji">${emoji}</span>
      <span class="reaction-count">${count}</span>
    `;

    // Kullanıcı tepki vermiş mi kontrol et
    const currentUsername = (window as any).username;
    if (users.includes(currentUsername)) {
      reactionElement.classList.add('user-reacted');
    } else {
      reactionElement.classList.remove('user-reacted');
    }

    // Tepki verenleri tooltip olarak göster
    reactionElement.title = users.join(', ');
  } else {
    // Tepki yok, elementi kaldır
    if (reactionElement) {
      reactionElement.remove();
    }
  }

  // Tepki konteyneri boşsa gizle
  if (reactionsContainer.children.length === 0) {
    (reactionsContainer as HTMLElement).style.display = 'none';
  } else {
    (reactionsContainer as HTMLElement).style.display = 'flex';
  }
}

/**
 * DM mesaj tepkisini günceller
 * @param data - Tepki verisi
 */
function updateDMMessageReaction(data: ReactionData): void {
  const { messageId, emoji, username, count = 0, users = [] } = data;

  // Mesaj elementini bul
  const messageElement = document.querySelector(
    `.dm-message[data-message-id="${messageId}"]`
  ) as HTMLElement;
  if (!messageElement) {
    return;
  }

  // Tepkiler konteynerini bul veya oluştur
  let reactionsContainer = messageElement.querySelector('.message-reactions');
  if (!reactionsContainer) {
    reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    messageElement.appendChild(reactionsContainer);
  }

  // Tepki elementini bul veya oluştur
  let reactionElement = reactionsContainer.querySelector(
    `.message-reaction[data-emoji="${emoji}"]`
  ) as HTMLElement;

  if (count > 0) {
    // Tepki var, güncelle veya oluştur
    if (!reactionElement) {
      reactionElement = document.createElement('div');
      reactionElement.className = 'message-reaction';
      reactionElement.dataset['emoji'] = emoji;
      reactionsContainer.appendChild(reactionElement);
    }

    // Tepki içeriğini güncelle
    reactionElement.innerHTML = `
      <span class="reaction-emoji">${emoji}</span>
      <span class="reaction-count">${count}</span>
    `;

    // Kullanıcı tepki vermiş mi kontrol et
    const currentUsername = (window as any).username;
    if (users.includes(currentUsername)) {
      reactionElement.classList.add('user-reacted');
    } else {
      reactionElement.classList.remove('user-reacted');
    }

    // Tepki verenleri tooltip olarak göster
    reactionElement.title = users.join(', ');
  } else {
    // Tepki yok, elementi kaldır
    if (reactionElement) {
      reactionElement.remove();
    }
  }

  // Tepki konteyneri boşsa gizle
  if (reactionsContainer.children.length === 0) {
    (reactionsContainer as HTMLElement).style.display = 'none';
  } else {
    (reactionsContainer as HTMLElement).style.display = 'flex';
  }
}
