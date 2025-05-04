/**
 * public/src/ts/userStatus.ts
 * Kullanıcı durumu modülü
 * Kullanıcıların çevrimiçi/çevrimdışı durumlarını yönetir
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Durum türleri
enum StatusType {
  ONLINE = 'online',
  IDLE = 'idle',
  DND = 'dnd', // Do Not Disturb (Rahatsız Etmeyin)
  INVISIBLE = 'invisible',
}

// Durum simgeleri
const STATUS_ICONS: Record<StatusType, string> = {
  [StatusType.ONLINE]: 'circle',
  [StatusType.IDLE]: 'access_time',
  [StatusType.DND]: 'remove_circle',
  [StatusType.INVISIBLE]: 'visibility_off',
};

// Durum renkleri
const STATUS_COLORS: Record<StatusType, string> = {
  [StatusType.ONLINE]: '#43b581',
  [StatusType.IDLE]: '#faa61a',
  [StatusType.DND]: '#f04747',
  [StatusType.INVISIBLE]: '#747f8d',
};

// Durum açıklamaları
const STATUS_DESCRIPTIONS: Record<StatusType, string> = {
  [StatusType.ONLINE]: 'Çevrimiçi',
  [StatusType.IDLE]: 'Boşta',
  [StatusType.DND]: 'Rahatsız Etmeyin',
  [StatusType.INVISIBLE]: 'Çevrimdışı Görün',
};

// Durum değişikliği verisi arayüzü
interface StatusChangeData {
  username: string;
  status: StatusType;
  customMessage?: string;
}

// Mevcut kullanıcı durumu
let currentStatus: StatusType = StatusType.ONLINE;
let customStatusMessage = '';

// Socket.io socket referansı
let socketRef: Socket | null = null;

// AFK (Away From Keyboard) zamanlayıcısı
let idleTimer: number | null = null;
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 dakika

/**
 * Kullanıcı durumu sistemini başlatır
 * @param socket - Socket.io socket
 */
export function initUserStatus(socket: Socket): void {
  // Socket referansını sakla
  socketRef = socket;

  // Kullanıcı paneline durum seçici ekle
  addStatusSelectorToUserPanel();

  // Kullanıcı listesine durum göstergeleri ekle
  addStatusIndicatorsToUserList();

  // Durum değişikliklerini dinle
  socket.on('userStatusChanged', handleUserStatusChange);

  // Sayfa görünürlüğünü dinle (kullanıcı sekmeyi değiştirdiğinde)
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Kullanıcı etkinliğini dinle (AFK durumu için)
  document.addEventListener('mousemove', resetIdleTimer);
  document.addEventListener('keydown', resetIdleTimer);

  // İlk durum ayarını gönder
  updateUserStatus(currentStatus, customStatusMessage);
}

/**
 * Kullanıcı paneline durum seçici ekler
 */
function addStatusSelectorToUserPanel(): void {
  const userPanelInfo = document.querySelector('.user-panel-info');
  if (!userPanelInfo) {
    return;
  }

  // Mevcut durum göstergesi
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'user-status-indicator';
  statusIndicator.innerHTML = `
    <span class="status-dot ${currentStatus}"></span>
    <span class="status-text">${STATUS_DESCRIPTIONS[currentStatus]}</span>
    <span class="material-icons status-dropdown-icon">expand_more</span>
  `;

  // Durum menüsü
  const statusMenu = document.createElement('div');
  statusMenu.className = 'status-menu';
  statusMenu.style.display = 'none';

  // Durum seçenekleri
  Object.values(StatusType).forEach(status => {
    const statusOption = document.createElement('div');
    statusOption.className = 'status-option';
    statusOption.innerHTML = `
      <span class="status-dot ${status}"></span>
      <span class="status-text">${STATUS_DESCRIPTIONS[status]}</span>
    `;

    statusOption.addEventListener('click', () => {
      setUserStatus(status);
      statusMenu.style.display = 'none';
    });

    statusMenu.appendChild(statusOption);
  });

  // Özel durum mesajı girişi
  const customStatusInput = document.createElement('div');
  customStatusInput.className = 'custom-status-input';
  customStatusInput.innerHTML = `
    <input type="text" placeholder="Özel durum mesajı..." maxlength="50">
    <button class="set-custom-status-btn">Ayarla</button>
  `;

  const input = customStatusInput.querySelector('input') as HTMLInputElement;
  const button = customStatusInput.querySelector('button');

  if (button) {
    button.addEventListener('click', () => {
      const message = input.value.trim();
      customStatusMessage = message;
      updateUserStatus(currentStatus, customStatusMessage);
      statusMenu.style.display = 'none';
    });
  }

  statusMenu.appendChild(customStatusInput);

  // Durum göstergesine tıklama olayı
  statusIndicator.addEventListener('click', e => {
    e.stopPropagation();

    if (statusMenu.style.display === 'none') {
      statusMenu.style.display = 'block';

      // Mevcut özel durum mesajını göster
      input.value = customStatusMessage;

      // Dışarı tıklandığında menüyü kapat
      const closeMenu = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!statusMenu.contains(target) && !statusIndicator.contains(target)) {
          statusMenu.style.display = 'none';
          document.removeEventListener('click', closeMenu);
        }
      };

      document.addEventListener('click', closeMenu);
    } else {
      statusMenu.style.display = 'none';
    }
  });

  // Kullanıcı paneline ekle
  userPanelInfo.appendChild(statusIndicator);
  userPanelInfo.appendChild(statusMenu);
}

