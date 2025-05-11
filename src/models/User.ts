/**
 * src/models/User.ts
 * Kullanıcı modeli
 *
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Kullanıcı ID
 *           example: 60d0fe4f5311236168a109ca
 *         username:
 *           type: string
 *           description: Kullanıcı adı
 *           example: johndoe
 *         name:
 *           type: string
 *           description: Ad
 *           example: John
 *         surname:
 *           type: string
 *           description: Soyad
 *           example: Doe
 *         email:
 *           type: string
 *           format: email
 *           description: E-posta adresi
 *           example: john@example.com
 *         emailVerified:
 *           type: boolean
 *           description: E-posta doğrulanmış mı
 *           example: true
 *         bio:
 *           type: string
 *           description: Kullanıcı biyografisi
 *           example: Merhaba, ben John!
 *         status:
 *           type: string
 *           enum: [online, offline, away, busy]
 *           description: Kullanıcı durumu
 *           example: online
 *         customStatus:
 *           type: string
 *           description: Özel durum mesajı
 *           example: Çalışıyorum
 *         avatar:
 *           type: string
 *           description: Avatar URL
 *           example: https://example.com/avatar.jpg
 *         role:
 *           type: string
 *           enum: [admin, moderator, user, guest]
 *           description: Kullanıcı rolü
 *           example: user
 *         isActive:
 *           type: boolean
 *           description: Kullanıcı aktif mi
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Oluşturulma tarihi
 *           example: 2021-06-21T12:00:00.000Z
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Güncellenme tarihi
 *           example: 2021-06-21T12:00:00.000Z
 *       required:
 *         - username
 *         - email
 *         - role
 *         - isActive
 *
 *     Error:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: object
 *           properties:
 *             message:
 *               type: string
 *               example: Bir hata oluştu
 *             type:
 *               type: string
 *               example: ValidationError
 *             statusCode:
 *               type: integer
 *               example: 400
 */
import mongoose, { Document, Schema, Types, Model, Query } from 'mongoose';
import { UserStatus, UserRole, NotificationType } from '../types/enums';
import { ObjectId } from '../types/mongoose';
import { TypedDocument } from '../types/mongoose-types';
import { FullModelType } from '../types/mongoose-model';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Kullanıcı tercihleri için interface
export interface UserPreferences {
  theme: 'dark' | 'light';
  notifications: boolean;
  emailNotifications: boolean;
  soundEffects: boolean;
  language: string;
  notificationTypes: {
    [NotificationType.DIRECT_MESSAGES]: boolean;
    [NotificationType.MENTIONS]: boolean;
    [NotificationType.FRIEND_REQUESTS]: boolean;
    [NotificationType.GROUP_INVITES]: boolean;
    [NotificationType.CHANNEL_MESSAGES]: boolean;
  };
}

// Favori öğe için interface
export interface FavoriteItem {
  type: 'channel' | 'user';
  itemId: string;
  name: string;
  groupId?: string;
  addedAt: Date;
}

// Çevrimiçi durum bilgisi arayüzü
export interface OnlineStatus {
  isOnline: boolean;
  lastActiveAt: Date;
  device?: string;
  platform?: string;
  ipAddress?: string;
  location?: string;
}

// Kullanıcı arayüzü
export interface IUser {
  username: string;
  passwordHash: string;
  name?: string;
  surname?: string;
  birthdate?: Date;
  email?: string;
  phone?: string;

  // Email doğrulama alanları
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;

  // Şifre sıfırlama alanları
  passwordResetToken?: string;
  passwordResetExpires?: Date;

  // Gelişmiş profil alanları
  bio: string;
  status: UserStatus;
  customStatus: string;
  profilePicture?: ObjectId;
  lastSeen?: Date;
  onlineStatus: OnlineStatus;
  avatar?: string;

  // İki faktörlü kimlik doğrulama alanları
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes: string[];

  // Push bildirim aboneliği
  pushSubscription?: object;

  // Kullanıcı tercihleri
  preferences: UserPreferences;

