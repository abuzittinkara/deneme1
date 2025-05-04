/**
 * public/src/ts/roleManager.ts
 * Rol yönetimi modülü
 * Grup rolleri ve izinleri için kullanıcı arayüzü işlevleri sağlar
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Rol arayüzü
interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: Record<string, boolean>;
  memberCount?: number;
}

// Rol yanıtı arayüzü
interface RoleResponse {
  success: boolean;
  message?: string;
  roles?: Role[];
}

/**
 * Rol yönetimi özelliğini başlatır
 * @param socket - Socket.io socket
 */
export function initRoleManager(socket: Socket): void {
  // Rol oluşturma formunu dinle
  document.addEventListener('submit', (e: Event) => {
    if ((e.target as HTMLElement).id === 'createRoleForm') {
      e.preventDefault();
      handleCreateRole(e.target as HTMLFormElement, socket);
    }
  });

  // Rol atama formunu dinle
  document.addEventListener('submit', (e: Event) => {
    if ((e.target as HTMLElement).id === 'assignRoleForm') {
      e.preventDefault();
      handleAssignRole(e.target as HTMLFormElement, socket);
    }
  });

  // Rol düzenleme formunu dinle
  document.addEventListener('submit', (e: Event) => {
    if ((e.target as HTMLElement).id === 'editRoleForm') {
      e.preventDefault();
      handleEditRole(e.target as HTMLFormElement, socket);
    }
  });

  // Rol silme butonlarını dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.delete-role-btn')) {
      const deleteBtn = target.closest('.delete-role-btn') as HTMLElement;
      const roleId = deleteBtn.dataset['roleId'];
      const roleName = deleteBtn.dataset['roleName'];

      if (roleId && roleName) {
        confirmDeleteRole(roleId, roleName, socket);
      }
    }
  });

  // Rol yönetimi butonunu dinle
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('#manageRolesBtn')) {
      const groupId = (window as any).currentGroup;
      if (groupId) {
        openRoleManager(groupId, socket);
      }
    }
  });
}

/**
 * Rol oluşturma işleyicisi
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleCreateRole(form: HTMLFormElement, socket: Socket): void {
  const groupId = (window as any).currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }

  const nameInput = form.querySelector('#roleName') as HTMLInputElement;
  const colorInput = form.querySelector('#roleColor') as HTMLInputElement;

  const name = nameInput.value;
  const color = colorInput.value;

  // İzinleri topla
  const permissions: Record<string, boolean> = {};
  form.querySelectorAll('input[type="checkbox"][name^="perm_"]').forEach(checkbox => {
    const permName = (checkbox as HTMLInputElement).name.replace('perm_', '');
    permissions[permName] = (checkbox as HTMLInputElement).checked;
  });

  // Yükleme göstergesini göster
  showLoading('Rol oluşturuluyor...');

  // Rol oluştur
  socket.emit(
    'createRole',
    {
      groupId,
      name,
      color,
      permissions,
    },
    (response: RoleResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast(`"${name}" rolü başarıyla oluşturuldu`, 'success');

        // Formu sıfırla
        form.reset();

        // Rol yöneticisini yenile
        openRoleManager(groupId, socket);
      } else {
        showToast('Rol oluşturulamadı: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Rol atama işleyicisi
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleAssignRole(form: HTMLFormElement, socket: Socket): void {
  const groupId = (window as any).currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }

  const usernameInput = form.querySelector('#assignUsername') as HTMLInputElement;
  const roleIdSelect = form.querySelector('#assignRoleId') as HTMLSelectElement;

  const username = usernameInput.value;
  const roleId = roleIdSelect.value;

  if (!username || !roleId) {
    showToast('Lütfen tüm alanları doldurun', 'error');
    return;
  }

  // Yükleme göstergesini göster
  showLoading('Rol atanıyor...');

  // Rol ata
  socket.emit(
    'assignRole',
    {
      groupId,
      username,
      roleId,
    },
    (response: RoleResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast('Rol başarıyla atandı', 'success');

        // Formu sıfırla
        form.reset();
      } else {
        showToast('Rol atanamadı: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Rol düzenleme işleyicisi
 * @param form - Form elementi
 * @param socket - Socket.io socket
 */
