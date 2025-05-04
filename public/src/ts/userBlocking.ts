/**
 * public/src/ts/userBlocking.ts
 * Kullanıcı engelleme modülü
 * Kullanıcıların diğer kullanıcıları engellemesini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Engellenen kullanıcı arayüzü
interface BlockedUser {
  username: string;
}

// Engelleme yanıtı arayüzü
interface BlockResponse {
  success: boolean;
  message?: string;
  blockedUsers?: BlockedUser[];
}

// Bildirim seçenekleri arayüzü
interface NotificationOptions {
  title: string;
  message: string;
  type: string;
  duration?: number;
}

/**
 * Kullanıcı engelleme özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initUserBlocking(socket: Socket): void {
  // Engelleme düğmesine tıklama olayı
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.block-user-btn')) {
      const blockBtn = target.closest('.block-user-btn') as HTMLElement;
      const username = blockBtn.dataset['username'];
      if (username) {
        showBlockUserConfirmation(username, socket);
      }
    }

    // Engeli kaldırma düğmesine tıklama olayı
    if (target.closest('.unblock-user-btn')) {
      const unblockBtn = target.closest('.unblock-user-btn') as HTMLElement;
      const username = unblockBtn.dataset['username'];
      if (username) {
        showUnblockUserConfirmation(username, socket);
      }
    }

    // Engellenen kullanıcılar listesini görüntüleme düğmesine tıklama olayı
    if (target.closest('#viewBlockedUsersBtn')) {
      showBlockedUsersList(socket);
    }
  });

  // Socket olaylarını dinle
  socket.on('userBlocked', (data: { username: string }) => {
    showBlockedUserNotification(data.username);
    updateUIForBlockedUser(data.username);
  });

  socket.on('userUnblocked', (data: { username: string }) => {
    showUnblockedUserNotification(data.username);
    updateUIForUnblockedUser(data.username);
  });
}

/**
 * Kullanıcı engelleme onay modalını gösterir
 * @param username - Engellenecek kullanıcı adı
 * @param socket - Socket.io socket
 */
function showBlockUserConfirmation(username: string, socket: Socket): void {
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
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      // Kullanıcıyı engelle
      socket.emit('blockUser', { username }, (response: BlockResponse) => {
        if (response.success) {
          showBlockedUserNotification(username);
          updateUIForBlockedUser(username);
        } else {
          showErrorNotification(
            'Kullanıcı engellenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
          );
        }

        // Modalı kapat
        closeModal(modal);
      });
    });
  }

  // İptal düğmesi olayı
  const cancelBtn = document.getElementById('cancelBlockBtn');
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
 * Kullanıcı engel kaldırma onay modalını gösterir
 * @param username - Engeli kaldırılacak kullanıcı adı
 * @param socket - Socket.io socket
 */
function showUnblockUserConfirmation(username: string, socket: Socket): void {
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
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      // Kullanıcı engelini kaldır
      socket.emit('unblockUser', { username }, (response: BlockResponse) => {
        if (response.success) {
          showUnblockedUserNotification(username);
          updateUIForUnblockedUser(username);
        } else {
          showErrorNotification(
            'Kullanıcı engeli kaldırılırken bir hata oluştu: ' +
              (response.message || 'Bilinmeyen hata')
          );
        }

        // Modalı kapat
        closeModal(modal);
      });
    });
  }

  // İptal düğmesi olayı
  const cancelBtn = document.getElementById('cancelUnblockBtn');
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
 * Engellenen kullanıcılar listesini gösterir
 * @param socket - Socket.io socket
 */
