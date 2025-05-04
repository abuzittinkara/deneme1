/**
 * src/middleware/requireAuth.ts
 * Kimlik doğrulama middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { User, UserDocument } from '../models/User';
import { logger } from '../utils/logger';
import { createMiddlewareHelper } from '../utils/express-helpers';
import { AuthRequest } from '../types/express';
import { createModelHelper } from '../utils/mongoose-helpers';
import { TokenPayload } from '../config/jwt';
import * as authManager from '../modules/auth/authManager';

// Model yardımcısı
const UserHelper = createModelHelper<UserDocument>(User);

/**
 * Kimlik doğrulama middleware'i
 * @param req - Express request nesnesi
 * @param res - Express response nesnesi
 * @param next - Express next fonksiyonu
 */
const _requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Authorization header'ını kontrol et
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Kimlik doğrulama başarısız'
      });
    }

    // Token'ı çıkar
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Kimlik doğrulama başarısız'
      });
    }

    try {
      // Token'ı doğrula - authManager.verifyAccessToken kullan
      const decoded = authManager.verifyAccessToken(token);

      if (!decoded) {
        return res.status(401).json({
          success: false,
          message: 'Geçersiz veya süresi dolmuş token'
        });
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

      // Kullanıcıyı kontrol et
      const user = await UserHelper.findById(decoded.sub);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Kullanıcı bulunamadı'
        });
      }

      // Kullanıcı aktif mi kontrol et
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Hesabınız devre dışı bırakılmış'
        });
      }

      // Request nesnesine kullanıcı bilgisini ekle
      (req as AuthRequest).user = {
        id: user._id.toString(),
        username: user.username,
        sub: user._id.toString(),
        role: user.role || 'user'
      };
      next();
    } catch (error) {
      logger.error('Token doğrulama hatası', {
        error: (error as Error).message
      });
      return res.status(401).json({
        success: false,
        message: 'Geçersiz veya süresi dolmuş token'
      });
    }
  } catch (error) {
    logger.error('Kimlik doğrulama hatası', {
      error: (error as Error).message
    });
    return res.status(500).json({
      success: false,
      message: 'Kimlik doğrulama sırasında bir hata oluştu'
    });
  }
};

// Tip güvenli middleware
export const requireAuth = createMiddlewareHelper<AuthRequest>(
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    await _requireAuth(req, res, next);
  }
);