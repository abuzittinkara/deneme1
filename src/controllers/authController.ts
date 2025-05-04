/**
 * src/controllers/authController.ts
 * Kimlik doğrulama controller'ı
 */
import { Request, Response, NextFunction } from 'express';
import { User, UserDocument, IUser } from '../models/User';
import { UserRole } from '../types/enums';
import { asyncHandler, sendSuccess, sendError } from '../utils/controllerUtils';
import { generateToken, generateRefreshToken, generateTokenPair, JwtPayload } from '../utils/jwt';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError, UnauthorizedError } from '../utils/errors';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import * as emailService from '../services/emailService';
import { getDocField, docToObject, updateDocFields } from '../utils/document-helpers';

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Yeni kullanıcı kaydı
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
 *               - name
 *               - surname
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
 *                 example: password123
 *               name:
 *                 type: string
 *                 description: Ad
 *                 example: John
 *               surname:
 *                 type: string
 *                 description: Soyad
 *                 example: Doe
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla oluşturuldu
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
 *       400:
 *         description: Geçersiz istek
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Kullanıcı adı veya e-posta zaten kullanımda
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password, name, surname } = req.body;

  // Gerekli alanları kontrol et
  if (!username || !email || !password || !name || !surname) {
    throw new ValidationError('Tüm alanlar zorunludur');
  }

  // Kullanıcı adı ve e-posta kontrolü
  const existingUser = await User.findOne({
    $or: [{ username }, { email }]
  });

  if (existingUser) {
    const existingUsername = getDocField<IUser, 'username'>(existingUser, 'username', '');
    const existingEmail = getDocField<IUser, 'email'>(existingUser, 'email', '');

    if (existingUsername === username) {
      throw new ValidationError('Bu kullanıcı adı zaten kullanımda');
    }
    if (existingEmail === email) {
      throw new ValidationError('Bu e-posta adresi zaten kullanımda');
    }
  }

  // Şifreyi hashle
  const passwordHash = await bcrypt.hash(password, 10);

  // Kullanıcıyı oluştur
  const user = new User({
    username,
    email,
    passwordHash,
    name,
    surname,
    emailVerificationToken: uuidv4(),
    emailVerified: false
  });

  await user.save();

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

  // Kullanıcı bilgilerini döndür (şifre hariç)
  const userResponse = user.toObject();
  delete userResponse.passwordHash;

  return sendSuccess(res, userResponse, 201);
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Kullanıcı girişi
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 description: Kullanıcı adı
 *                 example: johndoe
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Şifre
 *                 example: password123
 *     responses:
 *       200:
 *         description: Giriş başarılı
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
 *                     token:
 *                       type: string
 *                       description: JWT token
 *                     refreshToken:
 *                       type: string
 *                       description: Yenileme token'ı
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Geçersiz kimlik bilgileri
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body;

  // Gerekli alanları kontrol et
  if (!username || !password) {
    throw new ValidationError('Kullanıcı adı ve şifre zorunludur');
  }

  // Kullanıcıyı bul (username veya email ile)
  const user = await User.findOne({
    $or: [
      { username },
      { email: username } // Email ile de giriş yapılabilir
    ]
  });

  if (!user) {
    throw new UnauthorizedError('Geçersiz kullanıcı adı veya şifre');
  }

  // Kullanıcı durumunu kontrol et
  const userStatus = getDocField<IUser, 'status'>(user, 'status', 'active');
  if (userStatus !== 'active') {
    throw new UnauthorizedError('Hesabınız aktif değil');
  }

  // Şifreyi kontrol et
  const passwordHash = getDocField<IUser, 'passwordHash'>(user, 'passwordHash', '');
  const isPasswordValid = await bcrypt.compare(password, passwordHash);

  if (!isPasswordValid) {
    // Başarısız giriş denemesini kaydet
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    // Çok fazla başarısız deneme varsa hesabı kilitle
    if (user.loginAttempts >= 5) {
      user.status = 'locked';
      user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 dakika
      await user.save();
      throw new UnauthorizedError('Çok fazla başarısız giriş denemesi. Hesabınız 30 dakika kilitlendi.');
    }

    await user.save();
    throw new UnauthorizedError('Geçersiz kullanıcı adı veya şifre');
  }

  // Başarılı giriş - login bilgilerini sıfırla
  user.loginAttempts = 0;
  user.lastLogin = new Date();
  user.lastSeen = new Date();
  await user.save();

  const userId = user._id.toString();
  const userUsername = getDocField<IUser, 'username'>(user, 'username', '');
  const userRole = getDocField<IUser, 'role'>(user, 'role', UserRole.USER);
  const userEmail = getDocField<IUser, 'email'>(user, 'email', '');

  // Token çifti oluştur
  const tokenPair = generateTokenPair({
    id: userId,
    username: userUsername,
    role: userRole,
    status: userStatus,
    email: userEmail,
    sub: userId
  });

  // Kullanıcı bilgilerini döndür (şifre hariç)
  const userResponse = user.toObject();
  delete userResponse.passwordHash;
  delete userResponse.passwordResetToken;
  delete userResponse.passwordResetExpires;
  delete userResponse.emailVerificationToken;

  // Oturum bilgilerini döndür
  return sendSuccess(res, {
    ...tokenPair,
    user: userResponse
  });
});

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Token yenileme
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
 *                 description: Yenileme token'ı
 *     responses:
 *       200:
 *         description: Token başarıyla yenilendi
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
 *                     token:
 *                       type: string
 *                       description: Yeni JWT token
 *                     refreshToken:
 *                       type: string
 *                       description: Yeni yenileme token'ı
 *       401:
 *         description: Geçersiz yenileme token'ı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new ValidationError('Yenileme token\'ı zorunludur');
  }

  try {
    // Yenileme token'ını doğrula
    const decoded = await import('../utils/jwt').then(jwt => jwt.verifyRefreshToken(refreshToken));

    // Kullanıcıyı bul
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new UnauthorizedError('Geçersiz yenileme token\'ı');
    }

    // Kullanıcı durumunu kontrol et
    const userStatus = getDocField<IUser, 'status'>(user, 'status', 'active');
    if (userStatus !== 'active') {
      throw new UnauthorizedError('Hesabınız aktif değil');
    }

    // Son görülme zamanını güncelle
    user.lastSeen = new Date();
    await user.save();

    const userId = user._id.toString();
    const username = getDocField<IUser, 'username'>(user, 'username', '');
    const role = getDocField<IUser, 'role'>(user, 'role', UserRole.USER);
    const email = getDocField<IUser, 'email'>(user, 'email', '');

    // Yeni token çifti oluştur
    const tokenPair = generateTokenPair({
      id: userId,
      username,
      role,
      status: userStatus,
      email,
      sub: userId
    });

    return sendSuccess(res, tokenPair);
  } catch (error) {
    logger.warn('Token yenileme hatası', {
      error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      stack: error instanceof Error ? error.stack : undefined
    });

    throw new UnauthorizedError('Geçersiz yenileme token\'ı');
  }
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Mevcut kullanıcı bilgilerini getir
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Kullanıcı bilgileri
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
 *       401:
 *         description: Kimlik doğrulama gerekli
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const getMe = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // Kimlik doğrulama middleware'i req.user'ı ekler
  const user = (req as any).user as UserDocument;

  if (!user) {
    throw new UnauthorizedError('Kimlik doğrulama gerekli');
  }

  // Kullanıcı bilgilerini döndür (şifre hariç)
  const userResponse = user.toObject();
  delete userResponse.passwordHash;

  return sendSuccess(res, userResponse);
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Şifre sıfırlama e-postası gönder
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
 *                 example: john@example.com
 *     responses:
 *       200:
 *         description: Şifre sıfırlama e-postası gönderildi
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
 *                       example: Şifre sıfırlama e-postası gönderildi
 *       404:
 *         description: Kullanıcı bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { email } = req.body;

  if (!email) {
    throw new ValidationError('E-posta adresi zorunludur');
  }

  // Kullanıcıyı bul
  const user = await User.findOne({ email });

  if (!user) {
    throw new NotFoundError('Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı');
  }

  // Şifre sıfırlama token'ı oluştur
  const resetToken = crypto.randomBytes(32).toString('hex');

  // Token'ı kullanıcıya kaydet
  const updatedUser = updateDocFields<IUser>(user, {
    passwordResetToken: resetToken,
    passwordResetExpires: new Date(Date.now() + 3600000) // 1 saat
  });

  if (!updatedUser) {
    throw new Error('Kullanıcı güncellenemedi');
  }

  await updatedUser.save();

  // Şifre sıfırlama e-postası gönder
  try {
    // Şifre sıfırlama URL'si oluştur
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;

    // Kullanıcı bilgilerini al
    const email = getDocField<IUser, 'email'>(user, 'email', '');
    const username = getDocField<IUser, 'username'>(user, 'username', '');

    // E-posta gönder
    await emailService.sendPasswordResetEmail(email, {
      username,
      resetUrl
    });
  } catch (error) {
    logger.error('Şifre sıfırlama e-postası gönderilirken hata oluştu', {
      error: (error as Error).message,
      userId: user._id
    });
  }

  return sendSuccess(res, {
    message: 'Şifre sıfırlama e-postası gönderildi'
  });
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Şifre sıfırlama
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *             properties:
 *               token:
 *                 type: string
 *                 description: Şifre sıfırlama token'ı
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Yeni şifre
 *                 example: newpassword123
 *     responses:
 *       200:
 *         description: Şifre başarıyla sıfırlandı
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
 *                       example: Şifre başarıyla sıfırlandı
 *       400:
 *         description: Geçersiz veya süresi dolmuş token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
export const resetPassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token, password } = req.body;

  if (!token || !password) {
    throw new ValidationError('Token ve şifre zorunludur');
  }

  // Token'a sahip kullanıcıyı bul
  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new ValidationError('Geçersiz veya süresi dolmuş token');
  }

  // Şifreyi hashle
  const passwordHash = await bcrypt.hash(password, 10);

  // Kullanıcı bilgilerini güncelle
  const updatedUser = updateDocFields<IUser>(user, {
    passwordHash,
    passwordResetToken: undefined,
    passwordResetExpires: undefined
  });

  if (!updatedUser) {
    throw new Error('Kullanıcı güncellenemedi');
  }

  await updatedUser.save();

  return sendSuccess(res, {
    message: 'Şifre başarıyla sıfırlandı'
  });
});

export default {
  register,
  login,
  refreshToken,
  getMe,
  forgotPassword,
  resetPassword
};
