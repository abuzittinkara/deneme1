/**
 * src/services/groupService.ts
 * Grup işlemleri için servis
 */
import { Group, GroupDocument, IGroup } from '../models/Group';
import { Channel } from '../models/Channel';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';
import { ApiError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

/**
 * Grup oluşturma parametreleri
 */
export interface CreateGroupParams {
  name: string;
  ownerId: string;
  description?: string;
  type?: 'public' | 'private' | 'secret';
  icon?: string;
  rules?: string;
}

/**
 * Grup güncelleme parametreleri
 */
export interface UpdateGroupParams {
  name?: string;
  description?: string;
  type?: 'public' | 'private' | 'secret';
  icon?: string;
  rules?: string;
}

/**
 * Grup servisi
 */
export class GroupService {
  /**
   * Grup oluşturur
   * @param params - Grup oluşturma parametreleri
   * @returns Oluşturulan grup
   */
  async createGroup(params: CreateGroupParams): Promise<GroupDocument> {
    try {
      const { name, ownerId, description, type, icon, rules } = params;

      // Kullanıcıyı kontrol et
      if (!mongoose.Types.ObjectId.isValid(ownerId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      const owner = await User.findById(ownerId);
      if (!owner) {
        throw new ApiError('Kullanıcı bulunamadı', 404);
      }

      // Grup oluştur
      const group = await Group.create({
        groupId: uuidv4(),
        name,
        owner: new mongoose.Types.ObjectId(ownerId),
        users: [new mongoose.Types.ObjectId(ownerId)],
        channels: [],
        description: description || '',
        type: type || 'public',
        icon,
        rules: rules || '',
      });

      // Kullanıcının gruplarına ekle
      await User.updateOne({ _id: ownerId }, { $push: { groups: group._id } });

      // Varsayılan kanalları oluştur
      const generalChannel = await Channel.create({
        channelId: uuidv4(),
        name: 'genel',
        group: group._id,
        type: 'text',
        description: 'Genel sohbet kanalı',
        position: 0,
        isArchived: false,
        isPrivate: false,
        createdBy: new mongoose.Types.ObjectId(ownerId),
      });

      const voiceChannel = await Channel.create({
        channelId: uuidv4(),
        name: 'sesli-sohbet',
        group: group._id,
        type: 'voice',
        description: 'Sesli sohbet kanalı',
        position: 1,
        isArchived: false,
        isPrivate: false,
        createdBy: new mongoose.Types.ObjectId(ownerId),
      });

      // Grup kanallarını güncelle
      await Group.updateOne(
        { _id: group._id },
        { $push: { channels: { $each: [generalChannel._id, voiceChannel._id] } } }
      );

      logger.info('Grup oluşturuldu', {
        groupId: group._id,
        name: group.name,
        ownerId,
      });

      return group;
    } catch (error) {
      logger.error('Grup oluşturma hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        params,
      });
      throw error;
    }
  }

  /**
   * Grup bilgilerini getirir
   * @param groupId - Grup ID
   * @returns Grup bilgileri
   */
  async getGroupById(groupId: string): Promise<GroupDocument | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new ApiError('Geçersiz grup ID', 400);
      }

      const group = await Group.findById(groupId)
        .populate('owner', 'username name surname avatar')
        .populate('users', 'username name surname avatar')
        .populate('channels', 'channelId name type description position isArchived isPrivate');

      return group;
    } catch (error) {
      logger.error('Grup bilgileri getirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        groupId,
      });
      throw error;
    }
  }

  /**
   * Grup bilgilerini günceller
   * @param groupId - Grup ID
   * @param params - Grup güncelleme parametreleri
   * @param userId - İşlemi yapan kullanıcı ID
   * @returns Güncellenen grup
   */
  async updateGroup(
    groupId: string,
    params: UpdateGroupParams,
    userId: string
  ): Promise<GroupDocument | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new ApiError('Geçersiz grup ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Grubu bul
      const group = await Group.findById(groupId);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcının grup sahibi olup olmadığını kontrol et
      if (group.owner.toString() !== userId) {
        throw new ApiError('Bu işlem için yetkiniz yok', 403);
      }

      // Grup bilgilerini güncelle
      const updatedGroup = await Group.findByIdAndUpdate(groupId, { $set: params }, { new: true })
        .populate('owner', 'username name surname avatar')
        .populate('users', 'username name surname avatar')
        .populate('channels', 'channelId name type description position isArchived isPrivate');

      logger.info('Grup bilgileri güncellendi', {
        groupId,
        updatedFields: Object.keys(params),
        userId,
      });

      return updatedGroup;
    } catch (error) {
      logger.error('Grup bilgileri güncelleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        groupId,
        params,
        userId,
      });
      throw error;
    }
  }

  /**
   * Grubu siler
   * @param groupId - Grup ID
   * @param userId - İşlemi yapan kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async deleteGroup(groupId: string, userId: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new ApiError('Geçersiz grup ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Grubu bul
      const group = await Group.findById(groupId);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcının grup sahibi olup olmadığını kontrol et
      if (group.owner.toString() !== userId) {
        throw new ApiError('Bu işlem için yetkiniz yok', 403);
      }

      // Grup kanallarını sil
      await Channel.deleteMany({ group: groupId });

      // Kullanıcıların gruplarından kaldır
      await User.updateMany({ groups: groupId }, { $pull: { groups: groupId } });

      // Grubu sil
      await Group.deleteOne({ _id: groupId });

      logger.info('Grup silindi', {
        groupId,
        name: group.name,
        userId,
      });

      return true;
    } catch (error) {
      logger.error('Grup silme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        groupId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Gruba kullanıcı ekler
   * @param groupId - Grup ID
   * @param userId - Eklenecek kullanıcı ID
   * @param addedBy - İşlemi yapan kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async addUserToGroup(groupId: string, userId: string, addedBy: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new ApiError('Geçersiz grup ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(addedBy)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Grubu bul
      const group = await Group.findById(groupId);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcıyı bul
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError('Kullanıcı bulunamadı', 404);
      }

      // Kullanıcının zaten grupta olup olmadığını kontrol et
      if (group.users.includes(new mongoose.Types.ObjectId(userId))) {
        throw new ApiError('Kullanıcı zaten grupta', 400);
      }

      // Gruba kullanıcı ekle
      await Group.updateOne({ _id: groupId }, { $push: { users: userId } });

      // Kullanıcının gruplarına ekle
      await User.updateOne({ _id: userId }, { $push: { groups: groupId } });

      logger.info('Kullanıcı gruba eklendi', {
        groupId,
        userId,
        addedBy,
      });

      return true;
    } catch (error) {
      logger.error('Kullanıcı gruba ekleme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        groupId,
        userId,
        addedBy,
      });
      throw error;
    }
  }

  /**
   * Gruptan kullanıcı çıkarır
   * @param groupId - Grup ID
   * @param userId - Çıkarılacak kullanıcı ID
   * @param removedBy - İşlemi yapan kullanıcı ID
   * @returns İşlem başarılı mı
   */
  async removeUserFromGroup(groupId: string, userId: string, removedBy: string): Promise<boolean> {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        throw new ApiError('Geçersiz grup ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      if (!mongoose.Types.ObjectId.isValid(removedBy)) {
        throw new ApiError('Geçersiz kullanıcı ID', 400);
      }

      // Grubu bul
      const group = await Group.findById(groupId);
      if (!group) {
        throw new ApiError('Grup bulunamadı', 404);
      }

      // Kullanıcıyı bul
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError('Kullanıcı bulunamadı', 404);
      }

      // Kullanıcının grupta olup olmadığını kontrol et
      if (!group.users.includes(new mongoose.Types.ObjectId(userId))) {
        throw new ApiError('Kullanıcı grupta değil', 400);
      }

      // Grup sahibi çıkarılamaz
      if (group.owner.toString() === userId) {
        throw new ApiError('Grup sahibi gruptan çıkarılamaz', 400);
      }

      // Gruptan kullanıcı çıkar
      await Group.updateOne({ _id: groupId }, { $pull: { users: userId } });

      // Kullanıcının gruplarından çıkar
      await User.updateOne({ _id: userId }, { $pull: { groups: groupId } });

      logger.info('Kullanıcı gruptan çıkarıldı', {
        groupId,
        userId,
        removedBy,
      });

      return true;
    } catch (error) {
      logger.error('Kullanıcı gruptan çıkarma hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        groupId,
        userId,
        removedBy,
      });
      throw error;
    }
  }
}

// Servis örneğini oluştur
export const groupService = new GroupService();

// Hem default export hem de named export sağla
export default groupService;
