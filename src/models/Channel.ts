/**
 * src/models/Channel.ts
 * Kanal modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Kanal tipi
export type ChannelType = 'text' | 'voice';

// Kanal arayüzü
export interface IChannel {
  channelId: string;
  name: string;
  group: mongoose.Types.ObjectId;
  type: ChannelType;
  users?: mongoose.Types.ObjectId[];
  category?: mongoose.Types.ObjectId;
  description?: string;
  position: number;
  isArchived: boolean;
  isPrivate: boolean;
  allowedUsers?: mongoose.Types.ObjectId[];
  archivedAt?: Date;
  archivedBy?: mongoose.Types.ObjectId;
  createdBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

// Kanal dokümanı arayüzü
export interface ChannelDocument extends TypedDocument<IChannel> {
  createdAt: Date;
  updatedAt: Date;
}

// Kanal modeli arayüzü
export interface ChannelModel extends FullModelType<IChannel> {
  findByNameAndGroup(name: string, groupId: mongoose.Types.ObjectId): Promise<ChannelDocument | null>;
}

// Kanal şeması
const ChannelSchema = new Schema<ChannelDocument, ChannelModel>(
  {
    channelId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    type: { type: String, enum: ['text', 'voice'], required: true },
    // Kanaldaki kullanıcılar (isteğe bağlı)
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    // Kanalın kategorisi
    category: { type: Schema.Types.ObjectId, ref: 'Category' },
    // Kanal açıklaması
    description: { type: String, default: '' },
    // Kanalın pozisyonu
    position: { type: Number, default: 0 },
    // Arşivlenmiş mi?
    isArchived: { type: Boolean, default: false },
    // Özel kanal mı?
    isPrivate: { type: Boolean, default: false },
    // İzin verilen kullanıcılar (özel kanal için)
    allowedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    archivedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Statik metodlar
ChannelSchema.statics.findByNameAndGroup = function(
  name: string,
  groupId: mongoose.Types.ObjectId
): Promise<ChannelDocument | null> {
  return this.findOne({ name, group: groupId }) as unknown as Promise<ChannelDocument | null>;
};

// Kanal modeli
let ChannelModel_: ChannelModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  ChannelModel_ = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByNameAndGroup: () => Promise.resolve(null),
  } as unknown as ChannelModel;
} else {
  // Gerçek model
  ChannelModel_ = (mongoose.models.Channel as ChannelModel) ||
    mongoose.model<ChannelDocument, ChannelModel>('Channel', ChannelSchema);
}

// Hem default export hem de named export sağla
export const Channel = ChannelModel_;
export default ChannelModel_;
