/**
 * src/routes/messageRoutes.ts
 * Mesaj rotaları
 */
import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @route GET /api/messages
 * @desc Tüm mesajları listele (test için)
 * @access Private
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: 'Mesajlar listelendi (test)'
    }
  });
});

/**
 * @route GET /api/messages/:id
 * @desc Mesaj detayını getir (test için)
 * @access Private
 */
router.get('/:id', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: `Mesaj detayı: ${req.params.id} (test)`
    }
  });
});

/**
 * @route GET /api/messages/channel/:channelId
 * @desc Kanal mesajlarını getir (sayfalı)
 * @access Private
 */
router.get('/channel/:channelId', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      message: `Kanal mesajları: ${req.params.channelId} (test)`
    }
  });
});

export default router;
