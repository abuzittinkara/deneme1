// public/js/ts/messageManager.ts

/**
 * Message management module for editing and deleting messages
 */

import { Socket } from 'socket.io-client';

// Message response interface
interface MessageResponse {
  success: boolean;
  message?: string;
}

// Edited message data interface
interface EditedMessageData {
  messageId: string;
  content: string;
  isEdited: boolean;
  editedAt: string;
  friend?: string;
}

// Deleted message data interface
interface DeletedMessageData {
  messageId: string;
  isDeleted: boolean;
  friend?: string;
}

/**
 * Initialize message management functionality
 * @param socket - Socket.io socket
 */
export function initMessageManager(socket: Socket): void {
  // Add event listeners for message actions
  document.addEventListener('click', function(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Edit message button
    if (target && target.classList.contains('edit-message-btn')) {
      const messageElement = target.closest('.text-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const messageContentElement = messageElement.querySelector('.message-content');

        if (messageId && messageContentElement) {
          const messageContent = messageContentElement.textContent || '';
          showEditMessageForm(messageElement, messageId, messageContent, socket);
        }
      }
    }

    // Delete message button
    if (target && target.classList.contains('delete-message-btn')) {
      const messageElement = target.closest('.text-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        if (messageId && confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
          deleteMessage(messageId, socket);
        }
      }
    }

    // Edit DM message button
    if (target && target.classList.contains('edit-dm-message-btn')) {
      const messageElement = target.closest('.dm-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const messageContentElement = messageElement.querySelector('.message-content');
        const dmMessagesElement = document.querySelector('#dmMessages') as HTMLElement;

        if (messageId && messageContentElement && dmMessagesElement && dmMessagesElement.dataset.friend) {
          const messageContent = messageContentElement.textContent || '';
          const friendUsername = dmMessagesElement.dataset.friend;
          showEditDMMessageForm(messageElement, messageId, messageContent, friendUsername, socket);
        }
      }
    }

    // Delete DM message button
    if (target && target.classList.contains('delete-dm-message-btn')) {
      const messageElement = target.closest('.dm-message') as HTMLElement;
      if (messageElement) {
        const messageId = messageElement.dataset.messageId;
        const dmMessagesElement = document.querySelector('#dmMessages') as HTMLElement;

        if (messageId && dmMessagesElement && dmMessagesElement.dataset.friend) {
          const friendUsername = dmMessagesElement.dataset.friend;
          if (confirm('Bu mesajı silmek istediğinize emin misiniz?')) {
            deleteDMMessage(messageId, friendUsername, socket);
          }
        }
      }
    }

    // Cancel edit button
    if (target && target.classList.contains('cancel-edit-btn')) {
      const editForm = target.closest('.edit-message-form') as HTMLElement;
      if (editForm) {
        const messageElement = editForm.closest('.text-message, .dm-message') as HTMLElement;
        cancelEdit(messageElement);
      }
    }
  });

  // Add event listeners for socket events
  socket.on('messageEdited', (data: EditedMessageData) => {
    updateEditedMessage(data);
  });

  socket.on('messageDeleted', (data: DeletedMessageData) => {
    markMessageAsDeleted(data);
  });

  socket.on('dmMessageEdited', (data: EditedMessageData) => {
    updateEditedDMMessage(data);
  });

  socket.on('dmMessageDeleted', (data: DeletedMessageData) => {
    markDMMessageAsDeleted(data);
  });
}

/**
 * Show edit form for a channel message
 * @param messageElement - Message element
 * @param messageId - Message ID
 * @param content - Message content
 * @param socket - Socket.io socket
 */
function showEditMessageForm(
  messageElement: HTMLElement,
  messageId: string,
  content: string,
  socket: Socket
): void {
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
  const messageContent = messageElement.querySelector('.message-content') as HTMLElement;
  if (messageContent) {
    messageContent.style.display = 'none';
  }

  // Add edit form
  messageElement.appendChild(editForm);

  // Focus textarea
  const textarea = editForm.querySelector('.edit-message-textarea') as HTMLTextAreaElement;
  if (textarea) {
    textarea.focus();

    // Add event listener for save button
    const saveButton = editForm.querySelector('.save-edit-btn');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        const newContent = textarea.value.trim();
        if (newContent) {
          saveEditedMessage(messageId, newContent, socket);
          cancelEdit(messageElement);
        }
      });
    }

    // Add event listener for textarea enter key
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
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
}

