/**
 * public/src/ts/textChannel.ts
 * Metin (mesaj) kanallarıyla ilgili tüm fonksiyonlar burada toplanmıştır.
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Mesaj arayüzü
interface Message {
  _id?: string;
  id?: string;
  content: string;
  timestamp: string | Date;
  user?: {
    username?: string;
    avatar?: string;
  };
  username?: string;
  isPinned?: boolean;
  isEdited?: boolean;
  quotedMessage?: {
    id?: string;
    _id?: string;
    content: string;
    user?:
      | string
      | {
          username?: string;
        };
  };
}

// Global olarak her kanal için son mesaj bilgisini saklayan obje (append işlemleri için kullanılır)
const lastMessageInfo: Record<string, { sender: string; timestamp: Date; count?: number }> = {};

/**
 * İki timestamp'in gün bazında farklı olup olmadığını kontrol eder.
 * @param ts1 - İlk timestamp
 * @param ts2 - İkinci timestamp
 * @returns Gün bazında farklı olup olmadığı
 */
function isDifferentDay(ts1: string | Date, ts2: string | Date): boolean {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}

/**
 * Belirtilen timestamp'i "Bugün HH:MM", "Dün HH:MM" veya "DD.MM.YYYY HH:MM" formatında döndürür.
 * @param timestamp - Timestamp
 * @returns Formatlanmış zaman bilgisi
 */
