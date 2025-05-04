// public/js/ts/searchMessages.ts

/**
 * Search messages module for searching in channels and DMs
 */

import { Socket } from 'socket.io-client';

// Search type
type SearchType = 'channel' | 'dm';

// Search response interface
interface SearchResponse {
  success: boolean;
  results: SearchResult[];
  message?: string;
}

// Search result interface
interface SearchResult {
  _id: string;
  content: string;
  timestamp: string;
  user?: {
    username: string;
  };
  sender?: {
    username: string;
  };
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
}

/**
 * Show search modal
 * @param type - Search type ('channel' or 'dm')
 * @param socket - Socket.io socket
 */
function showSearchModal(type: SearchType, socket: Socket): void {
  // Create search modal if it doesn't exist
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
        
        <button id="closeSearchModalBtn" class="btn secondary">Kapat</button>
      </div>
    `;
    
    document.body.appendChild(searchModal);
  }
  
  // Show modal
  searchModal.style.display = 'block';
  
  // Focus search input
  const searchInput = document.getElementById('searchInput') as HTMLInputElement;
  if (searchInput) {
    searchInput.focus();
  }
  
  // Clear previous results
  const searchResultsList = document.getElementById('searchResultsList');
  const searchCount = document.getElementById('searchCount');
  
  if (searchResultsList) {
    searchResultsList.innerHTML = '';
  }
  
  if (searchCount) {
    searchCount.textContent = '';
  }
  
  // Add event listeners
  const closeBtn = document.getElementById('closeSearchModalBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (searchModal) {
        searchModal.style.display = 'none';
      }
    });
  }
  
  const searchButton = document.getElementById('searchButton');
  if (searchButton && searchInput) {
    searchButton.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        performSearch(type, query, socket);
      }
    });
  }
  
  if (searchInput) {
    searchInput.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          performSearch(type, query, socket);
        }
      }
    });
  }
}

/**
 * Perform search
 * @param type - Search type ('channel' or 'dm')
 * @param query - Search query
 * @param socket - Socket.io socket
 */
function performSearch(type: SearchType, query: string, socket: Socket): void {
  const searchResultsList = document.getElementById('searchResultsList');
  
  if (!searchResultsList) return;
  
  searchResultsList.innerHTML = '<div class="search-loading">Aranıyor...</div>';
  
  if (type === 'channel') {
    const textMessagesElement = document.querySelector('#textMessages') as HTMLElement;
    const channelId = textMessagesElement?.dataset?.channelId;
    
    if (!channelId) {
      searchResultsList.innerHTML = '<div class="search-error">Kanal bulunamadı.</div>';
      return;
    }
    
    socket.emit('searchChannelMessages', {
      channelId,
      query,
      limit: 50
    }, (response: SearchResponse) => {
      if (response.success) {
        displaySearchResults(response.results, type);
      } else {
        if (searchResultsList) {
          searchResultsList.innerHTML = `<div class="search-error">Arama hatası: ${response.message || 'Bilinmeyen hata'}</div>`;
        }
      }
    });
  } else if (type === 'dm') {
    const dmMessagesElement = document.querySelector('#dmMessages') as HTMLElement;
    const friendUsername = dmMessagesElement?.dataset?.friend;
    
    if (!friendUsername) {
      searchResultsList.innerHTML = '<div class="search-error">DM sohbeti bulunamadı.</div>';
      return;
    }
    
    socket.emit('searchDMMessages', {
      friendUsername,
      query,
      limit: 50
    }, (response: SearchResponse) => {
      if (response.success) {
        displaySearchResults(response.results, type);
      } else {
        if (searchResultsList) {
          searchResultsList.innerHTML = `<div class="search-error">Arama hatası: ${response.message || 'Bilinmeyen hata'}</div>`;
        }
      }
    });
  }
}

/**
 * Display search results
 * @param results - Search results
 * @param type - Search type ('channel' or 'dm')
 */
function displaySearchResults(results: SearchResult[], type: SearchType): void {
  const searchResultsList = document.getElementById('searchResultsList');
  const searchCount = document.getElementById('searchCount');
  
  if (!searchResultsList || !searchCount) return;
  
  searchResultsList.innerHTML = '';
  searchCount.textContent = `${results.length} sonuç bulundu`;
  
  if (results.length === 0) {
    searchResultsList.innerHTML = '<div class="search-empty">Sonuç bulunamadı.</div>';
    return;
  }
  
  results.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    
    const date = new Date(result.timestamp);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    resultItem.innerHTML = `
      <div class="search-result-header">
        <span class="search-result-username">${result.user?.username || result.sender?.username || 'Bilinmeyen Kullanıcı'}</span>
        <span class="search-result-time">${formattedDate}</span>
      </div>
      <div class="search-result-content">${result.content}</div>
    `;
    
    resultItem.addEventListener('click', () => {
      // Jump to message
      if (type === 'channel') {
        const messageElement = document.querySelector(`.text-message[data-message-id="${result._id}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('highlight-message');
          setTimeout(() => {
            messageElement.classList.remove('highlight-message');
          }, 2000);
        }
      } else if (type === 'dm') {
        const messageElement = document.querySelector(`.dm-message[data-message-id="${result._id}"]`);
        if (messageElement) {
          messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          messageElement.classList.add('highlight-message');
          setTimeout(() => {
            messageElement.classList.remove('highlight-message');
          }, 2000);
        }
      }
      
      // Close modal
      const searchModal = document.getElementById('searchModal');
      if (searchModal) {
        searchModal.style.display = 'none';
      }
    });
    
    searchResultsList.appendChild(resultItem);
  });
}
