// public/js/notificationSettings.js

/**
 * Bildirim ayarları modülü
 * Kullanıcının bildirim tercihlerini yönetir
 */

/**
 * Bildirim ayarları sayfasını başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initNotificationSettings(socket) {
  // Bildirim ayarları formunu oluştur
  createNotificationSettingsForm();
  
  // Form gönderme olayı
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'notificationSettingsForm') {
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
function createNotificationSettingsForm() {
  const settingsContainer = document.getElementById('settingsContainer');
  if (!settingsContainer) return;
  
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
}

/**
 * Bildirim ayarlarını yükler
 * @param {Object} socket - Socket.io socket
 */
function loadNotificationSettings(socket) {
  socket.emit('getNotificationSettings', (response) => {
    if (response.success) {
      const settings = response.settings;
      
      // Genel ayarlar
      document.getElementById('notifications').checked = settings.notifications !== false;
      document.getElementById('emailNotifications').checked = settings.emailNotifications !== false;
      document.getElementById('soundEffects').checked = settings.soundEffects !== false;
      
      // Bildirim türleri
      if (settings.notificationTypes) {
        document.getElementById('directMessages').checked = settings.notificationTypes.directMessages !== false;
        document.getElementById('mentions').checked = settings.notificationTypes.mentions !== false;
        document.getElementById('friendRequests').checked = settings.notificationTypes.friendRequests !== false;
        document.getElementById('groupInvites').checked = settings.notificationTypes.groupInvites !== false;
        document.getElementById('channelMessages').checked = settings.notificationTypes.channelMessages === true;
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
 * @param {Object} socket - Socket.io socket
 */
function saveNotificationSettings(socket) {
  const form = document.getElementById('notificationSettingsForm');
  if (!form) return;
  
  // Form verilerini topla
  const settings = {
    notifications: document.getElementById('notifications').checked,
    emailNotifications: document.getElementById('emailNotifications').checked,
    soundEffects: document.getElementById('soundEffects').checked,
    notificationTypes: {
      directMessages: document.getElementById('directMessages').checked,
      mentions: document.getElementById('mentions').checked,
      friendRequests: document.getElementById('friendRequests').checked,
      groupInvites: document.getElementById('groupInvites').checked,
      channelMessages: document.getElementById('channelMessages').checked
    }
  };
  
  // Ayarları sunucuya gönder
  socket.emit('updateNotificationSettings', settings, (response) => {
    if (response.success) {
      // Başarı bildirimi göster
      showToast('Bildirim ayarları kaydedildi', 'success');
      
      // Bildirim ayarları değişikliği olayını tetikle
      document.dispatchEvent(new CustomEvent('notificationSettingsChanged', {
        detail: settings
      }));
      
      // Yerel depolama güncelle
      localStorage.setItem('soundEffects', settings.soundEffects);
      localStorage.setItem('notifications', settings.notifications);
    } else {
      // Hata bildirimi göster
      showToast('Bildirim ayarları kaydedilemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Tarayıcı bildirim durumunu günceller
 */
function updateBrowserNotificationStatus() {
  const button = document.getElementById('enableNotificationsBtn');
  if (!button) return;
  
  if (!('Notification' in window)) {
    button.textContent = 'Tarayıcınız Desteklemiyor';
    button.disabled = true;
    return;
  }
  
  if (Notification.permission === 'granted') {
    button.textContent = 'Bildirimler Etkin';
    button.classList.add('enabled');
  } else if (Notification.permission === 'denied') {
    button.textContent = 'Bildirimler Engellendi';
    button.disabled = true;
  } else {
    button.textContent = 'Bildirimleri Etkinleştir';
    button.classList.remove('enabled');
  }
}

/**
 * Toast bildirimi gösterir
 * @param {string} message - Bildirim mesajı
 * @param {string} type - Bildirim türü
 */
function showToast(message, type) {
  // notifications.js modülündeki showToast fonksiyonunu çağır
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    // Fallback: Basit bir alert göster
    alert(message);
  }
}
