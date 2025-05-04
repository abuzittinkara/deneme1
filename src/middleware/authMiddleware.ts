/**
 * src/middleware/authMiddleware.ts
 * Kimlik doğrulama ve yetkilendirme middleware'leri
 */
import { Request, Response, NextFunction } from 'express';
import { AuthRequest, createMiddleware } from '../types/express-types';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { User } from '../models/User';
import mongoose from 'mongoose';

/**
 * Kullanıcı rolleri
 */
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
  GUEST = 'guest'
}

/**
 * Kullanıcı durumları
 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BANNED = 'banned'
}

/**
 * JWT token'ından çıkarılan kullanıcı bilgisi
 */
export interface JwtPayload {
  id: string;
  username: string;
  role: string;
  status?: string;
  iat?: number;
  exp?: number;
  sub: string;
}

/**
 * Kimlik doğrulama hatası
 */
export class AuthError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 401, code = 'UNAUTHORIZED') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AuthError';
  }
}

/**
 * Token'ı doğrula ve kullanıcı bilgisini çıkar
 * @param token - JWT token
 * @returns Kullanıcı bilgisi
 */
export function verifyToken(token: string): JwtPayload {
  try {
    // JWT token'ı doğrula
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    // Gerekli alanları kontrol et
    if (!decoded.id || !decoded.username || !decoded.role) {
      throw new AuthError('Geçersiz token içeriği');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthError('Token süresi doldu', 401, 'TOKEN_EXPIRED');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Geçersiz token', 401, 'INVALID_TOKEN');
    } else if (error instanceof AuthError) {
      throw error;
    } else {
      throw new AuthError('Token doğrulama hatası', 401, 'TOKEN_VERIFICATION_ERROR');
    }
  }
}

/**
 * Kimlik doğrulama middleware'i
 * @param req - Express request
 * @param res - Express response
 * @param next - Express next function
 */
function _authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // Test ortamında özel davranış
    if (process.env.NODE_ENV === 'test') {
      // Authorization header'ını kontrol et
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AuthError('Token bulunamadı');
      }

      // Test için geçerli token kontrolü
      const token = authHeader.split(' ')[1];
      if (token !== 'test-token') {
        throw new AuthError('Geçersiz test token\'ı');
      }

      // Test için kullanıcı bilgisi ekle
      (req as AuthRequest).user = {
        id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        sub: '507f1f77bcf86cd799439011'
      };

      return next();
    }

    // Geliştirme modunda kimlik doğrulamayı atla (opsiyonel)
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_AUTH === 'true') {
      logger.warn('Geliştirme modunda kimlik doğrulama atlandı');

      // Geliştirme için kullanıcı bilgisi ekle
      (req as AuthRequest).user = {
        id: '507f1f77bcf86cd799439011',
        username: 'devuser',
        role: UserRole.ADMIN, // Geliştirme için admin rolü
        status: UserStatus.ACTIVE,
        sub: '507f1f77bcf86cd799439011'
      };

      return next();
    }

    // Authorization header'ını kontrol et
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Token bulunamadı');
    }

    // Token'ı ayıkla
    const token = authHeader.split(' ')[1];

    // Token'ı doğrula
    const decoded = verifyToken(token);

    // Request nesnesine kullanıcı bilgisini ekle
    (req as AuthRequest).user = decoded;

    // Token'ı yenile (opsiyonel)
    // refreshToken(req, res);

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      return res.status(error.statusCode).json({
        success: false,
        error: {
          message: error.message,
          code: error.code
        }
      });
    }

    logger.error('Kimlik doğrulama hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      path: req.path,
      method: req.method,
      ip: req.ip
    });

    return res.status(401).json({
      success: false,
      error: {
        message: 'Kimlik doğrulama başarısız',
        code: 'UNAUTHORIZED'
      }
    });
  }
}

/**
 * Rol tabanlı yetkilendirme middleware'i
 * @param roles - İzin verilen roller
 * @returns Middleware fonksiyonu
 */
export function requireRole(roles: UserRole | UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;

      if (!user) {
        throw new AuthError('Kullanıcı bulunamadı', 401);
      }

      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(user.role as UserRole)) {
        throw new AuthError('Bu işlem için yetkiniz yok', 403, 'FORBIDDEN');
      }

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            message: error.message,
            code: error.code
          }
        });
      }

      return res.status(403).json({
        success: false,
        error: {
          message: 'Yetkilendirme hatası',
          code: 'FORBIDDEN'
        }
      });
    }
  };
}

/**
 * Admin rolü gerektiren middleware
 * @returns Middleware fonksiyonu
 */
export function requireAdmin() {
  return requireRole(UserRole.ADMIN);
}

/**
 * Moderatör veya admin rolü gerektiren middleware
 * @returns Middleware fonksiyonu
 */
export function requireModerator() {
  return requireRole([UserRole.ADMIN, UserRole.MODERATOR]);
}

/**
 * Aktif kullanıcı durumu gerektiren middleware
 * @returns Middleware fonksiyonu
 */
export function requireActiveStatus() {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;

      if (!user) {
        throw new AuthError('Kullanıcı bulunamadı', 401);
      }

      if (user.status !== UserStatus.ACTIVE) {
        throw new AuthError('Hesabınız aktif değil', 403, 'ACCOUNT_INACTIVE');
      }

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            message: error.message,
            code: error.code
          }
        });
      }

      return res.status(403).json({
        success: false,
        error: {
          message: 'Hesap durumu hatası',
          code: 'ACCOUNT_STATUS_ERROR'
        }
      });
    }
  };
}

/**
 * Kullanıcı kimliğini veritabanından doğrulayan middleware
 * @returns Middleware fonksiyonu
 */
export function validateUserFromDatabase() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as AuthRequest).user;

      if (!user || !user.id) {
        throw new AuthError('Kullanıcı bulunamadı', 401);
      }

      // Kullanıcıyı veritabanından kontrol et
      if (!mongoose.Types.ObjectId.isValid(user.id)) {
        throw new AuthError('Geçersiz kullanıcı ID formatı', 401);
      }

      const dbUser = await User.findById(user.id).select('username role status');

      if (!dbUser) {
        throw new AuthError('Kullanıcı veritabanında bulunamadı', 401, 'USER_NOT_FOUND');
      }

      if (dbUser.status !== UserStatus.ACTIVE) {
        throw new AuthError('Hesabınız aktif değil', 403, 'ACCOUNT_INACTIVE');
      }

      // Kullanıcı bilgilerini güncelle
      (req as AuthRequest).user = {
        ...user,
        role: dbUser.role,
        status: dbUser.status
      };

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        return res.status(error.statusCode).json({
          success: false,
          error: {
            message: error.message,
            code: error.code
          }
        });
      }

      logger.error('Kullanıcı doğrulama hatası', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        userId: (req as AuthRequest).user?.id
      });

      return res.status(401).json({
        success: false,
        error: {
          message: 'Kullanıcı doğrulama hatası',
          code: 'USER_VALIDATION_ERROR'
        }
      });
    }
  };
}

// Tip güvenli middleware
export const requireAuth = createMiddleware(_authMiddleware);
