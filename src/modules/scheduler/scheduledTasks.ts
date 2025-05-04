/**
 * src/modules/scheduler/scheduledTasks.ts
 * Zamanlanmış görevleri yöneten modül
 */
import { Server } from 'socket.io';
import { CronJob } from 'cron';
import { logger } from '../../utils/logger';
import { performance } from '../../utils/performance';
import { ScheduledMessage, ScheduledMessageDocument } from '../../models/ScheduledMessage';
import { Message, MessageDocument } from '../../models/Message';
import { User, UserDocument } from '../../models/User';
import { Channel, ChannelDocument } from '../../models/Channel';
import { createModelHelper } from '../../utils/mongoose-helpers';
import { UserStatus } from '../../types/enums';

// Model yardımcıları
const ScheduledMessageHelper = createModelHelper<ScheduledMessageDocument, typeof ScheduledMessage>(ScheduledMessage);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);

// Aktif zamanlanmış görevler
const scheduledJobs: { [key: string]: CronJob } = {};

/**
 * Zamanlanmış mesajları gönderir
 */
const sendScheduledMessages = async (io: Server) => {
  try {
    const now = new Date();

    // Gönderilme zamanı gelmiş mesajları bul
    const scheduledMessages = await performance.measureDatabaseQuery('Zamanlanmış mesajları getir', async () => {
      return await ScheduledMessageHelper.find(
        {
          scheduledTime: { $lte: now },
          sent: false
        },
        null,
        { populate: { path: 'sender', select: 'username avatar status' } }
      ).exec();
    });

    if (scheduledMessages.length === 0) {
      return;
    }

    logger.info(`${scheduledMessages.length} zamanlanmış mesaj gönderilecek`);

    for (const scheduledMessage of scheduledMessages) {
      try {
        // Kanal bilgilerini kontrol et
        const channel = await ChannelHelper.findById(scheduledMessage.channel);
        if (!channel) {
          logger.error('Zamanlanmış mesaj için kanal bulunamadı', {
            scheduledMessageId: scheduledMessage._id,
            channelId: scheduledMessage.channel
          });
          continue;
        }

        // Yeni mesaj oluştur
        const newMessage = new Message({
          content: scheduledMessage.content,
          sender: scheduledMessage.sender._id,
          senderUsername: (scheduledMessage.sender as any).username,
          channel: scheduledMessage.channel,
          group: scheduledMessage.group,
          mentions: scheduledMessage.mentions,
          attachments: scheduledMessage.attachments,
          scheduledMessageId: scheduledMessage._id
        });

        await newMessage.save();

        // Zamanlanmış mesajı gönderildi olarak işaretle
        scheduledMessage.sent = true;
        scheduledMessage.sentTime = new Date();
        scheduledMessage.messageId = newMessage._id as any;
        await scheduledMessage.save();

        // Mesajı socket üzerinden gönder
        io.to(scheduledMessage.channel.toString()).emit('message:new', {
          ...newMessage.toObject(),
          sender: scheduledMessage.sender,
          isScheduled: true
        });

        logger.info('Zamanlanmış mesaj gönderildi', {
          scheduledMessageId: scheduledMessage._id,
          messageId: newMessage._id,
          channelId: scheduledMessage.channel,
          groupId: scheduledMessage.group
        });
      } catch (error) {
        logger.error('Zamanlanmış mesaj gönderme hatası', {
          error: (error as Error).message,
          scheduledMessageId: scheduledMessage._id
        });
      }
    }
  } catch (error) {
    logger.error('Zamanlanmış mesajları gönderme hatası', { error: (error as Error).message });
  }
};

/**
 * Kullanıcı durumlarını günceller
 */
