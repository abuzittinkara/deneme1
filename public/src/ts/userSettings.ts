/**
 * public/src/ts/userSettings.ts
 * Kullanıcı ayarları modülü
 * Kullanıcı tercihlerini ve ayarlarını yönetir
 */

// Socket.io socket arayüzü
import { NotificationSettingsChangedEvent, ThemeSettingsChangedEvent, LanguageSettingsChangedEvent, ToastType } from './types';

interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Kullanıcı tercihleri arayüzü
interface UserPreferences {
  theme: 'dark' | 'light';
  language: string;
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

// Ayarlar yanıtı arayüzü
interface SettingsResponse {
  success: boolean;
  settings?: UserPreferences;
  message?: string;
}

/**
 * Kullanıcı ayarları sistemini başlatır
 * @param socket - Socket.io socket
 */
export function initUserSettings(socket: Socket): void {
  // Ayarlar düğmesine tıklama olayı
  const settingsButton = document.getElementById('settingsButton');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      openSettingsPanel(socket);
    });
  }

  // Ayarlar değişikliği olaylarını dinle
  document.addEventListener('notificationSettingsChanged', (e: NotificationSettingsChangedEvent) => {
    updateNotificationSettings(e, socket);
  });

  document.addEventListener('themeSettingsChanged', (e: ThemeSettingsChangedEvent) => {
    updateThemeSettings(e, socket);
  });

  document.addEventListener('languageSettingsChanged', (e: LanguageSettingsChangedEvent) => {
    updateLanguageSettings(e, socket);
  });
}

/**
 * Ayarlar panelini açar
 * @param socket - Socket.io socket
 */
function openSettingsPanel(socket: Socket): void {
  // Ayarlar paneli zaten varsa kaldır
  const existingPanel = document.getElementById('settingsPanel');
  if (existingPanel) {
    existingPanel.remove();
    return;
  }

  // Ayarlar paneli oluştur
  const settingsPanel = document.createElement('div');
  settingsPanel.id = 'settingsPanel';
  settingsPanel.className = 'settings-panel';

  // Panel başlığı
  const panelHeader = document.createElement('div');
  panelHeader.className = 'settings-panel-header';
  panelHeader.innerHTML = `
    <h2 class="settings-title">Kullanıcı Ayarları</h2>
    <button id="closeSettingsBtn" class="settings-close">
      <span class="material-icons">close</span>
    </button>
  `;

  // Panel içeriği
  const panelContent = document.createElement('div');
  panelContent.className = 'settings-panel-content';

  // Ayarlar bölümleri
  const settingsSections = document.createElement('div');
  settingsSections.className = 'settings-sections';

  // Tema ayarları
  const themeSettings = createThemeSettings(socket);
  settingsSections.appendChild(themeSettings);

  // Dil ayarları
  const languageSettings = createLanguageSettings(socket);
  settingsSections.appendChild(languageSettings);

  // Bildirim ayarları
  const notificationSettings = createNotificationSettings(socket);
  settingsSections.appendChild(notificationSettings);

  // Panel içeriğine bölümleri ekle
  panelContent.appendChild(settingsSections);

  // Panele başlık ve içerik ekle
  settingsPanel.appendChild(panelHeader);
  settingsPanel.appendChild(panelContent);

  // Paneli body'e ekle
  document.body.appendChild(settingsPanel);

  // Kapatma düğmesi olayı
  const closeButton = document.getElementById('closeSettingsBtn');
  if (closeButton) {
    closeButton.addEventListener('click', () => {
      settingsPanel.remove();
    });
  }

  // ESC tuşu ile kapatma
  document.addEventListener('keydown', function escHandler(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      settingsPanel.remove();
      document.removeEventListener('keydown', escHandler);
    }
  });

  // Kullanıcı ayarlarını yükle
  loadUserSettings(socket);
}

/**
 * Tema ayarları bölümünü oluşturur
 * @param socket - Socket.io socket
 * @returns Tema ayarları elementi
 */
function createThemeSettings(socket: Socket): HTMLElement {
  const themeSettings = document.createElement('div');
  themeSettings.className = 'settings-section';
  themeSettings.innerHTML = `
    <h3 class="settings-section-title">Tema Ayarları</h3>

    <div class="settings-option">
      <label for="themeSelect">Tema</label>
      <select id="themeSelect" name="theme">
        <option value="dark">Koyu Tema</option>
        <option value="light">Açık Tema</option>
      </select>
    </div>

    <div class="settings-actions">
      <button id="saveThemeBtn" class="btn primary">Kaydet</button>
    </div>
  `;

  // Tema ayarları yüklendikten sonra kaydetme olayı ekle
  setTimeout(() => {
    const saveButton = themeSettings.querySelector('#saveThemeBtn');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        saveThemeSettings(socket);
      });
    }
  }, 0);

  return themeSettings;
}

