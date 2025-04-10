// public/js/profileManager.js

/**
 * Profile management module for updating user profiles
 */

/**
 * Initialize profile management functionality
 * @param {Object} socket - Socket.io socket
 */
export function initProfileManager(socket) {
  // Add event listeners for profile actions
  document.addEventListener('click', function(e) {
    // Open profile modal
    if (e.target && e.target.id === 'profileSettingsBtn') {
      openProfileModal(socket);
    }

    // View user profile
    if (e.target && e.target.classList.contains('view-profile-btn')) {
      const username = e.target.dataset.username;
      if (username) {
        viewUserProfile(username, socket);
      }
    }
  });

  // Initialize profile modal events when it's opened
  document.addEventListener('profileModalOpened', function() {
    initProfileModalEvents(socket);
  });
}

/**
 * Open the profile settings modal
 * @param {Object} socket - Socket.io socket
 */
function openProfileModal(socket) {
  // Create modal if it doesn't exist
  let profileModal = document.getElementById('profileSettingsModal');

  if (!profileModal) {
    profileModal = document.createElement('div');
    profileModal.id = 'profileSettingsModal';
    profileModal.className = 'modal';
    profileModal.innerHTML = `
      <div class="modal-content profile-modal-content">
        <h2>Profil Ayarları</h2>
        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="general">Genel</button>
          <button class="profile-tab" data-tab="appearance">Görünüm</button>
          <button class="profile-tab" data-tab="security">Güvenlik</button>
          <button class="profile-tab" data-tab="sessions">Oturumlar</button>
          <button class="profile-tab" data-tab="privacy">Gizlilik</button>
        </div>

        <div class="profile-tab-content active" id="general-tab">
          <div class="profile-picture-section">
            <div class="profile-picture-container">
              <div class="profile-picture" id="profilePicturePreview">
                <span class="material-icons">account_circle</span>
              </div>
              <button class="change-profile-picture-btn">Değiştir</button>
              <input type="file" id="profilePictureInput" accept="image/*" style="display: none;">
            </div>
          </div>

          <div class="profile-form">
            <div class="form-group">
              <label for="profileBio">Hakkımda</label>
              <textarea id="profileBio" placeholder="Kendiniz hakkında bir şeyler yazın..."></textarea>
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
              <input type="text" id="profileCustomStatus" placeholder="Özel durum mesajı...">
            </div>

            <div class="form-group">
              <label for="profileName">İsim</label>
              <input type="text" id="profileName">
            </div>

            <div class="form-group">
              <label for="profileSurname">Soyisim</label>
              <input type="text" id="profileSurname">
            </div>

            <div class="form-group">
              <label for="profileEmail">E-posta</label>
              <input type="email" id="profileEmail">
            </div>

            <div class="form-group">
              <label for="profilePhone">Telefon</label>
              <input type="tel" id="profilePhone">
            </div>

            <button id="saveProfileBtn" class="btn primary">Kaydet</button>
          </div>
        </div>

        <div class="profile-tab-content" id="appearance-tab">
          <div class="form-group">
            <label for="profileTheme">Tema</label>
            <select id="profileTheme">
              <option value="dark">Koyu</option>
              <option value="light">Açık</option>
            </select>
          </div>

          <div class="form-group">
            <label>Bildirimler</label>
            <div class="checkbox-group">
              <input type="checkbox" id="profileNotifications" checked>
              <label for="profileNotifications">Bildirimleri etkinleştir</label>
            </div>
          </div>

          <div class="form-group">
            <label>Ses Efektleri</label>
            <div class="checkbox-group">
              <input type="checkbox" id="profileSoundEffects" checked>
              <label for="profileSoundEffects">Ses efektlerini etkinleştir</label>
            </div>
          </div>

          <div class="form-group">
            <label for="profileLanguage">Dil</label>
            <select id="profileLanguage">
              <option value="tr">Türkçe</option>
              <option value="en">English</option>
            </select>
          </div>

          <button id="saveAppearanceBtn" class="btn primary">Kaydet</button>
        </div>

        <div class="profile-tab-content" id="security-tab">
          <div class="security-section">
            <h3>Şifre Değiştirme</h3>
            <div class="form-group">
              <label for="currentPassword">Mevcut Şifre</label>
              <input type="password" id="currentPassword">
            </div>

            <div class="form-group">
              <label for="newPassword">Yeni Şifre</label>
              <input type="password" id="newPassword">
            </div>

            <div class="form-group">
              <label for="confirmPassword">Yeni Şifre (Tekrar)</label>
              <input type="password" id="confirmPassword">
            </div>

            <button id="changePasswordBtn" class="btn primary">Şifreyi Değiştir</button>
          </div>

          <div class="security-section">
            <h3>Kullanıcı Adı Değiştirme</h3>
            <div class="form-group">
              <label for="newUsername">Yeni Kullanıcı Adı</label>
              <input type="text" id="newUsername">
            </div>

            <div class="form-group">
              <label for="usernameChangePassword">Mevcut Şifre</label>
              <input type="password" id="usernameChangePassword">
            </div>

            <button id="changeUsernameBtn" class="btn primary">Kullanıcı Adını Değiştir</button>
          </div>
        </div>

        <div class="profile-tab-content" id="sessions-tab">
          <h3>Aktif Oturumlar</h3>
          <p>Tüm aktif oturumlarınızı görüntüleyin ve yönetin. Şüpheli bir oturum görürseniz hemen sonlandırın.</p>

          <div id="sessionsContainer" class="sessions-container">
            <div class="loading-sessions">Oturumlar yükleniyor...</div>
          </div>

          <button id="refreshSessionsBtn" class="btn secondary">Yenile</button>
          <button id="endAllOtherSessionsBtn" class="btn danger">Diğer Tüm Oturumları Sonlandır</button>
        </div>

        <div class="profile-tab-content" id="privacy-tab">
          <h3>Engellenen Kullanıcılar</h3>
          <p>Engellediğiniz kullanıcıları görüntüleyin ve yönetin.</p>

          <div id="blockedUsersContainer" class="blocked-users-container">
            <div class="loading-blocked-users">Engellenen kullanıcılar yükleniyor...</div>
          </div>

          <button id="refreshBlockedUsersBtn" class="btn secondary">Yenile</button>

          <h3>Raporlarım</h3>
          <p>Gönderdiğiniz raporları görüntüleyin.</p>

          <div id="myReportsContainer" class="my-reports-container">
            <div class="loading-reports">Raporlar yükleniyor...</div>
          </div>

          <button id="refreshReportsBtn" class="btn secondary">Yenile</button>
        </div>

        <button id="closeProfileModalBtn" class="btn secondary">Kapat</button>
      </div>
    `;

    document.body.appendChild(profileModal);
  }

  // Load user profile data
  loadUserProfile(socket);

  // Show modal
  profileModal.style.display = 'block';

  // Dispatch event to initialize modal events
  document.dispatchEvent(new Event('profileModalOpened'));
}

