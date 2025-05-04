/**
 * public/src/ts/messageManager.ts
 * Message management module for editing and deleting messages
 */

// Socket.io socket interface
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Message data interface
interface MessageData {
  messageId: string;
  content?: string;
  isDeleted?: boolean;
}

/**
 * Initialize message management functionality
 * @param socket - Socket.io socket
 */
export function initMessageManager(socket: Socket): void {
  // Add event listeners for message actions
  document.addEventListener('click', function (e) {
    const target = e.target as HTMLElement;

    // Edit message button
    if (target && target.classList.contains('edit-message-btn')) {
      const messageElement = target.closest('.text-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'] || '';
        const messageContent = messageElement.querySelector('.message-content')?.textContent || '';
        showEditMessageForm(messageElement, messageId, messageContent, socket);
      }
    }

    // Delete message button
    if (target && target.classList.contains('delete-message-btn')) {
      const messageElement = target.closest('.text-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'] || '';
        if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
          deleteChannelMessage(messageId, socket);
        }
      }
    }

    // Edit DM button
    if (target && target.classList.contains('edit-dm-btn')) {
      const messageElement = target.closest('.dm-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'] || '';
        const messageContent = messageElement.querySelector('.message-content')?.textContent || '';
        const friendUsername =
          document.querySelector('#dmMessages')?.getAttribute('data-friend') || '';
        showEditDMForm(messageElement, messageId, messageContent, friendUsername, socket);
      }
    }

    // Delete DM button
    if (target && target.classList.contains('delete-dm-btn')) {
      const messageElement = target.closest('.dm-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset['messageId'] || '';
        const friendUsername =
          document.querySelector('#dmMessages')?.getAttribute('data-friend') || '';
        if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
          deleteDMMessage(messageId, friendUsername, socket);
        }
      }
    }

    // Cancel edit button
    if (target && target.classList.contains('cancel-edit-btn')) {
      const messageElement = target.closest('.text-message, .dm-message') as HTMLElement;
      if (messageElement) {
        cancelEdit(messageElement);
      }
    }
  });

  // Listen for message updates
  socket.on('messageUpdated', (data: MessageData) => {
    updateMessageContent(data);
  });

  // Listen for message deletions
  socket.on('messageDeleted', (data: MessageData) => {
    markMessageAsDeleted(data);
  });

  // Listen for DM updates
  socket.on('dmUpdated', (data: MessageData) => {
    updateDMContent(data);
  });

  // Listen for DM deletions
  socket.on('dmDeleted', (data: MessageData) => {
    markDMAsDeleted(data);
  });
}

/**
 * Show edit message form
 * @param messageElement - Message element
 * @param messageId - Message ID
 * @param messageContent - Message content
 * @param socket - Socket.io socket
 */
