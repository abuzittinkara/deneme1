/**
 * public/src/ts/searchMessages.ts
 * Search messages module for searching in channels and DMs
 */

// Socket.io socket interface
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Search result interface
interface SearchResult {
  _id: string;
  content: string;
  timestamp: string;
  user: {
    username: string;
    name?: string;
    surname?: string;
    profilePicture?: string;
  };
}

// Search response interface
interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  message?: string;
}

/**
 * Initialize search functionality
 * @param socket - Socket.io socket
 */
export function initSearch(socket: Socket): void {
  // Add search button to channel header
  const channelHeader = document.querySelector('.channel-header');
  if (channelHeader) {
    const searchButton = document.createElement('button');
    searchButton.className = 'search-button';
    searchButton.innerHTML = '<span class="material-icons">search</span>';
    searchButton.title = 'Mesajlarda Ara';
    channelHeader.appendChild(searchButton);

    searchButton.addEventListener('click', () => {
      showSearchModal('channel', socket);
    });
  }

  // Add search button to DM header
  const dmHeader = document.querySelector('.dm-header');
  if (dmHeader) {
    const searchButton = document.createElement('button');
    searchButton.className = 'search-button';
    searchButton.innerHTML = '<span class="material-icons">search</span>';
    searchButton.title = 'Mesajlarda Ara';
    dmHeader.appendChild(searchButton);

    searchButton.addEventListener('click', () => {
      showSearchModal('dm', socket);
    });
  }

  // Add global search button to sidebar
  const sidebar = document.querySelector('.sidebar-header');
  if (sidebar) {
    const searchButton = document.createElement('button');
    searchButton.className = 'global-search-button';
    searchButton.innerHTML = '<span class="material-icons">search</span>';
    searchButton.title = 'Tüm Mesajlarda Ara';
    sidebar.appendChild(searchButton);

    searchButton.addEventListener('click', () => {
      showSearchModal('global', socket);
    });
  }
}

/**
 * Show search modal
 * @param type - Search type ('channel', 'dm', or 'global')
 * @param socket - Socket.io socket
 */
function showSearchModal(type: string, socket: Socket): void {
  // Check if modal already exists
  let searchModal = document.getElementById('searchModal');

  if (!searchModal) {
    searchModal = document.createElement('div');
    searchModal.id = 'searchModal';
    searchModal.className = 'modal';
    searchModal.innerHTML = `
      <div class="modal-content search-modal-content">
        <h2>Mesajlarda Ara</h2>

        <div class="search-form">
          <div class="search-input-container">
            <span class="material-icons search-icon">search</span>
            <input type="text" id="searchInput" placeholder="Aramak istediğiniz kelimeyi yazın...">
          </div>

          <button id="searchButton" class="btn primary">Ara</button>
        </div>

        <div class="search-results" id="searchResults">
          <div class="search-results-header">
            <span>Sonuçlar</span>
            <span class="search-count" id="searchCount"></span>
          </div>

          <div class="search-results-list" id="searchResultsList"></div>
        </div>

        <button class="close-modal-btn">
          <span class="material-icons">close</span>
        </button>
      </div>
    `;

    document.body.appendChild(searchModal);

    // Add event listener for close button
    const closeButton = searchModal.querySelector('.close-modal-btn');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        searchModal?.remove();
      });
    }
  }

  // Show modal
  searchModal.style.display = 'flex';

  // Focus search input
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  if (searchInput) {
    searchInput.focus();
  }

  // Update modal title based on search type
  const modalTitle = searchModal.querySelector('h2');
  if (modalTitle) {
    if (type === 'channel') {
      modalTitle.textContent = 'Kanal Mesajlarında Ara';
    } else if (type === 'dm') {
      modalTitle.textContent = 'Direkt Mesajlarda Ara';
    } else {
      modalTitle.textContent = 'Tüm Mesajlarda Ara';
    }
  }

  // Add event listener for search button
  const searchButton = document.getElementById('searchButton');
  if (searchButton) {
    // Remove existing event listeners
    const newSearchButton = searchButton.cloneNode(true);
    searchButton.parentNode?.replaceChild(newSearchButton, searchButton);

    // Add new event listener
    newSearchButton.addEventListener('click', () => {
      const query = searchInput?.value.trim();
      if (query) {
        performSearch(type, query, socket);
      }
    });
  }

  // Add event listener for search input
  if (searchInput) {
    // Remove existing event listeners
    const newSearchInput = searchInput.cloneNode(true) as HTMLInputElement;
    searchInput.parentNode?.replaceChild(newSearchInput, searchInput);

    // Add new event listener
    newSearchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const query = newSearchInput.value.trim();
        if (query) {
          performSearch(type, query, socket);
        }
      }
    });

    // Focus new input
    newSearchInput.focus();
  }
}

/**
 * Perform search
 * @param type - Search type ('channel', 'dm', or 'global')
 * @param query - Search query
 * @param socket - Socket.io socket
 */
