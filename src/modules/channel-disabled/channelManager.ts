/**
 * src/modules/channel/channelManager.ts
 * Kanal işlemleri yöneticisi
 */
import mongoose from 'mongoose';
import { Channel } from '../../models/Channel';
import { Group } from '../../models/Group';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { NotFoundError, ForbiddenError, ValidationError } from '../../utils/errors';
import { ChannelType } from '../../types/common';

/**
 * Kanal detaylarını getirir
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Kanal detayları
 */
export async function getChannelDetails(channelId: string, userId: string): Promise<any> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId)
      .populate('group', 'name icon isPrivate')
      .populate('category', 'name')
      .lean();

    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Kullanıcının erişim izni var mı kontrol et
    const hasAccess = await checkChannelAccess(channelId, userId);
    if (!hasAccess) {
      throw new ForbiddenError('Bu kanala erişim izniniz yok');
    }

    logger.debug('Kanal detayları getirildi', {
      channelId,
      userId
    });

    return channel;
  } catch (error) {
    logger.error('Kanal detayları getirme hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    throw error;
  }
}

/**
 * Grup kanallarını getirir
 * @param groupId - Grup ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Kanallar listesi
 */
export async function getGroupChannels(groupId: string, userId: string): Promise<any[]> {
  try {
    // Grubu bul
    const group = await Group.findOne({ _id: groupId });
    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Kullanıcının erişim izni var mı kontrol et
    const isMember = await checkGroupMembership(groupId, userId);
    if (!isMember) {
      throw new ForbiddenError('Bu gruba erişim izniniz yok');
    }

    // Kanalları getir
    const channels = await Channel.find({ group: groupId })
      .populate('category', 'name')
      .sort({ category: 1, name: 1 })
      .lean();

    logger.debug('Grup kanalları getirildi', {
      groupId,
      userId,
      channelCount: channels.length
    });

    return channels;
  } catch (error) {
    logger.error('Grup kanalları getirme hatası', {
      error: (error as Error).message,
      groupId,
      userId
    });
    throw error;
  }
}

/**
 * Kanal oluşturur
 * @param channelData - Kanal verileri
 * @returns Oluşturulan kanal
 */
export async function createChannel(channelData: any): Promise<any> {
  try {
    const { name, description, type, isPrivate, group, createdBy, category } = channelData;

    // Grubu bul
    const groupDoc = await Group.findOne({ _id: group });
    if (!groupDoc) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Kullanıcının yetki kontrolü
    const hasPermission = await checkChannelCreatePermission(group, createdBy);
    if (!hasPermission) {
      throw new ForbiddenError('Kanal oluşturma yetkiniz yok');
    }

    // Aynı isimde kanal var mı kontrol et
    const existingChannel = await Channel.findOne({
      name,
      group
    });

    if (existingChannel) {
      throw new ValidationError('Bu isimde bir kanal zaten mevcut');
    }

    // Kanal oluştur
    const channel = new Channel({
      name,
      description,
      type: type || 'text',
      isPrivate: isPrivate || false,
      group,
      category,
      createdBy
    });

    await channel.save();

    logger.info('Kanal oluşturuldu', {
      channelId: channel._id,
      name,
      groupId: group,
      createdBy
    });

    return channel;
  } catch (error) {
    logger.error('Kanal oluşturma hatası', {
      error: (error as Error).message,
      channelData
    });
    throw error;
  }
}

/**
 * Kanalı günceller
 * @param channelId - Kanal ID'si
 * @param updates - Güncellenecek alanlar
 * @param userId - Kullanıcı ID'si
 * @returns Güncellenen kanal
 */
export async function updateChannel(
  channelId: string,
  updates: any,
  userId: string
): Promise<any> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Kullanıcının yetki kontrolü
    const hasPermission = await checkChannelUpdatePermission(channelId, userId);
    if (!hasPermission) {
      throw new ForbiddenError('Kanal güncelleme yetkiniz yok');
    }

    // İsim değişikliği varsa, aynı isimde kanal var mı kontrol et
    if (updates.name && updates.name !== channel.name) {
      const existingChannel = await Channel.findOne({
        name: updates.name,
        group: channel.group,
        _id: { $ne: channelId }
      });

      if (existingChannel) {
        throw new ValidationError('Bu isimde bir kanal zaten mevcut');
      }
    }

    // Güncelleme yapılacak alanları belirle
    const allowedUpdates = ['name', 'description', 'isPrivate', 'category'];
    const updateData: any = {};

    for (const key of allowedUpdates) {
      if (updates[key] !== undefined) {
        updateData[key] = updates[key];
      }
    }

    // Kanalı güncelle
    const updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $set: updateData },
      { new: true }
    )
      .populate('group', 'name icon isPrivate')
      .populate('category', 'name');

    logger.info('Kanal güncellendi', {
      channelId,
      updates: updateData,
      userId
    });

    return updatedChannel;
  } catch (error) {
    logger.error('Kanal güncelleme hatası', {
      error: (error as Error).message,
      channelId,
      updates,
      userId
    });
    throw error;
  }
}

