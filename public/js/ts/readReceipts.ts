// public/js/ts/readReceipts.ts

/**
 * Read receipts module
 * Shows when messages have been read by other users
 */

import { Socket } from 'socket.io-client';

// Message read data interface
interface MessageReadData {
  messageId: string;
  readBy: string[];
}

// DM message read data interface
interface DMMessageReadData {
  messageId: string;
  readAt: string;
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
  socket.on('messageRead', (data: MessageReadData) => {
    updateReadReceipt(data);
  });
  
  socket.on('dmMessageRead', (data: DMMessageReadData) => {
    updateDMReadReceipt(data);
  });
}

/**
 * Add event listeners to message containers
 * @param socket - Socket.io socket
 */
function addMessageContainerListeners(socket: Socket): void {
  // Text channel messages container
  const textMessagesContainer = document.querySelector('#textMessages') as HTMLElement;
  if (textMessagesContainer) {
    // Use Intersection Observer to detect when messages are visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageElement = entry.target as HTMLElement;
          const messageId = messageElement.dataset.messageId;
          const channelId = textMessagesContainer.dataset.channelId;
          
          if (messageId && channelId) {
            // Mark message as read
            socket.emit('markMessageRead', { messageId, channelId });
            
            // Stop observing this message
            observer.unobserve(messageElement);
          }
        }
      });
    }, { threshold: 0.5 });
    
    // Observe existing messages
    textMessagesContainer.querySelectorAll('.text-message').forEach(message => {
      observer.observe(message);
    });
    
    // Observe new messages as they are added
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement && node.classList && node.classList.contains('text-message')) {
            observer.observe(node);
          }
        });
      });
    });
    
    mutationObserver.observe(textMessagesContainer, { childList: true });
  }
  
  // DM messages container
  const dmMessagesContainer = document.querySelector('#dmMessages') as HTMLElement;
  if (dmMessagesContainer) {
    // Use Intersection Observer to detect when messages are visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageElement = entry.target as HTMLElement;
          const messageId = messageElement.dataset.messageId;
          const friendUsername = dmMessagesContainer.dataset.friend;
          
          if (messageId && friendUsername) {
            // Mark message as read
            socket.emit('markDMMessageRead', { messageId, friendUsername });
            
            // Stop observing this message
            observer.unobserve(messageElement);
          }
        }
      });
    }, { threshold: 0.5 });
    
    // Observe existing messages
    dmMessagesContainer.querySelectorAll('.dm-message').forEach(message => {
      observer.observe(message);
    });
    
    // Observe new messages as they are added
    const mutationObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof HTMLElement && node.classList && node.classList.contains('dm-message')) {
            observer.observe(node);
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
function updateReadReceipt(data: MessageReadData): void {
  const { messageId, readBy } = data;
  const messageElement = document.querySelector(`.text-message[data-message-id="${messageId}"]`) as HTMLElement;
  
  if (messageElement) {
    // Check if read receipt already exists
    let readReceipt = messageElement.querySelector('.read-receipt') as HTMLElement;
    if (!readReceipt) {
      // Create read receipt element
      readReceipt = document.createElement('div');
      readReceipt.className = 'read-receipt';
      messageElement.appendChild(readReceipt);
    }
    
    // Update read receipt content
    if (readBy.length === 0) {
      readReceipt.innerHTML = '';
      readReceipt.style.display = 'none';
    } else if (readBy.length === 1) {
      readReceipt.innerHTML = `<span class="material-icons">done_all</span> ${readBy[0]} tarafından okundu`;
      readReceipt.style.display = 'block';
    } else {
      readReceipt.innerHTML = `<span class="material-icons">done_all</span> ${readBy.length} kişi tarafından okundu`;
      readReceipt.style.display = 'block';
    }
  }
}

/**
 * Update read receipt for a DM message
 * @param data - Message data
 */
function updateDMReadReceipt(data: DMMessageReadData): void {
  const { messageId, readAt, friend } = data;
  const dmMessages = document.querySelector('#dmMessages') as HTMLElement;
  
  // Only update if we're in the correct DM conversation
  if (dmMessages && dmMessages.dataset.friend === friend) {
    const messageElement = document.querySelector(`.dm-message[data-message-id="${messageId}"]`) as HTMLElement;
    
    if (messageElement) {
      // Check if read receipt already exists
      let readReceipt = messageElement.querySelector('.read-receipt') as HTMLElement;
      if (!readReceipt) {
        // Create read receipt element
        readReceipt = document.createElement('div');
        readReceipt.className = 'read-receipt';
        messageElement.appendChild(readReceipt);
      }
      
      // Update read receipt content
      if (readAt) {
        const readTime = new Date(readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        readReceipt.innerHTML = `<span class="material-icons">done_all</span> ${readTime}`;
        readReceipt.style.display = 'block';
      } else {
        readReceipt.innerHTML = '<span class="material-icons">done</span>';
        readReceipt.style.display = 'block';
      }
    }
  }
}
