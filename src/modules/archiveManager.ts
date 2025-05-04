/**
 * src/modules/archiveManager.ts
 * Arşiv yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Channel, ChannelDocument } from '../models/Channel';
import { User, UserDocument } from '../models/User';
import { Group, GroupDocument } from '../models/Group';
import { createModelHelper } from '../utils/mongoose-helpers';
import * as roleManager from './roleManager';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { toObjectId } from '../utils/mongoose-helpers';
import { ObjectId } from '../types/mongoose';
import { Permission } from '../types/enums';

// Model yardımcıları
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);

// Arşivlenmiş kanal bilgisi arayüzü
export interface ArchivedChannelInfo {
  id: string;
  name: string;
  type: string;
  isArchived: boolean;
  archivedAt?: Date;
  archivedBy?: string;
}

// İşlem sonucu arayüzü
export interface ArchiveOperationResult {
  success: boolean;
  message: string;
  channel: ArchivedChannelInfo;
}

/**
 * Kanalı arşivler
 * @param channelId - Kanal ID'si
 * @param username - İşlemi yapan kullanıcı adı
 * @param groupId - Grup ID'si
 * @returns İşlem sonucu
 */
export async function archiveChannel(
  channelId: string,
  username: string,
  groupId: string
): Promise<ArchiveOperationResult> {
  try {
    // İzin kontrolü
    const hasPermission = await roleManager.checkPermission(username, groupId, Permission.MANAGE_CHANNELS);
    if (!hasPermission) {
      throw new ForbiddenError('Bu işlem için yetkiniz yok.');
    }

    const channel = await ChannelHelper.findOne({ channelId });
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı.');
    }

    if (channel.isArchived) {
      throw new ValidationError('Kanal zaten arşivlenmiş.');
    }

    const user = await UserHelper.findOne({ username });
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı.');
    }

    // Kanalı arşivle
    channel.isArchived = true;
    channel.archivedAt = new Date();
    channel.archivedBy = user._id as any;

    await channel.save();

    logger.info('Kanal arşivlendi', {
      channelId,
      username,
      groupId
    });

    return {
      success: true,
      message: 'Kanal başarıyla arşivlendi.',
      channel: {
        id: channel.channelId,
        name: channel.name,
        type: channel.type,
        isArchived: channel.isArchived,
        archivedAt: channel.archivedAt
      }
    };
  } catch (error) {
    logger.error('Kanal arşivleme hatası', {
      error: (error as Error).message,
      channelId,
      username,
      groupId
    });
    throw error;
  }
}

/**
 * Kanalı arşivden çıkarır
 * @param channelId - Kanal ID'si
 * @param username - İşlemi yapan kullanıcı adı
 * @param groupId - Grup ID'si
 * @returns İşlem sonucu
 */
export async function unarchiveChannel(
  channelId: string,
  username: string,
  groupId: string
): Promise<ArchiveOperationResult> {
  try {
    // İzin kontrolü
    const hasPermission = await roleManager.checkPermission(username, groupId, Permission.MANAGE_CHANNELS);
    if (!hasPermission) {
      throw new ForbiddenError('Bu işlem için yetkiniz yok.');
    }

    const channel = await ChannelHelper.findOne({ channelId });
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı.');
    }

    if (!channel.isArchived) {
      throw new ValidationError('Kanal arşivlenmemiş.');
    }

    // Kanalı arşivden çıkar
    channel.isArchived = false;
    channel.archivedAt = undefined;
    channel.archivedBy = undefined;

    await channel.save();

    logger.info('Kanal arşivden çıkarıldı', {
      channelId,
      username,
      groupId
    });

    return {
      success: true,
      message: 'Kanal başarıyla arşivden çıkarıldı.',
      channel: {
        id: channel.channelId,
        name: channel.name,
        type: channel.type,
        isArchived: channel.isArchived
      }
    };
  } catch (error) {
    logger.error('Kanal arşivden çıkarma hatası', {
      error: (error as Error).message,
      channelId,
      username,
      groupId
    });
    throw error;
  }
}

/**
 * Arşivlenmiş kanalları getirir
 * @param groupId - Grup ID'si
 * @returns Arşivlenmiş kanallar listesi
 */
export async function getArchivedChannels(groupId: string): Promise<ArchivedChannelInfo[]> {
  try {
    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    const channels = await ChannelHelper.find(
      {
        group: group._id,
        isArchived: true
      },
      null,
      { populate: { path: 'archivedBy', select: 'username' } }
    );

    logger.info('Arşivlenmiş kanallar getirildi', {
      groupId,
      count: channels.length
    });

    return channels.map(channel => ({
      id: channel.channelId,
      name: channel.name,
      type: channel.type,
      isArchived: true,
      archivedAt: channel.archivedAt,
      archivedBy: (channel.archivedBy as any)?.username
    }));
  } catch (error) {
    logger.error('Arşivlenmiş kanalları getirme hatası', {
      error: (error as Error).message,
      groupId
    });
    throw error;
  }
}

export default {
  archiveChannel,
  unarchiveChannel,
  getArchivedChannels
};
