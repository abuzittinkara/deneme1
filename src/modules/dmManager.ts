/**
 * src/modules/dmManager.ts
 * Doğrudan mesajlaşma (DM) ile ilgili tüm işlevleri içerir
 */
import mongoose from 'mongoose';
import { User, UserDocument } from '../models/User';
import { DmMessage, DmMessageDocument } from '../models/DmMessage';
import * as richTextFormatter from './richTextFormatter';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { toObjectId, objectIdEquals, createModelHelper } from '../utils/mongoose-helpers';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const DmMessageHelper = createModelHelper<DmMessageDocument, typeof DmMessage>(DmMessage);

// Dosya eki arayüzü
export interface FileAttachment {
  fileId: mongoose.Types.ObjectId;
  fileName?: string;
  filePath?: string;
  fileType?: string;
  fileSize?: number;
}

// Mesaj sonucu arayüzü
export interface MessageResult {
  id: mongoose.Types.ObjectId;
  content: string;
  timestamp: Date;
  sender: string;
  receiver: string;
  attachments: FileAttachment[];
  isEdited?: boolean;
  editedAt?: Date;
  isDeleted?: boolean;
}

// Sohbet arayüzü
export interface ChatInfo {
  username: string;
  lastMessage: {
    content: string;
    timestamp: Date;
    isFromMe: boolean;
  };
}

/**
 * DM mesajı gönderir
 * @param senderUsername - Gönderen kullanıcı adı
 * @param receiverUsername - Alıcı kullanıcı adı
 * @param content - Mesaj içeriği
 * @param fileAttachment - Dosya eki (opsiyonel)
 * @returns Gönderilen mesaj bilgileri
 */
export async function sendDMMessage(
  senderUsername: string,
  receiverUsername: string,
  content: string,
  fileAttachment: FileAttachment | null = null
): Promise<MessageResult> {
  try {
    // Kullanıcıları bul
    const senderDoc = await UserHelper.findOne({ username: senderUsername });
    const receiverDoc = await UserHelper.findOne({ username: receiverUsername });

    if (!senderDoc || !receiverDoc) {
      throw new NotFoundError('Kullanıcılar bulunamadı.');
    }

    // Engellenmiş mi kontrol et
    if (receiverDoc.blocked.some((id) => objectIdEquals(id, senderDoc._id))) {
      throw new ForbiddenError('Bu kullanıcı sizi engellemiş.');
    }

    if (senderDoc.blocked.some((id) => objectIdEquals(id, receiverDoc._id))) {
      throw new ForbiddenError('Bu kullanıcıyı engellemişsiniz.');
    }

    // Mesaj içeriğini işle
    const formattedContent = richTextFormatter.processText(content);

    // Yeni mesaj oluştur
    const newMessage = new (DmMessageHelper.getModel())({
      sender: toObjectId(senderDoc._id),
      receiver: toObjectId(receiverDoc._id),
      content: formattedContent,
      timestamp: new Date(),
    });

    // Dosya eki varsa ekle
    if (fileAttachment) {
      newMessage.attachments = [fileAttachment.fileId];
    }

    await newMessage.save();

    logger.info('DM mesajı gönderildi', {
      sender: senderUsername,
      receiver: receiverUsername,
      messageId: newMessage._id,
    });

    // Mesaj bilgilerini döndür
    return {
      id: toObjectId(newMessage._id),
      content: newMessage.content,
      timestamp: newMessage.timestamp,
      sender: senderUsername,
      receiver: receiverUsername,
      attachments: fileAttachment ? [fileAttachment] : [],
    };
  } catch (error) {
    logger.error('DM mesajı gönderme hatası', {
      error: (error as Error).message,
      sender: senderUsername,
      receiver: receiverUsername,
    });
    throw error;
  }
}