function showBlockedUsersList(socket: Socket): void {
  // Engellenen kullanıcıları getir
  socket.emit('getBlockedUsers', {}, (response: BlockResponse) => {
    if (!response.success) {
      showErrorNotification(
        'Engellenen kullanıcılar getirilirken bir hata oluştu: ' +
          (response.message || 'Bilinmeyen hata')
      );
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
          ${
            blockedUsers.length > 0
              ? blockedUsers
                  .map(
                    user => `
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
            `
                  )
                  .join('')
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

    // Engel kaldırma düğmesi olayları
    const unblockBtns = modal.querySelectorAll('.unblock-user-btn');
    unblockBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const username = (btn as HTMLElement).dataset['username'];
        if (username) {
          closeModal(modal);
          showUnblockUserConfirmation(username, socket);
        }
      });
    });
  });
}

/**
 * Kullanıcı engellendiğinde UI'ı günceller
 * @param username - Engellenen kullanıcı adı
 */
function updateUIForBlockedUser(username: string): void {
  // Arkadaş listesinden kaldır
  const friendItems = document.querySelectorAll(`.friend-item[data-username="${username}"]`);
  friendItems.forEach(item => {
    item.classList.add('blocked-user');

    // Engelleme düğmesini güncelle
    const blockBtn = item.querySelector('.block-user-btn');
    if (blockBtn && blockBtn.parentNode) {
      const unblockBtn = document.createElement('button');
      unblockBtn.className = 'unblock-user-btn';
      unblockBtn.dataset['username'] = username;
      unblockBtn.innerHTML = `
        <span class="material-icons">remove_circle</span>
        <span>Engeli Kaldır</span>
      `;

      blockBtn.parentNode.replaceChild(unblockBtn, blockBtn);
    }
  });

  // DM sohbetlerini güncelle
  const dmItems = document.querySelectorAll(`.dm-item[data-username="${username}"]`);
  dmItems.forEach(item => {
    item.classList.add('blocked-user');
  });

  // Aktif DM sohbetini güncelle
  const activeDM = document.querySelector('#dmMessages') as HTMLElement;
  if (activeDM && activeDM.dataset['friend'] === username) {
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
 * @param username - Engeli kaldırılan kullanıcı adı
 */
function updateUIForUnblockedUser(username: string): void {
  // Arkadaş listesindeki görünümü güncelle
  const friendItems = document.querySelectorAll(`.friend-item[data-username="${username}"]`);
  friendItems.forEach(item => {
    item.classList.remove('blocked-user');

    // Engelleme düğmesini güncelle
    const unblockBtn = item.querySelector('.unblock-user-btn');
    if (unblockBtn && unblockBtn.parentNode) {
      const blockBtn = document.createElement('button');
      blockBtn.className = 'block-user-btn';
      blockBtn.dataset['username'] = username;
      blockBtn.innerHTML = `
        <span class="material-icons">block</span>
        <span>Engelle</span>
      `;

      unblockBtn.parentNode.replaceChild(blockBtn, unblockBtn);
    }
  });

  // DM sohbetlerini güncelle
  const dmItems = document.querySelectorAll(`.dm-item[data-username="${username}"]`);
  dmItems.forEach(item => {
    item.classList.remove('blocked-user');
  });

  // Aktif DM sohbetini güncelle
  const activeDM = document.querySelector('#dmMessages') as HTMLElement;
  if (activeDM && activeDM.dataset['friend'] === username) {
    // DM giriş çubuğunu yeniden yükle
    location.reload(); // Basit çözüm, gerçek uygulamada daha zarif bir yöntem kullanılabilir
  }
}

/**
 * Kullanıcı engellendiğinde bildirim gösterir
 * @param username - Engellenen kullanıcı adı
 */
function showBlockedUserNotification(username: string): void {
  showNotification({
    title: 'Kullanıcı Engellendi',
    message: `${username} adlı kullanıcı engellendi.`,
    type: 'info',
    duration: 3000,
  });
}

/**
 * Kullanıcı engeli kaldırıldığında bildirim gösterir
 * @param username - Engeli kaldırılan kullanıcı adı
 */
function showUnblockedUserNotification(username: string): void {
  showNotification({
    title: 'Kullanıcı Engeli Kaldırıldı',
    message: `${username} adlı kullanıcının engeli kaldırıldı.`,
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
