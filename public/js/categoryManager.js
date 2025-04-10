// public/js/categoryManager.js

/**
 * Kategori yönetimi modülü
 * Kanal kategorileri için kullanıcı arayüzü işlevleri sağlar
 */

/**
 * Kategori yönetimi özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initCategoryManager(socket) {
  // Kategori oluşturma formunu dinle
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'createCategoryForm') {
      e.preventDefault();
      handleCreateCategory(e.target, socket);
    }
  });
  
  // Kategori düzenleme formunu dinle
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'editCategoryForm') {
      e.preventDefault();
      handleEditCategory(e.target, socket);
    }
  });
  
  // Kategori silme butonlarını dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('.delete-category-btn')) {
      const categoryId = e.target.closest('.delete-category-btn').dataset.categoryId;
      const categoryName = e.target.closest('.delete-category-btn').dataset.categoryName;
      
      if (categoryId) {
        confirmDeleteCategory(categoryId, categoryName, socket);
      }
    }
  });
  
  // Kanal taşıma formunu dinle
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'moveChannelForm') {
      e.preventDefault();
      handleMoveChannel(e.target, socket);
    }
  });
  
  // Kategori yönetimi butonunu dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('#manageCategoriesBtn')) {
      const groupId = currentGroup;
      if (groupId) {
        openCategoryManager(groupId, socket);
      }
    }
  });
  
  // Kanal taşıma butonlarını dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('.move-channel-btn')) {
      const channelId = e.target.closest('.move-channel-btn').dataset.channelId;
      const channelName = e.target.closest('.move-channel-btn').dataset.channelName;
      
      if (channelId) {
        openMoveChannelModal(channelId, channelName, socket);
      }
    }
  });
  
  // Kategori başlıklarına tıklama (açma/kapama)
  document.addEventListener('click', (e) => {
    if (e.target.closest('.category-header')) {
      const categoryElement = e.target.closest('.category-header').parentNode;
      toggleCategory(categoryElement);
    }
  });
}

/**
 * Kategori oluşturma işleyicisi
 * @param {HTMLFormElement} form - Form elementi
 * @param {Object} socket - Socket.io socket
 */
function handleCreateCategory(form, socket) {
  const groupId = currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }
  
  const name = form.querySelector('#categoryName').value;
  const position = parseInt(form.querySelector('#categoryPosition').value) || 0;
  
  // Yükleme göstergesini göster
  showLoading('Kategori oluşturuluyor...');
  
  // Kategori oluştur
  socket.emit('createCategory', {
    groupId,
    name,
    position
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast(`"${name}" kategorisi başarıyla oluşturuldu`, 'success');
      
      // Formu sıfırla
      form.reset();
      
      // Kategori yöneticisini yenile
      openCategoryManager(groupId, socket);
    } else {
      showToast('Kategori oluşturulamadı: ' + response.message, 'error');
    }
  });
}

/**
 * Kategori düzenleme işleyicisi
 * @param {HTMLFormElement} form - Form elementi
 * @param {Object} socket - Socket.io socket
 */