/**
 * Kanalı siler
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function deleteChannel(channelId: string, userId: string): Promise<boolean> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Kullanıcının yetki kontrolü
    const hasPermission = await checkChannelDeletePermission(channelId, userId);
    if (!hasPermission) {
      throw new ForbiddenError('Kanal silme yetkiniz yok');
    }

    // Kanalı sil
    await Channel.deleteOne({ _id: channelId });

    logger.info('Kanal silindi', {
      channelId,
      userId
    });

    return true;
  } catch (error) {
    logger.error('Kanal silme hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    throw error;
  }
}

/**
 * Kanal üyelerini getirir
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Üyeler listesi
 */
export async function getChannelMembers(channelId: string, userId: string): Promise<any[]> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Kullanıcının erişim izni var mı kontrol et
    const hasAccess = await checkChannelAccess(channelId, userId);
    if (!hasAccess) {
      throw new ForbiddenError('Bu kanala erişim izniniz yok');
    }

    // Kanal özel ise, izin verilen kullanıcıları getir
    if (channel.isPrivate) {
      const members = await User.find({
        _id: { $in: channel.allowedUsers }
      })
        .select('username displayName avatar status')
        .lean();

      logger.debug('Kanal üyeleri getirildi (özel kanal)', {
        channelId,
        userId,
        memberCount: members.length
      });

      return members;
    }

    // Kanal özel değilse, grup üyelerini getir
    const members = await User.find({
      groups: { $in: [channel.group] }
    })
      .select('username displayName avatar status')
      .lean();

    logger.debug('Kanal üyeleri getirildi', {
      channelId,
      userId,
      memberCount: members.length
    });

    return members;
  } catch (error) {
    logger.error('Kanal üyeleri getirme hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    throw error;
  }
}

/**
 * Kanala katılır
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function joinChannel(channelId: string, userId: string): Promise<any> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Kullanıcının grup üyesi olup olmadığını kontrol et
    const isMember = await checkGroupMembership(channel.group.toString(), userId);
    if (!isMember) {
      throw new ForbiddenError('Önce gruba katılmanız gerekiyor');
    }

    // Kanal özel ise, kullanıcıyı izin verilenler listesine ekle
    if (channel.isPrivate) {
      // Kullanıcı zaten izin verilenler listesinde mi kontrol et
      if (channel.allowedUsers && channel.allowedUsers.includes(new mongoose.Types.ObjectId(userId))) {
        return channel;
      }

      // Kullanıcıyı izin verilenler listesine ekle
      await Channel.updateOne(
        { _id: channelId },
        { $addToSet: { allowedUsers: userId } }
      );

      logger.info('Kullanıcı özel kanala katıldı', {
        channelId,
        userId
      });

      return await Channel.findById(channelId);
    }

    // Kanal özel değilse, zaten erişim var
    logger.info('Kullanıcı kanala katıldı', {
      channelId,
      userId
    });

    return channel;
  } catch (error) {
    logger.error('Kanala katılma hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    throw error;
  }
}

/**
 * Kanaldan ayrılır
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns İşlem sonucu
 */
export async function leaveChannel(channelId: string, userId: string): Promise<boolean> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new NotFoundError('Kanal bulunamadı');
    }

    // Kanal özel ise, kullanıcıyı izin verilenler listesinden çıkar
    if (channel.isPrivate) {
      await Channel.updateOne(
        { _id: channelId },
        { $pull: { allowedUsers: userId } }
      );

      logger.info('Kullanıcı özel kanaldan ayrıldı', {
        channelId,
        userId
      });

      return true;
    }

    // Kanal özel değilse, ayrılma işlemi yok
    logger.info('Kullanıcı kanaldan ayrıldı', {
      channelId,
      userId
    });

    return true;
  } catch (error) {
    logger.error('Kanaldan ayrılma hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    throw error;
  }
}