function showEditMessageForm(
  messageElement: HTMLElement,
  messageId: string,
  messageContent: string,
  socket: Socket
): void {
  // Hide message content
  const contentElement = messageElement.querySelector('.message-content') as HTMLElement;
  if (contentElement) {
    contentElement.style.display = 'none';
  }

  // Create edit form
  const editForm = document.createElement('div');
  editForm.className = 'edit-message-form';
  editForm.innerHTML = `
    <textarea class="edit-message-textarea">${messageContent}</textarea>
    <div class="edit-message-actions">
      <button class="save-edit-btn">Kaydet</button>
      <button class="cancel-edit-btn">İptal</button>
    </div>
  `;

  // Insert edit form
  messageElement.appendChild(editForm);

  // Focus textarea
  const textarea = editForm.querySelector('.edit-message-textarea') as HTMLTextAreaElement;
  textarea.focus();

  // Add event listener for save button
  const saveButton = editForm.querySelector('.save-edit-btn') as HTMLButtonElement;
  saveButton.addEventListener('click', () => {
    const newContent = textarea.value.trim();
    if (newContent) {
      saveEditedMessage(messageId, newContent, socket);
      cancelEdit(messageElement);
    }
  });

  // Add event listener for textarea enter key
  textarea.addEventListener('keydown', e => {
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
 * Show edit DM form
 * @param messageElement - Message element
 * @param messageId - Message ID
 * @param messageContent - Message content
 * @param friendUsername - Friend username
 * @param socket - Socket.io socket
 */
function showEditDMForm(
  messageElement: HTMLElement,
  messageId: string,
  messageContent: string,
  friendUsername: string,
  socket: Socket
): void {
  // Hide message content
  const contentElement = messageElement.querySelector('.message-content') as HTMLElement;
  if (contentElement) {
    contentElement.style.display = 'none';
  }

  // Create edit form
  const editForm = document.createElement('div');
  editForm.className = 'edit-message-form';
  editForm.innerHTML = `
    <textarea class="edit-message-textarea">${messageContent}</textarea>
    <div class="edit-message-actions">
      <button class="save-edit-btn">Kaydet</button>
      <button class="cancel-edit-btn">İptal</button>
    </div>
  `;

  // Insert edit form
  messageElement.appendChild(editForm);

  // Focus textarea
  const textarea = editForm.querySelector('.edit-message-textarea') as HTMLTextAreaElement;
  textarea.focus();

  // Add event listener for save button
  const saveButton = editForm.querySelector('.save-edit-btn') as HTMLButtonElement;
  saveButton.addEventListener('click', () => {
    const newContent = textarea.value.trim();
    if (newContent) {
      saveEditedDMMessage(messageId, newContent, friendUsername, socket);
      cancelEdit(messageElement);
    }
  });

  // Add event listener for textarea enter key
  textarea.addEventListener('keydown', e => {
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
 * @param messageElement - Message element
 */
function cancelEdit(messageElement: HTMLElement): void {
  // Show message content
  const messageContent = messageElement.querySelector('.message-content') as HTMLElement;
  if (messageContent) {
    messageContent.style.display = '';
  }

  // Remove edit form
  const editForm = messageElement.querySelector('.edit-message-form');
  if (editForm) {
    editForm.remove();
  }
}

/**
 * Save edited message
 * @param messageId - Message ID
 * @param newContent - New message content
 * @param socket - Socket.io socket
 */
function saveEditedMessage(messageId: string, newContent: string, socket: Socket): void {
  socket.emit('editMessage', {
    messageId,
    newContent,
  });
}

/**
 * Save edited DM message
 * @param messageId - Message ID
 * @param newContent - New message content
 * @param friendUsername - Friend username
 * @param socket - Socket.io socket
 */
function saveEditedDMMessage(
  messageId: string,
  newContent: string,
  friendUsername: string,
  socket: Socket
): void {
  socket.emit('editDM', {
    messageId,
    newContent,
    friendUsername,
  });
}

/**
 * Delete channel message
 * @param messageId - Message ID
 * @param socket - Socket.io socket
 */
function deleteChannelMessage(messageId: string, socket: Socket): void {
  socket.emit('deleteMessage', {
    messageId,
  });
}

/**
 * Delete DM message
 * @param messageId - Message ID
 * @param friendUsername - Friend username
 * @param socket - Socket.io socket
 */
function deleteDMMessage(messageId: string, friendUsername: string, socket: Socket): void {
  socket.emit('deleteDM', {
    messageId,
    friendUsername,
  });
}

/**
 * Update message content in the UI
 * @param data - Message data
 */
function updateMessageContent(data: MessageData): void {
  const { messageId, content } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);

  if (messageElement && content) {
    const messageContent = messageElement.querySelector('.message-content');
    if (messageContent) {
      messageContent.innerHTML = content;
    }

    // Add edited indicator if not already present
    if (!messageElement.querySelector('.edited-indicator')) {
      const timestamp = messageElement.querySelector('.message-timestamp');
      if (timestamp) {
        const editedIndicator = document.createElement('span');
        editedIndicator.className = 'edited-indicator';
        editedIndicator.textContent = ' (düzenlendi)';
        timestamp.appendChild(editedIndicator);
      }
    }
  }
}

/**
 * Update DM content in the UI
 * @param data - Message data
 */
function updateDMContent(data: MessageData): void {
  const { messageId, content } = data;
  const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);

  if (messageElement && content) {
    const messageContent = messageElement.querySelector('.message-content');
    if (messageContent) {
      messageContent.innerHTML = content;
    }

    // Add edited indicator if not already present
    if (!messageElement.querySelector('.edited-indicator')) {
      const timestamp = messageElement.querySelector('.message-timestamp');
      if (timestamp) {
        const editedIndicator = document.createElement('span');
        editedIndicator.className = 'edited-indicator';
        editedIndicator.textContent = ' (düzenlendi)';
        timestamp.appendChild(editedIndicator);
      }
    }
  }
}

/**
 * Mark a channel message as deleted in the UI
 * @param data - Message data
 */
function markMessageAsDeleted(data: MessageData): void {
  const { messageId, isDeleted } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);

  if (messageElement && isDeleted) {
    const messageContent = messageElement.querySelector('.message-content');
    if (messageContent) {
      messageContent.innerHTML = '<em>Bu mesaj silindi.</em>';
      messageContent.classList.add('deleted-message');
    }

    // Remove message actions
    const messageActions = messageElement.querySelector('.message-actions');
    if (messageActions) {
      messageActions.remove();
    }
  }
}

/**
 * Mark a DM as deleted in the UI
 * @param data - Message data
 */
function markDMAsDeleted(data: MessageData): void {
  const { messageId, isDeleted } = data;
  const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);

  if (messageElement && isDeleted) {
    const messageContent = messageElement.querySelector('.message-content');
    if (messageContent) {
      messageContent.innerHTML = '<em>Bu mesaj silindi.</em>';
      messageContent.classList.add('deleted-message');
    }

    // Remove message actions
    const messageActions = messageElement.querySelector('.message-actions');
    if (messageActions) {
      messageActions.remove();
    }
  }
}
