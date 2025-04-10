// public/js/favorites.js

/**
 * Favoriler modülü
 * Sık kullanılan kanallara ve kişilere hızlı erişim sağlar
 */

/**
 * Favoriler sistemini başlatır
 * @param {Object} socket - Socket.io socket
 */
export function initFavorites(socket) {
  // Favoriler bölümünü oluştur
  createFavoritesSection();
  
  // Favorileri yükle
  loadFavorites(socket);
  
  // Kanal ve kullanıcı bağlam menülerine favori ekle/çıkar seçeneği ekle
  addFavoriteContextMenuOptions();
  
  // Socket olaylarını dinle
  socket.on('favoritesUpdated', (data) => {
    renderFavorites(data.favorites);
  });
}

/**
 * Favoriler bölümünü oluşturur
 */
function createFavoritesSection() {
  // Odalar panelinde favoriler bölümü için yer kontrolü
  const roomPanel = document.getElementById('roomPanel');
  if (!roomPanel) return;
  
  // Favoriler bölümü zaten var mı kontrol et
  if (document.getElementById('favoritesSection')) return;
  
  // Favoriler bölümünü oluştur
  const favoritesSection = document.createElement('div');
  favoritesSection.id = 'favoritesSection';
  favoritesSection.className = 'favorites-section';
  
  favoritesSection.innerHTML = `
    <div class="favorites-header">
      <span class="favorites-title">Favoriler</span>
      <span class="material-icons favorites-toggle">expand_more</span>
    </div>
    <div id="favoritesList" class="favorites-list"></div>
  `;
  
  // Favoriler bölümünü oda listesinin üstüne ekle
  const roomList = document.getElementById('roomList');
  roomPanel.insertBefore(favoritesSection, roomList);
  
  // Favoriler başlığına tıklama olayı ekle
  const favoritesHeader = favoritesSection.querySelector('.favorites-header');
  const favoritesList = document.getElementById('favoritesList');
  const favoritesToggle = favoritesSection.querySelector('.favorites-toggle');
  
  favoritesHeader.addEventListener('click', () => {
    if (favoritesList.style.display === 'none') {
      favoritesList.style.display = 'flex';
      favoritesToggle.textContent = 'expand_more';
      localStorage.setItem('favorites_collapsed', 'false');
    } else {
      favoritesList.style.display = 'none';
      favoritesToggle.textContent = 'chevron_right';
      localStorage.setItem('favorites_collapsed', 'true');
    }
  });
  
  // Önceki durumu kontrol et
  const isCollapsed = localStorage.getItem('favorites_collapsed') === 'true';
  if (isCollapsed) {
    favoritesList.style.display = 'none';
    favoritesToggle.textContent = 'chevron_right';
  }
}

/**
 * Favorileri yükler
 * @param {Object} socket - Socket.io socket
 */
function loadFavorites(socket) {
  socket.emit('getFavorites', {}, (response) => {
    if (response.success) {
      renderFavorites(response.favorites);
    } else {
      console.error('Favoriler yüklenirken hata:', response.message);
    }
  });
}

/**
 * Favorileri gösterir
 * @param {Array} favorites - Favoriler listesi
 */
function renderFavorites(favorites) {
  const favoritesList = document.getElementById('favoritesList');
  if (!favoritesList) return;
  
  favoritesList.innerHTML = '';
  
  if (!favorites || favorites.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'favorites-empty';
    emptyMessage.textContent = 'Henüz favori eklenmedi';
    favoritesList.appendChild(emptyMessage);
    return;
  }
  
  favorites.forEach(favorite => {
    const favoriteItem = document.createElement('div');
    favoriteItem.className = 'favorite-item';
    favoriteItem.dataset.id = favorite.itemId;
    favoriteItem.dataset.type = favorite.type;
    
    if (favorite.type === 'channel' && favorite.groupId) {
      favoriteItem.dataset.groupId = favorite.groupId;
    }
    
    const icon = document.createElement('span');
    icon.className = 'material-icons favorite-icon';
    
    if (favorite.type === 'channel') {
      // Ses kanalı mı metin kanalı mı kontrol et
      // Bu bilgi favorilerde saklanmıyor, o yüzden varsayılan olarak metin kanalı simgesi kullanıyoruz
      icon.textContent = 'chat';
    } else {
      icon.textContent = 'person';
    }
    
    const name = document.createElement('span');
    name.className = 'favorite-name';
    name.textContent = favorite.name;
    
    const removeBtn = document.createElement('button');
    removeBtn.className = 'favorite-remove';
    removeBtn.innerHTML = '<span class="material-icons">close</span>';
    removeBtn.title = 'Favorilerden çıkar';
    
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Tıklamanın üst öğelere yayılmasını engelle
      
      removeFavorite(favorite.itemId, favorite.type);
    });
    
    favoriteItem.appendChild(icon);
    favoriteItem.appendChild(name);
    favoriteItem.appendChild(removeBtn);
    
    favoriteItem.addEventListener('click', () => {
      if (favorite.type === 'channel') {
        // Kanala git
        navigateToChannel(favorite.groupId, favorite.itemId);
      } else {
        // Kişiye git
        navigateToDirectMessage(favorite.itemId);
      }
    });
    
    favoritesList.appendChild(favoriteItem);
  });
}

/**
 * Kanala gider
 * @param {string} groupId - Grup ID
 * @param {string} channelId - Kanal ID
 */
