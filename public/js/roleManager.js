// public/js/roleManager.js

/**
 * Rol yönetimi modülü
 * Grup rolleri ve izinleri için kullanıcı arayüzü işlevleri sağlar
 */

/**
 * Rol yönetimi özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initRoleManager(socket) {
  // Rol oluşturma formunu dinle
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'createRoleForm') {
      e.preventDefault();
      handleCreateRole(e.target, socket);
    }
  });
  
  // Rol atama formunu dinle
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'assignRoleForm') {
      e.preventDefault();
      handleAssignRole(e.target, socket);
    }
  });
  
  // Rol düzenleme formunu dinle
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'editRoleForm') {
      e.preventDefault();
      handleEditRole(e.target, socket);
    }
  });
  
  // Rol silme butonlarını dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('.delete-role-btn')) {
      const roleId = e.target.closest('.delete-role-btn').dataset.roleId;
      const roleName = e.target.closest('.delete-role-btn').dataset.roleName;
      
      if (roleId) {
        confirmDeleteRole(roleId, roleName, socket);
      }
    }
  });
  
  // Rol yönetimi butonunu dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('#manageRolesBtn')) {
      const groupId = currentGroup;
      if (groupId) {
        openRoleManager(groupId, socket);
      }
    }
  });
}

/**
 * Rol oluşturma işleyicisi
 * @param {HTMLFormElement} form - Form elementi
 * @param {Object} socket - Socket.io socket
 */
function handleCreateRole(form, socket) {
  const groupId = currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }
  
  const name = form.querySelector('#roleName').value;
  const color = form.querySelector('#roleColor').value;
  
  // İzinleri topla
  const permissions = {};
  form.querySelectorAll('input[type="checkbox"][name^="perm_"]').forEach(checkbox => {
    const permName = checkbox.name.replace('perm_', '');
    permissions[permName] = checkbox.checked;
  });
  
  // Yükleme göstergesini göster
  showLoading('Rol oluşturuluyor...');
  
  // Rol oluştur
  socket.emit('createRole', {
    groupId,
    name,
    color,
    permissions
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast(`"${name}" rolü başarıyla oluşturuldu`, 'success');
      
      // Formu sıfırla
      form.reset();
      
      // Rol yöneticisini yenile
      openRoleManager(groupId, socket);
    } else {
      showToast('Rol oluşturulamadı: ' + response.message, 'error');
    }
  });
}

/**
 * Rol atama işleyicisi
 * @param {HTMLFormElement} form - Form elementi
 * @param {Object} socket - Socket.io socket
 */
function handleAssignRole(form, socket) {
  const groupId = currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }
  
  const username = form.querySelector('#assignUsername').value;
  const roleId = form.querySelector('#assignRoleId').value;
  
  if (!username || !roleId) {
    showToast('Kullanıcı adı ve rol seçilmelidir', 'error');
    return;
  }
  
  // Yükleme göstergesini göster
  showLoading('Rol atanıyor...');
  
  // Rol ata
  socket.emit('assignRole', {
    groupId,
    username,
    roleId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast('Rol başarıyla atandı', 'success');
      
      // Formu sıfırla
      form.reset();
    } else {
      showToast('Rol atanamadı: ' + response.message, 'error');
    }
  });
}

/**
 * Rol düzenleme işleyicisi
 * @param {HTMLFormElement} form - Form elementi
 * @param {Object} socket - Socket.io socket
 */
