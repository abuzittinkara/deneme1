/**
 * src/routes/api/users.ts
 * Kullanıcı API endpoint'leri
 */
import express from 'express';
import { createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import { authorizeUser, requireModerator } from '../../middleware/authorizationMiddleware';
import * as userManager from '../../modules/user/userManager';
import * as blockManager from '../../modules/user/blockManager';
import * as reportManager from '../../modules/user/reportManager';
import * as activityManager from '../../modules/user/activityManager';
import { logger } from '../../utils/logger';
import { sanitizeAll } from '../../utils/sanitizer';

const router = express.Router();

/**
 * @route   GET /api/users/me
 * @desc    Giriş yapmış kullanıcının bilgilerini getirir
 * @access  Private
 */
router.get(
  '/me',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const user = await userManager.getUserProfile(userId);

      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Kullanıcı bilgilerini getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Kullanıcı bilgileri getirilirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   GET /api/users/:username
 * @desc    Kullanıcı profilini getirir
 * @access  Private
 */
router.get(
  '/:username',
  requireAuth,
  [
    param('username')
      .isString()
      .notEmpty()
      .withMessage('Geçersiz kullanıcı adı')
      .customSanitizer(value => sanitizeAll(value))
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { username } = req.params;

      const user = await userManager.getUserProfileByUsername(username);

      // Kullanıcı bulunduktan sonra yetkilendirme kontrolü yap
      // Bu durumda sadece görüntüleme yetkisi yeterli
      const userId = req.user!.id;
      const targetUserId = user._id.toString();

      // Yetkilendirme kontrolü
      await authorizeUser('view')(req, res, () => {});

      return res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      logger.error('Kullanıcı profili getirme hatası', {
        error: (error as Error).message,
        username: req.params.username
      });

      // Hata mesajını belirle
      let message = 'Kullanıcı profili getirilirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ForbiddenError') {
        message = (error as Error).message;
        statusCode = 403;
      }

      return res.status(statusCode).json({
        success: false,
        message
      });
    }
  })
);

/**
 * @route   PATCH /api/users/me
 * @desc    Kullanıcı profilini günceller
 * @access  Private
 */
router.patch(
  '/me',
  requireAuth,
  [
    body('name')
      .optional()
      .isString()
      .withMessage('Geçersiz isim formatı')
      .trim(),
    body('surname')
      .optional()
      .isString()
      .withMessage('Geçersiz soyisim formatı')
      .trim(),
    body('bio')
      .optional()
      .isString()
      .withMessage('Geçersiz bio formatı')
      .trim(),
    body('status')
      .optional()
      .isIn(['online', 'away', 'busy', 'invisible'])
      .withMessage('Geçersiz durum'),
    body('customStatus')
      .optional()
      .isString()
      .withMessage('Geçersiz özel durum formatı')
      .trim()
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const updates = req.body;

      const updatedUser = await userManager.updateUserProfile(userId, updates);

      return res.status(200).json({
        success: true,
        data: updatedUser
      });
    } catch (error) {
      logger.error('Kullanıcı profili güncelleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        updates: req.body
      });
      return res.status(500).json({
        success: false,
        message: 'Kullanıcı profili güncellenirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   GET /api/users/blocked
 * @desc    Engellenen kullanıcıları getirir
 * @access  Private
 */
router.get(
  '/blocked',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const blockedUsers = await blockManager.default.getUserBlocked(userId);

      return res.status(200).json({
        success: true,
        data: blockedUsers
      });
    } catch (error) {
      logger.error('Engellenen kullanıcıları getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Engellenen kullanıcılar getirilirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   POST /api/users/:userId/block
 * @desc    Kullanıcıyı engeller
 * @access  Private
 */
router.post(
  '/:userId/block',
  requireAuth,
  [
    param('userId')
      .isMongoId()
      .withMessage('Geçersiz kullanıcı ID')
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { userId: blockedUserId } = req.params;
      const userId = req.user!.id;

      await blockManager.blockUser(userId, blockedUserId);

      return res.status(200).json({
        success: true,
        message: 'Kullanıcı engellendi'
      });
    } catch (error) {
      logger.error('Kullanıcı engelleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        blockedUserId: req.params.userId
      });

      // Hata mesajını belirle
      let message = 'Kullanıcı engellenirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message
      });
    }
  })
);

/**
 * @route   DELETE /api/users/:userId/block
 * @desc    Kullanıcı engelini kaldırır
 * @access  Private
 */
router.delete(
  '/:userId/block',
  requireAuth,
  [
    param('userId')
      .isMongoId()
      .withMessage('Geçersiz kullanıcı ID')
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { userId: blockedUserId } = req.params;
      const userId = req.user!.id;

      await blockManager.unblockUser(userId, blockedUserId);

      return res.status(200).json({
        success: true,
        message: 'Kullanıcı engeli kaldırıldı'
      });
    } catch (error) {
      logger.error('Kullanıcı engeli kaldırma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        blockedUserId: req.params.userId
      });

      // Hata mesajını belirle
      let message = 'Kullanıcı engeli kaldırılırken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message
      });
    }
  })
);

/**
 * @route   POST /api/users/:userId/report
 * @desc    Kullanıcıyı raporlar
 * @access  Private
 */
