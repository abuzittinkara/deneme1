/**
 * public/src/ts/archiveManager.ts
 * Archive manager module for handling archived channels
 */

// Socket.io socket interface
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Channel interface
interface Channel {
  id: string;
  name: string;
  type: string;
  archivedAt: string;
}

// Archive response interface
interface ArchiveResponse {
  success: boolean;
  channels?: Channel[];
  message?: string;
}

/**
 * Initialize archive manager functionality
 * @param socket - Socket.io socket
 */
export function initArchiveManager(socket: Socket): void {
  // Add event listeners for archive manager
  document.addEventListener('click', e => {
    const target = e.target as HTMLElement;

    // Archive channel button
    if (
      target.classList.contains('archive-channel-btn') ||
      target.closest('.archive-channel-btn')
    ) {
      const button = target.classList.contains('archive-channel-btn')
        ? target
        : (target.closest('.archive-channel-btn') as HTMLElement);

      const channelId = button.getAttribute('data-channel-id');
      const channelName = button.getAttribute('data-channel-name');

      if (channelId && channelName) {
        if (confirm(`"${channelName}" kanalını arşivlemek istediğinize emin misiniz?`)) {
          archiveChannel(channelId, socket);
        }
      }
    }

    // Unarchive channel button
    if (
      target.classList.contains('unarchive-channel-btn') ||
      target.closest('.unarchive-channel-btn')
    ) {
      const button = target.classList.contains('unarchive-channel-btn')
        ? target
        : (target.closest('.unarchive-channel-btn') as HTMLElement);

      const channelId = button.getAttribute('data-channel-id');
      const channelName = button.getAttribute('data-channel-name');

      if (channelId && channelName) {
        if (confirm(`"${channelName}" kanalını arşivden çıkarmak istediğinize emin misiniz?`)) {
          unarchiveChannel(channelId, socket);
        }
      }
    }

    // Open archive manager button
    if (
      target.classList.contains('open-archive-manager-btn') ||
      target.closest('.open-archive-manager-btn')
    ) {
      const groupId = (window as any).selectedGroup;
      if (groupId) {
        openArchiveManager(groupId, socket);
      }
    }

    // Toggle archived channels button
    if (
      target.classList.contains('toggle-archived-btn') ||
      target.closest('.toggle-archived-btn')
    ) {
      toggleArchivedChannels();
    }

    // Close archive manager button
    if (
      target.classList.contains('close-archive-manager-btn') ||
      target.closest('.close-archive-manager-btn')
    ) {
      const archiveManager = document.getElementById('archiveManager');
      if (archiveManager) {
        archiveManager.remove();
      }
    }
  });
}

/**
 * Archive a channel
 * @param channelId - Channel ID
 * @param socket - Socket.io socket
 */
function archiveChannel(channelId: string, socket: Socket): void {
  const groupId = (window as any).selectedGroup;
  if (!groupId) {
    return;
  }

  socket.emit(
    'archiveChannel',
    {
      groupId,
      channelId,
    },
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        // Show success message
        alert('Kanal başarıyla arşivlendi.');

        // Refresh channel list
        socket.emit('browseGroup', groupId);
      } else {
        // Show error message
        alert('Kanal arşivlenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Unarchive a channel
 * @param channelId - Channel ID
 * @param socket - Socket.io socket
 */
function unarchiveChannel(channelId: string, socket: Socket): void {
  const groupId = (window as any).selectedGroup;
  if (!groupId) {
    return;
  }

  socket.emit(
    'unarchiveChannel',
    {
      groupId,
      channelId,
    },
    (response: { success: boolean; message?: string }) => {
      if (response.success) {
        // Show success message
        alert('Kanal başarıyla arşivden çıkarıldı.');

        // Refresh channel list
        socket.emit('browseGroup', groupId);

        // Refresh archive manager
        const archiveManager = document.getElementById('archiveManager');
        if (archiveManager) {
          openArchiveManager(groupId, socket);
        }
      } else {
        // Show error message
        alert(
          'Kanal arşivden çıkarılırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata')
        );
      }
    }
  );
}

/**
 * Open archive manager
 * @param groupId - Group ID
 * @param socket - Socket.io socket
 */
function openArchiveManager(groupId: string, socket: Socket): void {
  // Show loading indicator
  showLoading('Arşivlenmiş kanallar yükleniyor...');

  // Get archived channels
  socket.emit(
    'getArchivedChannels',
    {
      groupId,
    },
    (response: ArchiveResponse) => {
      // Hide loading indicator
      hideLoading();

      if (response.success) {
        showArchiveManager(response.channels || [], groupId, socket);
      } else {
        alert('Arşivlenmiş kanallar yüklenemedi: ' + (response.message || 'Bilinmeyen hata'));
      }
    }
  );
}

/**
 * Show archive manager
 * @param archivedChannels - Archived channels
 * @param groupId - Group ID
 * @param socket - Socket.io socket
 */
function showArchiveManager(archivedChannels: Channel[], groupId: string, socket: Socket): void {
  // Remove existing archive manager
  const existingManager = document.getElementById('archiveManager');
  if (existingManager) {
    existingManager.remove();
  }

  // Create archive manager
  const archiveManager = document.createElement('div');
  archiveManager.id = 'archiveManager';
  archiveManager.className = 'modal';
  archiveManager.innerHTML = `
    <div class="modal-content archive-manager-modal">
      <h2>Arşivlenmiş Kanallar</h2>
      
      <div class="archived-channels-list">
        ${
          archivedChannels.length > 0
            ? archivedChannels
                .map(
                  channel => `
            <div class="archived-channel-item">
              <div class="archived-channel-info">
                <div class="archived-channel-name">
                  <span class="material-icons">${
                    channel.type === 'text' ? 'tag' : 'volume_up'
                  }</span>
                  ${channel.name}
                </div>
                <div class="archived-channel-date">
                  Arşivlenme: ${new Date(channel.archivedAt).toLocaleString()}
                </div>
              </div>
              <div class="archived-channel-actions">
                <button class="unarchive-channel-btn" data-channel-id="${
                  channel.id
                }" data-channel-name="${channel.name}">
                  <span class="material-icons">unarchive</span>
                  Arşivden Çıkar
                </button>
              </div>
            </div>
          `
                )
                .join('')
            : '<div class="no-archived-channels">Arşivlenmiş kanal bulunmuyor.</div>'
        }
      </div>
      
      <button class="close-archive-manager-btn">
        <span class="material-icons">close</span>
      </button>
    </div>
  `;

  // Add archive manager to body
  document.body.appendChild(archiveManager);
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
 * Toggle archived channels
 */
function toggleArchivedChannels(): void {
  const channelsList = document.querySelector('.channels-list');
  if (!channelsList) {
    return;
  }

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
