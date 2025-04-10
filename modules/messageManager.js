/**************************************
 * modules/messageManager.js
 **************************************/
const Message = require('../models/Message');
const DMMessage = require('../models/DmMessage');
const User = require('../models/User');
const Channel = require('../models/Channel');
const FileAttachment = require('../models/FileAttachment');

// Function to edit a channel message
async function editChannelMessage(messageId, newContent, userId) {
  try {
    const message = await Message.findById(messageId).populate('user');

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if the user is the message author
    if (message.user._id.toString() !== userId.toString()) {
      throw new Error('You can only edit your own messages');
    }

    // Check if the message is deleted
    if (message.isDeleted) {
      throw new Error('Cannot edit a deleted message');
    }

    // Save original content if this is the first edit
    if (!message.isEdited) {
      message.originalContent = message.content;
    }

    // Update the message
    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();

    return {
      messageId: message._id,
      content: message.content,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      channelId: message.channel
    };
  } catch (err) {
    console.error('Edit channel message error:', err);
    throw err;
  }
}

// Function to delete a channel message
async function deleteChannelMessage(messageId, userId) {
  try {
    const message = await Message.findById(messageId).populate('user');

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if the user is the message author
    if (message.user._id.toString() !== userId.toString()) {
      throw new Error('You can only delete your own messages');
    }

    // Mark the message as deleted
    message.isDeleted = true;
    message.deletedAt = new Date();

    await message.save();

    return {
      messageId: message._id,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      channelId: message.channel
    };
  } catch (err) {
    console.error('Delete channel message error:', err);
    throw err;
  }
}

// Function to edit a DM message
async function editDMMessage(messageId, newContent, userId) {
  try {
    const message = await DMMessage.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if the user is the message sender
    if (message.sender.toString() !== userId.toString()) {
      throw new Error('You can only edit your own messages');
    }

    // Check if the message is deleted
    if (message.isDeleted) {
      throw new Error('Cannot edit a deleted message');
    }

    // Save original content if this is the first edit
    if (!message.isEdited) {
      message.originalContent = message.content;
    }

    // Update the message
    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();

    await message.save();

    return {
      messageId: message._id,
      content: message.content,
      isEdited: message.isEdited,
      editedAt: message.editedAt,
      sender: message.sender,
      receiver: message.receiver
    };
  } catch (err) {
    console.error('Edit DM message error:', err);
    throw err;
  }
}

// Function to delete a DM message
async function deleteDMMessage(messageId, userId) {
  try {
    const message = await DMMessage.findById(messageId);

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if the user is the message sender
    if (message.sender.toString() !== userId.toString()) {
      throw new Error('You can only delete your own messages');
    }

    // Mark the message as deleted
    message.isDeleted = true;
    message.deletedAt = new Date();

    await message.save();

    return {
      messageId: message._id,
      isDeleted: message.isDeleted,
      deletedAt: message.deletedAt,
      sender: message.sender,
      receiver: message.receiver
    };
  } catch (err) {
    console.error('Delete DM message error:', err);
    throw err;
  }
}

// Function to search messages in a channel
async function searchChannelMessages(channelId, query, limit = 20) {
  try {
    const channel = await Channel.findOne({ channelId });
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Search for messages containing the query
    const messages = await Message.find({
      channel: channel._id,
      content: { $regex: query, $options: 'i' },
      isDeleted: false
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'username')
    .lean();

    return messages;
  } catch (err) {
    console.error('Search channel messages error:', err);
    throw err;
  }
}

// Function to search DM messages
async function searchDMMessages(userId, friendId, query, limit = 20) {
  try {
    // Search for messages containing the query
    const messages = await DMMessage.find({
      $or: [
        { sender: userId, receiver: friendId },
        { sender: friendId, receiver: userId }
      ],
      content: { $regex: query, $options: 'i' },
      isDeleted: false
    })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('sender', 'username')
    .lean();

    return messages;
  } catch (err) {
    console.error('Search DM messages error:', err);
    throw err;
  }
}

module.exports = {
  editChannelMessage,
  deleteChannelMessage,
  editDMMessage,
  deleteDMMessage,
  searchChannelMessages,
  searchDMMessages
};
