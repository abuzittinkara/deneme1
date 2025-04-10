// public/js/userStatus.js

/**
 * Kullanıcı durumu modülü
 * Kullanıcıların çevrimiçi/çevrimdışı durumlarını yönetir
 */

// Durum türleri
const STATUS_TYPES = {
  ONLINE: 'online',
  IDLE: 'idle',
  DND: 'dnd',      // Do Not Disturb (Rahatsız Etmeyin)
  INVISIBLE: 'invisible'
};

// Durum simgeleri
const STATUS_ICONS = {
  [STATUS_TYPES.ONLINE]: 'circle',
  [STATUS_TYPES.IDLE]: 'access_time',
  [STATUS_TYPES.DND]: 'remove_circle',
  [STATUS_TYPES.INVISIBLE]: 'visibility_off'
};

// Durum renkleri
const STATUS_COLORS = {
  [STATUS_TYPES.ONLINE]: '#43b581',
  [STATUS_TYPES.IDLE]: '#faa61a',
  [STATUS_TYPES.DND]: '#f04747',
  [STATUS_TYPES.INVISIBLE]: '#747f8d'
};

// Durum açıklamaları
const STATUS_DESCRIPTIONS = {
  [STATUS_TYPES.ONLINE]: 'Çevrimiçi',
  [STATUS_TYPES.IDLE]: 'Boşta',
  [STATUS_TYPES.DND]: 'Rahatsız Etmeyin',
  [STATUS_TYPES.INVISIBLE]: 'Çevrimdışı Görün'
};

// Mevcut kullanıcı durumu
let currentStatus = STATUS_TYPES.ONLINE;
let customStatusMessage = '';

// Socket.io socket referansı
let socketRef = null;

/**
 * Kullanıcı durumu sistemini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initUserStatus(socket) {
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
function addStatusSelectorToUserPanel() {
  const userPanelInfo = document.querySelector('.user-panel-info');
  if (!userPanelInfo) return;

  // Mevcut durum göstergesi
  const statusIndicator = document.createElement('div');
  statusIndicator.className = 'user-status-indicator';
  statusIndicator.innerHTML = `
    <span class="status-dot ${currentStatus}"></span>
    <span class="status-text">${STATUS_DESCRIPTIONS[currentStatus]}</span>
    <span class="material-icons status-dropdown-icon">expand_more</span>
  `;

  // Durum seçici menüsü
  const statusMenu = document.createElement('div');
  statusMenu.className = 'status-menu';
  statusMenu.style.display = 'none';

  // Durum seçenekleri
  Object.keys(STATUS_TYPES).forEach(statusKey => {
    const statusType = STATUS_TYPES[statusKey];
    const statusOption = document.createElement('div');
    statusOption.className = 'status-option';
    statusOption.dataset.status = statusType;

    statusOption.innerHTML = `
      <span class="status-dot ${statusType}"></span>
      <span class="status-option-text">${STATUS_DESCRIPTIONS[statusType]}</span>
    `;

    statusOption.addEventListener('click', () => {
      setUserStatus(statusType);
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

  const input = customStatusInput.querySelector('input');
  const button = customStatusInput.querySelector('button');

  button.addEventListener('click', () => {
    const message = input.value.trim();
    customStatusMessage = message;
    updateUserStatus(currentStatus, customStatusMessage);
    statusMenu.style.display = 'none';
  });

  statusMenu.appendChild(customStatusInput);

  // Durum göstergesine tıklama olayı
  statusIndicator.addEventListener('click', (e) => {
    e.stopPropagation();

    if (statusMenu.style.display === 'none') {
      statusMenu.style.display = 'block';

      // Mevcut özel durum mesajını göster
      input.value = customStatusMessage;

      // Dışarı tıklandığında menüyü kapat
      const closeMenu = (event) => {
        if (!statusMenu.contains(event.target) && !statusIndicator.contains(event.target)) {
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
function addStatusIndicatorsToUserList() {
  // Kullanıcı listesi oluşturulduğunda durum göstergeleri ekle
  document.addEventListener('userListRendered', () => {
    const userItems = document.querySelectorAll('.user-item');

    userItems.forEach(userItem => {
      const username = userItem.dataset.username;
      if (!username) return;

      // Durum göstergesi zaten var mı kontrol et
      if (userItem.querySelector('.user-status-dot')) return;

      // Durum göstergesi ekle
      const statusDot = document.createElement('span');
      statusDot.className = 'user-status-dot online'; // Varsayılan olarak çevrimiçi
      statusDot.dataset.username = username;

      // Kullanıcı adının yanına ekle
      const userInfo = userItem.querySelector('.user-info');
      if (userInfo) {
        userInfo.insertBefore(statusDot, userInfo.firstChild);
      }
    });
  });
}

/**
 * Kullanıcı durumunu ayarlar
 * @param {string} status - Durum türü
 */
