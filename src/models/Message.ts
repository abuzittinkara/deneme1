/**
 * src/models/Message.ts
 * Mesaj modeli
 */
import mongoose, { Document, Schema, Model, Query } from 'mongoose';
import { TypedDocument } from '../types/mongoose-types';
import { FullModelType } from '../types/mongoose-model';

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
export type MessageDocument = TypedDocument<IMessage>;

// Mesaj modeli statik metodları
export interface MessageStaticMethods {
  findRecentByChannel(
    channelId: mongoose.Types.ObjectId,
    limit?: number
  ): Query<MessageDocument[], MessageDocument>;
  findPinnedByChannel(
    channelId: mongoose.Types.ObjectId
  ): Query<MessageDocument[], MessageDocument>;
  findByUser(
    userId: mongoose.Types.ObjectId,
    limit?: number
  ): Query<MessageDocument[], MessageDocument>;
  findMentioningUser(
    userId: mongoose.Types.ObjectId,
    limit?: number
  ): Query<MessageDocument[], MessageDocument>;
  findUnreadByUser(
    userId: mongoose.Types.ObjectId,
    channelId?: mongoose.Types.ObjectId
  ): Query<MessageDocument[], MessageDocument>;
  markAsRead(messageId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<void>;
}

// Mesaj modeli arayüzü
export interface MessageModel
  extends FullModelType<MessageDocument, {}, {}, {}, MessageStaticMethods> {
  // Mongoose model metodları
  find(filter?: any, projection?: any, options?: any): Query<MessageDocument[], MessageDocument>;
  findOne(
    filter?: any,
    projection?: any,
    options?: any
  ): Query<MessageDocument | null, MessageDocument>;
  findById(
    id: string | mongoose.Types.ObjectId,
    projection?: any,
    options?: any
  ): Query<MessageDocument | null, MessageDocument>;
  create(doc: Partial<IMessage>): Promise<MessageDocument>;
  updateOne(filter: any, update: any, options?: any): Promise<mongoose.UpdateWriteOpResult>;
  updateMany(filter: any, update: any, options?: any): Promise<mongoose.UpdateWriteOpResult>;
  deleteOne(filter: any, options?: any): Promise<mongoose.DeleteResult>;
  deleteMany(filter: any, options?: any): Promise<mongoose.DeleteResult>;
  countDocuments(filter?: any): Promise<number>;
  findByIdAndUpdate(
    id: string | mongoose.Types.ObjectId,
    update: any,
    options?: any
  ): Query<MessageDocument | null, MessageDocument>;
  findByIdAndDelete(
    id: string | mongoose.Types.ObjectId,
    options?: any
  ): Query<MessageDocument | null, MessageDocument>;
}

// Düzenleme geçmişi şeması
const EditHistorySchema = new Schema(
  {
    content: { type: String, required: true },
    editedAt: { type: Date, default: Date.now },
    editedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

// Okundu bilgisi şeması
const ReadReceiptSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

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
      default: new Map(),
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
    isSystemMessage: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// İndeksler
// Temel indeksler
messageSchema.index({ channel: 1, timestamp: -1 }, { name: 'channel_timestamp' }); // Kanal mesajları için
messageSchema.index({ user: 1, timestamp: -1 }, { name: 'user_timestamp' }); // Kullanıcı mesajları için
messageSchema.index({ mentions: 1, timestamp: -1 }, { name: 'mentions_timestamp' }); // Bahsetmeler için
messageSchema.index({ quotedMessage: 1 }, { name: 'quoted_message' }); // Alıntılanan mesajlar için
messageSchema.index({ 'readReceipts.user': 1 }, { name: 'read_receipts_user' }); // Okunma bilgileri için

// Performans iyileştirmeleri için bileşik indeksler
messageSchema.index(
  { channel: 1, isPinned: 1, timestamp: -1 },
  { name: 'channel_pinned_timestamp' }
); // Sabitlenmiş mesajlar için
messageSchema.index(
  { channel: 1, isDeleted: 1, timestamp: -1 },
  { name: 'channel_deleted_timestamp' }
); // Silinmemiş mesajlar için
messageSchema.index(
  { channel: 1, isSystemMessage: 1, timestamp: -1 },
  { name: 'channel_system_timestamp' }
); // Sistem mesajları için
messageSchema.index({ channel: 1, user: 1, timestamp: -1 }, { name: 'channel_user_timestamp' }); // Kanal içindeki kullanıcı mesajları için

// Metin arama indeksi
messageSchema.index(
  { content: 'text' },
  {
    name: 'content_text',
    weights: { content: 10 },
    default_language: 'turkish',
    language_override: 'language',
  }
);

// TTL indeksi - silinen mesajları 30 gün sonra otomatik sil
messageSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 gün sonra otomatik sil
    partialFilterExpression: { isDeleted: true },
    name: 'ttl_deleted_messages',
  }
);

// Statik metodlar
messageSchema.statics['findRecentByChannel'] = function (
  channelId: mongoose.Types.ObjectId,
  limit = 50,
  lastMessageTimestamp?: Date,
  options: {
    includeDeleted?: boolean;
    includeSystemMessages?: boolean;
    lean?: boolean;
  } = {}
): Query<MessageDocument[], MessageDocument> {
  // Sorgu filtresi oluştur
  const filter: any = { channel: channelId };

  // Silinmiş mesajları dahil etme (varsayılan olarak etme)
  if (!options.includeDeleted) {
    filter.isDeleted = false;
  }

  // Sistem mesajlarını dahil etme (varsayılan olarak et)
  if (options.includeSystemMessages === false) {
    filter.isSystemMessage = false;
  }

  // Belirli bir zamandan sonraki mesajları getir (pagination için)
  if (lastMessageTimestamp) {
    filter.timestamp = { $lt: lastMessageTimestamp };
  }

  // Sorguyu oluştur
  let query = (this as MessageModel).find(filter).sort({ timestamp: -1 }).limit(limit);

  // Sadece gerekli alanları seç (projection)
  query = query.select(
    'content user timestamp isEdited isDeleted isPinned mentions attachments reactions'
  );

  // Kullanıcı bilgilerini populate et
  query = query.populate('user', 'username profilePicture status');

  // Performans için lean kullan (varsayılan olarak kullan)
  if (options.lean !== false) {
    query = query.lean();
  }

  return query;
};

messageSchema.statics['findPinnedByChannel'] = function (
  channelId: mongoose.Types.ObjectId
): Query<MessageDocument[], MessageDocument> {
  return (this as MessageModel)
    .find({ channel: channelId, isPinned: true, isDeleted: false })
    .sort({ pinnedAt: -1 })
    .populate('user', 'username profilePicture')
    .populate('pinnedBy', 'username');
};

messageSchema.statics['findByUser'] = function (
  userId: mongoose.Types.ObjectId,
  limit = 50
): Query<MessageDocument[], MessageDocument> {
  return (this as MessageModel)
    .find({ user: userId, isDeleted: false })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('channel', 'name');
};

messageSchema.statics['findMentioningUser'] = function (
  userId: mongoose.Types.ObjectId,
  limit = 50
): Query<MessageDocument[], MessageDocument> {
  return (this as MessageModel)
    .find({ mentions: userId, isDeleted: false })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'username profilePicture')
    .populate('channel', 'name');
};