/**
 * Dil ayarları bölümünü oluşturur
 * @param socket - Socket.io socket
 * @returns Dil ayarları elementi
 */
function createLanguageSettings(socket: Socket): HTMLElement {
  const languageSettings = document.createElement('div');
  languageSettings.className = 'settings-section';
  languageSettings.innerHTML = `
    <h3 class="settings-section-title">Dil Ayarları</h3>

    <div class="settings-option">
      <label for="languageSelect">Dil</label>
      <select id="languageSelect" name="language">
        <option value="tr">Türkçe</option>
        <option value="en">English</option>
      </select>
    </div>

    <div class="settings-actions">
      <button id="saveLanguageBtn" class="btn primary">Kaydet</button>
    </div>
  `;

  // Dil ayarları yüklendikten sonra kaydetme olayı ekle
  setTimeout(() => {
    const saveButton = languageSettings.querySelector('#saveLanguageBtn');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        saveLanguageSettings(socket);
      });
    }
  }, 0);

  return languageSettings;
}

/**
 * Bildirim ayarları bölümünü oluşturur
 * @param socket - Socket.io socket
 * @returns Bildirim ayarları elementi
 */
function createNotificationSettings(socket: Socket): HTMLElement {
  const notificationSettings = document.createElement('div');
  notificationSettings.className = 'settings-section';
  notificationSettings.innerHTML = `
    <h3 class="settings-section-title">Bildirim Ayarları</h3>

    <div class="settings-option">
      <label for="notificationsToggle">Bildirimleri Etkinleştir</label>
      <div class="toggle-switch">
        <input type="checkbox" id="notificationsToggle" name="notifications">
        <label for="notificationsToggle"></label>
      </div>
    </div>

    <div class="settings-option">
      <label for="emailNotificationsToggle">E-posta Bildirimleri</label>
      <div class="toggle-switch">
        <input type="checkbox" id="emailNotificationsToggle" name="emailNotifications">
        <label for="emailNotificationsToggle"></label>
      </div>
    </div>

    <div class="settings-option">
      <label for="soundEffectsToggle">Ses Efektleri</label>
      <div class="toggle-switch">
        <input type="checkbox" id="soundEffectsToggle" name="soundEffects">
        <label for="soundEffectsToggle"></label>
      </div>
    </div>

    <h4 class="settings-subsection-title">Bildirim Türleri</h4>

    <div class="settings-option">
      <label for="directMessagesToggle">Doğrudan Mesajlar</label>
      <div class="toggle-switch">
        <input type="checkbox" id="directMessagesToggle" name="notificationTypes.directMessages">
        <label for="directMessagesToggle"></label>
      </div>
    </div>

    <div class="settings-option">
      <label for="mentionsToggle">Bahsetmeler (@mentions)</label>
      <div class="toggle-switch">
        <input type="checkbox" id="mentionsToggle" name="notificationTypes.mentions">
        <label for="mentionsToggle"></label>
      </div>
    </div>

    <div class="settings-option">
      <label for="friendRequestsToggle">Arkadaşlık İstekleri</label>
      <div class="toggle-switch">
        <input type="checkbox" id="friendRequestsToggle" name="notificationTypes.friendRequests">
        <label for="friendRequestsToggle"></label>
      </div>
    </div>

    <div class="settings-option">
      <label for="groupInvitesToggle">Grup Davetleri</label>
      <div class="toggle-switch">
        <input type="checkbox" id="groupInvitesToggle" name="notificationTypes.groupInvites">
        <label for="groupInvitesToggle"></label>
      </div>
    </div>

    <div class="settings-option">
      <label for="channelMessagesToggle">Kanal Mesajları</label>
      <div class="toggle-switch">
        <input type="checkbox" id="channelMessagesToggle" name="notificationTypes.channelMessages">
        <label for="channelMessagesToggle"></label>
      </div>
    </div>

    <div class="settings-actions">
      <button id="saveNotificationsBtn" class="btn primary">Kaydet</button>
    </div>
  `;

  // Bildirim ayarları yüklendikten sonra kaydetme olayı ekle
  setTimeout(() => {
    const saveButton = notificationSettings.querySelector('#saveNotificationsBtn');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        saveNotificationSettings(socket);
      });
    }
  }, 0);

  return notificationSettings;
}