/**
 * Kullanıcının kanala erişim izni olup olmadığını kontrol eder
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Erişim izni var mı
 */
async function checkChannelAccess(channelId: string, userId: string): Promise<boolean> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return false;
    }

    // Kullanıcının grup üyesi olup olmadığını kontrol et
    const isMember = await checkGroupMembership(channel.group.toString(), userId);
    if (!isMember) {
      return false;
    }

    // Kanal özel değilse, erişim izni var
    if (!channel.isPrivate) {
      return true;
    }

    // Kanal özel ise, kullanıcının izin verilenler listesinde olup olmadığını kontrol et
    return channel.allowedUsers && channel.allowedUsers.includes(new mongoose.Types.ObjectId(userId));
  } catch (error) {
    logger.error('Kanal erişim kontrolü hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    return false;
  }
}

/**
 * Kullanıcının grup üyesi olup olmadığını kontrol eder
 * @param groupId - Grup ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Grup üyesi mi
 */
async function checkGroupMembership(groupId: string, userId: string): Promise<boolean> {
  try {
    // Kullanıcıyı bul
    const user = await User.findById(userId);
    if (!user) {
      return false;
    }

    // Kullanıcının grup üyesi olup olmadığını kontrol et
    return user.groups && user.groups.includes(new mongoose.Types.ObjectId(groupId));
  } catch (error) {
    logger.error('Grup üyeliği kontrolü hatası', {
      error: (error as Error).message,
      groupId,
      userId
    });
    return false;
  }
}

/**
 * Kullanıcının kanal oluşturma yetkisi olup olmadığını kontrol eder
 * @param groupId - Grup ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Kanal oluşturma yetkisi var mı
 */
async function checkChannelCreatePermission(groupId: string, userId: string): Promise<boolean> {
  try {
    // Grubu bul
    const group = await Group.findOne({ _id: groupId });
    if (!group) {
      return false;
    }

    // Kullanıcı grup sahibi mi kontrol et
    if (group.owner.toString() === userId) {
      return true;
    }

    // TODO: Rol tabanlı yetki kontrolü eklenecek

    // Şimdilik sadece grup sahibi kanal oluşturabilir
    return false;
  } catch (error) {
    logger.error('Kanal oluşturma yetkisi kontrolü hatası', {
      error: (error as Error).message,
      groupId,
      userId
    });
    return false;
  }
}

/**
 * Kullanıcının kanal güncelleme yetkisi olup olmadığını kontrol eder
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Kanal güncelleme yetkisi var mı
 */
async function checkChannelUpdatePermission(channelId: string, userId: string): Promise<boolean> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return false;
    }

    // Grubu bul
    const group = await Group.findOne({ _id: channel.group });
    if (!group) {
      return false;
    }

    // Kullanıcı grup sahibi mi kontrol et
    if (group.owner.toString() === userId) {
      return true;
    }

    // TODO: Rol tabanlı yetki kontrolü eklenecek

    // Şimdilik sadece grup sahibi kanal güncelleyebilir
    return false;
  } catch (error) {
    logger.error('Kanal güncelleme yetkisi kontrolü hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    return false;
  }
}

/**
 * Kullanıcının kanal silme yetkisi olup olmadığını kontrol eder
 * @param channelId - Kanal ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Kanal silme yetkisi var mı
 */
async function checkChannelDeletePermission(channelId: string, userId: string): Promise<boolean> {
  try {
    // Kanalı bul
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return false;
    }

    // Grubu bul
    const group = await Group.findOne({ _id: channel.group });
    if (!group) {
      return false;
    }

    // Kullanıcı grup sahibi mi kontrol et
    if (group.owner.toString() === userId) {
      return true;
    }

    // TODO: Rol tabanlı yetki kontrolü eklenecek

    // Şimdilik sadece grup sahibi kanal silebilir
    return false;
  } catch (error) {
    logger.error('Kanal silme yetkisi kontrolü hatası', {
      error: (error as Error).message,
      channelId,
      userId
    });
    return false;
  }
}

export default {
  getChannelDetails,
  getGroupChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  getChannelMembers,
  joinChannel,
  leaveChannel
};