function navigateToChannel(groupId, channelId) {
  // Önce grubu seç
  const groupItems = document.querySelectorAll('.grp-item');
  let groupFound = false;
  
  groupItems.forEach(item => {
    if (item.getAttribute('data-group-id') === groupId) {
      item.click();
      groupFound = true;
    }
  });
  
  if (!groupFound) {
    showToast('Grup bulunamadı', 'error');
    return;
  }
  
  // Sonra kanalı seç
  setTimeout(() => {
    const channelItems = document.querySelectorAll('.channel-item');
    let channelFound = false;
    
    channelItems.forEach(item => {
      const channelHeader = item.querySelector('.channel-header');
      if (channelHeader && channelHeader.getAttribute('data-channel-id') === channelId) {
        item.click();
        channelFound = true;
      }
    });
    
    if (!channelFound) {
      showToast('Kanal bulunamadı', 'error');
    }
  }, 300); // Grup seçildikten sonra kanalların yüklenmesi için kısa bir bekleme
}

/**
 * Direkt mesaja gider
 * @param {string} userId - Kullanıcı ID
 */
function navigateToDirectMessage(userId) {
  // DM moduna geç
  const toggleDMButton = document.getElementById('toggleDMButton');
  if (toggleDMButton && !window.isDMMode) {
    toggleDMButton.click();
  }
  
  // Kullanıcıyı seç
  setTimeout(() => {
    const dmItems = document.querySelectorAll('.dm-user-item');
    let userFound = false;
    
    dmItems.forEach(item => {
      if (item.getAttribute('data-user-id') === userId) {
        item.click();
        userFound = true;
      }
    });
    
    if (!userFound) {
      showToast('Kullanıcı bulunamadı', 'error');
    }
  }, 300); // DM moduna geçildikten sonra kullanıcıların yüklenmesi için kısa bir bekleme
}

/**
 * Kanal ve kullanıcı bağlam menülerine favori ekle/çıkar seçeneği ekler
 */
function addFavoriteContextMenuOptions() {
  // Kanal bağlam menüsü için olay dinleyicisi
  document.addEventListener('channelContextMenuCreated', (event) => {
    const { menu, roomObj } = event.detail;
    
    // Favori ekle/çıkar seçeneği
    const favoriteItem = document.createElement('div');
    favoriteItem.className = 'context-menu-item';
    
    // Kanal zaten favorilerde mi kontrol et
    checkIsFavorite(roomObj.id, 'channel').then(isFavorite => {
      if (isFavorite) {
        favoriteItem.innerHTML = '<span class="material-icons">star</span> Favorilerden Çıkar';
        favoriteItem.addEventListener('click', () => {
          removeFavorite(roomObj.id, 'channel');
        });
      } else {
        favoriteItem.innerHTML = '<span class="material-icons">star_border</span> Favorilere Ekle';
        favoriteItem.addEventListener('click', () => {
          addFavorite({
            type: 'channel',
            itemId: roomObj.id,
            name: roomObj.name,
            groupId: window.selectedGroup || window.currentGroup
          });
        });
      }
      
      // Menüye ekle
      menu.appendChild(favoriteItem);
    });
  });
  
  // Kullanıcı bağlam menüsü için olay dinleyicisi
  document.addEventListener('userContextMenuCreated', (event) => {
    const { menu, user } = event.detail;
    
    // Favori ekle/çıkar seçeneği
    const favoriteItem = document.createElement('div');
    favoriteItem.className = 'context-menu-item';
    
    // Kullanıcı zaten favorilerde mi kontrol et
    checkIsFavorite(user.id, 'user').then(isFavorite => {
      if (isFavorite) {
        favoriteItem.innerHTML = '<span class="material-icons">star</span> Favorilerden Çıkar';
        favoriteItem.addEventListener('click', () => {
          removeFavorite(user.id, 'user');
        });
      } else {
        favoriteItem.innerHTML = '<span class="material-icons">star_border</span> Favorilere Ekle';
        favoriteItem.addEventListener('click', () => {
          addFavorite({
            type: 'user',
            itemId: user.id,
            name: user.username
          });
        });
      }
      
      // Menüye ekle
      menu.appendChild(favoriteItem);
    });
  });
}

/**
 * Öğenin favorilerde olup olmadığını kontrol eder
 * @param {string} itemId - Öğe ID
 * @param {string} type - Öğe türü ('channel' veya 'user')
 * @returns {Promise<boolean>} - Favorilerde olup olmadığı
 */
function checkIsFavorite(itemId, type) {
  return new Promise((resolve) => {
    window.socket.emit('checkFavorite', { itemId, type }, (response) => {
      resolve(response.isFavorite);
    });
  });
}

/**
 * Favori ekler
 * @param {Object} favorite - Favori bilgileri
 */
function addFavorite(favorite) {
  window.socket.emit('addFavorite', favorite, (response) => {
    if (response.success) {
      showToast('Favorilere eklendi', 'success');
      renderFavorites(response.favorites);
    } else {
      showToast('Favorilere eklenirken hata oluştu: ' + response.message, 'error');
    }
  });
}

/**
 * Favori çıkarır
 * @param {string} itemId - Öğe ID
 * @param {string} type - Öğe türü ('channel' veya 'user')
 */
function removeFavorite(itemId, type) {
  window.socket.emit('removeFavorite', { itemId, type }, (response) => {
    if (response.success) {
      showToast('Favorilerden çıkarıldı', 'success');
      renderFavorites(response.favorites);
    } else {
      showToast('Favorilerden çıkarılırken hata oluştu: ' + response.message, 'error');
    }
  });
}

/**
 * Toast bildirimi gösterir
 * @param {string} message - Bildirim mesajı
 * @param {string} type - Bildirim türü
 */
function showToast(message, type) {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}
