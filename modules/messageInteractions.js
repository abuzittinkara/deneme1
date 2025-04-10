// modules/messageInteractions.js
const Message = require('../models/Message');
const DMMessage = require('../models/DmMessage');
const User = require('../models/User');
const Channel = require('../models/Channel');
const roleManager = require('./roleManager');

/**
 * Mesaja tepki ekler
 * @param {string} messageId - Mesaj ID'si
 * @param {string} emoji - Emoji kodu
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function addReaction(messageId, emoji, username) {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Mesaj bulunamadı.');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  // Tepkiler Map'ini kontrol et
  if (!message.reactions) {
    message.reactions = new Map();
  }

  // Bu emoji için tepki veren kullanıcılar listesini al
  let usersReacted = message.reactions.get(emoji) || [];

  // Kullanıcı zaten tepki vermiş mi kontrol et
  if (usersReacted.some(userId => userId.toString() === user._id.toString())) {
    throw new Error('Bu mesaja zaten tepki vermişsiniz.');
  }

  // Kullanıcıyı tepki verenler listesine ekle
  usersReacted.push(user._id);
  message.reactions.set(emoji, usersReacted);

  await message.save();

  return {
    success: true,
    messageId,
    emoji,
    username,
    count: usersReacted.length
  };
}

/**
 * DM mesajına tepki ekler
 * @param {string} messageId - Mesaj ID'si
 * @param {string} emoji - Emoji kodu
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function addDMReaction(messageId, emoji, username) {
  const message = await DMMessage.findById(messageId);
  if (!message) {
    throw new Error('Mesaj bulunamadı.');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  // Kullanıcının bu DM'in bir parçası olduğunu kontrol et
  if (message.sender.toString() !== user._id.toString() &&
      message.receiver.toString() !== user._id.toString()) {
    throw new Error('Bu mesaja tepki verme yetkiniz yok.');
  }

  // Tepkiler Map'ini kontrol et
  if (!message.reactions) {
    message.reactions = new Map();
  }

  // Bu emoji için tepki veren kullanıcılar listesini al
  let usersReacted = message.reactions.get(emoji) || [];

  // Kullanıcı zaten tepki vermiş mi kontrol et
  if (usersReacted.some(userId => userId.toString() === user._id.toString())) {
    throw new Error('Bu mesaja zaten tepki vermişsiniz.');
  }

  // Kullanıcıyı tepki verenler listesine ekle
  usersReacted.push(user._id);
  message.reactions.set(emoji, usersReacted);

  await message.save();

  return {
    success: true,
    messageId,
    emoji,
    username,
    count: usersReacted.length
  };
}

/**
 * Mesajdan tepki kaldırır
 * @param {string} messageId - Mesaj ID'si
 * @param {string} emoji - Emoji kodu
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function removeReaction(messageId, emoji, username) {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Mesaj bulunamadı.');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  // Tepkiler Map'ini kontrol et
  if (!message.reactions || !message.reactions.has(emoji)) {
    throw new Error('Bu emoji ile tepki bulunamadı.');
  }

  // Bu emoji için tepki veren kullanıcılar listesini al
  let usersReacted = message.reactions.get(emoji) || [];

  // Kullanıcı tepki vermiş mi kontrol et
  const userIndex = usersReacted.findIndex(userId => userId.toString() === user._id.toString());
  if (userIndex === -1) {
    throw new Error('Bu mesaja tepki vermemişsiniz.');
  }

  // Kullanıcıyı tepki verenler listesinden çıkar
  usersReacted.splice(userIndex, 1);

  // Eğer hiç kullanıcı kalmadıysa, emoji'yi tamamen kaldır
  if (usersReacted.length === 0) {
    message.reactions.delete(emoji);
  } else {
    message.reactions.set(emoji, usersReacted);
  }

  await message.save();

  return {
    success: true,
    messageId,
    emoji,
    username,
    count: usersReacted.length
  };
}

/**
 * DM mesajından tepki kaldırır
 * @param {string} messageId - Mesaj ID'si
 * @param {string} emoji - Emoji kodu
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function removeDMReaction(messageId, emoji, username) {
  const message = await DMMessage.findById(messageId);
  if (!message) {
    throw new Error('Mesaj bulunamadı.');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  // Tepkiler Map'ini kontrol et
  if (!message.reactions || !message.reactions.has(emoji)) {
    throw new Error('Bu emoji ile tepki bulunamadı.');
  }

  // Bu emoji için tepki veren kullanıcılar listesini al
  let usersReacted = message.reactions.get(emoji) || [];

  // Kullanıcı tepki vermiş mi kontrol et
  const userIndex = usersReacted.findIndex(userId => userId.toString() === user._id.toString());
  if (userIndex === -1) {
    throw new Error('Bu mesaja tepki vermemişsiniz.');
  }

  // Kullanıcıyı tepki verenler listesinden çıkar
  usersReacted.splice(userIndex, 1);

  // Eğer hiç kullanıcı kalmadıysa, emoji'yi tamamen kaldır
  if (usersReacted.length === 0) {
    message.reactions.delete(emoji);
  } else {
    message.reactions.set(emoji, usersReacted);
  }

  await message.save();

  return {
    success: true,
    messageId,
    emoji,
    username,
    count: usersReacted.length
  };
}

/**
 * Mesajı sabitler
 * @param {string} messageId - Mesaj ID'si
 * @param {string} username - Kullanıcı adı
 * @param {string} groupId - Grup ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function pinMessage(messageId, username, groupId) {
  // İzin kontrolü
  const hasPermission = await roleManager.checkPermission(username, groupId, 'manageMessages');
  if (!hasPermission) {
    throw new Error('Bu işlem için yetkiniz yok.');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Mesaj bulunamadı.');
  }

  if (message.isPinned) {
    throw new Error('Mesaj zaten sabitlenmiş.');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  // Mesajı sabitle
  message.isPinned = true;
  message.pinnedAt = new Date();
  message.pinnedBy = user._id;

  await message.save();

  return {
    success: true,
    messageId,
    pinnedBy: username,
    pinnedAt: message.pinnedAt
  };
}

/**
 * Mesajın sabitlemesini kaldırır
 * @param {string} messageId - Mesaj ID'si
 * @param {string} username - Kullanıcı adı
 * @param {string} groupId - Grup ID'si
 * @returns {Promise<Object>} - İşlem sonucu
 */
