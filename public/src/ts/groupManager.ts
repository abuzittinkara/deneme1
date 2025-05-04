/**
 * public/src/ts/groupManager.ts
 * Grup yönetimi modülü
 * Grup oluşturma, düzenleme ve silme işlevlerini sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Grup yanıtı arayüzü
interface GroupResponse {
  success: boolean;
  message?: string;
  group?: Group;
  groups?: Group[];
}

// Grup arayüzü
interface Group {
  id: string;
  name: string;
  description?: string;
  owner: string;
  type?: 'public' | 'private' | 'secret';
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Grup yönetimi özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initGroupManager(socket: Socket): void {
  // Grup oluşturma formunu dinle
  document.addEventListener('submit', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'createGroupForm') {
      e.preventDefault();
      handleCreateGroup(target as HTMLFormElement, socket);
    }
  });

  // Grup düzenleme formunu dinle
  document.addEventListener('submit', (e: Event) => {
    const target = e.target as HTMLElement;
    if (target.id === 'editGroupForm') {
      e.preventDefault();
      handleEditGroup(target as HTMLFormElement, socket);
    }
  });

  // Grup silme butonlarını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.delete-group-btn')) {
      const deleteBtn = target.closest('.delete-group-btn') as HTMLElement;
      const groupId = deleteBtn.dataset['groupId'];
      const groupName = deleteBtn.dataset['groupName'];

      if (groupId && groupName) {
        confirmDeleteGroup(groupId, groupName, socket);
      }
    }
  });

  // Grup yönetimi butonunu dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('#manageGroupsBtn')) {
      openGroupManager(socket);
    }
  });

  // Gruba katılma butonlarını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.join-group-btn')) {
      const joinBtn = target.closest('.join-group-btn') as HTMLElement;
      const groupId = joinBtn.dataset['groupId'];

      if (groupId) {
        joinGroup(groupId, socket);
      }
    }
  });

  // Gruptan ayrılma butonlarını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.leave-group-btn')) {
      const leaveBtn = target.closest('.leave-group-btn') as HTMLElement;
      const groupId = leaveBtn.dataset['groupId'];
      const groupName = leaveBtn.dataset['groupName'];

      if (groupId && groupName) {
        confirmLeaveGroup(groupId, groupName, socket);
      }
    }
  });

  // Grup davet butonlarını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.invite-to-group-btn')) {
      const inviteBtn = target.closest('.invite-to-group-btn') as HTMLElement;
      const groupId = inviteBtn.dataset['groupId'];
      const groupName = inviteBtn.dataset['groupName'];

      if (groupId && groupName) {
        openInviteToGroupModal(groupId, groupName, socket);
      }
    }
  });

  // Socket olaylarını dinle
  socket.on('groupCreated', (data: { group: Group }) => {
    refreshGroups(socket);
    showToast(`"${data.group.name}" grubu oluşturuldu`, 'success');
  });

  socket.on('groupUpdated', (data: { group: Group }) => {
    refreshGroups(socket);
    showToast(`"${data.group.name}" grubu güncellendi`, 'success');
  });

  socket.on('groupDeleted', (data: { groupId: string; groupName: string }) => {
    refreshGroups(socket);
    showToast(`"${data.groupName}" grubu silindi`, 'success');
  });

  socket.on('userJoinedGroup', (data: { groupId: string; groupName: string; username: string }) => {
    refreshGroups(socket);
    showToast(`${data.username} "${data.groupName}" grubuna katıldı`, 'info');
  });

  socket.on('userLeftGroup', (data: { groupId: string; groupName: string; username: string }) => {
    refreshGroups(socket);
    showToast(`${data.username} "${data.groupName}" grubundan ayrıldı`, 'info');
  });

  socket.on(
    'userInvitedToGroup',
    (data: { groupId: string; groupName: string; username: string; invitedBy: string }) => {
      showToast(`${data.invitedBy} sizi "${data.groupName}" grubuna davet etti`, 'info');
    }
  );

  socket.on(
    'groupInviteAccepted',
    (data: { groupId: string; groupName: string; username: string }) => {
      refreshGroups(socket);
      showToast(
        `${data.username} "${data.groupName}" grubuna katılma davetinizi kabul etti`,
        'success'
      );
    }
  );

  socket.on(
    'groupInviteRejected',
    (data: { groupId: string; groupName: string; username: string }) => {
      showToast(
        `${data.username} "${data.groupName}" grubuna katılma davetinizi reddetti`,
        'warning'
      );
    }
  );
}

/**
 * Grup oluşturma formunu işler
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleCreateGroup(form: HTMLFormElement, socket: Socket): void {
  const nameInput = form.querySelector('#groupName') as HTMLInputElement;
  const descriptionInput = form.querySelector('#groupDescription') as HTMLTextAreaElement;
  const typeSelect = form.querySelector('#groupType') as HTMLSelectElement;

  if (!nameInput || !descriptionInput || !typeSelect) {
    showToast('Form alanları bulunamadı', 'error');
    return;
  }

  const name = nameInput.value.trim();
  const description = descriptionInput.value.trim();
  const type = typeSelect.value as 'public' | 'private' | 'secret';

  if (!name) {
    showToast('Grup adı boş olamaz', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Grup oluşturuluyor...');

  // Grup oluştur
  socket.emit(
    'createGroup',
    {
      name,
      description,
      type,
    },
    (response: GroupResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast(`"${name}" grubu başarıyla oluşturuldu`, 'success');

        // Formu sıfırla
        form.reset();

        // Modalı kapat
        const modal = document.getElementById('createGroupModal');
        if (modal) {
          modal.style.display = 'none';
        }

        // Grupları yenile
        refreshGroups(socket);
      } else {
        showToast('Grup oluşturulamadı: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Grup düzenleme formunu işler
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleEditGroup(form: HTMLFormElement, socket: Socket): void {
  const groupIdInput = form.querySelector('#editGroupId') as HTMLInputElement;
  const nameInput = form.querySelector('#editGroupName') as HTMLInputElement;
  const descriptionInput = form.querySelector('#editGroupDescription') as HTMLTextAreaElement;
  const typeSelect = form.querySelector('#editGroupType') as HTMLSelectElement;

  if (!groupIdInput || !nameInput || !descriptionInput || !typeSelect) {
    showToast('Form alanları bulunamadı', 'error');
    return;
  }

  const groupId = groupIdInput.value;
  const name = nameInput.value.trim();
  const description = descriptionInput.value.trim();
  const type = typeSelect.value as 'public' | 'private' | 'secret';

  if (!groupId) {
    showToast('Grup ID bulunamadı', 'error');
    return;
  }

  if (!name) {
    showToast('Grup adı boş olamaz', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Grup güncelleniyor...');

  // Grup güncelle
  socket.emit(
    'updateGroup',
    {
      groupId,
      name,
      description,
      type,
    },
    (response: GroupResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast(`"${name}" grubu başarıyla güncellendi`, 'success');

        // Modalı kapat
        const modal = document.getElementById('editGroupModal');
        if (modal) {
          modal.style.display = 'none';
        }

        // Grupları yenile
        refreshGroups(socket);
      } else {
        showToast('Grup güncellenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Grup silme işlemini onaylar
 * @param groupId - Grup ID'si
 * @param groupName - Grup adı
 * @param socket - Socket.io socket
 */
