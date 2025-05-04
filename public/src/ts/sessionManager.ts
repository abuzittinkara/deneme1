/**
 * public/src/ts/sessionManager.ts
 * Oturum yönetimi modülü
 * Kullanıcıların aktif oturumlarını görüntülemesini ve yönetmesini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Oturum yanıtı arayüzü
interface SessionResponse {
  success: boolean;
  message?: string;
  sessions?: Session[];
  currentSessionId?: string;
}

// Oturum arayüzü
interface Session {
  _id: string;
  loginTime: string;
  ipAddress: string;
  deviceInfo: DeviceInfo;
}

// Cihaz bilgisi arayüzü
interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  type: string;
}

// Bildirim seçenekleri arayüzü
interface NotificationOptions {
  title: string;
  message: string;
  type: string;
  duration?: number;
}

/**
 * Oturum yönetimi özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initSessionManager(socket: Socket): void {
  // Oturum yönetimi düğmesine tıklama olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('#manageSessionsBtn')) {
      showSessionsModal(socket);
    }
  });

  // Socket olaylarını dinle
  socket.on('sessionEnded', (data: any) => {
    showSessionEndedNotification();
  });

  socket.on('allOtherSessionsEnded', (data: any) => {
    showAllOtherSessionsEndedNotification();
  });
}

/**
 * Oturum yönetimi modalını gösterir
 * @param socket - Socket.io socket
 */
function showSessionsModal(socket: Socket): void {
  // Oturumları getir
  socket.emit('getUserSessions', {}, (response: SessionResponse) => {
    if (!response.success) {
      showErrorNotification(
        'Oturumlar getirilirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
      );
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
          ${
            sessions.length > 0
              ? sessions
                  .map(
                    session => `
              <div class="session-item ${
                session._id === currentSessionId ? 'current-session' : ''
              }">
                <div class="session-info">
                  <div class="session-device">
                    <span class="material-icons">${getDeviceIcon(session.deviceInfo)}</span>
                    <div class="session-device-details">
                      <div class="session-device-name">${getDeviceName(session.deviceInfo)}</div>
                      <div class="session-browser">${session.deviceInfo.browser} / ${
                      session.deviceInfo.os
                    }</div>
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
                  ${
                    session._id === currentSessionId
                      ? '<span class="current-session-badge">Mevcut Oturum</span>'
                      : `<button class="end-session-btn" data-session-id="${session._id}">Oturumu Sonlandır</button>`
                  }
                </div>
              </div>
            `
                  )
                  .join('')
              : '<div class="no-sessions">Aktif oturum bulunamadı.</div>'
          }
        </div>

        <div class="sessions-actions">
          <button id="endAllOtherSessionsBtn" class="btn danger" ${
            sessions.length <= 1 ? 'disabled' : ''
          }>
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
        const sessionId = (btn as HTMLElement).dataset['sessionId'];

        if (sessionId) {
          // Oturumu sonlandır
          socket.emit('endSession', { sessionId }, (response: SessionResponse) => {
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
                  (endAllBtn as HTMLButtonElement).disabled = true;
                }
              }
            } else {
              showErrorNotification(
                'Oturum sonlandırılırken bir hata oluştu: ' +
                  (response.message || 'Bilinmeyen hata')
              );
            }
          });
        }
      });
    });

    // Diğer tüm oturumları sonlandırma düğmesi olayı
    const endAllOtherSessionsBtn = document.getElementById('endAllOtherSessionsBtn');
    if (endAllOtherSessionsBtn) {
      endAllOtherSessionsBtn.addEventListener('click', () => {
        // Diğer tüm oturumları sonlandır
        socket.emit('endAllOtherSessions', {}, (response: SessionResponse) => {
          if (response.success) {
            showAllOtherSessionsEndedNotification();

            // Mevcut oturum dışındaki tüm oturum öğelerini kaldır
            const sessionItems = modal.querySelectorAll('.session-item:not(.current-session)');
            sessionItems.forEach(item => {
              item.remove();
            });

            // "Diğer Tüm Oturumları Sonlandır" düğmesini devre dışı bırak
            (endAllOtherSessionsBtn as HTMLButtonElement).disabled = true;
          } else {
            showErrorNotification(
              'Oturumlar sonlandırılırken bir hata oluştu: ' +
                (response.message || 'Bilinmeyen hata')
            );
          }
        });
      });
    }

    // Kapatma düğmesi olayı
    const closeBtn = document.getElementById('closeSessionsBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        closeModal(modal);
      });
    }

    // Dışarı tıklama ile kapatma
    modal.addEventListener('click', (e: MouseEvent) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
  });
}

/**
 * Cihaz simgesini döndürür
 * @param deviceInfo - Cihaz bilgileri
 * @returns Simge adı
 */
function getDeviceIcon(deviceInfo: DeviceInfo): string {
  if (!deviceInfo) {
    return 'devices';
  }

  const { type, device } = deviceInfo;

  if (type === 'mobile') {
    return 'smartphone';
  } else if (type === 'tablet') {
    return 'tablet';
  } else if (device && device.toLowerCase().includes('mac')) {
    return 'laptop_mac';
  } else if (device && device.toLowerCase().includes('windows')) {
    return 'laptop_windows';
  } else if (device && device.toLowerCase().includes('linux')) {
    return 'computer';
  }

  return 'devices';
}

/**
 * Cihaz adını döndürür
 * @param deviceInfo - Cihaz bilgileri
 * @returns Cihaz adı
 */
function getDeviceName(deviceInfo: DeviceInfo): string {
  if (!deviceInfo) {
    return 'Bilinmeyen Cihaz';
  }

  const { type, device, os } = deviceInfo;

  if (type === 'mobile') {
    return `Mobil Cihaz (${os})`;
  } else if (type === 'tablet') {
    return `Tablet (${os})`;
  } else if (device) {
    return device;
  }

  return `${os} Cihazı`;
}

/**
 * Oturum sonlandırıldığında bildirim gösterir
 */
function showSessionEndedNotification(): void {
  showNotification({
    title: 'Oturum Sonlandırıldı',
    message: 'Seçilen oturum başarıyla sonlandırıldı.',
    type: 'success',
    duration: 3000,
  });
}

/**
 * Diğer tüm oturumlar sonlandırıldığında bildirim gösterir
 */
function showAllOtherSessionsEndedNotification(): void {
  showNotification({
    title: 'Oturumlar Sonlandırıldı',
    message: 'Diğer tüm oturumlar başarıyla sonlandırıldı.',
    type: 'success',
    duration: 3000,
  });
}

/**
 * Hata bildirimi gösterir
 * @param message - Hata mesajı
 */
function showErrorNotification(message: string): void {
  showNotification({
    title: 'Hata',
    message,
    type: 'error',
    duration: 5000,
  });
}

/**
 * Bildirim gösterir
 * @param options - Bildirim seçenekleri
 */
function showNotification(options: NotificationOptions): void {
  // Feedback modülü varsa onu kullan
  if ((window as any).showToast) {
    (window as any).showToast(options.message, options.type, options.title, options.duration);
  } else {
    // Basit bir bildirim göster
    alert(`${options.title}: ${options.message}`);
  }
}

/**
 * Modalı kapatır
 * @param modal - Modal elementi
 */
function closeModal(modal: HTMLElement): void {
  modal.classList.remove('show');
  setTimeout(() => {
    modal.remove();
  }, 300);
}
