/**************************************
 * modules/dmManager.js
 * Doğrudan mesajlaşma (DM) ile ilgili tüm işlevleri içerir
 **************************************/
const User = require('../models/User');
const DMMessage = require('../models/DmMessage');
const richTextFormatter = require('./richTextFormatter');

/**
 * DM mesajı gönderir
 * @param {string} senderUsername - Gönderen kullanıcı adı
 * @param {string} receiverUsername - Alıcı kullanıcı adı
 * @param {string} content - Mesaj içeriği
 * @param {Object} fileAttachment - Dosya eki (opsiyonel)
 * @returns {Promise<Object>} - Gönderilen mesaj bilgileri
 */
async function sendDMMessage(senderUsername, receiverUsername, content, fileAttachment = null) {
  // Kullanıcıları bul
  const senderDoc = await User.findOne({ username: senderUsername });
  const receiverDoc = await User.findOne({ username: receiverUsername });

  if (!senderDoc || !receiverDoc) {
    throw new Error('Kullanıcılar bulunamadı.');
  }

  // Engellenmiş mi kontrol et
  if (receiverDoc.blocked.includes(senderDoc._id)) {
    throw new Error('Bu kullanıcı sizi engellemiş.');
  }

  if (senderDoc.blocked.includes(receiverDoc._id)) {
    throw new Error('Bu kullanıcıyı engellemişsiniz.');
  }

  // Mesaj içeriğini işle
  const formattedContent = richTextFormatter.processText(content);

  // Yeni mesaj oluştur
  const newMessage = new DMMessage({
    sender: senderDoc._id,
    receiver: receiverDoc._id,
    content: formattedContent,
    timestamp: new Date()
  });

  // Dosya eki varsa ekle
  if (fileAttachment) {
    newMessage.attachments = [fileAttachment.fileId];
  }

  await newMessage.save();

  // Mesaj bilgilerini döndür
  return {
    id: newMessage._id,
    content: newMessage.content,
    timestamp: newMessage.timestamp,
    sender: senderUsername,
    receiver: receiverUsername,
    attachments: fileAttachment ? [fileAttachment] : []
  };
}

/**
 * İki kullanıcı arasındaki DM geçmişini getirir
 * @param {string} username1 - Birinci kullanıcı adı
 * @param {string} username2 - İkinci kullanıcı adı
 * @param {number} limit - Getirilecek maksimum mesaj sayısı
 * @param {number} skip - Atlanacak mesaj sayısı (sayfalama için)
 * @returns {Promise<Array>} - Mesaj listesi
 */
async function getDMHistory(username1, username2, limit = 50, skip = 0) {
  // Kullanıcıları bul
  const user1 = await User.findOne({ username: username1 });
  const user2 = await User.findOne({ username: username2 });

  if (!user1 || !user2) {
    throw new Error('Kullanıcılar bulunamadı.');
  }

  // Mesajları getir
  const messages = await DMMessage.find({
    $or: [
      { sender: user1._id, receiver: user2._id },
      { sender: user2._id, receiver: user1._id }
    ]
  })
  .sort({ timestamp: -1 })
  .skip(skip)
  .limit(limit)
  .populate('sender', 'username')
  .populate('receiver', 'username')
  .populate('attachments');

  // Mesajları formatla
  return messages.map(msg => ({
    id: msg._id,
    content: msg.content,
    timestamp: msg.timestamp,
    sender: msg.sender.username,
    receiver: msg.receiver.username,
    isEdited: msg.isEdited,
    editedAt: msg.editedAt,
    isDeleted: msg.isDeleted,
    attachments: msg.attachments ? msg.attachments.map(att => ({
      id: att._id,
      fileName: att.originalName,
      filePath: att.path,
      fileType: att.mimeType,
      fileSize: att.size
    })) : []
  })).reverse(); // En eski mesajlar önce gelsin
}

/**
 * Kullanıcının tüm DM sohbetlerini getirir
 * @param {string} username - Kullanıcı adı
 * @returns {Promise<Array>} - Sohbet listesi
 */
async function getUserDMChats(username) {
  // Kullanıcıyı bul
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error('Kullanıcı bulunamadı.');
  }

  // Bu kullanıcının gönderdiği veya aldığı tüm mesajları bul
  const messages = await DMMessage.find({
    $or: [
      { sender: user._id },
      { receiver: user._id }
    ]
  })
  .sort({ timestamp: -1 })
  .populate('sender', 'username')
  .populate('receiver', 'username');

  // Benzersiz sohbetleri bul
  const chats = new Map();

  for (const msg of messages) {
    const isSender = msg.sender.username === username;
    const otherUser = isSender ? msg.receiver.username : msg.sender.username;

    if (!chats.has(otherUser)) {
      chats.set(otherUser, {
        username: otherUser,
        lastMessage: {
          content: msg.content,
          timestamp: msg.timestamp,
          isFromMe: isSender
        }
      });
    }
  }

  return Array.from(chats.values());
}

module.exports = {
  sendDMMessage,
  getDMHistory,
  getUserDMChats
};