  // İlişkiler
  groups: Types.ObjectId[];
  friends: Types.ObjectId[];
  friendRequests: Types.ObjectId[];
  blocked: Types.ObjectId[];
  favorites: FavoriteItem[];
  flaggedMessages?: { [flag: string]: string[] };

  // Rol ve durum
  role: UserRole;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Kullanıcı örnek metodları
export interface UserInstanceMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
}

// Kullanıcı dokümanı için interface
export type UserDocument = TypedDocument<IUser, UserInstanceMethods>;

// Kullanıcı şeması
const userSchema = new Schema<UserDocument>(
  {
    // Temel bilgiler
    username: {
      type: String,
      required: [true, 'Kullanıcı adı zorunludur'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Kullanıcı adı en az 3 karakter olmalıdır'],
      maxlength: [30, 'Kullanıcı adı en fazla 30 karakter olmalıdır'],
      match: [
        /^[a-zA-Z0-9_\.]+$/,
        'Kullanıcı adı sadece harf, rakam, nokta ve alt çizgi içerebilir',
      ],
    },
    passwordHash: {
      type: String,
      required: [true, 'Şifre zorunludur'],
    },
    name: {
      type: String,
      trim: true,
      maxlength: [50, 'İsim en fazla 50 karakter olmalıdır'],
    },
    surname: {
      type: String,
      trim: true,
      maxlength: [50, 'Soyisim en fazla 50 karakter olmalıdır'],
    },
    birthdate: {
      type: Date,
      validate: {
        validator: function (value: Date) {
          // 13 yaşından büyük olmalı
          const minAge = 13;
          const minDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - minAge);
          return !value || value <= minDate;
        },
        message: 'Kullanıcı en az 13 yaşında olmalıdır',
      },
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true, // null değerlere izin ver
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Geçerli bir e-posta adresi giriniz'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{10,15}$/, 'Geçerli bir telefon numarası giriniz'],
    },

    // Email doğrulama alanları
    emailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false, // Varsayılan olarak sorguya dahil etme
    },
    emailVerificationExpires: {
      type: Date,
      select: false, // Varsayılan olarak sorguya dahil etme
    },

    // Şifre sıfırlama alanları
    passwordResetToken: {
      type: String,
      select: false, // Varsayılan olarak sorguya dahil etme
    },
    passwordResetExpires: {
      type: Date,
      select: false, // Varsayılan olarak sorguya dahil etme
    },

    // Giriş deneme sayısı ve kilitleme
    loginAttempts: {
      type: Number,
      default: 0,
      min: 0,
    } as any,
    lockUntil: {
      type: Date,
      select: false, // Varsayılan olarak sorguya dahil etme
    },

    // Gelişmiş profil alanları
    bio: {
      type: String,
      default: '',
      maxlength: [500, 'Biyografi en fazla 500 karakter olmalıdır'],
    },
    status: {
      type: String,
      enum: {
        values: Object.values(UserStatus),
        message: 'Geçersiz kullanıcı durumu: {VALUE}',
      },
      default: UserStatus.ACTIVE,
    },
    customStatus: {
      type: String,
      default: '',
      maxlength: [100, 'Özel durum en fazla 100 karakter olmalıdır'],
    },
    profilePicture: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FileAttachment',
    },
    lastSeen: {
      type: Date,
    },
    lastLogin: {
      type: Date,
    },
    onlineStatus: {
      isOnline: { type: Boolean, default: false },
      lastActiveAt: { type: Date, default: Date.now },
      device: { type: String },
      platform: { type: String },
      ipAddress: { type: String },
      location: { type: String },
    },

    // İki faktörlü kimlik doğrulama alanları
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: false, // Varsayılan olarak sorguya dahil etme
    },
    backupCodes: [
      {
        type: String,
        select: false, // Varsayılan olarak sorguya dahil etme
      },
    ],

    // Push bildirim aboneliği
    pushSubscription: {
      type: Object,
    },

    // Kullanıcı tercihleri
    preferences: {
      theme: {
        type: String,
        enum: {
          values: ['dark', 'light', 'system'],
          message: 'Geçersiz tema: {VALUE}',
        },
        default: 'dark',
      },
      notifications: {
        type: Boolean,
        default: true,
      },
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      soundEffects: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        enum: {
          values: ['tr', 'en', 'de', 'fr', 'es'],
          message: 'Desteklenmeyen dil: {VALUE}',
        },
        default: 'tr',
      },
      notificationTypes: {
        [NotificationType.DIRECT_MESSAGES]: { type: Boolean, default: true },
        [NotificationType.MENTIONS]: { type: Boolean, default: true },
        [NotificationType.FRIEND_REQUESTS]: { type: Boolean, default: true },
        [NotificationType.GROUP_INVITES]: { type: Boolean, default: true },
        [NotificationType.CHANNEL_MESSAGES]: { type: Boolean, default: false },
      },
      privacy: {
        showOnlineStatus: { type: Boolean, default: true },
        showLastSeen: { type: Boolean, default: true },
        allowFriendRequests: { type: Boolean, default: true },
        allowDirectMessages: {
          type: String,
          enum: ['everyone', 'friends', 'none'],
          default: 'everyone',
        },
      },
    },

    // İlişkiler
    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
      },
    ],
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    friendRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    blocked: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    favorites: [
      {
        type: {
          type: String,
          enum: {
            values: ['channel', 'user', 'group'],
            message: 'Geçersiz favori tipi: {VALUE}',
          },
          required: true,
        },
        itemId: {
          type: String,
          required: true,
          validate: {
            validator: function (v: string) {
              return mongoose.Types.ObjectId.isValid(v);
            },
            message: 'Geçersiz itemId formatı',
          },
        },
        name: {
          type: String,
          required: true,
          trim: true,
          maxlength: [100, 'Favori adı en fazla 100 karakter olmalıdır'],
        },
        groupId: {
          type: String,
          validate: {
            validator: function (v: string) {
              return !v || mongoose.Types.ObjectId.isValid(v);
            },
            message: 'Geçersiz groupId formatı',
          },
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Rol ve durum
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: 'Geçersiz kullanıcı rolü: {VALUE}',
      },
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt ve updatedAt alanlarını otomatik ekle
    toJSON: {
      transform: function (doc, ret) {
        // Hassas alanları JSON çıktısından kaldır
        delete ret['passwordHash'];
        delete ret['passwordResetToken'];
        delete ret['passwordResetExpires'];
        delete ret['emailVerificationToken'];
        delete ret['emailVerificationExpires'];
        delete ret['twoFactorSecret'];
        delete ret['backupCodes'];
        delete ret['lockUntil'];
        return ret;
      },
      virtuals: true, // Sanal alanları JSON çıktısına dahil et
    },
    toObject: {
      virtuals: true, // Sanal alanları Object çıktısına dahil et
    },
  }
);

