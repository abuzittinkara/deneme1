/**
 * src/routes/api/auth.ts
 * Kimlik doğrulama API endpoint'leri
 */
import express from 'express';
import { body, param, query } from 'express-validator';
import { validateRequest } from '../../middleware/validateRequest';
import { requireAuth } from '../../middleware/requireAuth';
import { createRouteHandler, createAuthRouteHandler } from '../../utils/express-helpers';
import { AuthRequest } from '../../types/express';
import * as authManager from '../../modules/auth/authManager';
import * as passwordManager from '../../modules/auth/passwordManager';
import * as emailVerification from '../../modules/emailVerification';
import { logger } from '../../utils/logger';
import { createSuccessResponse, createErrorResponse } from '../../types/api';

const router = express.Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Yeni kullanıcı kaydı yapar
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Kullanıcı adı
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 description: E-posta adresi
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Şifre
 *                 example: Password123
 *               name:
 *                 type: string
 *                 description: İsim
 *                 example: John
 *               surname:
 *                 type: string
 *                 description: Soyisim
 *                 example: Doe
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla kaydedildi
 *       400:
 *         description: Geçersiz istek
 *       409:
 *         description: Kullanıcı adı veya e-posta zaten kullanımda
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/register',
  [
    body('username')
      .isString()
      .isLength({ min: 3, max: 30 })
      .withMessage('Kullanıcı adı 3-30 karakter arasında olmalıdır')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Kullanıcı adı sadece harf, rakam ve alt çizgi içerebilir')
      .trim(),
    body('email').isEmail().withMessage('Geçerli bir e-posta adresi giriniz').normalizeEmail(),
    body('password')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Şifre en az 8 karakter olmalıdır')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/)
      .withMessage('Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir'),
    body('name').optional().isString().trim(),
    body('surname').optional().isString().trim(),
  ],
  validateRequest,
  createRouteHandler(async (req, res) => {
    try {
      const { username, email, password, name, surname } = req.body;

      const result = await authManager.registerUser({
        username,
        email,
        password,
        name,
        surname,
      });

      // E-posta doğrulama bağlantısı gönder
      await emailVerification.sendVerificationEmail(result.userId, email);

      return res
        .status(201)
        .json(
          createSuccessResponse(
            { userId: result.userId, username: result.username },
            'Kullanıcı başarıyla kaydedildi. Lütfen e-postanızı doğrulayın.'
          )
        );
    } catch (error) {
      logger.error('Kullanıcı kaydı hatası', {
        error: (error as Error).message,
        username: req.body.username,
        email: req.body.email,
      });

      // Hata mesajını belirle
      let message = 'Kullanıcı kaydı sırasında bir hata oluştu';
      let code = 'REGISTRATION_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Kullanıcı girişi yapar
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - usernameOrEmail
 *               - password
 *             properties:
 *               usernameOrEmail:
 *                 type: string
 *                 description: Kullanıcı adı veya e-posta
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Şifre
 *                 example: Password123
 *               rememberMe:
 *                 type: boolean
 *                 description: Beni hatırla
 *                 example: false
 *     responses:
 *       200:
 *         description: Giriş başarılı
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Kimlik doğrulama hatası
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/login',
  [
    body('usernameOrEmail').isString().withMessage('Kullanıcı adı veya e-posta gereklidir').trim(),
    body('password').isString().withMessage('Şifre gereklidir'),
    body('rememberMe').optional().isBoolean().withMessage('Geçersiz değer'),
  ],
  validateRequest,
  createRouteHandler(async (req, res) => {
    try {
      const { usernameOrEmail, password, rememberMe = false } = req.body;

      const result = await authManager.loginUser(usernameOrEmail, password, rememberMe);

      // Oturum bilgilerini ayarla
      const sessionData = {
        userId: result.userId,
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || 'Unknown',
      };

      // Oturum oluştur
      const session = await authManager.createSession(sessionData);

      return res.status(200).json(
        createSuccessResponse(
          {
            userId: result.userId,
            username: result.username,
            name: result.name,
            surname: result.surname,
            email: result.email,
            profilePicture: result.profilePicture,
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            expiresIn: result.expiresIn,
            sessionId: session.id,
          },
          'Giriş başarılı'
        )
      );
    } catch (error) {
      logger.error('Kullanıcı girişi hatası', {
        error: (error as Error).message,
        usernameOrEmail: req.body.usernameOrEmail,
      });

      // Hata mesajını belirle
      let message = 'Giriş sırasında bir hata oluştu';
      let code = 'LOGIN_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'AuthenticationError') {
        message = (error as Error).message;
        code = 'AUTHENTICATION_ERROR';
        statusCode = 401;
      } else if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Kullanıcı çıkışı yapar
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *               sessionId:
 *                 type: string
 *                 description: Oturum ID'si
 *     responses:
 *       200:
 *         description: Çıkış başarılı
 *       401:
 *         description: Yetkilendirme hatası
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/logout',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const refreshToken = req.body.refreshToken;
      const sessionId = req.body.sessionId;

      await authManager.logoutUser(userId, refreshToken, sessionId);

      return res.status(200).json(createSuccessResponse(null, 'Çıkış başarılı'));
    } catch (error) {
      logger.error('Kullanıcı çıkışı hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });

      return res
        .status(500)
        .json(createErrorResponse('Çıkış sırasında bir hata oluştu', 'LOGOUT_ERROR'));
    }
  })
);

/**
 * @swagger
 * /auth/refresh-token:
 *   post:
 *     summary: Access token yeniler
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: Token yenileme başarılı
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Geçersiz veya süresi dolmuş token
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/refresh-token',
  [body('refreshToken').isString().withMessage('Refresh token gereklidir')],
  validateRequest,
  createRouteHandler(async (req, res) => {
    try {
      const { refreshToken } = req.body;

      const result = await authManager.refreshToken(refreshToken);

      return res.status(200).json(
        createSuccessResponse({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
        })
      );
    } catch (error) {
      logger.error('Token yenileme hatası', {
        error: (error as Error).message,
      });

      // Hata mesajını belirle
      let message = 'Token yenileme sırasında bir hata oluştu';
      let code = 'TOKEN_REFRESH_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'AuthenticationError') {
        message = (error as Error).message;
        code = 'AUTHENTICATION_ERROR';
        statusCode = 401;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Kullanıcı şifresini değiştirir
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Mevcut şifre
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre onayı
 *     responses:
 *       200:
 *         description: Şifre başarıyla değiştirildi
 *       400:
 *         description: Geçersiz istek
 *       401:
 *         description: Yetkilendirme hatası
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/change-password',
  requireAuth,
  [
    body('currentPassword').isString().withMessage('Mevcut şifre gereklidir'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Yeni şifre en az 8 karakter olmalıdır')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/)
      .withMessage('Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir'),
    body('confirmPassword')
      .isString()
      .withMessage('Şifre onayı gereklidir')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Şifreler eşleşmiyor');
        }
        return true;
      }),
  ],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { currentPassword, newPassword } = req.body;

      const result = await authManager.changePassword(userId, currentPassword, newPassword);

      return res.status(200).json(createSuccessResponse(null, 'Şifre başarıyla değiştirildi'));
    } catch (error) {
      logger.error('Şifre değiştirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });

      // Hata mesajını belirle
      let message = 'Şifre değiştirme sırasında bir hata oluştu';
      let code = 'PASSWORD_CHANGE_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      } else if ((error as any).name === 'AuthenticationError') {
        message = (error as Error).message;
        code = 'AUTHENTICATION_ERROR';
        statusCode = 401;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Şifre sıfırlama isteği gönderir
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: E-posta adresi
 *     responses:
 *       200:
 *         description: Şifre sıfırlama talimatları gönderildi
 *       400:
 *         description: Geçersiz istek
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/forgot-password',
  [body('email').isEmail().withMessage('Geçerli bir e-posta adresi giriniz').normalizeEmail()],
  validateRequest,
  createRouteHandler(async (req, res) => {
    try {
      const { email } = req.body;

      await passwordManager.sendPasswordResetEmail(email);

      // Güvenlik nedeniyle her zaman başarılı yanıt döndür
      return res
        .status(200)
        .json(
          createSuccessResponse(
            null,
            'Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama talimatları gönderilecektir'
          )
        );
    } catch (error) {
      logger.error('Şifre sıfırlama isteği hatası', {
        error: (error as Error).message,
        email: req.body.email,
      });

      // Güvenlik nedeniyle her zaman başarılı yanıt döndür
      return res
        .status(200)
        .json(
          createSuccessResponse(
            null,
            'Eğer bu e-posta adresi kayıtlıysa, şifre sıfırlama talimatları gönderilecektir'
          )
        );
    }
  })
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Şifre sıfırlama işlemini tamamlar
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Şifre sıfırlama token'ı
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre
 *               confirmPassword:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre onayı
 *     responses:
 *       200:
 *         description: Şifre başarıyla sıfırlandı
 *       400:
 *         description: Geçersiz istek veya token
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/reset-password',
  [
    body('token').isString().withMessage('Geçersiz token'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('Yeni şifre en az 8 karakter olmalıdır')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d\w\W]{8,}$/)
      .withMessage('Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir'),
    body('confirmPassword')
      .isString()
      .withMessage('Şifre onayı gereklidir')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Şifreler eşleşmiyor');
        }
        return true;
      }),
  ],
  validateRequest,
  createRouteHandler(async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      const result = await passwordManager.resetPassword(token, newPassword);

      return res
        .status(200)
        .json(
          createSuccessResponse(null, 'Şifreniz başarıyla sıfırlandı. Şimdi giriş yapabilirsiniz.')
        );
    } catch (error) {
      logger.error('Şifre sıfırlama hatası', {
        error: (error as Error).message,
        token: req.body.token,
      });

      // Hata mesajını belirle
      let message = 'Şifre sıfırlama sırasında bir hata oluştu';
      let code = 'PASSWORD_RESET_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      } else if ((error as any).name === 'TokenExpiredError') {
        message = 'Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş';
        code = 'TOKEN_EXPIRED';
        statusCode = 400;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @swagger
 * /auth/verify-email:
 *   post:
 *     summary: E-posta adresini doğrular
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: E-posta doğrulama token'ı
 *     responses:
 *       200:
 *         description: E-posta adresi başarıyla doğrulandı
 *       400:
 *         description: Geçersiz istek veya token
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/verify-email',
  [body('token').isString().withMessage('Geçersiz token')],
  validateRequest,
  createRouteHandler(async (req, res) => {
    try {
      const { token } = req.body;

      const result = await emailVerification.verifyEmail(token);

      return res
        .status(200)
        .json(createSuccessResponse(null, 'E-posta adresiniz başarıyla doğrulandı'));
    } catch (error) {
      logger.error('E-posta doğrulama hatası', {
        error: (error as Error).message,
        token: req.body.token,
      });

      // Hata mesajını belirle
      let message = 'E-posta doğrulama sırasında bir hata oluştu';
      let code = 'EMAIL_VERIFICATION_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'ValidationError') {
        message = (error as Error).message;
        code = 'VALIDATION_ERROR';
        statusCode = 400;
      } else if ((error as any).name === 'TokenExpiredError') {
        message = 'Doğrulama bağlantısı geçersiz veya süresi dolmuş';
        code = 'TOKEN_EXPIRED';
        statusCode = 400;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @swagger
 * /auth/resend-verification:
 *   post:
 *     summary: E-posta doğrulama bağlantısını yeniden gönderir
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: E-posta adresi
 *     responses:
 *       200:
 *         description: Doğrulama bağlantısı gönderildi
 *       400:
 *         description: Geçersiz istek
 *       500:
 *         description: Sunucu hatası
 */
router.post(
  '/resend-verification',
  [body('email').isEmail().withMessage('Geçerli bir e-posta adresi giriniz').normalizeEmail()],
  validateRequest,
  createRouteHandler(async (req, res) => {
    try {
      const { email } = req.body;

      await emailVerification.resendVerificationEmail(email);

      // Güvenlik nedeniyle her zaman başarılı yanıt döndür
      return res
        .status(200)
        .json(
          createSuccessResponse(
            null,
            'Eğer bu e-posta adresi kayıtlıysa ve doğrulanmamışsa, yeni bir doğrulama bağlantısı gönderilecektir'
          )
        );
    } catch (error) {
      logger.error('Doğrulama e-postası yeniden gönderme hatası', {
        error: (error as Error).message,
        email: req.body.email,
      });

      // Güvenlik nedeniyle her zaman başarılı yanıt döndür
      return res
        .status(200)
        .json(
          createSuccessResponse(
            null,
            'Eğer bu e-posta adresi kayıtlıysa ve doğrulanmamışsa, yeni bir doğrulama bağlantısı gönderilecektir'
          )
        );
    }
  })
);

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Kullanıcının aktif oturumlarını listeler
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Oturumlar başarıyla listelendi
 *       401:
 *         description: Yetkilendirme hatası
 *       500:
 *         description: Sunucu hatası
 */
router.get(
  '/sessions',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;

      const sessions = await authManager.getUserSessions(userId);

      return res.status(200).json(createSuccessResponse(sessions));
    } catch (error) {
      logger.error('Oturum listesi getirme hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });

      return res
        .status(500)
        .json(createErrorResponse('Oturumlar getirilirken bir hata oluştu', 'SESSIONS_ERROR'));
    }
  })
);

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Belirli bir oturumu sonlandırır
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Oturum ID'si
 *     responses:
 *       200:
 *         description: Oturum başarıyla sonlandırıldı
 *       401:
 *         description: Yetkilendirme hatası
 *       404:
 *         description: Oturum bulunamadı
 *       500:
 *         description: Sunucu hatası
 */
