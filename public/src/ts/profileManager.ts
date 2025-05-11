/**
 * public/src/ts/profileManager.ts
 * Profil yönetimi modülü
 * Kullanıcı profillerini güncelleme işlevlerini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Profil yanıtı arayüzü
interface ProfileResponse {
  success: boolean;
  profile?: UserProfile;
  message?: string;
}

// Kullanıcı profili arayüzü
interface UserProfile {
  username: string;
  bio?: string;
  status?: string;
  customStatus?: string;
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
  preferences?: UserPreferences;
}

// Kullanıcı tercihleri arayüzü
interface UserPreferences {
  theme?: 'dark' | 'light';
  notifications?: boolean;
  soundEffects?: boolean;
  language?: string;
}

// Oturum bilgisi arayüzü
interface SessionInfo {
  sessionId: string;
  device: string;
  browser: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

/**
 * Profil yönetimi işlevini başlatır
 * @param socket - Socket.io socket
 */
export function initProfileManager(socket: Socket): void {
  // Profil işlemleri için olay dinleyicileri ekle
  document.addEventListener('click', function (e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Profil modalını aç
    if (target && target.id === 'profileSettingsBtn') {
      openProfileModal(socket);
    }

    // Kullanıcı profilini görüntüle
    if (target && target.classList.contains('view-profile-btn')) {
      const username = target.dataset['username'];
      if (username) {
        viewUserProfile(username, socket);
      }
    }
  });

  // Modal açıldığında modal olaylarını başlat
  document.addEventListener('profileModalOpened', function () {
    initProfileModalEvents(socket);
  });
}

/**
 * Profil ayarları modalını açar
 * @param socket - Socket.io socket
 */
