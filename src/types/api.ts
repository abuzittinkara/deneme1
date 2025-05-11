/**
 * src/types/api.ts
 * API istek/yanıt tipleri
 */

import {
  ID,
  UserRole,
  UserStatus,
  ChannelType,
  MessageType,
  NotificationTypes,
  FriendshipStatus,
} from './common';

/**
 * API yanıtı için temel arayüz
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  code?: string;
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Başarılı API yanıtı oluşturur
 * @param data - Yanıt verisi
 * @param message - İsteğe bağlı mesaj
 * @returns Başarılı API yanıtı
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
  };
}

/**
 * Hata API yanıtı oluşturur
 * @param message - Hata mesajı
 * @param code - İsteğe bağlı hata kodu
 * @param errors - İsteğe bağlı detaylı hatalar
 * @returns Hata API yanıtı
 */
export function createErrorResponse(
  message: string,
  code?: string,
  errors?: ApiResponse['errors']
): ApiResponse {
  return {
    success: false,
    message,
    code,
    errors,
  };
}

// Kullanıcı
export interface UserRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
  avatar?: string;
}

export interface UserResponse {
  id: ID;
  username: string;
  email: string;
  displayName: string;
  avatar: string;
  status: UserStatus;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// Kimlik doğrulama
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  user: UserResponse;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

// Grup
export interface GroupRequest {
  name: string;
  description?: string;
  icon?: string;
  isPrivate?: boolean;
}

export interface GroupResponse {
  id: ID;
  name: string;
  description: string;
  icon: string;
  isPrivate: boolean;
  owner: UserResponse;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

// Kanal
export interface ChannelRequest {
  name: string;
  description?: string;
  type: ChannelType;
  isPrivate?: boolean;
  groupId: ID;
  categoryId?: ID;
}

export interface ChannelResponse {
  id: ID;
  name: string;
  description: string;
  type: ChannelType;
  isPrivate: boolean;
  group: GroupResponse;
  category?: CategoryResponse;
  createdAt: string;
  updatedAt: string;
}

// Kategori
export interface CategoryRequest {
  name: string;
  position?: number;
  groupId: ID;
}

export interface CategoryResponse {
  id: ID;
  name: string;
  position: number;
  group: GroupResponse;
  createdAt: string;
  updatedAt: string;
}

// Mesaj
export interface MessageRequest {
  content: string;
  type?: MessageType;
  channelId: ID;
  attachments?: string[];
}

export interface MessageResponse {
  id: ID;
  content: string;
  type: MessageType;
  channel: ChannelResponse;
  author: UserResponse;
  attachments: AttachmentResponse[];
  mentions: UserResponse[];
  reactions: ReactionResponse[];
  replyTo?: MessageResponse;
  isEdited: boolean;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

// Ek dosya
export interface AttachmentResponse {
  id: ID;
  filename: string;
  originalFilename: string;
  size: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  createdAt: string;
}

// Tepki
export interface ReactionRequest {
  emoji: string;
  messageId: ID;
}

export interface ReactionResponse {
  id: ID;
  emoji: string;
  message: MessageResponse;
  user: UserResponse;
  createdAt: string;
}

// Bildirim
export interface NotificationResponse {
  id: ID;
  type: NotificationTypes;
  title: string;
  content: string;
  isRead: boolean;
  sender?: UserResponse;
  target?: any;
  createdAt: string;
}

// Arkadaşlık isteği
export interface FriendRequestRequest {
  receiverId: ID;
}

export interface FriendRequestResponse {
  id: ID;
  sender: UserResponse;
  receiver: UserResponse;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

// Arkadaşlık
export interface FriendshipResponse {
  id: ID;
  user: UserResponse;
  status: FriendshipStatus;
  createdAt: string;
  updatedAt: string;
}

// Davet
export interface InvitationRequest {
  email: string;
  groupId: ID;
}

export interface InvitationResponse {
  id: ID;
  email: string;
  group: GroupResponse;
  inviter: UserResponse;
  code: string;
  expiresAt: string;
  createdAt: string;
}

// Webhook
export interface WebhookRequest {
  name: string;
  url: string;
  events: string[];
  channelId: ID;
  isActive?: boolean;
}

export interface WebhookResponse {
  id: ID;
  name: string;
  url: string;
  events: string[];
  channel: ChannelResponse;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
