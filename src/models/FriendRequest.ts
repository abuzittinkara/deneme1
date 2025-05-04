/**
 * src/models/FriendRequest.ts
 * Arkadaşlık isteği modeli
 */
import mongoose, { Document, Schema } from 'mongoose';

// Arkadaşlık isteği arayüzü
export interface IFriendRequest {
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

// Arkadaşlık isteği dokümanı
export interface FriendRequestDocument extends IFriendRequest, Document {}

// Arkadaşlık isteği şeması
const friendRequestSchema = new Schema<FriendRequestDocument>(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    receiver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
      required: true
    }
  },
  {
    timestamps: true
  }
);

// İndeksler
friendRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
friendRequestSchema.index({ sender: 1, status: 1 });
friendRequestSchema.index({ receiver: 1, status: 1 });

// Model arayüzü
export interface FriendRequestModel extends mongoose.Model<FriendRequestDocument> {
  // Özel model metodları buraya eklenebilir
}

// Model oluştur
let FriendRequest: FriendRequestModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  FriendRequest = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
  } as unknown as FriendRequestModel;
} else {
  // Gerçek model
  FriendRequest = mongoose.model<FriendRequestDocument, FriendRequestModel>('FriendRequest', friendRequestSchema);
}

export default FriendRequest;
