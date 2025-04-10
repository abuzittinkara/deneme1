// public/js/archiveManager.js

/**
 * Arşiv yönetimi modülü
 * Kanalları arşivleme ve arşivden çıkarma işlevleri sağlar
 */

/**
 * Arşiv yönetimi özelliğini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initArchiveManager(socket) {
  // Kanal arşivleme butonlarını dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('.archive-channel-btn')) {
      const channelId = e.target.closest('.archive-channel-btn').dataset.channelId;
      const channelName = e.target.closest('.archive-channel-btn').dataset.channelName;
      
      if (channelId) {
        confirmArchiveChannel(channelId, channelName, socket);
      }
    }
  });
  
  // Kanal arşivden çıkarma butonlarını dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('.unarchive-channel-btn')) {
      const channelId = e.target.closest('.unarchive-channel-btn').dataset.channelId;
      const channelName = e.target.closest('.unarchive-channel-btn').dataset.channelName;
      
      if (channelId) {
        confirmUnarchiveChannel(channelId, channelName, socket);
      }
    }
  });
  
  // Arşiv yönetimi butonunu dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('#manageArchiveBtn')) {
      const groupId = currentGroup;
      if (groupId) {
        openArchiveManager(groupId, socket);
      }
    }
  });
  
  // Arşivlenmiş kanalları göster/gizle butonunu dinle
  document.addEventListener('click', (e) => {
    if (e.target.closest('#toggleArchivedBtn')) {
      toggleArchivedChannels();
    }
  });
}

/**
 * Kanal arşivleme onayı gösterir
 * @param {string} channelId - Kanal ID'si
 * @param {string} channelName - Kanal adı
 * @param {Object} socket - Socket.io socket
 */
function confirmArchiveChannel(channelId, channelName, socket) {
  if (window.showConfirm) {
    window.showConfirm(`"${channelName}" kanalını arşivlemek istediğinizden emin misiniz? Arşivlenen kanallar salt okunur olur.`, 'Arşivle', 'İptal')
      .then(confirmed => {
        if (confirmed) {
          archiveChannel(channelId, socket);
        }
      });
  } else {
    // Fallback: Basit bir confirm kullan
    if (confirm(`"${channelName}" kanalını arşivlemek istediğinizden emin misiniz? Arşivlenen kanallar salt okunur olur.`)) {
      archiveChannel(channelId, socket);
    }
  }
}

/**
 * Kanalı arşivler
 * @param {string} channelId - Kanal ID'si
 * @param {Object} socket - Socket.io socket
 */
