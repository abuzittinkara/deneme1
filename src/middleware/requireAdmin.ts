/**
 * src/middleware/requireAdmin.ts
 * Admin yetkisi gerektiren rotalar için middleware
 */
import { Request, Response, NextFunction } from 'express';
import { createError } from '../utils/appError';

/**
 * Admin yetkisi kontrolü yapan middleware
 * @param req - Express istek nesnesi
 * @param res - Express yanıt nesnesi
 * @param next - Express sonraki fonksiyon
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    // Kullanıcı bilgisini kontrol et
    if (!(req as any).user) {
      return next(createError('authentication', 'Kimlik doğrulama gerekli'));
    }
    
    // Admin yetkisini kontrol et
    if ((req as any).user.role !== 'admin') {
      return next(createError('authorization', 'Bu işlem için admin yetkisi gerekli'));
    }
    
    // Admin yetkisi var, devam et
    next();
  } catch (error) {
    next(createError('server', 'Yetki kontrolü sırasında hata oluştu'));
  }
}

export default requireAdmin;