/**
 * İki kullanıcı arasındaki DM geçmişini getirir
 * @param username1 - Birinci kullanıcı adı
 * @param username2 - İkinci kullanıcı adı
 * @param limit - Getirilecek maksimum mesaj sayısı
 * @param skip - Atlanacak mesaj sayısı (sayfalama için)
 * @returns Mesaj listesi
 */
export async function getDMHistory(
  username1: string,
  username2: string,
  limit = 50,
  skip = 0
): Promise<MessageResult[]> {
  try {
    // Kullanıcıları bul
    const user1 = await UserHelper.findOne({ username: username1 });
    const user2 = await UserHelper.findOne({ username: username2 });

    if (!user1 || !user2) {
      throw new NotFoundError('Kullanıcılar bulunamadı.');
    }

    // Mesajları getir
    const messages = await DmMessageHelper.find(
      {
        $or: [
          { sender: toObjectId(user1._id), receiver: toObjectId(user2._id) },
          { sender: toObjectId(user2._id), receiver: toObjectId(user1._id) },
        ],
      },
      null,
      {
        sort: { timestamp: -1 },
        skip,
        limit,
        populate: [
          { path: 'sender', select: 'username' },
          { path: 'receiver', select: 'username' },
          { path: 'attachments' },
        ],
      }
    );

    logger.info('DM geçmişi getirildi', {
      user1: username1,
      user2: username2,
      count: messages.length,
    });

    // Mesajları formatla
    return messages
      .map((msg) => ({
        id: toObjectId(msg._id),
        content: msg.content,
        timestamp: msg.timestamp,
        sender: (msg.sender as any).username,
        receiver: (msg.receiver as any).username,
        isEdited: msg.isEdited,
        editedAt: msg.editedAt,
        isDeleted: msg.isDeleted,
        attachments: msg.attachments
          ? (msg.attachments as any).map((att: any) => ({
            id: toObjectId(att._id),
            fileId: toObjectId(att._id),
            fileName: att.originalName,
            filePath: att.path,
            fileType: att.mimeType,
            fileSize: att.size,
          }))
          : [],
      }))
      .reverse(); // En eski mesajlar önce gelsin
  } catch (error) {
    logger.error('DM geçmişi getirme hatası', {
      error: (error as Error).message,
      user1: username1,
      user2: username2,
    });
    throw error;
  }
}

/**
 * Kullanıcının tüm DM sohbetlerini getirir
 * @param username - Kullanıcı adı
 * @returns Sohbet listesi
 */
export async function getUserDMChats(username: string): Promise<ChatInfo[]> {
  try {
    // Kullanıcıyı bul
    const user = await UserHelper.findOne({ username });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Bu kullanıcının gönderdiği veya aldığı tüm mesajları bul
    const messages = await DmMessageHelper.find(
      {
        $or: [{ sender: toObjectId(user._id) }, { receiver: toObjectId(user._id) }],
      },
      null,
      {
        sort: { timestamp: -1 },
        populate: [
          { path: 'sender', select: 'username' },
          { path: 'receiver', select: 'username' },
        ],
      }
    );

    // Benzersiz sohbetleri bul
    const chats = new Map<string, ChatInfo>();

    for (const msg of messages) {
      const isSender = (msg.sender as any).username === username;
      const otherUser = isSender ? (msg.receiver as any).username : (msg.sender as any).username;

      if (!chats.has(otherUser)) {
        chats.set(otherUser, {
          username: otherUser,
          lastMessage: {
            content: msg.content,
            timestamp: msg.timestamp,
            isFromMe: isSender,
          },
        });
      }
    }

    logger.info('Kullanıcı DM sohbetleri getirildi', {
      username,
      count: chats.size,
    });

    return Array.from(chats.values());
  } catch (error) {
    logger.error('Kullanıcı DM sohbetleri getirme hatası', {
      error: (error as Error).message,
      username,
    });
    throw error;
  }
}

export default {
  sendDMMessage,
  getDMHistory,
  getUserDMChats,
};
