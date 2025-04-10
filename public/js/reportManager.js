// public/js/reportManager.js

/**
 * Kullanıcı raporlama modülü
 * Kullanıcıların diğer kullanıcıları raporlamasını sağlar
 */

/**
 * Kullanıcı raporlama özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initReportManager(socket) {
  // Raporlama düğmesine tıklama olayı
  document.addEventListener('click', (e) => {
    if (e.target.closest('.report-user-btn')) {
      const username = e.target.closest('.report-user-btn').dataset.username;
      if (username) {
        showReportUserModal(username, null, socket);
      }
    }
    
    // Mesaj raporlama düğmesine tıklama olayı
    if (e.target.closest('.report-message-btn')) {
      const messageElement = e.target.closest('.text-message, .dm-message');
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const sender = messageElement.dataset.sender;
        
        if (messageId && sender) {
          showReportUserModal(sender, messageId, socket);
        }
      }
    }
    
    // Raporlarım düğmesine tıklama olayı
    if (e.target.closest('#viewMyReportsBtn')) {
      showMyReportsList(socket);
    }
  });
  
  // Socket olaylarını dinle
  socket.on('reportCreated', (data) => {
    showReportCreatedNotification(data);
  });
  
  socket.on('reportStatusUpdated', (data) => {
    showReportStatusUpdatedNotification(data);
  });
}

/**
 * Kullanıcı raporlama modalını gösterir
 * @param {string} username - Raporlanacak kullanıcı adı
 * @param {string|null} messageId - Raporlanacak mesaj ID'si (varsa)
 * @param {Object} socket - Socket.io socket
 */
function showReportUserModal(username, messageId, socket) {
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
  submitBtn.addEventListener('click', () => {
    const reason = document.getElementById('reportReason').value;
    const description = document.getElementById('reportDescription').value.trim();
    
    if (!description) {
      showErrorNotification('Lütfen bir açıklama yazın.');
      return;
    }
    
    // Rapor verilerini hazırla
    const reportData = {
      username,
      reason,
      description
    };
    
    // Mesaj ID'si varsa ekle
    if (messageId) {
      reportData.messageId = messageId;
    }
    
    // Raporu gönder
    socket.emit('reportUser', reportData, (response) => {
      if (response.success) {
        showReportCreatedNotification({ username });
      } else {
        showErrorNotification('Kullanıcı raporlanırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
      
      // Modalı kapat
      closeModal(modal);
    });
  });
  
  // İptal düğmesi olayı
  const cancelBtn = document.getElementById('cancelReportBtn');
  cancelBtn.addEventListener('click', () => {
    closeModal(modal);
  });
  
  // Dışarı tıklama ile kapatma
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
}

/**
 * Kullanıcının raporlarını gösterir
 * @param {Object} socket - Socket.io socket
 */
function showMyReportsList(socket) {
  // Raporları getir
  socket.emit('getMyReports', {}, (response) => {
    if (!response.success) {
      showErrorNotification('Raporlarınız getirilirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
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
          ${reports.length > 0 
            ? reports.map(report => `
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
            `).join('')
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
 * Rapor durumu metnini döndürür
 * @param {string} status - Rapor durumu
 * @returns {string} - Durum metni
 */
function getReportStatusText(status) {
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
 * @param {string} reason - Rapor nedeni
 * @returns {string} - Neden metni
 */
function getReportReasonText(reason) {
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
 * @param {Object} data - Rapor verileri
 */
function showReportCreatedNotification(data) {
  showNotification({
    title: 'Rapor Gönderildi',
    message: `${data.username} adlı kullanıcı için raporunuz alındı.`,
    type: 'success',
    duration: 3000
  });
}

/**
 * Rapor durumu güncellendiğinde bildirim gösterir
 * @param {Object} data - Rapor verileri
 */
function showReportStatusUpdatedNotification(data) {
  showNotification({
    title: 'Rapor Güncellendi',
    message: `${data.reportedUsername} hakkındaki raporunuzun durumu "${getReportStatusText(data.status)}" olarak güncellendi.`,
    type: 'info',
    duration: 5000
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
