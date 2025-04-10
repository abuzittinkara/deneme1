// public/js/messageManager.js

/**
 * Message management module for editing and deleting messages
 */

/**
 * Initialize message management functionality
 * @param {Object} socket - Socket.io socket
 */
export function initMessageManager(socket) {
  // Add event listeners for message actions
  document.addEventListener('click', function(e) {
    // Edit message button
    if (e.target && e.target.classList.contains('edit-message-btn')) {
      const messageElement = e.target.closest('.text-message');
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const messageContent = messageElement.querySelector('.message-content').textContent;
        showEditMessageForm(messageElement, messageId, messageContent, socket);
      }
    }
    
    // Delete message button
    if (e.target && e.target.classList.contains('delete-message-btn')) {
      const messageElement = e.target.closest('.text-message');
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
          deleteMessage(messageId, socket);
        }
      }
    }
    
    // Edit DM message button
    if (e.target && e.target.classList.contains('edit-dm-message-btn')) {
      const messageElement = e.target.closest('.dm-message');
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const messageContent = messageElement.querySelector('.message-content').textContent;
        const friendUsername = document.querySelector('#dmMessages').dataset.friend;
        showEditDMMessageForm(messageElement, messageId, messageContent, friendUsername, socket);
      }
    }
    
    // Delete DM message button
    if (e.target && e.target.classList.contains('delete-dm-message-btn')) {
      const messageElement = e.target.closest('.dm-message');
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const friendUsername = document.querySelector('#dmMessages').dataset.friend;
        if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
          deleteDMMessage(messageId, friendUsername, socket);
        }
      }
    }
    
    // Cancel edit button
    if (e.target && e.target.classList.contains('cancel-edit-btn')) {
      const editForm = e.target.closest('.edit-message-form');
      if (editForm) {
        const messageElement = editForm.closest('.text-message, .dm-message');
        cancelEdit(messageElement);
      }
    }
  });
  
  // Add event listeners for socket events
  socket.on('messageEdited', (data) => {
    updateEditedMessage(data);
  });
  
  socket.on('messageDeleted', (data) => {
    markMessageAsDeleted(data);
  });
  
  socket.on('dmMessageEdited', (data) => {
    updateEditedDMMessage(data);
  });
  
  socket.on('dmMessageDeleted', (data) => {
    markDMMessageAsDeleted(data);
  });
}

/**
 * Show edit form for a channel message
 * @param {HTMLElement} messageElement - Message element
 * @param {string} messageId - Message ID
 * @param {string} content - Message content
 * @param {Object} socket - Socket.io socket
 */
function showEditMessageForm(messageElement, messageId, content, socket) {
  // Create edit form
  const editForm = document.createElement('div');
  editForm.className = 'edit-message-form';
  editForm.innerHTML = `
    <textarea class="edit-message-textarea">${content}</textarea>
    <div class="edit-message-buttons">
      <button class="save-edit-btn">Kaydet</button>
      <button class="cancel-edit-btn">İptal</button>
    </div>
  `;
  
  // Hide message content
  const messageContent = messageElement.querySelector('.message-content');
  messageContent.style.display = 'none';
  
  // Add edit form
  messageElement.appendChild(editForm);
  
  // Focus textarea
  const textarea = editForm.querySelector('.edit-message-textarea');
  textarea.focus();
  
  // Add event listener for save button
  const saveButton = editForm.querySelector('.save-edit-btn');
  saveButton.addEventListener('click', () => {
    const newContent = textarea.value.trim();
    if (newContent) {
      saveEditedMessage(messageId, newContent, socket);
      cancelEdit(messageElement);
    }
  });
  
  // Add event listener for textarea enter key
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newContent = textarea.value.trim();
      if (newContent) {
        saveEditedMessage(messageId, newContent, socket);
        cancelEdit(messageElement);
      }
    }
  });
}

/**
 * Show edit form for a DM message
 * @param {HTMLElement} messageElement - Message element
 * @param {string} messageId - Message ID
 * @param {string} content - Message content
 * @param {string} friendUsername - Friend's username
 * @param {Object} socket - Socket.io socket
 */
function showEditDMMessageForm(messageElement, messageId, content, friendUsername, socket) {
  // Create edit form
  const editForm = document.createElement('div');
  editForm.className = 'edit-message-form';
  editForm.innerHTML = `
    <textarea class="edit-message-textarea">${content}</textarea>
    <div class="edit-message-buttons">
      <button class="save-edit-btn">Kaydet</button>
      <button class="cancel-edit-btn">İptal</button>
    </div>
  `;
  
  // Hide message content
  const messageContent = messageElement.querySelector('.message-content');
  messageContent.style.display = 'none';
  
  // Add edit form
  messageElement.appendChild(editForm);
  
  // Focus textarea
  const textarea = editForm.querySelector('.edit-message-textarea');
  textarea.focus();
  
  // Add event listener for save button
  const saveButton = editForm.querySelector('.save-edit-btn');
  saveButton.addEventListener('click', () => {
    const newContent = textarea.value.trim();
    if (newContent) {
      saveEditedDMMessage(messageId, newContent, friendUsername, socket);
      cancelEdit(messageElement);
    }
  });
  
  // Add event listener for textarea enter key
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const newContent = textarea.value.trim();
      if (newContent) {
        saveEditedDMMessage(messageId, newContent, friendUsername, socket);
        cancelEdit(messageElement);
      }
    }
  });
}

