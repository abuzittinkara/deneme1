/**
 * src/types/app.ts
 * Uygulama için tip tanımlamaları
 */

/**
 * Kullanıcı oturum bilgileri
 */
export interface UserSession {
  id: string;
  username: string;
  name: string;
  surname: string;
  email: string;
  status: 'online' | 'offline' | 'away' | 'busy';
  socketId: string | null;
  currentChannel: string | null;
  currentGroup: string | null;
  joinedAt: string;
  lastActivity: string;
  isTyping: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  micEnabled?: boolean;
  selfDeafened?: boolean;
  isScreenSharing?: boolean;
  screenShareProducerId?: string;
  settings: {
    theme: 'light' | 'dark';
    language: string;
    notifications: boolean;
    sounds: boolean;
  };
}

/**
 * Grup kullanıcısı
 */
export interface GroupUser {
  id: string | null;
  username: string;
}

/**
 * Bellek içi gruplar veri yapısı
 */
export interface MemoryGroups {
  [groupId: string]: {
    owner: string;
    name: string;
    users: GroupUser[];
    rooms: Record<
      string,
      {
        name: string;
        type: string;
        users: GroupUser[];
      }
    >;
  };
}

/**
 * Grup veri yapısı
 */
export interface GroupData {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  members: string[];
  channels: Record<string, ChannelData>;
  categories: string[];
  settings: {
    isPublic: boolean;
    joinRequiresApproval: boolean;
    allowInvites: boolean;
  };
  // Eski yapı için geriye uyumluluk
  owner?: string;
  users?: GroupUser[];
  rooms?: Record<string, RoomData>;
}

/**
 * Kanal verileri
 */
export interface ChannelData {
  id: string;
  name: string;
  type: 'text' | 'voice';
  description: string;
  groupId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  members: string[];
  messages: any[];
  settings: {
    isPrivate: boolean;
    allowReactions: boolean;
    allowThreads: boolean;
    allowAttachments: boolean;
  };
}

/**
 * Oda veri yapısı (eski yapı için geriye uyumluluk)
 */
export interface RoomData {
  name: string;
  type: 'voice' | 'text';
  users: GroupUser[];
}

/**
 * Mesaj verileri
 */
export interface MessageData {
  id: string;
  channelId: string;
  content: string;
  sender: {
    id: string;
    username: string;
  };
  timestamp: string;
  edited: boolean;
  reactions: {
    emoji: string;
    count: number;
    users: string[];
  }[];
  attachments: {
    id: string;
    type: 'image' | 'video' | 'audio' | 'file';
    url: string;
    name: string;
    size: number;
  }[];
  mentions: {
    type: 'user' | 'channel' | 'group';
    id: string;
  }[];
  replyTo: string | null;
}

/**
 * Uygulama durumu
 */
export interface AppState {
  users: Record<string, UserSession>;
  groups: Record<string, GroupData>;
  currentUser: string | null;
  currentGroup: string | null;
  currentChannel: string | null;
}

/**
 * Arkadaşlık isteği
 */
export interface FriendRequest {
  from: string;
  timestamp: number;
}
