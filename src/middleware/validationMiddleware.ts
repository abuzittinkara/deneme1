/**
 * src/middleware/validationMiddleware.ts
 * Doğrulama middleware'i
 */
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * İstek doğrulama middleware'i
 *
 * @param schema - Joi doğrulama şeması
 * @returns Middleware fonksiyonu
 */
export const validateRequest = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // İstek gövdesi, sorgu parametreleri ve URL parametrelerini birleştir
      const dataToValidate = {
        ...req.body,
        ...req.query,
        ...req.params,
      };

      // Doğrulama yap
      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false, // Tüm hataları topla
        stripUnknown: true, // Bilinmeyen alanları kaldır
        allowUnknown: true, // Şemada olmayan alanları kabul et
      });

      if (error) {
        // Hata mesajlarını topla
        const errorMessages = error.details.map((detail) => detail.message).join(', ');

        logger.warn('Doğrulama hatası', {
          path: req.path,
          method: req.method,
          errors: error.details.map((detail) => ({
            message: detail.message,
            path: detail.path,
          })),
        });

        throw new ValidationError(errorMessages);
      }

      // Doğrulanmış değerleri istek nesnesine ekle
      req.body = value;

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: {
            message: error.message,
          },
        });
        return;
      }

      logger.error('Doğrulama sırasında beklenmeyen hata', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        success: false,
        error: {
          message: 'Sunucu hatası',
        },
      });
    }
  };
};

/**
 * Şema doğrulama middleware'i
 *
 * @param schema - Joi doğrulama şeması
 * @returns Middleware fonksiyonu
 */
export const validateSchema = (schema: Joi.Schema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sadece istek gövdesini doğrula
      const { error, value } = schema.validate(req.body, {
        abortEarly: false, // Tüm hataları topla
        stripUnknown: true, // Bilinmeyen alanları kaldır
      });

      if (error) {
        // Hata mesajlarını topla
        const errorMessages = error.details.map((detail) => detail.message).join(', ');

        logger.warn('Şema doğrulama hatası', {
          path: req.path,
          method: req.method,
          errors: error.details.map((detail) => ({
            message: detail.message,
            path: detail.path,
          })),
        });

        throw new ValidationError(errorMessages);
      }

      // Doğrulanmış değerleri istek nesnesine ekle
      req.body = value;

      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({
          success: false,
          error: {
            message: error.message,
          },
        });
        return;
      }

      logger.error('Şema doğrulama sırasında beklenmeyen hata', {
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        success: false,
        error: {
          message: 'Sunucu hatası',
        },
      });
    }
  };
};

export default validateRequest;
