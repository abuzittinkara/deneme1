/**
 * src/models/Webhook.ts
 * Webhook modeli
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import crypto from 'crypto';
import { CommonModelStaticMethods } from '../types/mongoose-types';

// Webhook olayları
export enum WebhookEvent {
  MESSAGE_CREATED = 'message.created',
  MESSAGE_UPDATED = 'message.updated',
  MESSAGE_DELETED = 'message.deleted',
  USER_JOINED = 'user.joined',
  USER_LEFT = 'user.left',
  USER_UPDATED = 'user.updated',
  CHANNEL_CREATED = 'channel.created',
  CHANNEL_UPDATED = 'channel.updated',
  CHANNEL_DELETED = 'channel.deleted',
  GROUP_CREATED = 'group.created',
  GROUP_UPDATED = 'group.updated',
  GROUP_DELETED = 'group.deleted'
}

// Webhook arayüzü
export interface IWebhook {
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  group?: mongoose.Types.ObjectId;
  channel?: mongoose.Types.ObjectId;
  creator: mongoose.Types.ObjectId;
  isActive: boolean;
  lastTriggeredAt?: Date;
  failureCount: number;
  lastFailureAt?: Date;
  lastFailureReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Webhook dokümanı arayüzü
export interface WebhookDocument extends Document, IWebhook {
  createdAt: Date;
  updatedAt: Date;
  generateSignature(payload: string): string;
}

// Webhook modeli arayüzü
// Mongoose Model tipini genişleten özel model tipi
export interface WebhookModel extends CommonModelStaticMethods<WebhookDocument> {
  // Özel statik metodlar
  findByEvent(event: WebhookEvent, groupId?: mongoose.Types.ObjectId, channelId?: mongoose.Types.ObjectId): Promise<WebhookDocument[]>;
  findByGroup(groupId: mongoose.Types.ObjectId): Promise<WebhookDocument[]>;
  findByChannel(channelId: mongoose.Types.ObjectId): Promise<WebhookDocument[]>;
  generateSecret(): string;
}

// Webhook şeması
const WebhookSchema = new Schema<WebhookDocument, WebhookModel>(
  {
    // Webhook adı
    name: {
      type: String,
      required: true
    },
    // Webhook URL'si
    url: {
      type: String,
      required: true
    },
    // Webhook gizli anahtarı
    secret: {
      type: String,
      required: true
    },
    // Webhook olayları
    events: [{
      type: String,
      enum: Object.values(WebhookEvent),
      required: true
    }],
    // Webhook'un ait olduğu grup (isteğe bağlı)
    group: {
      type: Schema.Types.ObjectId,
      ref: 'Group'
    },
    // Webhook'un ait olduğu kanal (isteğe bağlı)
    channel: {
      type: Schema.Types.ObjectId,
      ref: 'Channel'
    },
    // Webhook'u oluşturan kullanıcı
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Webhook aktif mi?
    isActive: {
      type: Boolean,
      default: true
    },
    // Son tetiklenme zamanı
    lastTriggeredAt: {
      type: Date
    },
    // Başarısız tetiklenme sayısı
    failureCount: {
      type: Number,
      default: 0
    },
    // Son başarısız tetiklenme zamanı
    lastFailureAt: {
      type: Date
    },
    // Son başarısız tetiklenme nedeni
    lastFailureReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

// İndeksler
WebhookSchema.index({ events: 1 });
WebhookSchema.index({ group: 1 });
WebhookSchema.index({ channel: 1 });
WebhookSchema.index({ creator: 1 });
WebhookSchema.index({ isActive: 1 });
WebhookSchema.index({ failureCount: 1 });

// Metotlar
WebhookSchema.methods.generateSignature = function(payload: string): string {
  return crypto
    .createHmac('sha256', this.secret)
    .update(payload)
    .digest('hex');
};

// Statik metodlar
WebhookSchema.statics.findByEvent = function(
  event: WebhookEvent,
  groupId?: mongoose.Types.ObjectId,
  channelId?: mongoose.Types.ObjectId
): Promise<WebhookDocument[]> {
  const query: any = {
    events: event,
    isActive: true
  };

  if (groupId) {
    query.group = groupId;
  }

  if (channelId) {
    query.channel = channelId;
  }

  return (this.find(query) as any).exec();
};

WebhookSchema.statics.findByGroup = function(
  groupId: mongoose.Types.ObjectId
): Promise<WebhookDocument[]> {
  return (this.find({
    group: groupId,
    isActive: true
  }) as any).exec();
};

WebhookSchema.statics.findByChannel = function(
  channelId: mongoose.Types.ObjectId
): Promise<WebhookDocument[]> {
  return (this.find({
    channel: channelId,
    isActive: true
  }) as any).exec();
};

WebhookSchema.statics.generateSecret = function(): string {
  return crypto.randomBytes(32).toString('hex');
};

// Webhook modelini oluştur
let Webhook: WebhookModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Webhook = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByEvent: () => Promise.resolve([]),
    findByGroup: () => Promise.resolve([]),
    findByChannel: () => Promise.resolve([]),
    generateSecret: () => 'mock-secret-key',
  } as unknown as WebhookModel;
} else {
  // Gerçek model
  Webhook = (mongoose.models.Webhook as WebhookModel) ||
    mongoose.model<WebhookDocument, WebhookModel>('Webhook', WebhookSchema);
}

export default Webhook;
