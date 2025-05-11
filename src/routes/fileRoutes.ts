/**
 * src/routes/fileRoutes.ts
 * Dosya rotaları
 */
import express from 'express';
import fileController from '../controllers/fileController';
// Doğru middleware'i içe aktar
import { requireAuth } from '../middleware/requireAuth';
import { uploadSingleFile, uploadMultipleFiles } from '../middleware/uploadMiddleware';
import { createRouteHandler } from '../utils/express-helpers';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
// TypeScript ile Express 4.x'te router.use() ile middleware kullanımı için düzeltme
router.use(requireAuth);

// Dosya rotaları
router.get(
  '/',
  createRouteHandler((req, res) => {
    res.status(200).json({
      success: true,
      data: {
        message: 'Dosyalar listelendi (test)',
      },
    });
  })
);

// Dosya detayı
router.get(
  '/:id',
  createRouteHandler((req, res): any => {
    // MongoDB ObjectId formatını kontrol et
    const idRegex = /^[0-9a-fA-F]{24}$/;
    if (!idRegex.test(req.params['id'])) {
      return res.status(400).json({
        success: false,
        message: `Geçersiz ID formatı: ${req.params['id']}`,
        code: 'INVALID_ID',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        message: `Dosya detayı: ${req.params['id']} (test)`,
      },
    });
  })
);

// Orijinal rotaları yorum satırına alıyoruz
// router.post('/upload', uploadSingleFile('file'), fileController.uploadFile);
// router.post('/upload-multiple', uploadMultipleFiles('files', 10), fileController.uploadMultipleFiles);
// router.delete('/:id', fileController.deleteFile);
// router.get('/download/:id', fileController.downloadFile);

export default router;
