/**
 * src/models/Message.ts
 * Mesaj modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Düzenleme geçmişi arayüzü
export interface EditHistory {
  content: string;
  editedAt: Date;
  editedBy: mongoose.Types.ObjectId;
}

// Okundu bilgisi arayüzü
export interface ReadReceipt {
  user: mongoose.Types.ObjectId;
  readAt: Date;
}

// Mesaj arayüzü
export interface IMessage {
  channel: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  content: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt?: Date;
  originalContent?: string;
  editHistory?: EditHistory[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  attachments?: mongoose.Types.ObjectId[];
  reactions?: { [emoji: string]: Array<{ userId: string; username: string; timestamp: Date }> };
  isPinned: boolean;
  pinnedAt?: Date;
  pinnedBy?: mongoose.Types.ObjectId;
  quotedMessage?: mongoose.Types.ObjectId;
  readReceipts?: ReadReceipt[];
  mentions?: mongoose.Types.ObjectId[];
  isSystemMessage: boolean;
  sender?: mongoose.Types.ObjectId;
  senderUsername?: string;
  parentMessage?: mongoose.Types.ObjectId;
  isReply?: boolean;
  group?: mongoose.Types.ObjectId;
}

// Mesaj dokümanı arayüzü
export interface MessageDocument extends TypedDocument<IMessage> {}

// Mesaj modeli arayüzü
export interface MessageModel extends FullModelType<IMessage> {
  // Özel statik metodlar buraya eklenebilir
  findRecentByChannel(channelId: mongoose.Types.ObjectId, limit?: number): Promise<MessageDocument[]>;
  findPinnedByChannel(channelId: mongoose.Types.ObjectId): Promise<MessageDocument[]>;
  findByUser(userId: mongoose.Types.ObjectId, limit?: number): Promise<MessageDocument[]>;
  findMentioningUser(userId: mongoose.Types.ObjectId, limit?: number): Promise<MessageDocument[]>;
  findUnreadByUser(userId: mongoose.Types.ObjectId, channelId?: mongoose.Types.ObjectId): Promise<MessageDocument[]>;
  markAsRead(messageId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<void>;
}

// Düzenleme geçmişi şeması
const EditHistorySchema = new Schema({
  content: { type: String, required: true },
  editedAt: { type: Date, default: Date.now },
  editedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

// Okundu bilgisi şeması
const ReadReceiptSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  readAt: { type: Date, default: Date.now }
}, { _id: false });

// Mesaj şeması
const messageSchema = new Schema<MessageDocument, MessageModel>(
  {
    channel: { type: Schema.Types.ObjectId, ref: 'Channel', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    // Fields for edited messages
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    originalContent: { type: String },
    editHistory: [EditHistorySchema],
    // Field for deleted messages
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // References to file attachments
    attachments: [{ type: Schema.Types.ObjectId, ref: 'FileAttachment' }],
    // Message reactions
    reactions: {
      type: Map,
      of: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: new Map()
    },
    // Is this message pinned?
    isPinned: { type: Boolean, default: false },
    pinnedAt: { type: Date },
    pinnedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    // Reference to the message this message is quoting
    quotedMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    // Read receipts
    readReceipts: [ReadReceiptSchema],
    // User mentions
    mentions: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Is this a system message?
    isSystemMessage: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

// İndeksler
// Şema tanımında index: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
messageSchema.index({ channel: 1, timestamp: -1 });
messageSchema.index({ user: 1, timestamp: -1 });
messageSchema.index({ content: 'text' });
messageSchema.index({ quotedMessage: 1 });
messageSchema.index({ 'mentions': 1 });
messageSchema.index({ 'readReceipts.user': 1 });
// TTL indeksi - silinen mesajları 30 gün sonra otomatik sil
messageSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 gün sonra otomatik sil
    partialFilterExpression: { isDeleted: true }
  }
);

// Statik metodlar
messageSchema.statics.findRecentByChannel = function(
  channelId: mongoose.Types.ObjectId,
  limit = 50
): Promise<MessageDocument[]> {
  return this.find({ channel: channelId, isDeleted: false })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'username profilePicture') as unknown as Promise<MessageDocument[]>;
};

messageSchema.statics.findPinnedByChannel = function(
  channelId: mongoose.Types.ObjectId
): Promise<MessageDocument[]> {
  return this.find({ channel: channelId, isPinned: true, isDeleted: false })
    .sort({ pinnedAt: -1 })
    .populate('user', 'username profilePicture')
    .populate('pinnedBy', 'username') as unknown as Promise<MessageDocument[]>;
};

messageSchema.statics.findByUser = function(
  userId: mongoose.Types.ObjectId,
  limit = 50
): Promise<MessageDocument[]> {
  return this.find({ user: userId, isDeleted: false })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('channel', 'name') as unknown as Promise<MessageDocument[]>;
};

messageSchema.statics.findMentioningUser = function(
  userId: mongoose.Types.ObjectId,
  limit = 50
): Promise<MessageDocument[]> {
  return this.find({ mentions: userId, isDeleted: false })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'username profilePicture')
    .populate('channel', 'name') as unknown as Promise<MessageDocument[]>;
};

messageSchema.statics.findUnreadByUser = function(
  userId: mongoose.Types.ObjectId,
  channelId?: mongoose.Types.ObjectId
): Promise<MessageDocument[]> {
  const query: any = {
    isDeleted: false,
    'readReceipts.user': { $ne: userId }
  };

  if (channelId) {
    query.channel = channelId;
  }

  return this.find(query)
    .sort({ timestamp: -1 })
    .populate('user', 'username profilePicture')
    .populate('channel', 'name') as unknown as Promise<MessageDocument[]>;
};

messageSchema.statics.markAsRead = async function(
  messageId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  await this.updateOne(
    {
      _id: messageId,
      'readReceipts.user': { $ne: userId }
    },
    {
      $push: {
        readReceipts: {
          user: userId,
          readAt: new Date()
        }
      }
    }
  );
};

// Mesaj modelini oluştur
let MessageModel_: MessageModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  MessageModel_ = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findRecentByChannel: () => Promise.resolve([]),
    findPinnedByChannel: () => Promise.resolve([]),
    findByUser: () => Promise.resolve([]),
    findMentioningUser: () => Promise.resolve([]),
    findUnreadByUser: () => Promise.resolve([]),
    markAsRead: () => Promise.resolve(),
  } as unknown as MessageModel;
} else {
  // Gerçek model
  MessageModel_ = (mongoose.models.Message as MessageModel) ||
    mongoose.model<MessageDocument, MessageModel>('Message', messageSchema);
}

// Hem default export hem de named export sağla
export const Message = MessageModel_;
export default MessageModel_;
