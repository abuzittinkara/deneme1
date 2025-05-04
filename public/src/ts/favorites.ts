/**
 * public/src/ts/favorites.ts
 * Favoriler modülü
 * Sık kullanılan kanallara ve kişilere hızlı erişim sağlar
 */

// Socket.io socket arayüzü
import { ChannelContextMenuCreatedEvent, UserContextMenuCreatedEvent } from './types';
import { AppSocket, FavoriteResponse } from './types/socket';

// Favori öğesi arayüzü - types/index.ts'den import edilebilir
interface Favorite {
  type: 'channel' | 'user';
  itemId: string;
  name: string;
  groupId?: string;
}

// FavoriteResponse artık socket.ts'den import ediliyor

/**
 * Favoriler sistemini başlatır
 * @param socket - Socket.io socket
 */
export function initFavorites(socket: AppSocket): void {
  // Favoriler bölümünü oluştur
  createFavoritesSection();

  // Favorileri yükle
  loadFavorites(socket);

  // Kanal ve kullanıcı bağlam menülerine favori ekle/çıkar seçeneği ekle
  addFavoriteContextMenuOptions();

  // Socket olaylarını dinle
  socket.on<{ favorites: Favorite[] }>('favoritesUpdated', (data) => {
    renderFavorites(data.favorites);
  });
}

/**
 * Favoriler bölümünü oluşturur
 */
function createFavoritesSection(): void {
  // Odalar panelinde favoriler bölümü için yer kontrolü
  const roomPanel = document.getElementById('roomPanel');
  if (!roomPanel) {
    return;
  }

  // Favoriler bölümü zaten var mı kontrol et
  if (document.getElementById('favoritesSection')) {
    return;
  }

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
  if (roomList) {
    roomPanel.insertBefore(favoritesSection, roomList);
  } else {
    roomPanel.appendChild(favoritesSection);
  }

  // Favoriler başlığına tıklama olayı ekle
  const favoritesHeader = favoritesSection.querySelector('.favorites-header');
  const favoritesList = document.getElementById('favoritesList');
  const favoritesToggle = favoritesSection.querySelector('.favorites-toggle');

  if (favoritesHeader && favoritesList && favoritesToggle) {
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
}

/**
 * Favorileri yükler
 * @param socket - Socket.io socket
 */
function loadFavorites(socket: AppSocket): void {
  socket.emit('getFavorites', {}, (response: FavoriteResponse) => {
    if (response.success && response.favorites) {
      renderFavorites(response.favorites);
    } else {
      console.error('Favoriler yüklenirken hata:', response.message);
    }
  });
}

/**
 * Favorileri gösterir
 * @param favorites - Favoriler listesi
 */
function renderFavorites(favorites: Favorite[]): void {
  const favoritesList = document.getElementById('favoritesList');
  if (!favoritesList) {
    return;
  }

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
    favoriteItem.dataset['id'] = favorite.itemId;
    favoriteItem.dataset['type'] = favorite.type;

    if (favorite.type === 'channel' && favorite.groupId) {
      favoriteItem.dataset['groupId'] = favorite.groupId;
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

    removeBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation(); // Tıklamanın üst öğelere yayılmasını engelle

      removeFavorite(favorite.itemId, favorite.type);
    });

    favoriteItem.appendChild(icon);
    favoriteItem.appendChild(name);
    favoriteItem.appendChild(removeBtn);

    favoriteItem.addEventListener('click', () => {
      if (favorite.type === 'channel') {
        // Kanala git
        if (favorite.groupId) {
          navigateToChannel(favorite.groupId, favorite.itemId);
        }
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
 * @param groupId - Grup ID
 * @param channelId - Kanal ID
 */
function navigateToChannel(groupId: string, channelId: string): void {
  // Önce grubu seç
  const groupItems = document.querySelectorAll('.grp-item');
  let groupFound = false;

  groupItems.forEach(item => {
    if (item.getAttribute('data-group-id') === groupId) {
      (item as HTMLElement).click();
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
        (item as HTMLElement).click();
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
 * @param userId - Kullanıcı ID
 */
function navigateToDirectMessage(userId: string): void {
  // DM moduna geç
  const toggleDMButton = document.getElementById('toggleDMButton');
  if (toggleDMButton && !window.isDMMode) {
    (toggleDMButton as HTMLElement).click();
  }

  // Kullanıcıyı seç
  setTimeout(() => {
    const dmItems = document.querySelectorAll('.dm-user-item');
    let userFound = false;

    dmItems.forEach(item => {
      if (item.getAttribute('data-user-id') === userId) {
        (item as HTMLElement).click();
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
function addFavoriteContextMenuOptions(): void {
  // Kanal bağlam menüsü için olay dinleyicisi
  document.addEventListener('channelContextMenuCreated', (event: ChannelContextMenuCreatedEvent) => {
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
            groupId: window.selectedGroup || window.currentGroup,
          });
        });
      }

      // Menüye ekle
      menu.appendChild(favoriteItem);
    });
  });

  // Kullanıcı bağlam menüsü için olay dinleyicisi
  document.addEventListener('userContextMenuCreated', (event: UserContextMenuCreatedEvent) => {
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
            name: user.username,
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
 * @param itemId - Öğe ID
 * @param type - Öğe türü ('channel' veya 'user')
 * @returns Favorilerde olup olmadığı
 */
function checkIsFavorite(itemId: string, type: 'channel' | 'user'): Promise<boolean> {
  return new Promise(resolve => {
    window.socket.emit('checkFavorite', { itemId, type }, (response: FavoriteResponse) => {
      resolve(response.isFavorite || false);
    });
  });
}

/**
 * Favori ekler
 * @param favorite - Favori bilgileri
 */
function addFavorite(favorite: Favorite): void {
  window.socket.emit('addFavorite', favorite, (response: FavoriteResponse) => {
    if (response.success) {
      showToast('Favorilere eklendi', 'success');
      if (response.favorites) {
        renderFavorites(response.favorites);
      }
    } else {
      showToast(
        'Favorilere eklenirken hata oluştu: ' + (response.message || 'Bilinmeyen hata'),
        'error'
      );
    }
  });
}

/**
 * Favori çıkarır
 * @param itemId - Öğe ID
 * @param type - Öğe türü ('channel' veya 'user')
 */
function removeFavorite(itemId: string, type: 'channel' | 'user'): void {
  window.socket.emit('removeFavorite', { itemId, type }, (response: FavoriteResponse) => {
    if (response.success) {
      showToast('Favorilerden çıkarıldı', 'success');
      if (response.favorites) {
        renderFavorites(response.favorites);
      }
    } else {
      showToast(
        'Favorilerden çıkarılırken hata oluştu: ' + (response.message || 'Bilinmeyen hata'),
        'error'
      );
    }
  });
}

/**
 * Toast bildirimi gösterir
 * @param message - Bildirim mesajı
 * @param type - Bildirim türü
 */
function showToast(message: string, type: string): void {
  if (window.showToast) {
    window.showToast(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}
