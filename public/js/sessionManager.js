// public/js/sessionManager.js

/**
 * Oturum yönetimi modülü
 * Kullanıcıların aktif oturumlarını görüntülemesini ve yönetmesini sağlar
 */

/**
 * Oturum yönetimi özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initSessionManager(socket) {
  // Oturum yönetimi düğmesine tıklama olayı
  document.addEventListener('click', (e) => {
    if (e.target.closest('#manageSessionsBtn')) {
      showSessionsModal(socket);
    }
  });

  // Socket olaylarını dinle
  socket.on('sessionEnded', (data) => {
    showSessionEndedNotification(data);
  });

  socket.on('allOtherSessionsEnded', (data) => {
    showAllOtherSessionsEndedNotification(data);
  });
}

/**
 * Oturum yönetimi modalını gösterir
 * @param {Object} socket - Socket.io socket
 */
function showSessionsModal(socket) {
  // Oturumları getir
  socket.emit('getUserSessions', {}, (response) => {
    if (!response.success) {
      showErrorNotification('Oturumlar getirilirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      return;
    }

    const sessions = response.sessions || [];
    const currentSessionId = response.currentSessionId;

    // Modal oluştur
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'sessionsModal';

    // Modal içeriği
    modal.innerHTML = `
      <div class="modal-content sessions-modal">
        <h2>Oturum Yönetimi</h2>
        <p class="sessions-info">Aktif oturumlarınızı görüntüleyin ve yönetin. Şüpheli bir oturum görürseniz hemen sonlandırın.</p>

        <div class="sessions-list">
          ${sessions.length > 0
            ? sessions.map(session => `
              <div class="session-item ${session._id === currentSessionId ? 'current-session' : ''}">
                <div class="session-info">
                  <div class="session-device">
                    <span class="material-icons">${getDeviceIcon(session.deviceInfo)}</span>
                    <div class="session-device-details">
                      <div class="session-device-name">${getDeviceName(session.deviceInfo)}</div>
                      <div class="session-browser">${session.deviceInfo.browser} / ${session.deviceInfo.os}</div>
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
                  ${session._id === currentSessionId
                    ? '<span class="current-session-badge">Mevcut Oturum</span>'
                    : `<button class="end-session-btn" data-session-id="${session._id}">Oturumu Sonlandır</button>`
                  }
                </div>
              </div>
            `).join('')
            : '<div class="no-sessions">Aktif oturum bulunamadı.</div>'
          }
        </div>

        <div class="sessions-actions">
          <button id="endAllOtherSessionsBtn" class="btn danger" ${sessions.length <= 1 ? 'disabled' : ''}>
            Diğer Tüm Oturumları Sonlandır
          </button>
          <button id="closeSessionsBtn" class="btn secondary">Kapat</button>
        </div>
      </div>
    `;

    // Modalı body'e ekle
    document.body.appendChild(modal);

    // Modalı göster
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);

    // Oturum sonlandırma düğmesi olayları
    const endSessionBtns = modal.querySelectorAll('.end-session-btn');
    endSessionBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sessionId = btn.dataset.sessionId;

        // Oturumu sonlandır
        socket.emit('endSession', { sessionId }, (response) => {
          if (response.success) {
            showSessionEndedNotification();

            // Oturum öğesini kaldır
            const sessionItem = btn.closest('.session-item');
            if (sessionItem) {
              sessionItem.remove();
            }

            // Oturum kalmadıysa "Diğer Tüm Oturumları Sonlandır" düğmesini devre dışı bırak
            const remainingSessions = modal.querySelectorAll('.session-item').length;
            if (remainingSessions <= 1) {
              const endAllBtn = document.getElementById('endAllOtherSessionsBtn');
              if (endAllBtn) {
                endAllBtn.disabled = true;
              }
            }
          } else {
            showErrorNotification('Oturum sonlandırılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
          }
        });
      });
    });

    // Diğer tüm oturumları sonlandırma düğmesi olayı
    const endAllOtherSessionsBtn = document.getElementById('endAllOtherSessionsBtn');
    if (endAllOtherSessionsBtn) {
      endAllOtherSessionsBtn.addEventListener('click', () => {
        // Diğer tüm oturumları sonlandır
        socket.emit('endAllOtherSessions', {}, (response) => {
          if (response.success) {
            showAllOtherSessionsEndedNotification();

            // Mevcut oturum dışındaki tüm oturum öğelerini kaldır
            const sessionItems = modal.querySelectorAll('.session-item:not(.current-session)');
            sessionItems.forEach(item => {
              item.remove();
            });

            // "Diğer Tüm Oturumları Sonlandır" düğmesini devre dışı bırak
            endAllOtherSessionsBtn.disabled = true;
          } else {
            showErrorNotification('Oturumlar sonlandırılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
          }
        });
      });
    }

    // Kapatma düğmesi olayı
    const closeBtn = document.getElementById('closeSessionsBtn');
    closeBtn.addEventListener('click', () => {
      closeModal(modal);
    });

    // Dışarı tıklama ile kapatma
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });
}

/**
 * Cihaz simgesini döndürür
 * @param {Object} deviceInfo - Cihaz bilgileri
 * @returns {string} - Simge adı
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
 * Cihaz adını döndürür
 * @param {Object} deviceInfo - Cihaz bilgileri
 * @returns {string} - Cihaz adı
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
 * Oturum sonlandırıldığında bildirim gösterir
 */
function showSessionEndedNotification() {
  showNotification({
    title: 'Oturum Sonlandırıldı',
    message: 'Seçilen oturum başarıyla sonlandırıldı.',
    type: 'success',
    duration: 3000
  });
}

/**
 * Diğer tüm oturumlar sonlandırıldığında bildirim gösterir
 */
function showAllOtherSessionsEndedNotification() {
  showNotification({
    title: 'Oturumlar Sonlandırıldı',
    message: 'Diğer tüm oturumlar başarıyla sonlandırıldı.',
    type: 'success',
    duration: 3000
  });
}

/**
 * Hata bildirimi gösterir
 * @param {string} message - Hata mesajı
 */
function showErrorNotification(message) {
  showNotification({
    title: 'Hata',
    message,
    type: 'error',
    duration: 5000
  });
}

/**
 * Bildirim gösterir
 * @param {Object} options - Bildirim seçenekleri
 */
function showNotification(options) {
  // Feedback modülü varsa onu kullan
  if (window.showToast) {
    window.showToast(options.message, options.type, options.title, options.duration);
  } else {
    // Basit bir bildirim göster
    alert(`${options.title}: ${options.message}`);
  }
}

/**
 * Modalı kapatır
 * @param {HTMLElement} modal - Modal elementi
 */
function closeModal(modal) {
  modal.classList.remove('show');
  setTimeout(() => {
    modal.remove();
  }, 300);
}