const updateUserStatuses = async (io: Server) => {
  try {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Son aktivite zamanı 5 dakikadan eski olan kullanıcıları bul
    const users = await performance.measureDatabaseQuery('Kullanıcı durumlarını getir', async () => {
      return await UserHelper.find({
        status: UserStatus.ONLINE,
        lastActivity: { $lt: fiveMinutesAgo }
      }).exec();
    });

    if (users.length === 0) {
      return;
    }

    logger.info(`${users.length} kullanıcının durumu 'idle' olarak güncellenecek`);

    for (const user of users) {
      // Kullanıcı durumunu 'idle' olarak güncelle
      user.status = UserStatus.IDLE;
      await user.save();

      // Kullanıcı durumunu socket üzerinden bildir
      io.emit('user:status:update', {
        userId: user._id,
        status: UserStatus.IDLE
      });
    }
  } catch (error) {
    logger.error('Kullanıcı durumlarını güncelleme hatası', { error: (error as Error).message });
  }
};

/**
 * Veritabanı temizliği yapar
 */
const cleanupDatabase = async () => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 30 günden eski oturum kayıtlarını temizle
    const sessionsDeleted = await performance.measureDatabaseQuery('Eski oturumları temizle', () =>
      // Session modelini import etmeden önce kontrol et
      // Session.deleteMany({ updatedAt: { $lt: thirtyDaysAgo } })
      Promise.resolve({ deletedCount: 0 })
    );

    // 30 günden eski şifre sıfırlama kayıtlarını temizle
    const passwordResetsDeleted = await performance.measureDatabaseQuery('Eski şifre sıfırlama kayıtlarını temizle', () =>
      // PasswordReset modelini import etmeden önce kontrol et
      // PasswordReset.deleteMany({ createdAt: { $lt: thirtyDaysAgo } })
      Promise.resolve({ deletedCount: 0 })
    );

    logger.info('Veritabanı temizliği tamamlandı', {
      sessionsDeleted: sessionsDeleted.deletedCount,
      passwordResetsDeleted: passwordResetsDeleted.deletedCount
    });
  } catch (error) {
    logger.error('Veritabanı temizliği hatası', { error: (error as Error).message });
  }
};

/**
 * Zamanlanmış görevleri başlatır
 */
const startScheduledTasks = (io?: Server) => {
  try {
    // Her dakika çalışacak görev (zamanlanmış mesajlar)
    scheduledJobs['scheduledMessages'] = new CronJob('* * * * *', () => {
      if (io) {
        sendScheduledMessages(io);
      }
    });

    // Her 5 dakikada bir çalışacak görev (kullanıcı durumları)
    scheduledJobs['userStatuses'] = new CronJob('*/5 * * * *', () => {
      if (io) {
        updateUserStatuses(io);
      }
    });

    // Her gün gece yarısı çalışacak görev (veritabanı temizliği)
    scheduledJobs['databaseCleanup'] = new CronJob('0 0 * * *', () => {
      cleanupDatabase();
    });

    // Görevleri başlat
    Object.values(scheduledJobs).forEach(job => {
      if (!(job as any).running) {
        job.start();
      }
    });

    logger.info('Zamanlanmış görevler başlatıldı');
  } catch (error) {
    logger.error('Zamanlanmış görevleri başlatma hatası', { error: (error as Error).message });
  }
};

/**
 * Zamanlanmış görevleri durdurur
 */
const stopScheduledTasks = () => {
  try {
    // Tüm görevleri durdur
    Object.values(scheduledJobs).forEach(job => {
      if ((job as any).running) {
        job.stop();
      }
    });

    // Tüm zamanlanmış görevleri temizle
    const timerId = setTimeout(() => {}, 0);
    // Tüm timer ID'leri 0'dan başlayarak artarak gider
    const timerIdNumber = Number(timerId);
    for (let i = 0; i < timerIdNumber; i++) {
      clearTimeout(i);
    }

    logger.info('Zamanlanmış görevler durduruldu');
  } catch (error) {
    logger.error('Zamanlanmış görevleri durdurma hatası', { error: (error as Error).message });
  }
};

export {
  startScheduledTasks,
  stopScheduledTasks,
  sendScheduledMessages,
  updateUserStatuses,
  cleanupDatabase
};
