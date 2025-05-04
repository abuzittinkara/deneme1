/**
 * src/routes/groupRoutes.ts
 * Grup rotaları
 */
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
// TypeScript ile Express 4.x'te router.use() ile middleware kullanımı için düzeltme
router.use(authMiddleware);

// Grupları listele
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Gruplar listelendi (test)'
    }
  });
});

// Grup detayı
router.get('/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: `Grup detayı: ${req.params.id} (test)`
    }
  });
});

export default router;
