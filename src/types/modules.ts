/**
 * src/types/modules.ts
 * Modül fonksiyon ve parametre tipleri
 */

import { Server } from 'socket.io';
import { ID, UserStatus, ChannelType, MessageType, PaginationOptions, FilterOptions, SearchOptions, SortOptions } from './common';
import { 
  UserDocument, GroupDocument, ChannelDocument, MessageDocument, 
  DirectMessageDocument, DmMessageDocument, FileAttachmentDocument,
  NotificationDocument, FriendRequestDocument, InvitationDocument,
  WebhookDocument, UserActivityDocument, ReportDocument, ScheduledMessageDocument
} from './models';

// Kullanıcı yönetimi
export interface UserManagerDependencies {
  // Bağımlılıklar
}

export interface UserManager {
  // Kullanıcı oluşturma
  createUser(userData: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
    avatar?: string;
  }): Promise<UserDocument>;
  
  // Kullanıcı bulma
  getUserById(userId: ID): Promise<UserDocument | null>;
  getUserByUsername(username: string): Promise<UserDocument | null>;
  getUserByEmail(email: string): Promise<UserDocument | null>;
  
  // Kullanıcı güncelleme
  updateUser(userId: ID, userData: {
    displayName?: string;
    avatar?: string;
    status?: UserStatus;
    email?: string;
  }): Promise<UserDocument | null>;
  
  // Kullanıcı silme
  deleteUser(userId: ID): Promise<boolean>;
  
  // Kullanıcı durumu
  updateUserStatus(userId: ID, status: UserStatus): Promise<UserDocument | null>;
  
  // Kullanıcı arama
  searchUsers(query: string, options?: SearchOptions): Promise<UserDocument[]>;
  
  // Kullanıcı doğrulama
  verifyUser(userId: ID): Promise<UserDocument | null>;
  
  // Şifre işlemleri
  changePassword(userId: ID, oldPassword: string, newPassword: string): Promise<boolean>;
  resetPassword(userId: ID, token: string, newPassword: string): Promise<boolean>;
}

// Grup yönetimi
export interface GroupManagerDependencies {
  // Bağımlılıklar
}

export interface GroupManager {
  // Grup oluşturma
  createGroup(ownerId: ID, groupData: {
    name: string;
    description?: string;
    icon?: string;
    isPrivate?: boolean;
  }): Promise<GroupDocument>;
  
  // Grup bulma
  getGroupById(groupId: ID): Promise<GroupDocument | null>;
  getGroupByName(name: string): Promise<GroupDocument | null>;
  getUserGroups(userId: ID): Promise<GroupDocument[]>;
  
  // Grup güncelleme
  updateGroup(groupId: ID, groupData: {
    name?: string;
    description?: string;
    icon?: string;
    isPrivate?: boolean;
  }): Promise<GroupDocument | null>;
  
  // Grup silme
  deleteGroup(groupId: ID): Promise<boolean>;
  
  // Grup üyeliği
  addMember(groupId: ID, userId: ID, roleIds?: ID[]): Promise<boolean>;
  removeMember(groupId: ID, userId: ID): Promise<boolean>;
  
  // Grup arama
  searchGroups(query: string, options?: SearchOptions): Promise<GroupDocument[]>;
}

// Kanal yönetimi
export interface ChannelManagerDependencies {
  // Bağımlılıklar
}

export interface ChannelManager {
  // Kanal oluşturma
  createChannel(groupId: ID, channelData: {
    name: string;
    description?: string;
    type: ChannelType;
    isPrivate?: boolean;
    categoryId?: ID;
  }): Promise<ChannelDocument>;
  
  // Kanal bulma
  getChannelById(channelId: ID): Promise<ChannelDocument | null>;
  getChannelByName(groupId: ID, name: string): Promise<ChannelDocument | null>;
  getGroupChannels(groupId: ID): Promise<ChannelDocument[]>;
  
