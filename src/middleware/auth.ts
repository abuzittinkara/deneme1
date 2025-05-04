/**
 * src/middleware/auth.ts
 * Kimlik doğrulama middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import { createAuthMiddleware } from '../utils/express-helpers';
import { AuthRequest, AuthUser } from '../types/express';
import * as jwt from 'jsonwebtoken';
import { getCachedData } from '../config/redis';
import { User, UserDocument } from '../models/User';
import { TokenPayload } from '../config/jwt';
import { createModelHelper } from '../utils/mongoose-helpers';
import * as authManager from '../modules/auth/authManager';
import { logger } from '../utils/logger';

// Model yardımcısı
const UserHelper = createModelHelper<UserDocument>(User);

// AuthRequest tipi artık express-helpers.ts dosyasında tanımlanıyor

/**
 * JWT token doğrulama middleware'i
 */
const authMiddlewareHandler = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Authorization header'ını al
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Kimlik doğrulama hatası: Token bulunamadı',
        code: 'AUTH_TOKEN_MISSING'
      });
      return;
    }

    // Token'ı ayıkla
    const token = authHeader.split(' ')[1];

    // Token'ı doğrula - authManager.verifyAccessToken kullan
    const decoded = authManager.verifyAccessToken(token);

    if (!decoded) {
      res.status(401).json({
        success: false,
        message: 'Kimlik doğrulama hatası: Geçersiz token',
        code: 'AUTH_INVALID_TOKEN'
      });
      return;
    }

    // GELİŞTİRME MODU: Test kullanıcısı için özel durum
    if (process.env.NODE_ENV !== 'production' && decoded.username === 'test') {
      logger.info('Test kullanıcısı kimlik doğrulama (geliştirme modu)');

      // Request nesnesine test kullanıcı bilgisini ekle
      (req as AuthRequest).user = {
        id: decoded.sub,
        username: decoded.username,
        sub: decoded.sub,
        role: decoded.role || 'user'
      };

      next();
      return;
    }

    // Kullanıcı bilgilerini önbellekten veya veritabanından getir
    const user = await getCachedData(
      `user:${decoded.sub}:basic`,
      async () => {
        const userDoc = await UserHelper.findById(decoded.sub, '_id username');
        if (!userDoc) return null;
        return {
          id: userDoc._id.toString(),
          username: userDoc.username
        };
      },
      3600 // 1 saat önbellek süresi
    );

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Kimlik doğrulama hatası: Kullanıcı bulunamadı',
        code: 'AUTH_USER_NOT_FOUND'
      });
      return;
    }

    // Kullanıcı bilgilerini request nesnesine ekle
    (req as AuthRequest).user = {
      id: user.id || decoded.sub,
      username: decoded.username || user.username,
      sub: decoded.sub,
      role: decoded.role || 'user'
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: 'Kimlik doğrulama hatası: Geçersiz token',
        code: 'AUTH_INVALID_TOKEN'
      });
      return;
    }

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: 'Kimlik doğrulama hatası: Token süresi doldu',
        code: 'AUTH_TOKEN_EXPIRED'
      });
      return;
    }

    next(error);
  }
};

// Tip güvenli middleware oluştur
export const authMiddleware = createAuthMiddleware(authMiddlewareHandler);