/**
 * Kullanıcı ayarlarını yükler
 * @param socket - Socket.io socket
 */
function loadUserSettings(socket: Socket): void {
  socket.emit('getUserSettings', (response: SettingsResponse) => {
    if (response.success && response.settings) {
      const settings = response.settings;

      // Tema ayarları
      const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
      if (themeSelect) {
        themeSelect.value = settings.theme || 'dark';
      }

      // Dil ayarları
      const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
      if (languageSelect) {
        languageSelect.value = settings.language || 'tr';
      }

      // Bildirim ayarları
      const notificationsToggle = document.getElementById(
        'notificationsToggle'
      ) as HTMLInputElement;
      if (notificationsToggle) {
        notificationsToggle.checked = settings.notifications !== false;
      }

      const emailNotificationsToggle = document.getElementById(
        'emailNotificationsToggle'
      ) as HTMLInputElement;
      if (emailNotificationsToggle) {
        emailNotificationsToggle.checked = settings.emailNotifications !== false;
      }

      const soundEffectsToggle = document.getElementById('soundEffectsToggle') as HTMLInputElement;
      if (soundEffectsToggle) {
        soundEffectsToggle.checked = settings.soundEffects !== false;
      }

      // Bildirim türleri
      if (settings.notificationTypes) {
        const directMessagesToggle = document.getElementById(
          'directMessagesToggle'
        ) as HTMLInputElement;
        if (directMessagesToggle) {
          directMessagesToggle.checked = settings.notificationTypes.directMessages !== false;
        }

        const mentionsToggle = document.getElementById('mentionsToggle') as HTMLInputElement;
        if (mentionsToggle) {
          mentionsToggle.checked = settings.notificationTypes.mentions !== false;
        }

        const friendRequestsToggle = document.getElementById(
          'friendRequestsToggle'
        ) as HTMLInputElement;
        if (friendRequestsToggle) {
          friendRequestsToggle.checked = settings.notificationTypes.friendRequests !== false;
        }

        const groupInvitesToggle = document.getElementById(
          'groupInvitesToggle'
        ) as HTMLInputElement;
        if (groupInvitesToggle) {
          groupInvitesToggle.checked = settings.notificationTypes.groupInvites !== false;
        }

        const channelMessagesToggle = document.getElementById(
          'channelMessagesToggle'
        ) as HTMLInputElement;
        if (channelMessagesToggle) {
          channelMessagesToggle.checked = settings.notificationTypes.channelMessages === true;
        }
      }
    } else {
      console.error('Kullanıcı ayarları yükleme hatası:', response.message);
    }
  });
}

/**
 * Tema ayarlarını kaydeder
 * @param socket - Socket.io socket
 */
function saveThemeSettings(socket: Socket): void {
  const themeSelect = document.getElementById('themeSelect') as HTMLSelectElement;
  if (!themeSelect) {
    return;
  }

  const theme = themeSelect.value as 'dark' | 'light';

  socket.emit(
    'updateThemeSettings',
    { theme },
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        showToast('Tema ayarları kaydedildi', 'success');

        // Tema değişikliği olayını tetikle
        document.dispatchEvent(
          new CustomEvent('themeSettingsChanged', {
            detail: { theme },
          })
        );

        // Temayı uygula
        applyTheme(theme);
      } else {
        showToast(
          'Tema ayarları kaydedilemedi: ' + (response.message || 'Bilinmeyen hata'),
          'error'
        );
      }
    }
  );
}

/**
 * Dil ayarlarını kaydeder
 * @param socket - Socket.io socket
 */
function saveLanguageSettings(socket: Socket): void {
  const languageSelect = document.getElementById('languageSelect') as HTMLSelectElement;
  if (!languageSelect) {
    return;
  }

  const language = languageSelect.value;

  socket.emit(
    'updateLanguageSettings',
    { language },
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        showToast('Dil ayarları kaydedildi', 'success');

        // Dil değişikliği olayını tetikle
        document.dispatchEvent(
          new CustomEvent('languageSettingsChanged', {
            detail: { language },
          })
        );
      } else {
        showToast(
          'Dil ayarları kaydedilemedi: ' + (response.message || 'Bilinmeyen hata'),
          'error'
        );
      }
    }
  );
}

