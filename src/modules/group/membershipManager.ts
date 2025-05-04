/**
 * src/modules/group/membershipManager.ts
 * Grup üyeliği işlemleri
 */
import { Socket } from 'socket.io';
import { logger } from '../../utils/logger';

// Kullanıcı verisi arayüzü
export interface UserData {
  id: string;
  username: string;
  currentGroup?: string | null;
  currentRoom?: string | null;
}

// Kanal kullanıcısı arayüzü
export interface RoomUser {
  id: string;
  username: string;
}

// Kanal arayüzü
export interface Room {
  id: string;
  name: string;
  type: 'text' | 'voice';
  users: RoomUser[];
}

// Grup arayüzü
export interface Group {
  id: string;
  name: string;
  users: RoomUser[];
  rooms: Record<string, Room>;
}

// Kullanıcılar nesnesi arayüzü
export interface Users {
  [socketId: string]: UserData;
}

// Gruplar nesnesi arayüzü
export interface Groups {
  [groupId: string]: Group;
}

/**
 * Kullanıcıyı tüm gruplardan ve kanallardan çıkarır
 * @param socket - Kullanıcının socket nesnesi
 * @param users - Bellek içi users nesnesi
 * @param groups - Bellek içi groups nesnesi
 */
export function removeUserFromAllGroupsAndRooms(socket: Socket, users: Users, groups: Groups): void {
  try {
    const userData = users[socket.id];
    if (!userData) return;
    
    const { currentGroup, currentRoom, username } = userData;
    
    // Kullanıcıyı mevcut gruptan çıkar
    if (currentGroup && groups[currentGroup]) {
      // Kullanıcıyı grup listesinden çıkar
      groups[currentGroup].users = groups[currentGroup].users.filter(u => u.id !== socket.id);
      
      // Kullanıcıyı mevcut kanaldan çıkar
      if (currentRoom && groups[currentGroup].rooms[currentRoom]) {
        groups[currentGroup].rooms[currentRoom].users = groups[currentGroup].rooms[currentRoom].users.filter(u => u.id !== socket.id);
      }
      
      // Socket'i grup ve kanal odalarından çıkar
      socket.leave(currentGroup);
      if (currentRoom) {
        socket.leave(`${currentGroup}::${currentRoom}`);
      }
      
      logger.info('Kullanıcı gruptan çıkarıldı', { username, groupId: currentGroup, roomId: currentRoom });
    }
    
    // Kullanıcı verilerini sıfırla
    if (userData) {
      userData.currentGroup = null;
      userData.currentRoom = null;
    }
  } catch (error) {
    logger.error('Kullanıcıyı gruplardan çıkarma hatası', { error: (error as Error).message, socketId: socket.id });
  }
}

/**
 * Kullanıcıyı bir gruba ekler
 * @param socket - Kullanıcının socket nesnesi
 * @param groupId - Grup ID'si
 * @param users - Bellek içi users nesnesi
 * @param groups - Bellek içi groups nesnesi
 * @returns İşlem başarılı mı
 */
export function addUserToGroup(socket: Socket, groupId: string, users: Users, groups: Groups): boolean {
  try {
    const userData = users[socket.id];
    if (!userData || !userData.username) {
      logger.warn('Kullanıcı verisi bulunamadı', { socketId: socket.id });
      return false;
    }
    
    // Grup kontrolü
    if (!groups[groupId]) {
      logger.warn('Grup bulunamadı', { groupId });
      return false;
    }
    
    // Kullanıcıyı mevcut gruptan çıkar
    if (userData.currentGroup) {
      removeUserFromAllGroupsAndRooms(socket, users, groups);
    }
    
    // Kullanıcıyı gruba ekle
    if (!groups[groupId].users) {
      groups[groupId].users = [];
    }
    
    groups[groupId].users.push({
      id: socket.id,
      username: userData.username
    });
    
    // Socket'i grup odasına ekle
    socket.join(groupId);
    
    // Kullanıcı verilerini güncelle
    userData.currentGroup = groupId;
    
    logger.info('Kullanıcı gruba eklendi', { username: userData.username, groupId });
    
    return true;
  } catch (error) {
    logger.error('Kullanıcıyı gruba ekleme hatası', { error: (error as Error).message, socketId: socket.id, groupId });
    return false;
  }
}

/**
 * Kullanıcıyı bir kanala ekler
 * @param socket - Kullanıcının socket nesnesi
 * @param groupId - Grup ID'si
 * @param roomId - Kanal ID'si
 * @param users - Bellek içi users nesnesi
 * @param groups - Bellek içi groups nesnesi
 * @returns İşlem başarılı mı
 */
export function addUserToRoom(
  socket: Socket,
  groupId: string,
  roomId: string,
  users: Users,
  groups: Groups
): boolean {
  try {
    const userData = users[socket.id];
    if (!userData || !userData.username) {
      logger.warn('Kullanıcı verisi bulunamadı', { socketId: socket.id });
      return false;
    }
    
    // Grup kontrolü
    if (!groups[groupId]) {
      logger.warn('Grup bulunamadı', { groupId });
      return false;
    }
    
    // Kanal kontrolü
    if (!groups[groupId].rooms || !groups[groupId].rooms[roomId]) {
      logger.warn('Kanal bulunamadı', { groupId, roomId });
      return false;
    }
    
    // Kullanıcı grupta değilse, gruba ekle
    if (userData.currentGroup !== groupId) {
      const addedToGroup = addUserToGroup(socket, groupId, users, groups);
      if (!addedToGroup) {
        return false;
      }
    }
    
    // Kullanıcıyı mevcut kanaldan çıkar
    if (userData.currentRoom) {
      const currentRoomId = userData.currentRoom;
      if (groups[groupId].rooms[currentRoomId]) {
        groups[groupId].rooms[currentRoomId].users = groups[groupId].rooms[currentRoomId].users.filter(u => u.id !== socket.id);
      }
      socket.leave(`${groupId}::${currentRoomId}`);
    }
    
    // Kullanıcıyı kanala ekle
    if (!groups[groupId].rooms[roomId].users) {
      groups[groupId].rooms[roomId].users = [];
    }
    
    groups[groupId].rooms[roomId].users.push({
      id: socket.id,
      username: userData.username
    });
    
    // Socket'i kanal odasına ekle
    socket.join(`${groupId}::${roomId}`);
    
    // Kullanıcı verilerini güncelle
    userData.currentRoom = roomId;
    
    logger.info('Kullanıcı kanala eklendi', { username: userData.username, groupId, roomId });
    
    return true;
  } catch (error) {
    logger.error('Kullanıcıyı kanala ekleme hatası', { error: (error as Error).message, socketId: socket.id, groupId, roomId });
    return false;
  }
}

export default {
  removeUserFromAllGroupsAndRooms,
  addUserToGroup,
  addUserToRoom
};
