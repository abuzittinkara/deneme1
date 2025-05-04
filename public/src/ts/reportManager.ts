/**
 * public/src/ts/reportManager.ts
 * Kullanıcı raporlama modülü
 * Kullanıcıların diğer kullanıcıları raporlamasını sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Rapor arayüzü
interface Report {
  id: string;
  reportedUser: {
    username: string;
  };
  reason: string;
  description: string;
  status: string;
  createdAt: string;
  resolution?: string;
}

// Rapor yanıtı arayüzü
interface ReportResponse {
  success: boolean;
  message?: string;
  reports?: Report[];
}

// Bildirim seçenekleri arayüzü
interface NotificationOptions {
  title: string;
  message: string;
  type: string;
  duration?: number;
}

/**
 * Kullanıcı raporlama özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initReportManager(socket: Socket): void {
  // Raporlama düğmesine tıklama olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.report-user-btn')) {
      const reportBtn = target.closest('.report-user-btn') as HTMLElement;
      const username = reportBtn.dataset['username'];
      if (username) {
        showReportUserModal(username, null, socket);
      }
    }

    // Mesaj raporlama düğmesine tıklama olayı
    if (target.closest('.report-message-btn')) {
      const messageElement = target.closest('.text-message, .dm-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'];
        const sender = messageElement.dataset['sender'];

        if (messageId && sender) {
          showReportUserModal(sender, messageId, socket);
        }
      }
    }

    // Raporlarım düğmesine tıklama olayı
    if (target.closest('#viewMyReportsBtn')) {
      showMyReportsList(socket);
    }
  });

  // Socket olaylarını dinle
  socket.on('reportCreated', (data: { username: string }) => {
    showReportCreatedNotification(data);
  });

  socket.on('reportStatusUpdated', (data: { reportedUsername: string; status: string }) => {
    showReportStatusUpdatedNotification(data);
  });
}

/**
 * Kullanıcı raporlama modalını gösterir
 * @param username - Raporlanacak kullanıcı adı
 * @param messageId - Raporlanacak mesaj ID'si (varsa)
 * @param socket - Socket.io socket
 */
