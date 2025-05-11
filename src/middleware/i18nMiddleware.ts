/**
 * src/middleware/i18nMiddleware.ts
 * Çoklu dil desteği middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  changeLanguage,
  getCurrentLanguage,
} from '../utils/i18n';

/**
 * Dil middleware'i
 * @param req Express isteği
 * @param res Express yanıtı
 * @param next Sonraki middleware
 */
export function i18nMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Dil kodunu belirle
    let lang = DEFAULT_LANGUAGE;

    // 1. URL parametresinden dil kodu
    if (req.query['lang'] && typeof req.query['lang'] === 'string') {
      const queryLang = req.query['lang'].toLowerCase();

      if (SUPPORTED_LANGUAGES.includes(queryLang)) {
        lang = queryLang;

        // Çerezde dil kodunu güncelle
        res.cookie('lang', lang, {
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1 yıl
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
        });
      }
    }
    // 2. Çerezden dil kodu
    else if (req.cookies && req.cookies.lang) {
      const cookieLang = req.cookies.lang.toLowerCase();

      if (SUPPORTED_LANGUAGES.includes(cookieLang)) {
        lang = cookieLang;
      }
    }
    // 3. Accept-Language başlığından dil kodu
    else if (req.headers['accept-language']) {
      const acceptLanguage = req.headers['accept-language'];
      const languages = acceptLanguage.split(',').map((lang) => {
        const parts = lang.split(';');
        return parts && parts.length > 0 ? parts[0].trim().toLowerCase() : '';
      });

      for (const language of languages) {
        if (SUPPORTED_LANGUAGES.includes(language)) {
          lang = language;
          break;
        }

        // Dil kodunun ilk iki karakterini kontrol et (örn: en-US -> en)
        const shortLang = language.substring(0, 2);
        if (SUPPORTED_LANGUAGES.includes(shortLang)) {
          lang = shortLang;
          break;
        }
      }
    }

    // Dil kodunu değiştir
    changeLanguage(lang);

    // Dil kodunu isteğe ekle
    (req as any).lang = lang;

    // Dil kodunu yanıt başlığına ekle
    res.setHeader('Content-Language', lang);

    next();
  } catch (error) {
    logger.error('Dil middleware\'inde hata oluştu', { error: (error as Error).message });
    next();
  }
}

/**
 * Dil değiştirme middleware'i
 * @param req Express isteği
 * @param res Express yanıtı
 * @param next Sonraki middleware
 */
export function changeLanguageMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Response | void {
  try {
    const { lang } = req.body;

    if (!lang || typeof lang !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Dil kodu gerekli',
          statusCode: 400,
        },
      });
    }

    const language = lang.toLowerCase();

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Desteklenmeyen dil: ${language}`,
          statusCode: 400,
          supportedLanguages: SUPPORTED_LANGUAGES,
        },
      });
    }

    // Dil kodunu değiştir
    changeLanguage(language);

    // Çerezde dil kodunu güncelle
    res.cookie('lang', language, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 yıl
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return res.status(200).json({
      success: true,
      data: {
        language,
        message: 'Dil başarıyla değiştirildi',
      },
    });
  } catch (error) {
    logger.error('Dil değiştirme middleware\'inde hata oluştu', { error: (error as Error).message });

    return res.status(500).json({
      success: false,
      error: {
        message: 'Dil değiştirme başarısız',
        statusCode: 500,
      },
    });
  }
}

export default {
  i18nMiddleware,
  changeLanguageMiddleware,
};
