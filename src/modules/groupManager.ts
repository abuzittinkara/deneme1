/**
 * src/modules/groupManager.ts
 * Grup yönetimi ile ilgili tüm işlevleri içerir
 */
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import { User, UserDocument } from '../models/User';
import { Group, GroupDocument } from '../models/Group';
import { Channel, ChannelDocument } from '../models/Channel';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors';
import { toObjectId, objectIdEquals } from '../utils/mongoose-helpers';

// Model yardımcıları
const UserHelper = createModelHelper<UserDocument, typeof User>(User);
const GroupHelper = createModelHelper<GroupDocument, typeof Group>(Group);
const ChannelHelper = createModelHelper<ChannelDocument, typeof Channel>(Channel);

// Bellek içi grup kullanıcısı arayüzü
export interface GroupUser {
  id: string | null;
  username: string;
}

// Bellek içi oda arayüzü
export interface GroupRoom {
  name: string;
  type: string;
  users: GroupUser[];
}

// Bellek içi grup arayüzü
export interface GroupData {
  owner: string;
  name: string;
  users: GroupUser[];
  rooms: Record<string, GroupRoom>;
}

// Bellek içi gruplar arayüzü
export interface Groups {
  [groupId: string]: GroupData;
}

// Grup listesi öğesi arayüzü
export interface GroupListItem {
  id: string;
  name: string;
  owner: mongoose.Types.ObjectId | string;
}

// Grup kullanıcıları sonucu arayüzü
export interface GroupUsersResult {
  online: { username: string }[];
  offline: { username: string }[];
}

/**
 * Veritabanından grupları yükler ve bellek içi groups nesnesine ekler
 * @param groups - Bellek içi groups nesnesi
 */
export async function loadGroupsFromDB(groups: Groups): Promise<void> {
  try {
    // Geliştirme modunda mock veri kullan
    if (process.env.NODE_ENV === 'development') {
      console.log("Geliştirme modunda mock grup verileri kullanılıyor");
      logger.info("Geliştirme modunda mock grup verileri kullanılıyor");

      // Mock grup verileri
      const mockGroups = [
        { groupId: 'g-dev-1', owner: 'dev-user-1', name: 'Geliştirme Grubu 1' },
        { groupId: 'g-dev-2', owner: 'dev-user-2', name: 'Geliştirme Grubu 2' },
        { groupId: 'g-dev-3', owner: 'dev-user-3', name: 'Geliştirme Grubu 3' }
      ];

      mockGroups.forEach(mockGroup => {
        groups[mockGroup.groupId] = {
          owner: mockGroup.owner,
          name: mockGroup.name,
          users: [],
          rooms: {}
        };
      });

      logger.info("Mock gruplar yüklendi", { groupCount: Object.keys(groups).length });
      return;
    }

    // Üretim modunda gerçek veritabanından yükle
    const groupDocs = await GroupHelper.find({});
    groupDocs.forEach(groupDoc => {
      groups[groupDoc.groupId] = {
        owner: groupDoc.owner.toString(),
        name: groupDoc.name,
        users: [],
        rooms: {}
      };
    });
    logger.info("loadGroupsFromDB tamamlandı", { groupCount: Object.keys(groups).length });
  } catch (error) {
    logger.error("loadGroupsFromDB hatası", { error: (error as Error).message });

    // Geliştirme modunda hata durumunda mock veri kullan
    if (process.env.NODE_ENV === 'development') {
      logger.warn("Hata nedeniyle mock grup verileri kullanılıyor");

      // Mock grup verileri
      const mockGroups = [
        { groupId: 'g-dev-1', owner: 'dev-user-1', name: 'Geliştirme Grubu 1' },
        { groupId: 'g-dev-2', owner: 'dev-user-2', name: 'Geliştirme Grubu 2' },
        { groupId: 'g-dev-3', owner: 'dev-user-3', name: 'Geliştirme Grubu 3' }
      ];

      mockGroups.forEach(mockGroup => {
        groups[mockGroup.groupId] = {
          owner: mockGroup.owner,
          name: mockGroup.name,
          users: [],
          rooms: {}
        };
      });

      logger.info("Mock gruplar yüklendi", { groupCount: Object.keys(groups).length });
      return;
    }

    throw error;
  }
}

/**
 * Bir kullanıcıya ait grupları getirir ve socket'e gönderir
 * @param socketId - Kullanıcının socket ID'si
 * @param users - Bellek içi users nesnesi
 * @param io - Socket.IO nesnesi
 */
