// public/js/userBlocking.js

/**
 * Kullanıcı engelleme modülü
 * Kullanıcıların diğer kullanıcıları engellemesini sağlar
 */

/**
 * Kullanıcı engelleme özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initUserBlocking(socket) {
  // Engelleme düğmesine tıklama olayı
  document.addEventListener('click', (e) => {
    if (e.target.closest('.block-user-btn')) {
      const username = e.target.closest('.block-user-btn').dataset.username;
      if (username) {
        showBlockUserConfirmation(username, socket);
      }
    }
    
    // Engeli kaldırma düğmesine tıklama olayı
    if (e.target.closest('.unblock-user-btn')) {
      const username = e.target.closest('.unblock-user-btn').dataset.username;
      if (username) {
        showUnblockUserConfirmation(username, socket);
      }
    }
    
    // Engellenen kullanıcılar listesini görüntüleme düğmesine tıklama olayı
    if (e.target.closest('#viewBlockedUsersBtn')) {
      showBlockedUsersList(socket);
    }
  });
  
  // Socket olaylarını dinle
  socket.on('userBlocked', (data) => {
    showBlockedUserNotification(data.username);
    updateUIForBlockedUser(data.username);
  });
  
  socket.on('userUnblocked', (data) => {
    showUnblockedUserNotification(data.username);
    updateUIForUnblockedUser(data.username);
  });
}

/**
 * Kullanıcı engelleme onay modalını gösterir
 * @param {string} username - Engellenecek kullanıcı adı
 * @param {Object} socket - Socket.io socket
 */
function showBlockUserConfirmation(username, socket) {
  // Modal oluştur
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'blockUserModal';
  
  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content block-user-modal">
      <h2>Kullanıcıyı Engelle</h2>
      <p><strong>${username}</strong> adlı kullanıcıyı engellemek istediğinizden emin misiniz?</p>
      <p class="block-user-info">Engellediğiniz kullanıcılar:</p>
      <ul class="block-user-effects">
        <li>Size mesaj gönderemezler</li>
        <li>Arkadaş listenizden çıkarılırlar</li>
        <li>Sizinle iletişim kuramazlar</li>
        <li>Sizi göremezler</li>
      </ul>
      <div class="block-user-buttons">
        <button id="confirmBlockBtn" class="btn danger">Engelle</button>
        <button id="cancelBlockBtn" class="btn secondary">İptal</button>
      </div>
    </div>
  `;
  
  // Modalı body'e ekle
  document.body.appendChild(modal);
  
  // Modalı göster
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  
  // Onay düğmesi olayı
  const confirmBtn = document.getElementById('confirmBlockBtn');
  confirmBtn.addEventListener('click', () => {
    // Kullanıcıyı engelle
    socket.emit('blockUser', { username }, (response) => {
      if (response.success) {
        showBlockedUserNotification(username);
        updateUIForBlockedUser(username);
      } else {
        showErrorNotification('Kullanıcı engellenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
      
      // Modalı kapat
      closeModal(modal);
    });
  });
  
  // İptal düğmesi olayı
  const cancelBtn = document.getElementById('cancelBlockBtn');
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
 * Kullanıcı engel kaldırma onay modalını gösterir
 * @param {string} username - Engeli kaldırılacak kullanıcı adı
 * @param {Object} socket - Socket.io socket
 */
function showUnblockUserConfirmation(username, socket) {
  // Modal oluştur
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'unblockUserModal';
  
  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content unblock-user-modal">
      <h2>Kullanıcı Engelini Kaldır</h2>
      <p><strong>${username}</strong> adlı kullanıcının engelini kaldırmak istediğinizden emin misiniz?</p>
      <p class="unblock-user-info">Engeli kaldırdığınızda bu kullanıcı:</p>
      <ul class="unblock-user-effects">
        <li>Size mesaj gönderebilir</li>
        <li>Sizi arkadaş olarak ekleyebilir</li>
        <li>Sizinle iletişim kurabilir</li>
      </ul>
      <div class="unblock-user-buttons">
        <button id="confirmUnblockBtn" class="btn primary">Engeli Kaldır</button>
        <button id="cancelUnblockBtn" class="btn secondary">İptal</button>
      </div>
    </div>
  `;
  
  // Modalı body'e ekle
  document.body.appendChild(modal);
  
  // Modalı göster
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  
  // Onay düğmesi olayı
  const confirmBtn = document.getElementById('confirmUnblockBtn');
  confirmBtn.addEventListener('click', () => {
    // Kullanıcı engelini kaldır
    socket.emit('unblockUser', { username }, (response) => {
      if (response.success) {
        showUnblockedUserNotification(username);
        updateUIForUnblockedUser(username);
      } else {
        showErrorNotification('Kullanıcı engeli kaldırılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
      
      // Modalı kapat
      closeModal(modal);
    });
  });
  
  // İptal düğmesi olayı
  const cancelBtn = document.getElementById('cancelUnblockBtn');
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
 * Engellenen kullanıcılar listesini gösterir
 * @param {Object} socket - Socket.io socket
 */
function showBlockedUsersList(socket) {
  // Engellenen kullanıcıları getir
  socket.emit('getBlockedUsers', {}, (response) => {
    if (!response.success) {
      showErrorNotification('Engellenen kullanıcılar getirilirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      return;
    }
    
    const blockedUsers = response.blockedUsers || [];
    
    // Modal oluştur
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'blockedUsersModal';
    
    // Modal içeriği
    modal.innerHTML = `
      <div class="modal-content blocked-users-modal">
        <h2>Engellenen Kullanıcılar</h2>
        <div class="blocked-users-list">
          ${blockedUsers.length > 0 
            ? blockedUsers.map(user => `
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
            `).join('')
            : '<div class="no-blocked-users">Engellediğiniz kullanıcı bulunmamaktadır.</div>'
          }
        </div>
        <button id="closeBlockedUsersBtn" class="btn secondary">Kapat</button>
      </div>
    `;
    
    // Modalı body'e ekle
    document.body.appendChild(modal);
    
    // Modalı göster
    setTimeout(() => {
      modal.classList.add('show');
    }, 10);
    
    // Kapatma düğmesi olayı
    const closeBtn = document.getElementById('closeBlockedUsersBtn');
    closeBtn.addEventListener('click', () => {
      closeModal(modal);
    });
    
    // Dışarı tıklama ile kapatma
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal);
      }
    });
    
    // Engel kaldırma düğmesi olayları
    const unblockBtns = modal.querySelectorAll('.unblock-user-btn');
    unblockBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const username = btn.dataset.username;
        closeModal(modal);
        showUnblockUserConfirmation(username, socket);
      });
    });
  });
}