function showReportUserModal(username: string, messageId: string | null, socket: Socket): void {
  // Modal oluştur
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'reportUserModal';

  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content report-user-modal">
      <h2>Kullanıcıyı Raporla</h2>
      <p>Lütfen <strong>${username}</strong> adlı kullanıcıyı neden raporladığınızı belirtin:</p>

      <div class="report-form">
        <div class="form-group">
          <label for="reportReason">Rapor Nedeni:</label>
          <select id="reportReason" class="report-reason-select">
            <option value="harassment">Taciz veya Zorbalık</option>
            <option value="spam">Spam veya İstenmeyen İçerik</option>
            <option value="inappropriate_content">Uygunsuz İçerik</option>
            <option value="threats">Tehdit veya Şiddet</option>
            <option value="impersonation">Kimlik Taklidi</option>
            <option value="other">Diğer</option>
          </select>
        </div>

        <div class="form-group">
          <label for="reportDescription">Açıklama:</label>
          <textarea id="reportDescription" class="report-description" placeholder="Lütfen detaylı bir açıklama yazın..."></textarea>
        </div>

        ${messageId ? `<input type="hidden" id="reportMessageId" value="${messageId}">` : ''}

        <div class="report-buttons">
          <button id="submitReportBtn" class="btn danger">Raporla</button>
          <button id="cancelReportBtn" class="btn secondary">İptal</button>
        </div>
      </div>
    </div>
  `;

  // Modalı body'e ekle
  document.body.appendChild(modal);

  // Modalı göster
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);

  // Gönder düğmesi olayı
  const submitBtn = document.getElementById('submitReportBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const reasonSelect = document.getElementById('reportReason') as HTMLSelectElement;
      const descriptionTextarea = document.getElementById(
        'reportDescription'
      ) as HTMLTextAreaElement;

      const reason = reasonSelect.value;
      const description = descriptionTextarea.value.trim();

      if (!description) {
        showErrorNotification('Lütfen bir açıklama yazın.');
        return;
      }

      // Rapor verilerini hazırla
      const reportData: {
        username: string;
        reason: string;
        description: string;
        messageId?: string;
      } = {
        username,
        reason,
        description,
      };

      // Mesaj ID'si varsa ekle
      if (messageId) {
        reportData.messageId = messageId;
      }

      // Raporu gönder
      socket.emit('reportUser', reportData, (response: ReportResponse) => {
        if (response.success) {
          showReportCreatedNotification({ username });
        } else {
          showErrorNotification(
            'Kullanıcı raporlanırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
          );
        }

        // Modalı kapat
        closeModal(modal);
      });
    });
  }

  // İptal düğmesi olayı
  const cancelBtn = document.getElementById('cancelReportBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeModal(modal);
    });
  }

  // Dışarı tıklama ile kapatma
  modal.addEventListener('click', (e: MouseEvent) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
}

/**
 * Kullanıcının raporlarını gösterir
 * @param socket - Socket.io socket
 */
function showMyReportsList(socket: Socket): void {
  // Raporları getir
  socket.emit('getMyReports', {}, (response: ReportResponse) => {
    if (!response.success) {
      showErrorNotification(
        'Raporlarınız getirilirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
      );
      return;
    }

    const reports = response.reports || [];

    // Modal oluştur
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'myReportsModal';

    // Modal içeriği
    modal.innerHTML = `
      <div class="modal-content my-reports-modal">
        <h2>Raporlarım</h2>
        <div class="my-reports-list">
          ${
            reports.length > 0
              ? reports
                  .map(
                    report => `
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
                  ${
                    report.resolution
                      ? `
                    <div class="report-resolution">
                      <strong>Çözüm:</strong> ${report.resolution}
                    </div>
                  `
                      : ''
                  }
                </div>
              </div>
            `
                  )
                  .join('')
              : '<div class="no-reports">Henüz bir rapor oluşturmadınız.</div>'
          }
        </div>
        <button id="closeMyReportsBtn" class="btn secondary">Kapat</button>
      </div>
    `;

    // Modalı body'e ekle
    document.body.appendChild(modal);

    // Modalı göster
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);

    // Kapatma düğmesi olayı
    const closeBtn = document.getElementById('closeMyReportsBtn');
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
 * Rapor durumu metnini döndürür
 * @param status - Rapor durumu
 * @returns Durum metni
 */
function getReportStatusText(status: string): string {
  switch (status) {
    case 'pending':
      return 'Beklemede';
    case 'investigating':
      return 'İnceleniyor';
    case 'resolved':
      return 'Çözüldü';
    case 'dismissed':
      return 'Reddedildi';
    default:
      return 'Bilinmiyor';
  }
}

/**
 * Rapor nedeni metnini döndürür
 * @param reason - Rapor nedeni
 * @returns Neden metni
 */
function getReportReasonText(reason: string): string {
  switch (reason) {
    case 'harassment':
      return 'Taciz veya Zorbalık';
    case 'spam':
      return 'Spam veya İstenmeyen İçerik';
    case 'inappropriate_content':
      return 'Uygunsuz İçerik';
    case 'threats':
      return 'Tehdit veya Şiddet';
    case 'impersonation':
      return 'Kimlik Taklidi';
    case 'other':
      return 'Diğer';
    default:
      return 'Bilinmiyor';
  }
}

/**
 * Rapor oluşturulduğunda bildirim gösterir
 * @param data - Rapor verileri
 */
function showReportCreatedNotification(data: { username: string }): void {
  showNotification({
    title: 'Rapor Gönderildi',
    message: `${data.username} adlı kullanıcı için raporunuz alındı.`,
    type: 'success',
    duration: 3000,
  });
}

/**
 * Rapor durumu güncellendiğinde bildirim gösterir
 * @param data - Rapor verileri
 */
function showReportStatusUpdatedNotification(data: {
  reportedUsername: string;
  status: string;
}): void {
  showNotification({
    title: 'Rapor Güncellendi',
    message: `${data.reportedUsername} hakkındaki raporunuzun durumu "${getReportStatusText(
      data.status
    )}" olarak güncellendi.`,
    type: 'info',
    duration: 5000,
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