  // Kanal güncelleme
  updateChannel(channelId: ID, channelData: {
    name?: string;
    description?: string;
    isPrivate?: boolean;
    categoryId?: ID;
  }): Promise<ChannelDocument | null>;
  
  // Kanal silme
  deleteChannel(channelId: ID): Promise<boolean>;
  
  // Kanal izinleri
  addAllowedUser(channelId: ID, userId: ID): Promise<boolean>;
  removeAllowedUser(channelId: ID, userId: ID): Promise<boolean>;
  addAllowedRole(channelId: ID, roleId: ID): Promise<boolean>;
  removeAllowedRole(channelId: ID, roleId: ID): Promise<boolean>;
}

// Mesaj yönetimi
export interface MessageManagerDependencies {
  // Bağımlılıklar
}

export interface MessageManager {
  // Mesaj oluşturma
  createMessage(channelId: ID, userId: ID, messageData: {
    content: string;
    type?: MessageType;
    attachments?: string[];
    replyToId?: ID;
  }): Promise<MessageDocument>;
  
  // Mesaj bulma
  getMessageById(messageId: ID): Promise<MessageDocument | null>;
  getChannelMessages(channelId: ID, options?: PaginationOptions): Promise<MessageDocument[]>;
  
  // Mesaj güncelleme
  updateMessage(messageId: ID, userId: ID, content: string): Promise<MessageDocument | null>;
  
  // Mesaj silme
  deleteMessage(messageId: ID, userId: ID): Promise<boolean>;
  
  // Mesaj işlemleri
  pinMessage(messageId: ID, userId: ID): Promise<boolean>;
  unpinMessage(messageId: ID, userId: ID): Promise<boolean>;
  markMessageAsRead(messageId: ID, userId: ID): Promise<boolean>;
  
  // Mesaj tepkileri
  addReaction(messageId: ID, userId: ID, emoji: string): Promise<boolean>;
  removeReaction(messageId: ID, userId: ID, emoji: string): Promise<boolean>;
  
  // Mesaj arama
  searchMessages(query: string, options?: SearchOptions): Promise<MessageDocument[]>;
}

// DM yönetimi
export interface DmManagerDependencies {
  // Bağımlılıklar
}

export interface DmManager {
  // DM oluşturma
  createDM(userIds: ID[]): Promise<DirectMessageDocument>;
  
  // DM bulma
  getDMById(dmId: ID): Promise<DirectMessageDocument | null>;
  getUserDMs(userId: ID): Promise<DirectMessageDocument[]>;
  
  // DM mesajı oluşturma
  createDMMessage(dmId: ID, userId: ID, messageData: {
    content: string;
    type?: MessageType;
    attachments?: string[];
    replyToId?: ID;
  }): Promise<DmMessageDocument>;
  
  // DM mesajı bulma
  getDMMessageById(messageId: ID): Promise<DmMessageDocument | null>;
  getDMMessages(dmId: ID, options?: PaginationOptions): Promise<DmMessageDocument[]>;
  
  // DM mesajı güncelleme
  updateDMMessage(messageId: ID, userId: ID, content: string): Promise<DmMessageDocument | null>;
  
  // DM mesajı silme
  deleteDMMessage(messageId: ID, userId: ID): Promise<boolean>;
  
  // DM mesajı işlemleri
  markDMMessageAsRead(messageId: ID, userId: ID): Promise<boolean>;
  
  // DM mesajı tepkileri
  addDMReaction(messageId: ID, userId: ID, emoji: string): Promise<boolean>;
  removeDMReaction(messageId: ID, userId: ID, emoji: string): Promise<boolean>;
}

// Dosya yükleme
export interface FileUploadDependencies {
  // Bağımlılıklar
}

export interface FileUpload {
  // Dosya yükleme
  uploadFile(userId: ID, file: any, options?: {
    messageId?: ID;
    dmMessageId?: ID;
    generateThumbnail?: boolean;
  }): Promise<FileAttachmentDocument>;
  
