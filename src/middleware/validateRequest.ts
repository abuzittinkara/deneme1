/**
 * src/middleware/validateRequest.ts
 * İstek doğrulama middleware'i
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createMiddlewareHelper } from '../utils/express-helpers';
import { createErrorResponse } from '../types/api';
import { validationResult } from 'express-validator';

/**
 * Express-validator ile yapılan doğrulamaları kontrol eder
 * @param req - Express request nesnesi
 * @param res - Express response nesnesi
 * @param next - Express next fonksiyonu
 */
export const validateRequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      errors: errors.array(),
    });
    return;
  }
  next();
};

export const validateRequest = createMiddlewareHelper(validateRequestHandler);

/**
 * İstek gövdesini doğrulayan middleware oluşturur
 * @param schema - Zod şeması
 * @returns Middleware fonksiyonu
 */
export function validateBody<T>(schema: z.ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: 'VALIDATION_ERROR',
        }));

        res.status(400).json(createErrorResponse('Doğrulama hatası', 'VALIDATION_ERROR', errors));
        return;
      }

      // Doğrulanmış veriyi req.body'ye ata
      req.body = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * İstek parametrelerini doğrulayan middleware oluşturur
 * @param schema - Zod şeması
 * @returns Middleware fonksiyonu
 */
export function validateParams<T>(schema: z.ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: 'VALIDATION_ERROR',
        }));

        res.status(400).json(createErrorResponse('Doğrulama hatası', 'VALIDATION_ERROR', errors));
        return;
      }

      // Doğrulanmış veriyi req.params'a ata
      req.params = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * İstek sorgusunu doğrulayan middleware oluşturur
 * @param schema - Zod şeması
 * @returns Middleware fonksiyonu
 */
export function validateQuery<T>(schema: z.ZodType<T>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const errors = result.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
          code: 'VALIDATION_ERROR',
        }));

        res.status(400).json(createErrorResponse('Doğrulama hatası', 'VALIDATION_ERROR', errors));
        return;
      }

      // Doğrulanmış veriyi req.query'ye ata
      req.query = result.data as any;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * İstek doğrulama middleware'lerini dışa aktar
 */
export const validateRequestZod = {
  body: validateBody,
  params: validateParams,
  query: validateQuery,
};

// Tip güvenli middleware'ler oluştur
export const validateBodyMiddleware = <T>(schema: z.ZodType<T>) =>
  createMiddlewareHelper(validateBody(schema));
export const validateParamsMiddleware = <T>(schema: z.ZodType<T>) =>
  createMiddlewareHelper(validateParams(schema));
export const validateQueryMiddleware = <T>(schema: z.ZodType<T>) =>
  createMiddlewareHelper(validateQuery(schema));
