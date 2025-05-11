/**
 * src/models/DmMessage.ts
 * Direkt mesaj modeli (alternatif)
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Direkt mesaj arayüzü
export interface IDmMessage {
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  content: string;
  timestamp: Date;
  isEdited: boolean;
  editedAt?: Date;
  originalContent?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  attachments?: mongoose.Types.ObjectId[];
  reactions?: Map<string, mongoose.Types.ObjectId[]>;
  quotedMessage?: mongoose.Types.ObjectId;
}

// Direkt mesaj dokümanı arayüzü
export type DmMessageDocument = TypedDocument<IDmMessage>;

// Direkt mesaj modeli arayüzü
export type DmMessageModel = FullModelType<IDmMessage>;

// Direkt mesaj şeması
const DMMessageSchema = new Schema<DmMessageDocument, DmMessageModel>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    // Fields for edited messages
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    originalContent: { type: String },
    // Field for deleted messages
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    // References to file attachments
    attachments: [{ type: Schema.Types.ObjectId, ref: 'FileAttachment' }],
    // Message reactions
    reactions: {
      type: Map,
      of: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      default: new Map(),
    },
    // Reference to the message this message is quoting
    quotedMessage: { type: Schema.Types.ObjectId, ref: 'DMMessage' },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// İndeksler
DMMessageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
DMMessageSchema.index({ sender: 1, timestamp: -1 });
DMMessageSchema.index({ receiver: 1, timestamp: -1 });
DMMessageSchema.index({ isDeleted: 1 });
DMMessageSchema.index({ content: 'text' });
DMMessageSchema.index({ quotedMessage: 1 });

// Direkt mesaj modelini oluştur
let DmMessage: DmMessageModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  DmMessage = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
  } as unknown as DmMessageModel;
} else {
  // Gerçek model
  DmMessage =
    (mongoose.models['DMMessage'] as DmMessageModel) ||
    mongoose.model<DmMessageDocument, DmMessageModel>('DMMessage', DMMessageSchema);
}

export default DmMessage;