export async function sendGroupsListToUser(
  socketId: string,
  users: Record<string, { username: string }>,
  io: SocketIOServer
): Promise<void> {
  const userData = users[socketId];
  if (!userData || !userData.username) return;

  try {
    const userDoc = await UserHelper.findOne(
      { username: userData.username },
      null,
      { populate: 'groups' }
    );
    if (!userDoc) return;

    const groupList: GroupListItem[] = userDoc.groups.map(g => ({
      id: (g as any).groupId,
      name: (g as any).name,
      owner: (g as any).owner
    }));

    io.to(socketId).emit('groupsList', groupList);
    logger.debug("Kullanıcıya grup listesi gönderildi", { username: userData.username, groupCount: groupList.length });
  } catch (error) {
    logger.error("sendGroupsListToUser hatası", { error: (error as Error).message, socketId });
  }
}

/**
 * Yeni bir grup oluşturur
 * @param groupName - Grup adı
 * @param username - Grup sahibinin kullanıcı adı
 * @param groups - Bellek içi groups nesnesi
 * @returns Oluşturulan grup bilgileri
 */
export async function createGroup(
  groupName: string,
  username: string,
  groups: Groups
): Promise<{ groupId: string; name: string }> {
  try {
    if (!groupName) {
      throw new ValidationError("Grup adı boş olamaz");
    }

    const trimmed = groupName.trim();
    if (!trimmed) {
      throw new ValidationError("Grup adı boş olamaz");
    }

    const userDoc = await UserHelper.findOne({ username });
    if (!userDoc) {
      throw new NotFoundError("Kullanıcı bulunamadı");
    }

    const groupId = uuidv4();
    const newGroup = new Group({
      groupId,
      name: trimmed,
      owner: userDoc._id,
      users: [userDoc._id]
    });

    await newGroup.save();
    userDoc.groups.push(toObjectId(newGroup._id as string));
    await userDoc.save();

    groups[groupId] = {
      owner: username,
      name: trimmed,
      users: [{ id: null, username }],
      rooms: {}
    };

    logger.info("Yeni grup oluşturuldu", { groupId, name: trimmed, owner: username });

    return { groupId, name: trimmed };
  } catch (error) {
    logger.error("createGroup hatası", { error: (error as Error).message, groupName, username });
    throw error;
  }
}

/**
 * Bir gruba kullanıcı ekler
 * @param groupId - Grup ID'si
 * @param username - Eklenecek kullanıcının adı
 * @param groups - Bellek içi groups nesnesi
 */
export async function addUserToGroup(
  groupId: string,
  username: string,
  groups: Groups
): Promise<void> {
  try {
    if (!groups[groupId]) {
      throw new NotFoundError("Grup bulunamadı");
    }

    const userDoc = await UserHelper.findOne({ username });
    if (!userDoc) {
      throw new NotFoundError("Kullanıcı bulunamadı");
    }

    const groupDoc = await GroupHelper.findOne({ groupId });
    if (!groupDoc) {
      throw new NotFoundError("Grup bulunamadı");
    }

    // Kullanıcı zaten grupta mı kontrol et
    if (groupDoc.users.some(userId => objectIdEquals(userId, userDoc._id as string))) {
      return; // Kullanıcı zaten grupta, işlem yapma
    }

    // Kullanıcıyı gruba ekle
    groupDoc.users.push(toObjectId(userDoc._id as string));
    await groupDoc.save();

    // Kullanıcının gruplarına bu grubu ekle
    if (!userDoc.groups.some(gId => objectIdEquals(gId, groupDoc._id as string))) {
      userDoc.groups.push(toObjectId(groupDoc._id as string));
      await userDoc.save();
    }

    logger.info("Kullanıcı gruba eklendi", { groupId, username });
  } catch (error) {
    logger.error("addUserToGroup hatası", { error: (error as Error).message, groupId, username });
    throw error;
  }
}

/**
 * Bir grubu siler
 * @param groupId - Silinecek grup ID'si
 * @param username - İşlemi yapan kullanıcı adı
 * @param groups - Bellek içi groups nesnesi
 */
