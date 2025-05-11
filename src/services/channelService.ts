/**
 * src/services/channelService.ts
 * Kanal işlemleri için servis
 */
import { Channel, ChannelDocument, IChannel, ChannelType } from '../models/Channel';
import { Group } from '../models/Group';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { ApiError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Kanal oluşturma parametreleri
 */
export interface CreateChannelParams {
  name: string;
  groupId: string;
  type: ChannelType;
  description?: string;
  isPrivate?: boolean;
  allowedUsers?: string[];
  createdBy: string;
}

/**
 * Kanal güncelleme parametreleri
 */
export interface UpdateChannelParams {
  name?: string;
  description?: string;
  isPrivate?: boolean;
  allowedUsers?: string[];
  position?: number;
}

/**
 * Kanal servisi
 */
export class ChannelService {
  /**
   * Kanal oluşturur
   * @param params - Kanal oluşturma parametreleri
   * @returns Oluşturulan kanal
   */
  async createChannel(params: CreateChannelParams): Promise<ChannelDocument> {
    try {
      const { name, groupId, type, description, isPrivate, allowedUsers, createdBy } = params;

      // Grubu kontrol et
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new ApiError('Geçersiz grup ID', 400);
      }

      const group = await Group.findById(groupId);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcıyı kontrol et
      if (!mongoose.Types.ObjectId.isValid(createdBy)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      const user = await User.findById(createdBy);
      if (!user) {
        throw new ApiError('Kullanıcı bulunamadı', 404);
      }

      // Kullanıcının grupta olup olmadığını kontrol et
      if (!group.users.includes(new mongoose.Types.ObjectId(createdBy))) {
        throw new ApiError('Bu işlem için yetkiniz yok', 403);
      }

      // Aynı isimde kanal var mı kontrol et
      const existingChannel = await Channel.findByNameAndGroup(
        name,
        new mongoose.Types.ObjectId(groupId)
      );
      if (existingChannel) {
        throw new ApiError('Bu isimde bir kanal zaten var', 400);
      }

      // İzin verilen kullanıcıları kontrol et
      const allowedUserIds: mongoose.Types.ObjectId[] = [];
      if (isPrivate && allowedUsers && allowedUsers.length > 0) {
        // Kullanıcı ID'lerini doğrula
        for (const userId of allowedUsers) {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError('Geçersiz kullanıcı ID', 400);
          }

          // Kullanıcının grupta olup olmadığını kontrol et
          if (!group.users.includes(new mongoose.Types.ObjectId(userId))) {
            throw new ApiError('Belirtilen kullanıcılardan bazıları grupta değil', 400);
          }

          allowedUserIds.push(new mongoose.Types.ObjectId(userId));
        }
      }

      // Kanal pozisyonunu belirle
      const channelCount = await Channel.countDocuments({ group: groupId, type });
      const position = channelCount;

      // Kanal oluştur
      const channel = await Channel.create({
        channelId: uuidv4(),
        name,
        group: new mongoose.Types.ObjectId(groupId),
        type,
        description: description || '',
        position,
        isArchived: false,
        isPrivate: isPrivate || false,
        allowedUsers: isPrivate ? allowedUserIds : [],
        createdBy: new mongoose.Types.ObjectId(createdBy),
      });

      // Grup kanallarını güncelle
      await Group.updateOne({ _id: groupId }, { $push: { channels: channel._id } });

      logger.info('Kanal oluşturuldu', {
        channelId: channel._id,
        name: channel.name,
        groupId,
        createdBy,
      });

      return channel;
    } catch (error) {
      logger.error('Kanal oluşturma hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        params,
      });
      throw error;
    }
  }

  /**
   * Kanal bilgilerini getirir
   * @param channelId - Kanal ID
   * @returns Kanal bilgileri
   */
  async getChannelById(channelId: string): Promise<ChannelDocument | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError('Geçersiz kanal ID', 400);
      }

      const channel = await Channel.findById(channelId)
        .populate('group', 'groupId name')
        .populate('createdBy', 'username name surname avatar')
        .populate('allowedUsers', 'username name surname avatar');

      return channel;
    } catch (error) {
      logger.error('Kanal bilgileri getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        channelId,
      });
      throw error;
    }
  }

  /**
   * Grup kanallarını getirir
   * @param groupId - Grup ID
   * @returns Kanal listesi
   */
  async getChannelsByGroup(groupId: string): Promise<ChannelDocument[]> {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new ApiError('Geçersiz grup ID', 400);
      }

      const channels = await Channel.find({ group: groupId })
        .sort({ position: 1 })
        .populate('createdBy', 'username name surname avatar');

      return channels;
    } catch (error) {
      logger.error('Grup kanalları getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        groupId,
      });
      throw error;
    }
  }

  /**
   * Kanal bilgilerini günceller
   * @param channelId - Kanal ID
   * @param params - Kanal güncelleme parametreleri
   * @param userId - İşlemi yapan kullanıcı ID
   * @returns Güncellenen kanal
   */
  async updateChannel(
    channelId: string,
    params: UpdateChannelParams,
    userId: string
  ): Promise<ChannelDocument | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError('Geçersiz kanal ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Kanalı bul
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new ApiError('Kanal bulunamadı', 404);
      }

      // Grubu bul
      const group = await Group.findById(channel.group);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcının grup sahibi olup olmadığını kontrol et
      if (group.owner.toString() !== userId && channel.createdBy?.toString() !== userId) {
        throw new ApiError('Bu işlem için yetkiniz yok', 403);
      }

      // İzin verilen kullanıcıları kontrol et
      let allowedUserIds: mongoose.Types.ObjectId[] | undefined;
      if (params.isPrivate && params.allowedUsers && params.allowedUsers.length > 0) {
        allowedUserIds = [];
        // Kullanıcı ID'lerini doğrula
        for (const userId of params.allowedUsers) {
          if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new ApiError('Geçersiz kullanıcı ID', 400);
          }

          // Kullanıcının grupta olup olmadığını kontrol et
          if (!group.users.includes(new mongoose.Types.ObjectId(userId))) {
            throw new ApiError('Belirtilen kullanıcılardan bazıları grupta değil', 400);
          }

          allowedUserIds.push(new mongoose.Types.ObjectId(userId));
        }
      }

      // Kanal bilgilerini güncelle
      const updateData: any = { ...params };
      if (allowedUserIds) {
        updateData.allowedUsers = allowedUserIds;
      }

      const updatedChannel = await Channel.findByIdAndUpdate(
        channelId,
        { $set: updateData },
        { new: true }
      )
        .populate('group', 'groupId name')
        .populate('createdBy', 'username name surname avatar')
        .populate('allowedUsers', 'username name surname avatar');

      logger.info('Kanal bilgileri güncellendi', {
        channelId,
        updatedFields: Object.keys(params),
        userId,
      });

      return updatedChannel;
    } catch (error) {
      logger.error('Kanal bilgileri güncelleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        channelId,
        params,
        userId,
      });
      throw error;
    }
  }

  /**
   * Kanalı siler
   * @param channelId - Kanal ID
   * @param userId - İşlemi yapan kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async deleteChannel(channelId: string, userId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError('Geçersiz kanal ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Kanalı bul
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new ApiError('Kanal bulunamadı', 404);
      }

      // Grubu bul
      const group = await Group.findById(channel.group);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcının grup sahibi olup olmadığını kontrol et
      if (group.owner.toString() !== userId && channel.createdBy?.toString() !== userId) {
        throw new ApiError('Bu işlem için yetkiniz yok', 403);
      }

      // Grup kanallarından kaldır
      await Group.updateOne({ _id: channel.group }, { $pull: { channels: channelId } });

      // Kanalı sil
      await Channel.deleteOne({ _id: channelId });

      logger.info('Kanal silindi', {
        channelId,
        name: channel.name,
        groupId: channel.group,
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Kanal silme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        channelId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Kanalı arşivler
   * @param channelId - Kanal ID
   * @param userId - İşlemi yapan kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async archiveChannel(channelId: string, userId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(channelId)) {
        throw new ApiError('Geçersiz kanal ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Kanalı bul
      const channel = await Channel.findById(channelId);
      if (!channel) {
        throw new ApiError('Kanal bulunamadı', 404);
      }

      // Grubu bul
      const group = await Group.findById(channel.group);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcının grup sahibi olup olmadığını kontrol et
      if (group.owner.toString() !== userId && channel.createdBy?.toString() !== userId) {
        throw new ApiError('Bu işlem için yetkiniz yok', 403);
      }

      // Kanalı arşivle
      await Channel.updateOne(
        { _id: channelId },
        {
          $set: {
            isArchived: true,
            archivedAt: new Date(),
            archivedBy: new mongoose.Types.ObjectId(userId),
          },
        }
      );

      logger.info('Kanal arşivlendi', {
        channelId,
        name: channel.name,
        groupId: channel.group,
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Kanal arşivleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        channelId,
        userId,
      });
      throw error;
    }
  }
}

// Servis örneğini oluştur
export const channelService = new ChannelService();

// Hem default export hem de named export sağla
export default channelService;