function setUserStatus(status) {
  if (!Object.values(STATUS_TYPES).includes(status)) {
    console.error('Geçersiz durum türü:', status);
    return;
  }

  currentStatus = status;
  updateUserStatus(status, customStatusMessage);

  // Durum göstergesini güncelle
  const statusIndicator = document.querySelector('.user-status-indicator');
  if (statusIndicator) {
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    if (statusDot) {
      // Tüm durum sınıflarını kaldır
      Object.values(STATUS_TYPES).forEach(type => {
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
 * @param {string} status - Durum türü
 * @param {string} customMessage - Özel durum mesajı
 */
function updateUserStatus(status, customMessage) {
  // Önce socketRef'i kontrol et, yoksa window.socket'i dene
  if (socketRef) {
    socketRef.emit('updateUserStatus', {
      status,
      customMessage
    });
  } else if (window.socket) {
    window.socket.emit('updateUserStatus', {
      status,
      customMessage
    });
  } else {
    console.error('Socket bağlantısı bulunamadı. Kullanıcı durumu güncellenemiyor.');
  }
}

/**
 * Diğer kullanıcıların durum değişikliklerini işler
 * @param {Object} data - Durum değişikliği verileri
 */
function handleUserStatusChange(data) {
  const { username, status, customMessage } = data;

  // Kullanıcı listesindeki durum göstergesini güncelle
  const statusDots = document.querySelectorAll(`.user-status-dot[data-username="${username}"]`);

  statusDots.forEach(dot => {
    // Tüm durum sınıflarını kaldır
    Object.values(STATUS_TYPES).forEach(type => {
      dot.classList.remove(type);
    });

    // Yeni durum sınıfını ekle
    dot.classList.add(status);

    // Özel durum mesajını tooltip olarak ekle
    if (customMessage) {
      dot.title = customMessage;
    } else {
      dot.title = STATUS_DESCRIPTIONS[status];
    }
  });
}

/**
 * Sayfa görünürlüğü değiştiğinde çalışır
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Sayfa arka planda, kullanıcı boşta olarak işaretle
    if (currentStatus === STATUS_TYPES.ONLINE) {
      setUserStatus(STATUS_TYPES.IDLE);
    }
  } else {
    // Sayfa tekrar görünür, kullanıcı çevrimiçi olarak işaretle
    if (currentStatus === STATUS_TYPES.IDLE) {
      setUserStatus(STATUS_TYPES.ONLINE);
    }
  }
}

// AFK (Away From Keyboard) zamanlayıcısı
let idleTimer;
const IDLE_TIMEOUT = 5 * 60 * 1000; // 5 dakika

/**
 * Boşta kalma zamanlayıcısını sıfırlar
 */
function resetIdleTimer() {
  clearTimeout(idleTimer);

  // Kullanıcı aktif, çevrimiçi olarak işaretle
  if (currentStatus === STATUS_TYPES.IDLE) {
    setUserStatus(STATUS_TYPES.ONLINE);
  }

  // Yeni zamanlayıcı başlat
  idleTimer = setTimeout(() => {
    // Kullanıcı boşta, durumunu güncelle
    if (currentStatus === STATUS_TYPES.ONLINE) {
      setUserStatus(STATUS_TYPES.IDLE);
    }
  }, IDLE_TIMEOUT);
}

/**
 * Durum simgesini döndürür
 * @param {string} status - Durum türü
 * @returns {string} - Material icon adı
 */
export function getStatusIcon(status) {
  return STATUS_ICONS[status] || STATUS_ICONS[STATUS_TYPES.ONLINE];
}

/**
 * Durum rengini döndürür
 * @param {string} status - Durum türü
 * @returns {string} - Renk kodu
 */
export function getStatusColor(status) {
  return STATUS_COLORS[status] || STATUS_COLORS[STATUS_TYPES.ONLINE];
}

/**
 * Durum açıklamasını döndürür
 * @param {string} status - Durum türü
 * @returns {string} - Durum açıklaması
 */
export function getStatusDescription(status) {
  return STATUS_DESCRIPTIONS[status] || STATUS_DESCRIPTIONS[STATUS_TYPES.ONLINE];
}