export async function deleteGroup(
  groupId: string,
  username: string,
  groups: Groups
): Promise<void> {
  try {
    if (!groups[groupId]) {
      throw new NotFoundError("Grup bulunamadı");
    }

    // Grup sahibi kontrolü
    if (groups[groupId].owner !== username) {
      throw new ForbiddenError("Bu grubu silme yetkiniz yok");
    }

    // Grubu veritabanından sil
    const groupDoc = await GroupHelper.findOne({ groupId });
    if (!groupDoc) {
      throw new NotFoundError("Grup veritabanında bulunamadı");
    }

    // Grup üyelerinin listesinden grubu kaldır
    for (const userId of groupDoc.users) {
      await UserHelper.getModel().updateOne(
        { _id: userId },
        { $pull: { groups: groupDoc._id } }
      );
    }

    // Gruba ait kanalları sil
    await ChannelHelper.deleteMany({ group: groupDoc._id });

    // Grubu sil
    await GroupHelper.getModel().deleteOne({ _id: groupDoc._id });

    // Bellek içi gruptan sil
    delete groups[groupId];

    logger.info("Grup silindi", { groupId, username });
  } catch (error) {
    logger.error("deleteGroup hatası", { error: (error as Error).message, groupId, username });
    throw error;
  }
}

/**
 * Bir grubun adını değiştirir
 * @param groupId - Grup ID'si
 * @param newName - Yeni grup adı
 * @param username - İşlemi yapan kullanıcı adı
 * @param groups - Bellek içi groups nesnesi
 * @returns Güncellenmiş grup bilgileri
 */
export async function renameGroup(
  groupId: string,
  newName: string,
  username: string,
  groups: Groups
): Promise<{ groupId: string; name: string }> {
  try {
    if (!groups[groupId]) {
      throw new NotFoundError("Grup bulunamadı");
    }

    // Grup sahibi kontrolü
    if (groups[groupId].owner !== username) {
      throw new ForbiddenError("Bu grubu yeniden adlandırma yetkiniz yok");
    }

    const trimmedName = newName.trim();
    if (!trimmedName) {
      throw new ValidationError("Grup adı boş olamaz");
    }

    // Grubu veritabanında güncelle
    const groupDoc = await GroupHelper.findOne({ groupId });
    if (!groupDoc) {
      throw new NotFoundError("Grup veritabanında bulunamadı");
    }

    groupDoc.name = trimmedName;
    await groupDoc.save();

    // Bellek içi grubu güncelle
    groups[groupId].name = trimmedName;

    logger.info("Grup adı değiştirildi", { groupId, oldName: groups[groupId].name, newName: trimmedName });

    return { groupId, name: trimmedName };
  } catch (error) {
    logger.error("renameGroup hatası", { error: (error as Error).message, groupId, newName, username });
    throw error;
  }
}

/**
 * Bir gruptaki tüm kullanıcıların listesini getirir
 * @param groupId - Grup ID'si
 * @param onlineUsernames - Çevrimiçi kullanıcılar kümesi
 * @returns Çevrimiçi ve çevrimdışı kullanıcılar
 */
export async function getOnlineOfflineDataForGroup(
  groupId: string,
  onlineUsernames: Set<string>
): Promise<GroupUsersResult> {
  try {
    const groupDoc = await GroupHelper.findOne(
      { groupId },
      null,
      { populate: 'users' }
    );
    if (!groupDoc) return { online: [], offline: [] };

    const online: { username: string }[] = [];
    const offline: { username: string }[] = [];

    groupDoc.users.forEach(u => {
      const username = (u as any).username;
      if (onlineUsernames.has(username)) {
        online.push({ username });
      } else {
        offline.push({ username });
      }
    });

    return { online, offline };
  } catch (error) {
    logger.error("getOnlineOfflineDataForGroup hatası", { error: (error as Error).message, groupId });
    return { online: [], offline: [] };
  }
}

/**
 * Bir gruptaki tüm kullanıcılara grup üyelerini yayınlar
 * @param groupId - Grup ID'si
 * @param io - Socket.IO nesnesi
 * @param onlineUsernames - Çevrimiçi kullanıcılar kümesi
 */
export async function broadcastGroupUsers(
  groupId: string,
  io: SocketIOServer,
  onlineUsernames: Set<string>
): Promise<void> {
  try {
    const { online, offline } = await getOnlineOfflineDataForGroup(groupId, onlineUsernames);
    io.to(groupId).emit('groupUsers', { online, offline });
    logger.debug("Grup kullanıcıları yayınlandı", {
      groupId,
      onlineCount: online.length,
      offlineCount: offline.length
    });
  } catch (error) {
    logger.error("broadcastGroupUsers hatası", { error: (error as Error).message, groupId });
  }
}

export default {
  loadGroupsFromDB,
  sendGroupsListToUser,
  createGroup,
  addUserToGroup,
  deleteGroup,
  renameGroup,
  getOnlineOfflineDataForGroup,
  broadcastGroupUsers
};
