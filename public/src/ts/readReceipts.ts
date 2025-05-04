/**
 * public/src/ts/readReceipts.ts
 * Read receipts module
 * Shows when messages have been read by other users
 */

// Socket.io socket arayüzü
interface Socket {
  emit: (event: string, data: any, callback?: (response: any) => void) => void;
  on: (event: string, callback: (data: any) => void) => void;
}

// Okundu bilgisi arayüzü
interface ReadReceiptData {
  messageId: string;
  readBy: string[];
}

// DM okundu bilgisi arayüzü
interface DMReadReceiptData {
  messageId: string;
  readAt: string | null;
  friend: string;
}

/**
 * Initialize read receipts functionality
 * @param socket - Socket.io socket
 */
export function initReadReceipts(socket: Socket): void {
  // Add event listeners for message containers
  addMessageContainerListeners(socket);

  // Add socket event listeners
  socket.on('messageRead', (data: ReadReceiptData) => {
    updateReadReceipt(data);
  });

  socket.on('dmMessageRead', (data: DMReadReceiptData) => {
    updateDMReadReceipt(data);
  });
}

/**
 * Add event listeners to message containers
 * @param socket - Socket.io socket
 */
function addMessageContainerListeners(socket: Socket): void {
  // Text channel messages container
  const textMessagesContainer = document.querySelector('#textMessages');
  if (textMessagesContainer) {
    // Use Intersection Observer to detect when messages are visible
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const messageElement = entry.target as HTMLElement;
            const messageId = messageElement.dataset['messageId'];
            const channelId = (textMessagesContainer as HTMLElement).dataset['channelId'];

            if (messageId && channelId) {
              // Mark message as read
              socket.emit('markMessageRead', { messageId, channelId });

              // Stop observing this message
              observer.unobserve(messageElement);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe existing messages
    textMessagesContainer.querySelectorAll('.text-message').forEach(message => {
      observer.observe(message);
    });

    // Observe new messages as they are added
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (
            (node as HTMLElement).classList &&
            (node as HTMLElement).classList.contains('text-message')
          ) {
            observer.observe(node as HTMLElement);
          }
        });
      });
    });

    mutationObserver.observe(textMessagesContainer, { childList: true });
  }

  // DM messages container
  const dmMessagesContainer = document.querySelector('#dmMessages');
  if (dmMessagesContainer) {
    // Use Intersection Observer to detect when messages are visible
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const messageElement = entry.target as HTMLElement;
            const messageId = messageElement.dataset['messageId'];
            const friendUsername = (dmMessagesContainer as HTMLElement).dataset['friend'];

            if (messageId && friendUsername) {
              // Mark message as read
              socket.emit('markDMMessageRead', { messageId, friendUsername });

              // Stop observing this message
              observer.unobserve(messageElement);
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    // Observe existing messages
    dmMessagesContainer.querySelectorAll('.dm-message').forEach(message => {
      observer.observe(message);
    });

    // Observe new messages as they are added
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (
            (node as HTMLElement).classList &&
            (node as HTMLElement).classList.contains('dm-message')
          ) {
            observer.observe(node as HTMLElement);
          }
        });
      });
    });

    mutationObserver.observe(dmMessagesContainer, { childList: true });
  }
}

/**
 * Update read receipt for a channel message
 * @param data - Message data
 */
function updateReadReceipt(data: ReadReceiptData): void {
  const { messageId, readBy } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`);

  if (messageElement) {
    // Check if read receipt already exists
    let readReceipt = messageElement.querySelector('.read-receipt');
    if (!readReceipt) {
      // Create read receipt element
      readReceipt = document.createElement('div');
      readReceipt.className = 'read-receipt';
      messageElement.appendChild(readReceipt);
    }

    // Update read receipt content
    if (readBy.length === 0) {
      readReceipt.innerHTML = '';
      (readReceipt as HTMLElement).style.display = 'none';
    } else if (readBy.length === 1) {
      readReceipt.innerHTML = `<span class="material-icons">done_all</span> ${readBy[0]} tarafından okundu`;
      (readReceipt as HTMLElement).style.display = 'block';
    } else {
      readReceipt.innerHTML = `<span class="material-icons">done_all</span> ${readBy.length} kişi tarafından okundu`;
      (readReceipt as HTMLElement).style.display = 'block';
    }
  }
}

/**
 * Update read receipt for a DM message
 * @param data - Message data
 */
function updateDMReadReceipt(data: DMReadReceiptData): void {
  const { messageId, readAt, friend } = data;
  const dmMessages = document.querySelector('#dmMessages');

  // Only update if we're in the correct DM conversation
  if (dmMessages && (dmMessages as HTMLElement).dataset['friend'] === friend) {
    const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`);

    if (messageElement) {
      // Check if read receipt already exists
      let readReceipt = messageElement.querySelector('.read-receipt');
      if (!readReceipt) {
        // Create read receipt element
        readReceipt = document.createElement('div');
        readReceipt.className = 'read-receipt';
        messageElement.appendChild(readReceipt);
      }

      // Update read receipt content
      if (readAt) {
        const readTime = new Date(readAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        readReceipt.innerHTML = `<span class="material-icons">done_all</span> ${readTime}`;
        (readReceipt as HTMLElement).style.display = 'block';
      } else {
        readReceipt.innerHTML = '<span class="material-icons">done</span>';
        (readReceipt as HTMLElement).style.display = 'block';
      }
    }
  }
}
