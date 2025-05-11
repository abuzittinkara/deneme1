/**
 * src/modules/session/sessionManager.ts
 * Oturum yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { Session, SessionDocument } from '../../models/Session';
import { redisClient, setHashCache, getAllHashCache, deleteCache } from '../../config/redis';
import { logger } from '../../utils/logger';
import { createModelHelper } from '../../utils/mongoose-helpers';

// Tip güvenli model yardımcıları
const SessionHelper = createModelHelper<SessionDocument, typeof Session>(Session);

// Oturum TTL (24 saat)
const SESSION_TTL = 24 * 60 * 60;

// Redis'te saklanan oturum verisi arayüzü
export interface SessionData {
  _id: string;
  user: string;
  socketId: string;
  userAgent?: string;
  ipAddress?: string;
  lastActivity: string;
  createdAt: string;
}

// Kullanıcı oturum bilgisi arayüzü
export interface UserSessionInfo {
  sessionId: string;
  socketId: string;
}

/**
 * Yeni oturum oluşturur
 * @param userId - Kullanıcı ID'si
 * @param socketId - Socket ID'si
 * @param userAgent - Kullanıcı tarayıcı bilgisi
 * @param ipAddress - IP adresi
 * @returns Oluşturulan oturum
 */
export async function createSession(
  userId: string,
  socketId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<SessionDocument> {
  try {
    // Veritabanında oturum oluştur
    const session = new Session({
      user: userId,
      socketId,
      userAgent,
      ipAddress,
      lastActivity: new Date(),
      isActive: true,
    });

    await session.save();

    // Redis'e oturum bilgilerini kaydet
    const sessionData: SessionData = {
      _id: session._id.toString(),
      user: userId,
      socketId,
      userAgent,
      ipAddress,
      lastActivity: new Date().toISOString(),
      createdAt: session.createdAt.toISOString(),
    };

    // Socket ID'si ile oturum eşleştirmesi
    await setHashCache('sessions:socket', socketId, session._id.toString(), SESSION_TTL);

    // Kullanıcı ID'si ile oturum eşleştirmesi
    await setHashCache(
      'sessions:user',
      userId,
      {
        sessionId: session._id.toString(),
        socketId,
      } as UserSessionInfo,
      SESSION_TTL
    );

    // Oturum detayları
    await setHashCache('sessions:details', session._id.toString(), sessionData, SESSION_TTL);

    logger.info('Oturum oluşturuldu', { userId, socketId, sessionId: session._id });

    return session;
  } catch (error) {
    logger.error('Oturum oluşturma hatası', { error: (error as Error).message, userId, socketId });
    throw error;
  }
}

/**
 * Socket ID'sine göre oturumu sonlandırır
 * @param socketId - Socket ID'si
 * @returns İşlem başarılı mı
 */
export async function endSessionBySocketId(socketId: string): Promise<boolean> {
  try {
    // Redis'ten oturum ID'sini al
    const sessionId = await getAllHashCache<string>('sessions:socket', socketId);

    if (!sessionId) {
      logger.warn('Sonlandırılacak oturum bulunamadı', { socketId });
      return false;
    }

    // Oturum detaylarını al
    const sessionDetails = await getAllHashCache<SessionData>('sessions:details', sessionId);

    if (!sessionDetails) {
      logger.warn('Oturum detayları bulunamadı', { socketId, sessionId });
      return false;
    }

    // Veritabanında oturumu güncelle
    await SessionHelper.findByIdAndUpdate(sessionId, {
      isActive: false,
      logoutTime: new Date(),
    });

    // Redis'ten oturum bilgilerini sil
    await deleteCache(`sessions:socket:${socketId}`);
    await deleteCache(`sessions:user:${sessionDetails.user}`);
    await deleteCache(`sessions:details:${sessionId}`);

    logger.info('Oturum sonlandırıldı', { socketId, sessionId });

    return true;
  } catch (error) {
    logger.error('Oturum sonlandırma hatası', { error: (error as Error).message, socketId });
    return false;
  }
}

/**
 * Kullanıcı ID'sine göre aktif oturumları getirir
 * @param userId - Kullanıcı ID'si
 * @returns Aktif oturumlar
 */
export async function getUserActiveSessions(userId: string): Promise<SessionDocument[]> {
  try {
    // Veritabanından aktif oturumları getir
    const sessions = await SessionHelper.find({
      user: userId,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .exec();

    logger.debug('Kullanıcı aktif oturumları getirildi', { userId, count: sessions.length });

    return sessions;
  } catch (error) {
    logger.error('Kullanıcı oturumları getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Oturum aktivitesini günceller
 * @param sessionId - Oturum ID'si
 * @returns İşlem başarılı mı
 */
export async function updateSessionActivity(sessionId: string): Promise<boolean> {
  try {
    // Veritabanında oturumu güncelle
    await SessionHelper.findByIdAndUpdate(sessionId, {
      lastActivity: new Date(),
    });

    // Redis'te oturum detaylarını güncelle
    const sessionDetails = await getAllHashCache<SessionData>('sessions:details', sessionId);

    if (sessionDetails) {
      sessionDetails.lastActivity = new Date().toISOString();
      await setHashCache('sessions:details', sessionId, sessionDetails, SESSION_TTL);
    }

    return true;
  } catch (error) {
    logger.error('Oturum aktivitesi güncelleme hatası', {
      error: (error as Error).message,
      sessionId,
    });
    return false;
  }
}

/**
 * Oturum ID'sine göre oturumu sonlandırır
 * @param sessionId - Oturum ID'si
 * @returns İşlem başarılı mı
 */
export async function endSessionById(sessionId: string): Promise<boolean> {
  try {
    // Oturum detaylarını al
    const sessionDetails = await getAllHashCache<SessionData>('sessions:details', sessionId);

    // Veritabanında oturumu güncelle
    await SessionHelper.findByIdAndUpdate(sessionId, {
      isActive: false,
      logoutTime: new Date(),
    });

    // Redis'ten oturum bilgilerini sil
    if (sessionDetails) {
      await deleteCache(`sessions:socket:${sessionDetails.socketId}`);
      await deleteCache(`sessions:user:${sessionDetails.user}`);
    }

    await deleteCache(`sessions:details:${sessionId}`);

    logger.info('Oturum sonlandırıldı', { sessionId });

    return true;
  } catch (error) {
    logger.error('Oturum sonlandırma hatası', { error: (error as Error).message, sessionId });
    return false;
  }
}

/**
 * Kullanıcı ID'sine göre tüm oturumları sonlandırır
 * @param userId - Kullanıcı ID'si
 * @returns Sonlandırılan oturum sayısı
 */
export async function endAllUserSessions(userId: string): Promise<number> {
  try {
    // Veritabanında oturumları güncelle
    const result = await SessionHelper.getModel().updateMany(
      { user: userId, isActive: true },
      { isActive: false, logoutTime: new Date() }
    );

    // Redis'ten kullanıcı oturum bilgilerini sil
    const userSession = await getAllHashCache<UserSessionInfo>('sessions:user', userId);

    if (userSession) {
      await deleteCache(`sessions:socket:${userSession.socketId}`);
      await deleteCache(`sessions:details:${userSession.sessionId}`);
      await deleteCache(`sessions:user:${userId}`);
    }

    logger.info('Tüm kullanıcı oturumları sonlandırıldı', { userId, count: result.modifiedCount });

    return result.modifiedCount;
  } catch (error) {
    logger.error('Tüm kullanıcı oturumlarını sonlandırma hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Süresi dolmuş oturumları temizler
 * @param inactiveMinutes - İnaktif dakika sayısı (varsayılan: 24 saat)
 * @returns Temizlenen oturum sayısı
 */
export async function cleanupExpiredSessions(inactiveMinutes = 1440): Promise<number> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setMinutes(cutoffDate.getMinutes() - inactiveMinutes);

    // Veritabanında oturumları güncelle
    const result = await SessionHelper.getModel().updateMany(
      { isActive: true, lastActivity: { $lt: cutoffDate } },
      { isActive: false, logoutTime: new Date() }
    );

    logger.info('Süresi dolmuş oturumlar temizlendi', {
      count: result.modifiedCount,
      inactiveMinutes,
    });

    return result.modifiedCount;
  } catch (error) {
    logger.error('Oturum temizleme hatası', { error: (error as Error).message, inactiveMinutes });
    throw error;
  }
}

/**
 * Oturum ID'sine göre oturumu getirir
 * @param sessionId - Oturum ID'si
 * @returns Oturum
 */
export async function getSessionById(sessionId: string): Promise<SessionDocument | null> {
  try {
    // Veritabanından oturumu getir
    const session = await Session.findOne({ _id: sessionId });

    if (!session) {
      logger.debug('Oturum bulunamadı', { sessionId });
      return null;
    }

    return session;
  } catch (error) {
    logger.error('Oturum getirme hatası', { error: (error as Error).message, sessionId });
    throw error;
  }
}

/**
 * Kullanıcının oturumlarını getirir
 * @param userId - Kullanıcı ID'si
 * @returns Oturumlar
 */
export async function getUserSessions(userId: string): Promise<SessionDocument[]> {
  try {
    // Veritabanından oturumları getir
    const sessions = await Session.find({
      user: userId,
    })
      .sort({ createdAt: -1 })
      .exec();

    logger.debug('Kullanıcı oturumları getirildi', { userId, count: sessions.length });

    return sessions;
  } catch (error) {
    logger.error('Kullanıcı oturumları getirme hatası', {
      error: (error as Error).message,
      userId,
    });
    throw error;
  }
}

/**
 * Belirli bir oturum dışındaki tüm oturumları sonlandırır
 * @param userId - Kullanıcı ID'si
 * @param currentSessionId - Mevcut oturum ID'si
 * @returns Sonlandırılan oturum sayısı
 */
export async function endAllSessionsExcept(
  userId: string,
  currentSessionId: string
): Promise<number> {
  try {
    // Veritabanında oturumları güncelle
    const result = await Session.updateMany(
      { user: userId, isActive: true, _id: { $ne: currentSessionId } },
      { isActive: false, logoutTime: new Date() }
    );

    logger.info('Diğer tüm kullanıcı oturumları sonlandırıldı', {
      userId,
      currentSessionId,
      count: result.modifiedCount,
    });

    return result.modifiedCount;
  } catch (error) {
    logger.error('Diğer tüm kullanıcı oturumlarını sonlandırma hatası', {
      error: (error as Error).message,
      userId,
      currentSessionId,
    });
    throw error;
  }
}

export default {
  createSession,
  endSessionBySocketId,
  getUserActiveSessions,
  updateSessionActivity,
  endSessionById,
  endAllUserSessions,
  cleanupExpiredSessions,
  getSessionById,
  getUserSessions,
  endAllSessionsExcept,
};
