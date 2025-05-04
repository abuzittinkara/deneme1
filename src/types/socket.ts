/**
 * src/types/socket.ts
 * Socket.IO olay tipleri
 */

import { ID, UserStatus, MessageType } from './common';
import { UserResponse, MessageResponse, ChannelResponse, GroupResponse } from './api';
import { Server, Socket } from 'socket.io';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import { UserSession, GroupUser } from './app';
import { TokenPayload } from '../config/jwt';
import { JwtPayload } from '../utils/jwt';

// Socket.IO bağlantı olayları
export interface ConnectionEvent {
  userId: ID;
  username: string;
}

export interface DisconnectionEvent {
  userId: ID;
  username: string;
}

// Kullanıcı olayları
export interface UserStatusEvent {
  userId: ID;
  username: string;
  status: UserStatus;
}

export interface UserTypingEvent {
  userId: ID;
  username: string;
  channelId: ID;
  isTyping: boolean;
}

export interface UserOnlineEvent {
  [userId: string]: string; // userId -> username
}

// Mesaj olayları
export interface MessageCreateEvent {
  message: MessageResponse;
}

export interface MessageUpdateEvent {
  messageId: ID;
  content: string;
  updatedAt: string;
}

export interface MessageDeleteEvent {
  messageId: ID;
  channelId: ID;
}

export interface MessageReadEvent {
  messageId: ID;
  userId: ID;
  username: string;
}

export interface MessageReactionEvent {
  messageId: ID;
  userId: ID;
  username: string;
  emoji: string;
}

// Kanal olayları
export interface ChannelCreateEvent {
  channel: ChannelResponse;
}

export interface ChannelUpdateEvent {
  channelId: ID;
  name?: string;
  description?: string;
  isPrivate?: boolean;
}

export interface ChannelDeleteEvent {
  channelId: ID;
  groupId: ID;
}

// Grup olayları
export interface GroupCreateEvent {
  group: GroupResponse;
}

export interface GroupUpdateEvent {
  groupId: ID;
  name?: string;
  description?: string;
  icon?: string;
  isPrivate?: boolean;
}

export interface GroupDeleteEvent {
  groupId: ID;
}

// Üyelik olayları
export interface MemberJoinEvent {
  groupId: ID;
  user: UserResponse;
}

export interface MemberLeaveEvent {
  groupId: ID;
  userId: ID;
}

export interface MemberKickEvent {
  groupId: ID;
  userId: ID;
  kickedBy: UserResponse;
}

export interface MemberBanEvent {
  groupId: ID;
  userId: ID;
  bannedBy: UserResponse;
  reason?: string;
}

// Arkadaşlık olayları
export interface FriendRequestEvent {
  senderId: ID;
  senderUsername: string;
  receiverId: ID;
}

export interface FriendAcceptEvent {
  senderId: ID;
  receiverId: ID;
}

// Bildirim olayları
export interface NotificationEvent {
  userId: ID;
  title: string;
  content: string;
  type: string;
  data?: any;
}

// Hata olayları
export interface ErrorEvent {
  message: string;
  code: string;
}

/**
 * Soket veri yapısı
 */
export interface SocketData {
  userId: string;
  username: string;
  authenticated: boolean;
  currentRoom?: string;
  currentGroup?: string;
  micEnabled?: boolean;
  selfDeafened?: boolean;
  isScreenSharing?: boolean;
  screenShareProducerId?: string;
  user?: TokenPayload;
}

/**
 * Tip güvenli soket ve sunucu
 */
export type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;
export type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, DefaultEventsMap, SocketData>;

/**
 * Kimlik doğrulama ile genişletilmiş socket arayüzü
 */
export interface AuthenticatedSocket extends Socket {
  user: TokenPayload & JwtPayload;
  userData: {
    username: string;
    userId: string;
    currentGroup?: string | null;
    currentRoom?: string | null;
    micEnabled?: boolean;
    selfDeafened?: boolean;
    isScreenSharing?: boolean;
    screenShareProducerId?: string;
  };
}

/**
 * Sunucular arası olaylar
 */
export interface InterServerEvents {
  ping: () => void;
}

// Sesli/görüntülü görüşme olayları
export interface CallStartEvent {
  callId: ID;
  channelId: ID;
  initiator: UserResponse;
  participants: UserResponse[];
}

export interface CallJoinEvent {
  callId: ID;
  user: UserResponse;
}

export interface CallLeaveEvent {
  callId: ID;
  userId: ID;
}

export interface CallEndEvent {
  callId: ID;
}

// Socket.IO istemci olayları
export interface ClientToServerEvents {
  // Bağlantı olayları
  disconnect: () => void;

  // Kimlik doğrulama olayları
  authenticate: (token: string, callback: (error?: any, data?: any) => void) => void;

  // Kullanıcı olayları
  'user:status': (data: { status: UserStatus }) => void;
  typing: (data: { channelId: ID, isTyping: boolean }) => void;
  toggleMic: (enabled: boolean, callback: (error?: any, data?: any) => void) => void;
  toggleDeafen: (deafened: boolean, callback: (error?: any, data?: any) => void) => void;
  startScreenShare: (callback: (error?: any, data?: any) => void) => void;
  stopScreenShare: (callback: (error?: any, data?: any) => void) => void;

