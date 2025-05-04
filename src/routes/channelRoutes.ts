/**
 * src/routes/channelRoutes.ts
 * Kanal rotaları
 */
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
// TypeScript ile Express 4.x'te router.use() ile middleware kullanımı için düzeltme
router.use(authMiddleware);

// Kanalları listele
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Kanallar listelendi (test)'
    }
  });
});

// Kanal detayı
router.get('/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: `Kanal detayı: ${req.params.id} (test)`
    }
  });
});

export default router;
