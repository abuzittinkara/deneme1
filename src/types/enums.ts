/**
 * src/types/enums.ts
 * Uygulama genelinde kullanılan enum tanımlamaları
 */

/**
 * Kullanıcı durumu
 */
export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  IDLE = 'idle',
  DND = 'dnd',
  INVISIBLE = 'invisible'
}

/**
 * Kullanıcı rolü
 */
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user'
}

/**
 * Kanal tipi
 */
export enum ChannelType {
  TEXT = 'text',
  VOICE = 'voice',
  CATEGORY = 'category'
}

/**
 * Rol izinleri
 */
export enum Permission {
  ADMINISTRATOR = 'administrator',
  MANAGE_GROUP = 'manageGroup',
  MANAGE_CHANNELS = 'manageChannels',
  MANAGE_ROLES = 'manageRoles',
  MANAGE_MESSAGES = 'manageMessages',
  KICK_MEMBERS = 'kickMembers',
  BAN_MEMBERS = 'banMembers',
  CREATE_INVITE = 'createInvite',
  SEND_MESSAGES = 'sendMessages',
  READ_MESSAGES = 'readMessages',
  ATTACH_FILES = 'attachFiles',
  CONNECT = 'connect',
  SPEAK = 'speak',
  USE_VOICE_ACTIVITY = 'useVoiceActivity',
  PRIORITY_SPEAKER = 'prioritySpeaker'
}

/**
 * Bildirim türleri
 */
export enum NotificationType {
  DIRECT_MESSAGES = 'directMessages',
  MENTIONS = 'mentions',
  FRIEND_REQUESTS = 'friendRequests',
  GROUP_INVITES = 'groupInvites',
  CHANNEL_MESSAGES = 'channelMessages',
  SYSTEM = 'system',
  MESSAGE = 'message'
}
