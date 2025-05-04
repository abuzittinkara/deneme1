/**
 * public/src/ts/channelManager.ts
 * Kanal yönetimi modülü
 * Kanal oluşturma, düzenleme ve silme işlevlerini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Kanal yanıtı arayüzü
interface ChannelResponse {
  success: boolean;
  message?: string;
  channel?: Channel;
  channels?: Channel[];
}

// Kanal arayüzü
interface Channel {
  id: string;
  name: string;
  type: 'text' | 'voice';
  description?: string;
  position?: number;
  categoryId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Kanal değişikliği olayı arayüzü
type ChannelChangedEvent = CustomEvent<{
  newChannel: string;
  channelType: string;
}>;

/**
 * Kanal yönetimi özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initChannelManager(socket: Socket): void {
  // Kanal oluşturma formunu dinle
  document.addEventListener('submit', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'createChannelForm') {
      e.preventDefault();
      handleCreateChannel(target as HTMLFormElement, socket);
    }
  });

  // Kanal düzenleme formunu dinle
  document.addEventListener('submit', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'editChannelForm') {
      e.preventDefault();
      handleEditChannel(target as HTMLFormElement, socket);
    }
  });

  // Kanal silme butonlarını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.delete-channel-btn')) {
      const deleteBtn = target.closest('.delete-channel-btn') as HTMLElement;
      const channelId = deleteBtn.dataset['channelId'];
      const channelName = deleteBtn.dataset['channelName'];

      if (channelId && channelName) {
        confirmDeleteChannel(channelId, channelName, socket);
      }
    }
  });

  // Kanal yönetimi butonunu dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('#manageChannelsBtn')) {
      const groupId = (window as any).currentGroup;
      if (groupId) {
        openChannelManager(groupId, socket);
      }
    }
  });

  // Kanal oluşturma butonunu dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('#createChannelBtn')) {
      const groupId = (window as any).currentGroup;
      if (groupId) {
        openCreateChannelModal(groupId, socket);
      }
    }
  });

  // Kanal düzenleme butonlarını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.edit-channel-btn')) {
      const editBtn = target.closest('.edit-channel-btn') as HTMLElement;
      const channelId = editBtn.dataset['channelId'];

      if (channelId) {
        openEditChannelModal(channelId, socket);
      }
    }
  });

  // Kanala tıklama olayını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const channelItem = target.closest('.channel-item');

    if (channelItem) {
      const channelId = (channelItem as HTMLElement).dataset['channelId'];
      const channelType = (channelItem as HTMLElement).dataset['channelType'];

      if (channelId && channelType) {
        selectChannel(channelId, channelType, socket);
      }
    }
  });

  // Socket olaylarını dinle
  socket.on('channelCreated', (data: { channel: Channel }) => {
    refreshChannels(socket);
    showToast(`"${data.channel.name}" kanalı oluşturuldu`, 'success');
  });

  socket.on('channelUpdated', (data: { channel: Channel }) => {
    refreshChannels(socket);
    showToast(`"${data.channel.name}" kanalı güncellendi`, 'success');
  });

  socket.on('channelDeleted', (data: { channelId: string; channelName: string }) => {
    refreshChannels(socket);
    showToast(`"${data.channelName}" kanalı silindi`, 'success');
  });

  socket.on('roomUsers', (users: { id: string; username: string }[]) => {
    updateChannelUsers(users);
  });
}

/**
 * Kanal oluşturma formunu işler
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleCreateChannel(form: HTMLFormElement, socket: Socket): void {
  const nameInput = form.querySelector('#channelName') as HTMLInputElement;
  const typeSelect = form.querySelector('#channelType') as HTMLSelectElement;
  const descriptionInput = form.querySelector('#channelDescription') as HTMLTextAreaElement;
  const categorySelect = form.querySelector('#channelCategory') as HTMLSelectElement;

  if (!nameInput || !typeSelect) {
    showToast('Form alanları bulunamadı', 'error');
    return;
  }

  const groupId = (window as any).currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }

  const name = nameInput.value.trim();
  const type = typeSelect.value as 'text' | 'voice';
  const description = descriptionInput?.value.trim() || '';
  const categoryId = categorySelect?.value !== 'none' ? categorySelect?.value : null;

  if (!name) {
    showToast('Kanal adı boş olamaz', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Kanal oluşturuluyor...');

  // Kanal oluştur
  socket.emit(
    'createChannel',
    {
      groupId,
      name,
      type,
      description,
      categoryId,
    },
    (response: ChannelResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast(`"${name}" kanalı başarıyla oluşturuldu`, 'success');

        // Formu sıfırla
        form.reset();

        // Modalı kapat
        const modal = document.getElementById('createChannelModal');
        if (modal) {
          modal.style.display = 'none';
        }

        // Kanalları yenile
        refreshChannels(socket);
      } else {
        showToast('Kanal oluşturulamadı: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Kanal düzenleme formunu işler
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleEditChannel(form: HTMLFormElement, socket: Socket): void {
  const channelIdInput = form.querySelector('#editChannelId') as HTMLInputElement;
  const nameInput = form.querySelector('#editChannelName') as HTMLInputElement;
  const descriptionInput = form.querySelector('#editChannelDescription') as HTMLTextAreaElement;
  const categorySelect = form.querySelector('#editChannelCategory') as HTMLSelectElement;

  if (!channelIdInput || !nameInput) {
    showToast('Form alanları bulunamadı', 'error');
    return;
  }

  const groupId = (window as any).currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }

  const channelId = channelIdInput.value;
  const name = nameInput.value.trim();
  const description = descriptionInput?.value.trim() || '';
  const categoryId = categorySelect?.value !== 'none' ? categorySelect?.value : null;

  if (!channelId) {
    showToast('Kanal ID bulunamadı', 'error');
    return;
  }

  if (!name) {
    showToast('Kanal adı boş olamaz', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Kanal güncelleniyor...');

  // Kanal güncelle
  socket.emit(
    'updateChannel',
    {
      groupId,
      channelId,
      name,
      description,
      categoryId,
    },
    (response: ChannelResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast(`"${name}" kanalı başarıyla güncellendi`, 'success');

        // Modalı kapat
        const modal = document.getElementById('editChannelModal');
        if (modal) {
          modal.style.display = 'none';
        }

        // Kanalları yenile
        refreshChannels(socket);
      } else {
        showToast('Kanal güncellenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Kanal silme işlemini onaylar
 * @param channelId - Kanal ID'si
 * @param channelName - Kanal adı
 * @param socket - Socket.io socket
 */
