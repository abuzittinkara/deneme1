/**
 * src/config/swagger.docs.ts
 * Swagger dokümantasyonu için ortak tanımlamalar
 */

/**
 * @swagger
 * components:
 *   parameters:
 *     limitParam:
 *       name: limit
 *       in: query
 *       description: Sayfa başına öğe sayısı
 *       schema:
 *         type: integer
 *         default: 10
 *         minimum: 1
 *         maximum: 100
 *     pageParam:
 *       name: page
 *       in: query
 *       description: Sayfa numarası
 *       schema:
 *         type: integer
 *         default: 1
 *         minimum: 1
 *     sortParam:
 *       name: sort
 *       in: query
 *       description: Sıralama alanı ve yönü (örn. createdAt:desc)
 *       schema:
 *         type: string
 *         default: createdAt:desc
 *     idParam:
 *       name: id
 *       in: path
 *       description: Öğe ID
 *       required: true
 *       schema:
 *         type: string
 *   responses:
 *     ValidationError:
 *       description: Doğrulama hatası
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ValidationError'
 *     UnauthorizedError:
 *       description: Kimlik doğrulama hatası
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: Kimlik doğrulama hatası
 *                   code:
 *                     type: string
 *                     example: UNAUTHORIZED
 *                   statusCode:
 *                     type: integer
 *                     example: 401
 *     ForbiddenError:
 *       description: Yetkisiz erişim
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: Bu işlem için yetkiniz yok
 *                   code:
 *                     type: string
 *                     example: FORBIDDEN
 *                   statusCode:
 *                     type: integer
 *                     example: 403
 *     NotFoundError:
 *       description: Öğe bulunamadı
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: Öğe bulunamadı
 *                   code:
 *                     type: string
 *                     example: NOT_FOUND
 *                   statusCode:
 *                     type: integer
 *                     example: 404
 *     ServerError:
 *       description: Sunucu hatası
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: object
 *                 properties:
 *                   message:
 *                     type: string
 *                     example: Sunucu hatası
 *                   code:
 *                     type: string
 *                     example: SERVER_ERROR
 *                   statusCode:
 *                     type: integer
 *                     example: 500
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: JWT kimlik doğrulama token'ı
 */
