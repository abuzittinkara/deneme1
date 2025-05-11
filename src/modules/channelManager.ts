/**
 * src/modules/channelManager.ts
 * Kanal yönetimi ile ilgili tüm işlevleri içerir
 */
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import { Group, GroupDocument } from '../models/Group';
import { Channel, ChannelDocument, ChannelType } from '../models/Channel';
import { Message, MessageDocument } from '../models/Message';
import { createModelHelper, toObjectId } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { Groups, GroupUser } from './groupManager';

// Model yardımcıları
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const MessageHelper = createModelHelper<MessageDocument, typeof Message>(Message);

// Kanal listesi öğesi arayüzü
export interface ChannelListItem {
  id: string;
  name: string;
  type: ChannelType;
  channelId?: string;
}

// Kullanıcı verisi arayüzü
export interface UserData {
  username: string;
  currentGroup?: string | null;
  currentRoom?: string | null;
}

/**
 * Veritabanından kanalları yükler ve bellek içi groups nesnesine ekler
 * @param groups - Bellek içi groups nesnesi
 */
export async function loadChannelsFromDB(groups: Groups): Promise<void> {
  try {
    // Geliştirme modunda mock veri kullan
    if (process.env.NODE_ENV === 'development') {
      console.log('Geliştirme modunda mock kanal verileri kullanılıyor');
      logger.info('Geliştirme modunda mock kanal verileri kullanılıyor');

      // Mock kanal verileri
      const mockChannels = [
        { channelId: 'c-dev-1', groupId: 'g-dev-1', name: 'genel', type: 'text' },
        { channelId: 'c-dev-2', groupId: 'g-dev-1', name: 'sesli-sohbet', type: 'voice' },
        { channelId: 'c-dev-3', groupId: 'g-dev-2', name: 'genel', type: 'text' },
        { channelId: 'c-dev-4', groupId: 'g-dev-3', name: 'genel', type: 'text' },
      ];

      mockChannels.forEach((mockChannel) => {
        if (groups[mockChannel.groupId]) {
          groups[mockChannel.groupId].rooms[mockChannel.channelId] = {
            name: mockChannel.name,
            type: mockChannel.type,
            users: [],
          };
        }
      });

      logger.info('Mock kanallar yüklendi', { channelCount: mockChannels.length });
      return;
    }

    // Üretim modunda gerçek veritabanından yükle
    const channelDocs = await ChannelHelper.find({}, null, { populate: 'group' });
    channelDocs.forEach((channelDoc) => {
      const groupId = (channelDoc.group as any).groupId;
      if (groups[groupId]) {
        groups[groupId].rooms[channelDoc.channelId] = {
          name: channelDoc.name,
          type: channelDoc.type,
          users: [],
        };
      }
    });
    logger.info('loadChannelsFromDB tamamlandı', { channelCount: channelDocs.length });
  } catch (error) {
    logger.error('loadChannelsFromDB hatası', { error: (error as Error).message });

    // Geliştirme modunda hata durumunda mock veri kullan
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Hata nedeniyle mock kanal verileri kullanılıyor');

      // Mock kanal verileri
      const mockChannels = [
        { channelId: 'c-dev-1', groupId: 'g-dev-1', name: 'genel', type: 'text' },
        { channelId: 'c-dev-2', groupId: 'g-dev-1', name: 'sesli-sohbet', type: 'voice' },
        { channelId: 'c-dev-3', groupId: 'g-dev-2', name: 'genel', type: 'text' },
        { channelId: 'c-dev-4', groupId: 'g-dev-3', name: 'genel', type: 'text' },
      ];

      mockChannels.forEach((mockChannel) => {
        if (groups[mockChannel.groupId]) {
          groups[mockChannel.groupId].rooms[mockChannel.channelId] = {
            name: mockChannel.name,
            type: mockChannel.type,
            users: [],
          };
        }
      });

      logger.info('Mock kanallar yüklendi', { channelCount: mockChannels.length });
      return;
    }

    throw error;
  }
}

/**
 * Bir kullanıcıya bir gruptaki kanalların listesini gönderir
 * @param socketId - Kullanıcının socket ID'si
 * @param groupId - Grup ID'si
 * @param groups - Bellek içi groups nesnesi
 * @param io - Socket.IO nesnesi
 */
export function sendRoomsListToUser(
  socketId: string,
  groupId: string,
  groups: Groups,
  io: SocketIOServer
): void {
  if (!groups[groupId]) return;

  const groupObj = groups[groupId];
  const roomArray: ChannelListItem[] = Object.keys(groupObj.rooms).map((rId) => ({
    id: rId,
    name: groupObj.rooms[rId].name,
    type: groupObj.rooms[rId].type as ChannelType,
  }));

  io.to(socketId).emit('roomsList', roomArray);
  logger.debug('Kullanıcıya kanal listesi gönderildi', {
    socketId,
    groupId,
    channelCount: roomArray.length,
  });
}