function handleEditCategory(form, socket) {
  const categoryId = form.dataset.categoryId;
  if (!categoryId) {
    showToast('Kategori ID bulunamadı', 'error');
    return;
  }
  
  const name = form.querySelector('#editCategoryName').value;
  const position = parseInt(form.querySelector('#editCategoryPosition').value) || 0;
  
  // Yükleme göstergesini göster
  showLoading('Kategori güncelleniyor...');
  
  // Kategori güncelle
  socket.emit('updateCategory', {
    categoryId,
    name,
    position
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast(`"${name}" kategorisi başarıyla güncellendi`, 'success');
      
      // Kategori yöneticisini kapat
      const modal = document.getElementById('editCategoryModal');
      if (modal) {
        modal.remove();
      }
      
      // Kategori yöneticisini yenile
      openCategoryManager(currentGroup, socket);
    } else {
      showToast('Kategori güncellenemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Kategori silme onayı gösterir
 * @param {string} categoryId - Kategori ID'si
 * @param {string} categoryName - Kategori adı
 * @param {Object} socket - Socket.io socket
 */
function confirmDeleteCategory(categoryId, categoryName, socket) {
  if (window.showConfirm) {
    window.showConfirm(`"${categoryName}" kategorisini silmek istediğinizden emin misiniz? Bu kategorideki kanallar kategorisiz kalacaktır.`, 'Sil', 'İptal')
      .then(confirmed => {
        if (confirmed) {
          deleteCategory(categoryId, socket);
        }
      });
  } else {
    // Fallback: Basit bir confirm kullan
    if (confirm(`"${categoryName}" kategorisini silmek istediğinizden emin misiniz? Bu kategorideki kanallar kategorisiz kalacaktır.`)) {
      deleteCategory(categoryId, socket);
    }
  }
}

/**
 * Kategori siler
 * @param {string} categoryId - Kategori ID'si
 * @param {Object} socket - Socket.io socket
 */
function deleteCategory(categoryId, socket) {
  // Yükleme göstergesini göster
  showLoading('Kategori siliniyor...');
  
  // Kategori sil
  socket.emit('deleteCategory', {
    categoryId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast('Kategori başarıyla silindi', 'success');
      
      // Kategori yöneticisini yenile
      openCategoryManager(currentGroup, socket);
    } else {
      showToast('Kategori silinemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Kanal taşıma işleyicisi
 * @param {HTMLFormElement} form - Form elementi
 * @param {Object} socket - Socket.io socket
 */
function handleMoveChannel(form, socket) {
  const channelId = form.dataset.channelId;
  if (!channelId) {
    showToast('Kanal ID bulunamadı', 'error');
    return;
  }
  
  const categoryId = form.querySelector('#moveChannelCategory').value;
  
  // Yükleme göstergesini göster
  showLoading('Kanal taşınıyor...');
  
  // Kanalı taşı
  socket.emit('moveChannelToCategory', {
    channelId,
    categoryId: categoryId === 'none' ? null : categoryId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast('Kanal başarıyla taşındı', 'success');
      
      // Modalı kapat
      const modal = document.getElementById('moveChannelModal');
      if (modal) {
        modal.remove();
      }
      
      // Kanalları yenile
      refreshChannels(socket);
    } else {
      showToast('Kanal taşınamadı: ' + response.message, 'error');
    }
  });
}

/**
 * Kategori yöneticisini açar
 * @param {string} groupId - Grup ID'si
 * @param {Object} socket - Socket.io socket
 */
function openCategoryManager(groupId, socket) {
  // Yükleme göstergesini göster
  showLoading('Kategoriler yükleniyor...');
  
  // Kategorileri getir
  socket.emit('getCategoriesForGroup', {
    groupId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showCategoryManager(response.categories, groupId, socket);
    } else {
      showToast('Kategoriler yüklenemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Kategori yöneticisini gösterir
 * @param {Array} categories - Kategoriler listesi
 * @param {string} groupId - Grup ID'si
 * @param {Object} socket - Socket.io socket
 */
function showCategoryManager(categories, groupId, socket) {
  // Mevcut kategori yöneticisini kaldır
  const existingModal = document.getElementById('categoryManagerModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Kategori yöneticisi modalı oluştur
  const modal = document.createElement('div');
  modal.id = 'categoryManagerModal';
  modal.className = 'modal';
  
  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content category-manager-modal">
      <h2>Kategori Yönetimi</h2>
      
      <div class="category-manager-tabs">
        <button class="category-tab active" data-tab="categories-list">Kategoriler</button>
        <button class="category-tab" data-tab="create-category">Kategori Oluştur</button>
      </div>
      
      <div class="category-manager-content">
        <div class="category-tab-content active" id="categories-list">
          <div class="categories-list">
            ${categories.length > 0 ? 
              categories.map(category => `
                <div class="category-item">
                  <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-position">Pozisyon: ${category.position}</div>
                  </div>
                  <div class="category-actions">
                    <button class="edit-category-btn" data-category-id="${category.id}">
                      <span class="material-icons">edit</span>
                    </button>
                    <button class="delete-category-btn" data-category-id="${category.id}" data-category-name="${category.name}">
                      <span class="material-icons">delete</span>
                    </button>
                  </div>
                </div>
              `).join('') : 
              '<div class="no-categories">Henüz kategori bulunmuyor.</div>'
            }
          </div>
        </div>
        
        <div class="category-tab-content" id="create-category">
          <form id="createCategoryForm">
            <div class="form-group">
              <label for="categoryName">Kategori Adı</label>
              <input type="text" id="categoryName" name="categoryName" required>
            </div>
            
            <div class="form-group">
              <label for="categoryPosition">Pozisyon</label>
              <input type="number" id="categoryPosition" name="categoryPosition" min="0" value="0">
            </div>
            
            <div class="form-actions">
              <button type="submit" class="btn primary">Kategori Oluştur</button>
            </div>
          </form>
        </div>
      </div>
      
      <button id="closeCategoryManagerBtn" class="btn secondary">Kapat</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Tab geçişleri
  const tabs = modal.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Aktif tab'ı güncelle
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Aktif içeriği güncelle
      const tabContents = modal.querySelectorAll('.category-tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      
      const targetTab = tab.dataset.tab;
      modal.querySelector(`#${targetTab}`).classList.add('active');
    });
  });
  
  // Kapatma düğmesi
  const closeBtn = modal.querySelector('#closeCategoryManagerBtn');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
  
  // Kategori düzenleme düğmeleri
  const editButtons = modal.querySelectorAll('.edit-category-btn');
  editButtons.forEach(button => {
    button.addEventListener('click', () => {
      const categoryId = button.dataset.categoryId;
      editCategory(categoryId, categories.find(c => c.id === categoryId), socket);
    });
  });
}

/**
 * Kategori düzenleme modalını gösterir
 * @param {string} categoryId - Kategori ID'si
 * @param {Object} category - Kategori nesnesi
 * @param {Object} socket - Socket.io socket
 */
function editCategory(categoryId, category, socket) {
  if (!category) {
    showToast('Kategori bulunamadı', 'error');
    return;
  }
  
  // Mevcut modalı kaldır
  const existingModal = document.getElementById('editCategoryModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Düzenleme modalı oluştur
  const modal = document.createElement('div');
  modal.id = 'editCategoryModal';
  modal.className = 'modal';
  
  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content edit-category-modal">
      <h2>Kategori Düzenle: ${category.name}</h2>
      
      <form id="editCategoryForm" data-category-id="${categoryId}">
        <div class="form-group">
          <label for="editCategoryName">Kategori Adı</label>
          <input type="text" id="editCategoryName" name="editCategoryName" value="${category.name}" required>
        </div>
        
        <div class="form-group">
          <label for="editCategoryPosition">Pozisyon</label>
          <input type="number" id="editCategoryPosition" name="editCategoryPosition" min="0" value="${category.position || 0}">
        </div>
        
        <div class="form-actions">
          <button type="button" id="cancelEditCategoryBtn" class="btn secondary">İptal</button>
          <button type="submit" class="btn primary">Kaydet</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelEditCategoryBtn');
  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Kanal taşıma modalını açar
 * @param {string} channelId - Kanal ID'si
 * @param {string} channelName - Kanal adı
 * @param {Object} socket - Socket.io socket
 */
function openMoveChannelModal(channelId, channelName, socket) {
  const groupId = currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }
  
  // Yükleme göstergesini göster
  showLoading('Kategoriler yükleniyor...');
  
  // Kategorileri getir
  socket.emit('getCategoriesForGroup', {
    groupId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showMoveChannelModal(channelId, channelName, response.categories, socket);
    } else {
      showToast('Kategoriler yüklenemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Kanal taşıma modalını gösterir
 * @param {string} channelId - Kanal ID'si
 * @param {string} channelName - Kanal adı
 * @param {Array} categories - Kategoriler listesi
 * @param {Object} socket - Socket.io socket
 */
function showMoveChannelModal(channelId, channelName, categories, socket) {
  // Mevcut modalı kaldır
  const existingModal = document.getElementById('moveChannelModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Modal oluştur
  const modal = document.createElement('div');
  modal.id = 'moveChannelModal';
  modal.className = 'modal';
  
  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content move-channel-modal">
      <h2>Kanalı Taşı: ${channelName}</h2>
      
      <form id="moveChannelForm" data-channel-id="${channelId}">
        <div class="form-group">
          <label for="moveChannelCategory">Kategori</label>
          <select id="moveChannelCategory" name="moveChannelCategory" required>
            <option value="none">Kategorisiz</option>
            ${categories.map(category => `<option value="${category.id}">${category.name}</option>`).join('')}
          </select>
        </div>
        
        <div class="form-actions">
          <button type="button" id="cancelMoveChannelBtn" class="btn secondary">İptal</button>
          <button type="submit" class="btn primary">Taşı</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // İptal düğmesi
  const cancelBtn = modal.querySelector('#cancelMoveChannelBtn');
  cancelBtn.addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Kanalları yeniler
 * @param {Object} socket - Socket.io socket
 */
function refreshChannels(socket) {
  const groupId = currentGroup;
  if (!groupId) return;
  
  // Kanalları yeniden yükle
  socket.emit('getChannels', { groupId }, (response) => {
    if (response.success) {
      // Kanalları güncelle
      updateChannelsList(response.channels);
    }
  });
}

/**
 * Kanal listesini günceller
 * @param {Array} channels - Kanallar listesi
 */
function updateChannelsList(channels) {
  // Bu fonksiyon, uygulamanın kanal listesini güncellemek için kullanılır
  // Gerçek uygulamada, bu fonksiyon uygulamanın kanal listesini güncelleyen
  // mevcut bir fonksiyonla değiştirilmelidir
  console.log('Kanallar güncellendi:', channels);
  
  // Örnek: Sayfayı yenile
  // window.location.reload();
}

/**
 * Kategoriyi açar/kapatır
 * @param {HTMLElement} categoryElement - Kategori elementi
 */
function toggleCategory(categoryElement) {
  categoryElement.classList.toggle('collapsed');
}

// Global değişkenlere erişim için
const showToast = window.showToast || function(message) { alert(message); };
const showLoading = window.showLoading || function() {};
const hideLoading = window.hideLoading || function() {};
const currentGroup = window.currentGroup;
