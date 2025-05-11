/**
 * src/types/models.ts
 * Mongoose model tipleri
 */

import { Document, Types } from 'mongoose';
import {
  ID,
  UserStatus,
  UserRole,
  ChannelType,
  MessageType,
  NotificationTypes,
  FileType,
} from './common';
import { FullModelType, TypedDocument } from './mongoose-types';

// Kullanıcı
export interface IUser {
  username: string;
  email: string;
  password: string;
  displayName: string;
  avatar: string;
  status: UserStatus;
  role: UserRole;
  isVerified: boolean;
  verificationToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  lastActive: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserDocument extends TypedDocument<IUser> {
  // Metotlar
  comparePassword(candidatePassword: string): Promise<boolean>;
  generateAuthToken(): string;
  generateRefreshToken(): string;
}

export interface UserModel extends FullModelType<UserDocument> {
  findByUsername(username: string): Promise<UserDocument | null>;
  findByEmail(email: string): Promise<UserDocument | null>;
}

// Grup
export interface IGroup {
  name: string;
  description: string;
  icon: string;
  isPrivate: boolean;
  owner: Types.ObjectId | UserDocument;
  channels: Types.ObjectId[] | ChannelDocument[];
  categories: Types.ObjectId[] | CategoryDocument[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type GroupDocument = TypedDocument<IGroup>;

export interface GroupModel extends FullModelType<GroupDocument> {
  findByName(name: string): Promise<GroupDocument | null>;
}

// Grup üyeliği
export interface IGroupMember {
  user: Types.ObjectId | UserDocument;
  group: Types.ObjectId | GroupDocument;
  roles: Types.ObjectId[] | RoleDocument[];
  joinedAt: Date;
  lastActive: Date;
}

export type GroupMemberDocument = TypedDocument<IGroupMember>;

export interface GroupMemberModel extends FullModelType<GroupMemberDocument> {
  findByUserAndGroup(userId: ID, groupId: ID): Promise<GroupMemberDocument | null>;
}

// Rol
export interface IRole {
  name: string;
  color: string;
  permissions: string[];
  group: Types.ObjectId | GroupDocument;
  position: number;
  isDefault: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type RoleDocument = TypedDocument<IRole>;

export interface RoleModel extends FullModelType<RoleDocument> {
  findByNameAndGroup(name: string, groupId: ID): Promise<RoleDocument | null>;
}

// Kategori
export interface ICategory {
  name: string;
  position: number;
  group: Types.ObjectId | GroupDocument;
  channels: Types.ObjectId[] | ChannelDocument[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type CategoryDocument = TypedDocument<ICategory>;

export interface CategoryModel extends FullModelType<CategoryDocument> {
  findByNameAndGroup(name: string, groupId: ID): Promise<CategoryDocument | null>;
}

// Kanal
export interface IChannel {
  name: string;
  description: string;
  type: ChannelType;
  isPrivate: boolean;
  group: Types.ObjectId | GroupDocument;
  category?: Types.ObjectId | CategoryDocument;
  allowedUsers?: Types.ObjectId[] | UserDocument[];
  allowedRoles?: Types.ObjectId[] | RoleDocument[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type ChannelDocument = TypedDocument<IChannel>;

export interface ChannelModel extends FullModelType<ChannelDocument> {
  findByNameAndGroup(name: string, groupId: ID): Promise<ChannelDocument | null>;
}

// Mesaj
export interface MessageDocument extends Document {
  content: string;
  type: MessageType;
  channel: Types.ObjectId | ChannelDocument;
  author: Types.ObjectId | UserDocument;
  attachments: Types.ObjectId[] | FileAttachmentDocument[];
  mentions: Types.ObjectId[] | UserDocument[];
  reactions: Types.ObjectId[] | MessageReactionDocument[];
  replyTo?: Types.ObjectId | MessageDocument;
  isEdited: boolean;
  isPinned: boolean;
  readBy: Types.ObjectId[] | UserDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageModel extends FullModelType<MessageDocument> {
  findByChannel(channelId: ID, limit?: number, before?: Date): Promise<MessageDocument[]>;
}

// Direkt mesaj
export interface DirectMessageDocument extends Document {
  participants: Types.ObjectId[] | UserDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DirectMessageModel extends FullModelType<DirectMessageDocument> {
  findByParticipants(userIds: ID[]): Promise<DirectMessageDocument | null>;
}

// DM mesajı
export interface DmMessageDocument extends Document {
  content: string;
  type: MessageType;
  directMessage: Types.ObjectId | DirectMessageDocument;
  sender: Types.ObjectId | UserDocument;
  attachments: Types.ObjectId[] | FileAttachmentDocument[];
  mentions: Types.ObjectId[] | UserDocument[];
  reactions: Types.ObjectId[] | MessageReactionDocument[];
  replyTo?: Types.ObjectId | DmMessageDocument;
  isEdited: boolean;
  readBy: Types.ObjectId[] | UserDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DmMessageModel extends FullModelType<DmMessageDocument> {
  findByDirectMessage(dmId: ID, limit?: number, before?: Date): Promise<DmMessageDocument[]>;
}

// Dosya eki
export interface FileAttachmentDocument extends Document {
  filename: string;
  originalFilename: string;
  path: string;
  size: number;
  mimeType: string;
  type: FileType;
  url: string;
  thumbnailUrl?: string;
  uploader: Types.ObjectId | UserDocument;
  message?: Types.ObjectId | MessageDocument | DmMessageDocument;
  createdAt: Date;
}

export interface FileAttachmentModel extends FullModelType<FileAttachmentDocument> {
  findByUploader(userId: ID): Promise<FileAttachmentDocument[]>;
}

// Mesaj tepkisi
export interface MessageReactionDocument extends Document {
  emoji: string;
  message: Types.ObjectId | MessageDocument | DmMessageDocument;
  user: Types.ObjectId | UserDocument;
  createdAt: Date;
}

export interface MessageReactionModel extends FullModelType<MessageReactionDocument> {
  findByMessageAndUser(messageId: ID, userId: ID): Promise<MessageReactionDocument | null>;
}

// Bildirim
export interface NotificationDocument extends Document {
  type: NotificationTypes;
  title: string;
  content: string;
  recipient: Types.ObjectId | UserDocument;
  sender?: Types.ObjectId | UserDocument;
  target?: Types.ObjectId | any;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationModel extends FullModelType<NotificationDocument> {
  findByRecipient(userId: ID, limit?: number): Promise<NotificationDocument[]>;
}

// Arkadaşlık
export interface FriendshipDocument extends Document {
  users: [Types.ObjectId | UserDocument, Types.ObjectId | UserDocument];
  createdAt: Date;
}

export interface FriendshipModel extends FullModelType<FriendshipDocument> {
  findByUsers(user1Id: ID, user2Id: ID): Promise<FriendshipDocument | null>;
}

// Arkadaşlık isteği
export interface FriendRequestDocument extends Document {
  sender: Types.ObjectId | UserDocument;
  receiver: Types.ObjectId | UserDocument;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface FriendRequestModel extends FullModelType<FriendRequestDocument> {
  findBySenderAndReceiver(senderId: ID, receiverId: ID): Promise<FriendRequestDocument | null>;
}

// Davet
export interface InvitationDocument extends Document {
  email: string;
  group: Types.ObjectId | GroupDocument;
  inviter: Types.ObjectId | UserDocument;
  code: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface InvitationModel extends FullModelType<InvitationDocument> {
  findByCode(code: string): Promise<InvitationDocument | null>;
}

// Webhook
export interface WebhookDocument extends Document {
  name: string;
  url: string;
  events: string[];
  channel: Types.ObjectId | ChannelDocument;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookModel extends FullModelType<WebhookDocument> {
  findByChannel(channelId: ID): Promise<WebhookDocument[]>;
}

// Kullanıcı aktivitesi
export interface UserActivityDocument extends Document {
  user: Types.ObjectId | UserDocument;
  type: string;
  target?: Types.ObjectId | any;
  metadata?: any;
  timestamp: Date;
}

export interface UserActivityModel extends FullModelType<UserActivityDocument> {
  logActivity(data: {
    user: ID;
    type: string;
    target?: ID;
    metadata?: any;
  }): Promise<UserActivityDocument>;
  findByUser(userId: ID, limit?: number): Promise<UserActivityDocument[]>;
  findByType(type: string, limit?: number): Promise<UserActivityDocument[]>;
  findByTarget(targetId: ID, limit?: number): Promise<UserActivityDocument[]>;
}

// Şifre sıfırlama
export interface PasswordResetDocument extends Document {
  user: Types.ObjectId | UserDocument;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetModel extends FullModelType<PasswordResetDocument> {
  findByToken(token: string): Promise<PasswordResetDocument | null>;
}

// E-posta doğrulama
export interface EmailVerificationDocument extends Document {
  user: Types.ObjectId | UserDocument;
  token: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface EmailVerificationModel extends FullModelType<EmailVerificationDocument> {
  findByToken(token: string): Promise<EmailVerificationDocument | null>;
}

// Oturum
export interface SessionDocument extends Document {
  user: Types.ObjectId | UserDocument;
  token: string;
  device: string;
  ip: string;
  expiresAt: Date;
  lastActive: Date;
  createdAt: Date;
}

export interface SessionModel extends FullModelType<SessionDocument> {
  findByToken(token: string): Promise<SessionDocument | null>;
}

// Rapor
export interface ReportDocument extends Document {
  reporter: Types.ObjectId | UserDocument;
  reportedUser?: Types.ObjectId | UserDocument;
  reportedMessage?: Types.ObjectId | MessageDocument | DmMessageDocument;
  reportedGroup?: Types.ObjectId | GroupDocument;
  reason: string;
  status: 'pending' | 'resolved' | 'rejected';
  notes?: string;
  resolvedBy?: Types.ObjectId | UserDocument;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportModel extends FullModelType<ReportDocument> {
  findByStatus(status: string): Promise<ReportDocument[]>;
}

// Zamanlanmış mesaj
export interface ScheduledMessageDocument extends Document {
  content: string;
  type: MessageType;
  channel?: Types.ObjectId | ChannelDocument;
  directMessage?: Types.ObjectId | DirectMessageDocument;
  author: Types.ObjectId | UserDocument;
  scheduledFor: Date;
  isSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledMessageModel extends FullModelType<ScheduledMessageDocument> {
  findPendingMessages(): Promise<ScheduledMessageDocument[]>;
}
