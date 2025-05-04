/**
 * src/models/Session.ts
 * Oturum modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Cihaz bilgisi arayüzü
export interface DeviceInfo {
  browser?: string;
  os?: string;
  device?: string;
  isMobile?: boolean;
}

// Konum bilgisi arayüzü
export interface LocationInfo {
  country?: string;
  city?: string;
}

// Oturum arayüzü
export interface ISession {
  user: mongoose.Types.ObjectId;
  socketId?: string;
  userAgent?: string;
  ipAddress?: string;
  loginTime: Date;
  lastActivity: Date;
  isActive: boolean;
  logoutTime?: Date;
  deviceInfo?: DeviceInfo;
  location?: LocationInfo;
  createdAt?: Date;
  updatedAt?: Date;
}

// Oturum dokümanı arayüzü
export interface SessionDocument extends TypedDocument<ISession> {
  createdAt: Date;
  updatedAt: Date;
}

// Oturum modeli arayüzü
export interface SessionModel extends FullModelType<ISession> {
  // Özel statik metodlar buraya eklenebilir
  findActiveByUser(userId: mongoose.Types.ObjectId): Promise<SessionDocument[]>;
  updateActivity(socketId: string): Promise<SessionDocument | null>;
}

// Oturum şeması
const sessionSchema = new Schema<SessionDocument, SessionModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    socketId: { type: String },
    userAgent: { type: String },
    ipAddress: { type: String },
    loginTime: { type: Date, default: Date.now },
    lastActivity: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    logoutTime: { type: Date },
    deviceInfo: {
      browser: { type: String },
      os: { type: String },
      device: { type: String },
      isMobile: { type: Boolean }
    },
    location: {
      country: { type: String },
      city: { type: String }
    }
  },
  {
    timestamps: true
  }
);

// İndeksler
// Şema tanımında index: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
sessionSchema.index({ lastActivity: -1 });
sessionSchema.index({ user: 1, isActive: 1 });
sessionSchema.index(
  { logoutTime: 1 },
  {
    expireAfterSeconds: 7 * 24 * 60 * 60, // 7 gün sonra otomatik sil
    partialFilterExpression: { isActive: false }
  }
);

// Statik metodlar
sessionSchema.statics.findActiveByUser = function(
  userId: mongoose.Types.ObjectId
): Promise<SessionDocument[]> {
  return this.find({ user: userId, isActive: true })
    .sort({ lastActivity: -1 }) as unknown as Promise<SessionDocument[]>;
};

sessionSchema.statics.updateActivity = function(
  socketId: string
): Promise<SessionDocument | null> {
  return this.findOneAndUpdate(
    { socketId },
    { lastActivity: new Date() },
    { new: true }
  ) as unknown as Promise<SessionDocument | null>;
};

// Oturum modelini oluştur
let Session: SessionModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Session = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findActiveByUser: () => Promise.resolve([]),
    updateActivity: () => Promise.resolve(null),
    findOneAndUpdate: () => Promise.resolve(null),
  } as unknown as SessionModel;
} else {
  // Gerçek model
  Session = (mongoose.models.Session as SessionModel) ||
    mongoose.model<SessionDocument, SessionModel>('Session', sessionSchema);
}

export default Session;