/**
 * Kullanıcı engellendiğinde UI'ı günceller
 * @param {string} username - Engellenen kullanıcı adı
 */
function updateUIForBlockedUser(username) {
  // Arkadaş listesinden kaldır
  const friendItems = document.querySelectorAll(`.friend-item[data-username="${username}"]`);
  friendItems.forEach(item => {
    item.classList.add('blocked-user');
    
    // Engelleme düğmesini güncelle
    const blockBtn = item.querySelector('.block-user-btn');
    if (blockBtn) {
      blockBtn.innerHTML = `
        <span class="material-icons">remove_circle</span>
        <span>Engeli Kaldır</span>
      `;
      blockBtn.classList.remove('block-user-btn');
      blockBtn.classList.add('unblock-user-btn');
    }
  });
  
  // DM sohbetlerini güncelle
  const dmItems = document.querySelectorAll(`.dm-item[data-username="${username}"]`);
  dmItems.forEach(item => {
    item.classList.add('blocked-user');
  });
  
  // Aktif DM sohbetini güncelle
  const activeDM = document.querySelector('#dmMessages');
  if (activeDM && activeDM.dataset.friend === username) {
    const dmInputBar = document.querySelector('#dmChatInputBar');
    if (dmInputBar) {
      dmInputBar.innerHTML = `
        <div class="blocked-user-message">
          <span class="material-icons">block</span>
          <p>Bu kullanıcıyı engellediniz. Mesaj gönderemezsiniz.</p>
          <button class="unblock-user-btn" data-username="${username}">Engeli Kaldır</button>
        </div>
      `;
    }
  }
}

/**
 * Kullanıcı engeli kaldırıldığında UI'ı günceller
 * @param {string} username - Engeli kaldırılan kullanıcı adı
 */
function updateUIForUnblockedUser(username) {
  // Arkadaş listesindeki görünümü güncelle
  const friendItems = document.querySelectorAll(`.friend-item[data-username="${username}"]`);
  friendItems.forEach(item => {
    item.classList.remove('blocked-user');
    
    // Engelleme düğmesini güncelle
    const unblockBtn = item.querySelector('.unblock-user-btn');
    if (unblockBtn) {
      unblockBtn.innerHTML = `
        <span class="material-icons">block</span>
        <span>Engelle</span>
      `;
      unblockBtn.classList.remove('unblock-user-btn');
      unblockBtn.classList.add('block-user-btn');
    }
  });
  
  // DM sohbetlerini güncelle
  const dmItems = document.querySelectorAll(`.dm-item[data-username="${username}"]`);
  dmItems.forEach(item => {
    item.classList.remove('blocked-user');
  });
  
  // Aktif DM sohbetini güncelle
  const activeDM = document.querySelector('#dmMessages');
  if (activeDM && activeDM.dataset.friend === username) {
    // DM giriş çubuğunu yeniden yükle
    location.reload(); // Basit çözüm, gerçek uygulamada daha zarif bir yöntem kullanılabilir
  }
}

/**
 * Kullanıcı engellendiğinde bildirim gösterir
 * @param {string} username - Engellenen kullanıcı adı
 */
function showBlockedUserNotification(username) {
  showNotification({
    title: 'Kullanıcı Engellendi',
    message: `${username} adlı kullanıcı engellendi.`,
    type: 'info',
    duration: 3000
  });
}

/**
 * Kullanıcı engeli kaldırıldığında bildirim gösterir
 * @param {string} username - Engeli kaldırılan kullanıcı adı
 */
function showUnblockedUserNotification(username) {
  showNotification({
    title: 'Kullanıcı Engeli Kaldırıldı',
    message: `${username} adlı kullanıcının engeli kaldırıldı.`,
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
