/**
 * public/src/ts/categoryManager.ts
 * Category manager module for handling channel categories
 */

// Socket.io socket interface
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Category interface
interface Category {
  id: string;
  name: string;
  position: number;
}

// Channel interface
interface Channel {
  id: string;
  name: string;
  type: string;
  position: number;
  description?: string;
}

// Category response interface
interface CategoryResponse {
  success: boolean;
  categories?: Category[];
  message?: string;
}

// Channel response interface
interface ChannelResponse {
  success: boolean;
  channels?: Channel[];
  message?: string;
}

/**
 * Initialize category manager functionality
 * @param socket - Socket.io socket
 */
export function initCategoryManager(socket: Socket): void {
  // Add event listeners for category manager
  document.addEventListener('click', e => {
    const target = e.target as HTMLElement;

    // Open category manager button
    if (
      target.classList.contains('open-category-manager-btn') ||
      target.closest('.open-category-manager-btn')
    ) {
      const groupId = (window as any).selectedGroup;
      if (groupId) {
        openCategoryManager(groupId, socket);
      }
    }

    // Create category button
    if (
      target.classList.contains('create-category-btn') ||
      target.closest('.create-category-btn')
    ) {
      const groupId = (window as any).selectedGroup;
      if (groupId) {
        const categoryName = prompt('Kategori adı:');
        if (categoryName && categoryName.trim()) {
          createCategory(groupId, categoryName.trim(), socket);
        }
      }
    }

    // Edit category button
    if (target.classList.contains('edit-category-btn') || target.closest('.edit-category-btn')) {
      const button = target.classList.contains('edit-category-btn')
        ? target
        : (target.closest('.edit-category-btn') as HTMLElement);

      const categoryId = button.getAttribute('data-category-id');
      if (categoryId) {
        const categoryItem = button.closest('.category-item');
        const categoryName = categoryItem?.querySelector('.category-name')?.textContent || '';

        const newName = prompt('Kategori adı:', categoryName);
        if (newName && newName.trim()) {
          updateCategory(categoryId, newName.trim(), socket);
        }
      }
    }

    // Delete category button
    if (
      target.classList.contains('delete-category-btn') ||
      target.closest('.delete-category-btn')
    ) {
      const button = target.classList.contains('delete-category-btn')
        ? target
        : (target.closest('.delete-category-btn') as HTMLElement);

      const categoryId = button.getAttribute('data-category-id');
      const categoryName = button.getAttribute('data-category-name');

      if (categoryId && categoryName) {
        if (confirm(`"${categoryName}" kategorisini silmek istediğinize emin misiniz?`)) {
          deleteCategory(categoryId, socket);
        }
      }
    }

    // Move channel to category button
    if (target.classList.contains('move-channel-btn') || target.closest('.move-channel-btn')) {
      const button = target.classList.contains('move-channel-btn')
        ? target
        : (target.closest('.move-channel-btn') as HTMLElement);

      const channelId = button.getAttribute('data-channel-id');
      const channelName = button.getAttribute('data-channel-name');

      if (channelId && channelName) {
        const groupId = (window as any).selectedGroup;
        if (groupId) {
          showMoveToCategoryModal(groupId, channelId, channelName, socket);
        }
      }
    }

    // Move to category button in modal
    if (
      target.classList.contains('move-to-category-btn') ||
      target.closest('.move-to-category-btn')
    ) {
      const button = target.classList.contains('move-to-category-btn')
        ? target
        : (target.closest('.move-to-category-btn') as HTMLElement);

      const channelId = button.getAttribute('data-channel-id');
      const categoryId = button.getAttribute('data-category-id');

      if (channelId && categoryId) {
        moveChannelToCategory(channelId, categoryId, socket);

        // Close modal
        const modal = document.getElementById('moveToCategoryModal');
        if (modal) {
          modal.remove();
        }
      }
    }

    // Close category manager button
    if (
      target.classList.contains('close-category-manager-btn') ||
      target.closest('.close-category-manager-btn')
    ) {
      const categoryManager = document.getElementById('categoryManager');
      if (categoryManager) {
        categoryManager.remove();
      }
    }

    // Close move to category modal button
    if (
      target.classList.contains('close-move-modal-btn') ||
      target.closest('.close-move-modal-btn')
    ) {
      const modal = document.getElementById('moveToCategoryModal');
      if (modal) {
        modal.remove();
      }
    }

    // Toggle category
    if (target.classList.contains('category-header') || target.closest('.category-header')) {
      const categoryElement = target.closest('.category') as HTMLElement;
      if (categoryElement) {
        toggleCategory(categoryElement);
      }
    }
  });
}