messageSchema.statics['findUnreadByUser'] = function (
  userId: mongoose.Types.ObjectId,
  channelId?: mongoose.Types.ObjectId
): Query<MessageDocument[], MessageDocument> {
  const query: any = {
    isDeleted: false,
    'readReceipts.user': { $ne: userId },
  };

  if (channelId) {
    query.channel = channelId;
  }

  return (this as MessageModel)
    .find(query)
    .sort({ timestamp: -1 })
    .populate('user', 'username profilePicture')
    .populate('channel', 'name');
};

messageSchema.statics['markAsRead'] = async function (
  messageId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  await (this as MessageModel).updateOne(
    {
      _id: messageId,
      'readReceipts.user': { $ne: userId },
    },
    {
      $push: {
        readReceipts: {
          user: userId,
          readAt: new Date(),
        },
      },
    }
  );
};

// Mesaj modelini oluştur
let MessageModel_: MessageModel;

// Gerçek model
const existingModel = mongoose.models['Message'] as Model<
  MessageDocument,
  {},
  {},
  {},
  MessageDocument
>;

if (existingModel) {
  MessageModel_ = existingModel as unknown as MessageModel;
} else {
  MessageModel_ = mongoose.model<MessageDocument, MessageModel>('Message', messageSchema);
}

// Hem default export hem de named export sağla
export const Message = MessageModel_;
export default MessageModel_;
