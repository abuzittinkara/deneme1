/**
 * src/modules/categoryManager.ts
 * Kategori yönetimi işlemleri
 */
import mongoose from 'mongoose';
import Category from '../models/Category';
import { CategoryDocument } from '../models/Category';
import { Channel, ChannelDocument } from '../models/Channel';
import { Group, GroupDocument } from '../models/Group';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';
import { toObjectId } from '../utils/mongoose-helpers';
import { safeDbOperation, createSafeModelHelper } from '../utils/db-error-handler';

// Model yardımcıları - güvenli veritabanı işlemleri için
const GroupHelper = createSafeModelHelper(Group);
const CategoryHelper = createSafeModelHelper(Category);
const ChannelHelper = createSafeModelHelper(Channel);

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
  return safeDbOperation(
    async () => {
      const group = await GroupHelper.findOne({ groupId });
      if (!group) {
        throw new NotFoundError('Grup bulunamadı.');
      }

      const category = await CategoryHelper.create({
        name,
        group: group._id,
        position: position || 0,
      });

      logger.info('Kategori oluşturuldu', {
        categoryId: category._id,
        groupId,
        name,
      });

      return {
        id: toObjectId(category._id as string),
        name: category.name,
        position: category.position,
      };
    },
    'createCategory',
    { id: null, name: '', position: 0 } // Fallback değeri
  );
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
  return safeDbOperation(
    async () => {
      const category = await CategoryHelper.findById(categoryId);
      if (!category) {
        throw new NotFoundError('Kategori bulunamadı.');
      }

      // Güncellenecek alanları belirle
      const updateData: any = {};
      if (updates.name) updateData.name = updates.name;
      if (updates.position !== undefined) updateData.position = updates.position;

      // Güncelleme işlemini yap
      await CategoryHelper.updateOne({ _id: categoryId }, { $set: updateData });

      // Güncellenmiş kategoriyi getir
      const updatedCategory = await CategoryHelper.findById(categoryId);
      if (!updatedCategory) {
        throw new NotFoundError('Kategori bulunamadı.');
      }

      logger.info('Kategori güncellendi', {
        categoryId,
        updates,
      });

      return {
        id: toObjectId(updatedCategory._id as string),
        name: updatedCategory.name,
        position: updatedCategory.position,
      };
    },
    'updateCategory',
    null // Hata durumunda null döndür
  );
}

/**
 * Kategori siler
 * @param categoryId - Kategori ID'si
 * @returns İşlem sonucu
 */
export async function deleteCategory(categoryId: string): Promise<OperationResult> {
  return safeDbOperation(
    async () => {
      const category = await CategoryHelper.findById(categoryId);
      if (!category) {
        throw new NotFoundError('Kategori bulunamadı.');
      }

      // Kategorideki kanalları güncelle
      await ChannelHelper.updateMany({ category: categoryId }, { $unset: { category: 1 } });

      // Kategoriyi sil
      await CategoryHelper.deleteOne({ _id: categoryId });

      logger.info('Kategori silindi', { categoryId });

      return { success: true, message: 'Kategori başarıyla silindi.' };
    },
    'deleteCategory',
    { success: false, message: 'Kategori silme işlemi başarısız oldu.' } // Fallback değeri
  );
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
  return safeDbOperation(
    async () => {
      const channel = await ChannelHelper.findOne({ channelId });
      if (!channel) {
        throw new NotFoundError('Kanal bulunamadı.');
      }

      // Kategori kontrolü
      if (categoryId) {
        const category = await CategoryHelper.findById(categoryId);
        if (!category) {
          throw new NotFoundError('Kategori bulunamadı.');
        }

        // Kategori ve kanal aynı gruba ait mi kontrol et
        if (category.group.toString() !== channel.group.toString()) {
          throw new ValidationError('Kanal ve kategori aynı gruba ait değil.');
        }

        // Kanalı güncelle
        await ChannelHelper.updateOne(
          { channelId },
          { $set: { category: new mongoose.Types.ObjectId(categoryId) } }
        );
      } else {
        // Kategoriden çıkar
        await ChannelHelper.updateOne({ channelId }, { $unset: { category: 1 } });
      }

      logger.info('Kanal kategoriye taşındı', {
        channelId,
        categoryId: categoryId || 'none',
      });

      return { success: true, message: 'Kanal başarıyla taşındı.' };
    },
    'moveChannelToCategory',
    { success: false, message: 'Kanal taşıma işlemi başarısız oldu.' } // Fallback değeri
  );
}

/**
 * Grup kategorilerini getirir
 * @param groupId - Grup ID'si
 * @returns Kategoriler listesi
 */
export async function getCategoriesForGroup(groupId: string): Promise<CategoryInfo[]> {
  return safeDbOperation(
    async () => {
      const group = await GroupHelper.findOne({ groupId });
      if (!group) {
        throw new NotFoundError('Grup bulunamadı.');
      }

      const categories = await CategoryHelper.find(
        { group: group._id },
        {},
        { sort: { position: 1 } }
      );

      logger.info('Grup kategorileri getirildi', {
        groupId,
        count: categories.length,
      });

      return categories.map((cat) => ({
        id: toObjectId(cat._id as string),
        name: cat.name,
        position: cat.position,
      }));
    },
    'getCategoriesForGroup',
    [] // Hata durumunda boş dizi döndür
  );
}

/**
 * Kategorideki kanalları getirir
 * @param categoryId - Kategori ID'si
 * @returns Kanallar listesi
 */
export async function getChannelsInCategory(categoryId: string): Promise<ChannelInfo[]> {
  return safeDbOperation(
    async () => {
      const category = await CategoryHelper.findById(categoryId);
      if (!category) {
        throw new NotFoundError('Kategori bulunamadı.');
      }

      const channels = await ChannelHelper.find(
        {
          category: categoryId,
          isArchived: false,
        },
        {},
        { sort: { position: 1 } }
      );

      logger.info('Kategorideki kanallar getirildi', {
        categoryId,
        count: channels.length,
      });

      return channels.map((channel) => ({
        id: channel.channelId,
        name: channel.name,
        type: channel.type,
        position: channel.position,
        description: channel.description,
      }));
    },
    'getChannelsInCategory',
    [] // Hata durumunda boş dizi döndür
  );
}

export default {
  createCategory,
  updateCategory,
  deleteCategory,
  moveChannelToCategory,
  getCategoriesForGroup,
  getChannelsInCategory,
};