router.post(
  '/:userId/report',
  requireAuth,
  [
    param('userId')
      .isMongoId()
      .withMessage('Geçersiz kullanıcı ID'),
    body('reason')
      .isIn(Object.values(reportManager.ReportReason))
      .withMessage('Geçersiz rapor nedeni'),
    body('details')
      .optional()
      .isString()
      .withMessage('Geçersiz detay formatı')
      .trim(),
    body('evidence')
      .optional()
      .isArray()
      .withMessage('Kanıtlar bir dizi olmalıdır')
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const { userId: reportedUserId } = req.params;
      const { reason, details, evidence } = req.body;
      const reporterId = req.user!.id;

      const report = await reportManager.createReport({
        reporterId,
        reportedUserId,
        reason,
        details,
        evidence
      });

      return res.status(201).json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Kullanıcı raporlama hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        reportedUserId: req.params.userId,
        reason: req.body.reason
      });

      // Hata mesajını belirle
      let message = 'Kullanıcı raporlanırken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        statusCode = 404;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message
      });
    }
  })
);

/**
 * @route   GET /api/users/reports
 * @desc    Kullanıcının raporlarını getirir
 * @access  Private
 */
router.get(
  '/reports',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const reports = await reportManager.getUserReports(userId);

      return res.status(200).json({
        success: true,
        data: reports
      });
    } catch (error) {
      logger.error('Kullanıcı raporlarını getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Raporlar getirilirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   GET /api/users/activity
 * @desc    Kullanıcı aktivite geçmişini getirir
 * @access  Private
 */
router.get(
  '/activity',
  requireAuth,
  [
    query('type')
      .optional()
      .isString()
      .withMessage('Geçersiz aktivite türü'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit 1-100 arasında olmalıdır')
      .toInt(),
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip 0 veya daha büyük olmalıdır')
      .toInt()
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { type, limit = 20, skip = 0 } = req.query;

      // Aktivite türüne göre farklı fonksiyonları çağır
      let result;
      if (type === 'message') {
        result = await activityManager.getMessageActivity(userId, Number(limit));
      } else if (type === 'login') {
        result = await activityManager.getLoginActivity(userId, Number(limit));
      } else {
        // Tüm aktiviteler
        result = await activityManager.getActivityHistory({
          userId,
          limit: Number(limit),
          skip: Number(skip)
        });
      }

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Kullanıcı aktivite geçmişi getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        query: req.query
      });
      return res.status(500).json({
        success: false,
        message: 'Aktivite geçmişi getirilirken bir hata oluştu'
      });
    }
  })
);

/**
 * @route   GET /api/users/search
 * @desc    Kullanıcı arama
 * @access  Private
 */
router.get(
  '/search',
  requireAuth,
  [
    query('q')
      .isString()
      .withMessage('Arama sorgusu gereklidir')
      .trim(),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('Limit 1-50 arasında olmalıdır')
      .toInt(),
    query('skip')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Skip 0 veya daha büyük olmalıdır')
      .toInt()
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { q, limit = 20, skip = 0 } = req.query;

      // Kullanıcı arama işlemi
      const result = await userManager.searchUsers(q as string, {
        limit: Number(limit),
        skip: Number(skip)
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Kullanıcı arama hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        query: req.query
      });
      return res.status(500).json({
        success: false,
        message: 'Kullanıcı arama sırasında bir hata oluştu'
      });
    }
  })
);

/**
 * @route   POST /api/users/me/avatar
 * @desc    Profil resmi yükleme
 * @access  Private
 */
router.post(
  '/me/avatar',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      // Dosya yükleme kontrolü
      // @ts-ignore - Express-fileupload tiplerini ekleyin
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Dosya yüklenmedi'
        });
      }

      // @ts-ignore - Express-fileupload tiplerini ekleyin
      const avatar = req.files.avatar;

      // Dosya türünü kontrol et
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
      if (!allowedTypes.includes(avatar.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Sadece JPEG, PNG ve GIF formatları desteklenmektedir'
        });
      }

      // Dosya boyutunu kontrol et (5MB)
      const maxSize = 5 * 1024 * 1024;
      if (avatar.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: 'Dosya boyutu 5MB\'dan küçük olmalıdır'
        });
      }

      // Dosya adını oluştur
      const fileName = `${userId}_${Date.now()}_${avatar.name}`;
      const uploadPath = `uploads/avatars/${fileName}`;

      // Dosyayı kaydet
      try {
        await avatar.mv(uploadPath);
      } catch (error) {
        logger.error('Dosya yükleme hatası', {
          error: (error as Error).message,
          userId
        });
        return res.status(500).json({
          success: false,
          message: 'Dosya yüklenirken bir hata oluştu'
        });
      }

      // Profil resmini güncelle
      const avatarUrl = `/uploads/avatars/${fileName}`;
      const result = await userManager.updateProfilePicture(userId, avatarUrl);

      return res.status(200).json({
        success: true,
        data: {
          avatarUrl: result.avatarUrl
        },
        message: 'Profil resmi başarıyla güncellendi'
      });
    } catch (error) {
      logger.error('Profil resmi yükleme hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });

      // Hata mesajını belirle
      let message = 'Profil resmi yüklenirken bir hata oluştu';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        statusCode = 400;
      }

      return res.status(statusCode).json({
        success: false,
        message
      });
    }
  })
);

/**
 * @route   DELETE /api/users/me/avatar
 * @desc    Profil resmini kaldırma
 * @access  Private
 */
router.delete(
  '/me/avatar',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      // Profil resmini kaldır
      await userManager.removeProfilePicture(userId);

      return res.status(200).json({
        success: true,
        message: 'Profil resmi başarıyla kaldırıldı'
      });
    } catch (error) {
      logger.error('Profil resmi kaldırma hatası', {
        error: (error as Error).message,
        userId: req.user!.id
      });
      return res.status(500).json({
        success: false,
        message: 'Profil resmi kaldırılırken bir hata oluştu'
      });
    }
  })
);

export default router;
