/**
 * src/routes/userRoutes.ts
 * Kullanıcı rotaları
 */
import express from 'express';
import { requireAuth } from '../middleware/authMiddleware';
import userController from '../controllers/userController';
import { AuthRequest } from '../types/express-types';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
router.use(requireAuth as express.RequestHandler);

// Kullanıcıları listele
router.get('/', userController.getUsers);

// Kullanıcı detayı
router.get('/:id', userController.getUserById);

// Kullanıcı güncelle
router.put('/:id', userController.updateUser);

// Şifre değiştir
router.post('/:id/change-password', userController.changePassword);

export default router;