function confirmDeleteGroup(groupId: string, groupName: string, socket: Socket): void {
  if (
    confirm(`"${groupName}" grubunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)
  ) {
    deleteGroup(groupId, socket);
  }
}

/**
 * Grup siler
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function deleteGroup(groupId: string, socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Grup siliniyor...');

  // Grup sil
  socket.emit(
    'deleteGroup',
    {
      groupId,
    },
    (response: GroupResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast('Grup başarıyla silindi', 'success');

        // Grupları yenile
        refreshGroups(socket);
      } else {
        showToast('Grup silinemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Gruptan ayrılma işlemini onaylar
 * @param groupId - Grup ID'si
 * @param groupName - Grup adı
 * @param socket - Socket.io socket
 */
function confirmLeaveGroup(groupId: string, groupName: string, socket: Socket): void {
  if (confirm(`"${groupName}" grubundan ayrılmak istediğinizden emin misiniz?`)) {
    leaveGroup(groupId, socket);
  }
}

/**
 * Gruptan ayrılır
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function leaveGroup(groupId: string, socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Gruptan ayrılıyor...');

  // Gruptan ayrıl
  socket.emit(
    'leaveGroup',
    {
      groupId,
    },
    (response: GroupResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast('Gruptan başarıyla ayrıldınız', 'success');

        // Grupları yenile
        refreshGroups(socket);
      } else {
        showToast('Gruptan ayrılınamadı: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Gruba katılır
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function joinGroup(groupId: string, socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Gruba katılıyor...');

  // Gruba katıl
  socket.emit(
    'joinGroup',
    {
      groupId,
    },
    (response: GroupResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast('Gruba başarıyla katıldınız', 'success');

        // Grupları yenile
        refreshGroups(socket);
      } else {
        showToast('Gruba katılınamadı: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Grup davet modalını açar
 * @param groupId - Grup ID'si
 * @param groupName - Grup adı
 * @param socket - Socket.io socket
 */
function openInviteToGroupModal(groupId: string, groupName: string, socket: Socket): void {
  // Modalı oluştur
  let modal = document.getElementById('inviteToGroupModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'inviteToGroupModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <h2>"${groupName}" Grubuna Davet Et</h2>

      <form id="inviteToGroupForm">
        <input type="hidden" id="inviteGroupId" value="${groupId}">
        <input type="hidden" id="inviteGroupName" value="${groupName}">

        <div class="form-group">
          <label for="inviteUsername">Kullanıcı Adı:</label>
          <input type="text" id="inviteUsername" placeholder="Davet edilecek kullanıcı adı" required>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn primary">Davet Gönder</button>
          <button type="button" id="cancelInviteBtn" class="btn secondary">İptal</button>
        </div>
      </form>
    </div>
  `;

  // Modalı göster
  modal.style.display = 'block';

  // Form gönderme olayı
  const form = modal.querySelector('#inviteToGroupForm') as HTMLFormElement;
  if (form) {
    form.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      handleInviteToGroup(form, socket);
    });
  }

  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelInviteBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal?.remove();
    });
  }
}

