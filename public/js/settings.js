document.addEventListener('DOMContentLoaded', () => {
  // API URL'si
  const API_BASE_URL = '/api';
  
  // Kullanıcı bilgileri
  let currentUser = null;
  
  // Ayarlar menüsü işlemleri
  const settingsNavItems = document.querySelectorAll('.settings-nav-item');
  const settingsSections = document.querySelectorAll('.settings-section');
  
  settingsNavItems.forEach(item => {
    item.addEventListener('click', () => {
      // Aktif menü öğesini güncelle
      settingsNavItems.forEach(navItem => navItem.classList.remove('active'));
      item.classList.add('active');
      
      // Hedef bölümü göster
      const targetSection = item.dataset.section;
      settingsSections.forEach(section => {
        section.classList.remove('active');
        if (section.id === `${targetSection}-section`) {
          section.classList.add('active');
        }
      });
    });
  });
  
  // Ayarlar penceresini kapatma
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  closeSettingsBtn.addEventListener('click', () => {
    window.location.href = '/';
  });
  
  // Profil formu
  const profileForm = document.getElementById('profileForm');
  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const displayName = document.getElementById('displayName').value.trim();
    const userBio = document.getElementById('userBio').value.trim();
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          displayName,
          bio: userBio
        })
      });
      
      if (response.ok) {
        alert('Profil bilgileri güncellendi.');
      } else {
        alert('Profil bilgileri güncellenirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Profil güncelleme hatası:', error);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });
  
  // Hesap formu
  const accountForm = document.getElementById('accountForm');
  accountForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/account`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          email,
          phone
        })
      });
      
      if (response.ok) {
        alert('Hesap bilgileri güncellendi.');
      } else {
        alert('Hesap bilgileri güncellenirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Hesap güncelleme hatası:', error);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });
  
  // Şifre formu
  const passwordForm = document.getElementById('passwordForm');
  const newPasswordInput = document.getElementById('newPassword');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  
  // Şifre gereksinimleri kontrolü
  function updatePasswordRequirements() {
    const password = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Uzunluk kontrolü
    const reqLength = document.getElementById('req-length');
    if (password.length >= 8) {
      reqLength.classList.add('valid');
      reqLength.querySelector('.material-icons').textContent = 'check_circle';
    } else {
      reqLength.classList.remove('valid');
      reqLength.querySelector('.material-icons').textContent = 'cancel';
    }
    
    // Büyük harf kontrolü
    const reqUppercase = document.getElementById('req-uppercase');
    if (/[A-Z]/.test(password)) {
      reqUppercase.classList.add('valid');
      reqUppercase.querySelector('.material-icons').textContent = 'check_circle';
    } else {
      reqUppercase.classList.remove('valid');
      reqUppercase.querySelector('.material-icons').textContent = 'cancel';
    }
    
    // Küçük harf kontrolü
    const reqLowercase = document.getElementById('req-lowercase');
    if (/[a-z]/.test(password)) {
      reqLowercase.classList.add('valid');
      reqLowercase.querySelector('.material-icons').textContent = 'check_circle';
    } else {
      reqLowercase.classList.remove('valid');
      reqLowercase.querySelector('.material-icons').textContent = 'cancel';
    }
    
    // Rakam kontrolü
    const reqNumber = document.getElementById('req-number');
    if (/[0-9]/.test(password)) {
      reqNumber.classList.add('valid');
      reqNumber.querySelector('.material-icons').textContent = 'check_circle';
    } else {
      reqNumber.classList.remove('valid');
      reqNumber.querySelector('.material-icons').textContent = 'cancel';
    }
    
    // Eşleşme kontrolü
    const reqMatch = document.getElementById('req-match');
    if (password && confirmPassword && password === confirmPassword) {
      reqMatch.classList.add('valid');
      reqMatch.querySelector('.material-icons').textContent = 'check_circle';
    } else {
      reqMatch.classList.remove('valid');
      reqMatch.querySelector('.material-icons').textContent = 'cancel';
    }
  }
  
  newPasswordInput.addEventListener('input', updatePasswordRequirements);
  confirmPasswordInput.addEventListener('input', updatePasswordRequirements);
  
  passwordForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Şifre doğrulama
    if (newPassword.length < 8) {
      alert('Şifre en az 8 karakter olmalıdır.');
      return;
    }
    
    if (!/[A-Z]/.test(newPassword)) {
      alert('Şifre en az bir büyük harf içermelidir.');
      return;
    }
    
    if (!/[a-z]/.test(newPassword)) {
      alert('Şifre en az bir küçük harf içermelidir.');
      return;
    }
    
    if (!/[0-9]/.test(newPassword)) {
      alert('Şifre en az bir rakam içermelidir.');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      alert('Şifreler eşleşmiyor.');
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });
      
      if (response.ok) {
        alert('Şifre başarıyla değiştirildi.');
        passwordForm.reset();
        updatePasswordRequirements();
      } else {
        const data = await response.json();
        alert(data.message || 'Şifre değiştirme işlemi başarısız oldu.');
      }
    } catch (error) {
      console.error('Şifre değiştirme hatası:', error);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });
  
  // Ses ayarları
  const saveVoiceBtn = document.getElementById('saveVoiceBtn');
  saveVoiceBtn.addEventListener('click', () => {
    const inputDevice = document.getElementById('inputDevice').value;
    const outputDevice = document.getElementById('outputDevice').value;
    const micVolume = document.getElementById('micVolume').value;
    const speakerVolume = document.getElementById('speakerVolume').value;
    
    // Ses ayarlarını kaydet
    localStorage.setItem('inputDevice', inputDevice);
    localStorage.setItem('outputDevice', outputDevice);
    localStorage.setItem('micVolume', micVolume);
    localStorage.setItem('speakerVolume', speakerVolume);
    
    alert('Ses ayarları kaydedildi.');
  });
  
  // Mikrofon seviyesi göstergesi
  const micVolume = document.getElementById('micVolume');
  const micLevel = document.getElementById('micLevel');
  
  micVolume.addEventListener('input', () => {
    micLevel.textContent = `${micVolume.value}%`;
  });
  
  // Hoparlör seviyesi göstergesi
  const speakerVolume = document.getElementById('speakerVolume');
  const speakerLevel = document.getElementById('speakerLevel');
  
  speakerVolume.addEventListener('input', () => {
    speakerLevel.textContent = `${speakerVolume.value}%`;
  });
  
  // Mikrofon testi
  const testMicBtn = document.getElementById('testMicBtn');
  const micMeter = document.getElementById('micMeter');
  
  testMicBtn.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      function updateMeter() {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const level = Math.min(100, Math.max(0, average * 2));
        
        micMeter.style.width = `${level}%`;
        
        if (level > 80) {
          micMeter.style.backgroundColor = '#e74c3c';
        } else if (level > 50) {
          micMeter.style.backgroundColor = '#f39c12';
        } else {
          micMeter.style.backgroundColor = '#2ecc71';
        }
        
        requestAnimationFrame(updateMeter);
      }
      
      updateMeter();
      
      setTimeout(() => {
        stream.getTracks().forEach(track => track.stop());
        micMeter.style.width = '0%';
      }, 5000);
    } catch (error) {
      console.error('Mikrofon erişim hatası:', error);
      alert('Mikrofona erişilemedi. Lütfen mikrofon izinlerini kontrol edin.');
    }
  });
  
  // Hoparlör testi
  const testSpeakerBtn = document.getElementById('testSpeakerBtn');
  
  testSpeakerBtn.addEventListener('click', () => {
    const audio = new Audio('/sounds/test-sound.mp3');
    audio.volume = speakerVolume.value / 100;
    audio.play();
  });
  
  // Görünüm ayarları
  const saveAppearanceBtn = document.getElementById('saveAppearanceBtn');
  
  saveAppearanceBtn.addEventListener('click', () => {
    const theme = document.querySelector('input[name="theme"]:checked').value;
    const fontSize = document.getElementById('fontSize').value;
    
    // Görünüm ayarlarını kaydet
    localStorage.setItem('theme', theme);
    localStorage.setItem('fontSize', fontSize);
    
    // Temayı uygula
    document.body.className = theme;
    document.body.style.fontSize = `${fontSize}px`;
    
    alert('Görünüm ayarları kaydedildi.');
  });
  
  // Bildirim ayarları
  const saveNotificationsBtn = document.getElementById('saveNotificationsBtn');
  
  saveNotificationsBtn.addEventListener('click', () => {
    const enableNotifications = document.getElementById('enableNotifications').checked;
    const enableSoundNotifications = document.getElementById('enableSoundNotifications').checked;
    const notifyDirectMessages = document.getElementById('notifyDirectMessages').checked;
    const notifyMentions = document.getElementById('notifyMentions').checked;
    const notifyFriendRequests = document.getElementById('notifyFriendRequests').checked;
    const notifyGroupInvites = document.getElementById('notifyGroupInvites').checked;
    const channelMessages = document.getElementById('channelMessages').checked;
    
    // Bildirim ayarlarını kaydet
    localStorage.setItem('enableNotifications', enableNotifications);
    localStorage.setItem('enableSoundNotifications', enableSoundNotifications);
    localStorage.setItem('notifyDirectMessages', notifyDirectMessages);
    localStorage.setItem('notifyMentions', notifyMentions);
    localStorage.setItem('notifyFriendRequests', notifyFriendRequests);
    localStorage.setItem('notifyGroupInvites', notifyGroupInvites);
    localStorage.setItem('channelMessages', channelMessages);
    
    alert('Bildirim ayarları kaydedildi.');
  });
  
  // Dil ayarları
  const saveLanguageBtn = document.getElementById('saveLanguageBtn');
  
  saveLanguageBtn.addEventListener('click', () => {
    const language = document.getElementById('language').value;
    
    // Dil ayarını kaydet
    localStorage.setItem('language', language);
    
    alert('Dil ayarı kaydedildi. Değişikliklerin uygulanması için sayfayı yenileyin.');
  });
  
  // Gizlilik ayarları
  const savePrivacyBtn = document.getElementById('savePrivacyBtn');
  const autoDeleteMessages = document.getElementById('autoDeleteMessages');
  const autoDeleteTimeGroup = document.getElementById('autoDeleteTimeGroup');
  
  autoDeleteMessages.addEventListener('change', () => {
    autoDeleteTimeGroup.style.display = autoDeleteMessages.checked ? 'block' : 'none';
  });
  
  savePrivacyBtn.addEventListener('click', async () => {
    const profileVisibility = document.getElementById('profileVisibility').value;
    const messagePermission = document.getElementById('messagePermission').value;
    const invisibleMode = document.getElementById('invisibleMode').checked;
    const autoDeleteMessages = document.getElementById('autoDeleteMessages').checked;
    const autoDeleteTime = document.getElementById('autoDeleteTime').value;
    const enableSecretChat = document.getElementById('enableSecretChat').checked;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          profileVisibility,
          messagePermission,
          invisibleMode,
          autoDeleteMessages,
          autoDeleteTime,
          enableSecretChat
        })
      });
      
      if (response.ok) {
        alert('Gizlilik ayarları kaydedildi.');
      } else {
        alert('Gizlilik ayarları kaydedilirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Gizlilik ayarları kaydetme hatası:', error);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });
  
  // Veri işlemleri
  const requestDataBtn = document.getElementById('requestDataBtn');
  const deleteMessagesBtn = document.getElementById('deleteMessagesBtn');
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');
  
  requestDataBtn.addEventListener('click', async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/data/export`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentUser.token}`
        }
      });
      
      if (response.ok) {
        alert('Veri dışa aktarma isteğiniz alındı. Verileriniz hazır olduğunda e-posta adresinize bir indirme bağlantısı gönderilecektir.');
      } else {
        alert('Veri dışa aktarma isteği gönderilirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Veri dışa aktarma hatası:', error);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });
  
  deleteMessagesBtn.addEventListener('click', async () => {
    const deleteBeforeDate = document.getElementById('deleteBeforeDate').value;
    
    if (!deleteBeforeDate) {
      alert('Lütfen bir tarih seçin.');
      return;
    }
    
    if (!confirm('Bu tarihten önceki tüm mesajlarınız kalıcı olarak silinecektir. Devam etmek istiyor musunuz?')) {
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/messages`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          beforeDate: deleteBeforeDate
        })
      });
      
      if (response.ok) {
        alert('Mesajlarınız başarıyla silindi.');
      } else {
        alert('Mesajlar silinirken bir hata oluştu.');
      }
    } catch (error) {
      console.error('Mesaj silme hatası:', error);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });
  
  deleteAccountBtn.addEventListener('click', async () => {
    if (!confirm('Hesabınızı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz ve tüm verileriniz kalıcı olarak silinir.')) {
      return;
    }
    
    const password = prompt('Hesabınızı silmek için şifrenizi girin:');
    if (!password) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/users/account`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
          password
        })
      });
      
      if (response.ok) {
        alert('Hesabınız başarıyla silindi. Ana sayfaya yönlendiriliyorsunuz.');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/';
      } else {
        const data = await response.json();
        alert(data.message || 'Hesap silme işlemi başarısız oldu.');
      }
    } catch (error) {
      console.error('Hesap silme hatası:', error);
      alert('Bağlantı hatası. Lütfen tekrar deneyin.');
    }
  });
  
  // Kullanıcı bilgilerini yükle
  async function loadUserData() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (token && user) {
      try {
        currentUser = {
          ...JSON.parse(user),
          token,
          refreshToken: localStorage.getItem('refreshToken')
        };
        
        // Kullanıcı bilgilerini yükle
        const response = await fetch(`${API_BASE_URL}/users/me`, {
          headers: {
            'Authorization': `Bearer ${currentUser.token}`
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          
          // Profil bilgilerini doldur
          document.getElementById('displayName').value = userData.displayName || '';
          document.getElementById('userBio').value = userData.bio || '';
          
          // Hesap bilgilerini doldur
          document.getElementById('username').value = userData.username;
          document.getElementById('email').value = userData.email || '';
          document.getElementById('phone').value = userData.phone || '';
          
          // Profil fotoğrafını yükle
          if (userData.avatar) {
            document.getElementById('profileAvatar').src = userData.avatar;
          }
          
          // Gizlilik ayarlarını doldur
          document.getElementById('profileVisibility').value = userData.privacy?.profileVisibility || 'everyone';
          document.getElementById('messagePermission').value = userData.privacy?.messagePermission || 'everyone';
          document.getElementById('invisibleMode').checked = userData.privacy?.invisibleMode || false;
          document.getElementById('autoDeleteMessages').checked = userData.privacy?.autoDeleteMessages || false;
          document.getElementById('autoDeleteTime').value = userData.privacy?.autoDeleteTime || '86400';
          document.getElementById('enableSecretChat').checked = userData.privacy?.enableSecretChat || false;
          
          // Otomatik mesaj silme ayarını kontrol et
          autoDeleteTimeGroup.style.display = userData.privacy?.autoDeleteMessages ? 'block' : 'none';
        } else {
          console.error('Kullanıcı bilgileri yüklenemedi:', await response.json());
        }
      } catch (error) {
        console.error('Kullanıcı bilgileri yüklenirken hata oluştu:', error);
      }
    } else {
      window.location.href = '/';
    }
  }
  
  // Ses cihazlarını yükle
  async function loadAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const inputDeviceSelect = document.getElementById('inputDevice');
      const outputDeviceSelect = document.getElementById('outputDevice');
      
      // Giriş cihazlarını doldur
      const inputDevices = devices.filter(device => device.kind === 'audioinput');
      inputDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Mikrofon ${inputDeviceSelect.options.length}`;
        inputDeviceSelect.appendChild(option);
      });
      
      // Çıkış cihazlarını doldur
      const outputDevices = devices.filter(device => device.kind === 'audiooutput');
      outputDevices.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Hoparlör ${outputDeviceSelect.options.length}`;
        outputDeviceSelect.appendChild(option);
      });
      
      // Kayıtlı cihazları seç
      const savedInputDevice = localStorage.getItem('inputDevice');
      const savedOutputDevice = localStorage.getItem('outputDevice');
      
      if (savedInputDevice) {
        inputDeviceSelect.value = savedInputDevice;
      }
      
      if (savedOutputDevice) {
        outputDeviceSelect.value = savedOutputDevice;
      }
      
      // Kayıtlı ses seviyelerini ayarla
      const savedMicVolume = localStorage.getItem('micVolume');
      const savedSpeakerVolume = localStorage.getItem('speakerVolume');
      
      if (savedMicVolume) {
        document.getElementById('micVolume').value = savedMicVolume;
        document.getElementById('micLevel').textContent = `${savedMicVolume}%`;
      }
      
      if (savedSpeakerVolume) {
        document.getElementById('speakerVolume').value = savedSpeakerVolume;
        document.getElementById('speakerLevel').textContent = `${savedSpeakerVolume}%`;
      }
    } catch (error) {
      console.error('Ses cihazları yüklenirken hata oluştu:', error);
    }
  }
  
  // Sayfa yüklendiğinde
  loadUserData();
  loadAudioDevices();
});