function performSearch(type: string, query: string, socket: Socket): void {
  const searchResultsList = document.getElementById('searchResultsList');
  if (searchResultsList) {
    searchResultsList.innerHTML = '<div class="search-loading">Aranıyor...</div>';
  }

  if (type === 'channel') {
    const channelId = document.querySelector('#textMessages')?.getAttribute('data-channel-id');
    if (!channelId) {
      if (searchResultsList) {
        searchResultsList.innerHTML = '<div class="search-error">Kanal bulunamadı.</div>';
      }
      return;
    }

    socket.emit(
      'searchChannelMessages',
      {
        channelId,
        query,
        limit: 50,
      },
      (response: SearchResponse) => {
        if (response.success) {
          displaySearchResults(response.results, type);
        } else {
          if (searchResultsList) {
            searchResultsList.innerHTML = `<div class="search-error">Arama hatası: ${
              response.message || 'Bilinmeyen hata'
            }</div>`;
          }
        }
      }
    );
  } else if (type === 'dm') {
    const friendUsername = document.querySelector('#dmMessages')?.getAttribute('data-friend');
    if (!friendUsername) {
      if (searchResultsList) {
        searchResultsList.innerHTML = '<div class="search-error">DM sohbeti bulunamadı.</div>';
      }
      return;
    }

    socket.emit(
      'searchDMMessages',
      {
        friendUsername,
        query,
        limit: 50,
      },
      (response: SearchResponse) => {
        if (response.success) {
          displaySearchResults(response.results, type);
        } else {
          if (searchResultsList) {
            searchResultsList.innerHTML = `<div class="search-error">Arama hatası: ${
              response.message || 'Bilinmeyen hata'
            }</div>`;
          }
        }
      }
    );
  } else if (type === 'global') {
    socket.emit(
      'searchAllMessages',
      {
        query,
        limit: 50,
      },
      (response: SearchResponse) => {
        if (response.success) {
          displaySearchResults(response.results, type);
        } else {
          if (searchResultsList) {
            searchResultsList.innerHTML = `<div class="search-error">Arama hatası: ${
              response.message || 'Bilinmeyen hata'
            }</div>`;
          }
        }
      }
    );
  }
}

/**
 * Display search results
 * @param results - Search results
 * @param type - Search type
 */
function displaySearchResults(results: SearchResult[], type: string): void {
  const searchResultsList = document.getElementById('searchResultsList');
  const searchCount = document.getElementById('searchCount');

  if (searchResultsList) {
    if (results.length === 0) {
      searchResultsList.innerHTML = '<div class="no-results">Sonuç bulunamadı.</div>';
    } else {
      searchResultsList.innerHTML = '';

      results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = 'search-result-item';

        // Format date
        const date = new Date(result.timestamp);
        const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;

        // Create result item HTML
        resultItem.innerHTML = `
          <div class="search-result-header">
            <div class="search-result-user">
              <div class="search-result-avatar">
                ${
                  result.user.profilePicture
                    ? `<img src="${result.user.profilePicture}" alt="${result.user.username}">`
                    : '<span class="material-icons">account_circle</span>'
                }
              </div>
              <div class="search-result-username">${result.user.username}</div>
            </div>
            <div class="search-result-timestamp">${formattedDate}</div>
          </div>
          <div class="search-result-content">${highlightSearchTerm(
            result.content,
            (document.getElementById('searchInput') as HTMLInputElement)?.value || ''
          )}</div>
        `;

        // Add click event to jump to message
        resultItem.addEventListener('click', () => {
          jumpToMessage(result._id, type);

          // Close modal
          const searchModal = document.getElementById('searchModal');
          if (searchModal) {
            searchModal.remove();
          }
        });

        searchResultsList.appendChild(resultItem);
      });
    }
  }

  if (searchCount) {
    searchCount.textContent = `(${results.length})`;
  }
}

/**
 * Highlight search term in content
 * @param content - Message content
 * @param searchTerm - Search term
 * @returns Highlighted content
 */
function highlightSearchTerm(content: string, searchTerm: string): string {
  if (!searchTerm) {
    return content;
  }

  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  return content.replace(regex, '<span class="highlight">$1</span>');
}

/**
 * Escape regular expression special characters
 * @param string - String to escape
 * @returns Escaped string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Jump to message
 * @param messageId - Message ID
 * @param type - Search type
 */
function jumpToMessage(messageId: string, type: string): void {
  // Find message element
  let messageElement: HTMLElement | null = null;

  if (type === 'channel') {
    messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);
  } else if (type === 'dm') {
    messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);
  } else {
    // For global search, we need to check both
    messageElement = document.querySelector(
      `.text-message[data-message-id="${messageId}"], .dm-message[data-message-id="${messageId}"]`
    );
  }

  if (messageElement) {
    // Scroll to message
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Highlight message
    messageElement.classList.add('highlighted-message');

    // Remove highlight after 3 seconds
    setTimeout(() => {
      messageElement?.classList.remove('highlighted-message');
    }, 3000);
  }
}