/**
 * Bir gruptaki tüm kullanıcılara kanal listesini yayınlar
 * @param groupId - Grup ID'si
 * @param groups - Bellek içi groups nesnesi
 * @param io - Socket.IO nesnesi
 */
export function broadcastRoomsListToGroup(
  groupId: string,
  groups: Groups,
  io: SocketIOServer
): void {
  if (!groups[groupId]) return;

  const groupObj = groups[groupId];
  const roomArray: ChannelListItem[] = Object.keys(groupObj.rooms).map((rId) => ({
    id: rId,
    name: groupObj.rooms[rId].name,
    type: groupObj.rooms[rId].type as ChannelType,
  }));

  io.to(groupId).emit('roomsList', roomArray);
  logger.debug('Gruba kanal listesi yayınlandı', { groupId, channelCount: roomArray.length });
}

/**
 * Yeni bir kanal oluşturur
 * @param groupId - Grup ID'si
 * @param roomName - Kanal adı
 * @param roomType - Kanal tipi ('text' veya 'voice')
 * @param username - İşlemi yapan kullanıcı adı
 * @param groups - Bellek içi groups nesnesi
 * @returns Oluşturulan kanal bilgileri
 */
export async function createChannel(
  groupId: string,
  roomName: string,
  roomType: ChannelType,
  username: string,
  groups: Groups
): Promise<ChannelListItem> {
  try {
    if (!groups[groupId]) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Grup sahibi kontrolü
    if (groups[groupId].owner !== username) {
      throw new ForbiddenError('Bu grupta kanal oluşturma yetkiniz yok');
    }

    const trimmedName = roomName.trim();
    if (!trimmedName) {
      throw new ValidationError('Kanal adı boş olamaz');
    }

    // Geçerli kanal tipi kontrolü
    if (roomType !== 'text' && roomType !== 'voice') {
      throw new ValidationError('Geçersiz kanal tipi');
    }

    // Grubu veritabanından bul
    const groupDoc = await GroupHelper.findOne({ groupId });
    if (!groupDoc) {
      throw new NotFoundError('Grup veritabanında bulunamadı');
    }

    // Yeni kanal oluştur
    const channelId = uuidv4();
    const newChannel = new Channel({
      channelId,
      name: trimmedName,
      group: groupDoc._id,
      type: roomType,
    });

    await newChannel.save();

    // Bellek içi gruba kanalı ekle
    groups[groupId].rooms[channelId] = {
      name: trimmedName,
      type: roomType,
      users: [],
    };

    logger.info('Yeni kanal oluşturuldu', {
      groupId,
      channelId,
      name: trimmedName,
      type: roomType,
    });

    return { id: channelId, channelId, name: trimmedName, type: roomType };
  } catch (error) {
    logger.error('createChannel hatası', {
      error: (error as Error).message,
      groupId,
      roomName,
      roomType,
      username,
    });
    throw error;
  }
}

/**
 * Bir kanalı siler
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param username - İşlemi yapan kullanıcı adı
 * @param groups - Bellek içi groups nesnesi
 */
export async function deleteChannel(
  groupId: string,
  channelId: string,
  username: string,
  groups: Groups
): Promise<void> {
  try {
    if (!groups[groupId]) {
      throw new NotFoundError('Grup bulunamadı');
    }

    if (!groups[groupId].rooms[channelId]) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Grup sahibi kontrolü
    if (groups[groupId].owner !== username) {
      throw new ForbiddenError('Bu kanalı silme yetkiniz yok');
    }

    // Kanalı veritabanından bul
    const channelDoc = await ChannelHelper.findOne({ channelId });
    if (!channelDoc) {
      throw new NotFoundError('Kanal veritabanında bulunamadı');
    }

    // Kanala ait mesajları sil
    await MessageHelper.deleteMany({ channel: channelDoc._id });

    // Kanalı sil
    await ChannelHelper.getModel().deleteOne({ _id: channelDoc._id });

    // Bellek içi gruptan kanalı sil
    delete groups[groupId].rooms[channelId];

    logger.info('Kanal silindi', { groupId, channelId, username });
  } catch (error) {
    logger.error('deleteChannel hatası', {
      error: (error as Error).message,
      groupId,
      channelId,
      username,
    });
    throw error;
  }
}

/**
 * Bir kanalın adını değiştirir
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param newName - Yeni kanal adı
 * @param username - İşlemi yapan kullanıcı adı
 * @param groups - Bellek içi groups nesnesi
 * @returns Güncellenmiş kanal bilgileri
 */