function handleEditRole(form: HTMLFormElement, socket: Socket): void {
  const roleId = form.dataset['roleId'];
  if (!roleId) {
    showToast('Rol ID bulunamadı', 'error');
    return;
  }

  const nameInput = form.querySelector('#editRoleName') as HTMLInputElement;
  const colorInput = form.querySelector('#editRoleColor') as HTMLInputElement;

  const name = nameInput.value;
  const color = colorInput.value;

  // İzinleri topla
  const permissions: Record<string, boolean> = {};
  form.querySelectorAll('input[type="checkbox"][name^="edit_perm_"]').forEach(checkbox => {
    const permName = (checkbox as HTMLInputElement).name.replace('edit_perm_', '');
    permissions[permName] = (checkbox as HTMLInputElement).checked;
  });

  // Yükleme göstergesini göster
  showLoading('Rol güncelleniyor...');

  // Rol güncelle
  socket.emit(
    'updateRole',
    {
      roleId,
      name,
      color,
      permissions,
    },
    (response: RoleResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast(`"${name}" rolü başarıyla güncellendi`, 'success');

        // Rol yöneticisini kapat
        const modal = document.getElementById('editRoleModal');
        if (modal) {
          modal.remove();
        }

        // Rol yöneticisini yenile
        openRoleManager((window as any).currentGroup, socket);
      } else {
        showToast('Rol güncellenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Rol silme onayı gösterir
 * @param roleId - Rol ID'si
 * @param roleName - Rol adı
 * @param socket - Socket.io socket
 */
function confirmDeleteRole(roleId: string, roleName: string, socket: Socket): void {
  if ((window as any).showConfirm) {
    (window as any)
      .showConfirm(`"${roleName}" rolünü silmek istediğinizden emin misiniz?`, 'Sil', 'İptal')
      .then((confirmed: boolean) => {
        if (confirmed) {
          deleteRole(roleId, socket);
        }
      });
  } else {
    // Fallback: Basit bir confirm kullan
    if (confirm(`"${roleName}" rolünü silmek istediğinizden emin misiniz?`)) {
      deleteRole(roleId, socket);
    }
  }
}

/**
 * Rol siler
 * @param roleId - Rol ID'si
 * @param socket - Socket.io socket
 */
function deleteRole(roleId: string, socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Rol siliniyor...');

  // Rol sil
  socket.emit(
    'deleteRole',
    {
      roleId,
    },
    (response: RoleResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success) {
        showToast('Rol başarıyla silindi', 'success');

        // Rol yöneticisini yenile
        openRoleManager((window as any).currentGroup, socket);
      } else {
        showToast('Rol silinemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Rol yöneticisini açar
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function openRoleManager(groupId: string, socket: Socket): void {
  // Yükleme göstergesini göster
  showLoading('Roller yükleniyor...');

  // Rolleri getir
  socket.emit(
    'getRoles',
    {
      groupId,
    },
    (response: RoleResponse) => {
      // Yükleme göstergesini gizle
      hideLoading();

      if (response.success && response.roles) {
        showRoleManager(response.roles, groupId, socket);
      } else {
        showToast('Roller yüklenemedi: ' + (response.message || 'Bilinmeyen hata'), 'error');
      }
    }
  );
}

/**
 * Rol yöneticisini gösterir
 * @param roles - Roller listesi
 * @param groupId - Grup ID'si
 * @param socket - Socket.io socket
 */
function showRoleManager(roles: Role[], groupId: string, socket: Socket): void {
  // Mevcut rol yöneticisini kaldır
  const existingModal = document.getElementById('roleManagerModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Rol yöneticisi modalı oluştur
  const modal = document.createElement('div');
  modal.id = 'roleManagerModal';
  modal.className = 'modal';

  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content role-manager-modal">
      <h2>Rol Yönetimi</h2>

      <div class="role-manager-tabs">
        <button class="role-tab active" data-tab="roles-list">Roller</button>
        <button class="role-tab" data-tab="create-role">Rol Oluştur</button>
        <button class="role-tab" data-tab="assign-role">Rol Ata</button>
      </div>

      <div class="role-manager-content">
        <div class="role-tab-content active" id="roles-list">
          <div class="roles-list">
            ${
              roles.length > 0
                ? roles
                    .map(
                      role => `
                <div class="role-item" style="border-left: 4px solid ${role.color || '#99AAB5'}">
                  <div class="role-info">
                    <div class="role-name">${role.name}</div>
                    <div class="role-members">${role.memberCount || 0} üye</div>
                  </div>
                  <div class="role-actions">
                    <button class="edit-role-btn" data-role-id="${role.id}">
                      <span class="material-icons">edit</span>
                    </button>
                    <button class="delete-role-btn" data-role-id="${role.id}" data-role-name="${
                        role.name
                      }">
                      <span class="material-icons">delete</span>
                    </button>
                  </div>
                </div>
              `
                    )
                    .join('')
                : '<div class="no-roles">Henüz rol bulunmuyor.</div>'
            }
          </div>
        </div>

        <div class="role-tab-content" id="create-role">
          <form id="createRoleForm">
            <div class="form-group">
              <label for="roleName">Rol Adı</label>
              <input type="text" id="roleName" name="roleName" required>
            </div>

            <div class="form-group">
              <label for="roleColor">Rol Rengi</label>
              <input type="color" id="roleColor" name="roleColor" value="#99AAB5">
            </div>

            <div class="form-group">
              <label>İzinler</label>
              <div class="permissions-list">
                <div class="permission-item">
                  <input type="checkbox" id="perm_administrator" name="perm_administrator">
                  <label for="perm_administrator">Yönetici</label>
                  <span class="permission-desc">Tüm izinlere sahip olur</span>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_manageChannels" name="perm_manageChannels">
                  <label for="perm_manageChannels">Kanalları Yönet</label>
                  <span class="permission-desc">Kanal oluşturma, düzenleme ve silme</span>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_manageRoles" name="perm_manageRoles">
                  <label for="perm_manageRoles">Rolleri Yönet</label>
                  <span class="permission-desc">Rol oluşturma, düzenleme ve silme</span>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_manageMessages" name="perm_manageMessages">
                  <label for="perm_manageMessages">Mesajları Yönet</label>
                  <span class="permission-desc">Mesajları silme ve düzenleme</span>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_kickMembers" name="perm_kickMembers">
                  <label for="perm_kickMembers">Üyeleri At</label>
                  <span class="permission-desc">Üyeleri gruptan çıkarma</span>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_banMembers" name="perm_banMembers">
                  <label for="perm_banMembers">Üyeleri Yasakla</label>
                  <span class="permission-desc">Üyeleri gruptan yasaklama</span>
                </div>
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn primary">Rol Oluştur</button>
            </div>
          </form>
        </div>

        <div class="role-tab-content" id="assign-role">
          <form id="assignRoleForm">
            <div class="form-group">
              <label for="assignUsername">Kullanıcı Adı</label>
              <input type="text" id="assignUsername" name="assignUsername" required>
            </div>

            <div class="form-group">
              <label for="assignRoleId">Rol</label>
              <select id="assignRoleId" name="assignRoleId" required>
                <option value="">Rol Seçin</option>
                ${roles.map(role => `<option value="${role.id}">${role.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn primary">Rol Ata</button>
            </div>
          </form>
        </div>
      </div>

      <button id="closeRoleManagerBtn" class="btn secondary">Kapat</button>
    </div>
  `;

  // Modalı body'e ekle
  document.body.appendChild(modal);

  // Tab değiştirme olayları
  const tabs = modal.querySelectorAll('.role-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Aktif tab'ı güncelle
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Tab içeriğini göster
      const tabId = (tab as HTMLElement).dataset['tab'];
      const tabContents = modal.querySelectorAll('.role-tab-content');
      tabContents.forEach(content => {
        content.classList.remove('active');
      });

      if (tabId) {
        const activeContent = modal.querySelector(`#${tabId}`);
        if (activeContent) {
          activeContent.classList.add('active');
        }
      }
    });
  });

  // Kapatma düğmesi olayı
  const closeBtn = modal.querySelector('#closeRoleManagerBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.remove();
    });
  }

  // Rol düzenleme düğmeleri
  const editButtons = modal.querySelectorAll('.edit-role-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', () => {
      const roleId = (button as HTMLElement).dataset['roleId'];
      if (roleId) {
        const role = roles.find(r => r.id === roleId);
        if (role) {
          editRole(roleId, role, socket);
        }
      }
    });
  });
}

/**
 * Rol düzenleme modalını gösterir
 * @param roleId - Rol ID'si
 * @param role - Rol nesnesi
 * @param socket - Socket.io socket
 */
function editRole(roleId: string, role: Role, socket: Socket): void {
  if (!role) {
    showToast('Rol bulunamadı', 'error');
    return;
  }

  // Mevcut modalı kaldır
  const existingModal = document.getElementById('editRoleModal');
  if (existingModal) {
    existingModal.remove();
  }

  // Rol düzenleme modalı oluştur
  const modal = document.createElement('div');
  modal.id = 'editRoleModal';
  modal.className = 'modal';

  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content edit-role-modal">
      <h2>Rol Düzenle: ${role.name}</h2>

      <form id="editRoleForm" data-role-id="${roleId}">
        <div class="form-group">
          <label for="editRoleName">Rol Adı</label>
          <input type="text" id="editRoleName" name="editRoleName" value="${role.name}" required>
        </div>

        <div class="form-group">
          <label for="editRoleColor">Rol Rengi</label>
          <input type="color" id="editRoleColor" name="editRoleColor" value="${
            role.color || '#99AAB5'
          }">
        </div>

        <div class="form-group">
          <label>İzinler</label>
          <div class="permissions-list">
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_administrator" name="edit_perm_administrator" ${
                role.permissions['administrator'] ? 'checked' : ''
              }>
              <label for="edit_perm_administrator">Yönetici</label>
              <span class="permission-desc">Tüm izinlere sahip olur</span>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_manageChannels" name="edit_perm_manageChannels" ${
                role.permissions['manageChannels'] ? 'checked' : ''
              }>
              <label for="edit_perm_manageChannels">Kanalları Yönet</label>
              <span class="permission-desc">Kanal oluşturma, düzenleme ve silme</span>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_manageRoles" name="edit_perm_manageRoles" ${
                role.permissions['manageRoles'] ? 'checked' : ''
              }>
              <label for="edit_perm_manageRoles">Rolleri Yönet</label>
              <span class="permission-desc">Rol oluşturma, düzenleme ve silme</span>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_manageMessages" name="edit_perm_manageMessages" ${
                role.permissions['manageMessages'] ? 'checked' : ''
              }>
              <label for="edit_perm_manageMessages">Mesajları Yönet</label>
              <span class="permission-desc">Mesajları silme ve düzenleme</span>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_kickMembers" name="edit_perm_kickMembers" ${
                role.permissions['kickMembers'] ? 'checked' : ''
              }>
              <label for="edit_perm_kickMembers">Üyeleri At</label>
              <span class="permission-desc">Üyeleri gruptan çıkarma</span>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_banMembers" name="edit_perm_banMembers" ${
                role.permissions['banMembers'] ? 'checked' : ''
              }>
              <label for="edit_perm_banMembers">Üyeleri Yasakla</label>
              <span class="permission-desc">Üyeleri gruptan yasaklama</span>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn primary">Kaydet</button>
          <button type="button" id="cancelEditRoleBtn" class="btn secondary">İptal</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelEditRoleBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });
  }
}

// Global değişkenlere erişim için
const showToast =
  (window as any).showToast ||
  function (message: string) {
    alert(message);
  };
const showLoading = (window as any).showLoading || function () {};
const hideLoading = (window as any).hideLoading || function () {};
