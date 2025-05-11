/**
 * public/js/settings.js
 * Ayarlar sayfası işlevselliği
 */

// Socket.IO bağlantısı
const socket = io({
  transports: ['websocket', 'polling'],
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 3,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5,
  timeout: 20000,
  forceNew: true
});

// DOM elementleri
const settingsMenuItems = document.querySelectorAll('.settings-nav-item');
const settingsSections = document.querySelectorAll('.settings-section');

// Tema seçimi
const themeRadioButtons = document.querySelectorAll('input[name="theme"]');
const fontSizeSelect = document.getElementById('fontSize');

// Bildirim ayarları
const notificationsToggle = document.getElementById('enableNotifications');
const soundNotificationsToggle = document.getElementById('enableSoundNotifications');
const directMessagesToggle = document.getElementById('notifyDirectMessages');
const mentionsToggle = document.getElementById('notifyMentions');
const friendRequestsToggle = document.getElementById('notifyFriendRequests');
const groupInvitesToggle = document.getElementById('notifyGroupInvites');

// Ses ayarları
const microphoneSelect = document.getElementById('inputDevice');
const speakerSelect = document.getElementById('outputDevice');
const micVolumeSlider = document.getElementById('micVolume');
const speakerVolumeSlider = document.getElementById('speakerVolume');

// Gizlilik ayarları
const profileVisibilitySelect = document.getElementById('profileVisibility');
const messagePermissionSelect = document.getElementById('messagePermission');
const invisibleModeToggle = document.getElementById('invisibleMode');
const autoDeleteMessagesToggle = document.getElementById('autoDeleteMessages');

// Hesap ayarları
const accountEmail = document.getElementById('email');
const currentPassword = document.getElementById('currentPassword');
const newPassword = document.getElementById('newPassword');
const confirmPassword = document.getElementById('confirmPassword');
const deleteAccountBtn = document.getElementById('deleteAccountBtn');

// Diğer butonlar
const saveVoiceBtn = document.getElementById('saveVoiceBtn');
const saveAppearanceBtn = document.getElementById('saveAppearanceBtn');
const saveNotificationsBtn = document.getElementById('saveNotificationsBtn');
const saveLanguageBtn = document.getElementById('saveLanguageBtn');
const savePrivacyBtn = document.getElementById('savePrivacyBtn');
const passwordForm = document.getElementById('passwordForm');

// Kullanıcı ayarları
let userSettings = {
  appearance: {
    theme: 'dark',
    fontSize: 'medium',
    compactMode: false,
    animations: true
  },
  notifications: {
    enabled: true,
    desktop: true,
    directMessages: true,
    channelMessages: true,
    mentions: true
  },
  audio: {
    microphone: 'default',
    speaker: 'default',
    messageSound: true,
    callSound: true
  },
  privacy: {
    messagePrivacy: 'everyone',
    profilePrivacy: 'everyone'
  },
  account: {
    email: '',
    twoFactorEnabled: false
  }
};