/**
 * Gruba davet formunu işler
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleInviteToGroup(form: HTMLFormElement, socket: Socket): void {
  const groupIdInput = form.querySelector('#inviteGroupId') as HTMLInputElement;
  const groupNameInput = form.querySelector('#inviteGroupName') as HTMLInputElement;
  const usernameInput = form.querySelector('#inviteUsername') as HTMLInputElement;

  if (!groupIdInput || !groupNameInput || !usernameInput) {
    showToast('Form alanları bulunamadı', 'error');
    return;
  }

  const groupId = groupIdInput.value;
  const groupName = groupNameInput.value;
  const username = usernameInput.value.trim();

  if (!groupId) {
    showToast('Grup ID bulunamadı', 'error');
    return;
  }

  if (!username) {
    showToast('Kullanıcı adı boş olamaz', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Davet gönderiliyor...');

  // Davet gönder
  socket.emit(
    'inviteToGroup',
    {
      groupId,
      username,
    },
    (response: { success: boolean; message?: string }) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast(`${username} kullanıcısına davet gönderildi`, 'success');

        // Formu sıfırla
        form.reset();

        // Modalı kapat
        const modal = document.getElementById('inviteToGroupModal');
        if (modal) {
          modal.remove();
        }
      } else {
        showToast('Davet gönderilemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Grup yöneticisini açar
 * @param socket - Socket.io socket
 */
