/**
 * public/src/ts/notificationSettings.ts
 * Bildirim ayarları modülü
 * Kullanıcının bildirim tercihlerini yönetir
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Bildirim ayarları arayüzü
interface NotificationSettings {
  notifications: boolean;
  emailNotifications: boolean;
  soundEffects: boolean;
  notificationTypes: {
    directMessages: boolean;
    mentions: boolean;
    friendRequests: boolean;
    groupInvites: boolean;
    channelMessages: boolean;
  };
}

// Bildirim ayarları yanıtı arayüzü
interface NotificationSettingsResponse {
  success: boolean;
  settings?: NotificationSettings;
  message?: string;
}

/**
 * Bildirim ayarları sayfasını başlatır
 * @param socket - Socket.io socket
 */
export function initNotificationSettings(socket: Socket): void {
  // Bildirim ayarları formunu oluştur
  createNotificationSettingsForm();

  // Form gönderme olayı
  document.addEventListener('submit', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'notificationSettingsForm') {
      e.preventDefault();
      saveNotificationSettings(socket);
    }
  });

  // Bildirim ayarlarını yükle
  loadNotificationSettings(socket);
}

/**
 * Bildirim ayarları formunu oluşturur
 */
function createNotificationSettingsForm(): void {
  const settingsContainer = document.getElementById('settingsContainer');
  if (!settingsContainer) {
    return;
  }

  const notificationSettingsHTML = `
    <div class="settings-section">
      <h2 class="settings-section-title">Bildirim Ayarları</h2>
      
      <form id="notificationSettingsForm">
        <div class="notification-settings">
          <div class="notification-settings-group">
            <div class="notification-settings-group-title">Genel Bildirim Ayarları</div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Bildirimleri Etkinleştir</div>
              <div class="toggle-switch">
                <input type="checkbox" id="notifications" name="notifications">
                <label for="notifications"></label>
              </div>
            </div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">E-posta Bildirimleri</div>
              <div class="toggle-switch">
                <input type="checkbox" id="emailNotifications" name="emailNotifications">
                <label for="emailNotifications"></label>
              </div>
            </div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Ses Efektleri</div>
              <div class="toggle-switch">
                <input type="checkbox" id="soundEffects" name="soundEffects">
                <label for="soundEffects"></label>
              </div>
            </div>
          </div>
          
          <div class="notification-settings-group">
            <div class="notification-settings-group-title">Bildirim Türleri</div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Doğrudan Mesajlar</div>
              <div class="toggle-switch">
                <input type="checkbox" id="directMessages" name="notificationTypes.directMessages">
                <label for="directMessages"></label>
              </div>
            </div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Bahsetmeler (@mentions)</div>
              <div class="toggle-switch">
                <input type="checkbox" id="mentions" name="notificationTypes.mentions">
                <label for="mentions"></label>
              </div>
            </div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Arkadaşlık İstekleri</div>
              <div class="toggle-switch">
                <input type="checkbox" id="friendRequests" name="notificationTypes.friendRequests">
                <label for="friendRequests"></label>
              </div>
            </div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Grup Davetleri</div>
              <div class="toggle-switch">
                <input type="checkbox" id="groupInvites" name="notificationTypes.groupInvites">
                <label for="groupInvites"></label>
              </div>
            </div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Kanal Mesajları</div>
              <div class="toggle-switch">
                <input type="checkbox" id="channelMessages" name="notificationTypes.channelMessages">
                <label for="channelMessages"></label>
              </div>
            </div>
          </div>
          
          <div class="notification-settings-group">
            <div class="notification-settings-group-title">Tarayıcı Bildirimleri</div>
            
            <div class="notification-setting-item">
              <div class="notification-setting-label">Tarayıcı Bildirimleri</div>
              <button type="button" id="enableNotificationsBtn">Bildirimleri Etkinleştir</button>
            </div>
          </div>
        </div>
        
        <div class="settings-actions">
          <button type="submit" class="btn primary">Kaydet</button>
        </div>
      </form>
    </div>
  `;

  // Ayarlar sayfasına bildirim ayarlarını ekle
  settingsContainer.innerHTML += notificationSettingsHTML;

  // Tarayıcı bildirim düğmesi olayı
  setTimeout(() => {
    const enableNotificationsBtn = document.getElementById('enableNotificationsBtn');
    if (enableNotificationsBtn) {
      enableNotificationsBtn.addEventListener('click', requestNotificationPermission);
    }
  }, 0);
}

/**
 * Bildirim ayarlarını yükler
 * @param socket - Socket.io socket
 */