// Sayfa yüklendiğinde
document.addEventListener('DOMContentLoaded', () => {
  console.log('Ayarlar sayfası yüklendi');

  // Socket.IO bağlantı olayları
  socket.on('connect', () => {
    console.log('Socket.IO bağlantısı kuruldu:', socket.id);
    loadUserSettings();
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO bağlantısı kesildi');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO bağlantı hatası:', error);
  });

  // Ayarlar menüsü olayları
  settingsMenuItems.forEach(item => {
    item.addEventListener('click', () => {
      // Aktif menü öğesini değiştir
      settingsMenuItems.forEach(menuItem => {
        menuItem.classList.remove('active');
      });
      item.classList.add('active');

      // Aktif bölümü değiştir
      const sectionId = item.getAttribute('data-section');
      settingsSections.forEach(section => {
        section.classList.remove('active');
      });
      document.getElementById(`${sectionId}-section`).classList.add('active');
    });
  });

  // Tema değişikliği
  themeRadioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        const theme = radio.value;
        document.documentElement.setAttribute('data-theme', theme);
        userSettings.appearance.theme = theme;
        saveUserSettings();
      }
    });
  });

  // Yazı tipi boyutu değişikliği
  fontSizeSelect.addEventListener('change', () => {
    const fontSize = fontSizeSelect.value;
    userSettings.appearance.fontSize = fontSize;
    applyFontSize(fontSize);
    saveUserSettings();
  });

  // Bildirim ayarları değişiklikleri
  if (notificationsToggle) {
    notificationsToggle.addEventListener('change', () => {
      const enabled = notificationsToggle.checked;
      userSettings.notifications.enabled = enabled;
      saveUserSettings();
    });
  }

  if (soundNotificationsToggle) {
    soundNotificationsToggle.addEventListener('change', () => {
      const enabled = soundNotificationsToggle.checked;
      userSettings.notifications.sound = enabled;
      saveUserSettings();
    });
  }

  if (directMessagesToggle) {
    directMessagesToggle.addEventListener('change', () => {
      const enabled = directMessagesToggle.checked;
      userSettings.notifications.directMessages = enabled;
      saveUserSettings();
    });
  }

  if (mentionsToggle) {
    mentionsToggle.addEventListener('change', () => {
      const enabled = mentionsToggle.checked;
      userSettings.notifications.mentions = enabled;
      saveUserSettings();
    });
  }

  // Ses ayarları değişiklikleri
  if (microphoneSelect) {
    microphoneSelect.addEventListener('change', () => {
      const device = microphoneSelect.value;
      userSettings.audio.microphone = device;
      saveUserSettings();
    });
  }

  if (speakerSelect) {
    speakerSelect.addEventListener('change', () => {
      const device = speakerSelect.value;
      userSettings.audio.speaker = device;
      saveUserSettings();
    });
  }

  // Gizlilik ayarları değişiklikleri
  if (profileVisibilitySelect) {
    profileVisibilitySelect.addEventListener('change', () => {
      const privacy = profileVisibilitySelect.value;
      userSettings.privacy.profileVisibility = privacy;
      saveUserSettings();
    });
  }

  if (messagePermissionSelect) {
    messagePermissionSelect.addEventListener('change', () => {
      const privacy = messagePermissionSelect.value;
      userSettings.privacy.messagePermission = privacy;
      saveUserSettings();
    });
  }

  // Kaydet butonları
  if (saveVoiceBtn) {
    saveVoiceBtn.addEventListener('click', () => {
      saveUserSettings();
      alert('Ses ayarları kaydedildi.');
    });
  }

  if (saveAppearanceBtn) {
    saveAppearanceBtn.addEventListener('click', () => {
      saveUserSettings();
      alert('Görünüm ayarları kaydedildi.');
    });
  }

  if (saveNotificationsBtn) {
    saveNotificationsBtn.addEventListener('click', () => {
      saveUserSettings();
      alert('Bildirim ayarları kaydedildi.');
    });
  }

  if (saveLanguageBtn) {
    saveLanguageBtn.addEventListener('click', () => {
      saveUserSettings();
      alert('Dil ayarları kaydedildi.');
    });
  }

  if (savePrivacyBtn) {
    savePrivacyBtn.addEventListener('click', () => {
      saveUserSettings();
      alert('Gizlilik ayarları kaydedildi.');
    });
  }

  // Şifre değiştirme formu
  if (passwordForm) {
    passwordForm.addEventListener('submit', (e) => {
      e.preventDefault();
      changePassword();
    });
  }

  // Hesap silme
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener('click', () => {
      if (confirm('Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) {
        deleteAccount();
      }
    });
  }

  // Kullanıcı ayarlarını yükle
  loadUserSettings();

  // Ses cihazlarını listele
  listAudioDevices();
});

/**
 * Kullanıcı ayarlarını yükler
 */