// İndeksler
// Temel indeksler
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ isActive: 1 });

// Zaman tabanlı indeksler
userSchema.index({ createdAt: -1 });
userSchema.index({ updatedAt: -1 });
userSchema.index({ lastSeen: -1 });
userSchema.index({ lastLogin: -1 });
userSchema.index({ 'onlineStatus.isOnline': 1 });
userSchema.index({ 'onlineStatus.lastActiveAt': -1 });

// İlişki indeksleri
userSchema.index({ groups: 1 });
userSchema.index({ friends: 1 });
userSchema.index({ friendRequests: 1 });
userSchema.index({ blocked: 1 });
userSchema.index({ 'favorites.itemId': 1 });
userSchema.index({ 'favorites.type': 1 });

// Metin arama indeksi
userSchema.index(
  { username: 'text', name: 'text', surname: 'text', bio: 'text' },
  {
    weights: {
      username: 10,
      name: 5,
      surname: 5,
      bio: 1,
    },
    name: 'userTextIndex',
  }
);

// Metotlar
/**
 * Şifre karşılaştırma metodu
 * @param candidatePassword - Karşılaştırılacak şifre
 * @returns Şifre eşleşiyorsa true, aksi halde false
 */
userSchema.methods['comparePassword'] = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    const passwordHash = this['passwordHash'];
    if (!passwordHash) {
      return false;
    }
    return await bcrypt.compare(candidatePassword, passwordHash);
  } catch (error) {
    logger.error('Şifre karşılaştırma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      userId: this['_id'],
    });
    throw new Error('Şifre karşılaştırma hatası');
  }
};

