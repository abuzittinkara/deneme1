/**
 * src/modules/activityManager.ts
 * Kullanıcı aktivitesi yönetimi işlemleri
 */
import mongoose from 'mongoose';
import { UserActivity, UserActivityDocument, ActivityType, ActivityTarget, UserActivityModel } from '../models/UserActivity';
import { User, UserDocument } from '../models/User';
import { createModelHelper } from '../utils/mongoose-helpers';
import { logger } from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { toObjectId } from '../utils/mongoose-helpers';

// Model yardımcıları
const UserActivityHelper = createModelHelper<UserActivityDocument, typeof UserActivity>(UserActivity);
const UserHelper = createModelHelper<UserDocument, typeof User>(User);

// Aktivite kaydetme parametreleri
export interface LogActivityParams {
  userId: string;
  type: ActivityType;
  ipAddress?: string;
  userAgent?: string;
  target?: {
    type: 'message' | 'directMessage' | 'user' | 'group' | 'channel' | 'role';
    id: string;
  };
  metadata?: Record<string, any>;
}

// Aktivite sonucu
export interface ActivityResult {
  id: string;
  user: {
    id: string;
    username: string;
  };
  type: ActivityType;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  target?: ActivityTarget;
  metadata?: Record<string, any>;
}

/**
 * Kullanıcı aktivitesi kaydeder
 * @param params - Aktivite parametreleri
 * @returns Kaydedilen aktivite
 */
export async function logActivity(
  params: LogActivityParams
): Promise<UserActivityDocument> {
  try {
    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(params.userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Aktivite hedefini oluştur (varsa)
    let target;
    if (params.target) {
      target = {
        type: params.target.type,
        id: toObjectId(params.target.id)
      };
    }

    // Aktiviteyi kaydet
    const activity = await (UserActivity as UserActivityModel).logActivity({
      user: toObjectId(params.userId),
      type: params.type,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      target,
      metadata: params.metadata
    });

    logger.debug('Kullanıcı aktivitesi kaydedildi', {
      activityId: activity._id,
      userId: params.userId,
      type: params.type
    });

    return activity;
  } catch (error) {
    logger.error('Kullanıcı aktivitesi kaydetme hatası', {
      error: (error as Error).message,
      userId: params.userId,
      type: params.type
    });
    throw error;
  }
}

/**
 * Kullanıcının aktivitelerini getirir
 * @param userId - Kullanıcı ID'si
 * @param limit - Limit
 * @returns Kullanıcı aktiviteleri
 */
export async function getUserActivities(
  userId: string,
  limit = 50
): Promise<UserActivityDocument[]> {
  try {
    // Kullanıcıyı kontrol et
    const user = await UserHelper.findById(userId);
    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Aktiviteleri getir
    const activities = await (UserActivity as UserActivityModel).findByUser(toObjectId(userId), limit);

    logger.debug('Kullanıcı aktiviteleri getirildi', {
      userId,
      count: activities.length
    });

    return activities;
  } catch (error) {
    logger.error('Kullanıcı aktivitelerini getirme hatası', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

/**
 * Belirli bir türdeki aktiviteleri getirir
 * @param type - Aktivite türü
 * @param limit - Limit
 * @returns Aktiviteler
 */
export async function getActivitiesByType(
  type: ActivityType,
  limit = 50
): Promise<UserActivityDocument[]> {
  try {
    // Aktiviteleri getir
    const activities = await (UserActivity as UserActivityModel).findByType(type, limit);

    logger.debug('Aktiviteler türe göre getirildi', {
      type,
      count: activities.length
    });

    return activities;
  } catch (error) {
    logger.error('Aktiviteleri türe göre getirme hatası', {
      error: (error as Error).message,
      type
    });
    throw error;
  }
}

/**
 * Belirli bir hedefle ilgili aktiviteleri getirir
 * @param targetType - Hedef türü
 * @param targetId - Hedef ID'si
 * @param limit - Limit
 * @returns Aktiviteler
 */
export async function getActivitiesByTarget(
  targetType: string,
  targetId: string,
  limit = 50
): Promise<UserActivityDocument[]> {
  try {
    // Aktiviteleri getir
    const activities = await (UserActivity as UserActivityModel).findByTarget(
      targetType,
      toObjectId(targetId),
      limit
    );

    logger.debug('Aktiviteler hedefe göre getirildi', {
      targetType,
      targetId,
      count: activities.length
    });

    return activities;
  } catch (error) {
    logger.error('Aktiviteleri hedefe göre getirme hatası', {
      error: (error as Error).message,
      targetType,
      targetId
    });
    throw error;
  }
}

/**
 * Aktivite dokümanını sonuç formatına dönüştürür
 * @param activity - Aktivite dokümanı
 * @returns Aktivite sonucu
 */
export function formatActivity(activity: UserActivityDocument): ActivityResult {
  const result: ActivityResult = {
    id: activity._id.toString(),
    user: {
      id: activity.user.toString(),
      username: (activity.user as any)?.username || 'Unknown'
    },
    type: activity.type,
    timestamp: activity.timestamp
  };

  // IP adresi ekle (varsa)
  if (activity.ipAddress) {
    result.ipAddress = activity.ipAddress;
  }

  // Kullanıcı tarayıcı bilgisi ekle (varsa)
  if (activity.userAgent) {
    result.userAgent = activity.userAgent;
  }

  // Hedef bilgisini ekle (varsa)
  if (activity.target) {
    result.target = activity.target;
  }

  // Ek bilgileri ekle (varsa)
  if (activity.metadata) {
    result.metadata = activity.metadata;
  }

  return result;
}

export default {
  logActivity,
  getUserActivities,
  getActivitiesByType,
  getActivitiesByTarget,
  formatActivity
};