function loadNotificationSettings(socket: Socket): void {
  socket.emit('getNotificationSettings', (response: NotificationSettingsResponse) => {
    if (response.success && response.settings) {
      const settings = response.settings;

      // Genel ayarlar
      const notifications = document.getElementById('notifications') as HTMLInputElement;
      const emailNotifications = document.getElementById('emailNotifications') as HTMLInputElement;
      const soundEffects = document.getElementById('soundEffects') as HTMLInputElement;

      if (notifications) {
        notifications.checked = settings.notifications !== false;
      }
      if (emailNotifications) {
        emailNotifications.checked = settings.emailNotifications !== false;
      }
      if (soundEffects) {
        soundEffects.checked = settings.soundEffects !== false;
      }

      // Bildirim türleri
      if (settings.notificationTypes) {
        const directMessages = document.getElementById('directMessages') as HTMLInputElement;
        const mentions = document.getElementById('mentions') as HTMLInputElement;
        const friendRequests = document.getElementById('friendRequests') as HTMLInputElement;
        const groupInvites = document.getElementById('groupInvites') as HTMLInputElement;
        const channelMessages = document.getElementById('channelMessages') as HTMLInputElement;

        if (directMessages) {
          directMessages.checked = settings.notificationTypes.directMessages !== false;
        }
        if (mentions) {
          mentions.checked = settings.notificationTypes.mentions !== false;
        }
        if (friendRequests) {
          friendRequests.checked = settings.notificationTypes.friendRequests !== false;
        }
        if (groupInvites) {
          groupInvites.checked = settings.notificationTypes.groupInvites !== false;
        }
        if (channelMessages) {
          channelMessages.checked = settings.notificationTypes.channelMessages === true;
        }
      }

      // Tarayıcı bildirim durumunu güncelle
      updateBrowserNotificationStatus();
    } else {
      console.error('Bildirim ayarları yükleme hatası:', response.message);
    }
  });
}

/**
 * Bildirim ayarlarını kaydeder
 * @param socket - Socket.io socket
 */
function saveNotificationSettings(socket: Socket): void {
  const form = document.getElementById('notificationSettingsForm');
  if (!form) {
    return;
  }

  // Form verilerini topla
  const notifications = document.getElementById('notifications') as HTMLInputElement;
  const emailNotifications = document.getElementById('emailNotifications') as HTMLInputElement;
  const soundEffects = document.getElementById('soundEffects') as HTMLInputElement;
  const directMessages = document.getElementById('directMessages') as HTMLInputElement;
  const mentions = document.getElementById('mentions') as HTMLInputElement;
  const friendRequests = document.getElementById('friendRequests') as HTMLInputElement;
  const groupInvites = document.getElementById('groupInvites') as HTMLInputElement;
  const channelMessages = document.getElementById('channelMessages') as HTMLInputElement;

  if (
    !notifications ||
    !emailNotifications ||
    !soundEffects ||
    !directMessages ||
    !mentions ||
    !friendRequests ||
    !groupInvites ||
    !channelMessages
  ) {
    return;
  }

  const settings: NotificationSettings = {
    notifications: notifications.checked,
    emailNotifications: emailNotifications.checked,
    soundEffects: soundEffects.checked,
    notificationTypes: {
      directMessages: directMessages.checked,
      mentions: mentions.checked,
      friendRequests: friendRequests.checked,
      groupInvites: groupInvites.checked,
      channelMessages: channelMessages.checked,
    },
  };

  // Ayarları sunucuya gönder
  socket.emit(
    'updateNotificationSettings',
    settings,
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        // Başarı bildirimi göster
        showToast('Bildirim ayarları kaydedildi', 'success');

        // Bildirim ayarları değişikliği olayını tetikle
        document.dispatchEvent(
          new CustomEvent('notificationSettingsChanged', {
            detail: settings,
          })
        );

        // Yerel depolama güncelle
        localStorage.setItem('soundEffects', String(settings.soundEffects));
        localStorage.setItem('notifications', String(settings.notifications));
      } else {
        // Hata bildirimi göster
        showToast(
          'Bildirim ayarları kaydedilemedi: ' + (response.message || 'Bilinmeyen hata'),
          'error'
        );
      }
    }
  );
}

/**
 * Tarayıcı bildirim izni ister
 */
function requestNotificationPermission(): void {
  if (!('Notification' in window)) {
    showToast('Tarayıcınız bildirimleri desteklemiyor', 'error');
    return;
  }

  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      showToast('Bildirim izni verildi', 'success');
      updateBrowserNotificationStatus();
    } else {
      showToast('Bildirim izni reddedildi', 'error');
      updateBrowserNotificationStatus();
    }
  });
}

/**
 * Tarayıcı bildirim durumunu günceller
 */
function updateBrowserNotificationStatus(): void {
  const button = document.getElementById('enableNotificationsBtn');
  if (!button) {
    return;
  }

  if (!('Notification' in window)) {
    button.textContent = 'Tarayıcınız Desteklemiyor';
    button.setAttribute('disabled', 'disabled');
    return;
  }

  if (Notification.permission === 'granted') {
    button.textContent = 'Bildirimler Etkin';
    button.classList.add('enabled');
  } else if (Notification.permission === 'denied') {
    button.textContent = 'Bildirimler Engellendi';
    button.setAttribute('disabled', 'disabled');
  } else {
    button.textContent = 'Bildirimleri Etkinleştir';
    button.classList.remove('enabled');
    button.removeAttribute('disabled');
  }
}

/**
 * Toast bildirimi gösterir
 * @param message - Bildirim mesajı
 * @param type - Bildirim türü
 */
function showToast(message: string, type: string): void {
  // feedback.js modülündeki showToast fonksiyonunu çağır
  if ((window as any).feedback && (window as any).feedback.showToast) {
    (window as any).feedback.showToast(message, { type });
  } else {
    // Fallback: Basit bir alert göster
    alert(message);
  }
}