function openProfileModal(socket: Socket): void {
  // Modalı oluştur veya mevcut modalı al
  let profileModal = document.getElementById('profileSettingsModal');

  if (!profileModal) {
    profileModal = document.createElement('div');
    profileModal.id = 'profileSettingsModal';
    profileModal.className = 'modal';
    profileModal.innerHTML = `
      <div class="modal-content profile-modal-content">
        <span class="close-button" id="closeProfileModalBtn">&times;</span>
        <h2>Profil Ayarları</h2>
        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="general">Genel</button>
          <button class="profile-tab" data-tab="appearance">Görünüm</button>
          <button class="profile-tab" data-tab="security">Güvenlik</button>
          <button class="profile-tab" data-tab="sessions">Oturumlar</button>
          <button class="profile-tab" data-tab="privacy">Gizlilik</button>
        </div>

        <!-- Genel Sekmesi -->
        <div id="general-tab" class="profile-tab-content active">
          <div class="profile-picture-section">
            <div class="profile-picture-container">
              <div class="profile-picture" id="profilePicturePreview">
                <span class="material-icons">account_circle</span>
              </div>
              <button class="change-profile-picture-btn">Profil Resmi Değiştir</button>
              <input type="file" id="profilePictureInput" accept="image/*" style="display: none;">
            </div>
          </div>

          <form class="profile-form" id="generalProfileForm">
            <div class="form-group">
              <label for="profileName">Ad</label>
              <input type="text" id="profileName" placeholder="Adınız">
            </div>
            <div class="form-group">
              <label for="profileSurname">Soyad</label>
              <input type="text" id="profileSurname" placeholder="Soyadınız">
            </div>
            <div class="form-group">
              <label for="profileEmail">E-posta</label>
              <input type="email" id="profileEmail" placeholder="E-posta adresiniz">
            </div>
            <div class="form-group">
              <label for="profilePhone">Telefon</label>
              <input type="tel" id="profilePhone" placeholder="Telefon numaranız">
            </div>
            <div class="form-group">
              <label for="profileBio">Hakkımda</label>
              <textarea id="profileBio" placeholder="Kendinizi tanıtın"></textarea>
            </div>
            <div class="form-group">
              <label for="profileStatus">Durum</label>
              <select id="profileStatus">
                <option value="online">Çevrimiçi</option>
                <option value="idle">Boşta</option>
                <option value="dnd">Rahatsız Etmeyin</option>
                <option value="invisible">Görünmez</option>
              </select>
            </div>
            <div class="form-group">
              <label for="profileCustomStatus">Özel Durum</label>
              <input type="text" id="profileCustomStatus" placeholder="Özel durum mesajınız">
            </div>
            <button type="submit" class="btn primary" id="saveGeneralProfileBtn">Kaydet</button>
          </form>
        </div>

        <!-- Görünüm Sekmesi -->
        <div id="appearance-tab" class="profile-tab-content">
          <form class="profile-form" id="appearanceProfileForm">
            <div class="form-group">
              <label for="profileTheme">Tema</label>
              <select id="profileTheme">
                <option value="dark">Koyu Tema</option>
                <option value="light">Açık Tema</option>
              </select>
            </div>
            <div class="form-group">
              <label for="profileLanguage">Dil</label>
              <select id="profileLanguage">
                <option value="tr">Türkçe</option>
                <option value="en">English</option>
              </select>
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="profileNotifications">
              <label for="profileNotifications">Bildirimleri Etkinleştir</label>
            </div>
            <div class="checkbox-group">
              <input type="checkbox" id="profileSoundEffects">
              <label for="profileSoundEffects">Ses Efektlerini Etkinleştir</label>
            </div>
            <button type="submit" class="btn primary" id="saveAppearanceProfileBtn">Kaydet</button>
          </form>
        </div>

        <!-- Güvenlik Sekmesi -->
        <div id="security-tab" class="profile-tab-content">
          <div class="security-section">
            <h3>Şifre Değiştir</h3>
            <form class="profile-form" id="passwordChangeForm">
              <div class="form-group">
                <label for="currentPassword">Mevcut Şifre</label>
                <input type="password" id="currentPassword" placeholder="Mevcut şifreniz">
              </div>
              <div class="form-group">
                <label for="newPassword">Yeni Şifre</label>
                <input type="password" id="newPassword" placeholder="Yeni şifreniz">
              </div>
              <div class="form-group">
                <label for="confirmPassword">Şifre Tekrar</label>
                <input type="password" id="confirmPassword" placeholder="Yeni şifrenizi tekrar girin">
              </div>
              <button type="submit" class="btn primary" id="changePasswordBtn">Şifre Değiştir</button>
            </form>
          </div>
        </div>

        <!-- Oturumlar Sekmesi -->
        <div id="sessions-tab" class="profile-tab-content">
          <h3>Aktif Oturumlar</h3>
          <div id="sessionsContainer" class="sessions-container">
            <div class="loading-sessions">Oturumlar yükleniyor...</div>
          </div>
        </div>

        <!-- Gizlilik Sekmesi -->
        <div id="privacy-tab" class="profile-tab-content">
          <h3>Engellenen Kullanıcılar</h3>
          <div id="blockedUsersContainer" class="blocked-users-container">
            <div class="loading-blocked-users">Engellenen kullanıcılar yükleniyor...</div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(profileModal);
  }

  // Kullanıcı profil verilerini yükle
  loadUserProfile(socket);

  // Modalı göster
  profileModal.style.display = 'block';

  // Modal olaylarını başlatmak için olay tetikle
  document.dispatchEvent(new Event('profileModalOpened'));
}

/**
 * Profil modalı olaylarını başlatır
 * @param socket - Socket.io socket
 */
function initProfileModalEvents(socket: Socket): void {
  // Sekme değiştirme
  const tabs = document.querySelectorAll('.profile-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Tüm sekmelerden ve içeriklerden active sınıfını kaldır
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

      // Tıklanan sekmeye ve ilgili içeriğe active sınıfını ekle
      tab.classList.add('active');
      const tabName = (tab as HTMLElement).dataset['tab'];
      if (tabName) {
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) {
          tabContent.classList.add('active');
        }
      }
    });
  });

  // Modalı kapat
  const closeBtn = document.getElementById('closeProfileModalBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modal = document.getElementById('profileSettingsModal');
      if (modal) {
        modal.style.display = 'none';
      }
    });
  }

  // Profil resmi değiştirme
  const changeProfilePictureBtn = document.querySelector('.change-profile-picture-btn');
  const profilePictureInput = document.getElementById('profilePictureInput') as HTMLInputElement;

  if (changeProfilePictureBtn && profilePictureInput) {
    changeProfilePictureBtn.addEventListener('click', () => {
      profilePictureInput.click();
    });

    profilePictureInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      const files = target.files;

      if (files && files.length > 0) {
        const file = files[0];

        // Dosya türünü kontrol et
        if (file) {
          if (!file.type.startsWith('image/')) {
            alert('Lütfen bir resim dosyası seçin.');
            return;
          }

          // Dosya boyutunu kontrol et (max 5MB)
          if (file.size > 5 * 1024 * 1024) {
            alert("Dosya boyutu çok büyük. Lütfen 5MB'dan küçük bir dosya seçin.");
            return;
          }
        } else {
          alert('Dosya seçilemedi');
          return;
        }

        // Dosyayı veri URL'si olarak oku
        const reader = new FileReader();
        reader.onload = function (e: ProgressEvent<FileReader>) {
          const fileData = e.target?.result;

          // Önizleme göster
          const profilePicturePreview = document.getElementById('profilePicturePreview');
          if (profilePicturePreview && fileData) {
            profilePicturePreview.innerHTML = `<img src="${fileData}" alt="Profil Resmi">`;

            // Profil resmini yükle
            socket.emit(
              'updateProfilePicture',
              {
                fileData,
                fileName: file ? file.name : '',
                fileType: file ? file.type : '',
              },
              (response: { success: boolean; message?: string }) => {
                if (!response.success) {
                  alert(
                    'Profil resmi yüklenirken bir hata oluştu: ' +
                      (response.message || 'Bilinmeyen hata')
                  );
                }
              }
            );
          }
        };
        if (file) {
          reader.readAsDataURL(file);
        }
      }
    });
  }

  // Profili kaydet
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      const profileBio = document.getElementById('profileBio') as HTMLTextAreaElement;
      const profileStatus = document.getElementById('profileStatus') as HTMLSelectElement;
      const profileCustomStatus = document.getElementById(
        'profileCustomStatus'
      ) as HTMLInputElement;
      const profileName = document.getElementById('profileName') as HTMLInputElement;
      const profileSurname = document.getElementById('profileSurname') as HTMLInputElement;
      const profileEmail = document.getElementById('profileEmail') as HTMLInputElement;
      const profilePhone = document.getElementById('profilePhone') as HTMLInputElement;

      const profileData = {
        bio: profileBio?.value || '',
        status: profileStatus?.value || 'online',
        customStatus: profileCustomStatus?.value || '',
        name: profileName?.value || '',
        surname: profileSurname?.value || '',
        email: profileEmail?.value || '',
        phone: profilePhone?.value || '',
      };

      socket.emit(
        'updateProfile',
        profileData,
        (response: { success: boolean; message?: string }) => {
          if (response.success) {
            alert('Profil başarıyla güncellendi.');
          } else {
            alert(
              'Profil güncellenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
            );
          }
        }
      );
    });
  }

  // Görünüm ayarlarını kaydet
  const saveAppearanceBtn = document.getElementById('saveAppearanceBtn');
  if (saveAppearanceBtn) {
    saveAppearanceBtn.addEventListener('click', () => {
      const profileTheme = document.getElementById('profileTheme') as HTMLSelectElement;
      const profileNotifications = document.getElementById(
        'profileNotifications'
      ) as HTMLInputElement;
      const profileSoundEffects = document.getElementById(
        'profileSoundEffects'
      ) as HTMLInputElement;
      const profileLanguage = document.getElementById('profileLanguage') as HTMLSelectElement;

      const appearanceData = {
        preferences: {
          theme: (profileTheme?.value as 'dark' | 'light') || 'dark',
          notifications: profileNotifications?.checked,
          soundEffects: profileSoundEffects?.checked,
          language: profileLanguage?.value || 'tr',
        },
      };

      socket.emit(
        'updateProfile',
        appearanceData,
        (response: { success: boolean; message?: string }) => {
          if (response.success) {
            alert('Görünüm ayarları başarıyla güncellendi.');
            applyTheme(appearanceData.preferences.theme);
          } else {
            alert(
              'Görünüm ayarları güncellenirken bir hata oluştu: ' +
                (response.message || 'Bilinmeyen hata')
            );
          }
        }
      );
    });
  }
}

/**
 * Kullanıcı profil verilerini yükler
 * @param socket - Socket.io socket
 */
function loadUserProfile(socket: Socket): void {
  socket.emit('getProfile', { username: (window as any).username }, (response: ProfileResponse) => {
    if (response.success && response.profile) {
      const profile = response.profile;

      // Profil formunu doldur
      const profileBio = document.getElementById('profileBio') as HTMLTextAreaElement;
      const profileStatus = document.getElementById('profileStatus') as HTMLSelectElement;
      const profileCustomStatus = document.getElementById(
        'profileCustomStatus'
      ) as HTMLInputElement;
      const profileName = document.getElementById('profileName') as HTMLInputElement;
      const profileSurname = document.getElementById('profileSurname') as HTMLInputElement;
      const profileEmail = document.getElementById('profileEmail') as HTMLInputElement;
      const profilePhone = document.getElementById('profilePhone') as HTMLInputElement;

      if (profileBio) {
        profileBio.value = profile.bio || '';
      }
      if (profileStatus) {
        profileStatus.value = profile.status || 'online';
      }
      if (profileCustomStatus) {
        profileCustomStatus.value = profile.customStatus || '';
      }
      if (profileName) {
        profileName.value = profile.name || '';
      }
      if (profileSurname) {
        profileSurname.value = profile.surname || '';
      }
      if (profileEmail) {
        profileEmail.value = profile.email || '';
      }
      if (profilePhone) {
        profilePhone.value = profile.phone || '';
      }

      // Profil resmini ayarla
      const profilePicturePreview = document.getElementById('profilePicturePreview');
      if (profilePicturePreview) {
        if (profile.profilePicture) {
          profilePicturePreview.innerHTML = `<img src="${profile.profilePicture}" alt="Profil Resmi">`;
        } else {
          profilePicturePreview.innerHTML = `<span class="material-icons">account_circle</span>`;
        }
      }

      // Görünüm ayarlarını ayarla
      if (profile.preferences) {
        const profileTheme = document.getElementById('profileTheme') as HTMLSelectElement;
        const profileNotifications = document.getElementById(
          'profileNotifications'
        ) as HTMLInputElement;
        const profileSoundEffects = document.getElementById(
          'profileSoundEffects'
        ) as HTMLInputElement;
        const profileLanguage = document.getElementById('profileLanguage') as HTMLSelectElement;

        if (profileTheme) {
          profileTheme.value = profile.preferences.theme || 'dark';
        }
        if (profileNotifications) {
          profileNotifications.checked = profile.preferences.notifications !== false;
        }
        if (profileSoundEffects) {
          profileSoundEffects.checked = profile.preferences.soundEffects !== false;
        }
        if (profileLanguage) {
          profileLanguage.value = profile.preferences.language || 'tr';
        }
      }
    } else {
      alert(
        'Profil bilgileri alınırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
      );
    }
  });
}

/**
 * Başka bir kullanıcının profilini görüntüler
 * @param username - Görüntülenecek kullanıcı adı
 * @param socket - Socket.io socket
 */
function viewUserProfile(username: string, socket: Socket): void {
  socket.emit('getProfile', { username }, (response: ProfileResponse) => {
    if (response.success && response.profile) {
      const profile = response.profile;

      // Profil görüntüleme modalını oluştur ve göster
      let profileViewModal = document.getElementById('profileViewModal');

      if (!profileViewModal) {
        profileViewModal = document.createElement('div');
        profileViewModal.id = 'profileViewModal';
        profileViewModal.className = 'modal';
        document.body.appendChild(profileViewModal);
      }

      profileViewModal.innerHTML = `
        <div class="modal-content profile-view-content">
          <h2>${profile.username}</h2>

          <div class="profile-view-header">
            <div class="profile-picture-container">
              <div class="profile-picture">
                ${
                  profile.profilePicture
                    ? `<img src="${profile.profilePicture}" alt="Profil Resmi">`
                    : `<span class="material-icons">account_circle</span>`
                }
              </div>
            </div>

            <div class="profile-info">
              <div class="profile-name">${profile.name || ''} ${profile.surname || ''}</div>
              <div class="profile-status ${profile.status || 'online'}">${
        profile.customStatus || getStatusText(profile.status)
      }</div>
            </div>
          </div>

          ${profile.bio ? `<div class="profile-bio">${profile.bio}</div>` : ''}

          <div class="profile-actions">
            <button class="btn primary send-dm-btn" data-username="${
              profile.username
            }">Mesaj Gönder</button>
            <button class="btn secondary add-friend-btn" data-username="${
              profile.username
            }">Arkadaş Ekle</button>
          </div>

          <button class="btn secondary close-profile-view-btn">Kapat</button>
        </div>
      `;

      profileViewModal.style.display = 'block';

      // Olay dinleyicileri ekle
      const closeBtn = profileViewModal.querySelector('.close-profile-view-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          if (profileViewModal) {
            profileViewModal.style.display = 'none';
          }
        });
      }

      const sendDmBtn = profileViewModal.querySelector('.send-dm-btn');
      if (sendDmBtn) {
        sendDmBtn.addEventListener('click', () => {
          // Bu kullanıcı ile DM aç
          document.dispatchEvent(
            new CustomEvent('openDM', {
              detail: { username: profile.username },
            })
          );
          if (profileViewModal) {
            profileViewModal.style.display = 'none';
          }
        });
      }

      const addFriendBtn = profileViewModal.querySelector('.add-friend-btn');
      if (addFriendBtn) {
        addFriendBtn.addEventListener('click', () => {
          // Arkadaşlık isteği gönder
          socket.emit(
            'sendFriendRequest',
            { to: profile.username },
            (response: { success: boolean; message?: string }) => {
              if (response.success) {
                alert('Arkadaşlık isteği gönderildi.');
              } else {
                alert(
                  'Arkadaşlık isteği gönderilirken bir hata oluştu: ' +
                    (response.message || 'Bilinmeyen hata')
                );
              }
            }
          );
        });
      }
    } else {
      alert(
        'Kullanıcı profili alınırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
      );
    }
  });
}

/**
 * Temayı uygular
 * @param theme - Tema adı ('dark' veya 'light')
 */
function applyTheme(theme: 'dark' | 'light'): void {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
    document.body.classList.remove('dark-theme');
  } else {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
  }
}

/**
 * Durum kodunun metin karşılığını döndürür
 * @param status - Durum kodu
 * @returns Durum metni
 */
function getStatusText(status?: string): string {
  switch (status) {
    case 'online':
      return 'Çevrimiçi';
    case 'idle':
      return 'Boşta';
    case 'dnd':
      return 'Rahatsız Etmeyin';
    case 'invisible':
      return 'Görünmez';
    default:
      return 'Çevrimiçi';
  }
}
