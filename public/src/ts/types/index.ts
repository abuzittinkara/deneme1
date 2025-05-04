/**
 * public/src/ts/types/index.ts
 * Ortak tip tanımlamaları
 */

// CustomEvent için tip tanımlamaları
export interface ChannelChangedEvent extends CustomEvent<{
  newChannel: string;
  channelType: string;
  groupId: string;
  channelId: string;
}> {}

export interface DMSelectedEvent extends CustomEvent<{
  friend: string;
  userId: string;
}> {}

export interface NotificationSettingsChangedEvent extends CustomEvent<{
  settings: NotificationSettings;
}> {}

export interface ThemeSettingsChangedEvent extends CustomEvent<{
  theme: string;
}> {}

export interface LanguageSettingsChangedEvent extends CustomEvent<{
  language: string;
}> {}

export interface UserContextMenuCreatedEvent extends CustomEvent<{
  username: string;
  x: number;
  y: number;
  menu: HTMLElement;
  user: User;
}> {}

export interface ChannelContextMenuCreatedEvent extends CustomEvent<{
  channelId: string;
  channelType: string;
  x: number;
  y: number;
  menu: HTMLElement;
  roomObj: Channel;
}> {}

// Bildirim ayarları
export interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  desktop: boolean;
  mentions: boolean;
  directMessages: boolean;
  groupMessages: boolean;
}

// Toast tipleri
export type ToastType = 'success' | 'error' | 'warning' | 'info';

// Kullanıcı durumu
export type UserStatus = 'online' | 'away' | 'dnd' | 'offline';

// Kanal tipi
export type ChannelType = 'text' | 'voice';

// Mesaj
export interface Message {
  id: string;
  content: string;
  sender: string;
  timestamp: string;
  isEdited?: boolean;
  isPinned?: boolean;
  attachments?: Attachment[];
  reactions?: MessageReaction[];
}

// Mesaj tepkisi
export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
}

// Dosya eki
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

// Kanal
export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  description?: string;
  position?: number;
  categoryId?: string | null;
}

// Grup
export interface Group {
  id: string;
  name: string;
  owner: string;
  description?: string;
  icon?: string;
  members?: string[];
}

// Kullanıcı
export interface User {
  username: string;
  displayName?: string;
  avatar?: string;
  status: UserStatus;
  customStatus?: string;
}

// Favoriler
export interface Favorite {
  itemId: string;
  type: 'channel' | 'user' | 'group';
  name: string;
  groupId?: string;
}

// İpucu
export interface Tip {
  id: string;
  title: string;
  content: string;
  category: string;
  showOnce: boolean;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

// Rol
export interface Role {
  id: string;
  name: string;
  color: string;
  position: number;
  permissions: RolePermissions;
}

// Rol izinleri
export interface RolePermissions {
  [key: string]: boolean;
  administrator: boolean;
  manageChannels: boolean;
  manageRoles: boolean;
  manageMessages: boolean;
  kickMembers: boolean;
  banMembers: boolean;
}

// Oturum
export interface Session {
  _id: string;
  loginTime: string;
  ipAddress: string;
  deviceInfo: DeviceInfo;
}

// Cihaz bilgisi
export interface DeviceInfo {
  browser: string;
  os: string;
  device: string;
  type: string;
}

// Arama sonucu
export interface SearchResult {
  id: string;
  title: string;
  type: 'section' | 'card' | 'content' | 'faq';
  element?: HTMLElement;
}

// Socket.io socket arayüzü - Daha detaylı tanım için socket.ts dosyasına bakın
export interface Socket {
  emit: <T>(event: string, data: unknown, callback?: (response: T) => void) => void;
  on: <T>(event: string, callback: (data: T) => void) => void;
}

// Transport arayüzü
export interface Transport {
  id: string;
  produce: (options: ProduceOptions) => Promise<Producer>;
}

// Producer arayüzü
export interface Producer {
  id: string;
  kind: string;
  close: () => void;
}

// ProduceOptions arayüzü
export interface ProduceOptions {
  track: MediaStreamTrack;
  stopTracks?: boolean;
  appData?: Record<string, unknown>;
}

// Declare global window extensions
declare global {
  interface WindowEventMap {
    'channelChanged': ChannelChangedEvent;
    'dmSelected': DMSelectedEvent;
    'notificationSettingsChanged': NotificationSettingsChangedEvent;
    'themeSettingsChanged': ThemeSettingsChangedEvent;
    'languageSettingsChanged': LanguageSettingsChangedEvent;
    'userContextMenuCreated': UserContextMenuCreatedEvent;
    'channelContextMenuCreated': ChannelContextMenuCreatedEvent;
  }
}