// Logger modülünü içe aktar
import logger from '../utils/logger';

/**
 * JWT token oluşturma metodu
 * @returns JWT token
 */
userSchema.methods['generateAuthToken'] = function (): string {
  try {
    const _id = this['_id'];
    const username = this['username'];
    const role = this['role'];
    const status = this['status'];

    if (!_id) {
      throw new Error('Kullanıcı ID bulunamadı');
    }

    const payload = {
      id: _id.toString(),
      username: username || '',
      role: role || 'user',
      status: status || 'active',
      sub: _id.toString(),
    };

    const jwtSecret = process.env['JWT_SECRET'] || 'default_secret';
    const jwtExpiresIn = process.env['JWT_EXPIRES_IN'] || '1h';
    const jwtOptions = {
      expiresIn: jwtExpiresIn,
      algorithm: 'HS256',
      jti: require('crypto').randomBytes(16).toString('hex'),
      issuer: 'fisqos-api',
      audience: 'fisqos-client',
    } as jwt.SignOptions;

    // JWT token oluştur
    return jwt.sign(payload, jwtSecret, jwtOptions);
  } catch (error) {
    logger.error('JWT token oluşturma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      userId: this['_id'],
    });
    throw new Error('JWT token oluşturma hatası');
  }
};

/**
 * Refresh token oluşturma metodu
 * @returns Refresh token
 */
userSchema.methods['generateRefreshToken'] = function (): string {
  try {
    const _id = this['_id'];
    const username = this['username'];
    const role = this['role'];

    if (!_id) {
      throw new Error('Kullanıcı ID bulunamadı');
    }

    const payload = {
      id: _id.toString(),
      username: username || '',
      role: role || 'user',
      sub: _id.toString(),
      type: 'refresh',
    };

    const refreshSecret = process.env['JWT_REFRESH_SECRET'] || 'default_refresh_secret';
    const refreshExpiresIn = process.env['JWT_REFRESH_EXPIRES_IN'] || '7d';
    const refreshOptions = {
      expiresIn: refreshExpiresIn,
      algorithm: 'HS256',
      jti: require('crypto').randomBytes(32).toString('hex'),
    } as jwt.SignOptions;

    // Refresh token oluştur
    return jwt.sign(payload, refreshSecret, refreshOptions);
  } catch (error) {
    logger.error('Refresh token oluşturma hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      userId: this['_id'],
    });
    throw new Error('Refresh token oluşturma hatası');
  }
};

// Kullanıcı modeli statik metodları
export interface UserStaticMethods {
  findByUsername(username: string): Query<UserDocument | null, UserDocument>;
  findByEmail(email: string): Query<UserDocument | null, UserDocument>;
  findByUsernameOrEmail(usernameOrEmail: string): Query<UserDocument | null, UserDocument>;
  findActiveUsers(limit?: number, skip?: number): Query<UserDocument[], UserDocument>;
  findOnlineUsers(limit?: number): Query<UserDocument[], UserDocument>;
}

// Kullanıcı modeli arayüzü
export interface UserModel
  extends FullModelType<UserDocument, {}, UserInstanceMethods, {}, UserStaticMethods> {
  // Mongoose model metodları
  find(filter?: any, projection?: any, options?: any): Query<UserDocument[], UserDocument>;
  findOne(filter?: any, projection?: any, options?: any): Query<UserDocument | null, UserDocument>;
  findById(
    id: string | mongoose.Types.ObjectId,
    projection?: any,
    options?: any
  ): Query<UserDocument | null, UserDocument>;
  create(doc: Partial<IUser>): Promise<UserDocument>;
  updateOne(filter: any, update: any, options?: any): Promise<mongoose.UpdateWriteOpResult>;
  updateMany(filter: any, update: any, options?: any): Promise<mongoose.UpdateWriteOpResult>;
  deleteOne(filter: any, options?: any): Promise<mongoose.DeleteResult>;
  deleteMany(filter: any, options?: any): Promise<mongoose.DeleteResult>;
  countDocuments(filter?: any): Promise<number>;
  findByIdAndUpdate(
    id: string | mongoose.Types.ObjectId,
    update: any,
    options?: any
  ): Query<UserDocument | null, UserDocument>;
  findByIdAndDelete(
    id: string | mongoose.Types.ObjectId,
    options?: any
  ): Query<UserDocument | null, UserDocument>;
}