function formatTimestamp(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (date >= today) {
    return 'Bugün ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (date >= yesterday && date < today) {
    return 'Dün ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else {
    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    return `${day}.${month}.${year} ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  }
}

/**
 * Belirtilen timestamp'i uzun formatta döndürür ("1 Ocak 2023 Pazartesi" gibi).
 * @param timestamp - Timestamp
 * @returns Uzun formatta tarih bilgisi
 */
function formatLongDate(timestamp: string | Date): string {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString('tr-TR', options);
}

/**
 * Belirtilen timestamp'i saat formatında döndürür ("HH:MM" gibi).
 * @param timestamp - Timestamp
 * @returns Saat formatında zaman bilgisi
 */
function formatTime(timestamp: string | Date): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Belirtilen container'a, verilen timestamp için tarih ayıracı ekler.
 * Ayıracı, tüm genişliği kaplayan yatay çizgi şeklinde olup ortasında uzun formatta tarih metni bulunur.
 * @param container - Mesaj container'i
 * @param timestamp - Timestamp
 */
function insertDateSeparator(container: HTMLElement, timestamp: string | Date): void {
  const separator = document.createElement('div');
  separator.className = 'date-separator';
  separator.setAttribute('data-timestamp', new Date(timestamp).toISOString());
  separator.innerHTML = `<span class="separator-text">${formatLongDate(timestamp)}</span>`;
  container.appendChild(separator);
}

/**
 * Mesajı, tam header (avatar, kullanıcı adı ve zaman) şeklinde render eder.
 * @param msg - Mesaj objesi
 * @param sender - Gönderen kullanıcı adı
 * @param time - Formatlanmış zaman bilgisi
 * @param msgClass - Mesaj sınıfı
 * @returns Mesaj HTML'i
 */
function renderFullMessage(msg: Message, sender: string, time: string, msgClass: string): string {
  const isCurrentUser = sender === (window as any).username;
  const messageId = msg._id || msg.id || '';
  const isPinned = msg.isPinned
    ? '<span class="pin-indicator"><span class="material-icons">push_pin</span></span>'
    : '';
  const isEdited = msg.isEdited ? '<span class="edited-indicator"> (düzenlendi)</span>' : '';

  return `
    <div class="message-item">
      <div class="message-header">
        <div class="message-avatar-container">
          <img class="message-avatar" src="${
            msg.user?.avatar || '/images/default-avatar.png'
          }" alt="">
        </div>
        <div class="sender-info">
          <span class="sender-name">${sender}</span>
          <span class="timestamp">${time}</span>
          ${isPinned}
        </div>
        ${
          isCurrentUser
            ? `
        <div class="message-actions">
          <button class="message-action-btn edit-message-btn" title="Düzenle">
            <span class="material-icons">edit</span>
          </button>
          <button class="message-action-btn delete-message-btn" title="Sil">
            <span class="material-icons">delete</span>
          </button>
          <button class="message-action-btn add-reaction-btn" title="Tepki Ekle">
            <span class="material-icons">add_reaction</span>
          </button>
          <button class="message-action-btn quote-message-btn" title="Alıntıla">
            <span class="material-icons">format_quote</span>
          </button>
          <button class="message-action-btn pin-message-btn" title="Sabitle">
            <span class="material-icons">push_pin</span>
          </button>
        </div>
        `
            : `
        <div class="message-actions">
          <button class="message-action-btn add-reaction-btn" title="Tepki Ekle">
            <span class="material-icons">add_reaction</span>
          </button>
          <button class="message-action-btn quote-message-btn" title="Alıntıla">
            <span class="material-icons">format_quote</span>
          </button>
        </div>
        `
        }
      </div>
      <div class="message-content ${msgClass}">${msg.content}${isEdited}</div>
      ${
        msg.quotedMessage
          ? `
      <div class="quoted-message" data-quoted-message-id="${
        msg.quotedMessage.id || msg.quotedMessage._id
      }">
        <div class="quoted-message-header">
          <span class="material-icons">format_quote</span>
          <span class="quoted-message-sender">${
            msg.quotedMessage.user || (msg.quotedMessage.user as any)?.username
          }</span>
        </div>
        <div class="quoted-message-content">${msg.quotedMessage.content}</div>
      </div>
      `
          : ''
      }
      <div class="message-reactions"></div>
    </div>
  `;
}

/**
 * Sadece mesaj içeriğini render eder (header olmadan).
 * Bu durumda mesajın solunda hover ile gösterilecek saat bilgisi için .hover-time elementi eklenir.
 * @param msg - Mesaj objesi
 * @param msgClass - Mesaj sınıfı
 * @param timestamp - Timestamp
 * @returns Mesaj HTML'i
 */
function renderContentOnly(msg: Message, msgClass: string, timestamp: string | Date): string {
  const isCurrentUser =
    msg.user?.username === (window as any).username || msg.username === (window as any).username;
  const messageId = msg._id || msg.id || '';
  const isEdited = msg.isEdited ? '<span class="edited-indicator"> (düzenlendi)</span>' : '';

  return `
    <div class="message-item" style="position: relative;">
      <span class="hover-time">${formatTime(timestamp)}</span>
      <div class="message-content ${msgClass}">${msg.content}${isEdited}</div>
      ${
        msg.quotedMessage
          ? `
      <div class="quoted-message" data-quoted-message-id="${
        msg.quotedMessage.id || msg.quotedMessage._id
      }">
        <div class="quoted-message-header">
          <span class="material-icons">format_quote</span>
          <span class="quoted-message-sender">${
            msg.quotedMessage.user || (msg.quotedMessage.user as any)?.username
          }</span>
        </div>
        <div class="quoted-message-content">${msg.quotedMessage.content}</div>
      </div>
      `
          : ''
      }
      <div class="message-reactions"></div>
      ${
        isCurrentUser
          ? `
      <div class="message-actions">
        <button class="message-action-btn edit-message-btn" title="Düzenle">
          <span class="material-icons">edit</span>
        </button>
        <button class="message-action-btn delete-message-btn" title="Sil">
          <span class="material-icons">delete</span>
        </button>
        <button class="message-action-btn add-reaction-btn" title="Tepki Ekle">
          <span class="material-icons">add_reaction</span>
        </button>
        <button class="message-action-btn quote-message-btn" title="Alıntıla">
          <span class="material-icons">format_quote</span>
        </button>
        <button class="message-action-btn pin-message-btn" title="Sabitle">
          <span class="material-icons">push_pin</span>
        </button>
      </div>
      `
          : `
      <div class="message-actions">
        <button class="message-action-btn add-reaction-btn" title="Tepki Ekle">
          <span class="material-icons">add_reaction</span>
        </button>
        <button class="message-action-btn quote-message-btn" title="Alıntıla">
          <span class="material-icons">format_quote</span>
        </button>
      </div>
      `
      }
    </div>
  `;
}

/**
 * Verilen mesaj listesini container içerisine render eder.
 * Mesajlar arasında gün farkı varsa her defasında ilgili tarih ayıracını ekler.
 * @param messages - Mesaj listesi
 * @param container - Mesaj container'i
 */
function renderTextMessages(messages: Message[], container: HTMLElement): void {
  container.innerHTML = '';
  let previousDate: Date | null = null;
  messages.forEach((msg, index) => {
    const sender = msg.user && msg.user.username ? msg.user.username : 'Anon';
    const msgDate = new Date(msg.timestamp);
    const fullTime = formatTimestamp(msg.timestamp);
    let msgClass = '';

    // Eğer önceki mesaj yoksa veya gün farkı varsa, tarih ayıracını ekle.
    if (!previousDate || isDifferentDay(previousDate, msgDate)) {
      insertDateSeparator(container, msg.timestamp);
    }
    previousDate = msgDate;

    // Blok sınıflandırması:
    if (
      index === 0 ||
      (messages[index - 1]?.user?.username) !== sender ||
      isDifferentDay(messages[index - 1]?.timestamp || '', msg.timestamp)
    ) {
      if (
        index === messages.length - 1 ||
        (messages[index + 1]?.user?.username) !== sender ||
        isDifferentDay(msg.timestamp, messages[index + 1]?.timestamp || '')
      ) {
        msgClass = 'only-message';
      } else {
        msgClass = 'first-message';
      }
    } else if (
      index === messages.length - 1 ||
      (messages[index + 1]?.user?.username) !== sender ||
      isDifferentDay(msg.timestamp, messages[index + 1]?.timestamp || '')
    ) {
      msgClass = 'last-message';
    } else {
      msgClass = 'middle-message';
    }

    let msgHTML = '';
    if (msgClass === 'only-message' || msgClass === 'first-message') {
      msgHTML = renderFullMessage(msg, sender, fullTime, msgClass);
    } else {
      msgHTML = renderContentOnly(msg, msgClass, msg.timestamp);
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `text-message ${msgClass}`;
    msgDiv.setAttribute('data-timestamp', new Date(msg.timestamp).toISOString());
    msgDiv.setAttribute('data-sender', sender);
    msgDiv.setAttribute('data-message-id', msg._id || msg.id || '');
    msgDiv.innerHTML = msgHTML;
    container.appendChild(msgDiv);

    // Global lastMessageInfo güncellemesi (append işlemleri için)
    lastMessageInfo[container.dataset['channelId'] || ''] = {
      sender,
      timestamp: new Date(msg.timestamp),
      count: 1,
    };
  });
  container.scrollTop = container.scrollHeight;
}

/**
 * Her yeni mesaj gönderildiğinde, eğer son gönderilen mesaj aynı gün ve aynı göndericiden ise,
 * o mesajın dış kapsayıcısı (.text-message) ve içeriği (.message-content) "middle-message" olarak güncellenecek,
 * ve yeni mesaj "last-message" olarak eklenecek.
 * Eğer ardışık mesaj yoksa yeni mesaj "only-message" olarak eklenir.
 * @param msg - Mesaj objesi
 * @param container - Mesaj container'i
 */
function appendNewMessage(msg: Message, container: HTMLElement): void {
  const sender = msg.username || 'Anon';
  const fullTime = formatTimestamp(msg.timestamp);
  let newMsgClass = 'last-message'; // varsayılan

  // Son eklenen metin mesajı (date separator hariç) alınıyor.
  const messages = container.querySelectorAll('.text-message');
  const lastMsgElem = messages.length > 0 ? messages[messages.length - 1] : null;

  if (lastMsgElem && lastMsgElem.getAttribute('data-sender') === sender) {
    const lastTimestamp = new Date(lastMsgElem.getAttribute('data-timestamp') || '');
    if (!isDifferentDay(lastTimestamp, msg.timestamp)) {
      // Hem dış kapsayıcıyı hem de iç message-content öğesini "middle-message" olarak güncelle
      lastMsgElem.classList.remove(
        'only-message',
        'first-message',
        'middle-message',
        'last-message'
      );
      lastMsgElem.classList.add('middle-message');
      const lastContent = lastMsgElem.querySelector('.message-content');
      if (lastContent) {
        lastContent.classList.remove(
          'only-message',
          'first-message',
          'middle-message',
          'last-message'
        );
        lastContent.classList.add('middle-message');
      }
      newMsgClass = 'last-message';
    } else {
      newMsgClass = 'only-message';
    }
  } else {
    newMsgClass = 'only-message';
  }

  // Yeni mesajı oluştur:
  let msgHTML = '';
  if (newMsgClass === 'only-message') {
    msgHTML = renderFullMessage(msg, sender, fullTime, newMsgClass);
  } else {
    msgHTML = renderContentOnly(msg, newMsgClass, msg.timestamp);
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = `text-message ${newMsgClass}`;
  msgDiv.setAttribute('data-timestamp', new Date(msg.timestamp).toISOString());
  msgDiv.setAttribute('data-sender', sender);
  msgDiv.setAttribute('data-message-id', msg._id || msg.id || '');
  msgDiv.innerHTML = msgHTML;
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  // Son mesaj bilgilerini güncelle (DOM üzerinden güncelleme yapılıyor)
  lastMessageInfo[container.dataset['channelId'] || ''] = {
    sender,
    timestamp: new Date(msg.timestamp),
  };
}

/**
 * Yeni gelen mesajı, mevcut mesaj listesine eklerken tarih ayıracı kontrolünü yapar.
 * @param socket - Socket.io socket
 * @param container - Mesaj container'i
 */
function initTextChannelEvents(socket: Socket, container: HTMLElement): void {
  socket.on('textHistory', (messages: Message[]) => {
    renderTextMessages(messages, container);
  });

  socket.on('newTextMessage', (data: { channelId: string; message: Message }) => {
    if (data.channelId === container.dataset['channelId']) {
      const msg = data.message;
      // Tarih ayıracı kontrolü:
      const lastElement = container.lastElementChild;
      let lastTimestamp = null;
      if (lastElement && lastElement.classList.contains('date-separator')) {
        lastTimestamp = lastElement.getAttribute('data-timestamp');
      } else {
        let lastMsgElem = container.lastElementChild;
        while (lastMsgElem && lastMsgElem.classList.contains('date-separator')) {
          lastMsgElem = lastMsgElem.previousElementSibling;
        }
        if (lastMsgElem) {
          lastTimestamp = lastMsgElem.getAttribute('data-timestamp');
        }
      }
      if (!lastTimestamp || isDifferentDay(lastTimestamp, msg.timestamp)) {
        insertDateSeparator(container, msg.timestamp);
      }
      appendNewMessage(msg, container);
    }
  });
}

export {
  isDifferentDay,
  formatTimestamp,
  formatLongDate,
  insertDateSeparator,
  renderTextMessages,
  initTextChannelEvents,
  appendNewMessage,
};
