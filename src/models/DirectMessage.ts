/**
 * src/models/DirectMessage.ts
 * Direkt mesaj modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Düzenleme geçmişi arayüzü
export interface DMEditHistory {
  content: string;
  editedAt: Date;
  editedBy: mongoose.Types.ObjectId;
}

// Direkt mesaj arayüzü
export interface IDirectMessage {
  sender: mongoose.Types.ObjectId;
  recipient: mongoose.Types.ObjectId;
  content: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt?: Date;
  originalContent?: string;
  editHistory?: DMEditHistory[];
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: mongoose.Types.ObjectId;
  isRead: boolean;
  readAt?: Date;
  attachments?: mongoose.Types.ObjectId[];
  reactions?: Map<string, mongoose.Types.ObjectId[]>;
  replyTo?: mongoose.Types.ObjectId;
  isSystemMessage?: boolean;
}

// Direkt mesaj dokümanı arayüzü
export interface DirectMessageDocument extends TypedDocument<IDirectMessage> {}

// Direkt mesaj modeli arayüzü
export interface DirectMessageModel extends FullModelType<IDirectMessage> {
  // Özel statik metodlar
  findConversation(user1Id: mongoose.Types.ObjectId, user2Id: mongoose.Types.ObjectId, limit?: number): Promise<DirectMessageDocument[]>;
  findUnreadMessages(userId: mongoose.Types.ObjectId): Promise<DirectMessageDocument[]>;
  markAsRead(messageId: mongoose.Types.ObjectId, userId: mongoose.Types.ObjectId): Promise<void>;
}

// Düzenleme geçmişi şeması
const DMEditHistorySchema = new Schema({
  content: { type: String, required: true },
  editedAt: { type: Date, default: Date.now },
  editedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { _id: false });

// Direkt mesaj şeması
const directMessageSchema = new Schema<DirectMessageDocument, DirectMessageModel>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    originalContent: {
      type: String
    },
    editHistory: [DMEditHistorySchema],
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    isRead: {
      type: Boolean,
      default: false
    },
    readAt: {
      type: Date
    },
    attachments: [{
      type: Schema.Types.ObjectId,
      ref: 'File'
    }],
    reactions: {
      type: Map,
      of: [Schema.Types.ObjectId]
    },
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'DirectMessage'
    },
    isSystemMessage: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

// İndeksler
// Şema tanımında index: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
directMessageSchema.index({ sender: 1, recipient: 1, timestamp: -1 });
directMessageSchema.index({ sender: 1, timestamp: -1 });
directMessageSchema.index({ recipient: 1, timestamp: -1 });
directMessageSchema.index({ content: 'text' });
directMessageSchema.index({ replyTo: 1 });
// TTL indeksi - silinen mesajları 30 gün sonra otomatik sil
directMessageSchema.index(
  { deletedAt: 1 },
  {
    expireAfterSeconds: 30 * 24 * 60 * 60, // 30 gün sonra otomatik sil
    partialFilterExpression: { isDeleted: true }
  }
);

// Statik metodlar
directMessageSchema.statics.findConversation = function(
  user1Id: mongoose.Types.ObjectId,
  user2Id: mongoose.Types.ObjectId,
  limit = 50
): Promise<DirectMessageDocument[]> {
  return this.find({
    $or: [
      { sender: user1Id, recipient: user2Id },
      { sender: user2Id, recipient: user1Id }
    ],
    isDeleted: false
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('sender', 'username profilePicture')
    .populate('recipient', 'username profilePicture') as unknown as Promise<DirectMessageDocument[]>;
};

directMessageSchema.statics.findUnreadMessages = function(
  userId: mongoose.Types.ObjectId
): Promise<DirectMessageDocument[]> {
  return this.find({
    recipient: userId,
    isDeleted: false,
    isRead: false
  })
    .sort({ timestamp: -1 })
    .populate('sender', 'username profilePicture') as unknown as Promise<DirectMessageDocument[]>;
};

directMessageSchema.statics.markAsRead = async function(
  messageId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<void> {
  await this.updateOne(
    {
      _id: messageId,
      recipient: userId,
      isRead: false
    },
    {
      $set: {
        isRead: true,
        readAt: new Date()
      }
    }
  );
};

// Direkt mesaj modelini oluştur
let DirectMessage: DirectMessageModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  DirectMessage = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByConversation: () => Promise.resolve([]),
    findUnreadMessages: () => Promise.resolve([]),
    markAsRead: async () => {},
  } as unknown as DirectMessageModel;
} else {
  // Gerçek model
  DirectMessage = (mongoose.models.DirectMessage as DirectMessageModel) ||
    mongoose.model<DirectMessageDocument, DirectMessageModel>('DirectMessage', directMessageSchema);
}

export default DirectMessage;
