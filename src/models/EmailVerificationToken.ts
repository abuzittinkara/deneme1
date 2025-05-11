/**
 * src/models/EmailVerificationToken.ts
 * E-posta doğrulama token modeli
 */
import mongoose, { Document, Schema } from 'mongoose';

// E-posta doğrulama token arayüzü
export interface IEmailVerificationToken {
  userId: mongoose.Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

// E-posta doğrulama token dokümanı
export interface EmailVerificationTokenDocument extends IEmailVerificationToken, Document {}

// E-posta doğrulama token şeması
const emailVerificationTokenSchema = new Schema<EmailVerificationTokenDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Süresi dolmuş token'ları otomatik olarak temizle
// TTL indeksi - süresi dolmuş token'ları otomatik sil
emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Model arayüzü
export type EmailVerificationTokenModel = mongoose.Model<EmailVerificationTokenDocument>;

// Model oluştur
let EmailVerificationToken: EmailVerificationTokenModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  EmailVerificationToken = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
  } as unknown as EmailVerificationTokenModel;
} else {
  // Gerçek model
  EmailVerificationToken =
    (mongoose.models['EmailVerificationToken'] as EmailVerificationTokenModel) ||
    mongoose.model<EmailVerificationTokenDocument, EmailVerificationTokenModel>(
      'EmailVerificationToken',
      emailVerificationTokenSchema
    );
}

export default EmailVerificationToken;
