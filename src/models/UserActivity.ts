/**
 * src/models/UserActivity.ts
 * Kullanıcı aktivitesi modeli
 */
import mongoose, { Document, Schema, Model } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import { CommonModelStaticMethods } from '../types/mongoose-types';

// Aktivite türleri
export enum ActivityType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_EDITED = 'message_edited',
  MESSAGE_DELETED = 'message_deleted',
  CHANNEL_JOINED = 'channel_joined',
  CHANNEL_LEFT = 'channel_left',
  GROUP_JOINED = 'group_joined',
  GROUP_LEFT = 'group_left',
  PROFILE_UPDATED = 'profile_updated',
  FRIEND_ADDED = 'friend_added',
  FRIEND_REMOVED = 'friend_removed',
  USER_BLOCKED = 'user_blocked',
  USER_UNBLOCKED = 'user_unblocked',
  ROLE_ASSIGNED = 'role_assigned',
  ROLE_REMOVED = 'role_removed',
  INVITATION_CREATED = 'invitation_created',
  INVITATION_ACCEPTED = 'invitation_accepted',
  INVITATION_REVOKED = 'invitation_revoked',
  INVITATION_EXPIRED = 'invitation_expired'
}

// Aktivite hedefi arayüzü
export interface ActivityTarget {
  type: 'message' | 'directMessage' | 'user' | 'group' | 'channel' | 'role';
  id: mongoose.Types.ObjectId;
}

// Kullanıcı aktivitesi arayüzü
export interface IUserActivity {
  user: mongoose.Types.ObjectId;
  type: ActivityType;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  target?: ActivityTarget;
  metadata?: Record<string, any>;
}

// Kullanıcı aktivitesi dokümanı arayüzü
export interface UserActivityDocument extends Document, IUserActivity {}

// Kullanıcı aktivitesi modeli arayüzü
// Mongoose Model tipini genişleten özel model tipi
export interface UserActivityModel extends CommonModelStaticMethods<UserActivityDocument> {
  // Özel statik metodlar
  findByUser(userId: mongoose.Types.ObjectId, limit?: number): Promise<UserActivityDocument[]>;
  findByType(type: ActivityType, limit?: number): Promise<UserActivityDocument[]>;
  findByTarget(targetType: string, targetId: mongoose.Types.ObjectId, limit?: number): Promise<UserActivityDocument[]>;
  logActivity(activity: Omit<IUserActivity, 'timestamp'>): Promise<UserActivityDocument>;
}

// Aktivite hedefi şeması
const ActivityTargetSchema = new Schema({
  type: {
    type: String,
    enum: ['message', 'directMessage', 'user', 'group', 'channel', 'role'],
    required: true
  },
  id: { type: Schema.Types.ObjectId, required: true }
}, { _id: false });

// Kullanıcı aktivitesi şeması
const UserActivitySchema = new Schema<UserActivityDocument, UserActivityModel>(
  {
    // Aktiviteyi gerçekleştiren kullanıcı
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Aktivite türü
    type: {
      type: String,
      enum: Object.values(ActivityType),
      required: true,
      index: true
    },
    // Aktivite zamanı
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    // IP adresi
    ipAddress: {
      type: String
    },
    // Kullanıcı tarayıcı bilgisi
    userAgent: {
      type: String
    },
    // Aktivite hedefi
    target: ActivityTargetSchema,
    // Ek bilgiler
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: false
  }
);

// İndeksler
// Şema tanımında index: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
UserActivitySchema.index({ user: 1, timestamp: -1 });
UserActivitySchema.index({ type: 1, timestamp: -1 });
UserActivitySchema.index({ 'target.type': 1, 'target.id': 1, timestamp: -1 });
// TTL indeksi - 30 gün sonra otomatik sil
UserActivitySchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

// Statik metodlar
UserActivitySchema.statics.findByUser = async function(
  userId: mongoose.Types.ObjectId,
  limit = 50
): Promise<UserActivityDocument[]> {
  return (this.find({ user: userId }) as any)
    .sort({ timestamp: -1 })
    .limit(limit)
    .exec();
};

UserActivitySchema.statics.findByType = async function(
  type: ActivityType,
  limit = 50
): Promise<UserActivityDocument[]> {
  return (this.find({ type }) as any)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'username profilePicture')
    .exec();
};

UserActivitySchema.statics.findByTarget = async function(
  targetType: string,
  targetId: mongoose.Types.ObjectId,
  limit = 50
): Promise<UserActivityDocument[]> {
  return (this.find({
    'target.type': targetType,
    'target.id': targetId
  }) as any)
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('user', 'username profilePicture')
    .exec();
};

UserActivitySchema.statics.logActivity = function(
  activity: Omit<IUserActivity, 'timestamp'>
): Promise<UserActivityDocument> {
  return this.create({
    ...activity,
    timestamp: new Date()
  }) as unknown as Promise<UserActivityDocument>;
};

// Kullanıcı aktivitesi modelini oluştur
let UserActivity: UserActivityModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  UserActivity = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByUser: () => Promise.resolve([]),
    findByTarget: () => Promise.resolve([]),
    logActivity: () => Promise.resolve({} as any),
  } as unknown as UserActivityModel;
} else {
  // Gerçek model
  UserActivity = (mongoose.models.UserActivity as UserActivityModel) ||
    mongoose.model<UserActivityDocument, UserActivityModel>('UserActivity', UserActivitySchema);
}

export default UserActivity;
