/**
 * src/models/Invitation.ts
 * Davetiye modeli
 */
import mongoose, { Document, Schema } from 'mongoose';
import { ObjectId } from '../types/mongoose';
import { TypedDocument, FullModelType } from '../types/mongoose-types';
import crypto from 'crypto';

// Davetiye türleri
export enum InvitationType {
  GROUP = 'group',
  CHANNEL = 'channel'
}

// Davetiye durumları
export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  REVOKED = 'revoked'
}

// Davetiye arayüzü
export interface IInvitation {
  type: InvitationType;
  code: string;
  creator: mongoose.Types.ObjectId;
  target: mongoose.Types.ObjectId; // Grup veya kanal ID'si
  recipient?: mongoose.Types.ObjectId; // Belirli bir kullanıcı için (isteğe bağlı)
  maxUses?: number; // Maksimum kullanım sayısı (isteğe bağlı)
  useCount: number; // Kullanım sayısı
  expiresAt?: Date; // Son kullanma tarihi (isteğe bağlı)
  status: InvitationStatus;
  acceptedBy?: mongoose.Types.ObjectId[]; // Kabul eden kullanıcılar
  createdAt?: Date;
  updatedAt?: Date;
}

// Davetiye dokümanı arayüzü
export interface InvitationDocument extends TypedDocument<IInvitation> {
  createdAt: Date;
  updatedAt: Date;
  isValid(): boolean;
}

// Davetiye modeli arayüzü
export interface InvitationModel extends FullModelType<IInvitation> {
  // Özel statik metodlar
  findByCode(code: string): Promise<InvitationDocument | null>;
  findActiveByTarget(targetId: mongoose.Types.ObjectId): Promise<InvitationDocument[]>;
  findByCreator(creatorId: mongoose.Types.ObjectId): Promise<InvitationDocument[]>;
  findByRecipient(recipientId: mongoose.Types.ObjectId): Promise<InvitationDocument[]>;
  generateCode(): string;
  markAsExpired(): Promise<void>;
}

// Davetiye şeması
const InvitationSchema = new Schema<InvitationDocument, InvitationModel>(
  {
    // Davetiye türü
    type: {
      type: String,
      enum: Object.values(InvitationType),
      required: true
    },
    // Davetiye kodu
    code: {
      type: String,
      required: true,
      unique: true
    },
    // Davetiyeyi oluşturan kullanıcı
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    // Davetiyenin hedefi (grup veya kanal)
    target: {
      type: Schema.Types.ObjectId,
      required: true,
      refPath: 'type'
    },
    // Davetiyenin alıcısı (belirli bir kullanıcı için)
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    // Maksimum kullanım sayısı
    maxUses: {
      type: Number,
      min: 1
    },
    // Kullanım sayısı
    useCount: {
      type: Number,
      default: 0
    },
    // Son kullanma tarihi
    expiresAt: {
      type: Date
    },
    // Davetiye durumu
    status: {
      type: String,
      enum: Object.values(InvitationStatus),
      default: InvitationStatus.PENDING
    },
    // Kabul eden kullanıcılar
    acceptedBy: [{
      type: Schema.Types.ObjectId,
      ref: 'User'
    }]
  },
  {
    timestamps: true
  }
);

// İndeksler
// Şema tanımında unique: true kullanıldığı için burada tekrar tanımlamıyoruz
// Sadece özel indeksleri tanımlıyoruz
InvitationSchema.index({ creator: 1 });
InvitationSchema.index({ target: 1 });
InvitationSchema.index({ recipient: 1 });
InvitationSchema.index({ status: 1 });
InvitationSchema.index({ expiresAt: 1 });
InvitationSchema.index({ type: 1, target: 1 });

// Metotlar
InvitationSchema.methods.isValid = function(): boolean {
  // Davetiye geçerli mi kontrol et
  if (this.status !== InvitationStatus.PENDING) {
    return false;
  }

  // Son kullanma tarihi kontrolü
  if (this.expiresAt && new Date() > this.expiresAt) {
    return false;
  }

  // Maksimum kullanım sayısı kontrolü
  if (this.maxUses && this.useCount >= this.maxUses) {
    return false;
  }

  return true;
};

// Statik metodlar
InvitationSchema.statics.findByCode = function(
  code: string
): Promise<InvitationDocument | null> {
  return this.findOne({ code })
    .populate('creator', 'username profilePicture')
    .populate('target') as unknown as Promise<InvitationDocument | null>;
};

InvitationSchema.statics.findActiveByTarget = function(
  targetId: mongoose.Types.ObjectId
): Promise<InvitationDocument[]> {
  return this.find({
    target: targetId,
    status: InvitationStatus.PENDING,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }) as unknown as Promise<InvitationDocument[]>;
};

InvitationSchema.statics.findByCreator = function(
  creatorId: mongoose.Types.ObjectId
): Promise<InvitationDocument[]> {
  return this.find({ creator: creatorId })
    .sort({ createdAt: -1 }) as unknown as Promise<InvitationDocument[]>;
};

InvitationSchema.statics.findByRecipient = function(
  recipientId: mongoose.Types.ObjectId
): Promise<InvitationDocument[]> {
  return this.find({
    recipient: recipientId,
    status: InvitationStatus.PENDING,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  })
    .sort({ createdAt: -1 })
    .populate('creator', 'username profilePicture')
    .populate('target') as unknown as Promise<InvitationDocument[]>;
};

InvitationSchema.statics.generateCode = function(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

InvitationSchema.statics.markAsExpired = async function(): Promise<void> {
  await this.updateMany(
    {
      status: InvitationStatus.PENDING,
      expiresAt: { $lt: new Date() }
    },
    {
      $set: { status: InvitationStatus.EXPIRED }
    }
  );
};

// Davetiye modelini oluştur
let Invitation: InvitationModel;

// Geliştirme modunda mock model oluştur
if (process.env.NODE_ENV === 'development') {
  // Mock model
  Invitation = {
    find: () => Promise.resolve([]),
    findById: () => Promise.resolve(null),
    findOne: () => Promise.resolve(null),
    create: () => Promise.resolve({} as any),
    updateOne: () => Promise.resolve({ modifiedCount: 0 }),
    deleteOne: () => Promise.resolve({ deletedCount: 0 }),
    countDocuments: () => Promise.resolve(0),
    findByCode: () => Promise.resolve(null),
    findActiveByTarget: () => Promise.resolve([]),
    findByCreator: () => Promise.resolve([]),
    findByRecipient: () => Promise.resolve([]),
    generateCode: () => 'MOCK123',
    markAsExpired: async () => {},
    updateMany: () => Promise.resolve({ modifiedCount: 0 }),
  } as unknown as InvitationModel;
} else {
  // Gerçek model
  Invitation = (mongoose.models.Invitation as InvitationModel) ||
    mongoose.model<InvitationDocument, InvitationModel>('Invitation', InvitationSchema);
}

export default Invitation;
