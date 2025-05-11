/**
 * src/types/common.ts
 * Genel tip tanımlamaları
 */

// Temel ID tipi
export type ID = string;

// Kullanıcı durumu
export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  DND = 'busy',
  INVISIBLE = 'invisible',
}

// Kullanıcı rolü
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  GUEST = 'guest',
  MEMBER = 'member',
  OWNER = 'owner',
}

// Kanal tipi
export type ChannelType = 'text' | 'voice' | 'video' | 'announcement' | 'forum';

// Mesaj tipi
export type MessageType = 'text' | 'image' | 'video' | 'file' | 'system' | 'rich';

// Bildirim tipi
export enum NotificationTypes {
  MESSAGE = 'message',
  MENTION = 'mention',
  FRIEND_REQUEST = 'friend_request',
  FRIEND_ACCEPT = 'friend_accept',
  GROUP_INVITE = 'group_invite',
  GROUP_JOIN = 'group_join',
  SYSTEM = 'system',
}

// Arkadaşlık durumu
export enum FriendshipStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  BLOCKED = 'blocked',
}

// Bildirim önceliği
export type NotificationPriority = 'low' | 'medium' | 'high';

// Dosya tipi
export type FileType = 'image' | 'video' | 'audio' | 'document' | 'other';

// Hata kodu
export type ErrorCode =
  | 'AUTH_ERROR'
  | 'PERMISSION_ERROR'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR';

// Sayfalama seçenekleri
export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Sayfalama sonucu
export interface PaginationResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Filtreleme seçenekleri
export interface FilterOptions {
  [key: string]: any;
}

// Arama seçenekleri
export interface SearchOptions {
  query: string;
  fields: string[];
  exact?: boolean;
  caseSensitive?: boolean;
}

// Sıralama seçenekleri
export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

// Yanıt formatı
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
  meta?: {
    pagination?: {
      total: number;
      page: number;
      limit: number;
      pages: number;
    };
    timestamp: number;
  };
}

// Genel hata
export class AppError extends Error {
  code: ErrorCode;
  details?: any;

  constructor(message: string, code: ErrorCode = 'SERVER_ERROR', details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}
