/**
 * src/models/Friendship.ts
 * Arkadaşlık modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { FriendshipStatus } from '../types/common';

// Arkadaşlık arayüzü
export interface IFriendship {
  user1: mongoose.Types.ObjectId;
  user2: mongoose.Types.ObjectId;
  status: FriendshipStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Arkadaşlık dokümanı
export interface FriendshipDocument extends IFriendship, Document {}

// Arkadaşlık şeması
const friendshipSchema = new Schema<FriendshipDocument>(
  {
    user1: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    user2: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(FriendshipStatus),
      default: FriendshipStatus.ACCEPTED,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// İndeksler
friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });
friendshipSchema.index({ user1: 1, status: 1 });
friendshipSchema.index({ user2: 1, status: 1 });

// Model arayüzü
export type FriendshipModel = mongoose.Model<FriendshipDocument>;

// Model oluştur
let Friendship: FriendshipModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Friendship = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
  } as unknown as FriendshipModel;
} else {
  // Gerçek model
  Friendship =
    (mongoose.models['Friendship'] as FriendshipModel) ||
    mongoose.model<FriendshipDocument, FriendshipModel>('Friendship', friendshipSchema);
}

export default Friendship;