  // Mesaj olayları
  'message:send': (data: { content: string, channelId: ID, type?: MessageType, attachments?: string[] }) => void;
  'message:edit': (data: { messageId: ID, content: string }) => void;
  'message:delete': (data: { messageId: ID }) => void;
  'message:read': (data: { messageId: ID, channelId: ID }) => void;
  'message:reaction': (data: { messageId: ID, emoji: string }) => void;
  sendMessage: (data: { channelId: string; message: string }, callback: (error?: any, data?: any) => void) => void;
  deleteMessage: (data: { messageId: string }, callback: (error?: any, data?: any) => void) => void;
  editMessage: (data: { messageId: string; content: string }, callback: (error?: any, data?: any) => void) => void;

  // Kanal olayları
  'channel:join': (data: { channelId: ID }) => void;
  'channel:leave': (data: { channelId: ID }) => void;
  joinRoom: (groupId: string, roomId: string, callback: (error?: any, data?: any) => void) => void;
  leaveRoom: (callback: (error?: any) => void) => void;
  createRoom: (groupId: string, roomName: string, roomType: string, callback: (error?: any, data?: any) => void) => void;

  // Grup olayları
  'group:join': (data: { groupId: ID }) => void;
  'group:leave': (data: { groupId: ID }) => void;
  joinGroup: (groupId: string, callback: (error?: any, data?: any) => void) => void;
  leaveGroup: (callback: (error?: any) => void) => void;
  createGroup: (groupName: string, callback: (error?: any, data?: any) => void) => void;

  // Arkadaşlık olayları
  'friend:request': (data: { receiverId: string }) => void;
  'friend:accept': (data: { senderId: string }) => void;
  'friend:reject': (data: { senderId: string }) => void;
  'friend:remove': (data: { friendId: string }) => void;
  sendFriendRequest: (username: string, callback: (error?: any, data?: any) => void) => void;
  acceptFriendRequest: (username: string, callback: (error?: any, data?: any) => void) => void;
  rejectFriendRequest: (username: string, callback: (error?: any, data?: any) => void) => void;

  // DM olayları
  sendDM: (data: { to: string; message: string }, callback: (error?: any, data?: any) => void) => void;

  // Sesli/görüntülü görüşme olayları
  'call:start': (data: { channelId: ID }) => void;
  'call:join': (data: { callId: ID }) => void;
  'call:leave': (data: { callId: ID }) => void;
  'call:end': (data: { callId: ID }) => void;

  // Hata olayları
  error: (error: any) => void;
}

// Socket.IO sunucu olayları
export interface ServerToClientEvents {
  // Genel olaylar
  error: (error: ErrorEvent) => void;
  success: (data: { message: string; data?: any }) => void;

  // Bağlantı olayları
  'user:connect': (data: ConnectionEvent) => void;
  'user:disconnect': (data: DisconnectionEvent) => void;
  'users:online': (data: UserOnlineEvent) => void;
  userConnected: (data: { username: string; userId: string }) => void;
  userDisconnected: (data: { username: string; userId: string }) => void;
  'auth:success': (data: { userId: string; username: string; message: string }) => void;
  'auth:error': (data: { message: string; code: string }) => void;

  // Kullanıcı olayları
  'user:status': (data: UserStatusEvent) => void;
  'user:typing': (data: UserTypingEvent) => void;
  userStatusChanged: (data: { username: string; status: string; customStatus?: string }) => void;

  // Mesaj olayları
  'message:new': (data: MessageCreateEvent) => void;
  'message:update': (data: MessageUpdateEvent) => void;
  'message:delete': (data: MessageDeleteEvent) => void;
  'message:read': (data: MessageReadEvent) => void;
  'message:reaction': (data: MessageReactionEvent) => void;
  message: (message: any) => void;
  messageDeleted: (data: { messageId: string; channelId: string }) => void;
  messageEdited: (data: { messageId: string; channelId: string; content: string }) => void;

  // Kanal olayları
  'channel:create': (data: ChannelCreateEvent) => void;
  'channel:update': (data: ChannelUpdateEvent) => void;
  'channel:delete': (data: ChannelDeleteEvent) => void;
  roomsList: (rooms: Array<{ id: string; name: string; type: string }>) => void;
  roomUsers: (users: Array<{ id: string; username: string }>) => void;

  // Grup olayları
  'group:create': (data: GroupCreateEvent) => void;
  'group:update': (data: GroupUpdateEvent) => void;
  'group:delete': (data: GroupDeleteEvent) => void;
  groupsList: (groups: Array<{ id: string; name: string; owner: string }>) => void;
  groupUsers: (data: { online: Array<{ username: string }>; offline: Array<{ username: string }> }) => void;

  // Üyelik olayları
  'member:join': (data: MemberJoinEvent) => void;
  'member:leave': (data: MemberLeaveEvent) => void;
  'member:kick': (data: MemberKickEvent) => void;
  'member:ban': (data: MemberBanEvent) => void;

  // Arkadaşlık olayları
  'friend:request': (data: FriendRequestEvent) => void;
  'friend:accept': (data: FriendAcceptEvent) => void;
  'friend:reject': (data: { senderId: string, receiverId: string }) => void;
  'friend:remove': (data: { userId: string, friendId: string }) => void;
  friendRequest: (data: { from: string; timestamp: Date }) => void;
  friendRequestAccepted: (data: { username: string }) => void;
  friendRequestRejected: (data: { username: string }) => void;

  // DM olayları
  directMessage: (message: any) => void;

  // Bildirim olayları
  notification: (data: NotificationEvent | { type: string; message: string; data?: any }) => void;

  // Sesli/görüntülü görüşme olayları
  'call:start': (data: CallStartEvent) => void;
  'call:join': (data: CallJoinEvent) => void;
  'call:leave': (data: CallLeaveEvent) => void;
  'call:end': (data: CallEndEvent) => void;
}