function openGroupManager(socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Gruplar yükleniyor...');

  // Grupları getir
  socket.emit('getGroups', (response: GroupResponse) => {
    // Yükleme göstergesini gizle
    hideLoading();

    if (response.success && response.groups) {
      showGroupManager(response.groups, socket);
    } else {
      showToast('Gruplar yüklenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
    }
  });
}

/**
 * Grup yöneticisini gösterir
 * @param groups - Gruplar listesi
 * @param socket - Socket.io socket
 */
function showGroupManager(groups: Group[], socket: Socket): void {
  // Modalı oluştur
  let modal = document.getElementById('groupManagerModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'groupManagerModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  // Grupları listele
  let groupsHtml = '';

  if (groups.length === 0) {
    groupsHtml = '<p>Henüz hiç grup yok.</p>';
  } else {
    groupsHtml = `
      <table class="groups-table">
        <thead>
          <tr>
            <th>Grup Adı</th>
            <th>Açıklama</th>
            <th>Tür</th>
            <th>İşlemler</th>
          </tr>
        </thead>
        <tbody>
          ${groups
            .map(
              group => `
            <tr>
              <td>${group.name}</td>
              <td>${group.description || '-'}</td>
              <td>${getGroupTypeText(group.type)}</td>
              <td>
                <button class="btn small edit-group-btn" data-group-id="${
                  group.id
                }" data-group-name="${group.name}">Düzenle</button>
                <button class="btn small danger delete-group-btn" data-group-id="${
                  group.id
                }" data-group-name="${group.name}">Sil</button>
                <button class="btn small invite-to-group-btn" data-group-id="${
                  group.id
                }" data-group-name="${group.name}">Davet Et</button>
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
      <h2>Grup Yönetimi</h2>

      <div class="group-actions">
        <button id="createGroupBtn" class="btn primary">Yeni Grup Oluştur</button>
      </div>

      <div class="groups-list">
        ${groupsHtml}
      </div>

      <button id="closeGroupManagerBtn" class="btn secondary">Kapat</button>
    </div>
  `;

  // Modalı göster
  modal.style.display = 'block';

  // Yeni grup oluşturma düğmesi
  const createGroupBtn = modal.querySelector('#createGroupBtn');
  if (createGroupBtn) {
    createGroupBtn.addEventListener('click', () => {
      openCreateGroupModal(socket);
    });
  }

  // Kapatma düğmesi
  const closeBtn = modal.querySelector('#closeGroupManagerBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal?.remove();
    });
  }

  // Düzenleme düğmeleri
  const editBtns = modal.querySelectorAll('.edit-group-btn');
  editBtns.forEach(btn => {
    btn.addEventListener('click', (e: Event) => {
      const target = e.target as HTMLElement;
      const groupId = target.dataset['groupId'];
      const groupName = target.dataset['groupName'];

      if (groupId && groupName) {
        openEditGroupModal(groupId, socket);
      }
    });
  });
}

/**
 * Grup oluşturma modalını açar
 * @param socket - Socket.io socket
 */
function openCreateGroupModal(socket: Socket): void {
  // Modalı oluştur
  let modal = document.getElementById('createGroupModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'createGroupModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <h2>Yeni Grup Oluştur</h2>

      <form id="createGroupForm">
        <div class="form-group">
          <label for="groupName">Grup Adı:</label>
          <input type="text" id="groupName" placeholder="Grup adı" required>
        </div>

        <div class="form-group">
          <label for="groupDescription">Açıklama:</label>
          <textarea id="groupDescription" placeholder="Grup açıklaması"></textarea>
        </div>

        <div class="form-group">
          <label for="groupType">Tür:</label>
          <select id="groupType">
            <option value="public">Herkese Açık</option>
            <option value="private">Gizli</option>
            <option value="secret">Gizli (Listede Görünmez)</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn primary">Oluştur</button>
          <button type="button" id="cancelCreateGroupBtn" class="btn secondary">İptal</button>
        </div>
      </form>
    </div>
  `;

  // Modalı göster
  modal.style.display = 'block';

  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelCreateGroupBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal?.remove();
    });
  }
}

/**
 * Grup düzenleme modalını açar
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function openEditGroupModal(groupId: string, socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Grup bilgileri yükleniyor...');

  // Grup bilgilerini getir
  socket.emit('getGroup', { groupId }, (response: GroupResponse) => {
    // Yükleme göstergesini gizle
    hideLoading();

    if (response.success && response.group) {
      showEditGroupModal(response.group, socket);
    } else {
      showToast('Grup bilgileri yüklenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
    }
  });
}

/**
 * Grup düzenleme modalını gösterir
 * @param group - Grup bilgileri
 * @param socket - Socket.io socket
 */
