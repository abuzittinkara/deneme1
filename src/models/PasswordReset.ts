/**
 * src/models/PasswordReset.ts
 * Şifre sıfırlama modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';

// Şifre sıfırlama arayüzü
export interface IPasswordReset {
  user: mongoose.Types.ObjectId;
  token: string;
  expires: Date;
  used: boolean;
}

// Şifre sıfırlama dokümanı arayüzü
export interface PasswordResetDocument extends TypedDocument<IPasswordReset> {}

// Şifre sıfırlama modeli arayüzü
export interface PasswordResetModel extends FullModelType<IPasswordReset> {
  // Özel statik metodlar buraya eklenebilir
  findValidToken(token: string): Promise<PasswordResetDocument | null>;
}

// Şifre sıfırlama şeması
const PasswordResetSchema = new Schema<PasswordResetDocument, PasswordResetModel>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true },
    expires: { type: Date, required: true },
    used: { type: Boolean, default: false }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Token 24 saat sonra otomatik silinsin
PasswordResetSchema.index({ expires: 1 }, { expireAfterSeconds: 86400 });
PasswordResetSchema.index({ token: 1 });
PasswordResetSchema.index({ user: 1 });

// Statik metodlar
PasswordResetSchema.statics.findValidToken = function(token: string): Promise<PasswordResetDocument | null> {
  return this.findOne({
    token,
    used: false,
    expires: { $gt: new Date() }
  }) as unknown as Promise<PasswordResetDocument | null>;
};

// Şifre sıfırlama modelini oluştur
let PasswordReset: PasswordResetModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  PasswordReset = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByToken: () => Promise.resolve(null),
  } as unknown as PasswordResetModel;
} else {
  // Gerçek model
  PasswordReset = (mongoose.models.PasswordReset as PasswordResetModel) ||
    mongoose.model<PasswordResetDocument, PasswordResetModel>('PasswordReset', PasswordResetSchema);
}

export default PasswordReset;