// Statik metodlar
/**
 * Kullanıcı adına göre kullanıcı bulma
 * @param username - Kullanıcı adı
 * @returns Kullanıcı dokümanı veya null
 */
userSchema.statics['findByUsername'] = function (
  username: string
): Query<UserDocument | null, UserDocument> {
  if (!username) return Promise.resolve(null) as any;

  return (this as UserModel).findOne({
    username: new RegExp(`^${username.trim()}$`, 'i'),
  });
};

/**
 * E-posta adresine göre kullanıcı bulma
 * @param email - E-posta adresi
 * @returns Kullanıcı dokümanı veya null
 */
userSchema.statics['findByEmail'] = function (
  email: string
): Query<UserDocument | null, UserDocument> {
  if (!email) return Promise.resolve(null) as any;

  return (this as UserModel).findOne({
    email: new RegExp(`^${email.trim()}$`, 'i'),
  });
};

/**
 * Kullanıcı adı veya e-posta adresine göre kullanıcı bulma
 * @param usernameOrEmail - Kullanıcı adı veya e-posta adresi
 * @returns Kullanıcı dokümanı veya null
 */
userSchema.statics['findByUsernameOrEmail'] = function (
  usernameOrEmail: string
): Query<UserDocument | null, UserDocument> {
  if (!usernameOrEmail) return Promise.resolve(null) as any;

  const query = usernameOrEmail.includes('@')
    ? { email: new RegExp(`^${usernameOrEmail.trim()}$`, 'i') }
    : { username: new RegExp(`^${usernameOrEmail.trim()}$`, 'i') };

  return (this as UserModel).findOne(query);
};

/**
 * Aktif kullanıcıları bulma
 * @param limit - Maksimum kullanıcı sayısı
 * @param skip - Atlanacak kullanıcı sayısı
 * @returns Aktif kullanıcı dokümanları
 */
userSchema.statics['findActiveUsers'] = function (
  limit = 20,
  skip = 0
): Query<UserDocument[], UserDocument> {
  return (this as UserModel)
    .find({
      isActive: true,
      status: { $ne: UserStatus.SUSPENDED },
    })
    .sort({ lastSeen: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Çevrimiçi kullanıcıları bulma
 * @param limit - Maksimum kullanıcı sayısı
 * @returns Çevrimiçi kullanıcı dokümanları
 */
userSchema.statics['findOnlineUsers'] = function (limit = 50): Query<UserDocument[], UserDocument> {
  const onlineThreshold = new Date();
  onlineThreshold.setMinutes(onlineThreshold.getMinutes() - 5); // Son 5 dakika içinde aktif olanlar

  return (this as UserModel)
    .find({
      isActive: true,
      $or: [{ 'onlineStatus.isOnline': true }, { lastSeen: { $gte: onlineThreshold } }],
    })
    .sort({ 'onlineStatus.lastActiveAt': -1 })
    .limit(limit);
};

// Kullanıcı modelini oluştur
let UserModel_: UserModel;

// Gerçek model
const existingModel = mongoose.models['User'] as Model<
  UserDocument,
  {},
  UserInstanceMethods,
  {},
  UserDocument
>;

if (existingModel) {
  UserModel_ = existingModel as unknown as UserModel;
} else {
  UserModel_ = mongoose.model<UserDocument, UserModel>('User', userSchema);
}

// Hem default export hem de named export sağla
export const User = UserModel_;
export default UserModel_;
