/**
 * src/types/index.ts
 * Uygulama genelinde kullanılan tip tanımlamaları
 */
import { Request } from 'express';
import { Document, Types } from 'mongoose';

/**
 * MongoDB ObjectId tipi
 */
export type ObjectId = Types.ObjectId;

/**
 * Pagination seçenekleri
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: Record<string, 1 | -1>;
}

/**
 * Pagination sonucu
 */
export interface PaginationResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

/**
 * Kimlik doğrulanmış kullanıcı
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  iat?: number;
  exp?: number;
  sub: string;
}

/**
 * Kimlik doğrulanmış istek
 */
export interface AuthRequest extends Omit<Request, 'user'> {
  user?: AuthUser;
}

/**
 * API yanıtı
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  statusCode?: number;
}

/**
 * Kullanıcı belge tipi
 */
export interface UserDocument extends Document {
  email: string;
  username: string;
  name: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  verificationToken?: string;
  verificationExpires?: Date;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  lastLogin?: Date;
  bio?: string;
  location?: string;
  website?: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;

  // Metodlar
  comparePassword(password: string): Promise<boolean>;
  generateAuthToken(): Promise<string>;
  generateRefreshToken(): Promise<string>;
  toJSON(): Record<string, any>;
}

/**
 * Kullanıcı oluşturma verileri
 */
export interface CreateUserData {
  email: string;
  username: string;
  name: string;
  password: string;
  role?: string;
  isActive?: boolean;
  isVerified?: boolean;
}

/**
 * Kullanıcı güncelleme verileri
 */
export interface UpdateUserData {
  name?: string;
  bio?: string;
  location?: string;
  website?: string;
  avatar?: string;
}

/**
 * Şifre güncelleme verileri
 */
export interface UpdatePasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Kimlik doğrulama token'ları
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Kimlik doğrulama yanıtı
 */
export interface AuthResponse {
  user: Record<string, any>;
  tokens: AuthTokens;
}

/**
 * Mesaj belge tipi
 */
export interface MessageDocument extends Document {
  channel: ObjectId;
  user: ObjectId;
  content: string;
  attachments?: string[];
  mentions?: ObjectId[];
  reactions?: {
    emoji: string;
    users: ObjectId[];
  }[];
  isEdited: boolean;
  isDeleted: boolean;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Kanal belge tipi
 */
export interface ChannelDocument extends Document {
  name: string;
  description?: string;
  group: ObjectId;
  isPrivate: boolean;
  members: ObjectId[];
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Grup belge tipi
 */
export interface GroupDocument extends Document {
  name: string;
  description?: string;
  avatar?: string;
  owner: ObjectId;
  members: ObjectId[];
  isPrivate: boolean;
  inviteCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Kategori belge tipi
 */
export interface CategoryDocument extends Document {
  name: string;
  description?: string;
  group: ObjectId;
  channels: ObjectId[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rol belge tipi
 */
export interface RoleDocument extends Document {
  name: string;
  group: ObjectId;
  permissions: string[];
  color?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Grup üyeliği belge tipi
 */
export interface GroupMemberDocument extends Document {
  group: ObjectId;
  user: ObjectId;
  roles: ObjectId[];
  joinedAt: Date;
  nickname?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Davet belge tipi
 */
export interface InvitationDocument extends Document {
  group: ObjectId;
  code: string;
  createdBy: ObjectId;
  expiresAt?: Date;
  maxUses?: number;
  uses: number;
  isActive: boolean;
  acceptedBy?: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Direkt mesaj belge tipi
 */
export interface DirectMessageDocument extends Document {
  sender: ObjectId;
  recipient: ObjectId;
  content: string;
  attachments?: string[];
  isRead: boolean;
  isEdited: boolean;
  isDeleted: boolean;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bildirim belge tipi
 */
export interface NotificationDocument extends Document {
  user: ObjectId;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook belge tipi
 */
export interface WebhookDocument extends Document {
  name: string;
  url: string;
  group: ObjectId;
  channel?: ObjectId;
  events: string[];
  avatar?: string;
  isActive: boolean;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dosya belge tipi
 */
export interface FileDocument extends Document {
  filename: string;
  originalname: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
  user: ObjectId;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Aktivite belge tipi
 */
export interface ActivityDocument extends Document {
  user: ObjectId;
  type: string;
  action: string;
  target?: {
    type: string;
    id: ObjectId;
    name?: string;
  };
  data?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rapor belge tipi
 */
export interface ReportDocument extends Document {
  reporter: ObjectId;
  reportedUser?: ObjectId;
  reportedMessage?: ObjectId;
  reportedChannel?: ObjectId;
  reportedGroup?: ObjectId;
  reason: string;
  description?: string;
  status: string;
  resolvedBy?: ObjectId;
  resolvedAt?: Date;
  resolution?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Planlanmış mesaj belge tipi
 */
export interface ScheduledMessageDocument extends Document {
  user: ObjectId;
  channel?: ObjectId;
  recipient?: ObjectId;
  content: string;
  attachments?: string[];
  scheduledFor: Date;
  isProcessed: boolean;
  processedAt?: Date;
  isCancelled: boolean;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