function showEditGroupModal(group: Group, socket: Socket): void {
  // Modalı oluştur
  let modal = document.getElementById('editGroupModal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'editGroupModal';
    modal.className = 'modal';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-content">
      <h2>"${group.name}" Grubunu Düzenle</h2>

      <form id="editGroupForm">
        <input type="hidden" id="editGroupId" value="${group.id}">

        <div class="form-group">
          <label for="editGroupName">Grup Adı:</label>
          <input type="text" id="editGroupName" value="${
            group.name
          }" placeholder="Grup adı" required>
        </div>

        <div class="form-group">
          <label for="editGroupDescription">Açıklama:</label>
          <textarea id="editGroupDescription" placeholder="Grup açıklaması">${
            group.description || ''
          }</textarea>
        </div>

        <div class="form-group">
          <label for="editGroupType">Tür:</label>
          <select id="editGroupType">
            <option value="public" ${
              group.type === 'public' ? 'selected' : ''
            }>Herkese Açık</option>
            <option value="private" ${group.type === 'private' ? 'selected' : ''}>Gizli</option>
            <option value="secret" ${
              group.type === 'secret' ? 'selected' : ''
            }>Gizli (Listede Görünmez)</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn primary">Kaydet</button>
          <button type="button" id="cancelEditGroupBtn" class="btn secondary">İptal</button>
        </div>
      </form>
    </div>
  `;

  // Modalı göster
  modal.style.display = 'block';

  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelEditGroupBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal?.remove();
    });
  }
}

/**
 * Grupları yeniler
 * @param socket - Socket.io socket
 */
function refreshGroups(socket: Socket): void {
  socket.emit('getGroups', (response: GroupResponse) => {
    if (response.success && response.groups) {
      // Grup listesini güncelle
      updateGroupsList(response.groups);
    }
  });
}

/**
 * Grup listesini günceller
 * @param groups - Gruplar listesi
 */
function updateGroupsList(groups: Group[]): void {
  const groupList = document.getElementById('groupList');
  if (!groupList) {
    return;
  }

  // Grup listesini temizle
  groupList.innerHTML = '';

  // Grupları ekle
  groups.forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    groupItem.dataset['groupId'] = group.id;
    groupItem.innerHTML = `
      <div class="group-icon">
        ${group.name.charAt(0).toUpperCase()}
      </div>
      <div class="group-tooltip">${group.name}</div>
    `;

    // Grup türüne göre sınıf ekle
    if (group.type) {
      groupItem.classList.add(`group-type-${group.type}`);
    }

    // Gruba tıklama olayı
    groupItem.addEventListener('click', () => {
      // Aktif grubu değiştir
      selectGroup(group.id);
    });

    groupList.appendChild(groupItem);
  });
}

/**
 * Grup türünün metin karşılığını döndürür
 * @param type - Grup türü
 * @returns Grup türü metni
 */
function getGroupTypeText(type?: string): string {
  switch (type) {
    case 'public':
      return 'Herkese Açık';
    case 'private':
      return 'Gizli';
    case 'secret':
      return 'Gizli (Listede Görünmez)';
    default:
      return 'Herkese Açık';
  }
}

/**
 * Grubu seçer
 * @param groupId - Grup ID'si
 */
function selectGroup(groupId: string): void {
  // Aktif grubu güncelle
  (window as any).currentGroup = groupId;

  // Tüm grup öğelerinden 'active' sınıfını kaldır
  const groupItems = document.querySelectorAll('.group-item');
  groupItems.forEach(item => item.classList.remove('active'));

  // Seçilen gruba 'active' sınıfı ekle
  const selectedGroupItem = document.querySelector(`.group-item[data-group-id="${groupId}"]`);
  if (selectedGroupItem) {
    selectedGroupItem.classList.add('active');
  }

  // Grup başlığını güncelle
  const groupNameElement = document.getElementById('groupName');
  if (groupNameElement) {
    const selectedGroupTooltip = selectedGroupItem?.querySelector('.group-tooltip');
    if (selectedGroupTooltip) {
      groupNameElement.textContent = selectedGroupTooltip.textContent || '';
    }
  }

  // Kanalları yükle
  loadChannels(groupId);
}

/**
 * Kanalları yükler
 * @param groupId - Grup ID'si
 */
function loadChannels(groupId: string): void {
  const socket = (window as any).socket;
  if (!socket) {
    return;
  }

  // Kanalları getir
  socket.emit(
    'getChannels',
    { groupId },
    (response: { success: boolean; channels?: any[]; message?: string }) => {
      if (response.success && response.channels) {
        // Kanalları güncelle
        updateChannelsList(response.channels);
      } else {
        console.error('Kanallar yüklenemedi:', response.message);
      }
    }
  );
}

/**
 * Kanal listesini günceller
 * @param channels - Kanallar listesi
 */
function updateChannelsList(channels: any[]): void {
  // Bu fonksiyon, channelManager modülünde uygulanmıştır
}

// Yardımcı fonksiyonlar
const showToast =
  (window as any).feedback?.showToast ||
  function (message: string) {
    alert(message);
  };
const showLoading = (window as any).showLoading || function () {};
const hideLoading = (window as any).hideLoading || function () {};
