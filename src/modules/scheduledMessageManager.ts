/**
 * src/modules/scheduledMessageManager.ts
 * Zamanlanmış mesaj yönetimi
 */
import { Server as SocketIOServer, Socket } from 'socket.io';
import mongoose from 'mongoose';
import { ScheduledMessage, ScheduledMessageDocument } from '../models/ScheduledMessage';
import { Message, MessageDocument } from '../models/Message';
import { DmMessage, DmMessageDocument } from '../models/DmMessage';
import { Channel, ChannelDocument } from '../models/Channel';
import { User, UserDocument } from '../models/User';
import { Group, GroupDocument } from '../models/Group';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';

// Model yardımcıları
const ScheduledMessageHelper = createModelHelper<ScheduledMessageDocument, typeof ScheduledMessage>(
  ScheduledMessage
);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const DmMessageHelper = createModelHelper<DmMessageDocument, typeof DmMessage>(DmMessage);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);

// Rich text formatter modülü arayüzü
interface RichTextFormatter {
  processText(text: string): string;
}

// Zamanlanmış mesaj sonucu arayüzü
export interface ScheduledMessageResult {
  success: boolean;
  messageId?: string;
  message?: string;
}

// Zamanlanmış görev referansı
let scheduledMessageInterval: NodeJS.Timeout | null = null;

/**
 * Zamanlanmış mesaj yöneticisini başlat
 * @param io - Socket.IO nesnesi
 * @param richTextFormatter - Zengin metin biçimlendirici modülü
 */
export function initScheduledMessageManager(
  io: SocketIOServer,
  richTextFormatter: RichTextFormatter
): void {
  // Önceki interval'ı temizle
  if (scheduledMessageInterval) {
    clearInterval(scheduledMessageInterval);
    scheduledMessageInterval = null;
  }

  // Geliştirme modunda zamanlanmış mesaj kontrolünü atla
  if (process.env.NODE_ENV === 'development') {
    logger.info('Geliştirme modunda zamanlanmış mesaj kontrolü atlanıyor');
    return;
  }

  // Her dakika zamanlanmış mesajları kontrol et
  scheduledMessageInterval = setInterval(async () => {
    try {
      await checkScheduledMessages(io, richTextFormatter);
    } catch (err) {
      logger.error('Zamanlanmış mesaj kontrolü hatası', { error: (err as Error).message });
    }
  }, 60000); // 60 saniye

  logger.info('Zamanlanmış mesaj yöneticisi başlatıldı');
}

/**
 * Zamanlanmış mesaj yöneticisini durdur
 */
export function stopScheduledMessageManager(): void {
  if (scheduledMessageInterval) {
    clearInterval(scheduledMessageInterval);
    scheduledMessageInterval = null;
    logger.info('Zamanlanmış mesaj yöneticisi durduruldu');
  }
}

/**
 * Gönderilmesi gereken zamanlanmış mesajları kontrol et
 * @param io - Socket.IO nesnesi
 * @param richTextFormatter - Zengin metin biçimlendirici modülü
 */
async function checkScheduledMessages(
  io: SocketIOServer,
  richTextFormatter: RichTextFormatter
): Promise<void> {
  // Geliştirme modunda zamanlanmış mesaj kontrolünü atla
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  const now = new Date();

  // Gönderilmesi gereken zamanlanmış mesajları bul
  const scheduledMessages = await ScheduledMessageHelper.find(
    {
      scheduledTime: { $lte: now },
      sent: false,
    },
    null,
    {
      populate: [
        { path: 'sender', select: 'username' },
        { path: 'channel' },
        { path: 'group', select: 'name' },
      ],
    }
  );

  if (scheduledMessages.length === 0) {
    return;
  }

  logger.info('Gönderilecek zamanlanmış mesajlar bulundu', { count: scheduledMessages.length });

  // Her zamanlanmış mesajı gönder
  for (const scheduledMessage of scheduledMessages) {
    try {
      // Kanal mesajı gönder
      await sendScheduledChannelMessage(scheduledMessage, io, richTextFormatter);

      // Mesajı gönderildi olarak işaretle
      scheduledMessage.sent = true;
      scheduledMessage.sentTime = new Date();
      await scheduledMessage.save();

      // Gönderene zamanlanmış mesajın gönderildiğini bildir
      const senderSocket = findSocketByUsername(io, (scheduledMessage.sender as any).username);

      if (senderSocket) {
        io.to(senderSocket.id).emit('scheduledMessageSent', {
          id: scheduledMessage._id,
        });
      }

      logger.info('Zamanlanmış mesaj gönderildi', {
        messageId: scheduledMessage._id,
      });
    } catch (err) {
      logger.error('Zamanlanmış mesaj gönderme hatası', {
        error: (err as Error).message,
        messageId: scheduledMessage._id,
      });
    }
  }
}

/**
 * Kullanıcı adına göre socket bul
 * @param io - Socket.IO nesnesi
 * @param username - Kullanıcı adı
 * @returns Socket nesnesi veya undefined
 */
function findSocketByUsername(io: SocketIOServer, username: string): Socket | undefined {
  let foundSocket: Socket | undefined;

  io.sockets.sockets.forEach((socket: Socket) => {
    if ((socket as any).username === username) {
      foundSocket = socket;
    }
  });

  return foundSocket;
}

/**
 * Zamanlanmış kanal mesajını gönder
 * @param scheduledMessage - Zamanlanmış mesaj dokümanı
 * @param io - Socket.IO nesnesi
 * @param richTextFormatter - Zengin metin biçimlendirici modülü
 */