/**
 * Cancel message editing
 * @param {HTMLElement} messageElement - Message element
 */
function cancelEdit(messageElement) {
  // Show message content
  const messageContent = messageElement.querySelector('.message-content');
  messageContent.style.display = '';
  
  // Remove edit form
  const editForm = messageElement.querySelector('.edit-message-form');
  if (editForm) {
    editForm.remove();
  }
}

/**
 * Save edited channel message
 * @param {string} messageId - Message ID
 * @param {string} newContent - New message content
 * @param {Object} socket - Socket.io socket
 */
function saveEditedMessage(messageId, newContent, socket) {
  socket.emit('editMessage', {
    messageId,
    newContent
  }, (response) => {
    if (!response.success) {
      alert('Mesaj düzenlenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Save edited DM message
 * @param {string} messageId - Message ID
 * @param {string} newContent - New message content
 * @param {string} friendUsername - Friend's username
 * @param {Object} socket - Socket.io socket
 */
function saveEditedDMMessage(messageId, newContent, friendUsername, socket) {
  socket.emit('editDMMessage', {
    messageId,
    newContent,
    friendUsername
  }, (response) => {
    if (!response.success) {
      alert('Mesaj düzenlenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Delete a channel message
 * @param {string} messageId - Message ID
 * @param {Object} socket - Socket.io socket
 */
function deleteMessage(messageId, socket) {
  socket.emit('deleteMessage', {
    messageId
  }, (response) => {
    if (!response.success) {
      alert('Mesaj silinirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Delete a DM message
 * @param {string} messageId - Message ID
 * @param {string} friendUsername - Friend's username
 * @param {Object} socket - Socket.io socket
 */
function deleteDMMessage(messageId, friendUsername, socket) {
  socket.emit('deleteDMMessage', {
    messageId,
    friendUsername
  }, (response) => {
    if (!response.success) {
      alert('Mesaj silinirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Update an edited channel message in the UI
 * @param {Object} data - Message data
 */
function updateEditedMessage(data) {
  const { messageId, content, isEdited, editedAt } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);
  
  if (messageElement) {
    const messageContent = messageElement.querySelector('.message-content');
    messageContent.innerHTML = content;
    
    // Add edited indicator if not already present
    if (isEdited && !messageElement.querySelector('.edited-indicator')) {
      const editedIndicator = document.createElement('span');
      editedIndicator.className = 'edited-indicator';
      editedIndicator.textContent = ' (düzenlendi)';
      messageContent.appendChild(editedIndicator);
    }
  }
}

/**
 * Update an edited DM message in the UI
 * @param {Object} data - Message data
 */
function updateEditedDMMessage(data) {
  const { messageId, content, isEdited, editedAt, friend } = data;
  const dmMessages = document.querySelector('#dmMessages');
  
  // Only update if we're in the correct DM conversation
  if (dmMessages && dmMessages.dataset.friend === friend) {
    const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);
    
    if (messageElement) {
      const messageContent = messageElement.querySelector('.message-content');
      messageContent.innerHTML = content;
      
      // Add edited indicator if not already present
      if (isEdited && !messageElement.querySelector('.edited-indicator')) {
        const editedIndicator = document.createElement('span');
        editedIndicator.className = 'edited-indicator';
        editedIndicator.textContent = ' (düzenlendi)';
        messageContent.appendChild(editedIndicator);
      }
    }
  }
}

/**
 * Mark a channel message as deleted in the UI
 * @param {Object} data - Message data
 */
function markMessageAsDeleted(data) {
  const { messageId, isDeleted } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);
  
  if (messageElement && isDeleted) {
    const messageContent = messageElement.querySelector('.message-content');
    messageContent.innerHTML = '<em>Bu mesaj silindi.</em>';
    messageContent.classList.add('deleted-message');
    
    // Remove message actions
    const messageActions = messageElement.querySelector('.message-actions');
    if (messageActions) {
      messageActions.remove();
    }
  }
}

/**
 * Mark a DM message as deleted in the UI
 * @param {Object} data - Message data
 */
function markDMMessageAsDeleted(data) {
  const { messageId, isDeleted, friend } = data;
  const dmMessages = document.querySelector('#dmMessages');
  
  // Only update if we're in the correct DM conversation
  if (dmMessages && dmMessages.dataset.friend === friend) {
    const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);
    
    if (messageElement && isDeleted) {
      const messageContent = messageElement.querySelector('.message-content');
      messageContent.innerHTML = '<em>Bu mesaj silindi.</em>';
      messageContent.classList.add('deleted-message');
      
      // Remove message actions
      const messageActions = messageElement.querySelector('.message-actions');
      if (messageActions) {
        messageActions.remove();
      }
    }
  }
}