/**
 * Kullanıcı listesine durum göstergeleri ekler
 */
function addStatusIndicatorsToUserList(): void {
  // Kullanıcı listesi yüklendiğinde durum göstergeleri ekle
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'childList') {
        const userItems = document.querySelectorAll('.user-item');
        userItems.forEach(userItem => {
          // Durum göstergesi zaten varsa ekleme
          if (userItem.querySelector('.user-status-dot')) {
            return;
          }

          const username = userItem.getAttribute('data-username');
          if (!username) {
            return;
          }

          // Durum göstergesi oluştur
          const statusDot = document.createElement('span');
          statusDot.className = 'user-status-dot online';
          statusDot.setAttribute('data-username', username);

          // Kullanıcı öğesine ekle
          userItem.appendChild(statusDot);
        });
      }
    });
  });

  // Kullanıcı listesini izle
  const userList = document.getElementById('userList');
  if (userList) {
    observer.observe(userList, { childList: true, subtree: true });
  }
}

/**
 * Kullanıcı durumunu ayarlar
 * @param status - Durum türü
 */
function setUserStatus(status: StatusType): void {
  currentStatus = status;
  updateUserStatus(status, customStatusMessage);

  // Durum göstergesini güncelle
  const statusIndicator = document.querySelector('.user-status-indicator');
  if (statusIndicator) {
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    if (statusDot) {
      // Tüm durum sınıflarını kaldır
      Object.values(StatusType).forEach(type => {
        statusDot.classList.remove(type);
      });

      // Yeni durum sınıfını ekle
      statusDot.classList.add(status);
    }

    if (statusText) {
      statusText.textContent = STATUS_DESCRIPTIONS[status];
    }
  }
}

/**
 * Kullanıcı durumunu sunucuya gönderir
 * @param status - Durum türü
 * @param customMessage - Özel durum mesajı
 */
function updateUserStatus(status: StatusType, customMessage: string): void {
  // Önce socketRef'i kontrol et, yoksa window.socket'i dene
  if (socketRef) {
    socketRef.emit('updateUserStatus', {
      status,
      customMessage,
    });
  } else if ((window as any).socket) {
    (window as any).socket.emit('updateUserStatus', {
      status,
      customMessage,
    });
  } else {
    console.error('Socket bağlantısı bulunamadı. Kullanıcı durumu güncellenemiyor.');
  }
}

/**
 * Diğer kullanıcıların durum değişikliklerini işler
 * @param data - Durum değişikliği verileri
 */
function handleUserStatusChange(data: StatusChangeData): void {
  const { username, status, customMessage } = data;

  // Kullanıcı listesindeki durum göstergesini güncelle
  const statusDots = document.querySelectorAll(`.user-status-dot[data-username="${username}"]`);

  statusDots.forEach(dot => {
    // Tüm durum sınıflarını kaldır
    Object.values(StatusType).forEach(type => {
      dot.classList.remove(type);
    });

    // Yeni durum sınıfını ekle
    dot.classList.add(status);

    // Özel durum mesajını tooltip olarak ekle
    if (customMessage) {
      dot.setAttribute('title', customMessage);
    } else {
      dot.setAttribute('title', STATUS_DESCRIPTIONS[status]);
    }
  });
}

/**
 * Sayfa görünürlüğü değiştiğinde çalışır
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    // Sayfa arka planda, kullanıcı boşta olarak işaretle
    if (currentStatus === StatusType.ONLINE) {
      setUserStatus(StatusType.IDLE);
    }
  } else {
    // Sayfa tekrar görünür, kullanıcı çevrimiçi olarak işaretle
    if (currentStatus === StatusType.IDLE) {
      setUserStatus(StatusType.ONLINE);
    }
  }
}

/**
 * Boşta kalma zamanlayıcısını sıfırlar
 */
function resetIdleTimer(): void {
  if (idleTimer !== null) {
    window.clearTimeout(idleTimer);
    idleTimer = null;
  }

  // Kullanıcı aktif, çevrimiçi olarak işaretle
  if (currentStatus === StatusType.IDLE) {
    setUserStatus(StatusType.ONLINE);
  }

  // Yeni zamanlayıcı başlat
  idleTimer = window.setTimeout(() => {
    // Kullanıcı boşta, durumunu güncelle
    if (currentStatus === StatusType.ONLINE) {
      setUserStatus(StatusType.IDLE);
    }
  }, IDLE_TIMEOUT);
}

/**
 * Durum simgesini döndürür
 * @param status - Durum türü
 * @returns Material icon adı
 */
export function getStatusIcon(status: StatusType): string {
  return STATUS_ICONS[status] || STATUS_ICONS[StatusType.ONLINE];
}

/**
 * Durum rengini döndürür
 * @param status - Durum türü
 * @returns Renk kodu
 */
export function getStatusColor(status: StatusType): string {
  return STATUS_COLORS[status] || STATUS_COLORS[StatusType.ONLINE];
}

/**
 * Durum açıklamasını döndürür
 * @param status - Durum türü
 * @returns Durum açıklaması
 */
export function getStatusDescription(status: StatusType): string {
  return STATUS_DESCRIPTIONS[status] || STATUS_DESCRIPTIONS[StatusType.ONLINE];
}
