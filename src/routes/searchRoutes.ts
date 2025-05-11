/**
 * src/routes/searchRoutes.ts
 * Arama rotaları
 */
import express from 'express';
import searchController from '../controllers/searchController';
import { requireAuth } from '../middleware/auth';

const router = express.Router();

// Tüm rotalar için kimlik doğrulama gerekli
// TypeScript ile Express 4.x'te router.use() ile middleware kullanımı için düzeltme
router.use(function (req, res, next) {
  return requireAuth(req, res, next);
});

// Arama rotaları
router.get('/', searchController.search);
router.get('/users', searchController.searchUsers);
router.get('/groups', searchController.searchGroups);

export default router;
