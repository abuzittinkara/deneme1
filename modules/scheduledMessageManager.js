// modules/scheduledMessageManager.js
const ScheduledMessage = require('../models/ScheduledMessage');
const Message = require('../models/Message');
const DMMessage = require('../models/DmMessage');
const Channel = require('../models/Channel');
const User = require('../models/User');

/**
 * Initialize scheduled message manager
 * @param {Object} io - Socket.IO instance
 * @param {Object} richTextFormatter - Rich text formatter module
 */
function initScheduledMessageManager(io, richTextFormatter) {
  // Check for scheduled messages every minute
  setInterval(async () => {
    try {
      await checkScheduledMessages(io, richTextFormatter);
    } catch (err) {
      console.error('Scheduled message check error:', err);
    }
  }, 60000); // 60 seconds
}

/**
 * Check for scheduled messages that need to be sent
 * @param {Object} io - Socket.IO instance
 * @param {Object} richTextFormatter - Rich text formatter module
 */
async function checkScheduledMessages(io, richTextFormatter) {
  const now = new Date();
  
  // Find scheduled messages that need to be sent
  const scheduledMessages = await ScheduledMessage.find({
    scheduledTime: { $lte: now },
    isSent: false
  })
  .populate('user', 'username')
  .populate('channel')
  .populate('receiver', 'username');
  
  // Send each scheduled message
  for (const scheduledMessage of scheduledMessages) {
    try {
      if (scheduledMessage.type === 'channel') {
        await sendScheduledChannelMessage(scheduledMessage, io, richTextFormatter);
      } else if (scheduledMessage.type === 'dm') {
        await sendScheduledDMMessage(scheduledMessage, io, richTextFormatter);
      }
      
      // Mark message as sent
      scheduledMessage.isSent = true;
      scheduledMessage.sentAt = new Date();
      await scheduledMessage.save();
      
      // Notify the sender that the scheduled message was sent
      const senderSocketId = Object.keys(io.sockets.sockets).find(id => {
        const socket = io.sockets.sockets[id];
        return socket.username === scheduledMessage.user.username;
      });
      
      if (senderSocketId) {
        io.to(senderSocketId).emit('scheduledMessageSent', {
          id: scheduledMessage._id,
          type: scheduledMessage.type
        });
      }
    } catch (err) {
      console.error('Error sending scheduled message:', err);
    }
  }
}

/**
 * Send a scheduled channel message
 * @param {Object} scheduledMessage - Scheduled message document
 * @param {Object} io - Socket.IO instance
 * @param {Object} richTextFormatter - Rich text formatter module
 */
async function sendScheduledChannelMessage(scheduledMessage, io, richTextFormatter) {
  // Format message content
  const formattedContent = richTextFormatter.processText(scheduledMessage.content);
  
  // Create new message
  const newMessage = new Message({
    channel: scheduledMessage.channel._id,
    user: scheduledMessage.user._id,
    content: formattedContent,
    timestamp: new Date()
  });
  
  await newMessage.save();
  
  // Send message to channel
  io.to(scheduledMessage.channel.channelId).emit('newTextMessage', {
    channelId: scheduledMessage.channel.channelId,
    message: {
      _id: newMessage._id,
      content: newMessage.content,
      username: scheduledMessage.user.username,
      timestamp: newMessage.timestamp,
      isScheduled: true
    }
  });
}

/**
 * Send a scheduled DM message
 * @param {Object} scheduledMessage - Scheduled message document
 * @param {Object} io - Socket.IO instance
 * @param {Object} richTextFormatter - Rich text formatter module
 */
async function sendScheduledDMMessage(scheduledMessage, io, richTextFormatter) {
  // Format message content
  const formattedContent = richTextFormatter.processText(scheduledMessage.content);
  
  // Create new message
  const newMessage = new DMMessage({
    sender: scheduledMessage.user._id,
    receiver: scheduledMessage.receiver._id,
    content: formattedContent,
    timestamp: new Date()
  });
  
  await newMessage.save();
  
  // Send message to receiver
  const receiverSocketId = Object.keys(io.sockets.sockets).find(id => {
    const socket = io.sockets.sockets[id];
    return socket.username === scheduledMessage.receiver.username;
  });
  
  if (receiverSocketId) {
    io.to(receiverSocketId).emit('newDMMessage', {
      friend: scheduledMessage.user.username,
      message: {
        _id: newMessage._id,
        content: newMessage.content,
        sender: scheduledMessage.user.username,
        timestamp: newMessage.timestamp,
        isScheduled: true
      }
    });
  }
  
  // Send message to sender
  const senderSocketId = Object.keys(io.sockets.sockets).find(id => {
    const socket = io.sockets.sockets[id];
    return socket.username === scheduledMessage.user.username;
  });
  
  if (senderSocketId) {
    io.to(senderSocketId).emit('newDMMessage', {
      friend: scheduledMessage.receiver.username,
      message: {
        _id: newMessage._id,
        content: newMessage.content,
        sender: scheduledMessage.user.username,
        timestamp: newMessage.timestamp,
        isScheduled: true
      }
    });
  }
}

/**
 * Get scheduled messages for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of scheduled messages
 */
async function getUserScheduledMessages(userId) {
  return await ScheduledMessage.find({
    user: userId,
    isSent: false
  })
  .sort({ scheduledTime: 1 })
  .populate('channel', 'name')
  .populate('receiver', 'username');
}

/**
 * Cancel a scheduled message
 * @param {string} messageId - Scheduled message ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Result object
 */
async function cancelScheduledMessage(messageId, userId) {
  const scheduledMessage = await ScheduledMessage.findById(messageId);
  
  if (!scheduledMessage) {
    throw new Error('Scheduled message not found');
  }
  
  if (scheduledMessage.user.toString() !== userId.toString()) {
    throw new Error('You can only cancel your own scheduled messages');
  }
  
  if (scheduledMessage.isSent) {
    throw new Error('This message has already been sent');
  }
  
  await scheduledMessage.remove();
  
  return {
    success: true,
    messageId
  };
}

module.exports = {
  initScheduledMessageManager,
  getUserScheduledMessages,
  cancelScheduledMessage
};
