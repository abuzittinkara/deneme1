/**
 * public/src/ts/typingIndicator.ts
 *
 * Bu modül, metin kanalı seçili iken kullanıcının
 * metin giriş alanında (id="textChannelMessageInput") yazı yazdığını algılayıp,
 * "X yazıyor..." göstergesini, yalnızca diğer kullanıcılara gösterecek şekilde çalışır.
 *
 * Yerel kullanıcı kendi yazarken ekranında typing göstergesi görünmez.
 * Socket üzerinden "typing" ve "stop typing" event'leri gönderilir;
 * diğer istemciler (aynı text kanalda) bu event'leri aldığında ilgili kullanıcının adını kullanarak
 * "X yazıyor…" mesajını gösterir.
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Yazma verisi arayüzü
interface TypingData {
  username: string;
  channelId: string;
}

// Yazma durumu arayüzü
interface TypingState {
  [username: string]: {
    timeout: number;
    element: HTMLElement;
  };
}

// Yazma durumlarını takip etmek için global değişken
const typingUsers: TypingState = {};

// Yazma olayı için zamanlayıcı
let typingTimer: number | null = null;
let isTyping = false;

// Yazma olayı için gecikme süresi (ms)
const TYPING_TIMEOUT = 3000;

/**
 * Yazma göstergesi özelliğini başlatır
 * @param socket - Socket.io socket
 * @param getCurrentChannel - Mevcut kanalı döndüren fonksiyon
 * @param getUsername - Kullanıcı adını döndüren fonksiyon
 */
export function initTypingIndicator(
  socket: Socket,
  getCurrentChannel: () => string | null,
  getUsername: () => string
): void {
  // Metin giriş alanını izle
  document.addEventListener('input', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'textChannelMessageInput') {
      handleTypingEvent(socket, getCurrentChannel, getUsername);
    }
  });

  // Yazma olaylarını dinle
  socket.on('userTyping', (data: TypingData) => {
    // Kendi yazma olaylarını gösterme
    if (data.username === getUsername()) {
      return;
    }

    // Mevcut kanalı kontrol et
    const currentChannel = getCurrentChannel();
    if (currentChannel !== data.channelId) {
      return;
    }

    showTypingIndicator(data.username);
  });

  socket.on('userStoppedTyping', (data: TypingData) => {
    // Kendi yazma olaylarını gösterme
    if (data.username === getUsername()) {
      return;
    }

    // Mevcut kanalı kontrol et
    const currentChannel = getCurrentChannel();
    if (currentChannel !== data.channelId) {
      return;
    }

    hideTypingIndicator(data.username);
  });
}

/**
 * Yazma olayını işler
 * @param socket - Socket.io socket
 * @param getCurrentChannel - Mevcut kanalı döndüren fonksiyon
 * @param getUsername - Kullanıcı adını döndüren fonksiyon
 */
function handleTypingEvent(
  socket: Socket,
  getCurrentChannel: () => string | null,
  getUsername: () => string
): void {
  const currentChannel = getCurrentChannel();
  if (!currentChannel) {
    return;
  }

  // Yazma olayını gönder
  if (!isTyping) {
    isTyping = true;
    socket.emit('typing', {
      username: getUsername(),
      channelId: currentChannel,
    });
  }

  // Yazma zamanlayıcısını sıfırla
  if (typingTimer !== null) {
    window.clearTimeout(typingTimer);
  }

  // Yazma durduğunda olayı gönder
  typingTimer = window.setTimeout(() => {
    isTyping = false;
    socket.emit('stopTyping', {
      username: getUsername(),
      channelId: currentChannel,
    });
  }, TYPING_TIMEOUT);
}

/**
 * Yazma göstergesini gösterir
 * @param username - Yazan kullanıcının adı
 */
function showTypingIndicator(username: string): void {
  // Mevcut yazma göstergesini kontrol et
  if (typingUsers[username]) {
    // Zamanlayıcıyı sıfırla
    window.clearTimeout(typingUsers[username].timeout);
  } else {
    // Yeni yazma göstergesi oluştur
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `
      <span class="typing-username">${username}</span>
      <span class="typing-text">yazıyor</span>
      <span class="typing-dots">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    `;

    // Yazma göstergesini ekle
    const textMessages = document.getElementById('textMessages');
    if (textMessages) {
      textMessages.appendChild(typingIndicator);

      // Mesaj alanını en alta kaydır
      textMessages.scrollTop = textMessages.scrollHeight;
    }

    // Yazma durumunu kaydet
    typingUsers[username] = {
      element: typingIndicator,
      timeout: 0,
    };
  }

  // Yazma zamanlayıcısını ayarla
  typingUsers[username].timeout = window.setTimeout(() => {
    hideTypingIndicator(username);
  }, TYPING_TIMEOUT);
}

/**
 * Yazma göstergesini gizler
 * @param username - Yazan kullanıcının adı
 */
function hideTypingIndicator(username: string): void {
  // Yazma durumunu kontrol et
  if (typingUsers[username]) {
    // Zamanlayıcıyı temizle
    window.clearTimeout(typingUsers[username].timeout);

    // Yazma göstergesini kaldır
    typingUsers[username].element.remove();

    // Yazma durumunu sil
    delete typingUsers[username];
  }
}
