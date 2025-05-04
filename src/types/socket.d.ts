/**
 * src/types/socket.d.ts
 * Socket.IO için özel tip tanımlamaları
 */
import { Socket } from 'socket.io';
import { TokenPayload } from '../config/jwt';
import { JwtPayload } from '../utils/jwt';

// Socket.IO için kullanıcı verisi arayüzü
export interface SocketUserData {
  username: string;
  userId: string;
  currentGroup?: string | null;
  currentRoom?: string | null;
  micEnabled?: boolean;
  selfDeafened?: boolean;
  isScreenSharing?: boolean;
  screenShareProducerId?: string;
}

// Kimlik doğrulama ile genişletilmiş socket arayüzü
export interface AuthenticatedSocket extends Socket {
  user: TokenPayload & JwtPayload;
  userData: SocketUserData;
}

// Socket.IO olayları için tip tanımlamaları
export interface ServerToClientEvents {
  // Genel olaylar
  error: (error: { message: string; code?: string }) => void;
  success: (data: { message: string; data?: any }) => void;

  // Kullanıcı olayları
  userConnected: (data: { username: string; userId: string }) => void;
  userDisconnected: (data: { username: string; userId: string }) => void;
  userStatusChanged: (data: { username: string; status: string; customStatus?: string }) => void;

  // Grup olayları
  groupsList: (groups: Array<{ id: string; name: string; owner: string }>) => void;
  groupUsers: (data: { online: Array<{ username: string }>; offline: Array<{ username: string }> }) => void;

  // Kanal olayları
  roomsList: (rooms: Array<{ id: string; name: string; type: string }>) => void;
  roomUsers: (users: Array<{ id: string; username: string }>) => void;

  // Mesaj olayları
  message: (message: any) => void;
  messageDeleted: (data: { messageId: string; channelId: string }) => void;
  messageEdited: (data: { messageId: string; channelId: string; content: string }) => void;

  // DM olayları
  directMessage: (message: any) => void;

  // Arkadaşlık olayları
  friendRequest: (data: { from: string; timestamp: Date }) => void;
  friendRequestAccepted: (data: { username: string }) => void;
  friendRequestRejected: (data: { username: string }) => void;

  // Bildirim olayları
  notification: (data: { type: string; message: string; data?: any }) => void;
}

export interface ClientToServerEvents {
  // Kimlik doğrulama olayları
  authenticate: (token: string, callback: (error?: any, data?: any) => void) => void;

  // Grup olayları
  joinGroup: (groupId: string, callback: (error?: any, data?: any) => void) => void;
  leaveGroup: (callback: (error?: any) => void) => void;
  createGroup: (groupName: string, callback: (error?: any, data?: any) => void) => void;

  // Kanal olayları
  joinRoom: (groupId: string, roomId: string, callback: (error?: any, data?: any) => void) => void;
  leaveRoom: (callback: (error?: any) => void) => void;
  createRoom: (groupId: string, roomName: string, roomType: string, callback: (error?: any, data?: any) => void) => void;

  // Mesaj olayları
  sendMessage: (data: { channelId: string; message: string }, callback: (error?: any, data?: any) => void) => void;
  deleteMessage: (data: { messageId: string }, callback: (error?: any, data?: any) => void) => void;
  editMessage: (data: { messageId: string; content: string }, callback: (error?: any, data?: any) => void) => void;

  // DM olayları
  sendDM: (data: { to: string; message: string }, callback: (error?: any, data?: any) => void) => void;

  // Arkadaşlık olayları
  sendFriendRequest: (username: string, callback: (error?: any, data?: any) => void) => void;
  acceptFriendRequest: (username: string, callback: (error?: any, data?: any) => void) => void;
  rejectFriendRequest: (username: string, callback: (error?: any, data?: any) => void) => void;

  // Ses olayları
  toggleMic: (enabled: boolean, callback: (error?: any, data?: any) => void) => void;
  toggleDeafen: (deafened: boolean, callback: (error?: any, data?: any) => void) => void;
  startScreenShare: (callback: (error?: any, data?: any) => void) => void;
  stopScreenShare: (callback: (error?: any, data?: any) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  user?: TokenPayload & JwtPayload;
  userData?: SocketUserData;
}
