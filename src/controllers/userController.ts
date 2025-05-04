/**
 * src/controllers/userController.ts
 * Kullanıcı controller'ı
 */
import { Request, Response, NextFunction } from 'express';
import { User, UserDocument } from '../models/User';
import { asyncHandler, sendSuccess, sendError } from '../utils/controllerUtils';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors';
import { getPaginationParams } from '../utils/db-helpers';
import { paginateQuery, optimizeQuery } from '../utils/queryOptimizer';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import * as emailVerification from '../services/emailService';

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Kullanıcıları listeler
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Sayfa numarası
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Sayfa başına öğe sayısı
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Arama sorgusu
 *     responses:
 *       200:
 *         description: Kullanıcı listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 100
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         pages:
 *                           type: integer
 *                           example: 5
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getUsers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Sayfalama parametrelerini al
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const search = req.query.search as string;
    const sort = req.query.sort as string || '-createdAt';

    if (page < 1 || limit < 1 || limit > 100) {
      throw new ValidationError('Geçersiz sayfalama parametreleri');
    }

    // Arama sorgusu oluştur
    const query: any = {};

    if (search) {
      query.$or = [
        { username: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { surname: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Sıralama seçeneklerini oluştur
    const sortOptions: Record<string, 1 | -1> = {};

    if (sort) {
      const sortFields = sort.split(',');

      for (const field of sortFields) {
        const order = field.startsWith('-') ? -1 : 1;
        const fieldName = field.startsWith('-') ? field.substring(1) : field;

        // Sadece izin verilen alanları sırala
        if (['username', 'name', 'surname', 'email', 'createdAt', 'status'].includes(fieldName)) {
          sortOptions[fieldName] = order;
        }
      }
    }

    // Boş sıralama seçenekleri varsa varsayılan sıralamayı kullan
    if (Object.keys(sortOptions).length === 0) {
      sortOptions.createdAt = -1;
    }

    // Sayfalama ile sorguyu çalıştır
    const result = await paginateQuery(User.find(query), {
      page,
      limit,
      sort: sortOptions,
      select: '-passwordHash -twoFactorSecret -backupCodes',
      lean: true
    });

    // Başarılı yanıt gönder
    return sendSuccess(res, result.data, 200, {
      pagination: result.meta.pagination
    });
  } catch (error) {
    // Hata durumunda loglama yap
    logger.error('Kullanıcıları getirirken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Hatayı yeniden fırlat
    throw error;
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Kullanıcı detaylarını getirir
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcı ID
 *     responses:
 *       200:
 *         description: Kullanıcı detayları
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: Kullanıcı bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getUserById = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;

    // Kullanıcıyı bul (optimize edilmiş sorgu)
    const user = await optimizeQuery(
      User.findById(userId),
      {
        select: '-passwordHash -twoFactorSecret -backupCodes',
        lean: true,
        timeout: 5000 // 5 saniye zaman aşımı
      }
    ).exec();

    if (!user) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    // Kullanıcı son görülme zamanını güncelle (performans için ayrı bir işlem)
    User.findByIdAndUpdate(userId, { lastSeen: new Date() })
      .exec()
      .catch(error => {
        logger.warn('Kullanıcı son görülme zamanı güncellenirken hata oluştu', {
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
          userId
        });
      });

    return sendSuccess(res, user);
  } catch (error) {
    // Hata durumunda loglama yap
    logger.error('Kullanıcı detayları getirilirken hata oluştu', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined,
      userId: req.params.id
    });

    // Hatayı yeniden fırlat
    throw error;
  }
});

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Kullanıcı bilgilerini günceller
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcı ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Ad
 *                 example: John
 *               surname:
 *                 type: string
 *                 description: Soyad
 *                 example: Doe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: E-posta adresi
 *                 example: john@example.com
 *               status:
 *                 type: string
 *                 description: Durum
 *                 enum: [online, away, busy, offline]
 *                 example: online
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla güncellendi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Kullanıcı bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const updateUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id;
  const currentUser = (req as any).user as UserDocument;

  // Yetki kontrolü
  if (currentUser._id.toString() !== userId && currentUser.role !== 'admin') {
    throw new ForbiddenError('Bu işlem için yetkiniz yok');
  }

  // Güncellenecek alanları al
  const { name, surname, email, status } = req.body;

  // Kullanıcıyı bul
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('Kullanıcı bulunamadı');
  }

  // Alanları güncelle
  if (name) user.set('name', name);
  if (surname) user.set('surname', surname);
  const currentEmail = user.get('email');
  if (email && email !== currentEmail) {
    // E-posta değiştiğinde, e-posta doğrulamasını sıfırla
    user.set('email', email);
    user.set('emailVerified', false);
    user.set('emailVerificationToken', uuidv4());

    // E-posta doğrulama e-postası gönder
    try {
      // E-posta doğrulama modülünü içe aktar
      const emailVerificationModule = await import('../modules/emailVerification');
      await emailVerificationModule.sendVerificationEmail(user._id.toString());
    } catch (error) {
      logger.error('E-posta doğrulama e-postası gönderilirken hata oluştu', {
        error: (error as Error).message,
        userId: user._id
      });
    }
  }
  if (status) user.set('status', status);

  // Kullanıcıyı kaydet
  await user.save();

  // Kullanıcı bilgilerini döndür (şifre hariç)
  const userResponse = user.toObject();
  delete userResponse.passwordHash;

  return sendSuccess(res, userResponse);
});

/**
 * @swagger
 * /api/users/{id}/change-password:
 *   post:
 *     summary: Kullanıcı şifresini değiştirir
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcı ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Mevcut şifre
 *                 example: password123
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Şifre başarıyla değiştirildi
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: Şifre başarıyla değiştirildi
 *       400:
 *         description: Geçersiz şifre
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Yetki hatası
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.params.id;
  const currentUser = (req as any).user as UserDocument;

  // Yetki kontrolü
  if (currentUser._id.toString() !== userId && currentUser.role !== 'admin') {
    throw new ForbiddenError('Bu işlem için yetkiniz yok');
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Mevcut şifre ve yeni şifre zorunludur');
  }

  // Kullanıcıyı bul
  const user = await User.findById(userId);

  if (!user) {
    throw new NotFoundError('Kullanıcı bulunamadı');
  }

  // Mevcut şifreyi kontrol et
  const passwordHash = user.get('passwordHash');
  const isPasswordValid = await bcrypt.compare(currentPassword, passwordHash);

  if (!isPasswordValid) {
    throw new ValidationError('Mevcut şifre yanlış');
  }

  // Yeni şifreyi hashle
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Şifreyi güncelle
  user.set('passwordHash', newPasswordHash);

  await user.save();

  return sendSuccess(res, {
    message: 'Şifre başarıyla değiştirildi'
  });
});

export default {
  getUsers,
  getUserById,
  updateUser,
  changePassword
};