function archiveChannel(channelId, socket) {
  const groupId = currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }
  
  // Yükleme göstergesini göster
  showLoading('Kanal arşivleniyor...');
  
  // Kanalı arşivle
  socket.emit('archiveChannel', {
    channelId,
    groupId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast('Kanal başarıyla arşivlendi', 'success');
      
      // Kanalları yenile
      refreshChannels(socket);
    } else {
      showToast('Kanal arşivlenemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Kanal arşivden çıkarma onayı gösterir
 * @param {string} channelId - Kanal ID'si
 * @param {string} channelName - Kanal adı
 * @param {Object} socket - Socket.io socket
 */
function confirmUnarchiveChannel(channelId, channelName, socket) {
  if (window.showConfirm) {
    window.showConfirm(`"${channelName}" kanalını arşivden çıkarmak istediğinizden emin misiniz?`, 'Arşivden Çıkar', 'İptal')
      .then(confirmed => {
        if (confirmed) {
          unarchiveChannel(channelId, socket);
        }
      });
  } else {
    // Fallback: Basit bir confirm kullan
    if (confirm(`"${channelName}" kanalını arşivden çıkarmak istediğinizden emin misiniz?`)) {
      unarchiveChannel(channelId, socket);
    }
  }
}

/**
 * Kanalı arşivden çıkarır
 * @param {string} channelId - Kanal ID'si
 * @param {Object} socket - Socket.io socket
 */
function unarchiveChannel(channelId, socket) {
  const groupId = currentGroup;
  if (!groupId) {
    showToast('Grup seçilmedi', 'error');
    return;
  }
  
  // Yükleme göstergesini göster
  showLoading('Kanal arşivden çıkarılıyor...');
  
  // Kanalı arşivden çıkar
  socket.emit('unarchiveChannel', {
    channelId,
    groupId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showToast('Kanal başarıyla arşivden çıkarıldı', 'success');
      
      // Kanalları yenile
      refreshChannels(socket);
    } else {
      showToast('Kanal arşivden çıkarılamadı: ' + response.message, 'error');
    }
  });
}

/**
 * Arşiv yöneticisini açar
 * @param {string} groupId - Grup ID'si
 * @param {Object} socket - Socket.io socket
 */
function openArchiveManager(groupId, socket) {
  // Yükleme göstergesini göster
  showLoading('Arşivlenmiş kanallar yükleniyor...');
  
  // Arşivlenmiş kanalları getir
  socket.emit('getArchivedChannels', {
    groupId
  }, (response) => {
    // Yükleme göstergesini gizle
    hideLoading();
    
    if (response.success) {
      showArchiveManager(response.channels, groupId, socket);
    } else {
      showToast('Arşivlenmiş kanallar yüklenemedi: ' + response.message, 'error');
    }
  });
}

/**
 * Arşiv yöneticisini gösterir
 * @param {Array} archivedChannels - Arşivlenmiş kanallar listesi
 * @param {string} groupId - Grup ID'si
 * @param {Object} socket - Socket.io socket
 */
function showArchiveManager(archivedChannels, groupId, socket) {
  // Mevcut arşiv yöneticisini kaldır
  const existingModal = document.getElementById('archiveManagerModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Arşiv yöneticisi modalı oluştur
  const modal = document.createElement('div');
  modal.id = 'archiveManagerModal';
  modal.className = 'modal';
  
  // Modal içeriği
  modal.innerHTML = `
    <div class="modal-content archive-manager-modal">
      <h2>Arşiv Yönetimi</h2>
      
      <div class="archived-channels-list">
        ${archivedChannels.length > 0 ? 
          archivedChannels.map(channel => `
            <div class="archived-channel-item">
              <div class="archived-channel-info">
                <div class="archived-channel-name">
                  <span class="material-icons">${channel.type === 'text' ? 'tag' : 'volume_up'}</span>
                  ${channel.name}
                </div>
                <div class="archived-channel-date">
                  Arşivlenme: ${new Date(channel.archivedAt).toLocaleString()}
                </div>
              </div>
              <div class="archived-channel-actions">
                <button class="unarchive-channel-btn" data-channel-id="${channel.id}" data-channel-name="${channel.name}">
                  <span class="material-icons">unarchive</span>
                  Arşivden Çıkar
                </button>
              </div>
            </div>
          `).join('') : 
          '<div class="no-archived-channels">Arşivlenmiş kanal bulunmuyor.</div>'
        }
      </div>
      
      <button id="closeArchiveManagerBtn" class="btn secondary">Kapat</button>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Kapatma düğmesi
  const closeBtn = modal.querySelector('#closeArchiveManagerBtn');
  closeBtn.addEventListener('click', () => {
    modal.remove();
  });
}

/**
 * Arşivlenmiş kanalları gösterir/gizler
 */
function toggleArchivedChannels() {
  const channelsList = document.querySelector('.channels-list');
  if (!channelsList) return;
  
  channelsList.classList.toggle('show-archived');
  
  const toggleBtn = document.getElementById('toggleArchivedBtn');
  if (toggleBtn) {
    if (channelsList.classList.contains('show-archived')) {
      toggleBtn.innerHTML = '<span class="material-icons">visibility_off</span> Arşivi Gizle';
    } else {
      toggleBtn.innerHTML = '<span class="material-icons">visibility</span> Arşivi Göster';
    }
  }
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

// Global değişkenlere erişim için
const showToast = window.showToast || function(message) { alert(message); };
const showLoading = window.showLoading || function() {};
const hideLoading = window.hideLoading || function() {};
const currentGroup = window.currentGroup;