function confirmDeleteChannel(channelId: string, channelName: string, socket: Socket): void {
  if (
    confirm(`"${channelName}" kanalını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)
  ) {
    deleteChannel(channelId, socket);
  }
}

/**
 * Kanal siler
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 */
function deleteChannel(channelId: string, socket: Socket): void {
  const groupId = (window as any).currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Kanal siliniyor...');

  // Kanal sil
  socket.emit(
    'deleteChannel',
    {
      groupId,
      channelId,
    },
    (response: ChannelResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast('Kanal başarıyla silindi', 'success');

        // Kanalları yenile
        refreshChannels(socket);
      } else {
        showToast('Kanal silinemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Kanal yöneticisini açar
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function openChannelManager(groupId: string, socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Kanallar yükleniyor...');

  // Kanalları getir
  socket.emit(
    'getChannels',
    {
      groupId,
    },
    (response: ChannelResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success && response.channels) {
        showChannelManager(response.channels, groupId, socket);
      } else {
        showToast('Kanallar yüklenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Kanal yöneticisini gösterir
 * @param channels - Kanallar listesi
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function showChannelManager(channels: Channel[], groupId: string, socket: Socket): void {
  // Modalı oluştur
  let modal = document.getElementById('channelManagerModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'channelManagerModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  // Kanalları listele
  let channelsHtml = '';

  if (channels.length === 0) {
    channelsHtml = '<p>Henüz hiç kanal yok.</p>';
  } else {
    channelsHtml = `
      <table class="channels-table">
        <thead>
          <tr>
            <th>Kanal Adı</th>
            <th>Tür</th>
            <th>Açıklama</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          ${channels
            .map(
              channel => `
            <tr>
              <td>${channel.name}</td>
              <td>${getChannelTypeText(channel.type)}</td>
              <td>${channel.description || '-'}</td>
              <td>
                <button class="btn small edit-channel-btn" data-channel-id="${
                  channel.id
                }" data-channel-name="${channel.name}">Düzenle</button>
                <button class="btn small danger delete-channel-btn" data-channel-id="${
                  channel.id
                }" data-channel-name="${channel.name}">Sil</button>
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  // Modal içeriğini oluştur
  modal.innerHTML = `
    <div class="modal-content">
      <h2>Kanal Yönetimi</h2>

      <div class="channel-actions">
        <button id="createChannelBtn" class="btn primary">Yeni Kanal Oluştur</button>
      </div>

      <div class="channels-list">
        ${channelsHtml}
      </div>

      <button id="closeChannelManagerBtn" class="btn secondary">Kapat</button>
    </div>
  `;

  // Modalı göster
  modal.style.display = 'block';

  // Yeni kanal oluşturma düğmesi
  const createChannelBtn = modal.querySelector('#createChannelBtn');
  if (createChannelBtn) {
    createChannelBtn.addEventListener('click', () => {
      openCreateChannelModal(groupId, socket);
    });
  }

  // Kapatma düğmesi
  const closeBtn = modal.querySelector('#closeChannelManagerBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal?.remove();
    });
  }

  // Düzenleme düğmeleri
  const editBtns = modal.querySelectorAll('.edit-channel-btn');
  editBtns.forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      const channelId = target.dataset['channelId'];

      if (channelId) {
        openEditChannelModal(channelId, socket);
      }
    });
  });
}

/**
 * Kanal oluşturma modalını açar
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function openCreateChannelModal(groupId: string, socket: Socket): void {
  // Kategorileri getir
  socket.emit(
    'getCategoriesForGroup',
    { groupId },
    (response: { success: boolean; categories?: any[]; message?: string }) => {
      if (response.success) {
        showCreateChannelModal(groupId, response.categories || [], socket);
      } else {
        showToast('Kategoriler yüklenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Kanal oluşturma modalını gösterir
 * @param groupId - Grup ID'si
 * @param categories - Kategoriler listesi
 * @param socket - Socket.io socket
 */
function showCreateChannelModal(groupId: string, categories: any[], socket: Socket): void {
  // Modalı oluştur
  let modal = document.getElementById('createChannelModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'createChannelModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  // Kategori seçeneklerini oluştur
  const categoryOptions = categories
    .map(category => `<option value="${category.id}">${category.name}</option>`)
    .join('');

  modal.innerHTML = `
    <div class="modal-content">
      <h2>Yeni Kanal Oluştur</h2>

      <form id="createChannelForm">
        <div class="form-group">
          <label for="channelName">Kanal Adı:</label>
          <input type="text" id="channelName" placeholder="Kanal adı" required>
        </div>

        <div class="form-group">
          <label for="channelType">Tür:</label>
          <select id="channelType">
            <option value="text">Metin Kanalı</option>
            <option value="voice">Ses Kanalı</option>
          </select>
        </div>

        <div class="form-group">
          <label for="channelDescription">Açıklama:</label>
          <textarea id="channelDescription" placeholder="Kanal açıklaması"></textarea>
        </div>

        <div class="form-group">
          <label for="channelCategory">Kategori:</label>
          <select id="channelCategory">
            <option value="none">Kategorisiz</option>
            ${categoryOptions}
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn primary">Oluştur</button>
          <button type="button" id="cancelCreateChannelBtn" class="btn secondary">İptal</button>
        </div>
      </form>
    </div>
  `;

  // Modalı göster
  modal.style.display = 'block';

  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelCreateChannelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal?.remove();
    });
  }
}

/**
 * Kanal düzenleme modalını açar
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 */
function openEditChannelModal(channelId: string, socket: Socket): void {
  const groupId = (window as any).currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Kanal bilgileri yükleniyor...');

  // Kanal bilgilerini ve kategorileri getir
  Promise.all([
    new Promise<Channel>((resolve, reject) => {
      socket.emit('getChannel', { groupId, channelId }, (response: ChannelResponse) => {
        if (response.success && response.channel) {
          resolve(response.channel);
        } else {
          reject(new Error(response.message || 'Kanal bilgileri yüklenemedi'));
        }
      });
    }),
    new Promise<any[]>((resolve, reject) => {
      socket.emit(
        'getCategoriesForGroup',
        { groupId },
        (response: { success: boolean; categories?: any[]; message?: string }) => {
          if (response.success) {
            resolve(response.categories || []);
          } else {
            reject(new Error(response.message || 'Kategoriler yüklenemedi'));
          }
        }
      );
    }),
  ])
    .then(([channel, categories]) => {
      // Yükleme göstergesini gizle
      hideLoading();

      // Düzenleme modalını göster
      showEditChannelModal(channel, categories, socket);
    })
    .catch(error => {
      // Yükleme göstergesini gizle
      hideLoading();

      showToast(error.message, 'error');
    });
}

/**
 * Kanal düzenleme modalını gösterir
 * @param channel - Kanal bilgileri
 * @param categories - Kategoriler listesi
 * @param socket - Socket.io socket
 */
function showEditChannelModal(channel: Channel, categories: any[], socket: Socket): void {
  // Modalı oluştur
  let modal = document.getElementById('editChannelModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editChannelModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  // Kategori seçeneklerini oluştur
  const categoryOptions = categories
    .map(
      category =>
        `<option value="${category.id}" ${channel.categoryId === category.id ? 'selected' : ''}>${
          category.name
        }</option>`
    )
    .join('');

  modal.innerHTML = `
    <div class="modal-content">
      <h2>"${channel.name}" Kanalını Düzenle</h2>

      <form id="editChannelForm">
        <input type="hidden" id="editChannelId" value="${channel.id}">

        <div class="form-group">
          <label for="editChannelName">Kanal Adı:</label>
          <input type="text" id="editChannelName" value="${
            channel.name
          }" placeholder="Kanal adı" required>
        </div>

        <div class="form-group">
          <label for="editChannelDescription">Açıklama:</label>
          <textarea id="editChannelDescription" placeholder="Kanal açıklaması">${
            channel.description || ''
          }</textarea>
        </div>

        <div class="form-group">
          <label for="editChannelCategory">Kategori:</label>
          <select id="editChannelCategory">
            <option value="none" ${!channel.categoryId ? 'selected' : ''}>Kategorisiz</option>
            ${categoryOptions}
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn primary">Kaydet</button>
          <button type="button" id="cancelEditChannelBtn" class="btn secondary">İptal</button>
        </div>
      </form>
    </div>
  `;

  // Modalı göster
  modal.style.display = 'block';

  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelEditChannelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal?.remove();
    });
  }
}

/**
 * Kanalı seçer
 * @param channelId - Kanal ID'si
 * @param channelType - Kanal türü
 * @param socket - Socket.io socket
 */
function selectChannel(channelId: string, channelType: string, socket: Socket): void {
  const groupId = (window as any).currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }

  // Tüm kanal öğelerinden 'active' sınıfını kaldır
  const channelItems = document.querySelectorAll('.channel-item');
  channelItems.forEach(item => item.classList.remove('active'));

  // Seçilen kanala 'active' sınıfı ekle
  const selectedChannelItem = document.querySelector(
    `.channel-item[data-channel-id="${channelId}"]`
  );
  if (selectedChannelItem) {
    selectedChannelItem.classList.add('active');
  }

  // Kanal başlığını güncelle
  const channelNameElement = document.getElementById('channelName');
  if (channelNameElement) {
    const selectedChannelName = selectedChannelItem?.querySelector('.channel-name');
    if (selectedChannelName) {
      channelNameElement.textContent = selectedChannelName.textContent || '';
    }
  }

  // Kanal türüne göre işlem yap
  if (channelType === 'text') {
    // Metin kanalı için mesajları yükle
    loadMessages(groupId, channelId, socket);
  } else if (channelType === 'voice') {
    // Ses kanalı için ses bağlantısını başlat
    initVoiceChannel(groupId, channelId, socket);
  }

  // Kanala katıl
  socket.emit(
    'joinChannel',
    { groupId, channelId },
    (response: { success: boolean; message?: string }) => {
      if (!response.success) {
        showToast(
          'Kanala katılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'),
          'error'
        );
      }
    }
  );

  // Kanal değişikliği olayını yayınla
  document.dispatchEvent(
    new CustomEvent<{ newChannel: string; channelType: string }>('channelChanged', {
      detail: { newChannel: channelId, channelType },
    })
  );
}

/**
 * Mesajları yükler
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 */
function loadMessages(groupId: string, channelId: string, socket: Socket): void {
  // Bu fonksiyon, messageManager modülünde uygulanmıştır
}

/**
 * Ses kanalını başlatır
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param socket - Socket.io socket
 */
function initVoiceChannel(groupId: string, channelId: string, socket: Socket): void {
  // Bu fonksiyon, voiceChannel modülünde uygulanmıştır
}

/**
 * Kanalları yeniler
 * @param socket - Socket.io socket
 */
function refreshChannels(socket: Socket): void {
  const groupId = (window as any).currentGroup;
  if (!groupId) {
    return;
  }

  // Kanalları yeniden yükle
  socket.emit('getChannels', { groupId }, (response: ChannelResponse) => {
    if (response.success && response.channels) {
      // Kanalları güncelle
      renderChannelsList(response.channels);
    }
  });
}

/**
 * Kanal kullanıcılarını günceller
 * @param users - Kullanıcılar listesi
 */
function updateChannelUsers(users: { id: string; username: string }[]): void {
  // Kanal kullanıcıları listesini güncelle
  const channelUsersList = document.getElementById('channelUsersList');
  if (!channelUsersList) {
    return;
  }

  // Listeyi temizle
  channelUsersList.innerHTML = '';

  // Kullanıcıları ekle
  users.forEach(user => {
    const userItem = document.createElement('div');
    userItem.className = 'user-item';
    userItem.dataset['username'] = user.username;
    userItem.innerHTML = `
      <div class="user-avatar">
        <span class="material-icons">account_circle</span>
      </div>
      <div class="user-name">${user.username}</div>
    `;
    channelUsersList.appendChild(userItem);
  });
}

/**
 * Kanal türünün metin karşılığını döndürür
 * @param type - Kanal türü
 * @returns Kanal türü metni
 */
function getChannelTypeText(type: string): string {
  switch (type) {
    case 'text':
      return 'Metin Kanalı';
    case 'voice':
      return 'Ses Kanalı';
    default:
      return 'Bilinmeyen Kanal';
  }
}

/**
 * Kanallar listesini görüntüler
 * @param channels - Kanallar listesi
 */
function renderChannelsList(channels: Channel[]): void {
  // Kanallar listesini güncelle
  const channelsList = document.getElementById('channelsList');
  if (!channelsList) {
    return;
  }

  // Listeyi temizle
  channelsList.innerHTML = '';

  // Kanalları ekle
  channels.forEach(channel => {
    const channelItem = document.createElement('div');
    channelItem.className = 'channel-item';
    channelItem.dataset['channelId'] = channel.id;
    channelItem.dataset['channelType'] = channel.type;
    channelItem.innerHTML = `
      <div class="channel-icon">
        <span class="material-icons">${channel.type === 'text' ? 'tag' : 'volume_up'}</span>
      </div>
      <div class="channel-name">${channel.name}</div>
    `;
    channelsList.appendChild(channelItem);
  });
}

// Yardımcı fonksiyonlar
const showToast =
  (window as any).feedback?.showToast ||
  function (message: string) {
    alert(message);
  };
const showLoading = (window as any).showLoading || function () {};
const hideLoading = (window as any).hideLoading || function () {};
