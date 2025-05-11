/**
 * src/utils/memoryStore.ts
 * Bellek içi veri yapıları için merkezi depo
 */
import { UserSession, GroupData, FriendRequest, MemoryGroups } from '../types/app';
import { UserDocument } from '../models/User';
import { GroupDocument } from '../models/Group';
import { ChannelDocument } from '../models/Channel';
import { logger } from './logger';
import { User } from '../models/User';
import { Group } from '../models/Group';
import { Channel } from '../models/Channel';
import { Groups } from '../modules/groupManager';

/**
 * Bellek içi veri yapıları için merkezi depo
 */
class MemoryStore {
  private users: Record<string, UserSession> = {};
  private groups: Record<string, GroupData> = {};
  private groupsInternal: Groups = {}; // groupManager.ts ile uyumlu veri yapısı
  private onlineUsernames = new Set<string>();
  private friendRequests: Record<string, FriendRequest[]> = {};

  /**
   * Kullanıcı oturumlarını döndürür
   */
  getUsers(): Record<string, UserSession> {
    return this.users;
  }

  /**
   * Grupları döndürür (app.ts tipi)
   */
  getGroups(): Record<string, GroupData> {
    return this.groups;
  }

  /**
   * Grupları döndürür (groupManager.ts ile uyumlu)
   */
  getGroupsInternal(): Groups {
    return this.groupsInternal;
  }

  /**
   * Çevrimiçi kullanıcı adlarını döndürür
   */
  getOnlineUsernames(): Set<string> {
    return this.onlineUsernames;
  }

  /**
   * Arkadaşlık isteklerini döndürür
   */
  getFriendRequests(): Record<string, FriendRequest[]> {
    return this.friendRequests;
  }

  /**
   * Kullanıcı oturumunu ekler veya günceller
   */
  updateUserSession(userId: string, data: Partial<UserSession>): void {
    if (this.users[userId]) {
      this.users[userId] = { ...this.users[userId], ...data };
    } else {
      this.users[userId] = data as UserSession;
    }
  }

  /**
   * Kullanıcı oturumunu siler
   */
  removeUserSession(userId: string): void {
    delete this.users[userId];
  }

  /**
   * Kullanıcıyı çevrimiçi olarak işaretler
   */
  markUserOnline(username: string): void {
    this.onlineUsernames.add(username);
  }

  /**
   * Kullanıcıyı çevrimdışı olarak işaretler
   */
  markUserOffline(username: string): void {
    this.onlineUsernames.delete(username);
  }

  /**
   * Arkadaşlık isteği ekler
   */
  addFriendRequest(userId: string, request: FriendRequest): void {
    if (!this.friendRequests[userId]) {
      this.friendRequests[userId] = [];
    }
    this.friendRequests[userId].push(request);
  }

  /**
   * Arkadaşlık isteğini kaldırır
   */
  removeFriendRequest(userId: string, requestId: string): void {
    if (this.friendRequests[userId]) {
      this.friendRequests[userId] = this.friendRequests[userId].filter(
        (req) => 'id' in req && req.id !== requestId
      );
    }
  }

  /**
   * Grup ekler veya günceller
   */
  updateGroup(groupId: string, data: Partial<GroupData>): void {
    if (this.groups[groupId]) {
      this.groups[groupId] = { ...this.groups[groupId], ...data };
    } else {
      this.groups[groupId] = data as GroupData;
    }
  }

  /**
   * Grubu siler
   */
  removeGroup(groupId: string): void {
    delete this.groups[groupId];
  }

  /**
   * Veritabanından veri yükler
   */
  async loadFromDatabase(): Promise<void> {
    try {
      logger.info('Bellek içi veri yapıları veritabanından yükleniyor...');

      // Geliştirme modunda veritabanı bağlantısı atlanabilir
      if (process.env.NODE_ENV === 'development') {
        logger.info('Geliştirme modunda veritabanı yüklemesi atlandı');

        // Geliştirme modu için örnek veriler
        this.initializeDevelopmentData();
        return;
      }

      // Kullanıcıları yükle
      // @ts-ignore - find metodu TypeScript tanımlarında yok ama Mongoose'da var
      const dbUsers = await User.find({ isActive: true });
      dbUsers.forEach((user: any) => {
        const userId = user._id ? user._id.toString() : '';
        this.users[userId] = {
          id: userId,
          username: user.get('username') || '',
          name: user.get('name') || '',
          surname: user.get('surname') || '',
          status: user.get('status') || 'offline',
          email: user.get('email') || '',
          socketId: null,
          currentChannel: null,
          currentGroup: null,
          joinedAt: user.get('createdAt')?.toISOString() || new Date().toISOString(),
          lastActivity: user.get('lastSeen')?.toISOString() || new Date().toISOString(),
          isTyping: false,
          isMuted: false,
          isDeafened: false,
          settings: {
            theme: 'dark',
            notifications: true,
            sounds: true,
            language: 'tr',
          },
        };
      });

      // Grupları yükle
      // @ts-ignore - find metodu TypeScript tanımlarında yok ama Mongoose'da var
      const dbGroups = await Group.find();
      dbGroups.forEach((group: any) => {
        const groupId = group.get('groupId') || group._id?.toString() || '';

        // App.ts için kullanılan grup yapısı
        this.groups[groupId] = {
          id: groupId,
          name: group.get('name') || '',
          owner: group.get('owner')?.toString() || '',
          ownerId: group.get('owner')?.toString() || '',
          users: (group.get('users') || []).map((u: any) =>
            u.toString ? u.toString() : String(u)
          ),
          channels: {},
          description: group.get('description') || '',
          createdAt: group.get('createdAt')?.toISOString() || new Date().toISOString(),
          updatedAt: group.get('updatedAt')?.toISOString() || new Date().toISOString(),
          members: (group.get('users') || []).map((u: any) =>
            u.toString ? u.toString() : String(u)
          ),
          categories: [],
          settings: {
            isPublic: true,
            joinRequiresApproval: false,
            allowInvites: true,
          },
        };

        // GroupManager.ts için kullanılan grup yapısı
        this.groupsInternal[groupId] = {
          owner: group.get('owner')?.toString() || '',
          name: group.get('name') || '',
          users: [],
          rooms: {},
        };
      });

      logger.info('Bellek içi veri yapıları veritabanından yüklendi', {
        userCount: Object.keys(this.users).length,
        groupCount: Object.keys(this.groups).length,
      });
    } catch (error) {
      logger.error('Bellek içi veri yapıları yüklenirken hata oluştu', {
        error: (error as Error).message,
      });

      // Hata durumunda geliştirme verilerini kullan
      this.initializeDevelopmentData();
    }
  }