/**
 * Initialize profile modal events
 * @param {Object} socket - Socket.io socket
 */
function initProfileModalEvents(socket) {
  // Tab switching
  const tabs = document.querySelectorAll('.profile-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and content
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });

  // Close modal
  const closeBtn = document.getElementById('closeProfileModalBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      document.getElementById('profileSettingsModal').style.display = 'none';
    });
  }

  // Profile picture change
  const changeProfilePictureBtn = document.querySelector('.change-profile-picture-btn');
  const profilePictureInput = document.getElementById('profilePictureInput');

  if (changeProfilePictureBtn && profilePictureInput) {
    changeProfilePictureBtn.addEventListener('click', () => {
      profilePictureInput.click();
    });

    profilePictureInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        const file = e.target.files[0];

        // Check file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
          alert('Profil resmi çok büyük. Maksimum 2MB yükleyebilirsiniz.');
          return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
          alert('Lütfen bir resim dosyası seçin.');
          return;
        }

        // Read file as data URL
        const reader = new FileReader();
        reader.onload = function(e) {
          const fileData = e.target.result;

          // Show preview
          const profilePicturePreview = document.getElementById('profilePicturePreview');
          profilePicturePreview.innerHTML = `<img src="${fileData}" alt="Profil Resmi">`;

          // Upload profile picture
          socket.emit('updateProfilePicture', {
            fileData,
            fileName: file.name,
            fileType: file.type
          }, (response) => {
            if (!response.success) {
              alert('Profil resmi yüklenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
            }
          });
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Save profile
  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) {
    saveProfileBtn.addEventListener('click', () => {
      const profileData = {
        bio: document.getElementById('profileBio').value,
        status: document.getElementById('profileStatus').value,
        customStatus: document.getElementById('profileCustomStatus').value,
        name: document.getElementById('profileName').value,
        surname: document.getElementById('profileSurname').value,
        email: document.getElementById('profileEmail').value,
        phone: document.getElementById('profilePhone').value
      };

      socket.emit('updateProfile', profileData, (response) => {
        if (response.success) {
          alert('Profil başarıyla güncellendi.');
        } else {
          alert('Profil güncellenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
        }
      });
    });
  }

  // Save appearance settings
  const saveAppearanceBtn = document.getElementById('saveAppearanceBtn');
  if (saveAppearanceBtn) {
    saveAppearanceBtn.addEventListener('click', () => {
      const appearanceData = {
        preferences: {
          theme: document.getElementById('profileTheme').value,
          notifications: document.getElementById('profileNotifications').checked,
          soundEffects: document.getElementById('profileSoundEffects').checked,
          language: document.getElementById('profileLanguage').value
        }
      };

      socket.emit('updateProfile', appearanceData, (response) => {
        if (response.success) {
          alert('Görünüm ayarları başarıyla güncellendi.');
          applyTheme(appearanceData.preferences.theme);
        } else {
          alert('Görünüm ayarları güncellenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
        }
      });
    });
  }

  // Change password
  const changePasswordBtn = document.getElementById('changePasswordBtn');
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener('click', () => {
      const currentPassword = document.getElementById('currentPassword').value;
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (!currentPassword || !newPassword || !confirmPassword) {
        alert('Lütfen tüm alanları doldurun.');
        return;
      }

      if (newPassword !== confirmPassword) {
        alert('Yeni şifreler eşleşmiyor.');
        return;
      }

      socket.emit('changePassword', {
        currentPassword,
        newPassword
      }, (response) => {
        if (response.success) {
          alert('Şifre başarıyla değiştirildi.');
          document.getElementById('currentPassword').value = '';
          document.getElementById('newPassword').value = '';
          document.getElementById('confirmPassword').value = '';
        } else {
          alert('Şifre değiştirilirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
        }
      });
    });
  }

  // Change username
  const changeUsernameBtn = document.getElementById('changeUsernameBtn');
  if (changeUsernameBtn) {
    changeUsernameBtn.addEventListener('click', () => {
      const newUsername = document.getElementById('newUsername').value;
      const password = document.getElementById('usernameChangePassword').value;

      if (!newUsername || !password) {
        alert('Lütfen tüm alanları doldurun.');
        return;
      }

      socket.emit('changeUsername', { newUsername, password }, (response) => {
        if (response.success) {
          alert('Kullanıcı adınız başarıyla değiştirildi. Yeni kullanıcı adınız: ' + response.newUsername);
          document.getElementById('newUsername').value = '';
          document.getElementById('usernameChangePassword').value = '';

          // Kullanıcı adını güncelle
          document.getElementById('leftUserName').textContent = response.newUsername;
          window.username = response.newUsername;
        } else {
          alert('Kullanıcı adı değiştirme hatası: ' + (response.message || 'Bilinmeyen hata'));
        }
      });
    });
  }

  // Sessions tab
  const refreshSessionsBtn = document.getElementById('refreshSessionsBtn');
  if (refreshSessionsBtn) {
    refreshSessionsBtn.addEventListener('click', () => {
      loadUserSessions(socket);
    });
  }

  const endAllOtherSessionsBtn = document.getElementById('endAllOtherSessionsBtn');
  if (endAllOtherSessionsBtn) {
    endAllOtherSessionsBtn.addEventListener('click', () => {
      if (confirm('Diğer tüm oturumlarınızı sonlandırmak istediğinizden emin misiniz?')) {
        socket.emit('endAllOtherSessions', {}, (response) => {
          if (response.success) {
            alert('Diğer tüm oturumlar başarıyla sonlandırıldı.');
            loadUserSessions(socket);
          } else {
            alert('Oturumlar sonlandırılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
          }
        });
      }
    });
  }

  // Privacy tab
  const refreshBlockedUsersBtn = document.getElementById('refreshBlockedUsersBtn');
  if (refreshBlockedUsersBtn) {
    refreshBlockedUsersBtn.addEventListener('click', () => {
      loadBlockedUsers(socket);
    });
  }

  const refreshReportsBtn = document.getElementById('refreshReportsBtn');
  if (refreshReportsBtn) {
    refreshReportsBtn.addEventListener('click', () => {
      loadUserReports(socket);
    });
  }
}

/**
 * Load user profile data
 * @param {Object} socket - Socket.io socket
 */
function loadUserProfile(socket) {
  socket.emit('getProfile', { username: window.username }, (response) => {
    if (response.success) {
      const profile = response.profile;

      // Fill profile form
      document.getElementById('profileBio').value = profile.bio || '';
      document.getElementById('profileStatus').value = profile.status || 'online';
      document.getElementById('profileCustomStatus').value = profile.customStatus || '';
      document.getElementById('profileName').value = profile.name || '';
      document.getElementById('profileSurname').value = profile.surname || '';
      document.getElementById('profileEmail').value = profile.email || '';
      document.getElementById('profilePhone').value = profile.phone || '';

      // Set profile picture
      const profilePicturePreview = document.getElementById('profilePicturePreview');
      if (profile.profilePicture) {
        profilePicturePreview.innerHTML = `<img src="${profile.profilePicture}" alt="Profil Resmi">`;
      } else {
        profilePicturePreview.innerHTML = `<span class="material-icons">account_circle</span>`;
      }

      // Set appearance settings
      if (profile.preferences) {
        document.getElementById('profileTheme').value = profile.preferences.theme || 'dark';
        document.getElementById('profileNotifications').checked = profile.preferences.notifications !== false;
        document.getElementById('profileSoundEffects').checked = profile.preferences.soundEffects !== false;
        document.getElementById('profileLanguage').value = profile.preferences.language || 'tr';
      }
    } else {
      alert('Profil bilgileri alınırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * View another user's profile
 * @param {string} username - Username to view
 * @param {Object} socket - Socket.io socket
 */
function viewUserProfile(username, socket) {
  socket.emit('getProfile', { username }, (response) => {
    if (response.success) {
      const profile = response.profile;

      // Create and show profile view modal
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
                ${profile.profilePicture
                  ? `<img src="${profile.profilePicture}" alt="Profil Resmi">`
                  : `<span class="material-icons">account_circle</span>`}
              </div>
            </div>

            <div class="profile-info">
              <div class="profile-name">${profile.name || ''} ${profile.surname || ''}</div>
              <div class="profile-status ${profile.status || 'online'}">${profile.customStatus || getStatusText(profile.status)}</div>
            </div>
          </div>

          ${profile.bio ? `<div class="profile-bio">${profile.bio}</div>` : ''}

          <div class="profile-actions">
            <button class="btn primary send-dm-btn" data-username="${profile.username}">Mesaj Gönder</button>
            <button class="btn secondary add-friend-btn" data-username="${profile.username}">Arkadaş Ekle</button>
          </div>

          <button class="btn secondary close-profile-view-btn">Kapat</button>
        </div>
      `;

      profileViewModal.style.display = 'block';

      // Add event listeners
      const closeBtn = profileViewModal.querySelector('.close-profile-view-btn');
      closeBtn.addEventListener('click', () => {
        profileViewModal.style.display = 'none';
      });

      const sendDmBtn = profileViewModal.querySelector('.send-dm-btn');
      sendDmBtn.addEventListener('click', () => {
        // Open DM with this user
        document.dispatchEvent(new CustomEvent('openDM', { detail: { username: profile.username } }));
        profileViewModal.style.display = 'none';
      });

      const addFriendBtn = profileViewModal.querySelector('.add-friend-btn');
      addFriendBtn.addEventListener('click', () => {
        // Send friend request
        socket.emit('sendFriendRequest', { to: profile.username }, (response) => {
          if (response.success) {
            alert('Arkadaşlık isteği gönderildi.');
          } else {
            alert('Arkadaşlık isteği gönderilirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
          }
        });
      });
    } else {
      alert('Kullanıcı profili alınırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Apply theme to the application
 * @param {string} theme - Theme name ('dark' or 'light')
 */
function applyTheme(theme) {
  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

/**
 * Get text representation of a status
 * @param {string} status - Status code
 * @returns {string} Status text
 */
function getStatusText(status) {
  switch (status) {
    case 'online': return 'Çevrimiçi';
    case 'idle': return 'Boşta';
    case 'dnd': return 'Rahatsız Etmeyin';
    case 'invisible': return 'Görünmez';
    default: return 'Çevrimiçi';
  }
}

/**
 * Load user sessions
 * @param {Object} socket - Socket.io socket
 */
function loadUserSessions(socket) {
  const sessionsContainer = document.getElementById('sessionsContainer');
  if (!sessionsContainer) return;

  sessionsContainer.innerHTML = '<div class="loading-sessions">Oturumlar yükleniyor...</div>';

  socket.emit('getUserSessions', {}, (response) => {
    if (!response.success) {
      sessionsContainer.innerHTML = '<div class="error-message">Oturumlar getirilirken bir hata oluştu.</div>';
      return;
    }

    const sessions = response.sessions || [];
    const currentSessionId = response.currentSessionId;

    if (sessions.length === 0) {
      sessionsContainer.innerHTML = '<div class="no-sessions">Aktif oturum bulunamadı.</div>';
      return;
    }

    let html = '';

    sessions.forEach(session => {
      const isCurrentSession = session._id === currentSessionId;

      html += `
        <div class="session-item ${isCurrentSession ? 'current-session' : ''}">
          <div class="session-info">
            <div class="session-device">
              <span class="material-icons">${getDeviceIcon(session.deviceInfo)}</span>
              <div class="session-device-details">
                <div class="session-device-name">${getDeviceName(session.deviceInfo)}</div>
                <div class="session-browser">${session.deviceInfo.browser || 'Bilinmeyen'} / ${session.deviceInfo.os || 'Bilinmeyen'}</div>
              </div>
            </div>
            <div class="session-meta">
              <div class="session-time">
                <span class="material-icons">access_time</span>
                <span>Giriş: ${new Date(session.loginTime).toLocaleString()}</span>
              </div>
              <div class="session-location">
                <span class="material-icons">location_on</span>
                <span>${session.ipAddress || 'Bilinmeyen konum'}</span>
              </div>
            </div>
          </div>
          <div class="session-actions">
            ${isCurrentSession
              ? '<span class="current-session-badge">Mevcut Oturum</span>'
              : `<button class="end-session-btn" data-session-id="${session._id}">Oturumu Sonlandır</button>`
            }
          </div>
        </div>
      `;
    });

    sessionsContainer.innerHTML = html;

    // Add event listeners to end session buttons
    const endSessionBtns = sessionsContainer.querySelectorAll('.end-session-btn');
    endSessionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sessionId = btn.dataset.sessionId;

        if (confirm('Bu oturumu sonlandırmak istediğinizden emin misiniz?')) {
          socket.emit('endSession', { sessionId }, (response) => {
            if (response.success) {
              alert('Oturum başarıyla sonlandırıldı.');
              loadUserSessions(socket);
            } else {
              alert('Oturum sonlandırılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
            }
          });
        }
      });
    });

    // Update end all other sessions button state
    const endAllOtherSessionsBtn = document.getElementById('endAllOtherSessionsBtn');
    if (endAllOtherSessionsBtn) {
      endAllOtherSessionsBtn.disabled = sessions.length <= 1;
    }
  });
}

/**
 * Get device icon based on device info
 * @param {Object} deviceInfo - Device info object
 * @returns {string} - Material icon name
 */
function getDeviceIcon(deviceInfo) {
  if (!deviceInfo) return 'devices';

  // Device-based icons
  if (deviceInfo.device) {
    if (deviceInfo.device === 'iPhone') {
      return 'phone_iphone';
    } else if (deviceInfo.device === 'iPad') {
      return 'tablet_mac';
    } else if (deviceInfo.device === 'Android Phone') {
      return 'smartphone';
    } else if (deviceInfo.device === 'Android Tablet') {
      return 'tablet_android';
    } else if (deviceInfo.device === 'Mobile Device') {
      return 'phone_android';
    } else if (deviceInfo.device === 'Desktop') {
      // OS-based desktop icons
      if (deviceInfo.os === 'Windows') {
        return 'computer';
      } else if (deviceInfo.os === 'Mac OS') {
        return 'laptop_mac';
      } else if (deviceInfo.os === 'Linux') {
        return 'computer';
      }
    }
  }

  // Fallback to OS-based icons
  if (deviceInfo.os) {
    if (deviceInfo.os === 'Windows') {
      return 'computer';
    } else if (deviceInfo.os === 'Mac OS') {
      return 'laptop_mac';
    } else if (deviceInfo.os === 'iOS') {
      return 'phone_iphone';
    } else if (deviceInfo.os === 'Android') {
      return 'smartphone';
    } else if (deviceInfo.os === 'Linux') {
      return 'computer';
    }
  }

  return 'devices';
}

/**
 * Get device name based on device info
 * @param {Object} deviceInfo - Device info object
 * @returns {string} - Device name
 */
function getDeviceName(deviceInfo) {
  if (!deviceInfo) return 'Bilinmeyen Cihaz';

  // Return specific device name if available
  if (deviceInfo.device && deviceInfo.device !== 'Other') {
    if (deviceInfo.device === 'Desktop') {
      return `Bilgisayar (${deviceInfo.os || 'Bilinmeyen OS'})`;
    } else {
      return deviceInfo.device;
    }
  }

  // Fallback to OS-based names
  if (deviceInfo.os) {
    if (deviceInfo.isMobile) {
      return `Mobil Cihaz (${deviceInfo.os})`;
    } else {
      return `Bilgisayar (${deviceInfo.os})`;
    }
  }

  return 'Bilinmeyen Cihaz';
}

/**
 * Load blocked users
 * @param {Object} socket - Socket.io socket
 */
function loadBlockedUsers(socket) {
  const blockedUsersContainer = document.getElementById('blockedUsersContainer');
  if (!blockedUsersContainer) return;

  blockedUsersContainer.innerHTML = '<div class="loading-blocked-users">Engellenen kullanıcılar yükleniyor...</div>';

  socket.emit('getBlockedUsers', {}, (response) => {
    if (!response.success) {
      blockedUsersContainer.innerHTML = '<div class="error-message">Engellenen kullanıcılar getirilirken bir hata oluştu.</div>';
      return;
    }

    const blockedUsers = response.blockedUsers || [];

    if (blockedUsers.length === 0) {
      blockedUsersContainer.innerHTML = '<div class="no-blocked-users">Engellediğiniz kullanıcı bulunmamaktadır.</div>';
      return;
    }

    let html = '';

    blockedUsers.forEach(user => {
      html += `
        <div class="blocked-user-item">
          <div class="blocked-user-info">
            <div class="blocked-user-avatar">
              <span class="material-icons">account_circle</span>
            </div>
            <div class="blocked-user-name">${user.username}</div>
          </div>
          <button class="unblock-user-btn" data-username="${user.username}">
            <span class="material-icons">remove_circle</span>
            <span>Engeli Kaldır</span>
          </button>
        </div>
      `;
    });

    blockedUsersContainer.innerHTML = html;

    // Add event listeners to unblock buttons
    const unblockBtns = blockedUsersContainer.querySelectorAll('.unblock-user-btn');
    unblockBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const username = btn.dataset.username;

        if (confirm(`${username} adlı kullanıcının engelini kaldırmak istediğinizden emin misiniz?`)) {
          socket.emit('unblockUser', { username }, (response) => {
            if (response.success) {
              alert(`${username} adlı kullanıcının engeli kaldırıldı.`);
              loadBlockedUsers(socket);
            } else {
              alert('Kullanıcı engeli kaldırılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
            }
          });
        }
      });
    });
  });
}

/**
 * Load user reports
 * @param {Object} socket - Socket.io socket
 */
function loadUserReports(socket) {
  const reportsContainer = document.getElementById('myReportsContainer');
  if (!reportsContainer) return;

  reportsContainer.innerHTML = '<div class="loading-reports">Raporlar yükleniyor...</div>';

  socket.emit('getMyReports', {}, (response) => {
    if (!response.success) {
      reportsContainer.innerHTML = '<div class="error-message">Raporlar getirilirken bir hata oluştu.</div>';
      return;
    }

    const reports = response.reports || [];

    if (reports.length === 0) {
      reportsContainer.innerHTML = '<div class="no-reports">Henüz bir rapor oluşturmadınız.</div>';
      return;
    }

    let html = '';

    reports.forEach(report => {
      html += `
        <div class="report-item ${report.status}">
          <div class="report-header">
            <div class="report-user">
              <span class="material-icons">account_circle</span>
              <span class="report-username">${report.reportedUser.username}</span>
            </div>
            <div class="report-status ${report.status}">
              ${getReportStatusText(report.status)}
            </div>
          </div>
          <div class="report-details">
            <div class="report-reason">
              <strong>Neden:</strong> ${getReportReasonText(report.reason)}
            </div>
            <div class="report-description">
              <strong>Açıklama:</strong> ${report.description}
            </div>
            <div class="report-date">
              <strong>Tarih:</strong> ${new Date(report.createdAt).toLocaleString()}
            </div>
            ${report.resolution ? `
              <div class="report-resolution">
                <strong>Çözüm:</strong> ${report.resolution}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    });

    reportsContainer.innerHTML = html;
  });
}

/**
 * Get report status text
 * @param {string} status - Report status
 * @returns {string} - Status text
 */
function getReportStatusText(status) {
  switch (status) {
    case 'pending': return 'Beklemede';
    case 'investigating': return 'İnceleniyor';
    case 'resolved': return 'Çözüldü';
    case 'dismissed': return 'Reddedildi';
    default: return 'Bilinmiyor';
  }
}

/**
 * Get report reason text
 * @param {string} reason - Report reason
 * @returns {string} - Reason text
 */
function getReportReasonText(reason) {
  switch (reason) {
    case 'harassment': return 'Taciz veya Zorbalık';
    case 'spam': return 'Spam veya İstenmeyen İçerik';
    case 'inappropriate_content': return 'Uygunsuz İçerik';
    case 'threats': return 'Tehdit veya Şiddet';
    case 'impersonation': return 'Kimlik Taklidi';
    case 'other': return 'Diğer';
    default: return 'Bilinmiyor';
  }
}
