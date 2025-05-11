/**
 * src/utils/mockData.ts
 * Geliştirme modunda kullanılacak sahte veri oluşturma modülü
 */
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from './logger';
import { GroupData, ChannelData, UserSession } from '../types/app';

/**
 * Sahte kullanıcı verileri oluşturur
 * @returns Sahte kullanıcı verileri
 */
export function createMockUsers(): Record<string, UserSession> {
  logger.info('Sahte kullanıcı verileri oluşturuluyor');

  const users: Record<string, UserSession> = {};

  // Sahte kullanıcılar
  const mockUsers = [
    { id: 'user-1', username: 'admin', name: 'Admin', surname: 'User', email: 'admin@example.com' },
    { id: 'user-2', username: 'test', name: 'Test', surname: 'User', email: 'test@example.com' },
    { id: 'user-3', username: 'demo', name: 'Demo', surname: 'User', email: 'demo@example.com' },
    { id: 'user-4', username: 'user', name: 'Normal', surname: 'User', email: 'user@example.com' },
    { id: 'user-5', username: 'guest', name: 'Guest', surname: 'User', email: 'guest@example.com' },
  ];

  // Kullanıcıları ekle
  mockUsers.forEach((user) => {
    users[user.id] = {
      id: user.id,
      username: user.username,
      name: user.name,
      surname: user.surname,
      email: user.email,
      status: 'online',
      socketId: `socket-${user.id}`,
      currentChannel: null,
      currentGroup: null,
      joinedAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isTyping: false,
      isMuted: false,
      isDeafened: false,
      settings: {
        theme: 'light',
        language: 'tr',
        notifications: true,
        sounds: true,
      },
    };
  });

  logger.info(`${Object.keys(users).length} sahte kullanıcı oluşturuldu`);

  return users;
}

/**
 * Sahte grup verileri oluşturur
 * @returns Sahte grup verileri
 */
export function createMockGroups(): Record<string, GroupData> {
  logger.info('Sahte grup verileri oluşturuluyor');

  const groups: Record<string, GroupData> = {};

  // Sahte gruplar
  const mockGroups = [
    { id: 'group-1', name: 'Genel Grup', description: 'Herkesin katılabileceği genel grup' },
    { id: 'group-2', name: 'Geliştirici Grubu', description: 'Geliştiriciler için özel grup' },
    { id: 'group-3', name: 'Test Grubu', description: 'Test amaçlı grup' },
  ];

  // Grupları ekle
  mockGroups.forEach((group) => {
    groups[group.id] = {
      id: group.id,
      name: group.name,
      description: group.description,
      ownerId: 'user-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      members: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
      channels: {},
      categories: [],
      settings: {
        isPublic: true,
        joinRequiresApproval: false,
        allowInvites: true,
      },
    };

    // Her grup için sahte kanallar oluştur
    if (groups[group.id]) {
      groups[group.id].channels = createMockChannels(group.id);
    }
  });

  logger.info(`${Object.keys(groups).length} sahte grup oluşturuldu`);

  return groups;
}

/**
 * Sahte kanal verileri oluşturur
 * @param groupId Grup ID'si
 * @returns Sahte kanal verileri
 */
function createMockChannels(groupId: string): Record<string, ChannelData> {
  const channels: Record<string, ChannelData> = {};

  // Sahte kanallar
  const mockChannels = [
    { id: `${groupId}-channel-1`, name: 'genel', type: 'text', description: 'Genel sohbet kanalı' },
    {
      id: `${groupId}-channel-2`,
      name: 'sesli-sohbet',
      type: 'voice',
      description: 'Sesli sohbet kanalı',
    },
    {
      id: `${groupId}-channel-3`,
      name: 'duyurular',
      type: 'text',
      description: 'Duyurular kanalı',
    },
    { id: `${groupId}-channel-4`, name: 'yardım', type: 'text', description: 'Yardım kanalı' },
  ];

  // Kanalları ekle
  mockChannels.forEach((channel) => {
    channels[channel.id] = {
      id: channel.id,
      name: channel.name,
      type: channel.type as 'text' | 'voice',
      description: channel.description,
      groupId: groupId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'user-1',
      members: [],
      messages: [],
      settings: {
        isPrivate: false,
        allowReactions: true,
        allowThreads: true,
        allowAttachments: true,
      },
    };
  });

  return channels;
}

/**
 * Sahte mesaj verileri oluşturur
 * @param channelId Kanal ID'si
 * @param count Mesaj sayısı
 * @returns Sahte mesaj verileri
 */
export function createMockMessages(channelId: string, count: number = 10): any[] {
  const messages = [];

  for (let i = 0; i < count; i++) {
    // Güvenli rastgele sayı üretimi için crypto.randomBytes() kullanılıyor
    const randomByte = crypto.randomBytes(1)[0];
    const randomIndex = randomByte !== undefined ? (randomByte % 5) + 1 : 1;
    const userId = `user-${randomIndex}`;
    const timestamp = new Date(Date.now() - i * 60000).toISOString(); // Her mesaj 1 dakika önce

    messages.push({
      id: uuidv4(),
      channelId,
      content: `Bu bir test mesajıdır #${i + 1}`,
      sender: {
        id: userId,
        username: ['admin', 'test', 'demo', 'user', 'guest'][
          parseInt(userId.split('-')[1] || '1') - 1
        ],
      },
      timestamp,
      edited: false,
      reactions: [],
      attachments: [],
      mentions: [],
      replyTo: null,
    });
  }

  return messages;
}

/**
 * Tüm sahte verileri oluşturur
 * @returns Sahte veriler
 */
export function createAllMockData(): {
  users: Record<string, UserSession>;
  groups: Record<string, GroupData>;
  } {
  const users = createMockUsers();
  const groups = createMockGroups();

  // Her kanal için sahte mesajlar oluştur
  Object.keys(groups).forEach((groupId) => {
    const group = groups[groupId];

    if (group && group.channels) {
      Object.keys(group.channels).forEach((channelId) => {
        const channel = group.channels ? group.channels[channelId] : undefined;

        if (channel && channel.type === 'text') {
          channel.messages = createMockMessages(channelId);
        }
      });
    }
  });

  return { users, groups };
}

export default {
  createMockUsers,
  createMockGroups,
  createMockMessages,
  createAllMockData,
};
