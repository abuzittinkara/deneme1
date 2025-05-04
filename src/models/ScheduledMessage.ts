/**
 * src/models/ScheduledMessage.ts
 * Zamanlanmış mesaj modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Zamanlanmış mesaj tipi
export type ScheduledMessageType = 'channel' | 'dm';

// Zamanlanmış mesaj arayüzü
export interface IScheduledMessage {
  sender: mongoose.Types.ObjectId;
  channel: mongoose.Types.ObjectId;
  group?: mongoose.Types.ObjectId;
  content: string;
  scheduledTime: Date;
  mentions?: mongoose.Types.ObjectId[];
  attachments?: mongoose.Types.ObjectId[];
  sent: boolean;
  sentTime?: Date;
  messageId?: mongoose.Types.ObjectId;
  createdAt: Date;
}

// Zamanlanmış mesaj dokümanı arayüzü
export interface ScheduledMessageDocument extends TypedDocument<IScheduledMessage> {}

// Zamanlanmış mesaj modeli arayüzü
export interface ScheduledMessageModel extends FullModelType<IScheduledMessage> {
  // Özel statik metodlar buraya eklenebilir
  findPendingMessages(currentTime: Date): Promise<ScheduledMessageDocument[]>;
}

// Zamanlanmış mesaj şeması
const ScheduledMessageSchema = new Schema<ScheduledMessageDocument, ScheduledMessageModel>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    channel: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group' },
    content: { type: String, required: true },
    scheduledTime: { type: Date, required: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    attachments: [{ type: Schema.Types.ObjectId, ref: 'FileAttachment' }],
    sent: { type: Boolean, default: false },
    sentTime: { type: Date },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    createdAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// İndeksler
// Şema tanımında index: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
ScheduledMessageSchema.index({ scheduledTime: 1, sent: 1 });
ScheduledMessageSchema.index({ sender: 1, scheduledTime: 1 });
ScheduledMessageSchema.index({ channel: 1, scheduledTime: 1 });

// Statik metodlar
ScheduledMessageSchema.statics.findPendingMessages = function(
  currentTime: Date
): Promise<ScheduledMessageDocument[]> {
  return this.find({
    scheduledTime: { $lte: currentTime },
    sent: false
  })
    .populate('sender', 'username avatar status')
    .populate('channel', 'name')
    .populate('group', 'name') as unknown as Promise<ScheduledMessageDocument[]>;
};

// Zamanlanmış mesaj modelini oluştur
let ScheduledMessage: ScheduledMessageModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  ScheduledMessage = {
    modelName: 'ScheduledMessage',
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findPendingMessages: (currentTime: Date) => Promise.resolve([]),
    findDueMessages: () => Promise.resolve([]),
    findBySender: () => Promise.resolve([]),
  } as unknown as ScheduledMessageModel;
} else {
  // Gerçek model
  ScheduledMessage = (mongoose.models.ScheduledMessage as ScheduledMessageModel) ||
    mongoose.model<ScheduledMessageDocument, ScheduledMessageModel>('ScheduledMessage', ScheduledMessageSchema);
}

export default ScheduledMessage;
