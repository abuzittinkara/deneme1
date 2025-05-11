/**
 * src/middleware/authorizationMiddleware.ts
 * Yetkilendirme middleware'leri
 */
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errors';
import { logger } from '../utils/logger';
import { hasPermission, getUserIdFromRequest } from '../utils/authorizationHelper';

/**
 * Kaynak erişim yetkisi kontrolü yapan middleware
 *
 * @param resourceType - Kaynak tipi
 * @param requiredPermission - Gerekli izin
 * @param getResourceId - Kaynak ID'sini almak için fonksiyon
 * @returns Express middleware
 */
export function authorizeResource(
  resourceType: 'group' | 'channel' | 'message' | 'user',
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view',
  getResourceId: (req: Request) => string = (req) => req.params['id'] || ''
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Kullanıcı ID'sini al
      const userId = getUserIdFromRequest(req);

      // Kaynak ID'sini al
      const resourceId = getResourceId(req);

      if (!resourceId) {
        return next(new ForbiddenError('Geçersiz kaynak ID'));
      }

      // Yetki kontrolü yap
      const hasAccess = await hasPermission(userId, resourceId, resourceType, requiredPermission);

      if (!hasAccess) {
        return next(
          new ForbiddenError(`Bu işlem için yetkiniz yok: ${resourceType} ${requiredPermission}`)
        );
      }

      next();
    } catch (error) {
      logger.error('Yetkilendirme hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        resourceType,
        requiredPermission,
        path: req.path,
        method: req.method,
      });

      next(error);
    }
  };
}

/**
 * Grup erişim yetkisi kontrolü yapan middleware
 *
 * @param requiredPermission - Gerekli izin
 * @returns Express middleware
 */
export function authorizeGroup(requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view') {
  return authorizeResource('group', requiredPermission);
}

/**
 * Kanal erişim yetkisi kontrolü yapan middleware
 *
 * @param requiredPermission - Gerekli izin
 * @returns Express middleware
 */
export function authorizeChannel(
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view'
) {
  return authorizeResource('channel', requiredPermission);
}

/**
 * Mesaj erişim yetkisi kontrolü yapan middleware
 *
 * @param requiredPermission - Gerekli izin
 * @returns Express middleware
 */
export function authorizeMessage(
  requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view'
) {
  return authorizeResource('message', requiredPermission);
}

/**
 * Kullanıcı erişim yetkisi kontrolü yapan middleware
 *
 * @param requiredPermission - Gerekli izin
 * @returns Express middleware
 */
export function authorizeUser(requiredPermission: 'view' | 'edit' | 'delete' | 'admin' = 'view') {
  return authorizeResource(
    'user',
    requiredPermission,
    (req) => req.params['userId'] || req.params['id'] || ''
  );
}

/**
 * Admin rolü kontrolü yapan middleware
 *
 * @returns Express middleware
 */
export function requireAdmin() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(new ForbiddenError('Yetkilendirme gerekli'));
    }

    if (user.role !== 'admin') {
      return next(new ForbiddenError('Bu işlem için admin yetkisi gerekli'));
    }

    next();
  };
}

/**
 * Moderatör rolü kontrolü yapan middleware
 *
 * @returns Express middleware
 */
export function requireModerator() {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return next(new ForbiddenError('Yetkilendirme gerekli'));
    }

    if (!['admin', 'moderator'].includes(user.role)) {
      return next(new ForbiddenError('Bu işlem için moderatör yetkisi gerekli'));
    }

    next();
  };
}

export default {
  authorizeResource,
  authorizeGroup,
  authorizeChannel,
  authorizeMessage,
  authorizeUser,
  requireAdmin,
  requireModerator,
};
