/**
 * Socket.io tipi tanımlamaları
 */

import { Socket as SocketIOClient } from 'socket.io-client';
import { 
  NotificationSettings, 
  UserStatus, 
  Channel, 
  Message, 
  DirectMessage,
  User,
  Group,
  Role,
  Category,
  Favorite,
  Report,
  Session
} from './index';

// Socket yanıt tipleri
export interface SocketResponse {
  success: boolean;
  message?: string;
}

export interface ProfileResponse extends SocketResponse {
  profile?: User;
}

export interface ChannelResponse extends SocketResponse {
  channel?: Channel;
  channels?: Channel[];
}

export interface MessageResponse extends SocketResponse {
  message?: Message;
  messages?: Message[];
}

export interface DirectMessageResponse extends SocketResponse {
  message?: DirectMessage;
  messages?: DirectMessage[];
}

export interface GroupResponse extends SocketResponse {
  group?: Group;
  groups?: Group[];
}

export interface RoleResponse extends SocketResponse {
  role?: Role;
  roles?: Role[];
}

export interface CategoryResponse extends SocketResponse {
  category?: Category;
  categories?: Category[];
}

export interface FavoriteResponse extends SocketResponse {
  favorite?: Favorite;
  favorites?: Favorite[];
  isFavorite?: boolean;
}

export interface ReportResponse extends SocketResponse {
  report?: Report;
  reports?: Report[];
}

export interface SessionResponse extends SocketResponse {
  session?: Session;
  sessions?: Session[];
}

export interface UserResponse extends SocketResponse {
  user?: User;
  users?: User[];
}

// Socket veri tipleri
export interface MessageData {
  content: string;
  channelId: string;
  attachments?: string[];
  mentions?: string[];
  quotedMessageId?: string;
}

export interface DirectMessageData {
  content: string;
  recipient: string;
  attachments?: string[];
}

export interface TypingData {
  channelId: string;
  isTyping: boolean;
}

export interface DMTypingData {
  recipient: string;
  isTyping: boolean;
}

export interface ReadReceiptData {
  messageId: string;
  channelId: string;
}

export interface DMReadReceiptData {
  messageId: string;
  friendUsername: string;
}

export interface ReactionData {
  messageId: string;
  emoji: string;
}

export interface PinMessageData {
  messageId: string;
  channelId: string;
  isPinned: boolean;
}

export interface UserStatusData {
  status: UserStatus;
  customStatus?: string;
}

export interface NotificationSettingsData {
  settings: NotificationSettings;
}

// Socket tipi
export interface AppSocket extends SocketIOClient {
  emit<T extends SocketResponse>(
    event: string, 
    data: any, 
    callback?: (response: T) => void
  ): this;
  
  on(
    event: string, 
    callback: (data: any) => void
  ): this;
}
