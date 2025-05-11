/**
 * src/routes/authRoutes.ts
 * Kimlik doğrulama rotaları
 */
import express from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { AuthRequest } from '../types/express';

const router = express.Router();

// Giriş rotası
router.post('/login', (req: express.Request, res: express.Response): void => {
  const { username, password } = req.body;

  // Geçersiz giriş bilgileri kontrolü
  if (username !== 'admin' || password !== 'password') {
    return res.status(401).json({
      success: false,
      message: 'Geçersiz kullanıcı adı veya şifre',
      code: 'INVALID_CREDENTIALS',
    });
  }

  // Başarılı giriş
  res.status(200).json({
    success: true,
    message: 'Giriş başarılı',
    data: {
      user: {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        createdAt: new Date().toISOString(),
      },
      tokens: {
        accessToken: 'sample-access-token',
        refreshToken: 'sample-refresh-token',
        expiresIn: 3600,
      },
    },
  });
});

// Kayıt rotası
router.post('/register', (req: express.Request, res: express.Response): void => {
  const { username, email, password } = req.body;

  // Geçersiz kayıt bilgileri kontrolü
  if (
    !username ||
    username.length < 3 ||
    !email ||
    !email.includes('@') ||
    !password ||
    password.length < 6
  ) {
    return res.status(400).json({
      success: false,
      message: 'Doğrulama hatası',
      code: 'VALIDATION_ERROR',
      errors: [
        { field: 'username', message: 'Kullanıcı adı en az 3 karakter olmalıdır' },
        { field: 'email', message: 'Geçerli bir e-posta adresi giriniz' },
        { field: 'password', message: 'Şifre en az 6 karakter olmalıdır' },
      ],
    });
  }

  // Başarılı kayıt
  res.status(201).json({
    success: true,
    message: 'Kayıt başarılı',
    data: {
      user: {
        id: '2',
        username,
        email,
        role: 'user',
        createdAt: new Date().toISOString(),
      },
    },
  });
});

// Kullanıcı bilgisi rotası
router.get('/me', requireAuth, (req: express.Request, res: express.Response): void => {
  // Kullanıcı bilgisini döndür
  res.status(200).json({
    success: true,
    data: {
      user: {
        id: '1',
        username: 'admin',
        email: 'admin@example.com',
        role: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
      },
    },
  });
});

// Token yenileme rotası
router.post('/refresh', (req: express.Request, res: express.Response): void => {
  const { refreshToken } = req.body;

  // Geçersiz refresh token kontrolü
  if (refreshToken === 'invalid-refresh-token') {
    return res.status(401).json({
      success: false,
      message: 'Geçersiz refresh token',
      code: 'UNAUTHORIZED',
    });
  }

  // Başarılı token yenileme
  res.status(200).json({
    success: true,
    message: 'Token yenilendi',
    data: {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 3600,
    },
  });
});

// Çıkış rotası
router.post('/logout', requireAuth, (req: express.Request, res: express.Response): void => {
  res.status(200).json({
    success: true,
    message: 'Çıkış başarılı',
  });
});

export default router;