function handleEditRole(form, socket) {
  const roleId = form.dataset.roleId;
  if (!roleId) {
    showToast('Rol ID bulunamadı', 'error');
    return;
  }
  
  const name = form.querySelector('#editRoleName').value;
  const color = form.querySelector('#editRoleColor').value;
  
  // İzinleri topla
  const permissions = {};
  form.querySelectorAll('input[type="checkbox"][name^="edit_perm_"]').forEach(checkbox => {
    const permName = checkbox.name.replace('edit_perm_', '');
    permissions[permName] = checkbox.checked;
  });
  
  // Yükleme göstergesini göster
  showLoading('Rol güncelleniyor...');
  
  // Rol güncelle
  socket.emit('updateRole', {
    roleId,
    name,
    color,
    permissions
  }, (response) => {
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
      openRoleManager(currentGroup, socket);
    } else {
      showToast('Rol güncellenemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Rol silme onayı gösterir
 * @param {string} roleId - Rol ID'si
 * @param {string} roleName - Rol adı
 * @param {Object} socket - Socket.io socket
 */
function confirmDeleteRole(roleId, roleName, socket) {
  if (window.showConfirm) {
    window.showConfirm(`"${roleName}" rolünü silmek istediğinizden emin misiniz?`, 'Sil', 'İptal')
      .then(confirmed => {
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
 * @param {string} roleId - Rol ID'si
 * @param {Object} socket - Socket.io socket
 */
function deleteRole(roleId, socket) {
  // Yükleme göstergesini göster
  showLoading('Rol siliniyor...');
  
  // Rol sil
  socket.emit('deleteRole', {
    roleId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast('Rol başarıyla silindi', 'success');
      
      // Rol yöneticisini yenile
      openRoleManager(currentGroup, socket);
    } else {
      showToast('Rol silinemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Rol yöneticisini açar
 * @param {string} groupId - Grup ID'si
 * @param {Object} socket - Socket.io socket
 */
function openRoleManager(groupId, socket) {
  // Yükleme göstergesini göster
  showLoading('Roller yükleniyor...');
  
  // Rolleri getir
  socket.emit('getRoles', {
    groupId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showRoleManager(response.roles, groupId, socket);
    } else {
      showToast('Roller yüklenemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Rol yöneticisini gösterir
 * @param {Array} roles - Roller listesi
 * @param {string} groupId - Grup ID'si
 * @param {Object} socket - Socket.io socket
 */
function showRoleManager(roles, groupId, socket) {
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
            ${roles.length > 0 ? 
              roles.map(role => `
                <div class="role-item" style="border-left: 4px solid ${role.color || '#99AAB5'}">
                  <div class="role-info">
                    <div class="role-name">${role.name}</div>
                    <div class="role-members">${role.memberCount || 0} üye</div>
                  </div>
                  <div class="role-actions">
                    <button class="edit-role-btn" data-role-id="${role.id}">
                      <span class="material-icons">edit</span>
                    </button>
                    <button class="delete-role-btn" data-role-id="${role.id}" data-role-name="${role.name}">
                      <span class="material-icons">delete</span>
                    </button>
                  </div>
                </div>
              `).join('') : 
              '<div class="no-roles">Henüz rol bulunmuyor.</div>'
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
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_manageGroup" name="perm_manageGroup">
                  <label for="perm_manageGroup">Grubu Yönet</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_manageChannels" name="perm_manageChannels">
                  <label for="perm_manageChannels">Kanalları Yönet</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_manageRoles" name="perm_manageRoles">
                  <label for="perm_manageRoles">Rolleri Yönet</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_manageMessages" name="perm_manageMessages">
                  <label for="perm_manageMessages">Mesajları Yönet</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_kickMembers" name="perm_kickMembers">
                  <label for="perm_kickMembers">Üyeleri At</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_banMembers" name="perm_banMembers">
                  <label for="perm_banMembers">Üyeleri Yasakla</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_createInvite" name="perm_createInvite" checked>
                  <label for="perm_createInvite">Davet Oluştur</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_sendMessages" name="perm_sendMessages" checked>
                  <label for="perm_sendMessages">Mesaj Gönder</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_readMessages" name="perm_readMessages" checked>
                  <label for="perm_readMessages">Mesajları Oku</label>
                </div>
                <div class="permission-item">
                  <input type="checkbox" id="perm_attachFiles" name="perm_attachFiles" checked>
                  <label for="perm_attachFiles">Dosya Ekle</label>
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
  
  document.body.appendChild(modal);
  
  // Tab geçişleri
  const tabs = modal.querySelectorAll('.role-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Aktif tab'ı güncelle
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Aktif içeriği güncelle
      const tabContents = modal.querySelectorAll('.role-tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      
      const targetTab = tab.dataset.tab;
      modal.querySelector(`#${targetTab}`).classList.add('active');
    });
  });
  
  // Kapatma düğmesi
  const closeBtn = modal.querySelector('#closeRoleManagerBtn');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  // Rol düzenleme düğmeleri
  const editButtons = modal.querySelectorAll('.edit-role-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', () => {
      const roleId = button.dataset.roleId;
      editRole(roleId, roles.find(r => r.id === roleId), socket);
    });
  });
}

/**
 * Rol düzenleme modalını gösterir
 * @param {string} roleId - Rol ID'si
 * @param {Object} role - Rol nesnesi
 * @param {Object} socket - Socket.io socket
 */
function editRole(roleId, role, socket) {
  if (!role) {
    showToast('Rol bulunamadı', 'error');
    return;
  }
  
  // Mevcut modalı kaldır
  const existingModal = document.getElementById('editRoleModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Düzenleme modalı oluştur
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
          <input type="color" id="editRoleColor" name="editRoleColor" value="${role.color || '#99AAB5'}">
        </div>
        
        <div class="form-group">
          <label>İzinler</label>
          <div class="permissions-list">
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_administrator" name="edit_perm_administrator" ${role.permissions?.administrator ? 'checked' : ''}>
              <label for="edit_perm_administrator">Yönetici</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_manageGroup" name="edit_perm_manageGroup" ${role.permissions?.manageGroup ? 'checked' : ''}>
              <label for="edit_perm_manageGroup">Grubu Yönet</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_manageChannels" name="edit_perm_manageChannels" ${role.permissions?.manageChannels ? 'checked' : ''}>
              <label for="edit_perm_manageChannels">Kanalları Yönet</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_manageRoles" name="edit_perm_manageRoles" ${role.permissions?.manageRoles ? 'checked' : ''}>
              <label for="edit_perm_manageRoles">Rolleri Yönet</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_manageMessages" name="edit_perm_manageMessages" ${role.permissions?.manageMessages ? 'checked' : ''}>
              <label for="edit_perm_manageMessages">Mesajları Yönet</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_kickMembers" name="edit_perm_kickMembers" ${role.permissions?.kickMembers ? 'checked' : ''}>
              <label for="edit_perm_kickMembers">Üyeleri At</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_banMembers" name="edit_perm_banMembers" ${role.permissions?.banMembers ? 'checked' : ''}>
              <label for="edit_perm_banMembers">Üyeleri Yasakla</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_createInvite" name="edit_perm_createInvite" ${role.permissions?.createInvite !== false ? 'checked' : ''}>
              <label for="edit_perm_createInvite">Davet Oluştur</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_sendMessages" name="edit_perm_sendMessages" ${role.permissions?.sendMessages !== false ? 'checked' : ''}>
              <label for="edit_perm_sendMessages">Mesaj Gönder</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_readMessages" name="edit_perm_readMessages" ${role.permissions?.readMessages !== false ? 'checked' : ''}>
              <label for="edit_perm_readMessages">Mesajları Oku</label>
            </div>
            <div class="permission-item">
              <input type="checkbox" id="edit_perm_attachFiles" name="edit_perm_attachFiles" ${role.permissions?.attachFiles !== false ? 'checked' : ''}>
              <label for="edit_perm_attachFiles">Dosya Ekle</label>
            </div>
          </div>
        </div>
        
        <div class="form-actions">
          <button type="button" id="cancelEditRoleBtn" class="btn secondary">İptal</button>
          <button type="submit" class="btn primary">Kaydet</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelEditRoleBtn');
  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });
}

// Global değişkenlere erişim için
const showToast = window.showToast || function(message) { alert(message); };
const showLoading = window.showLoading || function() {};
const hideLoading = window.hideLoading || function() {};
