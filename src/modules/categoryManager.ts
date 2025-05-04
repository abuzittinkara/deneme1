/**
 * src/modules/categoryManager.ts
 * Kategori yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Category, CategoryDocument } from '../models/Category';
import { Channel, ChannelDocument } from '../models/Channel';
import { Group, GroupDocument } from '../models/Group';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import { toObjectId } from '../utils/mongoose-helpers';

// Model yardımcıları
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const CategoryHelper = createModelHelper<CategoryDocument, typeof Category>(Category);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);

// Kategori bilgisi arayüzü
export interface CategoryInfo {
  id: mongoose.Types.ObjectId;
  name: string;
  position: number;
}

// Kanal bilgisi arayüzü
export interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  position: number;
  description?: string;
}

// İşlem sonucu arayüzü
export interface OperationResult {
  success: boolean;
  message: string;
}

/**
 * Kategori oluşturur
 * @param groupId - Grup ID'si
 * @param name - Kategori adı
 * @param position - Pozisyon
 * @returns Oluşturulan kategori bilgileri
 */
export async function createCategory(
  groupId: string,
  name: string,
  position?: number
): Promise<CategoryInfo> {
  try {
    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    const category = new Category({
      name,
      group: group._id,
      position: position || 0
    });

    await category.save();

    logger.info('Kategori oluşturuldu', {
      categoryId: category._id,
      groupId,
      name
    });

    return {
      id: toObjectId(category._id as string),
      name: category.name,
      position: category.position
    };
  } catch (error) {
    logger.error('Kategori oluşturma hatası', {
      error: (error as Error).message,
      groupId,
      name
    });
    throw error;
  }
}

/**
 * Kategori günceller
 * @param categoryId - Kategori ID'si
 * @param updates - Güncellenecek alanlar
 * @returns Güncellenmiş kategori bilgileri
 */
export async function updateCategory(
  categoryId: string,
  updates: {
    name?: string;
    position?: number;
  }
): Promise<CategoryInfo> {
  try {
    const category = await CategoryHelper.findById(categoryId);
    if (!category) {
      throw new NotFoundError('Kategori bulunamadı.');
    }

    if (updates.name) category.name = updates.name;
    if (updates.position !== undefined) category.position = updates.position;

    await category.save();

    logger.info('Kategori güncellendi', {
      categoryId,
      updates
    });

    return {
      id: toObjectId(category._id as string),
      name: category.name,
      position: category.position
    };
  } catch (error) {
    logger.error('Kategori güncelleme hatası', {
      error: (error as Error).message,
      categoryId,
      updates
    });
    throw error;
  }
}

/**
 * Kategori siler
 * @param categoryId - Kategori ID'si
 * @returns İşlem sonucu
 */
export async function deleteCategory(categoryId: string): Promise<OperationResult> {
  try {
    const category = await CategoryHelper.findById(categoryId);
    if (!category) {
      throw new NotFoundError('Kategori bulunamadı.');
    }

    // Kategorideki kanalları güncelle
    await ChannelHelper.updateMany(
      { category: categoryId },
      { $unset: { category: 1 } }
    );

    await CategoryHelper.getModel().deleteOne({ _id: categoryId });

    logger.info('Kategori silindi', { categoryId });

    return { success: true, message: 'Kategori başarıyla silindi.' };
  } catch (error) {
    logger.error('Kategori silme hatası', {
      error: (error as Error).message,
      categoryId
    });
    throw error;
  }
}

/**
 * Kanalı kategoriye taşır
 * @param channelId - Kanal ID'si
 * @param categoryId - Kategori ID'si (null ise kategoriden çıkarır)
 * @returns İşlem sonucu
 */
export async function moveChannelToCategory(
  channelId: string,
  categoryId: string | null
): Promise<OperationResult> {
  try {
    const channel = await ChannelHelper.findOne({ channelId });
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı.');
    }

    if (categoryId) {
      const category = await CategoryHelper.findById(categoryId);
      if (!category) {
        throw new NotFoundError('Kategori bulunamadı.');
      }

      // Kategori ve kanal aynı gruba ait mi kontrol et
      if (category.group.toString() !== channel.group.toString()) {
        throw new ValidationError('Kanal ve kategori aynı gruba ait değil.');
      }

      channel.category = new mongoose.Types.ObjectId(categoryId);
    } else {
      // Kategoriden çıkar
      channel.category = undefined;
    }

    await channel.save();

    logger.info('Kanal kategoriye taşındı', {
      channelId,
      categoryId: categoryId || 'none'
    });

    return { success: true, message: 'Kanal başarıyla taşındı.' };
  } catch (error) {
    logger.error('Kanal taşıma hatası', {
      error: (error as Error).message,
      channelId,
      categoryId
    });
    throw error;
  }
}

/**
 * Grup kategorilerini getirir
 * @param groupId - Grup ID'si
 * @returns Kategoriler listesi
 */
export async function getCategoriesForGroup(groupId: string): Promise<CategoryInfo[]> {
  try {
    const group = await GroupHelper.findOne({ groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı.');
    }

    const categories = await CategoryHelper.find(
      { group: group._id },
      null,
      { sort: { position: 1 } }
    );

    logger.info('Grup kategorileri getirildi', {
      groupId,
      count: categories.length
    });

    return categories.map(cat => ({
      id: toObjectId(cat._id as string),
      name: cat.name,
      position: cat.position
    }));
  } catch (error) {
    logger.error('Grup kategorileri getirme hatası', {
      error: (error as Error).message,
      groupId
    });
    throw error;
  }
}

/**
 * Kategorideki kanalları getirir
 * @param categoryId - Kategori ID'si
 * @returns Kanallar listesi
 */
export async function getChannelsInCategory(categoryId: string): Promise<ChannelInfo[]> {
  try {
    const category = await CategoryHelper.findById(categoryId);
    if (!category) {
      throw new NotFoundError('Kategori bulunamadı.');
    }

    const channels = await ChannelHelper.find(
      {
        category: categoryId,
        isArchived: false
      },
      null,
      { sort: { position: 1 } }
    );

    logger.info('Kategorideki kanallar getirildi', {
      categoryId,
      count: channels.length
    });

    return channels.map(channel => ({
      id: channel.channelId,
      name: channel.name,
      type: channel.type,
      position: channel.position,
      description: channel.description
    }));
  } catch (error) {
    logger.error('Kategorideki kanalları getirme hatası', {
      error: (error as Error).message,
      categoryId
    });
    throw error;
  }
}

export default {
  createCategory,
  updateCategory,
  deleteCategory,
  moveChannelToCategory,
  getCategoriesForGroup,
  getChannelsInCategory
};
