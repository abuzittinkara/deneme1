/**
 * src/models/Notification.ts
 * Bildirim modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import { NotificationType } from '../types/enums';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Bildirim hedefi arayüzü
export interface NotificationTarget {
  type: 'message' | 'directMessage' | 'user' | 'group' | 'channel';
  id: mongoose.Types.ObjectId;
}

// Bildirim arayüzü
export interface INotification {
  recipient: mongoose.Types.ObjectId;
  sender?: mongoose.Types.ObjectId;
  type: NotificationType;
  content: string;
  target?: NotificationTarget;
  isRead: boolean;
  readAt?: Date;
  createdAt?: Date;
  expiresAt?: Date;
  priority: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

// Bildirim dokümanı arayüzü
export interface NotificationDocument extends TypedDocument<INotification> {
  createdAt: Date;
}

// Bildirim modeli arayüzü
export interface NotificationModel extends FullModelType<INotification> {
  // Özel statik metodlar
  findUnreadByUser(userId: mongoose.Types.ObjectId): Promise<NotificationDocument[]>;
  markAsRead(notificationId: mongoose.Types.ObjectId): Promise<void>;
  markAllAsRead(userId: mongoose.Types.ObjectId): Promise<void>;
  deleteExpired(): Promise<void>;
}

// Bildirim hedefi şeması
const NotificationTargetSchema = new Schema({
  type: {
    type: String,
    enum: ['message', 'directMessage', 'user', 'group', 'channel'],
    required: true
  },
  id: { type: Schema.Types.ObjectId, required: true }
}, { _id: false });

// Bildirim şeması
const NotificationSchema = new Schema<NotificationDocument, NotificationModel>(
  {
    // Bildirimin alıcısı
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Bildirimin göndereni (isteğe bağlı)
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    // Bildirim türü
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true
    },
    // Bildirim içeriği
    content: {
      type: String,
      required: true
    },
    // Bildirim hedefi (isteğe bağlı)
    target: NotificationTargetSchema,
    // Okundu bilgisi
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    readAt: {
      type: Date
    },
    // Bildirim son kullanma tarihi (isteğe bağlı)
    expiresAt: {
      type: Date
    },
    // Bildirim önceliği
    priority: {
      type: String,
      enum: ['low', 'normal', 'high'],
      default: 'normal'
    },
    // Ek bilgiler
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// İndeksler
// Şema tanımında index: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
NotificationSchema.index({ recipient: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, type: 1 });
NotificationSchema.index({ 'target.type': 1, 'target.id': 1 });
// TTL indeksi - süresi dolmuş bildirimleri otomatik sil
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Statik metodlar
NotificationSchema.statics.findUnreadByUser = function(
  userId: mongoose.Types.ObjectId
): Promise<NotificationDocument[]> {
  return this.find({
    recipient: userId,
    isRead: false,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ createdAt: -1 })
    .populate('sender', 'username profilePicture') as unknown as Promise<NotificationDocument[]>;
};

NotificationSchema.statics.markAsRead = async function(
  notificationId: mongoose.Types.ObjectId
): Promise<void> {
  await this.updateOne(
    { _id: notificationId, isRead: false },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

NotificationSchema.statics.markAllAsRead = async function(
  userId: mongoose.Types.ObjectId
): Promise<void> {
  await this.updateMany(
    { recipient: userId, isRead: false },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

NotificationSchema.statics.deleteExpired = async function(): Promise<void> {
  await this.deleteMany({
    expiresAt: { $lt: new Date() }
  });
};

// Bildirim modelini oluştur
let Notification: NotificationModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Notification = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByUser: () => Promise.resolve([]),
    findByType: () => Promise.resolve([]),
    markAsRead: () => Promise.resolve({}),
    markAllAsRead: () => Promise.resolve({ modifiedCount: 0 }),
  } as unknown as NotificationModel;
} else {
  // Gerçek model
  Notification = (mongoose.models.Notification as NotificationModel) ||
    mongoose.model<NotificationDocument, NotificationModel>('Notification', NotificationSchema);
}

export default Notification;