/**
 * Bildirim ayarlarını kaydeder
 * @param socket - Socket.io socket
 */
function saveNotificationSettings(socket: Socket): void {
  const notificationsToggle = document.getElementById('notificationsToggle') as HTMLInputElement;
  const emailNotificationsToggle = document.getElementById(
    'emailNotificationsToggle'
  ) as HTMLInputElement;
  const soundEffectsToggle = document.getElementById('soundEffectsToggle') as HTMLInputElement;
  const directMessagesToggle = document.getElementById('directMessagesToggle') as HTMLInputElement;
  const mentionsToggle = document.getElementById('mentionsToggle') as HTMLInputElement;
  const friendRequestsToggle = document.getElementById('friendRequestsToggle') as HTMLInputElement;
  const groupInvitesToggle = document.getElementById('groupInvitesToggle') as HTMLInputElement;
  const channelMessagesToggle = document.getElementById(
    'channelMessagesToggle'
  ) as HTMLInputElement;

  if (
    !notificationsToggle ||
    !emailNotificationsToggle ||
    !soundEffectsToggle ||
    !directMessagesToggle ||
    !mentionsToggle ||
    !friendRequestsToggle ||
    !groupInvitesToggle ||
    !channelMessagesToggle
  ) {
    return;
  }

  const settings = {
    notifications: notificationsToggle.checked,
    emailNotifications: emailNotificationsToggle.checked,
    soundEffects: soundEffectsToggle.checked,
    notificationTypes: {
      directMessages: directMessagesToggle.checked,
      mentions: mentionsToggle.checked,
      friendRequests: friendRequestsToggle.checked,
      groupInvites: groupInvitesToggle.checked,
      channelMessages: channelMessagesToggle.checked,
    },
  };

  socket.emit(
    'updateNotificationSettings',
    settings,
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
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
        showToast(
          'Bildirim ayarları kaydedilemedi: ' + (response.message || 'Bilinmeyen hata'),
          'error'
        );
      }
    }
  );
}

/**
 * Bildirim ayarlarını günceller
 * @param event - Olay nesnesi
 * @param socket - Socket.io socket
 */
function updateNotificationSettings(event: CustomEvent, socket: Socket): void {
  const settings = event.detail;

  // Bildirim ayarlarını sunucuya gönder
  socket.emit(
    'updateNotificationSettings',
    settings,
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        console.log('Bildirim ayarları güncellendi');
      } else {
        console.error('Bildirim ayarları güncellenirken bir hata oluştu:', response.message);
      }
    }
  );
}

/**
 * Tema ayarlarını günceller
 * @param event - Olay nesnesi
 * @param socket - Socket.io socket
 */
function updateThemeSettings(event: CustomEvent, socket: Socket): void {
  const settings = event.detail;

  // Tema ayarlarını sunucuya gönder
  socket.emit(
    'updateThemeSettings',
    settings,
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        console.log('Tema ayarları güncellendi');

        // Temayı uygula
        applyTheme(settings.theme);
      } else {
        console.error('Tema ayarları güncellenirken bir hata oluştu:', response.message);
      }
    }
  );
}

/**
 * Dil ayarlarını günceller
 * @param event - Olay nesnesi
 * @param socket - Socket.io socket
 */
function updateLanguageSettings(event: CustomEvent, socket: Socket): void {
  const settings = event.detail;

  // Dil ayarlarını sunucuya gönder
  socket.emit(
    'updateLanguageSettings',
    settings,
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        console.log('Dil ayarları güncellendi');
      } else {
        console.error('Dil ayarları güncellenirken bir hata oluştu:', response.message);
      }
    }
  );
}

/**
 * Temayı uygular
 * @param theme - Tema adı
 */
function applyTheme(theme: 'dark' | 'light'): void {
  const body = document.body;

  if (theme === 'light') {
    body.classList.add('light-theme');
    body.classList.remove('dark-theme');
  } else {
    body.classList.add('dark-theme');
    body.classList.remove('light-theme');
  }

  // Tema değişikliğini yerel depolamaya kaydet
  localStorage.setItem('theme', theme);
}

/**
 * Toast bildirimi gösterir
 * @param message - Bildirim mesajı
 * @param type - Bildirim türü
 */
function showToast(message: string, type: ToastType): void {
  // feedback.js modülündeki showToast fonksiyonunu çağır
  if (window.feedback && window.feedback.showToast) {
    window.feedback.showToast(message, { type });
  } else {
    // Fallback: Basit bir alert göster
    alert(message);
  }
}