/**
 * Show edit form for a DM message
 * @param messageElement - Message element
 * @param messageId - Message ID
 * @param content - Message content
 * @param friendUsername - Friend's username
 * @param socket - Socket.io socket
 */
function showEditDMMessageForm(
  messageElement: HTMLElement,
  messageId: string,
  content: string,
  friendUsername: string,
  socket: Socket
): void {
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
  const messageContent = messageElement.querySelector('.message-content') as HTMLElement;
  if (messageContent) {
    messageContent.style.display = 'none';
  }

  // Add edit form
  messageElement.appendChild(editForm);

  // Focus textarea
  const textarea = editForm.querySelector('.edit-message-textarea') as HTMLTextAreaElement;
  if (textarea) {
    textarea.focus();

    // Add event listener for save button
    const saveButton = editForm.querySelector('.save-edit-btn');
    if (saveButton) {
      saveButton.addEventListener('click', () => {
        const newContent = textarea.value.trim();
        if (newContent) {
          saveEditedDMMessage(messageId, newContent, friendUsername, socket);
          cancelEdit(messageElement);
        }
      });
    }

    // Add event listener for textarea enter key
    textarea.addEventListener('keydown', (e: KeyboardEvent) => {
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
 * Save edited channel message
 * @param messageId - Message ID
 * @param newContent - New message content
 * @param socket - Socket.io socket
 */
function saveEditedMessage(messageId: string, newContent: string, socket: Socket): void {
  socket.emit('editMessage', {
    messageId,
    newContent
  }, (response: MessageResponse) => {
    if (!response.success) {
      alert('Mesaj düzenlenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Save edited DM message
 * @param messageId - Message ID
 * @param newContent - New message content
 * @param friendUsername - Friend's username
 * @param socket - Socket.io socket
 */
function saveEditedDMMessage(
  messageId: string,
  newContent: string,
  friendUsername: string,
  socket: Socket
): void {
  socket.emit('editDMMessage', {
    messageId,
    newContent,
    friendUsername
  }, (response: MessageResponse) => {
    if (!response.success) {
      alert('Mesaj düzenlenirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Delete a channel message
 * @param messageId - Message ID
 * @param socket - Socket.io socket
 */
function deleteMessage(messageId: string, socket: Socket): void {
  socket.emit('deleteMessage', {
    messageId
  }, (response: MessageResponse) => {
    if (!response.success) {
      alert('Mesaj silinirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Delete a DM message
 * @param messageId - Message ID
 * @param friendUsername - Friend's username
 * @param socket - Socket.io socket
 */
function deleteDMMessage(messageId: string, friendUsername: string, socket: Socket): void {
  socket.emit('deleteDMMessage', {
    messageId,
    friendUsername
  }, (response: MessageResponse) => {
    if (!response.success) {
      alert('Mesaj silinirken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
    }
  });
}

/**
 * Update an edited channel message in the UI
 * @param data - Message data
 */
function updateEditedMessage(data: EditedMessageData): void {
  const { messageId, content, isEdited } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);

  if (messageElement) {
    const messageContent = messageElement.querySelector('.message-content');
    if (messageContent) {
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
 * Update an edited DM message in the UI
 * @param data - Message data
 */
function updateEditedDMMessage(data: EditedMessageData): void {
  const { messageId, content, isEdited, friend } = data;
  const dmMessages = document.querySelector('#dmMessages') as HTMLElement;

  // Only update if we're in the correct DM conversation
  if (dmMessages && dmMessages.dataset.friend === friend) {
    const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);

    if (messageElement) {
      const messageContent = messageElement.querySelector('.message-content');
      if (messageContent) {
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
}

/**
 * Mark a channel message as deleted in the UI
 * @param data - Message data
 */
function markMessageAsDeleted(data: DeletedMessageData): void {
  const { messageId, isDeleted } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);

  if (messageElement && isDeleted) {
    const messageContent = messageElement.querySelector('.message-content');
    if (messageContent) {
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

/**
 * Mark a DM message as deleted in the UI
 * @param data - Message data
 */
function markDMMessageAsDeleted(data: DeletedMessageData): void {
  const { messageId, isDeleted, friend } = data;
  const dmMessages = document.querySelector('#dmMessages') as HTMLElement;

  // Only update if we're in the correct DM conversation
  if (dmMessages && dmMessages.dataset.friend === friend) {
    const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);

    if (messageElement && isDeleted) {
      const messageContent = messageElement.querySelector('.message-content');
      if (messageContent) {
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
}
