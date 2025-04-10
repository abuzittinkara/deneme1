// public/js/scheduledMessages.js

/**
 * Scheduled messages module
 * Allows users to schedule messages to be sent at a specific time
 */

/**
 * Initialize scheduled messages functionality
 * @param {Object} socket - Socket.io socket
 */
export function initScheduledMessages(socket) {
  // Add schedule button to message input areas
  addScheduleButtons();
  
  // Add event listeners for schedule buttons
  document.addEventListener('click', (e) => {
    // Channel message schedule button
    if (e.target.closest('#scheduleMessageBtn')) {
      const input = document.querySelector('#textChannelMessageInput');
      const channelId = document.querySelector('#textMessages')?.dataset?.channelId;
      
      if (input && channelId) {
        showScheduleMessageModal(input.value, 'channel', channelId, null, socket);
      }
    }
    
    // DM message schedule button
    if (e.target.closest('#scheduleDMMessageBtn')) {
      const input = document.querySelector('#dmMessageInput');
      const friendUsername = document.querySelector('#dmMessages')?.dataset?.friend;
      
      if (input && friendUsername) {
        showScheduleMessageModal(input.value, 'dm', null, friendUsername, socket);
      }
    }
  });
  
  // Add socket event listeners
  socket.on('scheduledMessageCreated', (data) => {
    showScheduledMessageConfirmation(data);
  });
  
  socket.on('scheduledMessageSent', (data) => {
    showScheduledMessageSentNotification(data);
  });
}

/**
 * Add schedule buttons to message input areas
 */
function addScheduleButtons() {
  // Add schedule button to text channel input
  const textChannelInputBar = document.querySelector('#textChatInputBar .chat-input-wrapper');
  if (textChannelInputBar) {
    const scheduleButton = document.createElement('button');
    scheduleButton.id = 'scheduleMessageBtn';
    scheduleButton.className = 'schedule-message-btn';
    scheduleButton.innerHTML = '<span class="material-icons">schedule</span>';
    scheduleButton.title = 'Mesajı zamanla';
    
    // Insert before send button
    const sendButton = textChannelInputBar.querySelector('.send-icon');
    if (sendButton) {
      textChannelInputBar.insertBefore(scheduleButton, sendButton);
    } else {
      textChannelInputBar.appendChild(scheduleButton);
    }
  }
  
  // Add schedule button to DM input
  const dmInputBar = document.querySelector('#dmChatInputBar .chat-input-wrapper');
  if (dmInputBar) {
    const scheduleButton = document.createElement('button');
    scheduleButton.id = 'scheduleDMMessageBtn';
    scheduleButton.className = 'schedule-message-btn';
    scheduleButton.innerHTML = '<span class="material-icons">schedule</span>';
    scheduleButton.title = 'Mesajı zamanla';
    
    // Insert before send button
    const sendButton = dmInputBar.querySelector('.send-icon');
    if (sendButton) {
      dmInputBar.insertBefore(scheduleButton, sendButton);
    } else {
      dmInputBar.appendChild(scheduleButton);
    }
  }
}

/**
 * Show schedule message modal
 * @param {string} content - Message content
 * @param {string} type - Message type ('channel' or 'dm')
 * @param {string|null} channelId - Channel ID (for channel messages)
 * @param {string|null} friendUsername - Friend's username (for DM messages)
 * @param {Object} socket - Socket.io socket
 */
