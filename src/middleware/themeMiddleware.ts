/**
 * src/middleware/themeMiddleware.ts
 * Tema middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ThemeType } from '../config/themes';
import themeManager from '../utils/themeManager';

/**
 * Tema middleware'i
 * @param req Express isteği
 * @param res Express yanıtı
 * @param next Sonraki middleware
 */
export function themeMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Tema türünü belirle
    let theme: ThemeType = 'light';

    // 1. URL parametresinden tema türü
    if (req.query.theme && typeof req.query.theme === 'string') {
      const queryTheme = req.query.theme.toLowerCase() as ThemeType;

      if (queryTheme === 'light' || queryTheme === 'dark' || queryTheme === 'system') {
        theme = queryTheme;

        // Çerezde tema türünü güncelle
        res.cookie('theme', theme, {
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1 yıl
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });
      }
    }
    // 2. Çerezden tema türü
    else if (req.cookies && req.cookies.theme) {
      const cookieTheme = req.cookies.theme.toLowerCase() as ThemeType;

      if (cookieTheme === 'light' || cookieTheme === 'dark' || cookieTheme === 'system') {
        theme = cookieTheme;
      }
    }

    // Tema türünü değiştir
    themeManager.changeTheme(theme);

    // Tema türünü isteğe ekle
    (req as any).theme = theme;

    next();
  } catch (error) {
    logger.error('Tema middleware\'inde hata oluştu', { error: (error as Error).message });
    next();
  }
}

/**
 * Tema değiştirme middleware'i
 * @param req Express isteği
 * @param res Express yanıtı
 * @param next Sonraki middleware
 */
export function changeThemeMiddleware(req: Request, res: Response, next: NextFunction): Response | void {
  try {
    const { theme } = req.body;

    if (!theme || typeof theme !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Tema türü gerekli',
          statusCode: 400
        }
      });
    }

    const themeType = theme.toLowerCase() as ThemeType;

    if (themeType !== 'light' && themeType !== 'dark' && themeType !== 'system') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Geçersiz tema türü: ${themeType}`,
          statusCode: 400,
          supportedThemes: ['light', 'dark', 'system']
        }
      });
    }

    // Tema türünü değiştir
    themeManager.changeTheme(themeType);

    // Çerezde tema türünü güncelle
    res.cookie('theme', themeType, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 yıl
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    return res.status(200).json({
      success: true,
      data: {
        theme: themeType,
        message: 'Tema başarıyla değiştirildi'
      }
    });
  } catch (error) {
    logger.error('Tema değiştirme middleware\'inde hata oluştu', { error: (error as Error).message });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Tema değiştirme başarısız',
        statusCode: 500
      }
    });
  }
}

/**
 * Tema CSS servis middleware'i
 * @param req Express isteği
 * @param res Express yanıtı
 */
export function themeCSS(req: Request, res: Response): Response | void {
  themeManager.serveThemeCSS(req, res);
}

export default {
  themeMiddleware,
  changeThemeMiddleware,
  themeCSS
};