async function unpinMessage(messageId, username, groupId) {
  // İzin kontrolü
  const hasPermission = await roleManager.checkPermission(username, groupId, 'manageMessages');
  if (!hasPermission) {
    throw new Error('Bu işlem için yetkiniz yok.');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw new Error('Mesaj bulunamadı.');
  }

  if (!message.isPinned) {
    throw new Error('Mesaj sabitlenmemiş.');
  }

  // Mesajın sabitlemesini kaldır
  message.isPinned = false;
  message.pinnedAt = undefined;
  message.pinnedBy = undefined;

  await message.save();

  return {
    success: true,
    messageId
  };
}

/**
 * Kanaldaki sabitlenmiş mesajları getirir
 * @param {string} channelId - Kanal ID'si
 * @returns {Promise<Array>} - Sabitlenmiş mesajlar listesi
 */
async function getPinnedMessages(channelId) {
  const channel = await Channel.findOne({ channelId });
  if (!channel) {
    throw new Error('Kanal bulunamadı.');
  }

  const pinnedMessages = await Message.find({
    channel: channel._id,
    isPinned: true,
    isDeleted: false
  })
  .sort({ pinnedAt: -1 })
  .populate('user', 'username')
  .populate('pinnedBy', 'username');

  return pinnedMessages.map(msg => ({
    id: msg._id,
    content: msg.content,
    timestamp: msg.timestamp,
    user: msg.user.username,
    pinnedBy: msg.pinnedBy ? msg.pinnedBy.username : null,
    pinnedAt: msg.pinnedAt,
    isEdited: msg.isEdited
  }));
}

/**
 * Mesajı alıntılar
 * @param {string} messageId - Alıntılanacak mesaj ID'si
 * @param {string} content - Yeni mesaj içeriği
 * @param {string} username - Kullanıcı adı
 * @param {string} channelId - Kanal ID'si
 * @returns {Promise<Object>} - Oluşturulan mesaj
 */
async function quoteMessage(messageId, content, username, channelId) {
  const quotedMessage = await Message.findById(messageId).populate('user', 'username');
  if (!quotedMessage) {
    throw new Error('Alıntılanacak mesaj bulunamadı.');
  }

  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  const channel = await Channel.findOne({ channelId });
  if (!channel) {
    throw new Error('Kanal bulunamadı.');
  }

  // Yeni mesaj oluştur
  const newMessage = new Message({
    channel: channel._id,
    user: user._id,
    content,
    timestamp: new Date(),
    quotedMessage: quotedMessage._id
  });

  await newMessage.save();

  // Mesajı popüle et
  await newMessage.populate('user', 'username');
  await newMessage.populate({
    path: 'quotedMessage',
    select: 'content user timestamp',
    populate: {
      path: 'user',
      select: 'username'
    }
  });

  return {
    id: newMessage._id,
    content: newMessage.content,
    timestamp: newMessage.timestamp,
    user: newMessage.user.username,
    quotedMessage: {
      id: quotedMessage._id,
      content: quotedMessage.content,
      user: quotedMessage.user.username,
      timestamp: quotedMessage.timestamp
    }
  };
}

/**
 * DM mesajını alıntılar
 * @param {string} messageId - Alıntılanacak mesaj ID'si
 * @param {string} content - Yeni mesaj içeriği
 * @param {string} username - Kullanıcı adı
 * @param {string} receiverUsername - Alıcı kullanıcı adı
 * @returns {Promise<Object>} - Oluşturulan mesaj
 */
async function quoteDMMessage(messageId, content, username, receiverUsername) {
  const quotedMessage = await DMMessage.findById(messageId).populate('sender', 'username');
  if (!quotedMessage) {
    throw new Error('Alıntılanacak mesaj bulunamadı.');
  }

  const sender = await User.findOne({ username });
  if (!sender) {
    throw new Error('Gönderen kullanıcı bulunamadı.');
  }

  const receiver = await User.findOne({ username: receiverUsername });
  if (!receiver) {
    throw new Error('Alıcı kullanıcı bulunamadı.');
  }

  // Yeni mesaj oluştur
  const newMessage = new DMMessage({
    sender: sender._id,
    receiver: receiver._id,
    content,
    timestamp: new Date(),
    quotedMessage: quotedMessage._id
  });

  await newMessage.save();

  // Mesajı popüle et
  await newMessage.populate('sender', 'username');
  await newMessage.populate('receiver', 'username');
  await newMessage.populate({
    path: 'quotedMessage',
    select: 'content sender timestamp',
    populate: {
      path: 'sender',
      select: 'username'
    }
  });

  return {
    id: newMessage._id,
    content: newMessage.content,
    timestamp: newMessage.timestamp,
    sender: newMessage.sender.username,
    receiver: newMessage.receiver.username,
    quotedMessage: {
      id: quotedMessage._id,
      content: quotedMessage.content,
      sender: quotedMessage.sender.username,
      timestamp: quotedMessage.timestamp
    }
  };
}

module.exports = {
  addReaction,
  addDMReaction,
  removeReaction,
  removeDMReaction,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  quoteMessage,
  quoteDMMessage
};