  // Dosya bulma
  getFileById(fileId: ID): Promise<FileAttachmentDocument | null>;
  getUserFiles(userId: ID, options?: PaginationOptions): Promise<FileAttachmentDocument[]>;
  
  // Dosya silme
  deleteFile(fileId: ID, userId: ID): Promise<boolean>;
}

// Bildirim yönetimi
export interface NotificationManagerDependencies {
  // Bağımlılıklar
}

export interface NotificationManager {
  // Bildirim oluşturma
  createNotification(recipientId: ID, notificationData: {
    type: string;
    title: string;
    content: string;
    senderId?: ID;
    target?: any;
  }): Promise<NotificationDocument>;
  
  // Bildirim bulma
  getNotificationById(notificationId: ID): Promise<NotificationDocument | null>;
  getUserNotifications(userId: ID, options?: PaginationOptions): Promise<NotificationDocument[]>;
  
  // Bildirim işlemleri
  markNotificationAsRead(notificationId: ID): Promise<boolean>;
  markAllNotificationsAsRead(userId: ID): Promise<boolean>;
  
  // Bildirim silme
  deleteNotification(notificationId: ID): Promise<boolean>;
  deleteAllNotifications(userId: ID): Promise<boolean>;
}

// Arkadaşlık yönetimi
export interface FriendManagerDependencies {
  // Bağımlılıklar
}

export interface FriendManager {
  // Arkadaşlık isteği gönderme
  sendFriendRequest(senderId: ID, receiverId: ID): Promise<FriendRequestDocument>;
  
  // Arkadaşlık isteği bulma
  getFriendRequestById(requestId: ID): Promise<FriendRequestDocument | null>;
  getUserFriendRequests(userId: ID, status?: string): Promise<FriendRequestDocument[]>;
  
  // Arkadaşlık isteği işlemleri
  acceptFriendRequest(requestId: ID): Promise<boolean>;
  rejectFriendRequest(requestId: ID): Promise<boolean>;
  cancelFriendRequest(requestId: ID): Promise<boolean>;
  
  // Arkadaş bulma
  getUserFriends(userId: ID): Promise<UserDocument[]>;
  
  // Arkadaşlık silme
  removeFriend(userId: ID, friendId: ID): Promise<boolean>;
}

// Davet yönetimi
export interface InvitationManagerDependencies {
  // Bağımlılıklar
}

export interface InvitationManager {
  // Davet oluşturma
  createInvitation(inviterId: ID, invitationData: {
    email: string;
    groupId: ID;
  }): Promise<InvitationDocument>;
  
  // Davet bulma
  getInvitationById(invitationId: ID): Promise<InvitationDocument | null>;
  getInvitationByCode(code: string): Promise<InvitationDocument | null>;
  getGroupInvitations(groupId: ID): Promise<InvitationDocument[]>;
  
  // Davet işlemleri
  acceptInvitation(code: string, userId: ID): Promise<boolean>;
  
  // Davet silme
  deleteInvitation(invitationId: ID): Promise<boolean>;
}

// Webhook yönetimi
export interface WebhookManagerDependencies {
  // Bağımlılıklar
}

export interface WebhookManager {
  // Webhook oluşturma
  createWebhook(webhookData: {
    name: string;
    url: string;
    events: string[];
    channelId: ID;
    isActive?: boolean;
  }): Promise<WebhookDocument>;
  
  // Webhook bulma
  getWebhookById(webhookId: ID): Promise<WebhookDocument | null>;
  getChannelWebhooks(channelId: ID): Promise<WebhookDocument[]>;
  
  // Webhook güncelleme
  updateWebhook(webhookId: ID, webhookData: {
    name?: string;
    url?: string;
    events?: string[];
    isActive?: boolean;
  }): Promise<WebhookDocument | null>;
  
  // Webhook silme
  deleteWebhook(webhookId: ID): Promise<boolean>;
  
