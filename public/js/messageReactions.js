// public/js/messageReactions.js

/**
 * Mesaj tepkileri modülü
 * Mesajlara emoji ile tepki verme özelliğini sağlar
 */

/**
 * Mesaj tepkileri özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initMessageReactions(socket) {
  // Tepki ekleme olayı
  document.addEventListener('click', (e) => {
    // Tepki düğmesine tıklama
    if (e.target.closest('.add-reaction-btn')) {
      const messageElement = e.target.closest('.text-message, .dm-message');
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        showEmojiPicker(messageElement, messageId, socket);
      }
    }
    
    // Mevcut tepkiye tıklama (tepkiyi kaldırma)
    if (e.target.closest('.message-reaction')) {
      const reactionElement = e.target.closest('.message-reaction');
      const messageElement = reactionElement.closest('.text-message, .dm-message');
      
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const emoji = reactionElement.dataset.emoji;
        
        // DM mesajı mı yoksa kanal mesajı mı kontrol et
        if (messageElement.classList.contains('dm-message')) {
          socket.emit('removeDMReaction', { messageId, emoji }, (response) => {
            if (!response.success) {
              console.error('Tepki kaldırma hatası:', response.message);
            }
          });
        } else {
          socket.emit('removeReaction', { messageId, emoji }, (response) => {
            if (!response.success) {
              console.error('Tepki kaldırma hatası:', response.message);
            }
          });
        }
      }
    }
  });
  
  // Socket olaylarını dinle
  socket.on('messageReactionAdded', (data) => {
    updateMessageReaction(data);
  });
  
  socket.on('messageReactionRemoved', (data) => {
    updateMessageReaction(data);
  });
  
  socket.on('dmMessageReactionAdded', (data) => {
    updateDMMessageReaction(data);
  });
  
  socket.on('dmMessageReactionRemoved', (data) => {
    updateDMMessageReaction(data);
  });
}

/**
 * Emoji seçiciyi gösterir
 * @param {HTMLElement} messageElement - Mesaj elementi
 * @param {string} messageId - Mesaj ID'si
 * @param {Object} socket - Socket.io socket
 */
function showEmojiPicker(messageElement, messageId, socket) {
  // Mevcut emoji seçiciyi kaldır
  const existingPicker = document.querySelector('.reaction-emoji-picker');
  if (existingPicker) {
    existingPicker.remove();
  }
  
  // Yeni emoji seçici oluştur
  const emojiPicker = document.createElement('div');
  emojiPicker.className = 'reaction-emoji-picker';
  
  // Sık kullanılan emojiler
  const commonEmojis = ['😊', '😂', '😍', '👍', '👎', '❤️', '🔥', '🎉', '🤔', '😢', '😠', '👀', '✅', '❌'];
  
  commonEmojis.forEach(emoji => {
    const emojiButton = document.createElement('button');
    emojiButton.className = 'reaction-emoji-btn';
    emojiButton.textContent = emoji;
    
    emojiButton.addEventListener('click', () => {
      // DM mesajı mı yoksa kanal mesajı mı kontrol et
      if (messageElement.classList.contains('dm-message')) {
        socket.emit('addDMReaction', { messageId, emoji }, (response) => {
          if (!response.success) {
            console.error('Tepki ekleme hatası:', response.message);
          }
        });
      } else {
        socket.emit('addReaction', { messageId, emoji }, (response) => {
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
  document.addEventListener('click', function closeEmojiPicker(e) {
    if (!emojiPicker.contains(e.target) && !e.target.closest('.add-reaction-btn')) {
      emojiPicker.remove();
      document.removeEventListener('click', closeEmojiPicker);
    }
  });
}

/**
 * Mesaj tepkisini günceller
 * @param {Object} data - Tepki verileri
 */
function updateMessageReaction(data) {
  const { messageId, emoji, username, count } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);
  
  if (!messageElement) return;
  
  // Tepkiler konteynerini bul veya oluştur
  let reactionsContainer = messageElement.querySelector('.message-reactions');
  if (!reactionsContainer) {
    reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    messageElement.appendChild(reactionsContainer);
  }
  
  // Mevcut tepkiyi bul
  let reactionElement = reactionsContainer.querySelector(`.message-reaction[data-emoji="${emoji}"]`);
  
  // Tepki sayısı 0 ise tepkiyi kaldır
  if (count === 0) {
    if (reactionElement) {
      reactionElement.remove();
    }
    
    // Tepki kalmadıysa konteynerı kaldır
    if (reactionsContainer.children.length === 0) {
      reactionsContainer.remove();
    }
    
    return;
  }
  
  // Tepki yoksa oluştur
  if (!reactionElement) {
    reactionElement = document.createElement('div');
    reactionElement.className = 'message-reaction';
    reactionElement.dataset.emoji = emoji;
    reactionsContainer.appendChild(reactionElement);
  }
  
  // Tepkiyi güncelle
  reactionElement.innerHTML = `
    <span class="reaction-emoji">${emoji}</span>
    <span class="reaction-count">${count}</span>
  `;
}

/**
 * DM mesaj tepkisini günceller
 * @param {Object} data - Tepki verileri
 */
function updateDMMessageReaction(data) {
  const { messageId, emoji, username, count, friend } = data;
  
  // Doğru DM sohbetinde olduğumuzu kontrol et
  const dmMessages = document.querySelector('#dmMessages');
  if (!dmMessages || dmMessages.dataset.friend !== friend) return;
  
  const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);
  if (!messageElement) return;
  
  // Tepkiler konteynerini bul veya oluştur
  let reactionsContainer = messageElement.querySelector('.message-reactions');
  if (!reactionsContainer) {
    reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    messageElement.appendChild(reactionsContainer);
  }
  
  // Mevcut tepkiyi bul
  let reactionElement = reactionsContainer.querySelector(`.message-reaction[data-emoji="${emoji}"]`);
  
  // Tepki sayısı 0 ise tepkiyi kaldır
  if (count === 0) {
    if (reactionElement) {
      reactionElement.remove();
    }
    
    // Tepki kalmadıysa konteynerı kaldır
    if (reactionsContainer.children.length === 0) {
      reactionsContainer.remove();
    }
    
    return;
  }
  
  // Tepki yoksa oluştur
  if (!reactionElement) {
    reactionElement = document.createElement('div');
    reactionElement.className = 'message-reaction';
    reactionElement.dataset.emoji = emoji;
    reactionsContainer.appendChild(reactionElement);
  }
  
  // Tepkiyi güncelle
  reactionElement.innerHTML = `
    <span class="reaction-emoji">${emoji}</span>
    <span class="reaction-count">${count}</span>
  `;
}