router.delete(
  '/sessions/:sessionId',
  requireAuth,
  [param('sessionId').isString().withMessage('Geçersiz oturum ID')],
  validateRequest,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const { sessionId } = req.params;

      await authManager.endSession(userId, sessionId);

      return res.status(200).json(createSuccessResponse(null, 'Oturum başarıyla sonlandırıldı'));
    } catch (error) {
      logger.error('Oturum sonlandırma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
        sessionId: req.params.sessionId,
      });

      // Hata mesajını belirle
      let message = 'Oturum sonlandırılırken bir hata oluştu';
      let code = 'SESSION_END_ERROR';
      let statusCode = 500;

      if ((error as any).name === 'NotFoundError') {
        message = (error as Error).message;
        code = 'NOT_FOUND';
        statusCode = 404;
      } else if ((error as any).name === 'AuthorizationError') {
        message = (error as Error).message;
        code = 'AUTHORIZATION_ERROR';
        statusCode = 403;
      }

      return res.status(statusCode).json(createErrorResponse(message, code));
    }
  })
);

/**
 * @swagger
 * /auth/sessions:
 *   delete:
 *     summary: Tüm oturumları sonlandırır (mevcut oturum hariç)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentSessionId
 *             properties:
 *               currentSessionId:
 *                 type: string
 *                 description: Mevcut oturum ID'si
 *     responses:
 *       200:
 *         description: Tüm diğer oturumlar başarıyla sonlandırıldı
 *       401:
 *         description: Yetkilendirme hatası
 *       500:
 *         description: Sunucu hatası
 */
router.delete(
  '/sessions',
  requireAuth,
  createAuthRouteHandler(async (req: AuthRequest, res) => {
    try {
      const userId = req.user!.id;
      const currentSessionId = req.body.currentSessionId;

      await authManager.endAllSessionsExcept(userId, currentSessionId);

      return res
        .status(200)
        .json(createSuccessResponse(null, 'Tüm diğer oturumlar başarıyla sonlandırıldı'));
    } catch (error) {
      logger.error('Tüm oturumları sonlandırma hatası', {
        error: (error as Error).message,
        userId: req.user!.id,
      });

      return res
        .status(500)
        .json(
          createErrorResponse('Oturumlar sonlandırılırken bir hata oluştu', 'SESSIONS_END_ERROR')
        );
    }
  })
);

export default router;
