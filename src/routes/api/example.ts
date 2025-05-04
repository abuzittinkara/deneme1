/**
 * src/routes/api/example.ts
 * Örnek API rotaları
 */

import express from 'express';
import { z } from 'zod';
import { createRouteHandler, createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { requireAuth } from '../../middleware/requireAuth';
import { validateBodyMiddleware, validateParamsMiddleware, validateQueryMiddleware } from '../../middleware/validateRequest';
import { createSuccessResponse, createErrorResponse } from '../../types/api';
import { createMiddlewareChain, createAuthMiddlewareChain } from '../../utils/middleware-chain';
import { userCreateSchema, userUpdateSchema } from '../../validators/user';
import { logger } from '../../utils/logger';

const router = express.Router();

// ID parametresi şeması
const idParamSchema = z.object({
  id: z.string().min(1, { message: 'ID gereklidir' })
});

// Sayfalama sorgu şeması
const paginationQuerySchema = z.object({
  page: z.union([z.string(), z.number()]).optional().transform(val => {
    if (typeof val === 'string') return val ? parseInt(val, 10) : 1;
    return val || 1;
  }),
  limit: z.union([z.string(), z.number()]).optional().transform(val => {
    if (typeof val === 'string') return val ? parseInt(val, 10) : 10;
    return val || 10;
  })
});

/**
 * @route GET /api/example
 * @desc Örnek liste endpoint'i
 * @access Public
 */
router.get('/',
  createMiddlewareChain(
    validateQueryMiddleware(paginationQuerySchema)
  ),
  createRouteHandler(async (req, res, next) => {
    try {
      const result = paginationQuerySchema.safeParse(req.query);
      if (!result.success) {
        return res.status(400).json(createErrorResponse('Geçersiz sayfalama parametreleri'));
      }
      const { page, limit } = result.data;

      // Örnek veri
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: `item-${i + 1}`,
        name: `Örnek Öğe ${i + 1}`,
        createdAt: new Date().toISOString()
      }));

      // Sayfalama
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedItems = items.slice(startIndex, endIndex);

      return res.json(createSuccessResponse({
        items: paginatedItems,
        pagination: {
          page,
          limit,
          total: items.length,
          pages: Math.ceil(items.length / limit)
        }
      }));
    } catch (error) {
      logger.error('Örnek liste hatası', { error: (error as Error).message });
      return res.status(500).json(createErrorResponse('Sunucu hatası'));
    }
  })
);

/**
 * @route GET /api/example/:id
 * @desc Örnek detay endpoint'i
 * @access Public
 */
router.get('/:id',
  createMiddlewareChain(
    validateParamsMiddleware(idParamSchema)
  ),
  createRouteHandler(async (req, res, next) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>;

      // Örnek veri
      const item = {
        id,
        name: `Örnek Öğe ${id}`,
        description: 'Bu bir örnek açıklamadır.',
        createdAt: new Date().toISOString()
      };

      return res.json(createSuccessResponse(item));
    } catch (error) {
      logger.error('Örnek detay hatası', { error: (error as Error).message });
      return res.status(500).json(createErrorResponse('Sunucu hatası'));
    }
  })
);

/**
 * @route POST /api/example
 * @desc Örnek oluşturma endpoint'i
 * @access Private
 */
router.post('/',
  createAuthMiddlewareChain(
    requireAuth,
    validateBodyMiddleware(userCreateSchema)
  ),
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userData = req.body as z.infer<typeof userCreateSchema>;

      // Örnek veri
      const newUser = {
        id: `user-${Date.now()}`,
        ...userData,
        createdAt: new Date().toISOString()
      };

      return res.status(201).json(createSuccessResponse(newUser, 'Kullanıcı başarıyla oluşturuldu'));
    } catch (error) {
      logger.error('Kullanıcı oluşturma hatası', { error: (error as Error).message });
      return res.status(500).json(createErrorResponse('Sunucu hatası'));
    }
  })
);

/**
 * @route PUT /api/example/:id
 * @desc Örnek güncelleme endpoint'i
 * @access Private
 */
router.put('/:id',
  createAuthMiddlewareChain(
    requireAuth,
    validateParamsMiddleware(idParamSchema),
    validateBodyMiddleware(userUpdateSchema)
  ),
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>;
      const userData = req.body as z.infer<typeof userUpdateSchema>;

      // Örnek veri
      const updatedUser = {
        id,
        ...userData,
        updatedAt: new Date().toISOString()
      };

      return res.json(createSuccessResponse(updatedUser, 'Kullanıcı başarıyla güncellendi'));
    } catch (error) {
      logger.error('Kullanıcı güncelleme hatası', { error: (error as Error).message });
      return res.status(500).json(createErrorResponse('Sunucu hatası'));
    }
  })
);

/**
 * @route DELETE /api/example/:id
 * @desc Örnek silme endpoint'i
 * @access Private
 */
router.delete('/:id',
  createAuthMiddlewareChain(
    requireAuth,
    validateParamsMiddleware(idParamSchema)
  ),
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { id } = req.params as z.infer<typeof idParamSchema>;

      // Silme işlemi burada yapılır

      return res.json(createSuccessResponse(null, 'Öğe başarıyla silindi'));
    } catch (error) {
      logger.error('Öğe silme hatası', { error: (error as Error).message });
      return res.status(500).json(createErrorResponse('Sunucu hatası'));
    }
  })
);

export default router;