function loadUserSettings() {
  // Gerçek uygulamada sunucudan veri alınır
  // Şimdilik yerel depolamadan veya varsayılan değerlerden alıyoruz
  const savedSettings = localStorage.getItem('userSettings');

  if (savedSettings) {
    userSettings = JSON.parse(savedSettings);
  }

  // Ayarları arayüze uygula
  applySettings();

  // Sunucudan ayarları al (gerçek uygulamada)
  socket.emit('getUserSettings', (response) => {
    if (response && response.success) {
      userSettings = response.settings;
      applySettings();
    }
  });
}

/**
 * Kullanıcı ayarlarını kaydeder
 */
function saveUserSettings() {
  // Ayarları yerel depolamaya kaydet
  localStorage.setItem('userSettings', JSON.stringify(userSettings));

  // Sunucuya gönder (gerçek uygulamada)
  socket.emit('updateUserSettings', userSettings, (response) => {
    if (response && response.success) {
      console.log('Ayarlar başarıyla kaydedildi');
    } else {
      console.error('Ayarlar kaydedilirken bir hata oluştu');
    }
  });
}

/**
 * Ayarları arayüze uygular
 */
function applySettings() {
  // Tema ayarları
  const savedTheme = userSettings.appearance.theme || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  // Tema radio butonlarını güncelle
  themeRadioButtons.forEach(radio => {
    radio.checked = (radio.value === savedTheme);
  });

  // Yazı tipi boyutu
  if (fontSizeSelect) {
    fontSizeSelect.value = userSettings.appearance.fontSize || '14';
    applyFontSize(userSettings.appearance.fontSize);
  }

  // Bildirim ayarları
  if (notificationsToggle) {
    notificationsToggle.checked = userSettings.notifications.enabled;
  }

  if (soundNotificationsToggle) {
    soundNotificationsToggle.checked = userSettings.notifications.sound;
  }

  if (directMessagesToggle) {
    directMessagesToggle.checked = userSettings.notifications.directMessages;
  }

  if (mentionsToggle) {
    mentionsToggle.checked = userSettings.notifications.mentions;
  }

  // Ses ayarları
  if (microphoneSelect && userSettings.audio.microphone) {
    microphoneSelect.value = userSettings.audio.microphone;
  }

  if (speakerSelect && userSettings.audio.speaker) {
    speakerSelect.value = userSettings.audio.speaker;
  }

  // Gizlilik ayarları
  if (profileVisibilitySelect) {
    profileVisibilitySelect.value = userSettings.privacy.profileVisibility || 'everyone';
  }

  if (messagePermissionSelect) {
    messagePermissionSelect.value = userSettings.privacy.messagePermission || 'everyone';
  }

  // Hesap ayarları
  if (accountEmail) {
    accountEmail.value = userSettings.account.email || '';
  }
}

/**
 * Yazı tipi boyutunu uygular
 * @param {string} fontSize - Yazı tipi boyutu
 */
function applyFontSize(fontSize) {
  let rootFontSize;

  switch (fontSize) {
    case '12':
      rootFontSize = '12px';
      break;
    case '14':
      rootFontSize = '14px';
      break;
    case '16':
      rootFontSize = '16px';
      break;
    case '18':
      rootFontSize = '18px';
      break;
    default:
      rootFontSize = '14px';
  }

  document.documentElement.style.fontSize = rootFontSize;
}

/**
 * Masaüstü bildirim izni ister
 */
function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Bu tarayıcı masaüstü bildirimlerini desteklemiyor.');
    return;
  }

  if (Notification.permission === 'granted') {
    return;
  }

  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission !== 'granted') {
        alert('Bildirim izni verilmedi. Bildirimleri almak için izin vermeniz gerekiyor.');
      }
    });
  }
}

/**
 * Ses cihazlarını listeler
 */