export async function renameChannel(
  groupId: string,
  channelId: string,
  newName: string,
  username: string,
  groups: Groups
): Promise<ChannelListItem> {
  try {
    if (!groups[groupId]) {
      throw new NotFoundError('Grup bulunamadı');
    }

    if (!groups[groupId].rooms[channelId]) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Grup sahibi kontrolü
    if (groups[groupId].owner !== username) {
      throw new ForbiddenError('Bu kanalı yeniden adlandırma yetkiniz yok');
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      throw new ValidationError('Kanal adı boş olamaz');
    }

    // Kanalı veritabanında güncelle
    const channelDoc = await ChannelHelper.findOne({ channelId });
    if (!channelDoc) {
      throw new NotFoundError('Kanal veritabanında bulunamadı');
    }

    channelDoc.name = trimmedName;
    await channelDoc.save();

    // Bellek içi kanalı güncelle
    groups[groupId].rooms[channelId].name = trimmedName;

    logger.info('Kanal adı değiştirildi', {
      groupId,
      channelId,
      oldName: groups[groupId].rooms[channelId].name,
      newName: trimmedName,
    });

    return {
      id: channelId,
      name: trimmedName,
      type: groups[groupId].rooms[channelId].type as ChannelType,
    };
  } catch (error) {
    logger.error('renameChannel hatası', {
      error: (error as Error).message,
      groupId,
      channelId,
      newName,
      username,
    });
    throw error;
  }
}

/**
 * Bir kanala kullanıcı ekler
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param socketId - Kullanıcının socket ID'si
 * @param username - Kullanıcı adı
 * @param groups - Bellek içi groups nesnesi
 * @param users - Bellek içi users nesnesi
 */
export function addUserToChannel(
  groupId: string,
  channelId: string,
  socketId: string,
  username: string,
  groups: Groups,
  users: Record<string, UserData>
): void {
  try {
    if (!groups[groupId]) return;
    if (!groups[groupId].rooms[channelId]) return;

    // Kullanıcı zaten kanalda mı kontrol et
    const userIndex = groups[groupId].rooms[channelId].users.findIndex((u) => u.id === socketId);
    if (userIndex === -1) {
      groups[groupId].rooms[channelId].users.push({ id: socketId, username });
    }

    // Kullanıcının mevcut kanal bilgisini güncelle
    users[socketId].currentRoom = channelId;

    logger.debug('Kullanıcı kanala eklendi', { groupId, channelId, username });
  } catch (error) {
    logger.error('addUserToChannel hatası', {
      error: (error as Error).message,
      groupId,
      channelId,
      socketId,
      username,
    });
  }
}

/**
 * Bir kanaldan kullanıcı çıkarır
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param socketId - Kullanıcının socket ID'si
 * @param groups - Bellek içi groups nesnesi
 */
export function removeUserFromChannel(
  groupId: string,
  channelId: string,
  socketId: string,
  groups: Groups
): void {
  try {
    if (!groups[groupId]) return;
    if (!groups[groupId].rooms[channelId]) return;

    // Kullanıcıyı kanaldan çıkar
    groups[groupId].rooms[channelId].users = groups[groupId].rooms[channelId].users.filter(
      (u) => u.id !== socketId
    );

    logger.debug('Kullanıcı kanaldan çıkarıldı', { groupId, channelId, socketId });
  } catch (error) {
    logger.error('removeUserFromChannel hatası', {
      error: (error as Error).message,
      groupId,
      channelId,
      socketId,
    });
  }
}

/**
 * Bir kanaldaki tüm kullanıcıların listesini yayınlar
 * @param groupId - Grup ID'si
 * @param channelId - Kanal ID'si
 * @param groups - Bellek içi groups nesnesi
 * @param io - Socket.IO nesnesi
 */
export function broadcastChannelUsers(
  groupId: string,
  channelId: string,
  groups: Groups,
  io: SocketIOServer
): void {
  try {
    if (!groups[groupId]) return;
    if (!groups[groupId].rooms[channelId]) return;

    io.to(`${groupId}::${channelId}`).emit('roomUsers', groups[groupId].rooms[channelId].users);

    logger.debug('Kanal kullanıcıları yayınlandı', {
      groupId,
      channelId,
      userCount: groups[groupId].rooms[channelId].users.length,
    });
  } catch (error) {
    logger.error('broadcastChannelUsers hatası', {
      error: (error as Error).message,
      groupId,
      channelId,
    });
  }
}

/**
 * Bir gruptaki tüm kanalların kullanıcı listelerini yayınlar
 * @param groupId - Grup ID'si
 * @param groups - Bellek içi groups nesnesi
 * @param io - Socket.IO nesnesi
 */
export function broadcastAllChannelsData(
  groupId: string,
  groups: Groups,
  io: SocketIOServer
): void {
  try {
    if (!groups[groupId]) return;

    Object.keys(groups[groupId].rooms).forEach((roomId) => {
      io.to(`${groupId}::${roomId}`).emit('roomUsers', groups[groupId].rooms[roomId].users);
    });

    logger.debug('Tüm kanal verileri yayınlandı', {
      groupId,
      channelCount: Object.keys(groups[groupId].rooms).length,
    });
  } catch (error) {
    logger.error('broadcastAllChannelsData hatası', {
      error: (error as Error).message,
      groupId,
    });
  }
}

export default {
  loadChannelsFromDB,
  sendRoomsListToUser,
  broadcastRoomsListToGroup,
  createChannel,
  deleteChannel,
  renameChannel,
  addUserToChannel,
  removeUserFromChannel,
  broadcastChannelUsers,
  broadcastAllChannelsData,
};