async function sendScheduledChannelMessage(
  scheduledMessage: ScheduledMessageDocument,
  io: SocketIOServer,
  richTextFormatter: RichTextFormatter
): Promise<void> {
  // Mesaj içeriğini biçimlendir
  const formattedContent = richTextFormatter.processText(scheduledMessage.content);

  // Yeni mesaj oluştur
  const newMessage = await MessageHelper.create({
    channel: (scheduledMessage.channel as any)._id,
    sender: scheduledMessage.sender,
    content: formattedContent,
    timestamp: new Date(),
  });

  // newMessage.save() artık gerekli değil, MessageHelper.create() zaten kaydediyor

  // Mesajı kanala gönder
  io.to((scheduledMessage.channel as any).channelId).emit('newTextMessage', {
    channelId: (scheduledMessage.channel as any).channelId,
    message: {
      _id: newMessage._id,
      content: newMessage.content,
      username: (scheduledMessage.sender as any).username,
      timestamp: newMessage.timestamp,
      isScheduled: true,
    },
  });

  logger.debug('Zamanlanmış kanal mesajı gönderildi', {
    messageId: newMessage._id,
    channelId: (scheduledMessage.channel as any).channelId,
  });
}

/**
 * Kullanıcının zamanlanmış mesajlarını getir
 * @param userId - Kullanıcı ID'si
 * @returns Zamanlanmış mesajlar dizisi
 */
export async function getUserScheduledMessages(
  userId: string
): Promise<ScheduledMessageDocument[]> {
  try {
    const messages = await ScheduledMessageHelper.find(
      {
        sender: userId,
        sent: false,
      },
      null,
      {
        sort: { scheduledTime: 1 },
        populate: [
          { path: 'channel', select: 'name' },
          { path: 'group', select: 'name' },
        ],
      }
    );

    logger.info('Kullanıcının zamanlanmış mesajları getirildi', {
      userId,
      count: messages.length,
    });

    return messages;
  } catch (error) {
    logger.error('Zamanlanmış mesajları getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Zamanlanmış mesajı iptal et
 * @param messageId - Zamanlanmış mesaj ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function cancelScheduledMessage(
  messageId: string,
  userId: string
): Promise<ScheduledMessageResult> {
  try {
    const scheduledMessage = await ScheduledMessageHelper.findById(messageId);

    if (!scheduledMessage) {
      throw new NotFoundError('Zamanlanmış mesaj bulunamadı');
    }

    if (scheduledMessage.sender.toString() !== userId.toString()) {
      throw new ForbiddenError('Sadece kendi zamanlanmış mesajlarınızı iptal edebilirsiniz');
    }

    if (scheduledMessage.sent) {
      throw new ValidationError('Bu mesaj zaten gönderilmiş');
    }

    await scheduledMessage.deleteOne();

    logger.info('Zamanlanmış mesaj iptal edildi', { messageId, userId });

    return {
      success: true,
      messageId: messageId.toString(),
    };
  } catch (error) {
    logger.error('Zamanlanmış mesaj iptal hatası', {
      error: (error as Error).message,
      messageId,
      userId,
    });
    throw error;
  }
}

/**
 * Yeni zamanlanmış mesaj oluştur
 * @param userId - Kullanıcı ID'si
 * @param content - Mesaj içeriği
 * @param scheduledTime - Zamanlanmış zaman
 * @param type - Mesaj tipi ('channel' veya 'dm')
 * @param channelId - Kanal ID'si (kanal mesajı için)
 * @param receiverId - Alıcı ID'si (DM için)
 * @returns Oluşturulan zamanlanmış mesaj
 */
export async function createScheduledMessage(
  userId: string,
  content: string,
  scheduledTime: Date,
  channelId: string,
  groupId?: string
): Promise<ScheduledMessageDocument> {
  try {
    // Parametreleri doğrula
    if (!content || !scheduledTime) {
      throw new ValidationError('Mesaj içeriği ve zamanlanmış zaman gereklidir');
    }

    if (scheduledTime < new Date()) {
      throw new ValidationError('Zamanlanmış zaman geçmiş olamaz');
    }

    if (!channelId) {
      throw new ValidationError('Kanal ID\'si gereklidir');
    }

    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kanalı kontrol et
    const channel = await ChannelHelper.findOne({ channelId });
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Grup ID'si varsa grubu kontrol et
    let group;
    if (groupId) {
      group = await GroupHelper.findById(groupId);
      if (!group) {
        throw new NotFoundError('Grup bulunamadı');
      }
    }

    // Zamanlanmış mesaj oluştur
    const scheduledMessage = await ScheduledMessageHelper.create({
      sender: userId,
      content,
      scheduledTime,
      channel: channel._id,
      group: groupId ? group?._id : undefined,
      sent: false,
      createdAt: new Date(),
    });

    logger.info('Zamanlanmış mesaj oluşturuldu', {
      messageId: scheduledMessage._id,
      userId,
      channelId,
      groupId,
      scheduledTime,
    });

    return scheduledMessage;
  } catch (error) {
    logger.error('Zamanlanmış mesaj oluşturma hatası', {
      error: (error as Error).message,
      userId,
      channelId,
      groupId,
    });
    throw error;
  }
}

export default {
  initScheduledMessageManager,
  stopScheduledMessageManager,
  getUserScheduledMessages,
  cancelScheduledMessage,
  createScheduledMessage,
};
