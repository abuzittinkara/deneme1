/**
 * src/routes/userRoutes.ts
 * Kullanıcı rotaları
 */
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
// TypeScript ile Express 4.x'te router.use() ile middleware kullanımı için düzeltme
router.use(authMiddleware);

// Kullanıcıları listele
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Kullanıcılar listelendi (test)'
    }
  });
});

// Kullanıcı detayı
router.get('/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: `Kullanıcı detayı: ${req.params.id} (test)`
    }
  });
});

export default router;
