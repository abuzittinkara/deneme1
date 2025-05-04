/**
 * src/models/PasswordResetToken.ts
 * Şifre sıfırlama token modeli
 */
import mongoose, { Document, Schema } from 'mongoose';

// Şifre sıfırlama token arayüzü
export interface IPasswordResetToken {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// Şifre sıfırlama token dokümanı
export interface PasswordResetTokenDocument extends IPasswordResetToken, Document {}

// Şifre sıfırlama token şeması
const passwordResetTokenSchema = new Schema<PasswordResetTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    token: {
      type: String,
      required: true
    },
    expiresAt: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: true
  }
);

// Süresi dolmuş token'ları otomatik olarak temizle
// Şema tanımında expiresAt zaten tanımlı, bu yüzden TTL indeksi yeterli
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Model arayüzü
export interface PasswordResetTokenModel extends mongoose.Model<PasswordResetTokenDocument> {
  // Özel model metodları buraya eklenebilir
}

// Model oluştur
let PasswordResetToken: PasswordResetTokenModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  PasswordResetToken = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
  } as unknown as PasswordResetTokenModel;
} else {
  // Gerçek model
  PasswordResetToken = mongoose.model<PasswordResetTokenDocument, PasswordResetTokenModel>(
    'PasswordResetToken',
    passwordResetTokenSchema
  );
}

export default PasswordResetToken;