/**
 * Open category manager
 * @param groupId - Group ID
 * @param socket - Socket.io socket
 */
function openCategoryManager(groupId: string, socket: Socket): void {
  // Show loading indicator
  showLoading('Kategoriler yükleniyor...');

  // Get categories
  socket.emit(
    'getCategories',
    {
      groupId,
    },
    (response: CategoryResponse) => {
      // Hide loading indicator
      hideLoading();

      if (response.success) {
        showCategoryManager(response.categories || [], groupId, socket);
      } else {
        alert('Kategoriler yüklenemedi: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Show category manager
 * @param categories - Categories
 * @param groupId - Group ID
 * @param socket - Socket.io socket
 */
function showCategoryManager(categories: Category[], groupId: string, socket: Socket): void {
  // Remove existing category manager
  const existingManager = document.getElementById('categoryManager');
  if (existingManager) {
    existingManager.remove();
  }

  // Create category manager
  const categoryManager = document.createElement('div');
  categoryManager.id = 'categoryManager';
  categoryManager.className = 'modal';
  categoryManager.innerHTML = `
    <div class="modal-content category-manager-modal">
      <h2>Kategori Yöneticisi</h2>
      
      <div class="category-manager-content">
        <div class="category-tab-content active" id="categories-list">
          <div class="categories-list">
            ${
              categories.length > 0
                ? categories
                    .map(
                      category => `
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
              `
                    )
                    .join('')
                : '<div class="no-categories">Henüz kategori bulunmuyor.</div>'
            }
          </div>
          
          <div class="category-actions-bar">
            <button class="create-category-btn">
              <span class="material-icons">add</span>
              Yeni Kategori
            </button>
          </div>
        </div>
      </div>
      
      <button class="close-category-manager-btn">
        <span class="material-icons">close</span>
      </button>
    </div>
  `;

  // Add category manager to body
  document.body.appendChild(categoryManager);
}

/**
 * Show move to category modal
 * @param groupId - Group ID
 * @param channelId - Channel ID
 * @param channelName - Channel name
 * @param socket - Socket.io socket
 */
function showMoveToCategoryModal(
  groupId: string,
  channelId: string,
  channelName: string,
  socket: Socket
): void {
  // Show loading indicator
  showLoading('Kategoriler yükleniyor...');

  // Get categories
  socket.emit(
    'getCategories',
    {
      groupId,
    },
    (response: CategoryResponse) => {
      // Hide loading indicator
      hideLoading();

      if (response.success) {
        // Remove existing modal
        const existingModal = document.getElementById('moveToCategoryModal');
        if (existingModal) {
          existingModal.remove();
        }

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'moveToCategoryModal';
        modal.className = 'modal';
        modal.innerHTML = `
        <div class="modal-content move-category-modal">
          <h2>"${channelName}" Kanalını Taşı</h2>
          
          <div class="categories-list">
            <div class="category-item">
              <div class="category-info">
                <div class="category-name">Kategori Yok</div>
                <div class="category-description">Kanalı herhangi bir kategoriye atama</div>
              </div>
              <div class="category-actions">
                <button class="move-to-category-btn" data-channel-id="${channelId}" data-category-id="null">
                  <span class="material-icons">arrow_forward</span>
                </button>
              </div>
            </div>
            
            ${
              response.categories && response.categories.length > 0
                ? response.categories
                    .map(
                      category => `
                <div class="category-item">
                  <div class="category-info">
                    <div class="category-name">${category.name}</div>
                    <div class="category-position">Pozisyon: ${category.position}</div>
                  </div>
                  <div class="category-actions">
                    <button class="move-to-category-btn" data-channel-id="${channelId}" data-category-id="${category.id}">
                      <span class="material-icons">arrow_forward</span>
                    </button>
                  </div>
                </div>
              `
                    )
                    .join('')
                : '<div class="no-categories">Başka kategori bulunmuyor.</div>'
            }
          </div>
          
          <button class="close-move-modal-btn">
            <span class="material-icons">close</span>
          </button>
        </div>
      `;

        // Add modal to body
        document.body.appendChild(modal);
      } else {
        alert('Kategoriler yüklenemedi: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Create a category
 * @param groupId - Group ID
 * @param name - Category name
 * @param socket - Socket.io socket
 */
function createCategory(groupId: string, name: string, socket: Socket): void {
  socket.emit(
    'createCategory',
    {
      groupId,
      name,
    },
    (response: { success: boolean; category?: Category; message?: string }) => {
      if (response.success) {
        // Refresh category manager
        openCategoryManager(groupId, socket);
      } else {
        alert(
          'Kategori oluşturulurken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
        );
      }
    }
  );
}

/**
 * Update a category
 * @param categoryId - Category ID
 * @param name - New category name
 * @param socket - Socket.io socket
 */
function updateCategory(categoryId: string, name: string, socket: Socket): void {
  const groupId = (window as any).selectedGroup;
  if (!groupId) {
    return;
  }

  socket.emit(
    'updateCategory',
    {
      categoryId,
      name,
    },
    (response: { success: boolean; category?: Category; message?: string }) => {
      if (response.success) {
        // Refresh category manager
        openCategoryManager(groupId, socket);
      } else {
        alert(
          'Kategori güncellenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
        );
      }
    }
  );
}

/**
 * Delete a category
 * @param categoryId - Category ID
 * @param socket - Socket.io socket
 */
function deleteCategory(categoryId: string, socket: Socket): void {
  const groupId = (window as any).selectedGroup;
  if (!groupId) {
    return;
  }

  socket.emit(
    'deleteCategory',
    {
      categoryId,
    },
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        // Refresh category manager
        openCategoryManager(groupId, socket);

        // Refresh channel list
        socket.emit('browseGroup', groupId);
      } else {
        alert('Kategori silinirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Move a channel to a category
 * @param channelId - Channel ID
 * @param categoryId - Category ID (or "null" string for no category)
 * @param socket - Socket.io socket
 */
function moveChannelToCategory(channelId: string, categoryId: string, socket: Socket): void {
  const groupId = (window as any).selectedGroup;
  if (!groupId) {
    return;
  }

  socket.emit(
    'moveChannelToCategory',
    {
      channelId,
      categoryId: categoryId === 'null' ? null : categoryId,
    },
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        // Refresh channel list
        socket.emit('browseGroup', groupId);
      } else {
        alert('Kanal taşınırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Show loading indicator
 * @param message - Loading message
 */
function showLoading(message: string): void {
  // Remove existing loading indicator
  const existingLoading = document.getElementById('loadingIndicator');
  if (existingLoading) {
    existingLoading.remove();
  }

  // Create loading indicator
  const loading = document.createElement('div');
  loading.id = 'loadingIndicator';
  loading.className = 'loading-indicator';
  loading.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-message">${message}</div>
  `;

  // Add loading indicator to body
  document.body.appendChild(loading);
}

/**
 * Hide loading indicator
 */
function hideLoading(): void {
  const loading = document.getElementById('loadingIndicator');
  if (loading) {
    loading.remove();
  }
}

/**
 * Update channel list
 * @param channels - Channels list
 */
function updateChannelsList(channels: Channel[]): void {
  // This function is used to update the channel list in the application
  // In a real application, this function would be replaced with an existing
  // function that updates the channel list
  console.log('Kanallar güncellendi:', channels);

  // Example: Reload the page
  // window.location.reload();
}

/**
 * Toggle category collapse/expand
 * @param categoryElement - Category element
 */
function toggleCategory(categoryElement: HTMLElement): void {
  categoryElement.classList.toggle('collapsed');
}
