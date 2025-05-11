# TypeScript Geçiş Dokümantasyonu

Bu dokümantasyon, JavaScript'ten TypeScript'e geçiş sürecini ve bu süreçte yapılan değişiklikleri açıklar.

## İçindekiler

1. [Giriş](#giriş)
2. [Geçiş Stratejisi](#geçiş-stratejisi)
3. [Tip Tanımlamaları](#tip-tanımlamaları)
4. [Mongoose Modelleri](#mongoose-modelleri)
5. [Express Entegrasyonu](#express-entegrasyonu)
6. [Socket.IO Entegrasyonu](#socketio-entegrasyonu)
7. [Birim Testleri](#birim-testleri)
8. [Bilinen Sorunlar](#bilinen-sorunlar)
9. [Çoklu tsconfig Dosyaları](#çoklu-tsconfig-dosyaları)

## Giriş

Bu proje, JavaScript'ten TypeScript'e kademeli olarak geçirilmektedir. TypeScript, statik tip kontrolü sağlayarak daha güvenli ve bakımı daha kolay kod geliştirmeye olanak tanır.

## Geçiş Stratejisi

Geçiş stratejimiz aşağıdaki adımları içerir:

1. **Kademeli Geçiş**: Tüm kodu bir anda dönüştürmek yerine, modül bazında kademeli bir geçiş yapılmaktadır.
2. **Tip Tanımlamaları**: Öncelikle ortak tip tanımlamaları oluşturulmuştur.
3. **Modellerin Dönüştürülmesi**: Mongoose modellerinin TypeScript'e dönüştürülmesi.
4. **Servislerin Dönüştürülmesi**: İş mantığını içeren servislerin dönüştürülmesi.
5. **Rotaların Dönüştürülmesi**: API rotalarının dönüştürülmesi.
6. **Middleware'lerin Dönüştürülmesi**: Middleware'lerin dönüştürülmesi.
7. **Yardımcı Fonksiyonların Dönüştürülmesi**: Yardımcı fonksiyonların dönüştürülmesi.

## Tip Tanımlamaları

Tip tanımlamaları `src/types` dizininde bulunmaktadır:

- `src/types/common.ts`: Ortak tip tanımlamaları
- `src/types/models.ts`: Mongoose model tipleri
- `src/types/express.d.ts`: Express için tip genişletmeleri
- `src/types/socket.d.ts`: Socket.IO için tip genişletmeleri
- `src/types/modules.ts`: Modül fonksiyon ve parametre tipleri
- `src/types/enums.ts`: Enum tanımlamaları
- `src/types/mongoose.ts`: Mongoose ile ilgili ortak tip tanımlamaları

### Örnek Tip Tanımlamaları

```typescript
// src/types/common.ts
export type ID = string | number;

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy'
}

export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  GUEST = 'guest'
}

export enum ChannelType {
  TEXT = 'text',
  VOICE = 'voice'
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  SYSTEM = 'system'
}

export enum NotificationTypes {
  DIRECT_MESSAGES = 'direct_messages',
  MENTIONS = 'mentions',
  FRIEND_REQUESTS = 'friend_requests',
  GROUP_INVITES = 'group_invites',
  CHANNEL_MESSAGES = 'channel_messages'
}

export enum FileType {
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  DOCUMENT = 'document',
  OTHER = 'other'
}
```

## Mongoose Modelleri

Mongoose modellerinin TypeScript'e dönüştürülmesi, arayüzler ve şema tanımlamaları içerir:

```typescript
// src/models/User.ts
import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { UserStatus, UserRole, NotificationType } from '../types/enums';
import { ObjectId } from '../types/mongoose';
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

// Kullanıcı dokümanı için interface
export interface UserDocument extends Document {
  username: string;
  passwordHash: string;
  name?: string;
  surname?: string;
  birthdate?: Date;
  email?: string;
  phone?: string;
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  bio: string;
  status: UserStatus;
  customStatus: string;
  profilePicture?: Types.ObjectId;
  lastSeen?: Date;
  onlineStatus: {
    isOnline: boolean;
    lastActiveAt: Date;
    device?: string;
    platform?: string;
    ipAddress?: string;
    location?: string;
  };
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  backupCodes: string[];
  pushSubscription?: object;
  preferences: UserPreferences;
  groups: Types.ObjectId[];
  friends: Types.ObjectId[];
  friendRequests: Types.ObjectId[];
  blocked: Types.ObjectId[];
  favorites: {
    type: 'channel' | 'user';
    itemId: string;
    name: string;
    groupId?: string;
    addedAt: Date;
  }[];
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  
  // Metotlar
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
}

// Kullanıcı modeli arayüzü
export interface UserModel extends Model<UserDocument> {
  findByUsername(username: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
}

// Kullanıcı şeması
const userSchema = new Schema<UserDocument>({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String },
  surname: { type: String },
  birthdate: { type: Date },
  email: { type: String },
  phone: { type: String },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpires: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpires: { type: Date },
  bio: { type: String, default: '' },
  status: { type: String, enum: Object.values(UserStatus), default: UserStatus.ONLINE },
  customStatus: { type: String, default: '' },
  profilePicture: { type: mongoose.Schema.Types.ObjectId, ref: 'FileAttachment' },
  lastSeen: { type: Date },
  onlineStatus: {
    isOnline: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: Date.now },
    device: { type: String },
    platform: { type: String },
    ipAddress: { type: String },
    location: { type: String }
  },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },
  backupCodes: [{ type: String }],
  pushSubscription: { type: Object },
  preferences: {
    theme: { type: String, enum: ['dark', 'light'], default: 'dark' },
    notifications: { type: Boolean, default: true },
    emailNotifications: { type: Boolean, default: true },
    soundEffects: { type: Boolean, default: true },
    language: { type: String, default: 'tr' },
    notificationTypes: {
      [NotificationType.DIRECT_MESSAGES]: { type: Boolean, default: true },
      [NotificationType.MENTIONS]: { type: Boolean, default: true },
      [NotificationType.FRIEND_REQUESTS]: { type: Boolean, default: true },
      [NotificationType.GROUP_INVITES]: { type: Boolean, default: true },
      [NotificationType.CHANNEL_MESSAGES]: { type: Boolean, default: false }
    }
  },
  groups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Group' }],
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blocked: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  favorites: [
    {
      type: { type: String, enum: ['channel', 'user'], required: true },
      itemId: { type: String, required: true },
      name: { type: String, required: true },
      groupId: { type: String },
      addedAt: { type: Date, default: Date.now }
    }
  ],
  role: { type: String, enum: Object.values(UserRole), default: UserRole.USER },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

// Metotlar
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    throw new Error('Şifre karşılaştırma hatası');
  }
};

// JWT token oluşturma metodu
userSchema.methods.generateAuthToken = function(): string {
  const payload = {
    userId: this._id,
    username: this.username,
    role: this.role
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET || 'default_secret', {
    expiresIn: '1h'
  });
};

// Refresh token oluşturma metodu
userSchema.methods.generateRefreshToken = function(): string {
  const payload = {
    userId: this._id,
    username: this.username,
    tokenType: 'refresh'
  };
  
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'default_refresh_secret', {
    expiresIn: '7d'
  });
};

// Statik metodlar
userSchema.statics.findByUsername = function(username: string): Promise<UserDocument | null> {
  return this.findOne({ username }).exec();
};

userSchema.statics.findByEmail = function(email: string): Promise<UserDocument | null> {
  return this.findOne({ email }).exec();
};

// Kullanıcı modelini oluştur
export const User = mongoose.models.User as mongoose.Model<UserDocument, UserModel> ||
  mongoose.model<UserDocument, UserModel>('User', userSchema);

export default User;
```

## Express Entegrasyonu

Express için tip tanımlamaları, `src/types/express.d.ts` dosyasında genişletilmiştir:

```typescript
// src/types/express.d.ts
import { UserDocument } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: UserDocument;
      token?: string;
      startTime?: number;
      requestId?: string;
    }
  }
}
```

## Socket.IO Entegrasyonu

Socket.IO için tip tanımlamaları, `src/types/socket.d.ts` dosyasında genişletilmiştir:

```typescript
// src/types/socket.d.ts
import { Server, Socket } from 'socket.io';
import { UserDocument } from '../models/User';

declare module 'socket.io' {
  interface Socket {
    user?: UserDocument;
    userId?: string;
    username?: string;
    rooms: Set<string>;
    joinedChannels: string[];
  }
}
```

## Birim Testleri

TypeScript ile yazılmış birim testleri, Jest kullanılarak uygulanmıştır:

```typescript
// src/__tests__/utils/sanitizer.test.ts
import {
  escapeHtml,
  sanitizeXss,
  sanitizeSql,
  sanitizeUrl,
  sanitizeFilename,
  sanitizeAll,
  sanitizeText
} from '../../utils/sanitizer';

describe('Sanitizer Utils', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const html = '<script>alert("XSS");</script>';
      const escaped = escapeHtml(html);

      expect(escaped).toBe('&lt;script&gt;alert(&quot;XSS&quot;);&lt;/script&gt;');
    });

    it('should handle null or undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should not modify regular text', () => {
      const text = 'Hello, world!';
      expect(escapeHtml(text)).toBe(text);
    });
  });

  // Diğer testler...
});
```

## Bilinen Sorunlar

TypeScript geçişi sırasında karşılaşılan bilinen sorunlar:

1. **Mongoose Tip Uyumsuzlukları**: Mongoose'un JavaScript API'si ile TypeScript tip tanımlamaları arasında bazı uyumsuzluklar bulunmaktadır.
2. **Express Request Genişletmeleri**: Express Request nesnesinin genişletilmesi, bazı durumlarda tip hatalarına neden olabilir.
3. **Socket.IO Tip Tanımlamaları**: Socket.IO'nun TypeScript desteği tam olarak olgunlaşmamıştır ve bazı durumlarda manuel tip tanımlamaları gerekebilir.
4. **Eski JavaScript Kodları**: Bazı eski JavaScript kodları hala TypeScript'e dönüştürülmemiştir ve bunlar uyumsuzluklara neden olabilir.

Bu sorunlar, geçiş süreci ilerledikçe çözülecektir.

## Çoklu tsconfig Dosyaları

- `tsconfig.json`: Ana TypeScript derleyici ayarları, uygulamanın tamamı için kullanılır.
- `tsconfig.build.json`: Sadece production build için optimize edilmiş ayarlar içerir.
- `tsconfig.scripts.json`: Script ve yardımcı araçların (ör. migration, otomasyon) ayrı derlenmesi için kullanılır.

Her birinin amacı, farklı derleme hedefleri ve çıktı dizinleri için esneklik sağlamaktır.