  // Webhook tetikleme
  triggerWebhook(webhookId: ID, event: string, payload: any): Promise<boolean>;
}

// Aktivite yönetimi
export interface ActivityManagerDependencies {
  // Bağımlılıklar
}

export interface ActivityManager {
  // Aktivite kaydetme
  logActivity(activityData: {
    userId: ID;
    type: string;
    target?: ID;
    metadata?: any;
  }): Promise<UserActivityDocument>;
  
  // Aktivite bulma
  getActivityById(activityId: ID): Promise<UserActivityDocument | null>;
  getUserActivities(userId: ID, options?: PaginationOptions): Promise<UserActivityDocument[]>;
  getActivitiesByType(type: string, options?: PaginationOptions): Promise<UserActivityDocument[]>;
  getActivitiesByTarget(targetId: ID, options?: PaginationOptions): Promise<UserActivityDocument[]>;
}

// Rapor yönetimi
export interface ReportManagerDependencies {
  // Bağımlılıklar
}

export interface ReportManager {
  // Rapor oluşturma
  createReport(reporterId: ID, reportData: {
    reportedUserId?: ID;
    reportedMessageId?: ID;
    reportedGroupId?: ID;
    reason: string;
  }): Promise<ReportDocument>;
  
  // Rapor bulma
  getReportById(reportId: ID): Promise<ReportDocument | null>;
  getReportsByStatus(status: string): Promise<ReportDocument[]>;
  
  // Rapor işlemleri
  resolveReport(reportId: ID, adminId: ID, notes?: string): Promise<boolean>;
  rejectReport(reportId: ID, adminId: ID, notes?: string): Promise<boolean>;
}

// Zamanlanmış mesaj yönetimi
export interface ScheduledMessageManagerDependencies {
  // Bağımlılıklar
}

export interface ScheduledMessageManager {
  // Zamanlanmış mesaj oluşturma
  scheduleMessage(authorId: ID, messageData: {
    content: string;
    type?: MessageType;
    channelId?: ID;
    directMessageId?: ID;
    scheduledFor: Date;
  }): Promise<ScheduledMessageDocument>;
  
  // Zamanlanmış mesaj bulma
  getScheduledMessageById(messageId: ID): Promise<ScheduledMessageDocument | null>;
  getUserScheduledMessages(userId: ID): Promise<ScheduledMessageDocument[]>;
  
  // Zamanlanmış mesaj güncelleme
  updateScheduledMessage(messageId: ID, messageData: {
    content?: string;
    scheduledFor?: Date;
  }): Promise<ScheduledMessageDocument | null>;
  
  // Zamanlanmış mesaj silme
  deleteScheduledMessage(messageId: ID): Promise<boolean>;
  
  // Zamanlanmış mesaj yönetimi
  initScheduledMessageManager(io: Server, formatter: any): void;
  processScheduledMessages(): Promise<void>;
}

// Socket.IO olayları
export interface SocketEventsDependencies {
  users: Record<string, string[]>;
  groups: Record<string, any>;
  onlineUsernames: Record<string, string>;
  friendRequests: Record<string, any>;
  groupManager: GroupManager;
  channelManager: ChannelManager;
  userManager: UserManager;
  friendManager: FriendManager;
  dmManager: DmManager;
  fileUpload: FileUpload;
  messageManager: MessageManager;
  profileManager: any;
  richTextFormatter: any;
  registerTextChannelEvents: any;
  sfu: any;
  passwordReset: any;
  emailVerification: any;
  twoFactorAuth: any;
  roleManager: any;
  categoryManager: any;
  archiveManager: any;
  messageInteractions: any;
  mediaProcessor: any;
  notificationManager: NotificationManager;
  emailNotifications: any;
  scheduledMessageManager: ScheduledMessageManager;
  sessionManager: any;
  reportManager: ReportManager;
}

export type SocketEventsFunction = (io: Server, dependencies: SocketEventsDependencies) => Server;
