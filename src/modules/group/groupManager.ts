/**
 * src/modules/group/groupManager.ts
 * Grup yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Group, GroupDocument } from '../../models/Group';
import { User, UserDocument } from '../../models/User';
import { GroupMember, GroupMemberDocument } from '../../models/GroupMember';
import { Channel, ChannelDocument } from '../../models/Channel';
import { logger } from '../../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../../utils/errors';
import { toObjectId, createModelHelper } from '../../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const GroupMemberHelper = createModelHelper<GroupMemberDocument, typeof GroupMember>(GroupMember);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);

// Grup oluşturma parametreleri
export interface CreateGroupParams {
  name: string;
  description: string;
  type: 'public' | 'private' | 'secret';
  ownerId: string;
}

/**
 * Kullanıcının gruplarını getirir
 * @param userId - Kullanıcı ID'si
 * @returns Kullanıcının grupları
 */
export async function getUserGroups(userId: string): Promise<any[]> {
  try {
    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(userId).exec();
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcının üye olduğu grupları bul
    const memberships = await GroupMemberHelper.find({ user: toObjectId(userId) })
      .populateObject({
        path: 'group',
        select: 'groupId name description type icon',
        populate: {
          path: 'icon',
          select: 'url'
        }
      })
      .exec();

    // Grupları formatla
    const groups = memberships.map((membership: GroupMemberDocument) => {
      const group = membership.group as any;
      return {
        id: group.groupId,
        name: group.name,
        description: group.description,
        type: group.type,
        icon: group.icon?.url,
        joinedAt: membership.joinedAt
      };
    });

    logger.debug('Kullanıcının grupları getirildi', {
      userId,
      count: groups.length
    });

    return groups;
  } catch (error) {
    logger.error('Kullanıcının gruplarını getirme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

/**
 * Grup detaylarını getirir
 * @param groupId - Grup ID'si
 * @param userId - Kullanıcı ID'si
 * @returns Grup detayları
 */
export async function getGroupDetails(groupId: string, userId: string): Promise<any> {
  try {
    // Grubu bul
    const group = await GroupHelper.findOne({ groupId })
      .populate('owner', 'username name surname profilePicture')
      .populate('icon', 'url')
      .exec();

    if (!group) {
      throw new NotFoundError('Grup bulunamadı');
    }

    // Kullanıcının grupta olup olmadığını kontrol et
    const membership = await GroupMemberHelper.findOne({
      group: group._id,
      user: toObjectId(userId)
    }).exec();

    // Gizli grup kontrolü
    if (group.type === 'secret' && !membership) {
      throw new ForbiddenError('Bu grubu görüntüleme yetkiniz yok');
    }

    // Grup kanallarını getir
    const channels = await ChannelHelper.find({ group: group._id })
      .select('channelId name description type')
      .exec();

    // Grup üye sayısını getir
    const memberCount = await GroupMemberHelper.countDocuments({ group: group._id });

    // Grup detaylarını formatla
    const groupDetails = {
      id: group.groupId,
      name: group.name,
      description: group.description,
      type: group.type,
      rules: group.rules,
      icon: (group.icon as any)?.url,
      owner: {
        id: (group.owner as any)._id.toString(),
        username: (group.owner as any).username,
        name: (group.owner as any).name,
        surname: (group.owner as any).surname,
        profilePicture: (group.owner as any).profilePicture?.toString()
      },
      channels: channels.map((channel: ChannelDocument) => ({
        id: channel.channelId,
        name: channel.name,
        description: channel.description,
        type: channel.type
      })),
      memberCount,
      isMember: !!membership,
      createdAt: group.createdAt
    };

    logger.debug('Grup detayları getirildi', {
      groupId,
      userId
    });

    return groupDetails;
  } catch (error) {
    logger.error('Grup detaylarını getirme hatası', {
      error: (error as Error).message,
      groupId,
      userId
    });
    throw error;
  }
}

/**
 * Grup oluşturur
 * @param params - Grup oluşturma parametreleri
 * @returns Oluşturulan grup
 */
export async function createGroup(params: CreateGroupParams): Promise<any> {
  try {
    const { name, description, type, ownerId } = params;

    // Kullanıcıyı kontrol et
    const owner = await UserHelper.findById(ownerId).exec();
    if (!owner) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Grup ID'si oluştur
    const groupId = generateGroupId();

    // Grubu oluştur
    const group = await GroupHelper.create({
      groupId,
      name,
      description,
      type,
      owner: toObjectId(ownerId),
      users: [toObjectId(ownerId)]
    });

    // Grup üyeliği oluştur
    await GroupMemberHelper.create({
      group: group._id,
      user: toObjectId(ownerId),
      roles: [],
      joinedAt: new Date()
    });

    // Kullanıcının gruplar listesini güncelle
    await UserHelper.getModel().updateOne(
      { _id: toObjectId(ownerId) },
      { $addToSet: { groups: group._id } }
    );

    // Genel kanal oluştur
    const generalChannel = await ChannelHelper.create({
      channelId: generateChannelId(),
      name: 'genel',
      description: 'Genel sohbet kanalı',
      group: group._id,
      type: 'text'
      // members alanı ChannelDocument tipinde tanımlı değil, bu yüzden hata veriyor
      // Bu alanı kullanmak yerine, kanalı oluşturduktan sonra üyeleri ekleyebiliriz
    });

    // Grup kanallar listesini güncelle
    await GroupHelper.getModel().updateOne(
      { _id: group._id },
      { $addToSet: { channels: generalChannel._id } }
    );

    logger.info('Grup oluşturuldu', {
      groupId: group.groupId,
      ownerId,
      name
    });

    // Oluşturulan grup bilgilerini döndür
    return {
      id: group.groupId,
      name: group.name,
      description: group.description,
      type: group.type,
      owner: {
        id: owner._id.toString(),
        username: owner.username
      },
      channels: [
        {
          id: generalChannel.channelId,
          name: generalChannel.name,
          description: generalChannel.description,
          type: generalChannel.type
        }
      ],
      createdAt: group.createdAt
    };
  } catch (error) {
    logger.error('Grup oluşturma hatası', {
      error: (error as Error).message,
      params
    });
    throw error;
  }
}

/**
 * Grup ID'si oluşturur
 * @returns Grup ID'si
 */
function generateGroupId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `g-${timestamp}-${random}`;
}

/**
 * Kanal ID'si oluşturur
 * @returns Kanal ID'si
 */
function generateChannelId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `c-${timestamp}-${random}`;
}

const groupManager = {
  getUserGroups,
  getGroupDetails,
  createGroup
};

export default groupManager;