  /**
   * Geliştirme modu için örnek veriler oluşturur
   */
  private initializeDevelopmentData(): void {
    logger.info('Geliştirme modu için örnek veriler oluşturuluyor...');

    // Örnek kullanıcılar
    const devUsers = [
      { id: 'dev-user-1', username: 'dev-user-1', name: 'Dev', surname: 'User 1' },
      { id: 'dev-user-2', username: 'dev-user-2', name: 'Dev', surname: 'User 2' },
      { id: 'dev-user-3', username: 'dev-user-3', name: 'Dev', surname: 'User 3' },
    ];

    devUsers.forEach((user) => {
      this.users[user.id] = {
        id: user.id,
        username: user.username,
        name: user.name,
        surname: user.surname,
        status: 'online',
        email: `${user.username}@example.com`,
        socketId: null,
        currentChannel: null,
        currentGroup: null,
        joinedAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        isTyping: false,
        isMuted: false,
        isDeafened: false,
        settings: {
          theme: 'dark',
          language: 'tr',
          notifications: true,
          sounds: true,
        },
      };
    });

    // Örnek gruplar
    const devGroups = [
      { id: 'g-dev-1', name: 'Geliştirme Grubu 1', owner: 'dev-user-1' },
      { id: 'g-dev-2', name: 'Geliştirme Grubu 2', owner: 'dev-user-2' },
      { id: 'g-dev-3', name: 'Geliştirme Grubu 3', owner: 'dev-user-3' },
    ];

    devGroups.forEach((group) => {
      // App.ts için kullanılan grup yapısı
      this.groups[group.id] = {
        id: group.id,
        name: group.name,
        owner: group.owner,
        ownerId: group.owner,
        users: devUsers.map((u) => ({ id: u.id, username: u.username })),
        channels: {},
        description: `${group.name} açıklaması`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        members: devUsers.map((u) => u.id),
        categories: [],
        settings: {
          isPublic: true,
          joinRequiresApproval: false,
          allowInvites: true,
        },
      };

      // GroupManager.ts için kullanılan grup yapısı
      this.groupsInternal[group.id] = {
        owner: group.owner,
        name: group.name,
        users: devUsers.map((u) => ({ id: u.id, username: u.username })),
        rooms: {},
      };
    });

    // Örnek kanallar
    const devChannels = [
      { id: 'c-dev-1', name: 'genel', type: 'text', groupId: 'g-dev-1' },
      { id: 'c-dev-2', name: 'sesli-sohbet', type: 'voice', groupId: 'g-dev-1' },
      { id: 'c-dev-3', name: 'genel', type: 'text', groupId: 'g-dev-2' },
      { id: 'c-dev-4', name: 'genel', type: 'text', groupId: 'g-dev-3' },
    ];

    devChannels.forEach((channel) => {
      // App.ts için kullanılan kanal yapısı
      if (this.groups[channel.groupId]) {
        const group = this.groups[channel.groupId];
        if (group) {
          this.groups[channel.groupId].channels[channel.id] = {
            id: channel.id,
            name: channel.name,
            type: channel.type as 'text' | 'voice',
            description: `${channel.name} kanalı`,
            groupId: channel.groupId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: group.owner || '',
            members: devUsers.map((u) => u.id),
            messages: [],
            settings: {
              isPrivate: false,
              allowReactions: true,
              allowThreads: true,
              allowAttachments: true,
            },
          };
        }
      }

      // GroupManager.ts için kullanılan kanal yapısı
      if (this.groupsInternal[channel.groupId]) {
        const groupInternal = this.groupsInternal[channel.groupId];
        if (groupInternal && groupInternal.rooms) {
          this.groupsInternal[channel.groupId].rooms[channel.id] = {
            name: channel.name,
            type: channel.type,
            users: [],
          };
        }
      }
    });

    logger.info('Geliştirme modu için örnek veriler oluşturuldu', {
      userCount: devUsers.length,
      groupCount: devGroups.length,
      channelCount: devChannels.length,
    });
  }

  /**
   * Bellek içi veri yapılarını temizler
   */
  clear(): void {
    this.users = {};
    this.groups = {};
    this.groupsInternal = {};
    this.onlineUsernames.clear();
    this.friendRequests = {};
    logger.info('Bellek içi veri yapıları temizlendi');
  }
}

// Singleton örneği oluştur
export const memoryStore = new MemoryStore();