function showScheduleMessageModal(content, type, channelId, friendUsername, socket) {
  // Create modal
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'scheduleMessageModal';
  
  // Get current date and time
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  // Set default scheduled time to 1 hour from now
  const defaultDate = `${year}-${month}-${day}`;
  const defaultTime = `${String((now.getHours() + 1) % 24).padStart(2, '0')}:${minutes}`;
  
  // Create modal content
  modal.innerHTML = `
    <div class="modal-content schedule-modal-content">
      <h2>Mesajı Zamanla</h2>
      
      <div class="schedule-message-form">
        <div class="form-group">
          <label for="scheduleMessageContent">Mesaj:</label>
          <textarea id="scheduleMessageContent" class="schedule-message-textarea">${content}</textarea>
        </div>
        
        <div class="form-group">
          <label for="scheduleDate">Tarih:</label>
          <input type="date" id="scheduleDate" value="${defaultDate}" min="${defaultDate}">
        </div>
        
        <div class="form-group">
          <label for="scheduleTime">Saat:</label>
          <input type="time" id="scheduleTime" value="${defaultTime}">
        </div>
        
        <div class="schedule-message-buttons">
          <button id="confirmScheduleBtn" class="btn primary">Zamanla</button>
          <button id="cancelScheduleBtn" class="btn secondary">İptal</button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal to body
  document.body.appendChild(modal);
  
  // Show modal
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  
  // Add event listeners
  const confirmButton = document.querySelector('#confirmScheduleBtn');
  const cancelButton = document.querySelector('#cancelScheduleBtn');
  
  confirmButton.addEventListener('click', () => {
    const messageContent = document.querySelector('#scheduleMessageContent').value.trim();
    const scheduleDate = document.querySelector('#scheduleDate').value;
    const scheduleTime = document.querySelector('#scheduleTime').value;
    
    if (!messageContent || !scheduleDate || !scheduleTime) {
      alert('Lütfen tüm alanları doldurun.');
      return;
    }
    
    // Create scheduled time
    const scheduledTime = new Date(`${scheduleDate}T${scheduleTime}`);
    
    // Check if scheduled time is in the future
    if (scheduledTime <= new Date()) {
      alert('Lütfen gelecekte bir zaman seçin.');
      return;
    }
    
    // Schedule message
    if (type === 'channel') {
      socket.emit('scheduleMessage', {
        content: messageContent,
        channelId,
        scheduledTime: scheduledTime.toISOString()
      }, (response) => {
        if (response.success) {
          // Clear input field
          document.querySelector('#textChannelMessageInput').value = '';
        } else {
          alert('Mesaj zamanlanırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
        }
      });
    } else if (type === 'dm') {
      socket.emit('scheduleDMMessage', {
        content: messageContent,
        friendUsername,
        scheduledTime: scheduledTime.toISOString()
      }, (response) => {
        if (response.success) {
          // Clear input field
          document.querySelector('#dmMessageInput').value = '';
        } else {
          alert('Mesaj zamanlanırken bir hata oluştu: ' + (response.message || 'Bilinmeyen hata'));
        }
      });
    }
    
    // Close modal
    closeScheduleModal();
  });
  
  cancelButton.addEventListener('click', () => {
    closeScheduleModal();
  });
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeScheduleModal();
    }
  });
}

/**
 * Close schedule message modal
 */
function closeScheduleModal() {
  const modal = document.querySelector('#scheduleMessageModal');
  if (modal) {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.remove();
    }, 300);
  }
}

/**
 * Show scheduled message confirmation
 * @param {Object} data - Scheduled message data
 */
function showScheduledMessageConfirmation(data) {
  const { scheduledTime, type } = data;
  
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'toast scheduled-message-toast';
  
  // Format scheduled time
  const scheduledDate = new Date(scheduledTime);
  const formattedDate = scheduledDate.toLocaleDateString();
  const formattedTime = scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  // Set toast content
  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-icons">schedule</span>
    </div>
    <div class="toast-content">
      <div class="toast-title">Mesaj Zamanlandı</div>
      <div class="toast-message">
        ${type === 'channel' ? 'Kanal mesajı' : 'DM mesajı'} ${formattedDate} ${formattedTime} tarihinde gönderilecek.
      </div>
    </div>
    <div class="toast-close">
      <span class="material-icons">close</span>
    </div>
  `;
  
  // Add toast to body
  document.body.appendChild(toast);
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Add event listener for close button
  const closeButton = toast.querySelector('.toast-close');
  closeButton.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  });
  
  // Auto-hide toast after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 5000);
}

/**
 * Show scheduled message sent notification
 * @param {Object} data - Scheduled message data
 */
function showScheduledMessageSentNotification(data) {
  const { type } = data;
  
  // Create toast notification
  const toast = document.createElement('div');
  toast.className = 'toast scheduled-message-sent-toast';
  
  // Set toast content
  toast.innerHTML = `
    <div class="toast-icon">
      <span class="material-icons">schedule_send</span>
    </div>
    <div class="toast-content">
      <div class="toast-title">Zamanlanmış Mesaj Gönderildi</div>
      <div class="toast-message">
        Zamanlanmış ${type === 'channel' ? 'kanal mesajınız' : 'DM mesajınız'} gönderildi.
      </div>
    </div>
    <div class="toast-close">
      <span class="material-icons">close</span>
    </div>
  `;
  
  // Add toast to body
  document.body.appendChild(toast);
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Add event listener for close button
  const closeButton = toast.querySelector('.toast-close');
  closeButton.addEventListener('click', () => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  });
  
  // Auto-hide toast after 5 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 5000);
}