async function listAudioDevices() {
  try {
    // Tarayıcı izinlerini al
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Cihazları listele
    const devices = await navigator.mediaDevices.enumerateDevices();

    // Mikrofon listesini temizle
    microphoneSelect.innerHTML = '<option value="default">Varsayılan Mikrofon</option>';

    // Hoparlör listesini temizle
    speakerSelect.innerHTML = '<option value="default">Varsayılan Hoparlör</option>';

    // Cihazları ekle
    devices.forEach(device => {
      if (device.kind === 'audioinput') {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Mikrofon ${microphoneSelect.length}`;
        microphoneSelect.appendChild(option);
      } else if (device.kind === 'audiooutput') {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Hoparlör ${speakerSelect.length}`;
        speakerSelect.appendChild(option);
      }
    });

    // Akışı kapat
    stream.getTracks().forEach(track => track.stop());

    // Seçili cihazları ayarla
    if (userSettings.audio.microphone !== 'default') {
      microphoneSelect.value = userSettings.audio.microphone;
    }

    if (userSettings.audio.speaker !== 'default') {
      speakerSelect.value = userSettings.audio.speaker;
    }
  } catch (error) {
    console.error('Ses cihazları listelenirken bir hata oluştu:', error);
  }
}

/**
 * Şifre değiştirme modalını açar
 */
function openChangePasswordModal() {
  // Form alanlarını temizle
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';

  // Modalı göster
  changePasswordModal.style.display = 'block';
}

/**
 * Şifre değiştirme modalını kapatır
 */
function closeChangePasswordModal() {
  changePasswordModal.style.display = 'none';
}

/**
 * Şifre değiştirir
 */
function changePassword() {
  // Form verilerini al
  const current = currentPassword.value;
  const newPass = newPassword.value;
  const confirm = confirmPassword.value;

  // Şifreleri kontrol et
  if (!current || !newPass || !confirm) {
    alert('Lütfen tüm alanları doldurun.');
    return;
  }

  if (newPass !== confirm) {
    alert('Yeni şifreler eşleşmiyor.');
    return;
  }

  // Şifre değiştirme isteği gönder
  socket.emit('changePassword', {
    currentPassword: current,
    newPassword: newPass
  }, (response) => {
    if (response && response.success) {
      alert('Şifreniz başarıyla değiştirildi.');
    } else {
      alert('Şifre değiştirilirken bir hata oluştu: ' + (response?.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Şifre gereksinimlerini kontrol eder
 */
function checkPasswordRequirements() {
  const password = newPassword.value;
  const confirm = confirmPassword.value;

  // Uzunluk kontrolü
  const reqLength = document.getElementById('req-length');
  if (reqLength) {
    if (password.length >= 8) {
      reqLength.classList.add('valid');
    } else {
      reqLength.classList.remove('valid');
    }
  }

  // Büyük harf kontrolü
  const reqUppercase = document.getElementById('req-uppercase');
  if (reqUppercase) {
    if (/[A-Z]/.test(password)) {
      reqUppercase.classList.add('valid');
    } else {
      reqUppercase.classList.remove('valid');
    }
  }

  // Küçük harf kontrolü
  const reqLowercase = document.getElementById('req-lowercase');
  if (reqLowercase) {
    if (/[a-z]/.test(password)) {
      reqLowercase.classList.add('valid');
    } else {
      reqLowercase.classList.remove('valid');
    }
  }
}

/**
 * Hesabı siler
 */
function deleteAccount() {
  if (confirm('Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!')) {
    socket.emit('deleteAccount', (response) => {
      if (response && response.success) {
        alert('Hesabınız başarıyla silindi.');
        window.location.href = '/login.html';
      } else {
        alert('Hesap silinirken bir hata oluştu: ' + (response?.message || 'Bilinmeyen hata'));
      }
    });
  }
}

// Şifre değişikliği için olay dinleyicileri ekle
if (newPassword) {
  newPassword.addEventListener('input', checkPasswordRequirements);
}

if (confirmPassword) {
  confirmPassword.addEventListener('input', checkPasswordRequirements);
}
